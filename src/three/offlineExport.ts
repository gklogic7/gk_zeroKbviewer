import { CameraTelemetry, Hotspot3D, StudioState } from '../types/studio';

/**
 * Generates the live <model-viewer> HTML snippet matching the reference modelviewer.dev/editor layout.
 */
export function generateModelViewerSnippet(
  state: StudioState,
  cameraTelemetry: CameraTelemetry
): string {
  if (state.customSnippetOverride !== null) {
    return state.customSnippetOverride;
  }

  const modelFileName =
    state.selectedModelId === 'custom-glb' && state.customModelName
      ? state.customModelName
      : state.selectedModelId === 'none'
      ? 'Upload model...'
      : `${state.selectedModelId}-assembly.glb`;

  const attrs: string[] = [
    `src="${modelFileName}"`,
    `ar`,
    `ar-modes="webxr scene-viewer quick-look"`,
    `camera-controls`,
    `tone-mapping="aces"`,
    `poster="poster.webp"`,
    `shadow-intensity="${state.shadowIntensity.toFixed(2)}"`,
    `shadow-softness="${state.shadowSoftness.toFixed(2)}"`,
    `exposure="${state.exposure.toFixed(2)}"`,
    `camera-orbit="${cameraTelemetry.orbitThetaDeg}deg ${cameraTelemetry.orbitPhiDeg}deg ${cameraTelemetry.radiusMeters.toFixed(2)}m"`,
    `field-of-view="${state.fov}deg"`,
  ];

  if (state.autoRotate) {
    attrs.push('auto-rotate');
  }
  if (state.customHdrName) {
    attrs.push(`environment-image="${state.customHdrName}"`);
  }

  const hotspotMarkup = state.hotspots
    .map((h, i) => {
      const pos = h.position.map((n) => `${n.toFixed(3)}m`).join(' ');
      const norm = h.normal.map((n) => `${n.toFixed(3)}m`).join(' ');
      return `    <button class="Hotspot" slot="hotspot-${i + 1}" data-position="${pos}" data-normal="${norm}" data-visibility-attribute="visible">
        <div class="HotspotAnnotation">${h.label}</div>
    </button>`;
    })
    .join('\n');

  return `<model-viewer ${attrs.join(' ')}>
${hotspotMarkup ? hotspotMarkup + '\n' : ''}    <div class="progress-bar hide" slot="progress-bar">
        <div class="update-bar"></div>
    </div>
    <button slot="ar-button" id="ar-button">
        View in your space
    </button>
    <div id="ar-prompt">
        <img src="https://modelviewer.dev/shared-assets/icons/hand.png">
    </div>
</model-viewer>`;
}

/**
 * Generates a complete, self-contained standalone HTML file with embedded Three.js / <model-viewer>
 * configuration so the user can save and open their configured 3D visualization anywhere.
 */
export function downloadStandaloneHtmlViewer(
  state: StudioState,
  cameraTelemetry: CameraTelemetry,
  posterDataUrl: string | null
) {
  const snippet = generateModelViewerSnippet(state, cameraTelemetry);
  const bgMap: Record<StudioState['viewportBg'], string> = {
    light: '#f8fafc',
    platinum: '#e2e8f0',
    charcoal: '#1e293b',
    obsidian: '#090d16',
  };
  const bgHex = bgMap[state.viewportBg];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>3D Studio Export — ${state.customModelName || state.selectedModelId}</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: ${bgHex};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #f8fafc;
      overflow: hidden;
    }
    .header-bar {
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 10;
      background: rgba(32, 33, 36, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 13px;
    }
    .snippet-drawer {
      position: fixed;
      bottom: 16px;
      left: 16px;
      right: 16px;
      max-width: 780px;
      margin: 0 auto;
      background: rgba(32, 33, 36, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      padding: 14px;
      font-family: monospace;
      font-size: 12px;
      white-space: pre-wrap;
      max-height: 220px;
      overflow: auto;
    }
    .poster-preview {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .poster-preview img {
      max-width: 85%;
      max-height: 75%;
      object-fit: contain;
      border-radius: 12px;
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <strong>3D Studio Export:</strong> ${state.customModelName || state.selectedModelId} · Orbit ${cameraTelemetry.orbitThetaDeg}° / ${cameraTelemetry.orbitPhiDeg}° · Exposure ${state.exposure.toFixed(2)}
  </div>
  <div class="poster-preview">
    ${posterDataUrl ? `<img src="${posterDataUrl}" alt="3D Scene Snapshot" />` : `<p>Drop your exported .glb file alongside this HTML file.</p>`}
  </div>
  <div class="snippet-drawer">${snippet.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.customModelName?.replace(/\.[^.]+$/, '') || state.selectedModelId || 'model'}-viewer.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
