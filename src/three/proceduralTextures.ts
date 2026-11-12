import * as THREE from 'three';
import { EnvPreset, TextureChannel, TexturePattern } from '../types/studio';

const textureCache = new Map<string, THREE.Texture>();

export interface PBRCanvasChannelSet {
  albedoCanvas: HTMLCanvasElement;
  normalCanvas: HTMLCanvasElement;
  roughnessCanvas: HTMLCanvasElement;
  metalnessCanvas: HTMLCanvasElement;
  albedoTexture: THREE.CanvasTexture;
  bumpTexture: THREE.CanvasTexture;
  roughnessTexture: THREE.CanvasTexture;
  metalnessTexture: THREE.CanvasTexture;
}

const channelSetCache = new Map<string, PBRCanvasChannelSet>();

/**
 * Generates a soft radial contact shadow texture for grounding 3D models at Y = 0
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const key = 'contact_shadow';
  if (textureCache.has(key)) {
    return textureCache.get(key) as THREE.CanvasTexture;
  }

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.04,
    size / 2,
    size / 2,
    size * 0.48
  );
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.72)');
  grad.addColorStop(0.35, 'rgba(15, 23, 42, 0.42)');
  grad.addColorStop(0.7, 'rgba(15, 23, 42, 0.12)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  textureCache.set(key, texture);
  return texture;
}

/**
 * Generates a razor-sharp studio calibration floor grid texture
 */
export function createCalibrationGridTexture(
  maxAnisotropy: number,
  isDarkBg: boolean
): THREE.CanvasTexture {
  const key = `grid_${isDarkBg ? 'dark' : 'light'}`;
  if (textureCache.has(key)) {
    return textureCache.get(key) as THREE.CanvasTexture;
  }

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  ctx.strokeStyle = isDarkBg ? 'rgba(161, 161, 170, 0.11)' : 'rgba(71, 85, 105, 0.10)';
  ctx.lineWidth = 1;
  const step = size / 8;
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  ctx.strokeStyle = isDarkBg ? 'rgba(161, 161, 170, 0.24)' : 'rgba(51, 65, 85, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  textureCache.set(key, texture);
  return texture;
}

/**
 * Generates a complete 4-channel PBR Canvas set (Albedo, Normal/Bump, Roughness, Metalness)
 * so both the 3D MeshPhysicalMaterial and the 2D Texture & UV Channel Viewer can inspect all maps.
 */
export function getOrCreatePBRChannelSet(
  pattern: TexturePattern,
  maxAnisotropy: number,
  customImageElement?: HTMLImageElement | null,
  baseColorHex = '#94a3b8',
  roughnessVal = 0.25,
  metalnessVal = 0.85
): PBRCanvasChannelSet {
  const cacheKey =
    pattern === 'custom-image' && customImageElement
      ? `custom_${customImageElement.src.slice(-48)}`
      : `preset_${pattern}_${baseColorHex}_${roughnessVal.toFixed(2)}_${metalnessVal.toFixed(2)}`;

  if (channelSetCache.has(cacheKey)) {
    return channelSetCache.get(cacheKey)!;
  }

  const size = 512;
  const makeCanvas = () => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    return c;
  };

  const albedoCanvas = makeCanvas();
  const normalCanvas = makeCanvas();
  const roughnessCanvas = makeCanvas();
  const metalnessCanvas = makeCanvas();

  const aCtx = albedoCanvas.getContext('2d')!;
  const nCtx = normalCanvas.getContext('2d')!;
  const rCtx = roughnessCanvas.getContext('2d')!;
  const mCtx = metalnessCanvas.getContext('2d')!;

  const rBase = Math.round(roughnessVal * 255);
  const mBase = Math.round(metalnessVal * 255);

  if (pattern === 'custom-image' && customImageElement) {
    aCtx.drawImage(customImageElement, 0, 0, size, size);

    // Derive tangent-space normal tint & roughness/metalness luminance maps from custom image
    nCtx.fillStyle = 'rgb(128, 128, 255)';
    nCtx.fillRect(0, 0, size, size);
    nCtx.globalAlpha = 0.35;
    nCtx.drawImage(customImageElement, 0, 0, size, size);
    nCtx.globalAlpha = 1.0;

    rCtx.fillStyle = `rgb(${rBase}, ${rBase}, ${rBase})`;
    rCtx.fillRect(0, 0, size, size);
    rCtx.globalCompositeOperation = 'multiply';
    rCtx.drawImage(customImageElement, 0, 0, size, size);
    rCtx.globalCompositeOperation = 'source-over';

    mCtx.fillStyle = `rgb(${mBase}, ${mBase}, ${mBase})`;
    mCtx.fillRect(0, 0, size, size);
  } else if (pattern === 'brushed-metal') {
    aCtx.fillStyle = baseColorHex;
    aCtx.fillRect(0, 0, size, size);
    nCtx.fillStyle = '#8080ff';
    nCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = `rgb(${rBase}, ${rBase}, ${rBase})`;
    rCtx.fillRect(0, 0, size, size);
    mCtx.fillStyle = `rgb(${mBase}, ${mBase}, ${mBase})`;
    mCtx.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y++) {
      const wave = Math.sin(y * 1.4) * 16 + ((y * 37) % 21) - 10;
      const alpha = Math.abs(wave) / 70;
      aCtx.fillStyle = wave > 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      aCtx.fillRect(0, y, size, 1);

      const ny = Math.max(90, Math.min(170, Math.round(128 + wave * 1.8)));
      nCtx.fillStyle = `rgb(128, ${ny}, 255)`;
      nCtx.fillRect(0, y, size, 1);

      const rv = Math.max(15, Math.min(245, Math.round(rBase + wave * 1.5)));
      rCtx.fillStyle = `rgb(${rv}, ${rv}, ${rv})`;
      rCtx.fillRect(0, y, size, 1);
    }
  } else if (pattern === 'carbon-weave') {
    const cell = 32;
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        const isEven = (x / cell + y / cell) % 2 === 0;
        const grad = aCtx.createLinearGradient(x, y, x + cell, y + cell);
        if (isEven) {
          grad.addColorStop(0, '#090d16');
          grad.addColorStop(0.5, '#334155');
          grad.addColorStop(1, '#1e293b');
        } else {
          grad.addColorStop(0, '#334155');
          grad.addColorStop(0.5, '#1e293b');
          grad.addColorStop(1, '#090d16');
        }
        aCtx.fillStyle = grad;
        aCtx.fillRect(x, y, cell, cell);
        aCtx.strokeStyle = 'rgba(0,0,0,0.45)';
        aCtx.strokeRect(x, y, cell, cell);

        // Normal map bevel look
        nCtx.fillStyle = isEven ? 'rgb(148, 112, 255)' : 'rgb(112, 148, 255)';
        nCtx.fillRect(x + 1, y + 1, cell - 2, cell - 2);

        // Roughness alternation (glossy resin vs matte fiber)
        const rv = isEven ? Math.max(25, rBase - 35) : Math.min(230, rBase + 35);
        rCtx.fillStyle = `rgb(${rv}, ${rv}, ${rv})`;
        rCtx.fillRect(x, y, cell, cell);

        // Metalness map
        const mv = isEven ? 75 : 40;
        mCtx.fillStyle = `rgb(${mv}, ${mv}, ${mv})`;
        mCtx.fillRect(x, y, cell, cell);
      }
    }
  } else if (pattern === 'knurled-diamond') {
    aCtx.fillStyle = baseColorHex;
    aCtx.fillRect(0, 0, size, size);
    nCtx.fillStyle = 'rgb(128, 128, 255)';
    nCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = `rgb(${rBase}, ${rBase}, ${rBase})`;
    rCtx.fillRect(0, 0, size, size);
    mCtx.fillStyle = `rgb(${mBase}, ${mBase}, ${mBase})`;
    mCtx.fillRect(0, 0, size, size);

    const step = 32;
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        aCtx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
        aCtx.lineWidth = 2;
        aCtx.beginPath();
        aCtx.moveTo(x + step / 2, y + 2);
        aCtx.lineTo(x + step - 2, y + step / 2);
        aCtx.lineTo(x + step / 2, y + step - 2);
        aCtx.lineTo(x + 2, y + step / 2);
        aCtx.closePath();
        aCtx.stroke();

        // Faceted normal diamond
        nCtx.fillStyle = 'rgb(165, 165, 255)';
        nCtx.beginPath();
        nCtx.moveTo(x + step / 2, y + 3);
        nCtx.lineTo(x + step - 3, y + step / 2);
        nCtx.lineTo(x + step / 2, y + step - 3);
        nCtx.lineTo(x + 3, y + step / 2);
        nCtx.closePath();
        nCtx.fill();

        rCtx.fillStyle = 'rgb(45, 45, 45)';
        rCtx.fillRect(x + 6, y + 6, step - 12, step - 12);
      }
    }
  } else if (pattern === 'pcb-traces') {
    // High-contrast aerospace Gold/Emerald PCB trace texture
    aCtx.fillStyle = '#064e3b';
    aCtx.fillRect(0, 0, size, size);
    nCtx.fillStyle = 'rgb(128, 128, 255)';
    nCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = 'rgb(140, 140, 140)';
    rCtx.fillRect(0, 0, size, size);
    mCtx.fillStyle = 'rgb(20, 20, 20)';
    mCtx.fillRect(0, 0, size, size);

    const drawPadAndTrace = (x1: number, y1: number, x2: number, y2: number) => {
      // Albedo copper/gold trace
      aCtx.strokeStyle = '#fbbf24';
      aCtx.lineWidth = 6;
      aCtx.beginPath();
      aCtx.moveTo(x1, y1);
      aCtx.lineTo((x1 + x2) / 2, y1);
      aCtx.lineTo(x2, y2);
      aCtx.stroke();

      aCtx.fillStyle = '#f59e0b';
      aCtx.beginPath();
      aCtx.arc(x1, y1, 9, 0, Math.PI * 2);
      aCtx.arc(x2, y2, 9, 0, Math.PI * 2);
      aCtx.fill();

      // Normal ridge
      nCtx.strokeStyle = 'rgb(160, 155, 255)';
      nCtx.lineWidth = 7;
      nCtx.beginPath();
      nCtx.moveTo(x1, y1);
      nCtx.lineTo((x1 + x2) / 2, y1);
      nCtx.lineTo(x2, y2);
      nCtx.stroke();

      // Shiny metallic trace on Roughness (low) & Metalness (high)
      rCtx.strokeStyle = 'rgb(30, 30, 30)';
      rCtx.lineWidth = 6;
      rCtx.beginPath();
      rCtx.moveTo(x1, y1);
      rCtx.lineTo((x1 + x2) / 2, y1);
      rCtx.lineTo(x2, y2);
      rCtx.stroke();

      mCtx.strokeStyle = 'rgb(250, 250, 250)';
      mCtx.lineWidth = 6;
      mCtx.beginPath();
      mCtx.moveTo(x1, y1);
      mCtx.lineTo((x1 + x2) / 2, y1);
      mCtx.lineTo(x2, y2);
      mCtx.stroke();
    };

    for (let i = 0; i < 16; i++) {
      const y = 24 + i * 30;
      drawPadAndTrace(32 + (i % 3) * 40, y, 460 - (i % 4) * 50, y + ((i % 2) * 20 - 10));
    }
  } else if (pattern === 'uv-grid') {
    const cells = 8;
    const cellSize = size / cells;
    const palette = [
      '#ef4444',
      '#f97316',
      '#eab308',
      '#22c55e',
      '#06b6d4',
      '#3b82f6',
      '#8b5cf6',
      '#ec4899',
    ];
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        const isDark = (r + c) % 2 === 0;
        aCtx.fillStyle = isDark ? '#18181b' : '#27272a';
        aCtx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);

        aCtx.strokeStyle = palette[r % palette.length];
        aCtx.lineWidth = 2;
        aCtx.strokeRect(c * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2);

        aCtx.fillStyle = '#f4f4f5';
        aCtx.font = 'bold 13px monospace';
        aCtx.fillText(
          `${String.fromCharCode(65 + r)}${c + 1}`,
          c * cellSize + 16,
          r * cellSize + 36
        );
      }
    }
    nCtx.fillStyle = 'rgb(128, 128, 255)';
    nCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = `rgb(${rBase}, ${rBase}, ${rBase})`;
    rCtx.fillRect(0, 0, size, size);
    mCtx.fillStyle = `rgb(${mBase}, ${mBase}, ${mBase})`;
    mCtx.fillRect(0, 0, size, size);
  } else {
    // 'none' - Clean Machined Surface with subtle radial studio variation for 2D channel inspection
    aCtx.fillStyle = baseColorHex;
    aCtx.fillRect(0, 0, size, size);

    nCtx.fillStyle = 'rgb(128, 128, 255)';
    nCtx.fillRect(0, 0, size, size);

    rCtx.fillStyle = `rgb(${rBase}, ${rBase}, ${rBase})`;
    rCtx.fillRect(0, 0, size, size);

    mCtx.fillStyle = `rgb(${mBase}, ${mBase}, ${mBase})`;
    mCtx.fillRect(0, 0, size, size);
  }

  const configureTex = (canvas: HTMLCanvasElement, isColor: boolean) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = maxAnisotropy;
    tex.center.set(0.5, 0.5);
    tex.needsUpdate = true;
    return tex;
  };

  const bundle: PBRCanvasChannelSet = {
    albedoCanvas,
    normalCanvas,
    roughnessCanvas,
    metalnessCanvas,
    albedoTexture: configureTex(albedoCanvas, true),
    bumpTexture: configureTex(normalCanvas, false),
    roughnessTexture: configureTex(roughnessCanvas, false),
    metalnessTexture: configureTex(metalnessCanvas, false),
  };

  channelSetCache.set(cacheKey, bundle);
  return bundle;
}

export function getChannelCanvas(
  set: PBRCanvasChannelSet,
  channel: TextureChannel
): HTMLCanvasElement {
  switch (channel) {
    case 'normal':
      return set.normalCanvas;
    case 'roughness':
      return set.roughnessCanvas;
    case 'metalness':
      return set.metalnessCanvas;
    case 'albedo':
    default:
      return set.albedoCanvas;
  }
}

/**
 * Generates a procedural equirectangular studio reflection texture for different lighting moods
 */
export function createProceduralEnvironmentTexture(
  preset: EnvPreset,
  rotationDeg: number
): THREE.CanvasTexture {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  if (preset === 'warm-atelier') {
    skyGrad.addColorStop(0, '#fff7ed');
    skyGrad.addColorStop(0.48, '#fed7aa');
    skyGrad.addColorStop(0.52, '#431407');
    skyGrad.addColorStop(1, '#1c1917');
  } else if (preset === 'cool-cleanroom') {
    skyGrad.addColorStop(0, '#f0f9ff');
    skyGrad.addColorStop(0.48, '#bae6fd');
    skyGrad.addColorStop(0.52, '#1e293b');
    skyGrad.addColorStop(1, '#0f172a');
  } else if (preset === 'sunset-hangar') {
    skyGrad.addColorStop(0, '#fef08a');
    skyGrad.addColorStop(0.35, '#fb923c');
    skyGrad.addColorStop(0.5, '#4c1d95');
    skyGrad.addColorStop(1, '#090d16');
  } else {
    skyGrad.addColorStop(0, '#f8fafc');
    skyGrad.addColorStop(0.48, '#cbd5e1');
    skyGrad.addColorStop(0.52, '#334155');
    skyGrad.addColorStop(1, '#0f172a');
  }

  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  const shiftX = ((rotationDeg % 360) / 360) * width;
  const drawSoftbox = (cx: number, cy: number, w: number, h: number, color: string) => {
    const wrappedX = ((cx + shiftX) % width + width) % width;
    ctx.fillStyle = color;
    ctx.fillRect(wrappedX - w / 2, cy - h / 2, w, h);
    if (wrappedX + w / 2 > width) {
      ctx.fillRect(wrappedX - width - w / 2, cy - h / 2, w, h);
    }
  };

  drawSoftbox(width * 0.25, height * 0.24, 95, 42, 'rgba(255, 255, 255, 0.96)');
  drawSoftbox(width * 0.68, height * 0.28, 70, 36, 'rgba(254, 243, 199, 0.88)');
  drawSoftbox(width * 0.85, height * 0.36, 48, 28, 'rgba(186, 230, 253, 0.85)');

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
