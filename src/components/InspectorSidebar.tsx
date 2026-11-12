import React, { useRef, useState } from 'react';
import {
  Box,
  Camera,
  Check,
  ChevronRight,
  Code2,
  Columns,
  Copy,
  Download,
  FileCode,
  Grid,
  Image as ImageIcon,
  Layers,
  MapPin,
  Plus,
  RotateCcw,
  Sliders,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { generateModelViewerSnippet } from '../three/offlineExport';
import {
  CameraTelemetry,
  EnvPreset,
  FinishPreset,
  Hotspot3D,
  InspectorTab,
  ModelId,
  ScenePartInfo,
  StudioState,
  TextureChannel,
  TexturePattern,
  ViewportBg,
} from '../types/studio';

interface InspectorSidebarProps {
  state: StudioState;
  cameraTelemetry: CameraTelemetry;
  parts: ScenePartInfo[];
  modelTitle: string;
  modelSubtitle: string;
  onUpdateState: (patch: Partial<StudioState>) => void;
  onUploadGlbFiles: (files: FileList) => void;
  onUploadHdrFile: (file: File) => void;
  onUploadCustomTextureFile: (file: File) => void;
  onCapturePoster: () => void;
  onExportGlb: () => void;
  onExportHtml: () => void;
  onFocusPart: (partName: string) => void;
  onFocusHotspot: (hotspot: Hotspot3D) => void;
  onResetCamera: () => void;
  onToast: (msg: string) => void;
}

export const InspectorSidebar: React.FC<InspectorSidebarProps> = ({
  state,
  cameraTelemetry,
  parts,
  modelTitle,
  modelSubtitle,
  onUpdateState,
  onUploadGlbFiles,
  onUploadHdrFile,
  onUploadCustomTextureFile,
  onCapturePoster,
  onExportGlb,
  onExportHtml,
  onFocusPart,
  onFocusHotspot,
  onResetCamera,
  onToast,
}) => {
  const glbInputRef = useRef<HTMLInputElement | null>(null);
  const hdrInputRef = useRef<HTMLInputElement | null>(null);
  const texInputRef = useRef<HTMLInputElement | null>(null);

  const [editSnippetModalOpen, setEditSnippetModalOpen] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const snippetText = generateModelViewerSnippet(state, cameraTelemetry);

  const handleCopySnippet = () => {
    navigator.clipboard?.writeText(snippetText);
    setCopiedSnippet(true);
    onToast('Copied <model-viewer> snippet to clipboard');
    setTimeout(() => setCopiedSnippet(false), 1800);
  };

  const totalVertices = parts.reduce((acc, p) => acc + p.vertexCount, 0);
  const totalTriangles = parts.reduce((acc, p) => acc + p.triangleCount, 0);

  const TABS: { id: InspectorTab; label: string; icon: React.ReactNode }[] = [
    { id: 'scene', label: 'Scene', icon: <Layers className="w-4 h-4" /> },
    { id: 'materials', label: 'Material', icon: <Sliders className="w-4 h-4" /> },
    { id: 'textures', label: 'Texture', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'lighting', label: 'Light', icon: <Sun className="w-4 h-4" /> },
    { id: 'hotspots', label: 'Pins', icon: <MapPin className="w-4 h-4" /> },
    { id: 'export', label: 'Code', icon: <Code2 className="w-4 h-4" /> },
  ];

  const ov = state.materialOverride;

  return (
    <>
      {/* Hidden File Inputs */}
      <input
        ref={glbInputRef}
        type="file"
        accept=".glb,.gltf,.hdr"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onUploadGlbFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />
      <input
        ref={hdrInputRef}
        type="file"
        accept=".hdr"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            onUploadHdrFile(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />
      <input
        ref={texInputRef}
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

      {/* Floating Re-Open Button when Sidebar is Collapsed */}
      {!state.rightSidebarOpen && (
        <button
          type="button"
          onClick={() => onUpdateState({ rightSidebarOpen: true })}
          className="fixed top-3 right-3 z-30 min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl bg-[#141417] hover:bg-[#1e1e22] text-[#f4f4f5] shadow-xl border border-[#27272a] text-xs font-semibold font-mono-tabular transition-colors cursor-pointer"
          title="Open Studio Inspector Drawer"
        >
          <Box className="w-4 h-4 text-[#3b82f6]" />
          <span>&lt;model-viewer&gt;</span>
        </button>
      )}

      {/* Modern Minimal Monochrome Right Inspector Drawer */}
      <aside
        className={`fixed top-0 right-0 z-20 h-full w-[360px] max-w-[92vw] bg-[#141417] text-[#f4f4f5] border-l border-[#27272a] flex flex-col shadow-2xl transition-transform duration-200 ${
          state.rightSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Minimal Studio Header Bar */}
        <div className="px-4 py-3 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#27272a] border border-[#3f3f46] flex items-center justify-center">
              <Box className="w-4 h-4 text-[#3b82f6]" />
            </div>
            <div>
              <div className="font-mono-tabular text-sm font-semibold tracking-tight text-white">
                &lt;model-viewer&gt;
              </div>
              <div className="text-[10px] text-[#a1a1aa]">
                3D WebGL Studio &amp; UV Inspector
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onUpdateState({ rightSidebarOpen: false })}
            className="min-w-[44px] min-h-[44px] rounded-xl text-[#a1a1aa] hover:text-white hover:bg-[#27272a] flex items-center justify-center transition-colors cursor-pointer"
            title="Collapse Inspector Drawer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Modern Minimal 6-Tab Bar with 48px Touch Targets */}
        <div className="grid grid-cols-6 bg-[#18181b] px-1.5 py-1.5 border-b border-[#27272a] gap-1 shrink-0">
          {TABS.map((t) => {
            const isActive = state.activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onUpdateState({ activeTab: t.id })}
                className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#3b82f6] text-white font-semibold shadow-sm'
                    : 'text-[#a1a1aa] hover:bg-[#27272a]/70 hover:text-[#f4f4f5]'
                }`}
              >
                {t.icon}
                <span className="text-[10px] tracking-tight whitespace-nowrap">
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Inspector Content Area */}
        <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-5">
          {/* ==================== TAB 1: SCENE & FILE MANAGER ==================== */}
          {state.activeTab === 'scene' && (
            <div className="space-y-5">
              {/* File Manager & Model Selector */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="select-model-dropdown"
                    className="text-xs font-semibold text-[#e4e4e7]"
                  >
                    Active 3D Asset
                  </label>
                  <button
                    type="button"
                    onClick={() => glbInputRef.current?.click()}
                    className="min-h-[38px] px-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload .GLB</span>
                  </button>
                </div>

                <select
                  id="select-model-dropdown"
                  value={state.selectedModelId}
                  onChange={(e) =>
                    onUpdateState({
                      selectedModelId: e.target.value as ModelId,
                      customSnippetOverride: null,
                    })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#1e1e22] text-[#f4f4f5] border border-[#27272a] text-xs focus:outline-none focus:border-[#3b82f6] cursor-pointer"
                >
                  <option value="none">None (Empty Dropzone)</option>
                  <option value="chronograph">
                    Tourbillon Chronograph Caliber (.glb)
                  </option>
                  <option value="drone">
                    Autonomous LiDAR Quadrotor (.glb)
                  </option>
                  <option value="turbopump">
                    UHV Turbomolecular Vacuum Pump (.glb)
                  </option>
                  {state.customModelName && (
                    <option value="custom-glb">{state.customModelName}</option>
                  )}
                </select>
              </div>

              {/* Geometry Stats Summary */}
              <div className="p-3.5 rounded-2xl bg-[#1e1e22] border border-[#27272a] space-y-2.5">
                <div>
                  <div className="text-xs font-semibold text-white">
                    {modelTitle}
                  </div>
                  <div className="text-[11px] text-[#a1a1aa]">
                    {modelSubtitle}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono-tabular text-xs">
                  <div className="bg-[#141417] p-2.5 rounded-xl border border-[#27272a]">
                    <div className="text-[10px] text-[#a1a1aa]">Sub-Parts</div>
                    <div className="text-white font-semibold mt-0.5">
                      {parts.length}
                    </div>
                  </div>
                  <div className="bg-[#141417] p-2.5 rounded-xl border border-[#27272a]">
                    <div className="text-[10px] text-[#a1a1aa]">Vertices</div>
                    <div className="text-white font-semibold mt-0.5">
                      {totalVertices.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-[#141417] p-2.5 rounded-xl border border-[#27272a]">
                    <div className="text-[10px] text-[#a1a1aa]">Triangles</div>
                    <div className="text-white font-semibold mt-0.5">
                      {totalTriangles.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Scene Hierarchy Outliner (44px rows for tablet touch) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#e4e4e7]">
                    Scene Hierarchy Outliner
                  </span>
                  {state.selectedPartName && (
                    <button
                      type="button"
                      onClick={() => onUpdateState({ selectedPartName: null })}
                      className="text-xs text-[#3b82f6] hover:underline cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto studio-scroll rounded-2xl border border-[#27272a] bg-[#1e1e22] divide-y divide-[#27272a]">
                  {parts.length === 0 ? (
                    <div className="p-4 text-xs text-[#a1a1aa] text-center">
                      No 3D model loaded
                    </div>
                  ) : (
                    parts.map((part) => {
                      const isSelected = state.selectedPartName === part.name;
                      return (
                        <button
                          key={part.id}
                          type="button"
                          onClick={() => {
                            onUpdateState({
                              selectedPartName: isSelected ? null : part.name,
                            });
                            if (!isSelected) onFocusPart(part.name);
                          }}
                          className={`w-full min-h-[44px] px-3.5 py-2 text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#3b82f6]/20 text-white font-semibold'
                              : 'text-[#d4d4d8] hover:bg-[#27272a]/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-white/30"
                              style={{ backgroundColor: part.colorHex }}
                            />
                            <span className="truncate">{part.name}</span>
                          </div>
                          <span className="font-mono-tabular text-[10px] text-[#a1a1aa] ml-2 shrink-0">
                            {part.triangleCount.toLocaleString()} tris
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Exploded View & Camera Telemetry */}
              <div className="p-3.5 rounded-2xl bg-[#1e1e22] border border-[#27272a] space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-[#e4e4e7]">
                      Exploded Assembly Separation
                    </span>
                    <span className="font-mono-tabular text-[#3b82f6]">
                      {Math.round(state.explodedFactor * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={state.explodedFactor}
                    onChange={(e) =>
                      onUpdateState({
                        explodedFactor: parseFloat(e.target.value),
                      })
                    }
                    className="w-full h-2 accent-[#3b82f6] bg-[#141417] rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-[#e4e4e7]">
                      Camera Field of View (FOV)
                    </span>
                    <span className="font-mono-tabular text-[#3b82f6]">
                      {state.fov}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={75}
                    step={1}
                    value={state.fov}
                    onChange={(e) =>
                      onUpdateState({ fov: parseInt(e.target.value, 10) })
                    }
                    className="w-full h-2 accent-[#3b82f6] bg-[#141417] rounded-lg cursor-pointer"
                  />
                </div>

                <label className="min-h-[40px] flex items-center justify-between text-xs cursor-pointer pt-1">
                  <span>Turntable Auto-Rotate</span>
                  <input
                    type="checkbox"
                    checked={state.autoRotate}
                    onChange={(e) =>
                      onUpdateState({ autoRotate: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#3b82f6]"
                  />
                </label>
              </div>
            </div>
          )}

          {/* ==================== TAB 2: PBR MATERIAL STUDIO ==================== */}
          {state.activeTab === 'materials' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">
                    PBR Material Studio
                  </div>
                  <div className="text-[11px] text-[#a1a1aa]">
                    Target:{' '}
                    {state.selectedPartName
                      ? state.selectedPartName
                      : 'Entire 3D Assembly'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateState({
                      materialOverride: {
                        ...ov,
                        finishPreset: 'original',
                        colorHex: '#94a3b8',
                        metalness: 0.85,
                        roughness: 0.24,
                        clearcoat: 0.25,
                        transmission: 0,
                        wireframe: false,
                        texturePattern: 'none',
                      },
                    })
                  }
                  className="min-h-[36px] px-2.5 rounded-lg bg-[#1e1e22] hover:bg-[#27272a] text-xs text-[#3b82f6] cursor-pointer"
                >
                  Reset CAD Finish
                </button>
              </div>

              {/* Studio Material Preset Grid */}
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: 'original',
                      label: 'CAD Multi-Material',
                      swatch: '#64748b',
                    },
                    {
                      id: 'brushed-titanium',
                      label: 'Brushed Titanium',
                      swatch: '#94a3b8',
                    },
                    {
                      id: 'anodized-gold',
                      label: '18k Rose Gold',
                      swatch: '#f59e0b',
                    },
                    {
                      id: 'matte-carbon',
                      label: 'Stealth Carbon',
                      swatch: '#1e293b',
                    },
                    {
                      id: 'ceramic-white',
                      label: 'White Ceramic',
                      swatch: '#f8fafc',
                    },
                    {
                      id: 'optical-glass',
                      label: 'Sapphire Crystal',
                      swatch: '#38bdf8',
                    },
                    {
                      id: 'blued-steel',
                      label: 'Blued Steel',
                      swatch: '#1d4ed8',
                    },
                  ] as { id: FinishPreset; label: string; swatch: string }[]
                ).map((fin) => {
                  const active = ov.finishPreset === fin.id;
                  return (
                    <button
                      key={fin.id}
                      type="button"
                      onClick={() =>
                        onUpdateState({
                          materialOverride: { ...ov, finishPreset: fin.id },
                        })
                      }
                      className={`min-h-[44px] px-3 rounded-xl border text-left flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#3b82f6]/20 border-[#3b82f6] text-white'
                          : 'bg-[#1e1e22] border-[#27272a] text-[#d4d4d8] hover:bg-[#27272a]'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0"
                        style={{ backgroundColor: fin.swatch }}
                      />
                      <span className="truncate">{fin.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Physical Material Sliders */}
              <div className="p-3.5 rounded-2xl bg-[#1e1e22] border border-[#27272a] space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#e4e4e7]">
                    Base Albedo Color
                  </span>
                  <input
                    type="color"
                    value={ov.colorHex}
                    onChange={(e) =>
                      onUpdateState({
                        materialOverride: {
                          ...ov,
                          finishPreset: 'original',
                          colorHex: e.target.value,
                        },
                      })
                    }
                    className="w-11 h-8 rounded cursor-pointer bg-transparent"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Metalness</span>
                    <span className="font-mono-tabular text-[#3b82f6]">
                      {ov.metalness.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={ov.metalness}
                    onChange={(e) =>
                      onUpdateState({
                        materialOverride: {
                          ...ov,
                          finishPreset: 'original',
                          metalness: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full h-2 accent-[#3b82f6] bg-[#141417] rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Roughness</span>
                    <span className="font-mono-tabular text-[#3b82f6]">
                      {ov.roughness.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.02}
                    max={1}
                    step={0.02}
                    value={ov.roughness}
                    onChange={(e) =>
                      onUpdateState({
                        materialOverride: {
                          ...ov,
                          finishPreset: 'original',
                          roughness: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full h-2 accent-[#3b82f6] bg-[#141417] rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Clearcoat Gloss Layer</span>
                    <span className="font-mono-tabular text-[#3b82f6]">
                      {ov.clearcoat.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={ov.clearcoat}
                    onChange={(e) =>
                      onUpdateState({
                        materialOverride: {
                          ...ov,
                          finishPreset: 'original',
                          clearcoat: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full h-2 accent-[#3b82f6] bg-[#141417] rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Optical Transmission (Glass)</span>
                    <span className="font-mono-tabular text-[#3b82f6]">
                      {ov.transmission.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.96}
                    step={0.04}
                    value={ov.transmission}
                    onChange={(e) =>
                      onUpdateState({
                        materialOverride: {
                          ...ov,
                          finishPreset: 'original',
                          transmission: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full h-2 accent-[#3b82f6] bg-[#141417] rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 3: 2D TEXTURE & UV VIEWER CONTROLS ==================== */}
          {state.activeTab === 'textures' && (
            <div className="space-y-4">
              {/* Workspace Mode Selector for the 2D Texture & UV Viewer */}
              <div className="p-3.5 rounded-2xl bg-[#1e1e22] border border-[#27272a] space-y-2.5">
                <div className="text-xs font-semibold text-white">
                  2D Texture &amp; UV Viewer Workspace
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'closed', label: '3D Only' },
                      { id: 'pip', label: 'Floating PiP' },
                      { id: 'split', label: '50/50 Split' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        onUpdateState({ textureViewerMode: m.id })
                      }
                      className={`min-h-[44px] px-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                        state.textureViewerMode === m.id
                          ? 'bg-[#3b82f6] text-white font-semibold'
                          : 'bg-[#141417] text-[#a1a1aa] hover:bg-[#27272a] hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Surface Texture Map Selector & Custom Image Upload */}
              <div className="p-3.5 rounded-2xl bg-[#1e1e22] border border-[#27272a] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    Surface Texture Map
                  </span>
                  <button
                    type="button"
                    onClick={() => texInputRef.current?.click()}
                    className="min-h-[38px] px-3 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                  </button>
                </div>

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
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#141417] text-[#f4f4f5] border border-[#27272a] text-xs cursor-pointer"
                >
                  <option value="none">None (Solid PBR Surface)</option>
                  <option value="uv-grid">
                    UV Texel Calibration Checkerboard
                  </option>
                  <option value="brushed-metal">
                    Linear Brushed Metal + Normal/Roughness
                  </option>
                  <option value="carbon-weave">
                    Twill Carbon-Fiber Weave + Normal/Roughness
                  </option>
                  <option value="knurled-diamond">
                    Machined Diamond Knurl + Faceted Normal
                  </option>
                  <option value="pcb-traces">
                    Aerospace Gold/Emerald PCB Traces
                  </option>
                  {ov.customTextureName && (
                    <option value="custom-image">
                      Custom Image: {ov.customTextureName}
                    </option>
                  )}
                </select>

                {/* Active Map Channel Isolation */}
                <div>
                  <div className="text-[11px] text-[#a1a1aa] mb-1.5">
                    Inspect Map Channel in 2D Viewer
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'albedo', label: 'Albedo (sRGB)' },
                        { id: 'normal', label: 'Normal / Bump' },
                        { id: 'roughness', label: 'Roughness Map' },
                        { id: 'metalness', label: 'Metalness Map' },
                      ] as { id: TextureChannel; label: string }[]
                    ).map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() =>
                          onUpdateState({
                            activeTextureChannel: ch.id,
                            textureViewerMode:
                              state.textureViewerMode === 'closed'
                                ? 'pip'
                                : state.textureViewerMode,
                          })
                        }
                        className={`min-h-[40px] px-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                          state.activeTextureChannel === ch.id
                            ? 'bg-[#3b82f6] text-white'
                            : 'bg-[#141417] text-[#a1a1aa] hover:bg-[#27272a] hover:text-white'
                        }`}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* UV Tiling, Offset, Rotation & Bump Scale */}
              <div className="p-3.5 rounded-2xl bg-[#1e1e22] border border-[#27272a] space-y-3">
                <div className="text-xs font-semibold text-white">
                  UV Coordinate Transform
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>UV Repeat (Tiling X &amp; Y)</span>
                    <span className="font-mono-tabular text-[#3b82f6]">
                      {ov.repeatX}×
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={ov.repeatX}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onUpdateState({
                        materialOverride: { ...ov, repeatX: val, repeatY: val },
                      });
                    }}
                    className="w-full h-2 accent-[#3b82f6] bg-[#141417] rounded-lg cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Offset U</span>
                      <span className="font-mono-tabular text-[#3b82f6]">
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
                      className="w-full h-2 accent-[#3b82f6] bg-[#141417] rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Offset V</span>
                      <span className="font-mono-tabular text-[#3b82f6]">
                        {ov.offsetY.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={ov.offsetY}
                      onChange={(e) =>
                        onUpdateState({
                          materialOverride: {
                            ...ov,
                            offsetY: parseFloat(e.target.value),
                          },
                        })
                      }
                      className="w-full h-2 accent-[#3b82f6] bg-[#141417] rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>UV Rotation</span>
                    <span className="font-mono-tabular text-[#3b82f6]">
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
                    className="w-full h-2 accent-[#3b82f6] bg-[#141417] rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Normal / Bump Relief Depth</span>
                    <span className="font-mono-tabular text-[#3b82f6]">
                      {ov.bumpScale.toFixed(3)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.08}
                    step={0.005}
                    value={ov.bumpScale}
                    onChange={(e) =>
                      onUpdateState({
                        materialOverride: {
                          ...ov,
                          bumpScale: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-full h-2 accent-[#3b82f6] bg-[#141417] rounded-lg cursor-pointer"
                  />
                </div>

                <label className="min-h-[40px] flex items-center justify-between text-xs cursor-pointer pt-1">
                  <span>Show 3D Mesh UV Wireframe Overlay</span>
                  <input
                    type="checkbox"
                    checked={state.showUvWireframe}
                    onChange={(e) =>
                      onUpdateState({ showUvWireframe: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#3b82f6]"
                  />
                </label>
              </div>
            </div>
          )}

          {/* ==================== TAB 4: STUDIO LIGHTING & ENVIRONMENT ==================== */}
          {state.activeTab === 'lighting' && (
            <div className="space-y-4">
              {/* Viewport Backdrop Swatches */}
              <div className="p-3.5 rounded-2xl bg-[#1e1e22] border border-[#27272a] space-y-2.5">
                <div className="text-xs font-semibold text-white">
                  Viewport Backdrop
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'light', label: 'White', hex: '#f8fafc' },
                      { id: 'platinum', label: 'Silver', hex: '#e2e8f0' },
                      { id: 'charcoal', label: 'Zinc', hex: '#18181b' },
                      { id: 'obsidian', label: 'Obsidian', hex: '#09090b' },
                    ] as { id: ViewportBg; label: string; hex: string }[]
                  ).map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => onUpdateState({ viewportBg: bg.id })}
                      className={`min-h-[54px] p-2 rounded-xl border text-center transition-colors cursor-pointer ${
                        state.viewportBg === bg.id
                          ? 'border-[#3b82f6] bg-[#141417]'
                          : 'border-[#27272a] bg-[#141417]/60 hover:bg-[#141417]'
                      }`}
                    >
                      <div
                        className="w-full h-5 rounded border border-white/20 mb-1"
                        style={{ backgroundColor: bg.hex }}
                      />
                      <div className="text-[11px] text-[#d4d4d8]">
                        {bg.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* IBL Environment & HDR Upload */}
              <div className="p-3.5 rounded-2xl bg-[#1e1e22] border border-[#27272a] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    Studio IBL Environment
                  </span>
                  <button
                    type="button"
                    onClick={() => hdrInputRef.current?.click()}
                    className="min-h-[38px] px-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Load .HDR</span>
                  </button>
                </div>

                <select
                  value={state.envPreset}
                  onChange={(e) =>
                    onUpdateState({ envPreset: e.target.value as EnvPreset })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#141417] text-white border border-[#27272a] text-xs cursor-pointer"
                >
                  <option value="studio-neutral">
                    RoomEnvironment Softboxes (Default)
                  </option>
                  <option value="warm-atelier">Warm Horological Atelier</option>
                  <option value="cool-cleanroom">Cool Aerospace Cleanroom</option>
                  <option value="sunset-hangar">Golden Hour Hangar</option>
                  {state.customHdrName && (
                    <option value="custom-hdr">
                      Custom HDR: {state.customHdrName}
                    </option>
                  )}
                </select>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Environment Rotation</span>
                    <span className="font-mono-tabular text-[#3b82f6]">
                      {state.envRotationDeg}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={5}
                    value={state.envRotationDeg}
                    onChange={(e) =>
                      onUpdateState({
                        envRotationDeg: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full h-2 accent-[#3b82f6] bg-[#141417] rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Exposure & Studio Rig Sliders */}
              <div className="p-3.5 rounded-2xl bg-[#1e1e22] border border-[#27272a] space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>ACES Filmic Exposure</span>
                    <span className="font-mono-tabular text-[#3b82f6]">
                      {state.exposure.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.3}
                    max={2.5}
                    step={0.05}
                    value={state.exposure}
                    onChange={(e) =>
                      onUpdateState({ exposure: parseFloat(e.target.value) })
                    }
                    className="w-full h-2 accent-[#3b82f6] bg-[#141417] rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Key Directional Light</span>
                    <span className="font-mono-tabular text-[#3b82f6]">
                      {state.directLightIntensity.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.1}
                    value={state.directLightIntensity}
                    onChange={(e) =>
                      onUpdateState({
                        directLightIntensity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full h-2 accent-[#3b82f6] bg-[#141417] rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Contact Shadow Grounding</span>
                    <span className="font-mono-tabular text-[#3b82f6]">
                      {Math.round(state.shadowIntensity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={state.shadowIntensity}
                    onChange={(e) =>
                      onUpdateState({
                        shadowIntensity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full h-2 accent-[#3b82f6] bg-[#141417] rounded-lg cursor-pointer"
                  />
                </div>

                <label className="min-h-[40px] flex items-center justify-between text-xs cursor-pointer pt-1">
                  <span>Show XYZ Coordinate Axes</span>
                  <input
                    type="checkbox"
                    checked={state.showAxes}
                    onChange={(e) =>
                      onUpdateState({ showAxes: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#3b82f6]"
                  />
                </label>

                <label className="min-h-[40px] flex items-center justify-between text-xs cursor-pointer">
                  <span>Atmospheric Horizon Fog</span>
                  <input
                    type="checkbox"
                    checked={state.fogEnabled}
                    onChange={(e) =>
                      onUpdateState({ fogEnabled: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#3b82f6]"
                  />
                </label>
              </div>
            </div>
          )}

          {/* ==================== TAB 5: 3D HOTSPOTS & ANNOTATIONS ==================== */}
          {state.activeTab === 'hotspots' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-white">
                    3D Surface Hotspots
                  </h3>
                  <p className="text-[11px] text-[#a1a1aa]">
                    Tap or click on 3D geometry to pin annotations
                  </p>
                </div>
                <button
                  type="button"
                  disabled={state.selectedModelId === 'none'}
                  onClick={() =>
                    onUpdateState({
                      hotspotPlacementMode: !state.hotspotPlacementMode,
                    })
                  }
                  className={`min-h-[44px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    state.hotspotPlacementMode
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-[#3b82f6] hover:bg-[#2563eb] text-white disabled:opacity-40'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {state.hotspotPlacementMode ? 'Tap 3D Surface...' : 'Pin Hotspot'}
                  </span>
                </button>
              </div>

              {state.hotspots.length === 0 ? (
                <div className="p-5 rounded-2xl bg-[#1e1e22] border border-[#27272a] text-center text-xs text-[#a1a1aa]">
                  No hotspots pinned yet. Tap &ldquo;Pin Hotspot&rdquo; and tap any
                  point on the 3D model.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {state.hotspots.map((hs, idx) => {
                    const isSelected = state.activeHotspotId === hs.id;
                    return (
                      <div
                        key={hs.id}
                        className={`p-3.5 rounded-2xl border transition-colors ${
                          isSelected
                            ? 'bg-[#1e1e22] border-[#3b82f6]'
                            : 'bg-[#1e1e22]/60 border-[#27272a]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateState({ activeHotspotId: hs.id });
                              onFocusHotspot(hs);
                            }}
                            className="min-h-[38px] flex items-center gap-2 text-left text-xs font-semibold text-[#3b82f6] hover:underline cursor-pointer"
                          >
                            <span className="w-6 h-6 rounded-full bg-[#3b82f6] text-white flex items-center justify-center font-mono-tabular text-xs">
                              {idx + 1}
                            </span>
                            <span>Focus Camera on Pin</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onUpdateState({
                                hotspots: state.hotspots.filter((h) => h.id !== hs.id),
                                activeHotspotId:
                                  state.activeHotspotId === hs.id
                                    ? null
                                    : state.activeHotspotId,
                              })
                            }
                            className="min-h-[38px] min-w-[38px] flex items-center justify-center text-[#a1a1aa] hover:text-rose-400 transition-colors cursor-pointer"
                            title="Remove Hotspot"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-2">
                          <input
                            type="text"
                            value={hs.label}
                            onChange={(e) => {
                              const next = state.hotspots.map((item) =>
                                item.id === hs.id
                                  ? { ...item, label: e.target.value }
                                  : item
                              );
                              onUpdateState({ hotspots: next });
                            }}
                            placeholder="Hotspot title"
                            className="w-full min-h-[40px] px-3 rounded-xl bg-[#141417] border border-[#27272a] text-xs text-white focus:outline-none focus:border-[#3b82f6]"
                          />
                          <textarea
                            rows={2}
                            value={hs.detail}
                            onChange={(e) => {
                              const next = state.hotspots.map((item) =>
                                item.id === hs.id
                                  ? { ...item, detail: e.target.value }
                                  : item
                              );
                              onUpdateState({ hotspots: next });
                            }}
                            placeholder="Technical annotation description"
                            className="w-full p-2.5 rounded-xl bg-[#141417] border border-[#27272a] text-[11px] text-[#d4d4d8] focus:outline-none focus:border-[#3b82f6]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB 6: SNIPPET & OFFLINE EXPORT ==================== */}
          {state.activeTab === 'export' && (
            <div className="space-y-4">
              {/* <model-viewer> snippet box */}
              <div className="p-3.5 rounded-2xl bg-[#1e1e22] border border-[#27272a] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    &lt;model-viewer&gt; HTML Snippet
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditSnippetModalOpen(true)}
                    className="min-h-[36px] px-3 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-semibold cursor-pointer"
                  >
                    EDIT SNIPPET
                  </button>
                </div>

                <div className="bg-[#09090b] text-[#e4e4e7] rounded-xl border border-[#27272a] p-3 h-44 overflow-auto studio-scroll font-mono-tabular text-[11px] leading-relaxed select-text">
                  <pre className="m-0 whitespace-pre">{snippetText}</pre>
                </div>

                <button
                  type="button"
                  onClick={handleCopySnippet}
                  className="w-full min-h-[44px] bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {copiedSnippet ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>COPIED TO CLIPBOARD</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>COPY SNIPPET</span>
                    </>
                  )}
                </button>
              </div>

              {/* Standalone Export Actions */}
              <div className="p-3.5 rounded-2xl bg-[#1e1e22] border border-[#27272a] space-y-2.5">
                <div className="text-xs font-semibold text-white mb-1">
                  Offline Packaging &amp; Snapshots
                </div>

                <button
                  type="button"
                  onClick={onCapturePoster}
                  className="w-full min-h-[44px] px-3 bg-[#27272a] hover:bg-[#3f3f46] text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-[#3b82f6]" />
                  <span>Capture PNG Poster Snapshot</span>
                </button>

                <button
                  type="button"
                  onClick={onExportGlb}
                  disabled={state.selectedModelId === 'none'}
                  className="w-full min-h-[44px] px-3 bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-40 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#3b82f6]" />
                  <span>Download Active Scene as Binary .GLB</span>
                </button>

                <button
                  type="button"
                  onClick={onExportHtml}
                  className="w-full min-h-[44px] px-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <FileCode className="w-4 h-4" />
                  <span>Download Standalone Offline .HTML</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Edit Snippet Modal */}
      {editSnippetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#141417] border border-[#27272a] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 bg-[#1e1e22] border-b border-[#27272a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[#3b82f6]" />
                <span className="text-sm font-semibold text-white">
                  Edit &lt;model-viewer&gt; HTML Embed Snippet
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditSnippetModalOpen(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <textarea
                rows={12}
                value={snippetText}
                onChange={(e) =>
                  onUpdateState({ customSnippetOverride: e.target.value })
                }
                className="w-full p-3 rounded-xl bg-[#09090b] text-[#f4f4f5] font-mono-tabular text-xs leading-relaxed focus:outline-none border border-[#27272a] select-text"
              />
            </div>

            <div className="px-5 py-3 bg-[#1e1e22] border-t border-[#27272a] flex items-center justify-between">
              <button
                type="button"
                onClick={() => onUpdateState({ customSnippetOverride: null })}
                className="min-h-[40px] px-3 rounded-xl text-xs text-[#3b82f6] hover:bg-white/5 cursor-pointer"
              >
                Reset to Live-Synced
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySnippet}
                  className="min-h-[40px] px-4 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs font-medium cursor-pointer"
                >
                  Copy Code
                </button>
                <button
                  type="button"
                  onClick={() => setEditSnippetModalOpen(false)}
                  className="min-h-[40px] px-4 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
