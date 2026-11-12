import React, { useEffect, useRef, useState } from 'react';
import {
  Columns,
  Download,
  Grid,
  Maximize2,
  Minimize2,
  RotateCcw,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  getChannelCanvas,
  getOrCreatePBRChannelSet,
} from '../three/proceduralTextures';
import {
  StudioState,
  TextureChannel,
  TexturePattern,
  UVTriangleSegment,
} from '../types/studio';

interface TextureViewerProps {
  state: StudioState;
  uvSegments: UVTriangleSegment[];
  customImageElement: HTMLImageElement | null;
  onUpdateState: (patch: Partial<StudioState>) => void;
  onUploadCustomTextureFile: (file: File) => void;
  onToast: (msg: string) => void;
}

const CHANNELS: { id: TextureChannel; label: string; badge: string }[] = [
  { id: 'albedo', label: 'Albedo', badge: 'sRGB' },
  { id: 'normal', label: 'Normal', badge: 'XYZ' },
  { id: 'roughness', label: 'Roughness', badge: 'Lin' },
  { id: 'metalness', label: 'Metalness', badge: 'Lin' },
];

export const TextureViewer: React.FC<TextureViewerProps> = ({
  state,
  uvSegments,
  customImageElement,
  onUpdateState,
  onUploadCustomTextureFile,
  onToast,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoverUv, setHoverUv] = useState<{ u: number; v: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  const ov = state.materialOverride;

  // Render active texture channel + tiling/offset + UV mesh wireframe onto the 2D canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // 1. Dark studio backdrop with subtle grid outside UV [0..1] tile
    ctx.fillStyle = '#0f0f12';
    ctx.fillRect(0, 0, width, height);

    const tileSize = Math.min(width, height) * 0.78 * zoom;
    const originX = (width - tileSize) / 2 + pan.x;
    const originY = (height - tileSize) / 2 + pan.y;

    // 2. Get source channel canvas from procedural/custom generator
    const channelSet = getOrCreatePBRChannelSet(
      ov.texturePattern,
      4,
      customImageElement,
      ov.colorHex,
      ov.roughness,
      ov.metalness
    );
    const sourceCanvas = getChannelCanvas(channelSet, state.activeTextureChannel);

    // 3. Draw tiled/offset/rotated texture inside the [0..1] UV square
    ctx.save();
    ctx.beginPath();
    ctx.rect(originX, originY, tileSize, tileSize);
    ctx.clip();

    // Transform around UV center (0.5, 0.5)
    const cx = originX + tileSize / 2;
    const cy = originY + tileSize / 2;
    ctx.translate(cx, cy);
    ctx.rotate((ov.rotationDeg * Math.PI) / 180);
    ctx.translate(-cx, -cy);

    const repX = Math.max(0.25, ov.repeatX);
    const repY = Math.max(0.25, ov.repeatY);
    const subW = tileSize / repX;
    const subH = tileSize / repY;
    const offPxX = (ov.offsetX % 1) * subW;
    const offPxY = -(ov.offsetY % 1) * subH;

    const cols = Math.ceil(repX) + 2;
    const rows = Math.ceil(repY) + 2;

    for (let r = -1; r <= rows; r++) {
      for (let c = -1; c <= cols; c++) {
        const dx = originX + c * subW - offPxX;
        const dy = originY + r * subH - offPxY;
        ctx.drawImage(sourceCanvas, dx, dy, subW + 0.6, subH + 0.6);
      }
    }
    ctx.restore();

    // 4. Draw UV [0..1] boundary border and subtle quarter-grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const gx = originX + (tileSize * i) / 4;
      const gy = originY + (tileSize * i) / 4;
      ctx.beginPath();
      ctx.moveTo(gx, originY);
      ctx.lineTo(gx, originY + tileSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(originX, gy);
      ctx.lineTo(originX + tileSize, gy);
      ctx.stroke();
    }

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(originX, originY, tileSize, tileSize);

    // 5. Overlay Live 3D Mesh UV Wireframe Islands
    if (state.showUvWireframe && uvSegments.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(originX, originY, tileSize, tileSize);
      ctx.clip();

      uvSegments.forEach((seg) => {
        const isSelectedPart =
          !state.selectedPartName || seg.partName === state.selectedPartName;
        if (!isSelectedPart && state.selectedPartName) {
          ctx.strokeStyle = 'rgba(161, 161, 170, 0.14)';
          ctx.lineWidth = 0.6;
        } else {
          ctx.strokeStyle = state.selectedPartName
            ? 'rgba(34, 211, 238, 0.85)'
            : 'rgba(56, 189, 248, 0.55)';
          ctx.lineWidth = state.selectedPartName ? 1.15 : 0.8;
        }

        const coords = seg.coords;
        ctx.beginPath();
        for (let i = 0; i < coords.length; i += 6) {
          const u0 = originX + coords[i] * tileSize;
          const v0 = originY + (1 - coords[i + 1]) * tileSize;
          const u1 = originX + coords[i + 2] * tileSize;
          const v1 = originY + (1 - coords[i + 3]) * tileSize;
          const u2 = originX + coords[i + 4] * tileSize;
          const v2 = originY + (1 - coords[i + 5]) * tileSize;

          ctx.moveTo(u0, v0);
          ctx.lineTo(u1, v1);
          ctx.lineTo(u2, v2);
          ctx.lineTo(u0, v0);
        }
        ctx.stroke();
      });

      ctx.restore();
    }

    // 6. UV Origin Labels (0,0) and (1,1)
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('UV (0,0)', originX + 4, originY + tileSize + 14);
    ctx.fillText('UV (1,1)', originX + tileSize - 48, originY - 6);
  }, [
    state.activeTextureChannel,
    state.showUvWireframe,
    state.selectedPartName,
    ov.texturePattern,
    ov.colorHex,
    ov.roughness,
    ov.metalness,
    ov.repeatX,
    ov.repeatY,
    ov.offsetX,
    ov.offsetY,
    ov.rotationDeg,
    uvSegments,
    customImageElement,
    zoom,
    pan,
  ]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const px = (e.clientX - rect.left) * scaleX;
      const py = (e.clientY - rect.top) * scaleY;
      const tileSize = Math.min(canvas.width, canvas.height) * 0.78 * zoom;
      const originX = (canvas.width - tileSize) / 2 + pan.x;
      const originY = (canvas.height - tileSize) / 2 + pan.y;
      const u = (px - originX) / tileSize;
      const v = 1 - (py - originY) / tileSize;
      setHoverUv({ u: Number(u.toFixed(3)), v: Number(v.toFixed(3)) });
    }

    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom((z) => Math.max(0.35, Math.min(4.0, Number((z * delta).toFixed(2)))));
  };

  const handleExportChannelPng = () => {
    const channelSet = getOrCreatePBRChannelSet(
      ov.texturePattern,
      4,
      customImageElement,
      ov.colorHex,
      ov.roughness,
      ov.metalness
    );
    const srcCanvas = getChannelCanvas(channelSet, state.activeTextureChannel);
    const dataUrl = srcCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `texture-${state.activeTextureChannel}-512x512.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onToast(`Exported 512×512 ${state.activeTextureChannel.toUpperCase()} map as PNG`);
  };

  const isPip = state.textureViewerMode === 'pip';

  const containerClasses = isPip
    ? `fixed bottom-24 left-4 z-30 w-[380px] max-w-[92vw] bg-[#141417] border border-[#27272a] rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto`
    : `w-full h-full bg-[#141417] border-l border-[#27272a] flex flex-col overflow-hidden select-none`;

  return (
    <section className={containerClasses} aria-label="2D Texture and UV Inspector">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            onUploadCustomTextureFile(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      {/* Top Header Bar */}
      <div className="px-3.5 py-2 bg-[#1e1e22] border-b border-[#27272a] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Grid className="w-4 h-4 text-[#3b82f6] shrink-0" />
          <div className="truncate">
            <div className="text-xs font-semibold text-[#f4f4f5] truncate">
              2D Texture &amp; UV Inspector
            </div>
            <div className="text-[10px] font-mono-tabular text-[#a1a1aa] truncate">
              512×512px ·{' '}
              {state.selectedPartName
                ? `UVs: ${state.selectedPartName}`
                : 'All Assembly UVs'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Upload Image Texture Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[38px] px-2.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Upload custom PNG/JPG/WebP texture"
          >
            <Upload className="w-3.5 h-3.5 text-[#3b82f6]" />
            <span>Load Image</span>
          </button>

          {/* Toggle PiP vs Split Mode */}
          <button
            type="button"
            onClick={() =>
              onUpdateState({
                textureViewerMode: isPip ? 'split' : 'pip',
              })
            }
            className="min-h-[38px] min-w-[38px] rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#d4d4d8] flex items-center justify-center transition-colors cursor-pointer"
            title={
              isPip
                ? 'Expand to 50/50 Side-by-Side Split View'
                : 'Float as Picture-in-Picture Window'
            }
          >
            {isPip ? (
              <Columns className="w-4 h-4" />
            ) : (
              <Minimize2 className="w-4 h-4" />
            )}
          </button>

          {/* Close Texture Viewer */}
          <button
            type="button"
            onClick={() => onUpdateState({ textureViewerMode: 'closed' })}
            className="min-h-[38px] min-w-[38px] rounded-lg bg-[#27272a] hover:bg-rose-500/20 text-[#a1a1aa] hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer"
            title="Close 2D Texture Viewer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Channel Isolation Segmented Strip */}
      <div className="px-3 py-1.5 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between gap-1.5 overflow-x-auto shrink-0">
        <div className="flex items-center gap-1">
          {CHANNELS.map((ch) => {
            const active = state.activeTextureChannel === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => onUpdateState({ activeTextureChannel: ch.id })}
                className={`min-h-[36px] px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#3b82f6] text-white'
                    : 'bg-[#27272a]/70 text-[#a1a1aa] hover:text-[#f4f4f5]'
                }`}
              >
                <span>{ch.label}</span>
                <span className="text-[10px] font-mono-tabular opacity-75">
                  {ch.badge}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() =>
            onUpdateState({ showUvWireframe: !state.showUvWireframe })
          }
          className={`min-h-[36px] px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            state.showUvWireframe
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'bg-[#27272a]/70 text-[#a1a1aa] hover:text-white'
          }`}
          title="Overlay 3D Mesh UV Wireframe Islands"
        >
          UV Mesh
        </button>
      </div>

      {/* Interactive 2D UV & Texture Canvas */}
      <div className="relative flex-1 min-h-[230px] bg-[#09090b] flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          width={560}
          height={560}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          className="w-full h-full object-contain cursor-grab active:cursor-grabbing touch-none"
        />

        {/* Floating Zoom & UV Telemetry Overlay */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          <div className="bg-[#141417]/90 border border-[#27272a] rounded-lg px-2.5 py-1 text-[11px] font-mono-tabular text-[#d4d4d8]">
            <span>Zoom {Math.round(zoom * 100)}%</span>
            {hoverUv && (
              <>
                <span className="mx-1.5 text-[#52525b]">·</span>
                <span>
                  U:{hoverUv.u} V:{hoverUv.v}
                </span>
              </>
            )}
          </div>

          <div className="pointer-events-auto flex items-center gap-1 bg-[#141417]/95 border border-[#27272a] rounded-lg p-1">
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.min(4.0, Number((z + 0.25).toFixed(2))))
              }
              className="w-8 h-8 rounded hover:bg-[#27272a] text-[#d4d4d8] flex items-center justify-center cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.max(0.35, Number((z - 0.25).toFixed(2))))
              }
              className="w-8 h-8 rounded hover:bg-[#27272a] text-[#d4d4d8] flex items-center justify-center cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1.0);
                setPan({ x: 0, y: 0 });
              }}
              className="w-8 h-8 rounded hover:bg-[#27272a] text-[#d4d4d8] flex items-center justify-center cursor-pointer"
              title="Reset 1:1 UV View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleExportChannelPng}
              className="w-8 h-8 rounded hover:bg-[#27272a] text-[#3b82f6] flex items-center justify-center cursor-pointer"
              title="Download Active Channel Map (.PNG)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Live UV Transform & Pattern Strip */}
      <div className="p-3 bg-[#18181b] border-t border-[#27272a] space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <select
            value={ov.texturePattern}
            onChange={(e) =>
              onUpdateState({
                materialOverride: {
                  ...ov,
                  texturePattern: e.target.value as TexturePattern,
                },
              })
            }
            aria-label="Select Surface Texture Map"
            className="flex-1 min-h-[38px] px-2.5 rounded-lg bg-[#27272a] text-[#f4f4f5] border border-[#3f3f46] text-xs cursor-pointer"
          >
            <option value="uv-grid">UV Calibration Checkerboard</option>
            <option value="brushed-metal">Anisotropic Brushed Metal</option>
            <option value="carbon-weave">Twill Carbon-Fiber Weave</option>
            <option value="knurled-diamond">Machined Diamond Knurl</option>
            <option value="pcb-traces">Gold/Emerald Aerospace PCB</option>
            <option value="none">Solid Albedo / PBR Channels</option>
            {ov.customTextureName && (
              <option value="custom-image">
                Custom: {ov.customTextureName}
              </option>
            )}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <div className="flex justify-between text-[#a1a1aa] mb-0.5">
              <span>Tile X/Y</span>
              <span className="font-mono-tabular text-[#f4f4f5]">
                {ov.repeatX}×
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={8}
              step={0.5}
              value={ov.repeatX}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onUpdateState({
                  materialOverride: { ...ov, repeatX: v, repeatY: v },
                });
              }}
              className="w-full accent-[#3b82f6] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[#a1a1aa] mb-0.5">
              <span>Offset U</span>
              <span className="font-mono-tabular text-[#f4f4f5]">
                {ov.offsetX.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={ov.offsetX}
              onChange={(e) =>
                onUpdateState({
                  materialOverride: {
                    ...ov,
                    offsetX: parseFloat(e.target.value),
                  },
                })
              }
              className="w-full accent-[#3b82f6] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[#a1a1aa] mb-0.5">
              <span>Rotate UV</span>
              <span className="font-mono-tabular text-[#f4f4f5]">
                {ov.rotationDeg}°
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={15}
              value={ov.rotationDeg}
              onChange={(e) =>
                onUpdateState({
                  materialOverride: {
                    ...ov,
                    rotationDeg: parseInt(e.target.value, 10),
                  },
                })
              }
              className="w-full accent-[#3b82f6] cursor-pointer"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
