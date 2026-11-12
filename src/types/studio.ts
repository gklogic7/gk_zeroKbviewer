export type ModelId = 'none' | 'chronograph' | 'drone' | 'turbopump' | 'custom-glb';

export type InspectorTab =
  | 'scene'
  | 'materials'
  | 'textures'
  | 'lighting'
  | 'hotspots'
  | 'export';

export type NavigationMode = 'blender' | 'unity' | 'touch';

export type TouchTool = 'orbit' | 'pan' | 'zoom' | 'fly';

export type TextureViewerMode = 'closed' | 'pip' | 'split';

export type TextureChannel = 'albedo' | 'normal' | 'roughness' | 'metalness';

export type ViewportBg = 'light' | 'platinum' | 'charcoal' | 'obsidian';

export type EnvPreset =
  | 'studio-neutral'
  | 'warm-atelier'
  | 'cool-cleanroom'
  | 'sunset-hangar'
  | 'custom-hdr';

export type CameraPreset =
  | 'isometric'
  | 'front'
  | 'back'
  | 'right'
  | 'left'
  | 'top'
  | 'bottom'
  | 'macro'
  | 'free';

export type FinishPreset =
  | 'original'
  | 'brushed-titanium'
  | 'anodized-gold'
  | 'matte-carbon'
  | 'ceramic-white'
  | 'optical-glass'
  | 'blued-steel';

export type TexturePattern =
  | 'none'
  | 'brushed-metal'
  | 'carbon-weave'
  | 'knurled-diamond'
  | 'uv-grid'
  | 'pcb-traces'
  | 'custom-image';

export interface Hotspot3D {
  id: string;
  label: string;
  detail: string;
  position: [number, number, number];
  normal: [number, number, number];
  screenX?: number;
  screenY?: number;
  visible?: boolean;
}

export interface ScenePartInfo {
  id: string;
  name: string;
  type: string;
  vertexCount: number;
  triangleCount: number;
  uvCount: number;
  colorHex: string;
  roughness: number;
  metalness: number;
  clearcoat: number;
  transmission: number;
  visible: boolean;
}

export interface UVTriangleSegment {
  partName: string;
  // Flat array of UV pairs [u0, v0, u1, v1, u2, v2, ...] capped for fast 2D canvas drawing
  coords: Float32Array;
}

export interface MaterialOverride {
  finishPreset: FinishPreset;
  colorHex: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  transmission: number;
  wireframe: boolean;
  texturePattern: TexturePattern;
  customTextureDataUrl: string | null;
  customTextureName: string | null;
  repeatX: number;
  repeatY: number;
  offsetX: number;
  offsetY: number;
  rotationDeg: number;
  bumpScale: number;
  envMapIntensity: number;
}

export interface CameraTelemetry {
  orbitThetaDeg: number;
  orbitPhiDeg: number;
  radiusMeters: number;
  fovDeg: number;
  target: [number, number, number];
  isFlyModeActive: boolean;
}

export interface StudioState {
  selectedModelId: ModelId;
  customModelName: string | null;
  customHdrName: string | null;
  activeTab: InspectorTab;
  navigationMode: NavigationMode;
  touchTool: TouchTool;
  flyModeEnabled: boolean;
  textureViewerMode: TextureViewerMode;
  activeTextureChannel: TextureChannel;
  showUvWireframe: boolean;
  rightSidebarOpen: boolean;
  bottomDockOpen: boolean;
  viewportBg: ViewportBg;
  explodedFactor: number;
  autoRotate: boolean;
  autoRotateSpeed: number;
  showGrid: boolean;
  showContactShadow: boolean;
  showAxes: boolean;
  fogEnabled: boolean;
  exposure: number;
  shadowIntensity: number;
  shadowSoftness: number;
  directLightIntensity: number;
  directLightTemp: 'warm' | 'neutral' | 'cool';
  ambientIntensity: number;
  envPreset: EnvPreset;
  envRotationDeg: number;
  cameraPreset: CameraPreset;
  fov: number;
  hotspotPlacementMode: boolean;
  hotspots: Hotspot3D[];
  activeHotspotId: string | null;
  selectedPartName: string | null;
  materialOverride: MaterialOverride;
  customSnippetOverride: string | null;
}

export interface ViewportImperativeHandle {
  capturePosterPng: () => string | null;
  exportSceneGlb: () => Promise<Blob | null>;
  resetCamera: () => void;
  frameSelectedOrAll: () => void;
  invertCameraOrbit: () => void;
  nudgeFlyCamera: (forward: number, right: number, up: number) => void;
  focusPart: (partName: string) => void;
  focusHotspot: (hotspot: Hotspot3D) => void;
  loadGlbFiles: (files: FileList | File[]) => void;
  loadHdrFile: (file: File) => void;
}
