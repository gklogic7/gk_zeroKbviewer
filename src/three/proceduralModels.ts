import * as THREE from 'three';
import { Hotspot3D, ModelId } from '../types/studio';

export interface ProceduralModelBundle {
  group: THREE.Group;
  defaultHotspots: Hotspot3D[];
  title: string;
  subtitle: string;
}

/**
 * Helper to register a named sub-part in a composite THREE.Group with an explode vector
 * and base transform snapshot for silky-smooth exploded-view damping.
 */
function registerPart(
  group: THREE.Group,
  object: THREE.Object3D,
  name: string,
  explodeVector: [number, number, number]
) {
  object.name = name;
  object.userData.isModelPart = true;
  object.userData.basePosition = object.position.clone();
  object.userData.explodeVector = new THREE.Vector3(...explodeVector);

  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (!mesh.name) mesh.name = name;
      mesh.userData.partRootName = name;
      // Compute tangents only when index, position, normal, and uv attributes are all present
      if (
        mesh.geometry &&
        mesh.geometry.index !== null &&
        mesh.geometry.attributes.position &&
        mesh.geometry.attributes.normal &&
        mesh.geometry.attributes.uv
      ) {
        mesh.geometry.computeTangents();
      }
    }
  });

  group.add(object);
}

/**
 * MODEL 1: Horological Tourbillon Chronograph Movement (10 distinct parts)
 * Uses LatheGeometry, ExtrudeGeometry with bevels, TubeGeometry, and InstancedMesh (>20 perimeter screws & gear teeth)
 * Pivoted flush with the ground at Y = 0.
 */
function buildChronographModel(isSoftwareGl: boolean): ProceduralModelBundle {
  const root = new THREE.Group();
  root.name = 'Chronograph_Tourbillon_Caliber';

  // 1. Primary Silhouette: Stepped Brushed Titanium Case Bezel (LatheGeometry)
  const caseProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.42, 0.0),
    new THREE.Vector2(1.52, 0.08),
    new THREE.Vector2(1.52, 0.36),
    new THREE.Vector2(1.45, 0.44),
    new THREE.Vector2(1.32, 0.44),
    new THREE.Vector2(1.28, 0.14),
    new THREE.Vector2(0.0, 0.14),
  ];
  const caseGeo = new THREE.LatheGeometry(caseProfile, 64);
  const caseMat = new THREE.MeshPhysicalMaterial({
    color: 0x94a3b8,
    metalness: 0.92,
    roughness: 0.22,
    anisotropy: 0.75,
    clearcoat: 0.2,
  });
  const caseMesh = new THREE.Mesh(caseGeo, caseMat);
  registerPart(root, caseMesh, '01_Titanium_Chassis_Case', [0, -0.45, 0]);

  // 2. Primary Silhouette: Engine-Turned Rose Gold Mainplate
  const plateGeo = new THREE.CylinderGeometry(1.26, 1.26, 0.08, 64);
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.85,
    roughness: 0.52, // Varied roughness >= 0.25 from case
  });
  const plateMesh = new THREE.Mesh(plateGeo, plateMat);
  plateMesh.position.set(0, 0.18, 0);
  registerPart(root, plateMesh, '02_RoseGold_Mainplate', [0, -0.22, 0]);

  // 3. Secondary Read: Beveled Barrel & Train Bridges (ExtrudeGeometry)
  const bridgeGroup = new THREE.Group();
  bridgeGroup.position.set(0, 0.24, 0);

  const shape1 = new THREE.Shape();
  shape1.moveTo(-0.85, -0.45);
  shape1.lineTo(-0.15, -0.45);
  shape1.quadraticCurveTo(0.1, -0.45, 0.1, -0.1);
  shape1.lineTo(-0.85, 0.35);
  shape1.closePath();

  const extrudeSettings = {
    steps: 1,
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 3,
  };
  const bridgeGeo1 = new THREE.ExtrudeGeometry(shape1, extrudeSettings);
  bridgeGeo1.rotateX(-Math.PI / 2);

  const bridgeMat = new THREE.MeshPhysicalMaterial({
    color: 0x475569,
    metalness: 0.78,
    roughness: 0.18,
    clearcoat: 0.4,
  });
  const bridgeMesh1 = new THREE.Mesh(bridgeGeo1, bridgeMat);
  bridgeGroup.add(bridgeMesh1);

  const shape2 = new THREE.Shape();
  shape2.moveTo(0.2, -0.55);
  shape2.lineTo(0.88, -0.35);
  shape2.lineTo(0.88, 0.45);
  shape2.lineTo(0.25, 0.25);
  shape2.closePath();
  const bridgeGeo2 = new THREE.ExtrudeGeometry(shape2, extrudeSettings);
  bridgeGeo2.rotateX(-Math.PI / 2);
  const bridgeMesh2 = new THREE.Mesh(bridgeGeo2, bridgeMat);
  bridgeGroup.add(bridgeMesh2);

  registerPart(root, bridgeGroup, '03_Beveled_Movement_Bridges', [-0.25, 0.25, -0.15]);

  // 4. Secondary Read: Central Gear Train & Escape Wheels (Multi-Wheel Subassembly)
  const gearGroup = new THREE.Group();
  gearGroup.position.set(0, 0.29, 0);
  const brassGearMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbbf24,
    metalness: 0.95,
    roughness: 0.14,
    anisotropy: 0.8,
  });
  const steelPinionMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.9,
    roughness: 0.42,
  });

  const wheelConfigs = [
    { x: -0.45, z: 0.35, r: 0.36, teeth: 24 },
    { x: 0.42, z: -0.28, r: 0.31, teeth: 20 },
    { x: 0.0, z: 0.0, r: 0.28, teeth: 18 },
  ];

  wheelConfigs.forEach((cfg) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(cfg.r, 0.028, 16, 48),
      brassGearMat
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(cfg.x, 0.03, cfg.z);
    gearGroup.add(rim);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.14, 24),
      steelPinionMat
    );
    hub.position.set(cfg.x, 0.04, cfg.z);
    gearGroup.add(hub);

    // 4 spokes per gear
    for (let s = 0; s < 4; s++) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.r * 1.9, 0.025, 0.035),
        brassGearMat
      );
      spoke.position.set(cfg.x, 0.03, cfg.z);
      spoke.rotation.y = (s * Math.PI) / 2;
      gearGroup.add(spoke);
    }
  });

  // Instanced gear teeth across all 3 wheels (>60 teeth total)
  const totalTeeth = wheelConfigs.reduce((acc, w) => acc + w.teeth, 0);
  const toothGeo = new THREE.BoxGeometry(0.035, 0.04, 0.055);
  const teethInstanced = new THREE.InstancedMesh(toothGeo, brassGearMat, totalTeeth);
  teethInstanced.castShadow = true;
  teethInstanced.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let tIdx = 0;
  wheelConfigs.forEach((cfg) => {
    for (let i = 0; i < cfg.teeth; i++) {
      const angle = (i / cfg.teeth) * Math.PI * 2;
      dummy.position.set(
        cfg.x + Math.cos(angle) * (cfg.r + 0.025),
        0.03,
        cfg.z + Math.sin(angle) * (cfg.r + 0.025)
      );
      dummy.rotation.set(0, -angle, 0);
      dummy.updateMatrix();
      teethInstanced.setMatrixAt(tIdx++, dummy.matrix);
    }
  });
  teethInstanced.instanceMatrix.needsUpdate = true;
  teethInstanced.computeBoundingSphere();
  gearGroup.add(teethInstanced);

  registerPart(root, gearGroup, '04_Gold_Escape_Gear_Train', [0.2, 0.48, 0.15]);

  // 5. Secondary Read: Tourbillon Carriage & Spiral Hair-Spring (TubeGeometry)
  const tourbillonGroup = new THREE.Group();
  tourbillonGroup.position.set(0, 0.36, 0.56);

  const cageRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.024, 16, 48),
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.92,
      roughness: 0.15,
      clearcoat: 0.6,
    })
  );
  cageRing.rotation.x = Math.PI / 2;
  tourbillonGroup.add(cageRing);

  // Spiral hairspring curve via TubeGeometry
  const spiralPoints: THREE.Vector3[] = [];
  const turns = 3.5;
  const samples = 80;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const angle = t * turns * Math.PI * 2;
    const radius = 0.03 + t * 0.21;
    spiralPoints.push(new THREE.Vector3(Math.cos(angle) * radius, 0.02, Math.sin(angle) * radius));
  }
  const spiralCurve = new THREE.CatmullRomCurve3(spiralPoints);
  const spiralGeo = new THREE.TubeGeometry(spiralCurve, 72, 0.008, 8, false);
  const spiralMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    metalness: 0.95,
    roughness: 0.2,
  });
  const spiralMesh = new THREE.Mesh(spiralGeo, spiralMat);
  tourbillonGroup.add(spiralMesh);

  // Ruby jewel bearing at center
  const rubyMat = new THREE.MeshPhysicalMaterial({
    color: 0xe11d48,
    metalness: 0.1,
    roughness: 0.08,
    clearcoat: 1.0,
  });
  const rubyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 24), rubyMat);
  rubyMesh.position.y = 0.02;
  tourbillonGroup.add(rubyMesh);

  registerPart(root, tourbillonGroup, '05_Tourbillon_Cage_Hairspring', [0, 0.72, 0.35]);

  // 6. Accent Detail: 24 Blued-Steel Perimeter Bezel Screws & Hour Markers (InstancedMesh)
  const screwGroup = new THREE.Group();
  screwGroup.position.set(0, 0.44, 0);
  const screwGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.04, 16);
  const screwMat = new THREE.MeshPhysicalMaterial({
    color: 0x1d4ed8,
    metalness: 0.92,
    roughness: 0.16,
    clearcoat: 0.5,
  });
  const screwCount = 24;
  const screwInstanced = new THREE.InstancedMesh(screwGeo, screwMat, screwCount);
  screwInstanced.castShadow = true;
  screwInstanced.receiveShadow = true;
  const tintColor = new THREE.Color();

  for (let i = 0; i < screwCount; i++) {
    const angle = (i / screwCount) * Math.PI * 2;
    const radius = i % 2 === 0 ? 1.38 : 1.18;
    const scaleVar = 0.9 + (i % 3) * 0.08;
    dummy.position.set(Math.cos(angle) * radius, 0.01, Math.sin(angle) * radius);
    dummy.rotation.set(0, angle, 0);
    dummy.scale.setScalar(scaleVar);
    dummy.updateMatrix();
    screwInstanced.setMatrixAt(i, dummy.matrix);

    tintColor.setHSL(0.61 + (i % 4) * 0.012, 0.82, 0.45 + (i % 3) * 0.05);
    screwInstanced.setColorAt(i, tintColor);
  }
  screwInstanced.instanceMatrix.needsUpdate = true;
  if (screwInstanced.instanceColor) screwInstanced.instanceColor.needsUpdate = true;
  screwInstanced.computeBoundingSphere();
  screwGroup.add(screwInstanced);

  registerPart(root, screwGroup, '06_BluedSteel_Perimeter_Screws', [0, 0.88, 0]);

  // 7. Accent Detail: Chapter Ring & Chronograph Hands Assembly
  const handsGroup = new THREE.Group();
  handsGroup.position.set(0, 0.45, 0);

  const chapterRing = new THREE.Mesh(
    new THREE.RingGeometry(1.12, 1.27, 64),
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.4,
      roughness: 0.65,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  chapterRing.rotation.x = -Math.PI / 2;
  handsGroup.add(chapterRing);

  const handMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    metalness: 0.9,
    roughness: 0.12,
    clearcoat: 0.8,
  });
  const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.68), handMat);
  hourHand.position.set(-0.18, 0.04, -0.2);
  hourHand.rotation.y = Math.PI / 4;
  handsGroup.add(hourHand);

  const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.98), handMat);
  minuteHand.position.set(0.28, 0.06, -0.28);
  minuteHand.rotation.y = -Math.PI / 3;
  handsGroup.add(minuteHand);

  const chronoSecondMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    metalness: 0.6,
    roughness: 0.25,
  });
  const secondHand = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.02, 1.12), chronoSecondMat);
  secondHand.position.set(0, 0.08, 0.12);
  handsGroup.add(secondHand);

  registerPart(root, handsGroup, '07_Chronograph_Hands_ChapterRing', [0, 1.05, 0]);

  // 8. Accent Detail: Knurled Winding Crown & Chronograph Pushers
  const crownGroup = new THREE.Group();
  crownGroup.position.set(1.62, 0.24, 0);

  const crownMain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.22, 24),
    new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      metalness: 0.94,
      roughness: 0.2,
    })
  );
  crownMain.rotation.z = Math.PI / 2;
  crownGroup.add(crownMain);

  const pusher1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.09, 0.2, 20),
    caseMat
  );
  pusher1.rotation.z = Math.PI / 2;
  pusher1.position.set(-0.1, 0, -0.65);
  pusher1.rotation.y = 0.42;
  crownGroup.add(pusher1);

  const pusher2 = pusher1.clone();
  pusher2.position.set(-0.1, 0, 0.65);
  pusher2.rotation.y = -0.42;
  crownGroup.add(pusher2);

  registerPart(root, crownGroup, '08_Winding_Crown_And_Pushers', [0.65, 0.1, 0]);

  // 9. Accent Detail: Optical Anti-Reflective Sapphire Crystal Dome
  const crystalGeo = new THREE.CylinderGeometry(1.28, 1.31, 0.06, 64);
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    metalness: 0.0,
    roughness: 0.05,
    transmission: isSoftwareGl ? 0 : 0.92,
    transparent: true,
    opacity: isSoftwareGl ? 0.26 : 1.0,
    ior: 1.77,
    thickness: 0.35,
    clearcoat: 1.0,
    depthWrite: false,
  });
  const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
  crystalMesh.position.set(0, 0.56, 0);
  crystalMesh.renderOrder = 10;
  registerPart(root, crystalMesh, '09_Sapphire_Crystal_Dome', [0, 1.38, 0]);

  const defaultHotspots: Hotspot3D[] = [
    {
      id: 'hs-tourbillon',
      label: 'Flying Tourbillon Cage',
      detail: 'Titanium 60-second carriage with free-sprung Breguet overcoil hairspring.',
      position: [0.0, 0.42, 0.56],
      normal: [0, 1, 0],
    },
    {
      id: 'hs-gears',
      label: 'Isochronous Gear Train',
      detail: 'CNC-hobbed CuBe2 gold-plated escape wheels with ruby pallet bearings.',
      position: [-0.45, 0.36, 0.35],
      normal: [0, 1, 0],
    },
    {
      id: 'hs-crown',
      label: 'Twin-Gasket Screw Crown',
      detail: 'Double-sealed chronograph winding stem and column-wheel pushers.',
      position: [1.62, 0.26, 0.0],
      normal: [1, 0, 0],
    },
  ];

  return {
    group: root,
    defaultHotspots,
    title: 'Horological Tourbillon Caliber',
    subtitle: '9-Part Composite Mechanical Assembly · 84 Instanced Teeth & Fasteners',
  };
}

/**
 * MODEL 2: Autonomous Quad-Rotor Lidar Survey Drone (9 distinct parts)
 * Grounded at Y = 0 on tubular carbon landing skids.
 */
function buildDroneModel(isSoftwareGl: boolean): ProceduralModelBundle {
  const root = new THREE.Group();
  root.name = 'Autonomous_Survey_Quadrotor';

  // 1. Landing Skids (TubeGeometry flush with ground Y = 0)
  const skidGroup = new THREE.Group();
  const skidMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.65,
    roughness: 0.48,
  });

  [-0.58, 0.58].forEach((xOffset) => {
    const railCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(xOffset, 0.04, -0.95),
      new THREE.Vector3(xOffset, 0.04, 0.95),
    ]);
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(railCurve, 24, 0.038, 12, false),
      skidMat
    );
    skidGroup.add(rail);

    [-0.48, 0.48].forEach((zStrut) => {
      const strutCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(xOffset, 0.04, zStrut),
        new THREE.Vector3(xOffset * 0.55, 0.46, zStrut * 0.7),
      ]);
      const strut = new THREE.Mesh(
        new THREE.TubeGeometry(strutCurve, 16, 0.028, 10, false),
        skidMat
      );
      skidGroup.add(strut);
    });
  });
  registerPart(root, skidGroup, '01_Tubular_Carbon_Landing_Skids', [0, -0.55, 0]);

  // 2. Primary Silhouette: Aerodynamic Carbon Fuselage Core (ExtrudeGeometry with bevels)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-0.46, -0.78);
  hullShape.lineTo(0.46, -0.78);
  hullShape.lineTo(0.62, -0.15);
  hullShape.lineTo(0.42, 0.82);
  hullShape.lineTo(-0.42, 0.82);
  hullShape.lineTo(-0.62, -0.15);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    steps: 1,
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 4,
  });
  hullGeo.rotateX(-Math.PI / 2);
  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b,
    metalness: 0.35,
    roughness: 0.22,
    clearcoat: 0.65,
  });
  const hullMesh = new THREE.Mesh(hullGeo, hullMat);
  hullMesh.position.set(0, 0.46, 0);
  registerPart(root, hullMesh, '02_Monocoque_Carbon_Fuselage', [0, 0.0, 0]);

  // 3. Secondary Read: Anodized Avionics Upper Canopy Deck
  const canopyGeo = new THREE.BoxGeometry(0.76, 0.14, 1.24);
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0xf97316,
    metalness: 0.78,
    roughness: 0.24,
    clearcoat: 0.8,
  });
  const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
  canopyMesh.position.set(0, 0.78, -0.04);
  registerPart(root, canopyMesh, '03_Anodized_Avionics_Canopy', [0, 0.48, 0]);

  // 4. Secondary Read: 4 Foldable Carbon Motor Booms & Brushless Nacelles
  const boomsGroup = new THREE.Group();
  boomsGroup.position.set(0, 0.6, 0);
  const boomMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.55,
    roughness: 0.52,
  });
  const nacelleMat = new THREE.MeshPhysicalMaterial({
    color: 0x94a3b8,
    metalness: 0.92,
    roughness: 0.18,
  });

  const armPositions = [
    { x: -1.15, z: -1.05 },
    { x: 1.15, z: -1.05 },
    { x: -1.15, z: 1.05 },
    { x: 1.15, z: 1.05 },
  ];

  armPositions.forEach((pos) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(pos.x * 0.3, 0, pos.z * 0.3),
      new THREE.Vector3(pos.x, 0.08, pos.z),
    ]);
    const boomTube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 16, 0.045, 12, false),
      boomMat
    );
    boomsGroup.add(boomTube);

    const motorBell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.16, 0.18, 28),
      nacelleMat
    );
    motorBell.position.set(pos.x, 0.14, pos.z);
    boomsGroup.add(motorBell);
  });
  registerPart(root, boomsGroup, '04_Quad_Brushless_Motor_Booms', [0, 0.22, 0]);

  // 5. Secondary Read: 24 Instanced Rotor Blades & Copper Stator Coils (InstancedMesh)
  const rotorsGroup = new THREE.Group();
  rotorsGroup.position.set(0, 0.76, 0);

  const bladeGeo = new THREE.BoxGeometry(0.58, 0.014, 0.09);
  const bladeMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.4,
    roughness: 0.2,
    clearcoat: 0.9,
  });
  // 3 blades per motor * 4 motors = 12 blades + 24 copper stator coils = 36 instances
  const coilGeo = new THREE.BoxGeometry(0.04, 0.1, 0.06);
  const coilMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    metalness: 0.92,
    roughness: 0.25,
  });
  const coilInstanced = new THREE.InstancedMesh(coilGeo, coilMat, 32);
  coilInstanced.castShadow = true;

  const bladeInstanced = new THREE.InstancedMesh(bladeGeo, bladeMat, 12);
  bladeInstanced.castShadow = true;

  const dummy = new THREE.Object3D();
  let bIdx = 0;
  let cIdx = 0;

  armPositions.forEach((pos, armIdx) => {
    // 3 blades per rotor
    for (let b = 0; b < 3; b++) {
      const angle = (b / 3) * Math.PI * 2 + armIdx * 0.4;
      dummy.position.set(
        pos.x + Math.cos(angle) * 0.3,
        0.04,
        pos.z + Math.sin(angle) * 0.3
      );
      dummy.rotation.set(0.12, -angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bladeInstanced.setMatrixAt(bIdx++, dummy.matrix);
    }

    // 8 copper stator coils per motor
    for (let c = 0; c < 8; c++) {
      const angle = (c / 8) * Math.PI * 2;
      dummy.position.set(
        pos.x + Math.cos(angle) * 0.13,
        -0.04,
        pos.z + Math.sin(angle) * 0.13
      );
      dummy.rotation.set(0, -angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      coilInstanced.setMatrixAt(cIdx++, dummy.matrix);
    }
  });
  bladeInstanced.instanceMatrix.needsUpdate = true;
  bladeInstanced.computeBoundingSphere();
  coilInstanced.instanceMatrix.needsUpdate = true;
  coilInstanced.computeBoundingSphere();

  rotorsGroup.add(bladeInstanced);
  rotorsGroup.add(coilInstanced);
  registerPart(root, rotorsGroup, '05_TriBlade_Rotors_And_Stators', [0, 0.85, 0]);

  // 6. Accent Detail: 3-Axis Gimbal Camera Pod & Optical Glass Dome
  const gimbalGroup = new THREE.Group();
  gimbalGroup.position.set(0, 0.32, 0.68);

  const gimbalHousing = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.28,
    })
  );
  gimbalGroup.add(gimbalHousing);

  const lensBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.15, 0.16, 28),
    new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      metalness: 0.1,
      roughness: 0.05,
      transmission: isSoftwareGl ? 0 : 0.9,
      transparent: true,
      opacity: isSoftwareGl ? 0.45 : 1.0,
      ior: 1.6,
      clearcoat: 1.0,
      depthWrite: false,
    })
  );
  lensBarrel.rotation.x = Math.PI / 2;
  lensBarrel.position.z = 0.14;
  lensBarrel.renderOrder = 10;
  gimbalGroup.add(lensBarrel);

  registerPart(root, gimbalGroup, '06_Optical_Gimbal_Turret', [0, -0.25, 0.58]);

  // 7. Accent Detail: Top Solid-State LiDAR Puck (LatheGeometry)
  const lidarProfile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.26, 0),
    new THREE.Vector2(0.26, 0.18),
    new THREE.Vector2(0.22, 0.24),
    new THREE.Vector2(0, 0.24),
  ];
  const lidarMesh = new THREE.Mesh(
    new THREE.LatheGeometry(lidarProfile, 40),
    new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      metalness: 0.85,
      roughness: 0.12,
      clearcoat: 0.9,
    })
  );
  lidarMesh.position.set(0, 0.85, 0.15);
  registerPart(root, lidarMesh, '07_SolidState_LiDAR_Scanner', [0, 1.05, 0.15]);

  // 8. Accent Detail: Slide-In LiPo Smart Battery Pack
  const batteryMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.22, 0.65),
    new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.5,
      roughness: 0.55,
    })
  );
  batteryMesh.position.set(0, 0.58, -0.52);
  registerPart(root, batteryMesh, '08_Smart_LiPo_Battery_Module', [0, 0.1, -0.75]);

  const defaultHotspots: Hotspot3D[] = [
    {
      id: 'hs-lidar',
      label: '360° LiDAR Mapping Dome',
      detail: 'Dual-return 128-channel laser scanner for millimeter-grade terrain point clouds.',
      position: [0.0, 1.05, 0.15],
      normal: [0, 1, 0],
    },
    {
      id: 'hs-gimbal',
      label: '3-Axis Stabilized Optical Payload',
      detail: 'Medium-format 100MP RGB + thermal radiometric sensor on brushless direct-drive gimbal.',
      position: [0.0, 0.32, 0.88],
      normal: [0, 0, 1],
    },
    {
      id: 'hs-rotor',
      label: 'High-Efficiency Propulsion Nacelle',
      detail: 'Foldable carbon-fiber tri-blade propeller with FOC sinusoidal ESC telemetry.',
      position: [1.15, 0.82, 1.05],
      normal: [0, 1, 0],
    },
  ];

  return {
    group: root,
    defaultHotspots,
    title: 'Autonomous LiDAR Survey Quadrotor',
    subtitle: '8-Part Composite Aerospace Assembly · 44 Instanced Blades & Stator Coils',
  };
}

/**
 * MODEL 3: High-Vacuum Turbomolecular Pump Cutaway (8 distinct parts)
 * Grounded at Y = 0 on heavy machined cast-steel manifold base.
 */
function buildTurbopumpModel(isSoftwareGl: boolean): ProceduralModelBundle {
  const root = new THREE.Group();
  root.name = 'Turbomolecular_Vacuum_Pump';

  // 1. Primary Silhouette: Heavy Cast-Steel Lower Manifold Base (LatheGeometry at Y = 0)
  const baseProfile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(1.18, 0),
    new THREE.Vector2(1.18, 0.14),
    new THREE.Vector2(0.96, 0.22),
    new THREE.Vector2(0.96, 0.52),
    new THREE.Vector2(0, 0.52),
  ];
  const baseGeo = new THREE.LatheGeometry(baseProfile, 48);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.72,
    roughness: 0.54,
  });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  registerPart(root, baseMesh, '01_CastSteel_Manifold_Base', [0, -0.5, 0]);

  // 2. Primary Silhouette: Anodized Cooling Fin Stator Barrel
  const barrelGroup = new THREE.Group();
  barrelGroup.position.set(0, 0.52, 0);
  const barrelMat = new THREE.MeshPhysicalMaterial({
    color: 0x64748b,
    metalness: 0.88,
    roughness: 0.24,
    clearcoat: 0.3,
  });

  const coreCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.84, 0.84, 1.15, 48, 1, true),
    barrelMat
  );
  coreCylinder.position.y = 0.575;
  barrelGroup.add(coreCylinder);

  for (let f = 0; f < 6; f++) {
    const fin = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.032, 12, 48),
      barrelMat
    );
    fin.rotation.x = Math.PI / 2;
    fin.position.y = 0.18 + f * 0.16;
    barrelGroup.add(fin);
  }
  registerPart(root, barrelGroup, '02_Ribbed_Stator_Cooling_Housing', [0, 0.0, 0]);

  // 3. Secondary Read: High-Speed Magnetic Levitation Rotor Shaft
  const shaftMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbbf24,
    metalness: 0.94,
    roughness: 0.12,
    anisotropy: 0.8,
  });
  const shaftMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.38, 1.28, 40),
    shaftMat
  );
  shaftMesh.position.set(0, 1.14, 0);
  registerPart(root, shaftMesh, '03_MagLev_Titanium_Rotor_Core', [0, 0.45, 0]);

  // 4. Secondary Read: 48 Supersonic Angled Turbine Blades (InstancedMesh)
  const turbineGroup = new THREE.Group();
  turbineGroup.position.set(0, 1.15, 0);
  const bladeGeo = new THREE.BoxGeometry(0.42, 0.022, 0.14);
  const bladeMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    metalness: 0.95,
    roughness: 0.15,
    anisotropy: 0.7,
  });
  const stages = 3;
  const bladesPerStage = 16;
  const totalBlades = stages * bladesPerStage; // 48 instances
  const bladeInstanced = new THREE.InstancedMesh(bladeGeo, bladeMat, totalBlades);
  bladeInstanced.castShadow = true;
  bladeInstanced.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let idx = 0;
  for (let s = 0; s < stages; s++) {
    const yHeight = -0.32 + s * 0.32;
    for (let b = 0; b < bladesPerStage; b++) {
      const angle = (b / bladesPerStage) * Math.PI * 2;
      dummy.position.set(
        Math.cos(angle) * 0.56,
        yHeight,
        Math.sin(angle) * 0.56
      );
      dummy.rotation.set(0.52, -angle, 0);
      dummy.updateMatrix();
      bladeInstanced.setMatrixAt(idx++, dummy.matrix);
    }
  }
  bladeInstanced.instanceMatrix.needsUpdate = true;
  bladeInstanced.computeBoundingSphere();
  turbineGroup.add(bladeInstanced);
  registerPart(root, turbineGroup, '04_MultiStage_Turbine_Blades', [0, 0.78, 0]);

  // 5. Secondary Read: ConFlat Ultra-High-Vacuum Top Flange + 24 Bolts (InstancedMesh)
  const flangeGroup = new THREE.Group();
  flangeGroup.position.set(0, 1.68, 0);

  const flangeRing = new THREE.Mesh(
    new THREE.CylinderGeometry(1.12, 1.12, 0.16, 48),
    new THREE.MeshPhysicalMaterial({
      color: 0xcbd5e1,
      metalness: 0.92,
      roughness: 0.2,
    })
  );
  // Inner bore visual ring
  const innerBore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76, 0.76, 0.17, 48),
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.8,
      roughness: 0.4,
    })
  );
  flangeGroup.add(flangeRing);
  flangeGroup.add(innerBore);

  const boltGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.2, 12);
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    metalness: 0.9,
    roughness: 0.25,
  });
  const boltCount = 24;
  const boltInstanced = new THREE.InstancedMesh(boltGeo, boltMat, boltCount);
  for (let i = 0; i < boltCount; i++) {
    const angle = (i / boltCount) * Math.PI * 2;
    dummy.position.set(Math.cos(angle) * 0.98, 0.02, Math.sin(angle) * 0.98);
    dummy.rotation.set(0, angle, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    boltInstanced.setMatrixAt(i, dummy.matrix);
  }
  boltInstanced.instanceMatrix.needsUpdate = true;
  boltInstanced.computeBoundingSphere();
  flangeGroup.add(boltInstanced);

  registerPart(root, flangeGroup, '05_ConFlat_UHV_Inlet_Flange', [0, 1.18, 0]);

  // 6. Accent Detail: Foreline Exhaust Backing Port (TubeGeometry)
  const exhaustCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.85, 0.36, 0),
    new THREE.Vector3(1.35, 0.36, 0),
    new THREE.Vector3(1.48, 0.56, 0),
  ]);
  const exhaustTube = new THREE.Mesh(
    new THREE.TubeGeometry(exhaustCurve, 24, 0.14, 20, false),
    new THREE.MeshPhysicalMaterial({
      color: 0xd97706,
      metalness: 0.88,
      roughness: 0.22,
    })
  );
  registerPart(root, exhaustTube, '06_Foreline_Exhaust_Manifold', [0.65, 0, 0]);

  // 7. Accent Detail: Borosilicate Inspection bell dome
  const bellGeo = new THREE.CylinderGeometry(0.82, 0.82, 0.38, 48);
  const bellMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    metalness: 0,
    roughness: 0.06,
    transmission: isSoftwareGl ? 0 : 0.9,
    transparent: true,
    opacity: isSoftwareGl ? 0.3 : 1.0,
    ior: 1.52,
    thickness: 0.4,
    clearcoat: 1.0,
    depthWrite: false,
  });
  const bellMesh = new THREE.Mesh(bellGeo, bellMat);
  bellMesh.position.set(0, 1.92, 0);
  bellMesh.renderOrder = 10;
  registerPart(root, bellMesh, '07_Borosilicate_Vacuum_Bell', [0, 1.55, 0]);

  const defaultHotspots: Hotspot3D[] = [
    {
      id: 'hs-flange',
      label: 'DN200 ConFlat Knife-Edge Flange',
      detail: 'Copper-gasket sealed UHV inlet rated down to 10⁻¹¹ mbar operating pressure.',
      position: [0.98, 1.76, 0.0],
      normal: [0, 1, 0],
    },
    {
      id: 'hs-blades',
      label: '60,000 RPM Turbine Rotor Stages',
      detail: '5-axis machined high-strength aluminum alloy blades operating in molecular flow regime.',
      position: [0.0, 1.25, 0.65],
      normal: [0, 0, 1],
    },
    {
      id: 'hs-exhaust',
      label: 'KF-40 Foreline Backing Port',
      detail: 'Connects to dry scroll roughing pump for gas compression discharge.',
      position: [1.45, 0.48, 0.0],
      normal: [1, 0, 0],
    },
  ];

  return {
    group: root,
    defaultHotspots,
    title: 'UHV Turbomolecular Vacuum Pump',
    subtitle: '7-Part Composite Industrial Assembly · 72 Instanced Blades & Flange Bolts',
  };
}

export function createProceduralShowcaseModel(
  modelId: Exclude<ModelId, 'none' | 'custom-glb'>,
  isSoftwareGl: boolean
): ProceduralModelBundle {
  switch (modelId) {
    case 'drone':
      return buildDroneModel(isSoftwareGl);
    case 'turbopump':
      return buildTurbopumpModel(isSoftwareGl);
    case 'chronograph':
    default:
      return buildChronographModel(isSoftwareGl);
  }
}
