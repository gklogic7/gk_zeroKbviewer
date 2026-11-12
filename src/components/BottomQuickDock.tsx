import React from 'react';
import {
  Box,
  ChevronDown,
  ChevronUp,
  Columns,
  Download,
  Eye,
  Grid,
  Image as ImageIcon,
  Layers,
  RotateCcw,
} from 'lucide-react';
import {
  CameraPreset,
  FinishPreset,
  StudioState,
} from '../types/studio';

interface BottomQuickDockProps {
  state: StudioState;
  onUpdateState: (patch: Partial<StudioState>) => void;
  onResetCamera: () => void;
  onExportGlb: () => void;
  onExportHtml: () => void;
}

const QUICK_FINISHES: { id: FinishPreset; label: string; swatch: string }[] = [
  { id: 'original', label: 'CAD', swatch: '#64748b' },
  { id: 'brushed-titanium', label: 'Ti', swatch: '#94a3b8' },
  { id: 'anodized-gold', label: 'Au', swatch: '#f59e0b' },
  { id: 'matte-carbon', label: 'CF', swatch: '#1e293b' },
  { id: 'ceramic-white', label: 'ZrO2', swatch: '#f8fafc' },
  { id: 'optical-glass', label: 'Glass', swatch: '#38bdf8' },
];

const QUICK_CAMERAS: { id: Exclude<CameraPreset, 'free'>; label: string }[] = [
  { id: 'isometric', label: 'Iso' },
  { id: 'front', label: 'Front' },
  { id: 'right', label: 'Right' },
  { id: 'top', label: 'Top' },
];

export const BottomQuickDock: React.FC<BottomQuickDockProps> = ({
  state,
  onUpdateState,
  onResetCamera,
  onExportGlb,
  onExportHtml,
}) => {
  const sidebarOffsetClass =
    state.rightSidebarOpen && state.textureViewerMode !== 'split'
      ? 'left-[calc(50%-180px)]'
      : 'left-1/2';

  return (
    <div
      className={`fixed bottom-3 ${sidebarOffsetClass} -translate-x-1/2 z-20 max-w-[min(940px,95vw)] transition-all duration-200 pointer-events-auto`}
    >
      {/* Minimal Collapse / Expand Pill */}
      <div className="flex justify-center mb-1.5">
        <button
          type="button"
          onClick={() => onUpdateState({ bottomDockOpen: !state.bottomDockOpen })}
          className="min-h-[36px] flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#141417] hover:bg-[#1e1e22] text-[#e4e4e7] border border-[#27272a] text-xs font-medium shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Toggle Floating Dock (Shortcut: H)"
        >
          {state.bottomDockOpen ? (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-[#3b82f6]" />
              <span>Hide Dock (H)</span>
            </>
          ) : (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-[#3b82f6]" />
              <span>Show Studio Dock (H)</span>
            </>
          )}
        </button>
      </div>

      {/* Sleek Monochrome Floating Dock with 44px Touch Targets */}
      {state.bottomDockOpen && (
        <div className="bg-[#141417] text-[#f4f4f5] border border-[#27272a] rounded-2xl px-3.5 py-2 shadow-2xl flex flex-wrap items-center justify-center gap-3">
          {/* 1. Exploded View Slider */}
          <div className="flex items-center gap-2.5 px-1">
            <Layers className="w-4 h-4 text-[#3b82f6] shrink-0" />
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2 text-[11px] text-[#a1a1aa] font-medium">
                <span className="whitespace-nowrap">Explode</span>
                <span className="font-mono-tabular text-[#f4f4f5]">
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
                  onUpdateState({ explodedFactor: parseFloat(e.target.value) })
                }
                aria-label="Exploded View Separation"
                className="w-24 sm:w-28 h-2 accent-[#3b82f6] bg-[#27272a] rounded-lg cursor-pointer mt-1"
              />
            </div>
          </div>

          <div className="h-7 w-[1px] bg-[#27272a] hidden sm:block" />

          {/* 2. Quick Material Finishes (44px min-height for tablet touch) */}
          <div className="flex items-center gap-1">
            {QUICK_FINISHES.map((fin) => {
              const active = state.materialOverride.finishPreset === fin.id;
              return (
                <button
                  key={fin.id}
                  type="button"
                  onClick={() =>
                    onUpdateState({
                      materialOverride: {
                        ...state.materialOverride,
                        finishPreset: fin.id,
                      },
                    })
                  }
                  className={`min-h-[44px] px-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#3b82f6] text-white'
                      : 'bg-[#1e1e22] text-[#a1a1aa] hover:bg-[#27272a] hover:text-white'
                  }`}
                  title={`Apply ${fin.label} Material Preset`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-white/30 shrink-0"
                    style={{ backgroundColor: fin.swatch }}
                  />
                  <span>{fin.label}</span>
                </button>
              );
            })}
          </div>

          <div className="h-7 w-[1px] bg-[#27272a] hidden md:block" />

          {/* 3. Camera View Presets */}
          <div className="flex items-center gap-1">
            {QUICK_CAMERAS.map((cam) => {
              const active = state.cameraPreset === cam.id;
              return (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => onUpdateState({ cameraPreset: cam.id })}
                  className={`min-h-[44px] px-2.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#f4f4f5] text-[#141417] font-semibold'
                      : 'bg-[#1e1e22] text-[#a1a1aa] hover:bg-[#27272a] hover:text-white'
                  }`}
                >
                  {cam.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={onResetCamera}
              title="Reset Camera Orbit"
              className="min-h-[44px] min-w-[44px] rounded-xl bg-[#1e1e22] text-[#a1a1aa] hover:bg-[#27272a] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="h-7 w-[1px] bg-[#27272a] hidden lg:block" />

          {/* 4. Texture Viewer, Wireframe, Grid & Offline Export */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                onUpdateState({
                  textureViewerMode:
                    state.textureViewerMode === 'closed'
                      ? 'pip'
                      : state.textureViewerMode === 'pip'
                      ? 'split'
                      : 'closed',
                })
              }
              className={`min-h-[44px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                state.textureViewerMode !== 'closed'
                  ? 'bg-[#3b82f6] text-white'
                  : 'bg-[#1e1e22] text-[#a1a1aa] hover:bg-[#27272a] hover:text-white'
              }`}
              title="Cycle 2D Texture & UV Viewer (Off -> PiP -> 50/50 Split)"
            >
              {state.textureViewerMode === 'split' ? (
                <Columns className="w-4 h-4" />
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
              <span>
                {state.textureViewerMode === 'closed'
                  ? 'UV Viewer'
                  : state.textureViewerMode === 'pip'
                  ? 'UV: PiP'
                  : 'UV: Split'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdateState({
                  materialOverride: {
                    ...state.materialOverride,
                    wireframe: !state.materialOverride.wireframe,
                  },
                })
              }
              className={`min-h-[44px] px-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                state.materialOverride.wireframe
                  ? 'bg-[#3b82f6] text-white'
                  : 'bg-[#1e1e22] text-[#a1a1aa] hover:bg-[#27272a] hover:text-white'
              }`}
              title="Toggle Mesh Wireframe"
            >
              <Box className="w-4 h-4" />
              <span className="hidden sm:inline">Wire</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateState({ showGrid: !state.showGrid })}
              className={`min-h-[44px] min-w-[44px] px-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                state.showGrid
                  ? 'bg-[#27272a] text-white border border-[#3f3f46]'
                  : 'bg-[#1e1e22] text-[#a1a1aa] hover:bg-[#27272a]'
              }`}
              title="Toggle Studio Floor Grid"
            >
              <Grid className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onExportGlb}
              disabled={state.selectedModelId === 'none'}
              className="min-h-[44px] px-3 rounded-xl text-xs font-medium bg-[#1e1e22] hover:bg-[#27272a] disabled:opacity-40 text-[#e4e4e7] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Download binary .glb 3D model"
            >
              <Download className="w-4 h-4 text-[#3b82f6]" />
              <span>.GLB</span>
            </button>

            <button
              type="button"
              onClick={onExportHtml}
              className="min-h-[44px] px-3 rounded-xl text-xs font-semibold bg-[#3b82f6] hover:bg-[#2563eb] text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Download standalone offline HTML viewer"
            >
              <Eye className="w-4 h-4" />
              <span>HTML</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
