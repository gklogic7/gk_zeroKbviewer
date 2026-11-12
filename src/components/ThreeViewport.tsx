import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Compass,
  Hand,
  Move,
  RotateCw,
  ZoomIn,
} from 'lucide-react';
import { createProceduralShowcaseModel } from '../three/proceduralModels';
import {
  createCalibrationGridTexture,
  createContactShadowTexture,
  createProceduralEnvironmentTexture,
  getOrCreatePBRChannelSet,
} from '../three/proceduralTextures';
import {
  CameraPreset,
  CameraTelemetry,
  FinishPreset,
  Hotspot3D,
  ScenePartInfo,
  StudioState,
  TouchTool,
  UVTriangleSegment,
  ViewportBg,
  ViewportImperativeHandle,
} from '../types/studio';

// Module-scope reusable scratch math objects to prevent GC allocations in the render loop
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _box3 = new THREE.Box3();
const _spherical = new THREE.Spherical();
const _raycaster = new THREE.Raycaster();
const _pointerNdc = new THREE.Vector2();

const BG_COLOR_MAP: Record<ViewportBg, number> = {
  light: 0xf8fafc,
  platinum: 0xe2e8f0,
  charcoal: 0x18181b,
  obsidian: 0x09090b,
};

const FINISH_PRESET_MAP: Record<
  Exclude<FinishPreset, 'original'>,
  {
    colorHex: string;
    metalness: number;
    roughness: number;
    clearcoat: number;
    transmission: number;
  }
> = {
  'brushed-titanium': {
    colorHex: '#94a3b8',
    metalness: 0.92,
    roughness: 0.22,
    clearcoat: 0.25,
    transmission: 0,
  },
  'anodized-gold': {
    colorHex: '#f59e0b',
    metalness: 0.95,
    roughness: 0.16,
    clearcoat: 0.4,
    transmission: 0,
  },
  'matte-carbon': {
    colorHex: '#1e293b',
    metalness: 0.35,
    roughness: 0.65,
    clearcoat: 0.15,
    transmission: 0,
  },
  'ceramic-white': {
    colorHex: '#f8fafc',
    metalness: 0.08,
    roughness: 0.12,
    clearcoat: 0.95,
    transmission: 0,
  },
  'optical-glass': {
    colorHex: '#bae6fd',
    metalness: 0.0,
    roughness: 0.05,
    clearcoat: 1.0,
    transmission: 0.92,
  },
  'blued-steel': {
    colorHex: '#1d4ed8',
    metalness: 0.9,
    roughness: 0.18,
    clearcoat: 0.6,
    transmission: 0,
  },
};

interface ThreeViewportProps {
  state: StudioState;
  customImageElement: HTMLImageElement | null;
  onUpdateState: (patch: Partial<StudioState>) => void;
  onPartsUpdated: (
    parts: ScenePartInfo[],
    uvSegments: UVTriangleSegment[],
    title: string,
    subtitle: string
  ) => void;
  onCameraTelemetryChange: (telemetry: CameraTelemetry) => void;
  onToast: (message: string) => void;
}

export const ThreeViewport = forwardRef<ViewportImperativeHandle, ThreeViewportProps>(
  (
    {
      state,
      customImageElement,
      onUpdateState,
      onPartsUpdated,
      onCameraTelemetryChange,
      onToast,
    },
    ref
  ) => {
    const canvasMountRef = useRef<HTMLDivElement | null>(null);
    const stateRef = useRef<StudioState>(state);
    stateRef.current = state;

    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [webglLost, setWebglLost] = useState(false);
    const [projectedHotspots, setProjectedHotspots] = useState<Hotspot3D[]>([]);
    const [isRmbFlyActive, setIsRmbFlyActive] = useState(false);

    // Scene & Renderer mutable refs
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const activeModelGroupRef = useRef<THREE.Group | null>(null);
    const contactShadowMeshRef = useRef<THREE.Mesh | null>(null);
    const gridMeshRef = useRef<THREE.Mesh | null>(null);
    const axesHelperRef = useRef<THREE.AxesHelper | null>(null);
    const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
    const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
    const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
    const pmremGeneratorRef = useRef<THREE.PMREMGenerator | null>(null);
    const defaultRoomEnvTexRef = useRef<THREE.Texture | null>(null);
    const isSoftwareGlRef = useRef<boolean>(false);
    const requestRenderRef = useRef<() => void>(() => {});

    // Fly-mode & keyboard state refs
    const flyKeysRef = useRef<Record<string, boolean>>({});
    const isRmbDownRef = useRef<boolean>(false);
    const lastPointerPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    // Smooth transition targets
    const currentExplodeRef = useRef<number>(state.explodedFactor);
    const cameraTransitionActiveRef = useRef<boolean>(false);
    const targetCamPosRef = useRef<THREE.Vector3>(new THREE.Vector3(2.8, 2.1, 3.2));
    const targetControlLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.45, 0));

    // Original material snapshot map so 'original' finish can restore materials
    const originalMaterialsMapRef = useRef<
      Map<
        string,
        {
          colorHex: string;
          metalness: number;
          roughness: number;
          clearcoat: number;
          transmission: number;
          opacity: number;
          transparent: boolean;
        }
      >
    >(new Map());

    // Helper: Collect scene hierarchy parts, polygon counts, and 2D UV Wireframe segments
    const inspectActiveModelParts = (
      root: THREE.Group,
      title: string,
      subtitle: string
    ) => {
      const parts: ScenePartInfo[] = [];
      const uvSegments: UVTriangleSegment[] = [];
      originalMaterialsMapRef.current.clear();

      root.children.forEach((child, idx) => {
        let vertices = 0;
        let triangles = 0;
        let uvCount = 0;
        let sampleMat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | null =
          null;
        const partName = child.name || `Part_${idx + 1}`;
        const uvTriangles: number[] = [];
        const maxSampledTrisPerPart = 320; // Keeps 2D UV canvas crisp at 60fps

        child.traverse((node) => {
          if ((node as THREE.Mesh).isMesh) {
            const mesh = node as THREE.Mesh;
            const geo = mesh.geometry;
            if (geo && geo.attributes.position) {
              const count = (mesh as THREE.InstancedMesh).isInstancedMesh
                ? (mesh as THREE.InstancedMesh).count
                : 1;
              const vCount = geo.attributes.position.count * count;
              vertices += vCount;
              if (geo.index) {
                triangles += (geo.index.count / 3) * count;
              } else {
                triangles += vCount / 3;
              }

              // Extract UV triangles for the 2D Texture & UV Viewer
              const uvAttr = geo.attributes.uv;
              if (uvAttr) {
                uvCount += uvAttr.count;
                if (geo.index) {
                  const idxArr = geo.index.array;
                  const totalTris = Math.floor(idxArr.length / 3);
                  const stride = Math.max(
                    1,
                    Math.ceil(totalTris / maxSampledTrisPerPart)
                  );
                  for (let t = 0; t < totalTris; t += stride) {
                    const i0 = idxArr[t * 3];
                    const i1 = idxArr[t * 3 + 1];
                    const i2 = idxArr[t * 3 + 2];
                    uvTriangles.push(
                      uvAttr.getX(i0),
                      uvAttr.getY(i0),
                      uvAttr.getX(i1),
                      uvAttr.getY(i1),
                      uvAttr.getX(i2),
                      uvAttr.getY(i2)
                    );
                  }
                } else {
                  const totalTris = Math.floor(uvAttr.count / 3);
                  const stride = Math.max(
                    1,
                    Math.ceil(totalTris / maxSampledTrisPerPart)
                  );
                  for (let t = 0; t < totalTris; t += stride) {
                    const i0 = t * 3;
                    const i1 = t * 3 + 1;
                    const i2 = t * 3 + 2;
                    uvTriangles.push(
                      uvAttr.getX(i0),
                      uvAttr.getY(i0),
                      uvAttr.getX(i1),
                      uvAttr.getY(i1),
                      uvAttr.getX(i2),
                      uvAttr.getY(i2)
                    );
                  }
                }
              }
            }

            const mat = Array.isArray(mesh.material)
              ? mesh.material[0]
              : mesh.material;
            if (
              mat &&
              ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial ||
                (mat as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial)
            ) {
              const stdMat = mat as THREE.MeshPhysicalMaterial;
              if (!sampleMat) sampleMat = stdMat;
              originalMaterialsMapRef.current.set(mesh.uuid, {
                colorHex: '#' + stdMat.color.getHexString(),
                metalness: stdMat.metalness ?? 0.5,
                roughness: stdMat.roughness ?? 0.5,
                clearcoat: stdMat.clearcoat ?? 0,
                transmission: stdMat.transmission ?? 0,
                opacity: stdMat.opacity ?? 1,
                transparent: stdMat.transparent ?? false,
              });
            }
          }
        });

        if (uvTriangles.length > 0) {
          uvSegments.push({
            partName,
            coords: new Float32Array(uvTriangles),
          });
        }

        parts.push({
          id: child.uuid,
          name: partName,
          type: child.type,
          vertexCount: Math.round(vertices),
          triangleCount: Math.round(triangles),
          uvCount,
          colorHex: sampleMat
            ? '#' + (sampleMat as THREE.MeshStandardMaterial).color.getHexString()
            : '#94a3b8',
          roughness: sampleMat ? (sampleMat as THREE.MeshStandardMaterial).roughness : 0.4,
          metalness: sampleMat ? (sampleMat as THREE.MeshStandardMaterial).metalness : 0.8,
          clearcoat:
            sampleMat && 'clearcoat' in sampleMat
              ? (sampleMat as THREE.MeshPhysicalMaterial).clearcoat
              : 0,
          transmission:
            sampleMat && 'transmission' in sampleMat
              ? (sampleMat as THREE.MeshPhysicalMaterial).transmission
              : 0,
          visible: child.visible,
        });
      });

      onPartsUpdated(parts, uvSegments, title, subtitle);
    };

    const disposeModelGroup = (group: THREE.Group | null) => {
      if (!group) return;
      group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });
    };

    const handleLoadGlbFiles = (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      const hdrFile = fileArray.find((f) => /\.hdr$/i.test(f.name));
      if (hdrFile) {
        handleLoadHdrFile(hdrFile);
        if (fileArray.length === 1) return;
      }

      const gltfFile = fileArray.find((f) => /\.(glb|gltf)$/i.test(f.name));
      if (!gltfFile) {
        onToast('Supported 3D formats: .glb, .gltf, or .hdr environment files.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const buffer = ev.target?.result;
        if (!buffer || !sceneRef.current) return;

        const loader = new GLTFLoader();
        loader.parse(
          buffer,
          '',
          (gltf) => {
            const scene = sceneRef.current!;
            if (activeModelGroupRef.current) {
              scene.remove(activeModelGroupRef.current);
              disposeModelGroup(activeModelGroupRef.current);
            }

            const wrapper = new THREE.Group();
            wrapper.name = gltfFile.name.replace(/\.[^.]+$/, '');

            const loadedRoot = gltf.scene;
            _box3.setFromObject(loadedRoot);
            const size = _box3.getSize(_vec3A);
            const center = _box3.getCenter(_vec3B);
            const maxDim = Math.max(size.x, size.y, size.z, 0.001);
            const scaleFactor = 2.4 / maxDim;

            loadedRoot.scale.setScalar(scaleFactor);
            loadedRoot.position.set(
              -center.x * scaleFactor,
              -_box3.min.y * scaleFactor,
              -center.z * scaleFactor
            );

            const modelCenter = new THREE.Vector3(0, (size.y * scaleFactor) / 2, 0);
            loadedRoot.traverse((node) => {
              if ((node as THREE.Mesh).isMesh) {
                const mesh = node as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
              }
            });

            const childrenToRegister =
              loadedRoot.children.length > 1
                ? [...loadedRoot.children]
                : [loadedRoot];

            childrenToRegister.forEach((child, idx) => {
              const partBox = new THREE.Box3().setFromObject(child);
              const partCenter = partBox.getCenter(new THREE.Vector3());
              const explodeDir = partCenter
                .clone()
                .sub(modelCenter)
                .normalize()
                .multiplyScalar(0.65);
              if (explodeDir.lengthSq() < 0.01) {
                explodeDir.set(0, 0.35 * (idx + 1), 0);
              }
              child.name = child.name || `Mesh_Component_${idx + 1}`;
              child.userData.isModelPart = true;
              child.userData.basePosition = child.position.clone();
              child.userData.explodeVector = explodeDir;
              child.traverse((sub) => {
                if ((sub as THREE.Mesh).isMesh) {
                  sub.userData.partRootName = child.name;
                }
              });
            });

            wrapper.add(loadedRoot);
            scene.add(wrapper);
            activeModelGroupRef.current = wrapper;

            inspectActiveModelParts(
              loadedRoot.children.length > 1 ? (loadedRoot as THREE.Group) : wrapper,
              wrapper.name,
              `Imported Local GLTF/GLB Asset (${(gltfFile.size / 1024).toFixed(1)} KB)`
            );

            onUpdateState({
              selectedModelId: 'custom-glb',
              customModelName: gltfFile.name,
              selectedPartName: null,
              hotspots: [],
            });
            onToast(`Loaded 3D model: ${gltfFile.name}`);
            requestRenderRef.current();
          },
          (err) => {
            console.error('GLTF parse error:', err);
            onToast(`Could not parse ${gltfFile.name}. Verify it is a valid GLB/GLTF.`);
          }
        );
      };
      reader.readAsArrayBuffer(gltfFile);
    };

    const handleLoadHdrFile = (file: File) => {
      const url = URL.createObjectURL(file);
      const rgbeLoader = new RGBELoader();
      rgbeLoader.load(
        url,
        (texture) => {
          URL.revokeObjectURL(url);
          if (!sceneRef.current || !pmremGeneratorRef.current) return;
          texture.mapping = THREE.EquirectangularReflectionMapping;
          const envMap = pmremGeneratorRef.current.fromEquirectangular(texture).texture;
          sceneRef.current.environment = envMap;
          texture.dispose();

          onUpdateState({
            envPreset: 'custom-hdr',
            customHdrName: file.name,
          });
          onToast(`Applied HDR lighting environment: ${file.name}`);
          requestRenderRef.current();
        },
        undefined,
        () => {
          URL.revokeObjectURL(url);
          onToast(`Failed to parse HDR file: ${file.name}`);
        }
      );
    };

    const handleFrameSelectedOrAll = () => {
      if (!activeModelGroupRef.current) return;
      const st = stateRef.current;
      let targetObj: THREE.Object3D = activeModelGroupRef.current;

      if (st.selectedPartName) {
        activeModelGroupRef.current.traverse((child) => {
          if (child.name === st.selectedPartName) {
            targetObj = child;
          }
        });
      }

      _box3.setFromObject(targetObj);
      const center = _box3.getCenter(_vec3A);
      const size = _box3.getSize(_vec3B);
      const radius = Math.max(size.x, size.y, size.z, 0.8) * 1.45;

      targetControlLookAtRef.current.copy(center);
      if (cameraRef.current && controlsRef.current) {
        const dir = cameraRef.current.position
          .clone()
          .sub(controlsRef.current.target)
          .normalize();
        if (dir.lengthSq() < 0.01) dir.set(0.6, 0.5, 0.7).normalize();
        targetCamPosRef.current.copy(center).addScaledVector(dir, radius);
      }
      cameraTransitionActiveRef.current = true;
      requestRenderRef.current();
    };

    const handleInvertOrbit = () => {
      if (!cameraRef.current || !controlsRef.current) return;
      const offset = cameraRef.current.position
        .clone()
        .sub(controlsRef.current.target);
      offset.x = -offset.x;
      offset.z = -offset.z;
      targetControlLookAtRef.current.copy(controlsRef.current.target);
      targetCamPosRef.current.copy(controlsRef.current.target).add(offset);
      cameraTransitionActiveRef.current = true;
      requestRenderRef.current();
    };

    const handleNudgeFlyCamera = (forwardDelta: number, rightDelta: number, upDelta: number) => {
      if (!cameraRef.current || !controlsRef.current) return;
      const cam = cameraRef.current;
      const ctrl = controlsRef.current;

      cam.getWorldDirection(_forward);
      _right.crossVectors(_forward, _up).normalize();

      _vec3A.set(0, 0, 0);
      _vec3A.addScaledVector(_forward, forwardDelta);
      _vec3A.addScaledVector(_right, rightDelta);
      _vec3A.addScaledVector(_up, upDelta);

      cam.position.add(_vec3A);
      ctrl.target.add(_vec3A);
      cameraTransitionActiveRef.current = false;
      requestRenderRef.current();
    };

    useImperativeHandle(ref, () => ({
      capturePosterPng: () => {
        if (!rendererRef.current || !sceneRef.current || !cameraRef.current) {
          return null;
        }
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        return rendererRef.current.domElement.toDataURL('image/png');
      },
      exportSceneGlb: () => {
        return new Promise<Blob | null>((resolve) => {
          if (!activeModelGroupRef.current) {
            resolve(null);
            return;
          }
          const exporter = new GLTFExporter();
          exporter.parse(
            activeModelGroupRef.current,
            (result) => {
              if (result instanceof ArrayBuffer) {
                resolve(new Blob([result], { type: 'model/gltf-binary' }));
              } else {
                const json = JSON.stringify(result, null, 2);
                resolve(new Blob([json], { type: 'application/json' }));
              }
            },
            (err) => {
              console.error('GLTFExporter error:', err);
              resolve(null);
            },
            { binary: true }
          );
        });
      },
      resetCamera: () => {
        targetCamPosRef.current.set(2.75, 2.05, 3.15);
        targetControlLookAtRef.current.set(0, 0.55, 0);
        cameraTransitionActiveRef.current = true;
        requestRenderRef.current();
      },
      frameSelectedOrAll: handleFrameSelectedOrAll,
      invertCameraOrbit: handleInvertOrbit,
      nudgeFlyCamera: handleNudgeFlyCamera,
      focusPart: (partName: string) => {
        if (!activeModelGroupRef.current) return;
        let found: THREE.Object3D | null = null;
        activeModelGroupRef.current.traverse((child) => {
          if (child.name === partName && !found) {
            found = child;
          }
        });
        if (found) {
          _box3.setFromObject(found);
          const center = _box3.getCenter(_vec3A);
          targetControlLookAtRef.current.copy(center);
          targetCamPosRef.current.copy(center).add(new THREE.Vector3(1.6, 1.1, 1.8));
          cameraTransitionActiveRef.current = true;
          requestRenderRef.current();
        }
      },
      focusHotspot: (hotspot: Hotspot3D) => {
        const pos = new THREE.Vector3(...hotspot.position);
        const norm = new THREE.Vector3(...hotspot.normal).normalize();
        targetControlLookAtRef.current.copy(pos);
        targetCamPosRef.current
          .copy(pos)
          .addScaledVector(norm, 1.45)
          .add(new THREE.Vector3(0.4, 0.45, 0.4));
        cameraTransitionActiveRef.current = true;
        requestRenderRef.current();
      },
      loadGlbFiles: handleLoadGlbFiles,
      loadHdrFile: handleLoadHdrFile,
    }));

    // 1. Initialize WebGLRenderer, Scene, Camera, Studio Lights, Blender/Unity Controls & Loop
    useEffect(() => {
      const container = canvasMountRef.current;
      if (!container) return;

      const isSoftwareGl = (() => {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      })();
      isSoftwareGlRef.current = isSoftwareGl;

      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(BG_COLOR_MAP[stateRef.current.viewportBg]);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(
        stateRef.current.fov,
        width / height,
        0.05,
        120
      );
      camera.position.set(2.75, 2.05, 3.15);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = stateRef.current.exposure;
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;

      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      const handleContextLost = (e: Event) => {
        e.preventDefault();
        setWebglLost(true);
      };
      const handleContextRestored = () => {
        setWebglLost(false);
        requestRenderRef.current();
      };
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

      // RoomEnvironment + PMREMGenerator
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      pmremGeneratorRef.current = pmremGenerator;

      const roomEnvTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      defaultRoomEnvTexRef.current = roomEnvTex;
      scene.environment = roomEnvTex;

      // 3-Point Warm/Cool Studio Rig
      const keyLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
      keyLight.position.set(4.5, 7.5, 4.5);
      keyLight.castShadow = !isSoftwareGl;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      const d = 3.2;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 20;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
      scene.add(keyLight);
      keyLightRef.current = keyLight;

      const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 0.85);
      hemiLight.position.set(0, 12, 0);
      scene.add(hemiLight);
      hemiLightRef.current = hemiLight;

      const rimLight = new THREE.DirectionalLight(0xbae6fd, 1.15);
      rimLight.position.set(-4.5, 4.0, -4.5);
      scene.add(rimLight);
      rimLightRef.current = rimLight;

      if (!isSoftwareGl) {
        RectAreaLightUniformsLib.init();
        const softboxLeft = new THREE.RectAreaLight(0xffffff, 2.5, 3.0, 2.0);
        softboxLeft.position.set(-3.5, 3.2, 2.5);
        softboxLeft.lookAt(0, 0.5, 0);
        scene.add(softboxLeft);

        const softboxRight = new THREE.RectAreaLight(0xfef3c7, 2.0, 2.5, 2.0);
        softboxRight.position.set(3.5, 2.8, -2.0);
        softboxRight.lookAt(0, 0.5, 0);
        scene.add(softboxRight);
      }

      // Contact Shadow Plane
      const contactShadowGeo = new THREE.PlaneGeometry(4.4, 4.4);
      contactShadowGeo.rotateX(-Math.PI / 2);
      const contactShadowMat = new THREE.MeshBasicMaterial({
        map: createContactShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.65 * stateRef.current.shadowIntensity,
      });
      const contactShadowMesh = new THREE.Mesh(contactShadowGeo, contactShadowMat);
      contactShadowMesh.position.y = 0.002;
      scene.add(contactShadowMesh);
      contactShadowMeshRef.current = contactShadowMesh;

      // Calibration Studio Floor Grid
      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      const gridGeo = new THREE.PlaneGeometry(18, 18);
      gridGeo.rotateX(-Math.PI / 2);
      const gridMat = new THREE.MeshBasicMaterial({
        map: createCalibrationGridTexture(maxAniso, false),
        transparent: true,
        depthWrite: false,
        opacity: 0.75,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
      const gridMesh = new THREE.Mesh(gridGeo, gridMat);
      gridMesh.position.y = 0.0;
      gridMesh.visible = stateRef.current.showGrid;
      scene.add(gridMesh);
      gridMeshRef.current = gridMesh;

      // Axes Helper
      const axesHelper = new THREE.AxesHelper(1.8);
      axesHelper.position.y = 0.01;
      axesHelper.visible = stateRef.current.showAxes;
      scene.add(axesHelper);
      axesHelperRef.current = axesHelper;

      // OrbitControls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = !isSoftwareGl;
      controls.dampingFactor = 0.06;
      controls.minDistance = 0.6;
      controls.maxDistance = 22;
      controls.maxPolarAngle = Math.PI - 0.05;
      controls.target.set(0, 0.55, 0);
      controls.update();
      controlsRef.current = controls;

      const handleControlStart = () => {
        cameraTransitionActiveRef.current = false;
      };
      const handleControlChange = () => {
        requestRenderRef.current();
      };
      controls.addEventListener('start', handleControlStart);
      controls.addEventListener('change', handleControlChange);

      // Software WebGL GPU-fence pacing & on-demand render scheduler
      let frameId = 0;
      let renderBusy = false;
      let renderDirty = false;
      let lastFrameTime = performance.now();
      let lastTelemetryEmit = 0;

      function afterDraw(cb: () => void) {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (!gl || typeof gl.fenceSync !== 'function') {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (status === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      }

      function stepFrame() {
        renderDirty = false;
        const now = performance.now();
        const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
        lastFrameTime = now;

        const st = stateRef.current;
        let hasActiveAnimation = false;

        // 1. First-Person Fly-Through Movement (Unity RMB+WASD/QE or Blender Shift+F Fly Mode)
        const flyActive = isRmbDownRef.current || st.flyModeEnabled;
        if (flyActive) {
          const keys = flyKeysRef.current;
          const boost = keys['ShiftLeft'] || keys['ShiftRight'] ? 2.4 : 1.0;
          const speed = 2.8 * boost * dt;
          let moved = false;

          camera.getWorldDirection(_forward);
          _right.crossVectors(_forward, _up).normalize();

          _vec3A.set(0, 0, 0);
          if (keys['KeyW'] || keys['ArrowUp']) {
            _vec3A.addScaledVector(_forward, speed);
            moved = true;
          }
          if (keys['KeyS'] || keys['ArrowDown']) {
            _vec3A.addScaledVector(_forward, -speed);
            moved = true;
          }
          if (keys['KeyD'] || keys['ArrowRight']) {
            _vec3A.addScaledVector(_right, speed);
            moved = true;
          }
          if (keys['KeyA'] || keys['ArrowLeft']) {
            _vec3A.addScaledVector(_right, -speed);
            moved = true;
          }
          if (keys['KeyE'] || keys['Space']) {
            _vec3A.addScaledVector(_up, speed);
            moved = true;
          }
          if (keys['KeyQ'] || keys['KeyC']) {
            _vec3A.addScaledVector(_up, -speed);
            moved = true;
          }

          if (moved) {
            camera.position.add(_vec3A);
            controls.target.add(_vec3A);
            cameraTransitionActiveRef.current = false;
            hasActiveAnimation = true;
          }
        }

        // 2. Smoothly damp exploded view separation
        const targetExplode = st.explodedFactor;
        if (Math.abs(currentExplodeRef.current - targetExplode) > 0.001) {
          currentExplodeRef.current = THREE.MathUtils.damp(
            currentExplodeRef.current,
            targetExplode,
            8,
            dt
          );
          hasActiveAnimation = true;
        } else {
          currentExplodeRef.current = targetExplode;
        }

        if (activeModelGroupRef.current) {
          const factor = currentExplodeRef.current;
          activeModelGroupRef.current.traverse((obj) => {
            if (
              obj.userData.isModelPart &&
              obj.userData.basePosition &&
              obj.userData.explodeVector
            ) {
              const basePos = obj.userData.basePosition as THREE.Vector3;
              const expVec = obj.userData.explodeVector as THREE.Vector3;
              obj.position.set(
                basePos.x + expVec.x * factor,
                basePos.y + expVec.y * factor,
                basePos.z + expVec.z * factor
              );
            }
          });
        }

        // 3. Smoothly damp scripted camera preset transitions
        if (cameraTransitionActiveRef.current) {
          camera.position.x = THREE.MathUtils.damp(
            camera.position.x,
            targetCamPosRef.current.x,
            8,
            dt
          );
          camera.position.y = THREE.MathUtils.damp(
            camera.position.y,
            targetCamPosRef.current.y,
            8,
            dt
          );
          camera.position.z = THREE.MathUtils.damp(
            camera.position.z,
            targetCamPosRef.current.z,
            8,
            dt
          );
          controls.target.x = THREE.MathUtils.damp(
            controls.target.x,
            targetControlLookAtRef.current.x,
            8,
            dt
          );
          controls.target.y = THREE.MathUtils.damp(
            controls.target.y,
            targetControlLookAtRef.current.y,
            8,
            dt
          );
          controls.target.z = THREE.MathUtils.damp(
            controls.target.z,
            targetControlLookAtRef.current.z,
            8,
            dt
          );

          if (
            camera.position.distanceToSquared(targetCamPosRef.current) < 0.0005 &&
            controls.target.distanceToSquared(targetControlLookAtRef.current) < 0.0005
          ) {
            cameraTransitionActiveRef.current = false;
          } else {
            hasActiveAnimation = true;
          }
        }

        // 4. Auto-rotate on hardware WebGL
        controls.autoRotate = st.autoRotate && !isSoftwareGl && !flyActive;
        controls.autoRotateSpeed = st.autoRotateSpeed;
        if (controls.autoRotate) {
          hasActiveAnimation = true;
        }

        const controlsChanged = controls.update();
        if (controlsChanged && !isSoftwareGl) {
          hasActiveAnimation = true;
        }

        renderer.render(scene, camera);

        // 5. Project 3D surface hotspots to 2D viewport coordinates
        if (st.hotspots.length > 0 && st.selectedModelId !== 'none') {
          const rect = renderer.domElement.getBoundingClientRect();
          const updatedHotspots = st.hotspots.map((h) => {
            _vec3A.set(h.position[0], h.position[1], h.position[2]);
            _vec3B.copy(_vec3A).project(camera);
            const screenX = ((_vec3B.x + 1) / 2) * rect.width;
            const screenY = ((-_vec3B.y + 1) / 2) * rect.height;

            _vec3C.set(h.normal[0], h.normal[1], h.normal[2]).normalize();
            const camToPoint = _vec3A.clone().sub(camera.position).normalize();
            const isFacing = _vec3C.dot(camToPoint) < 0.25 && _vec3B.z < 1.0;

            return {
              ...h,
              screenX,
              screenY,
              visible: isFacing,
            };
          });
          setProjectedHotspots(updatedHotspots);
        } else {
          setProjectedHotspots([]);
        }

        // 6. Update camera telemetry
        if (now - lastTelemetryEmit > 160) {
          lastTelemetryEmit = now;
          _vec3A.copy(camera.position).sub(controls.target);
          _spherical.setFromVector3(_vec3A);
          const thetaDeg = Math.round(THREE.MathUtils.radToDeg(_spherical.theta));
          const phiDeg = Math.round(THREE.MathUtils.radToDeg(_spherical.phi));
          onCameraTelemetryChange({
            orbitThetaDeg: thetaDeg,
            orbitPhiDeg: phiDeg,
            radiusMeters: Number(_spherical.radius.toFixed(2)),
            fovDeg: Math.round(camera.fov),
            target: [
              Number(controls.target.x.toFixed(2)),
              Number(controls.target.y.toFixed(2)),
              Number(controls.target.z.toFixed(2)),
            ],
            isFlyModeActive: isRmbDownRef.current || st.flyModeEnabled,
          });
        }

        const done = () => {
          renderBusy = false;
          if (renderDirty || hasActiveAnimation) {
            requestRender();
          }
        };

        if (isSoftwareGl) {
          afterDraw(done);
        } else {
          done();
        }
      }

      function requestRender() {
        if (renderBusy) {
          renderDirty = true;
          return;
        }
        renderBusy = true;
        frameId = requestAnimationFrame(stepFrame);
      }

      requestRenderRef.current = requestRender;

      // ResizeObserver so split-view toggling (50/50 3D + 2D Texture Viewer) resizes WebGL immediately
      const resizeObserver = new ResizeObserver(() => {
        if (!container || !rendererRef.current || !cameraRef.current) return;
        const w = Math.max(1, container.clientWidth);
        const h = Math.max(1, container.clientHeight);
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
        requestRender();
      });
      resizeObserver.observe(container);

      // Pointer & Mouse Look / Raycast Handling
      let pointerDownPos = { x: 0, y: 0 };
      const handlePointerDown = (e: PointerEvent) => {
        pointerDownPos = { x: e.clientX, y: e.clientY };
        lastPointerPosRef.current = { x: e.clientX, y: e.clientY };

        const st = stateRef.current;

        // Dynamic modifier remapping before OrbitControls processes pointerdown
        if (st.navigationMode === 'blender') {
          // Blender: MMB (or Alt+LMB) = Orbit, Shift+MMB (or Shift+Alt+LMB) = Pan, Ctrl+MMB = Dolly
          if (e.shiftKey) {
            controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
            controls.mouseButtons.LEFT = e.altKey ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
          } else if (e.ctrlKey) {
            controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
          } else {
            controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
            controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
          }
          controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
        } else if (st.navigationMode === 'unity') {
          // Unity: Alt+LMB = Orbit, MMB = Pan, Alt+RMB = Dolly, Plain RMB Hold = Fly Look + WASD!
          if (e.button === 2 && !e.altKey) {
            isRmbDownRef.current = true;
            setIsRmbFlyActive(true);
            controls.enabled = false;
            return;
          }
          controls.enabled = true;
          controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
          controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
          controls.mouseButtons.RIGHT = e.altKey
            ? THREE.MOUSE.DOLLY
            : THREE.MOUSE.PAN;
        }
      };

      const handlePointerMove = (e: PointerEvent) => {
        if (isRmbDownRef.current || stateRef.current.flyModeEnabled) {
          if (e.buttons === 0 && !isRmbDownRef.current) return;
          const dx = e.clientX - lastPointerPosRef.current.x;
          const dy = e.clientY - lastPointerPosRef.current.y;
          lastPointerPosRef.current = { x: e.clientX, y: e.clientY };

          // Rotate look target around camera position (first-person mouse look)
          const lookOffset = controls.target.clone().sub(camera.position);
          _spherical.setFromVector3(lookOffset);
          _spherical.theta -= dx * 0.0045;
          _spherical.phi = THREE.MathUtils.clamp(
            _spherical.phi + dy * 0.0045,
            0.1,
            Math.PI - 0.1
          );
          lookOffset.setFromSpherical(_spherical);
          controls.target.copy(camera.position).add(lookOffset);
          camera.lookAt(controls.target);
          requestRender();
        }
      };

      const handlePointerUp = (e: PointerEvent) => {
        if (isRmbDownRef.current) {
          isRmbDownRef.current = false;
          setIsRmbFlyActive(false);
          controls.enabled = true;
          requestRender();
        }

        const dist = Math.hypot(
          e.clientX - pointerDownPos.x,
          e.clientY - pointerDownPos.y
        );
        if (dist > 5 || e.button !== 0) return; // Only left-click without drag selects part/pins hotspot
        if (!activeModelGroupRef.current || !cameraRef.current) return;

        const rect = renderer.domElement.getBoundingClientRect();
        _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        _raycaster.setFromCamera(_pointerNdc, cameraRef.current);
        const hits = _raycaster.intersectObject(activeModelGroupRef.current, true);
        if (hits.length === 0) return;

        const hit = hits[0];
        const st = stateRef.current;

        if (st.hotspotPlacementMode) {
          const worldNormal = hit.face
            ? hit.face.normal
                .clone()
                .transformDirection(hit.object.matrixWorld)
                .normalize()
            : new THREE.Vector3(0, 1, 0);

          const newHotspot: Hotspot3D = {
            id: `hs-${Date.now()}`,
            label: `Annotation #${st.hotspots.length + 1}`,
            detail: `Surface coordinate (${hit.point.x.toFixed(2)}m, ${hit.point.y.toFixed(2)}m, ${hit.point.z.toFixed(2)}m)`,
            position: [
              Number(hit.point.x.toFixed(3)),
              Number(hit.point.y.toFixed(3)),
              Number(hit.point.z.toFixed(3)),
            ],
            normal: [
              Number(worldNormal.x.toFixed(3)),
              Number(worldNormal.y.toFixed(3)),
              Number(worldNormal.z.toFixed(3)),
            ],
          };

          onUpdateState({
            hotspots: [...st.hotspots, newHotspot],
            activeHotspotId: newHotspot.id,
            hotspotPlacementMode: false,
          });
          onToast(
            `Pinned 3D hotspot "${newHotspot.label}" on ${hit.object.name || 'surface'}`
          );
          requestRender();
        } else {
          const partName =
            hit.object.userData.partRootName || hit.object.name || null;
          if (partName) {
            onUpdateState({ selectedPartName: partName });
            requestRender();
          }
        }
      };

      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
      };

      // Keyboard listener for Blender Numpad views (1, 3, 7, 9, .) and Unity/Blender Fly WASD/F
      const handleKeyDown = (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        flyKeysRef.current[e.code] = true;

        if (
          isRmbDownRef.current ||
          stateRef.current.flyModeEnabled
        ) {
          if (
            [
              'KeyW',
              'KeyA',
              'KeyS',
              'KeyD',
              'KeyQ',
              'KeyE',
              'ArrowUp',
              'ArrowDown',
              'ArrowLeft',
              'ArrowRight',
              'Space',
            ].includes(e.code)
          ) {
            requestRender();
            return;
          }
        }

        // Shift + F toggles persistent Fly Mode (Blender convention)
        if (e.shiftKey && e.code === 'KeyF') {
          e.preventDefault();
          const nextFly = !stateRef.current.flyModeEnabled;
          onUpdateState({ flyModeEnabled: nextFly });
          onToast(
            nextFly
              ? 'Fly Mode Active: Use WASD + Q/E and drag mouse to look around'
              : 'Exited Fly Mode'
          );
          return;
        }

        // F or NumpadDecimal (.) frames selected part or entire model (Unity & Blender)
        if (
          e.code === 'KeyF' ||
          e.code === 'NumpadDecimal' ||
          e.key === '.'
        ) {
          e.preventDefault();
          handleFrameSelectedOrAll();
          return;
        }

        // Blender Numpad / Number Axis Presets: 1 (Front/Back), 3 (Right/Left), 7 (Top/Bottom), 9 (Invert)
        if (e.code === 'Numpad1' || e.code === 'Digit1') {
          onUpdateState({ cameraPreset: e.ctrlKey ? 'back' : 'front' });
        } else if (e.code === 'Numpad3' || e.code === 'Digit3') {
          onUpdateState({ cameraPreset: e.ctrlKey ? 'left' : 'right' });
        } else if (e.code === 'Numpad7' || e.code === 'Digit7') {
          onUpdateState({ cameraPreset: e.ctrlKey ? 'bottom' : 'top' });
        } else if (e.code === 'Numpad9' || e.code === 'Digit9') {
          handleInvertOrbit();
        } else if (e.code === 'Numpad0' || e.code === 'Digit0') {
          onUpdateState({ cameraPreset: 'isometric' });
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        flyKeysRef.current[e.code] = false;
      };

      renderer.domElement.addEventListener('pointerdown', handlePointerDown, {
        capture: true,
      });
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      renderer.domElement.addEventListener('contextmenu', handleContextMenu);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      return () => {
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener('pointerdown', handlePointerDown, {
          capture: true,
        });
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
        renderer.domElement.removeEventListener(
          'webglcontextrestored',
          handleContextRestored
        );
        controls.dispose();
        pmremGenerator.dispose();
        renderer.dispose();
      };
    }, []);

    // Sync Touch & Mouse Button bindings when NavigationMode or TouchTool changes
    useEffect(() => {
      const controls = controlsRef.current;
      if (!controls) return;

      if (state.navigationMode === 'blender') {
        controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.ROTATE,
          RIGHT: THREE.MOUSE.PAN,
        };
      } else if (state.navigationMode === 'unity') {
        controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: THREE.MOUSE.DOLLY,
        };
      }

      // Configure 1-finger and 2-finger Tablet Touch mappings
      if (state.touchTool === 'pan') {
        controls.touches = {
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_ROTATE,
        };
      } else if (state.touchTool === 'zoom') {
        controls.touches = {
          ONE: THREE.TOUCH.DOLLY_PAN,
          TWO: THREE.TOUCH.ROTATE,
        };
      } else {
        controls.touches = {
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        };
      }
    }, [state.navigationMode, state.touchTool]);

    // 2. React to Selected Model changes
    useEffect(() => {
      const scene = sceneRef.current;
      const renderer = rendererRef.current;
      const camera = cameraRef.current;
      if (!scene || !renderer || !camera) return;

      if (state.selectedModelId === 'custom-glb') {
        requestRenderRef.current();
        return;
      }

      if (activeModelGroupRef.current) {
        scene.remove(activeModelGroupRef.current);
        disposeModelGroup(activeModelGroupRef.current);
        activeModelGroupRef.current = null;
      }

      if (state.selectedModelId === 'none') {
        onPartsUpdated(
          [],
          [],
          'No Model Loaded',
          'Drop a GLB/glTF file or select a showcase model'
        );
        setProjectedHotspots([]);
        requestRenderRef.current();
        return;
      }

      const bundle = createProceduralShowcaseModel(
        state.selectedModelId,
        isSoftwareGlRef.current
      );
      scene.add(bundle.group);
      activeModelGroupRef.current = bundle.group;

      if (!isSoftwareGlRef.current) {
        renderer.compile(scene, camera);
      }

      inspectActiveModelParts(bundle.group, bundle.title, bundle.subtitle);
      onUpdateState({
        hotspots: bundle.defaultHotspots,
        activeHotspotId: bundle.defaultHotspots[0]?.id ?? null,
        selectedPartName: null,
      });

      targetCamPosRef.current.set(2.75, 2.05, 3.15);
      targetControlLookAtRef.current.set(0, 0.55, 0);
      cameraTransitionActiveRef.current = true;
      requestRenderRef.current();
    }, [state.selectedModelId]);

    // 3. React to Viewport Background, Fog, Grid, Axes, Lighting & Exposure changes
    useEffect(() => {
      const scene = sceneRef.current;
      const renderer = rendererRef.current;
      const camera = cameraRef.current;
      if (!scene || !renderer || !camera) return;

      const bgHex = BG_COLOR_MAP[state.viewportBg];
      scene.background = new THREE.Color(bgHex);
      if (state.fogEnabled) {
        scene.fog = new THREE.FogExp2(bgHex, 0.085);
      } else {
        scene.fog = null;
      }

      renderer.toneMappingExposure = state.exposure;

      if (camera.fov !== state.fov) {
        camera.fov = state.fov;
        camera.updateProjectionMatrix();
      }

      if (contactShadowMeshRef.current) {
        contactShadowMeshRef.current.visible =
          state.showContactShadow && state.selectedModelId !== 'none';
        const mat = contactShadowMeshRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.68 * state.shadowIntensity;
      }

      if (gridMeshRef.current) {
        gridMeshRef.current.visible = state.showGrid;
        const isDark =
          state.viewportBg === 'charcoal' || state.viewportBg === 'obsidian';
        const mat = gridMeshRef.current.material as THREE.MeshBasicMaterial;
        mat.map = createCalibrationGridTexture(
          renderer.capabilities.getMaxAnisotropy(),
          isDark
        );
        mat.needsUpdate = true;
      }

      if (axesHelperRef.current) {
        axesHelperRef.current.visible = state.showAxes;
      }

      if (keyLightRef.current) {
        keyLightRef.current.intensity = state.directLightIntensity;
        keyLightRef.current.shadow.radius = 1 + state.shadowSoftness * 6;
        if (state.directLightTemp === 'warm') {
          keyLightRef.current.color.setHex(0xfffbeb);
        } else if (state.directLightTemp === 'cool') {
          keyLightRef.current.color.setHex(0xe0f2fe);
        } else {
          keyLightRef.current.color.setHex(0xffffff);
        }
      }

      if (hemiLightRef.current) {
        hemiLightRef.current.intensity = state.ambientIntensity;
      }

      requestRenderRef.current();
    }, [
      state.viewportBg,
      state.fogEnabled,
      state.exposure,
      state.fov,
      state.showContactShadow,
      state.shadowIntensity,
      state.shadowSoftness,
      state.showGrid,
      state.showAxes,
      state.directLightIntensity,
      state.directLightTemp,
      state.ambientIntensity,
      state.selectedModelId,
    ]);

    // 4. React to Studio Environment Preset & Rotation
    useEffect(() => {
      const scene = sceneRef.current;
      const pmrem = pmremGeneratorRef.current;
      if (!scene || !pmrem || state.envPreset === 'custom-hdr') return;

      if (
        state.envPreset === 'studio-neutral' &&
        state.envRotationDeg === 0 &&
        defaultRoomEnvTexRef.current
      ) {
        scene.environment = defaultRoomEnvTexRef.current;
      } else {
        const eqTex = createProceduralEnvironmentTexture(
          state.envPreset,
          state.envRotationDeg
        );
        const envMap = pmrem.fromEquirectangular(eqTex).texture;
        scene.environment = envMap;
        eqTex.dispose();
      }
      requestRenderRef.current();
    }, [state.envPreset, state.envRotationDeg]);

    // 5. React to Camera Preset selection (including Blender Numpad Front/Back/Left/Right/Top/Bottom)
    useEffect(() => {
      if (state.cameraPreset === 'free') return;
      const presets: Record<
        Exclude<CameraPreset, 'free'>,
        { pos: [number, number, number]; target: [number, number, number] }
      > = {
        isometric: { pos: [2.75, 2.05, 3.15], target: [0, 0.55, 0] },
        front: { pos: [0, 0.75, 3.8], target: [0, 0.55, 0] },
        back: { pos: [0, 0.75, -3.8], target: [0, 0.55, 0] },
        right: { pos: [3.8, 0.75, 0], target: [0, 0.55, 0] },
        left: { pos: [-3.8, 0.75, 0], target: [0, 0.55, 0] },
        top: { pos: [0.01, 4.4, 0.01], target: [0, 0.4, 0] },
        bottom: { pos: [0.01, -3.6, 0.01], target: [0, 0.4, 0] },
        macro: { pos: [1.15, 1.05, 1.35], target: [0, 0.5, 0.2] },
      };
      const chosen = presets[state.cameraPreset];
      if (chosen) {
        targetCamPosRef.current.set(...chosen.pos);
        targetControlLookAtRef.current.set(...chosen.target);
        cameraTransitionActiveRef.current = true;
        requestRenderRef.current();
      }
    }, [state.cameraPreset]);

    // 6. React to Exploded Factor or Auto-Rotate changes
    useEffect(() => {
      requestRenderRef.current();
    }, [state.explodedFactor, state.autoRotate, state.autoRotateSpeed, state.hotspots]);

    // 7. React to Material Overrides, Finish Presets, Texture Patterns & UV Transforms
    useEffect(() => {
      const root = activeModelGroupRef.current;
      const renderer = rendererRef.current;
      if (!root || !renderer) return;

      const ov = state.materialOverride;
      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      const channelSet = getOrCreatePBRChannelSet(
        ov.texturePattern,
        maxAniso,
        customImageElement,
        ov.colorHex,
        ov.roughness,
        ov.metalness
      );

      // Apply UV Repeat, Offset, and Rotation to textures
      const rotRad = (ov.rotationDeg * Math.PI) / 180;
      [
        channelSet.albedoTexture,
        channelSet.bumpTexture,
        channelSet.roughnessTexture,
        channelSet.metalnessTexture,
      ].forEach((tex) => {
        tex.repeat.set(ov.repeatX, ov.repeatY);
        tex.offset.set(ov.offsetX, ov.offsetY);
        tex.rotation = rotRad;
        tex.needsUpdate = true;
      });

      root.traverse((node) => {
        if (!(node as THREE.Mesh).isMesh) return;
        const mesh = node as THREE.Mesh;
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (
          !mat ||
          (!(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial &&
            !(mat as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial)
        ) {
          return;
        }

        const physMat = mat as THREE.MeshPhysicalMaterial;
        const orig = originalMaterialsMapRef.current.get(mesh.uuid);

        const partRootName = mesh.userData.partRootName || mesh.name;
        const isTargetPart =
          !state.selectedPartName || partRootName === state.selectedPartName;

        physMat.wireframe = ov.wireframe;
        physMat.envMapIntensity = ov.envMapIntensity;

        if (ov.finishPreset === 'original' && orig && ov.texturePattern === 'none') {
          physMat.color.set(orig.colorHex);
          physMat.metalness = orig.metalness;
          physMat.roughness = orig.roughness;
          if ('clearcoat' in physMat) physMat.clearcoat = orig.clearcoat;
          if ('transmission' in physMat) {
            physMat.transmission = isSoftwareGlRef.current ? 0 : orig.transmission;
          }
          physMat.opacity = orig.opacity;
          physMat.transparent = orig.transparent;
          physMat.map = null;
          physMat.bumpMap = null;
          physMat.needsUpdate = true;
        } else if (isTargetPart) {
          if (ov.finishPreset !== 'original') {
            const preset = FINISH_PRESET_MAP[ov.finishPreset];
            physMat.color.set(preset.colorHex);
            physMat.metalness = preset.metalness;
            physMat.roughness = preset.roughness;
            if ('clearcoat' in physMat) physMat.clearcoat = preset.clearcoat;
            if ('transmission' in physMat) {
              physMat.transmission = isSoftwareGlRef.current
                ? 0
                : preset.transmission;
              physMat.transparent = preset.transmission > 0;
              physMat.opacity =
                preset.transmission > 0 && isSoftwareGlRef.current ? 0.35 : 1.0;
            }
          } else {
            physMat.color.set(
              ov.texturePattern === 'custom-image' || ov.texturePattern === 'uv-grid'
                ? '#ffffff'
                : ov.colorHex
            );
            physMat.metalness = ov.metalness;
            physMat.roughness = ov.roughness;
            if ('clearcoat' in physMat) physMat.clearcoat = ov.clearcoat;
            if ('transmission' in physMat) {
              physMat.transmission = isSoftwareGlRef.current ? 0 : ov.transmission;
              physMat.transparent = ov.transmission > 0;
              physMat.opacity =
                ov.transmission > 0 && isSoftwareGlRef.current ? 0.35 : 1.0;
            }
          }

          if (ov.texturePattern !== 'none') {
            physMat.map = channelSet.albedoTexture;
            physMat.bumpMap = channelSet.bumpTexture;
            physMat.bumpScale = ov.bumpScale;
          } else {
            physMat.map = null;
            physMat.bumpMap = null;
          }
          physMat.needsUpdate = true;
        }

        if (state.selectedPartName && partRootName === state.selectedPartName) {
          physMat.emissive.setHex(0x1d4ed8);
          physMat.emissiveIntensity = 0.22;
        } else {
          physMat.emissive.setHex(0x000000);
          physMat.emissiveIntensity = 0;
        }
      });

      requestRenderRef.current();
    }, [state.materialOverride, state.selectedPartName, customImageElement]);

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDraggingOver) setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleLoadGlbFiles(e.dataTransfer.files);
      }
    };

    const isLightViewport =
      state.viewportBg === 'light' || state.viewportBg === 'platinum';

    const TOUCH_TOOLS: { id: TouchTool; label: string; icon: React.ReactNode }[] = [
      { id: 'orbit', label: 'Orbit', icon: <RotateCw className="w-4 h-4" /> },
      { id: 'pan', label: 'Pan', icon: <Hand className="w-4 h-4" /> },
      { id: 'zoom', label: 'Dolly', icon: <ZoomIn className="w-4 h-4" /> },
      { id: 'fly', label: 'Fly Pad', icon: <Move className="w-4 h-4" /> },
    ];

    return (
      <div
        className="relative w-full h-full overflow-hidden select-none"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Dedicated Empty Container for Three.js WebGL Canvas */}
        <div
          ref={canvasMountRef}
          className={`w-full h-full ${
            state.hotspotPlacementMode
              ? 'cursor-crosshair'
              : isRmbFlyActive || state.flyModeEnabled
              ? 'cursor-move'
              : 'cursor-grab active:cursor-grabbing'
          }`}
        />

        {/* Interactive 3D Axis Orientation Gizmo (Blender / Unity Viewport Corner Widget) */}
        <div
          className={`pointer-events-auto absolute top-16 z-20 transition-all duration-200 ${
            state.rightSidebarOpen && state.textureViewerMode !== 'split'
              ? 'right-[376px]'
              : 'right-4'
          }`}
        >
          <div className="bg-[#141417]/95 border border-[#27272a] rounded-2xl p-2 shadow-xl flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1 text-[10px] font-mono-tabular text-[#a1a1aa] px-1">
              <Compass className="w-3 h-3 text-[#3b82f6]" />
              <span>AXIS GIZMO</span>
            </div>

            {/* Primary X / Y / Z Axis Snap Buttons (>= 44px touch targets) */}
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() =>
                  onUpdateState({
                    cameraPreset:
                      state.cameraPreset === 'right' ? 'left' : 'right',
                  })
                }
                className="min-w-[44px] min-h-[44px] rounded-xl bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/40 text-rose-400 font-mono-tabular text-xs font-bold flex flex-col items-center justify-center transition-colors cursor-pointer"
                title="Snap to +X / -X Axis (Blender Numpad 3)"
              >
                <span>{state.cameraPreset === 'left' ? '-X' : '+X'}</span>
                <span className="text-[9px] font-normal opacity-80">Right</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateState({
                    cameraPreset:
                      state.cameraPreset === 'top' ? 'bottom' : 'top',
                  })
                }
                className="min-w-[44px] min-h-[44px] rounded-xl bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 font-mono-tabular text-xs font-bold flex flex-col items-center justify-center transition-colors cursor-pointer"
                title="Snap to +Y / -Y Axis (Blender Numpad 7)"
              >
                <span>{state.cameraPreset === 'bottom' ? '-Y' : '+Y'}</span>
                <span className="text-[9px] font-normal opacity-80">Top</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateState({
                    cameraPreset:
                      state.cameraPreset === 'front' ? 'back' : 'front',
                  })
                }
                className="min-w-[44px] min-h-[44px] rounded-xl bg-blue-500/15 hover:bg-blue-500/30 border border-blue-500/40 text-blue-400 font-mono-tabular text-xs font-bold flex flex-col items-center justify-center transition-colors cursor-pointer"
                title="Snap to +Z / -Z Axis (Blender Numpad 1)"
              >
                <span>{state.cameraPreset === 'back' ? '-Z' : '+Z'}</span>
                <span className="text-[9px] font-normal opacity-80">Front</span>
              </button>
            </div>

            {/* Frame Selected (F / .) & Invert (9) quick buttons */}
            <div className="grid grid-cols-2 gap-1 w-full">
              <button
                type="button"
                onClick={handleFrameSelectedOrAll}
                className="min-h-[38px] px-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] text-[11px] font-medium transition-colors cursor-pointer"
                title="Frame Selected Part or All (Shortcut: F or Numpad .)"
              >
                Frame (F)
              </button>
              <button
                type="button"
                onClick={() => onUpdateState({ cameraPreset: 'isometric' })}
                className="min-h-[38px] px-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] text-[11px] font-medium transition-colors cursor-pointer"
                title="Isometric Perspective (Numpad 0)"
              >
                Iso (0)
              </button>
            </div>
          </div>

          {/* Tablet / Touch Single-Finger Mode Switcher */}
          {state.navigationMode === 'touch' && (
            <div className="mt-2 bg-[#141417]/95 border border-[#27272a] rounded-2xl p-1.5 shadow-xl flex flex-col gap-1">
              {TOUCH_TOOLS.map((tool) => {
                const active = state.touchTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() =>
                      onUpdateState({
                        touchTool: tool.id,
                        flyModeEnabled: tool.id === 'fly',
                      })
                    }
                    className={`min-h-[44px] px-3 rounded-xl flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#3b82f6] text-white'
                        : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-white'
                    }`}
                  >
                    {tool.icon}
                    <span>{tool.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Tablet On-Screen Virtual Fly D-Pad when Fly Mode or Touch Fly Tool is active */}
        {(state.flyModeEnabled ||
          (state.navigationMode === 'touch' && state.touchTool === 'fly')) && (
          <div className="pointer-events-auto absolute bottom-28 left-4 z-20 bg-[#141417]/95 border border-[#27272a] rounded-2xl p-2.5 shadow-2xl">
            <div className="text-[10px] font-mono-tabular text-[#a1a1aa] text-center mb-1.5">
              FLY CAMERA PAD (WASD / QE)
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleNudgeFlyCamera(0, 0, -0.35)}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-xs font-mono-tabular text-[#d4d4d8] flex items-center justify-center cursor-pointer"
                title="Fly Down (Q)"
              >
                Q ↓
              </button>
              <button
                type="button"
                onClick={() => handleNudgeFlyCamera(0.45, 0, 0)}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white flex items-center justify-center cursor-pointer"
                title="Fly Forward (W)"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleNudgeFlyCamera(0, 0, 0.35)}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-xs font-mono-tabular text-[#d4d4d8] flex items-center justify-center cursor-pointer"
                title="Fly Up (E)"
              >
                E ↑
              </button>

              <button
                type="button"
                onClick={() => handleNudgeFlyCamera(0, -0.45, 0)}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-white flex items-center justify-center cursor-pointer"
                title="Strafe Left (A)"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleNudgeFlyCamera(-0.45, 0, 0)}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-white flex items-center justify-center cursor-pointer"
                title="Fly Backward (S)"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleNudgeFlyCamera(0, 0.45, 0)}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-white flex items-center justify-center cursor-pointer"
                title="Strafe Right (D)"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Reference-Faithful Empty Dropzone State ("Drag a glTF or GLB here!") */}
        {(state.selectedModelId === 'none' || isDraggingOver) && (
          <div
            className={`pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center transition-opacity duration-150 ${
              state.rightSidebarOpen && state.textureViewerMode !== 'split'
                ? 'pr-[360px]'
                : ''
            } ${
              isDraggingOver
                ? 'bg-blue-500/10 border-4 border-dashed border-blue-500'
                : ''
            }`}
          >
            <div
              className={`text-center px-6 py-8 rounded-2xl ${
                isLightViewport ? 'text-neutral-900' : 'text-zinc-100'
              }`}
            >
              <h2 className="text-[28px] font-semibold tracking-tight mb-3">
                Drag a glTF or GLB here!
              </h2>
              <p
                className={`text-[15px] mb-2 ${
                  isLightViewport ? 'text-neutral-600' : 'text-zinc-300'
                }`}
              >
                Groups, folders, and Zip archives supported
              </p>
              <p
                className={`text-[15px] mb-6 ${
                  isLightViewport ? 'text-neutral-600' : 'text-zinc-300'
                }`}
              >
                Drop an HDR for lighting
              </p>

              <div className="pointer-events-auto inline-flex flex-wrap items-center justify-center gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => onUpdateState({ selectedModelId: 'chronograph' })}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Load Tourbillon Caliber
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateState({ selectedModelId: 'drone' })}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-[#18181b] hover:bg-[#27272a] text-zinc-100 rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Load Survey Quadrotor
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateState({ selectedModelId: 'turbopump' })}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-[#18181b] hover:bg-[#27272a] text-zinc-100 rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Load UHV Turbopump
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Interactive 3D Projected Surface Hotspots */}
        {state.selectedModelId !== 'none' && (
          <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
            {projectedHotspots.map((hs, idx) => {
              if (!hs.visible || hs.screenX === undefined || hs.screenY === undefined) {
                return null;
              }
              const isSelected = state.activeHotspotId === hs.id;
              return (
                <div
                  key={hs.id}
                  style={{
                    transform: `translate3d(${Math.round(hs.screenX)}px, ${Math.round(
                      hs.screenY
                    )}px, 0)`,
                  }}
                  className="pointer-events-auto absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 group"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateState({
                        activeHotspotId: isSelected ? null : hs.id,
                      });
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold font-mono-tabular border-2 transition-transform duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-[#3b82f6] text-white border-white scale-110 shadow-md'
                        : 'bg-[#141417]/95 text-white border-white/80 hover:scale-110'
                    }`}
                    title={hs.label}
                  >
                    {idx + 1}
                  </button>

                  {isSelected && (
                    <div className="absolute left-10 top-1/2 -translate-y-1/2 w-60 bg-[#141417] text-zinc-100 border border-[#27272a] rounded-xl p-3 shadow-xl text-left">
                      <div className="text-xs font-semibold text-white mb-0.5">
                        {hs.label}
                      </div>
                      <div className="text-[11px] text-zinc-300 leading-snug">
                        {hs.detail}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Hotspot Placement Active Banner */}
        {state.hotspotPlacementMode && (
          <div className="pointer-events-auto absolute top-16 left-4 z-20 bg-[#3b82f6] text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-3 text-xs font-medium">
            <span>Tap or click any surface on the 3D model to pin a Hotspot</span>
            <button
              type="button"
              onClick={() => onUpdateState({ hotspotPlacementMode: false })}
              className="min-h-[32px] px-2.5 py-1 bg-black/25 hover:bg-black/40 rounded-lg text-[11px] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* WebGL Context Lost Fallback */}
        {webglLost && (
          <div className="absolute inset-0 z-30 bg-[#141417] text-white flex flex-col items-center justify-center p-6 text-center">
            <p className="text-base font-semibold mb-2">
              WebGL Rendering Context Suspended
            </p>
            <p className="text-xs text-zinc-400 max-w-md mb-4">
              The browser reclaimed the GPU context. Tap below to restore the 3D
              studio viewport.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-5 py-2.5 bg-[#3b82f6] text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              Reload 3D Viewport
            </button>
          </div>
        )}
      </div>
    );
  }
);
