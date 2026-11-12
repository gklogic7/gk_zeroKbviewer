import React, { useEffect, useRef, useState } from 'react';
import { Columns, Gamepad2, Image as ImageIcon, MousePointer, Tablet } from 'lucide-react';
import { BottomQuickDock } from './components/BottomQuickDock';
import { InspectorSidebar } from './components/InspectorSidebar';
import { TextureViewer } from './components/TextureViewer';
import { ThreeViewport } from './components/ThreeViewport';
import { downloadStandaloneHtmlViewer } from './three/offlineExport';
import {
  CameraTelemetry,
  NavigationMode,
  ScenePartInfo,
  StudioState,
  UVTriangleSegment,
  ViewportImperativeHandle,
} from './types/studio';

const INITIAL_STUDIO_STATE: StudioState = {
  selectedModelId: 'chronograph',
  customModelName: null,
  customHdrName: null,
  activeTab: 'scene',
  navigationMode: 'blender',
  touchTool: 'orbit',
  flyModeEnabled: false,
  textureViewerMode: 'closed',
  activeTextureChannel: 'albedo',
  showUvWireframe: true,
  rightSidebarOpen: true,
  bottomDockOpen: true,
  viewportBg: 'light',
  explodedFactor: 0,
  autoRotate: false,
  autoRotateSpeed: 1.4,
  showGrid: true,
  showContactShadow: true,
  showAxes: false,
  fogEnabled: true,
  exposure: 1.05,
  shadowIntensity: 0.85,
  shadowSoftness: 0.5,
  directLightIntensity: 2.2,
  directLightTemp: 'warm',
  ambientIntensity: 0.85,
  envPreset: 'studio-neutral',
  envRotationDeg: 0,
  cameraPreset: 'isometric',
  fov: 45,
  hotspotPlacementMode: false,
  hotspots: [],
  activeHotspotId: null,
  selectedPartName: null,
  materialOverride: {
    finishPreset: 'original',
    colorHex: '#94a3b8',
    metalness: 0.85,
    roughness: 0.24,
    clearcoat: 0.25,
    transmission: 0,
    wireframe: false,
    texturePattern: 'none',
    customTextureDataUrl: null,
    customTextureName: null,
    repeatX: 2,
    repeatY: 2,
    offsetX: 0,
    offsetY: 0,
    rotationDeg: 0,
    bumpScale: 0.02,
    envMapIntensity: 1.0,
  },
  customSnippetOverride: null,
};

export default function App() {
  const [state, setState] = useState<StudioState>(INITIAL_STUDIO_STATE);
  const [parts, setParts] = useState<ScenePartInfo[]>([]);
  const [uvSegments, setUvSegments] = useState<UVTriangleSegment[]>([]);
  const [customImageElement, setCustomImageElement] =
    useState<HTMLImageElement | null>(null);
  const [modelTitle, setModelTitle] = useState<string>(
    'Horological Tourbillon Caliber'
  );
  const [modelSubtitle, setModelSubtitle] = useState<string>(
    '9-Part Composite Mechanical Assembly'
  );
  const [cameraTelemetry, setCameraTelemetry] = useState<CameraTelemetry>({
    orbitThetaDeg: 42,
    orbitPhiDeg: 62,
    radiusMeters: 4.45,
    fovDeg: 45,
    target: [0, 0.55, 0],
    isFlyModeActive: false,
  });
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const viewportRef = useRef<ViewportImperativeHandle | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const updateState = (patch: Partial<StudioState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 3200);
  };

  // Keyboard shortcut 'H' to toggle dock controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key.toLowerCase() === 'h' && !e.shiftKey && !e.ctrlKey) {
        setState((prev) => ({
          ...prev,
          bottomDockOpen: !prev.bottomDockOpen,
        }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleUploadCustomTextureFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        setCustomImageElement(img);
        setState((prev) => ({
          ...prev,
          textureViewerMode:
            prev.textureViewerMode === 'closed' ? 'pip' : prev.textureViewerMode,
          materialOverride: {
            ...prev.materialOverride,
            texturePattern: 'custom-image',
            customTextureDataUrl: dataUrl,
            customTextureName: file.name,
          },
        }));
        showToast(`Loaded custom texture map: ${file.name}`);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleCapturePoster = () => {
    const dataUrl = viewportRef.current?.capturePosterPng();
    if (!dataUrl) {
      showToast('Unable to capture poster image.');
      return;
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${
      state.customModelName?.replace(/\.[^.]+$/, '') || state.selectedModelId
    }-poster.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Downloaded high-resolution PNG poster snapshot.');
  };

  const handleExportGlb = async () => {
    showToast('Packaging 3D scene into binary .GLB...');
    const blob = await viewportRef.current?.exportSceneGlb();
    if (!blob) {
      showToast('No active 3D model to export.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${
      state.customModelName?.replace(/\.[^.]+$/, '') || state.selectedModelId
    }-assembly.glb`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported binary .GLB 3D asset.');
  };

  const handleExportHtml = () => {
    const posterUrl = viewportRef.current?.capturePosterPng() ?? null;
    downloadStandaloneHtmlViewer(state, cameraTelemetry, posterUrl);
    showToast('Downloaded standalone offline .HTML viewer.');
  };

  const NAV_MODES: {
    id: NavigationMode;
    label: string;
    hint: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'blender',
      label: 'Blender',
      hint: 'MMB/Alt+LMB Orbit · Shift+MMB Pan · Numpad 1/3/7/. · Shift+F Fly',
      icon: <MousePointer className="w-3.5 h-3.5" />,
    },
    {
      id: 'unity',
      label: 'Unity',
      hint: 'Alt+LMB Orbit · MMB Pan · Hold RMB + WASD/QE Fly · F Frame',
      icon: <Gamepad2 className="w-3.5 h-3.5" />,
    },
    {
      id: 'touch',
      label: 'Tablet Touch',
      hint: '1-Finger Tool Pad · 2-Finger Pinch & Pan · On-Screen Fly Pad',
      icon: <Tablet className="w-3.5 h-3.5" />,
    },
  ];

  const activeNavMeta =
    NAV_MODES.find((n) => n.id === state.navigationMode) || NAV_MODES[0];

  const isSplitView = state.textureViewerMode === 'split';

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#f8fafc] flex flex-col">
      {/* Top-Left Modern Minimal Navigation & Workspace Mode Bar (44px touch targets) */}
      <div className="pointer-events-auto fixed top-3 left-3 z-30 flex flex-wrap items-center gap-2 max-w-[calc(100vw-96px)]">
        {/* Navigation Preset Switcher: Blender | Unity | Tablet Touch */}
        <div className="bg-[#141417] text-[#f4f4f5] border border-[#27272a] rounded-2xl p-1 shadow-xl flex items-center gap-1">
          {NAV_MODES.map((nav) => {
            const active = state.navigationMode === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => {
                  updateState({
                    navigationMode: nav.id,
                    flyModeEnabled: false,
                  });
                  showToast(`${nav.label} Navigation: ${nav.hint}`);
                }}
                className={`min-h-[38px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#3b82f6] text-white font-semibold shadow-sm'
                    : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]/60'
                }`}
              >
                {nav.icon}
                <span>{nav.label}</span>
              </button>
            );
          })}
        </div>

        {/* Live Shortcut Hint & Telemetry Pill (Hidden on very small screens) */}
        <div className="hidden xl:flex items-center gap-2.5 bg-[#141417]/95 text-[#d4d4d8] border border-[#27272a] rounded-2xl px-3.5 py-2 shadow-xl text-xs">
          <span className="font-semibold text-white">{modelTitle}</span>
          <span className="text-[#52525b]">·</span>
          <span className="text-[11px] text-[#a1a1aa]">{activeNavMeta.hint}</span>
          <span className="text-[#52525b]">·</span>
          <span className="font-mono-tabular text-[11px] text-[#3b82f6]">
            {cameraTelemetry.orbitThetaDeg}° / {cameraTelemetry.orbitPhiDeg}°
          </span>
        </div>

        {/* Quick 2D Texture & UV Split/PiP Toggle Button */}
        <button
          type="button"
          onClick={() =>
            updateState({
              textureViewerMode:
                state.textureViewerMode === 'split' ? 'closed' : 'split',
            })
          }
          className={`min-h-[44px] px-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 shadow-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            state.textureViewerMode === 'split'
              ? 'bg-[#3b82f6] text-white border-[#3b82f6]'
              : 'bg-[#141417] text-[#e4e4e7] border-[#27272a] hover:bg-[#1e1e22]'
          }`}
          title="Toggle Side-by-Side 3D + 2D Texture/UV Split View"
        >
          <Columns className="w-4 h-4 text-[#3b82f6] shrink-0" />
          <span>{isSplitView ? 'Close Split UV' : 'Split 3D + UV Viewer'}</span>
        </button>
      </div>

      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#141417] text-white border border-[#3b82f6] px-4 py-2 rounded-xl shadow-2xl text-xs font-medium">
          {toastMsg}
        </div>
      )}

      {/* Main Workspace Area: Either Full-Bleed 3D or 50/50 Split (3D + 2D Texture Viewer) */}
      <div
        className={`w-full h-full flex flex-col lg:flex-row overflow-hidden ${
          state.rightSidebarOpen && isSplitView ? 'lg:pr-[360px]' : ''
        }`}
      >
        {/* 3D WebGL Viewport Pane */}
        <div
          className={
            isSplitView
              ? 'w-full lg:w-1/2 h-1/2 lg:h-full relative overflow-hidden'
              : 'w-full h-full relative overflow-hidden'
          }
        >
          <ThreeViewport
            ref={viewportRef}
            state={state}
            customImageElement={customImageElement}
            onUpdateState={updateState}
            onPartsUpdated={(nextParts, nextUvSegments, title, sub) => {
              setParts(nextParts);
              setUvSegments(nextUvSegments);
              setModelTitle(title);
              setModelSubtitle(sub);
            }}
            onCameraTelemetryChange={setCameraTelemetry}
            onToast={showToast}
          />
        </div>

        {/* Side-by-Side Split 2D Texture & UV Channel Viewer Pane */}
        {isSplitView && (
          <div className="w-full lg:w-1/2 h-1/2 lg:h-full relative overflow-hidden">
            <TextureViewer
              state={state}
              uvSegments={uvSegments}
              customImageElement={customImageElement}
              onUpdateState={updateState}
              onUploadCustomTextureFile={handleUploadCustomTextureFile}
              onToast={showToast}
            />
          </div>
        )}
      </div>

      {/* Floating PiP 2D Texture & UV Channel Viewer when in 'pip' mode */}
      {state.textureViewerMode === 'pip' && (
        <TextureViewer
          state={state}
          uvSegments={uvSegments}
          customImageElement={customImageElement}
          onUpdateState={updateState}
          onUploadCustomTextureFile={handleUploadCustomTextureFile}
          onToast={showToast}
        />
      )}

      {/* Toggleable Floating Bottom Quick-Dock */}
      <BottomQuickDock
        state={state}
        onUpdateState={updateState}
        onResetCamera={() => viewportRef.current?.resetCamera()}
        onExportGlb={handleExportGlb}
        onExportHtml={handleExportHtml}
      />

      {/* Collapsible Right-Hand Minimal Inspector Drawer */}
      <InspectorSidebar
        state={state}
        cameraTelemetry={cameraTelemetry}
        parts={parts}
        modelTitle={modelTitle}
        modelSubtitle={modelSubtitle}
        onUpdateState={updateState}
        onUploadGlbFiles={(files) => viewportRef.current?.loadGlbFiles(files)}
        onUploadHdrFile={(file) => viewportRef.current?.loadHdrFile(file)}
        onUploadCustomTextureFile={handleUploadCustomTextureFile}
        onCapturePoster={handleCapturePoster}
        onExportGlb={handleExportGlb}
        onExportHtml={handleExportHtml}
        onFocusPart={(partName) => viewportRef.current?.focusPart(partName)}
        onFocusHotspot={(hs) => viewportRef.current?.focusHotspot(hs)}
        onResetCamera={() => viewportRef.current?.resetCamera()}
        onToast={showToast}
      />
    </main>
  );
}
