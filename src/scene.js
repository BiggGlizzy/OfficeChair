// scene.js

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { rotation, move } from './controller.js';
import { onStart, updateSpeed, onLightChange } from "./ui.js";
import { ADDITION, SUBTRACTION, Brush, Evaluator } from 'three-bvh-csg';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5);

const colliders = [];
const desks = [];

let waterDispenserTemplate = null;
const dispenserSpawnPoints = [];

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(6, 6, 6);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, 1)
);

document.body.appendChild(renderer.domElement);

// ─────────────────────────────────────────────
// RAYCASTER
// ─────────────────────────────────────────────

const raycaster =
  new THREE.Raycaster();

const mouse =
  new THREE.Vector2();

const controls = new OrbitControls(
  camera,
  renderer.domElement
);

controls.enableZoom = true;
controls.minDistance = 2;
controls.maxDistance = 50;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;

scene.add(
  new THREE.AmbientLight(0xffffff, 0.5)
);

const light = new THREE.DirectionalLight(
  0xffffff,
  1
);

light.position.set(5, 10, 5);

light.castShadow = true;

light.shadow.camera.left = -60;
light.shadow.camera.right = 60;
light.shadow.camera.top = 60;
light.shadow.camera.bottom = -60;
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 200;

light.shadow.mapSize.width = 1024;
light.shadow.mapSize.height = 1024;

scene.add(light);

onLightChange(({colour, brightness, angle}) =>{
  light.color.set(colour);
  light.intensity = brightness

  const rad = (angle * Math.PI) / 180;
  const radius = 10;
  light.position.set(
      Math.cos(rad) * radius, 10, Math.sin(rad) * radius
  );
});

// ─────────────────────────────────────────────
// Textures
// ─────────────────────────────────────────────

const texLoader = new THREE.TextureLoader();

// ─────────────────────────────────────────────
// LOW QUALITY WALL TEXTURE
// ─────────────────────────────────────────────

const wallTexture = texLoader.load(
  'textures/wall_texture.jpg'
);

wallTexture.wrapS = THREE.RepeatWrapping;
wallTexture.wrapT = THREE.RepeatWrapping;

// Lower repeat = blurrier / cheaper
wallTexture.repeat.set(1, 1);

// Disable anisotropic filtering
wallTexture.anisotropy = 0;

// Cheapest filtering possible
wallTexture.magFilter = THREE.NearestFilter;
wallTexture.minFilter = THREE.NearestFilter;

wallTexture.generateMipmaps = false;

// ─────────────────────────────────────────────
// LOW QUALITY FLOOR TEXTURE
// ─────────────────────────────────────────────

const woodTexture = texLoader.load(
  'wood_floor/wood_floor_deck_diff_4k.jpg'
);

woodTexture.wrapS = THREE.RepeatWrapping;
woodTexture.wrapT = THREE.RepeatWrapping;

// Lower detail repetition
woodTexture.repeat.set(1, 1);

woodTexture.anisotropy = 0;

woodTexture.magFilter = THREE.NearestFilter;
woodTexture.minFilter = THREE.NearestFilter;

woodTexture.generateMipmaps = false;

const carpetTexture = texLoader.load(
  'textures/carpet.jpg'
);

carpetTexture.wrapS = THREE.RepeatWrapping;
carpetTexture.wrapT = THREE.RepeatWrapping;
carpetTexture.repeat.set(1, 1);
carpetTexture.anisotropy = 0;
carpetTexture.magFilter = THREE.NearestFilter;
carpetTexture.minFilter = THREE.NearestFilter;
carpetTexture.generateMipmaps = false;

// ─────────────────────────────────────────────

const wallHeight = 4;

// Cheaper material than standard
const wallMat = new THREE.MeshLambertMaterial({
  map: wallTexture
});

const woodFloorMat = new THREE.MeshLambertMaterial({
  map: woodTexture
});

const carpetFloorMat = new THREE.MeshLambertMaterial({
  map: carpetTexture
});

const cubeLoader = new THREE.CubeTextureLoader();
cubeLoader.setPath('textures/skycube/');
const skyboxTexture = cubeLoader.load([
  'px.png', 'nx.png',
  'py.png', 'ny.png',
  'pz.png', 'nz.png'
]);
scene.background = skyboxTexture;
// ─────────────────────────────────────────────
// Room generation
// ─────────────────────────────────────────────

const CELL = 4;
const floorSurfaceByCell = new Map();

function randomFloorSurface() {

  return Math.random() < 0.5
    ? 'wood'
    : 'carpet';
}

function rndInt(min, max) {

  return Math.floor(
    Math.random() * (max - min + 1)
  ) + min;
}

function generateRoomCells() {

  const cells = new Set();

  const mark = (cx, cz, surfaceType) => {

    const key = `${cx},${cz}`;

    if (!cells.has(key)) {

      cells.add(key);
      floorSurfaceByCell.set(key, surfaceType);
    }
  };

  const has = (cx, cz) => {
    return cells.has(`${cx},${cz}`);
  };

  const baseSurface = randomFloorSurface();

  const baseW = rndInt(3, 5);
  const baseD = rndInt(3, 5);

  const offX = -Math.floor(baseW / 2);
  const offZ = -Math.floor(baseD / 2);

  for (let cx = offX; cx < offX + baseW; cx++) {

    for (let cz = offZ; cz < offZ + baseD; cz++) {
      mark(cx, cz, baseSurface);
    }
  }

  const wingCount = rndInt(1, 3);

  for (let w = 0; w < wingCount; w++) {

    const wingSurface = randomFloorSurface();

    const list = [...cells];

    const pivot = list[
      Math.floor(Math.random() * list.length)
    ].split(',').map(Number);

    const dirs = [
      [1,0],
      [-1,0],
      [0,1],
      [0,-1]
    ];

    const dir =
      dirs[Math.floor(Math.random() * dirs.length)];

    const wW = rndInt(2, 4);
    const wD = rndInt(2, 4);

    const startX = pivot[0] + dir[0];
    const startZ = pivot[1] + dir[1];

    for (let cx = startX; cx < startX + wW; cx++) {

      for (let cz = startZ; cz < startZ + wD; cz++) {

        if (!has(cx, cz)) {
          mark(cx, cz, wingSurface);
        }
      }
    }
  }

  return cells;
}

const roomCells = generateRoomCells();

for (const key of roomCells) {

  const [cx, cz] = key.split(',').map(Number);

  const surfaceType =
    floorSurfaceByCell.get(key) || 'wood';

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(CELL, CELL),
    surfaceType === 'carpet'
      ? carpetFloorMat
      : woodFloorMat
  );

  floor.rotation.x = -Math.PI / 2;

  floor.position.set(
    cx * CELL + CELL / 2,
    0,
    cz * CELL + CELL / 2
  );

  floor.receiveShadow = true;

  scene.add(floor);
  
  const ceiling = new THREE.Mesh(

    new THREE.PlaneGeometry(
      CELL,
      CELL
    ),

    new THREE.MeshLambertMaterial({
      color: 0xffffff
    })

  );

  ceiling.rotation.x =
    Math.PI / 2;

  ceiling.position.set(
    cx * CELL + CELL / 2,
    wallHeight,
    cz * CELL + CELL / 2
  );

  ceiling.receiveShadow = true;

  scene.add(ceiling);
}

// ─────────────────────────────────────────────
// Walls
// ─────────────────────────────────────────────

const wallThickness = 0.3;
const wallSpawnCandidates = [];

const neighbours = {
  px: [1,0],
  nx: [-1,0],
  pz: [0,1],
  nz: [0,-1]
};

const windowSize = Math.random() * 0.7 + 0.7;
const windowRate = Math.random() * 0.5 + 0.3;

function placeWall(cx, cz, side) {

  const wx = cx * CELL + CELL / 2;
  const wz = cz * CELL + CELL / 2;

  let wall;

  if (side === 'px' || side === 'nx') {

    wall = new THREE.Mesh(
      new THREE.BoxGeometry(
        wallThickness,
        wallHeight,
        CELL
      ),
      wallMat
    );

    wall.position.set(
      wx + (side === 'px' ? CELL / 2 : -CELL / 2),
      wallHeight / 2,
      wz
    );

  } else {

    wall = new THREE.Mesh(
      new THREE.BoxGeometry(
        CELL,
        wallHeight,
        wallThickness
      ),
      wallMat
    );

    wall.position.set(
      wx,
      wallHeight / 2,
      wz + (side === 'pz' ? CELL / 2 : -CELL / 2)
    );
  }

  wall.updateMatrixWorld();

  wall.receiveShadow = true;
  if(Math.random() > windowRate) {
    let wall2 = new Brush(
      wall.geometry,
      wallMat
    );
    wall2.position.copy(wall.position);
    wall2.updateMatrixWorld(wall2);
    let hole = new Brush(
        new THREE.BoxGeometry(
          windowSize,
          1.3,
          windowSize
        ),
        wallMat
    );
    hole.position.set(
      wall.position.x,
      wallHeight / 2,
      wall.position.z
    );
    hole.updateMatrixWorld();

    let evaluator = new Evaluator();
    let result = evaluator.evaluate(wall2, hole, SUBTRACTION);

    scene.add(result);
  } else {
    scene.add(wall);
  }

  wallSpawnCandidates.push({
    x: wall.position.x,
    z: wall.position.z,
    side
  });
  // scene.add(wall);

  colliders.push(wall);
}

for (const key of roomCells) {

  const [cx, cz] = key.split(',').map(Number);

  for (const [side, [dx, dz]] of Object.entries(neighbours)) {

    if (!roomCells.has(`${cx + dx},${cz + dz}`)) {
      placeWall(cx, cz, side);
    }
  }
}

const dispenserCount =
  Math.random() < 0.5 ? 1 : 2;

for (let i = 0; i < dispenserCount; i++) {

  const wall =
    wallSpawnCandidates[
      Math.floor(
        Math.random() *
        wallSpawnCandidates.length
      )
    ];

  dispenserSpawnPoints.push(wall);
}
// ─────────────────────────────────────────────
// Room bounds
// ─────────────────────────────────────────────

let minX = Infinity;
let maxX = -Infinity;

let minZ = Infinity;
let maxZ = -Infinity;

for (const key of roomCells) {

  const [cx, cz] = key.split(',').map(Number);

  minX = Math.min(minX, cx * CELL);
  maxX = Math.max(maxX, cx * CELL + CELL);

  minZ = Math.min(minZ, cz * CELL);
  maxZ = Math.max(maxZ, cz * CELL + CELL);
}

function inside(x, z) {

  return roomCells.has(
    `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`
  );
}

function getFloorSurfaceAt(x, z) {

  const key =
    `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;

  return floorSurfaceByCell.get(key) || 'wood';
}

function getSurfaceFrictionFactor(x, z) {

  return getFloorSurfaceAt(x, z) === 'carpet'
    ? 0.95
    : 1;
}

// ─────────────────────────────────────────────
// Desk layout
// ─────────────────────────────────────────────

const DESK_W = 1.5;
const DESK_D = 1.0;

const DESK_GAP_X = 0.3;
const DESK_GAP_Z = 1.8;

const SPAWN_CLEAR = 2.5;

const placedAABBs = [];
const spawnPoints = [];

function overlapsAny(
  ax1,
  ax2,
  az1,
  az2,
  margin = 0.3
) {

  for (const b of placedAABBs) {

    if (
      ax1 < b.maxX + margin &&
      ax2 > b.minX - margin &&
      az1 < b.maxZ + margin &&
      az2 > b.minZ - margin
    ) {
      return true;
    }
  }

  return false;
}

function tryPlaceDeskAt(x, z, angle) {

  const rotated =
    angle === Math.PI / 2 ||
    angle === Math.PI * 1.5;

  const hx =
    (rotated ? DESK_D : DESK_W) / 2;

  const hz =
    (rotated ? DESK_W : DESK_D) / 2;

  if (!inside(x, z)) return false;

  if (Math.hypot(x, z) < SPAWN_CLEAR) {
    return false;
  }

  if (
    !inside(x - hx - 0.3, z) ||
    !inside(x + hx + 0.3, z) ||
    !inside(x, z - hz - 0.3) ||
    !inside(x, z + hz + 0.3)
  ) {
    return false;
  }

  if (
    overlapsAny(
      x - hx,
      x + hx,
      z - hz,
      z + hz
    )
  ) {
    return false;
  }

  spawnPoints.push({
    x,
    z,
    angle
  });

  placedAABBs.push({
    minX: x - hx,
    maxX: x + hx,
    minZ: z - hz,
    maxZ: z + hz
  });

  return true;
}

const roomW = maxX - minX;

const DESKS_PER_ROW = Math.max(
  1,
  Math.min(
    3,
    Math.floor(roomW / 8)
  )
);

const BAY_ANGLES = [
  0,
  Math.PI / 2
];

const bayStepX =
  DESKS_PER_ROW *
  (DESK_W + DESK_GAP_X) +
  4;

const bayStepZ =
  DESK_D * 2 +
  DESK_GAP_Z +
  4;

const floorArea =
  roomCells.size * CELL * CELL;

const MAX_DESKS =
  Math.floor(floorArea / 14);

outer:
for (
  let bx = minX + 1.5;
  bx < maxX - 1.5;
  bx += bayStepX
) {

  for (
    let bz = minZ + 1.5;
    bz < maxZ - 1.5;
    bz += bayStepZ
  ) {

    if (spawnPoints.length >= MAX_DESKS) {
      break outer;
    }

    const angle =
      BAY_ANGLES[
        Math.floor(Math.random() * BAY_ANGLES.length)
      ];

    const rotated =
      angle === Math.PI / 2;

    // Front row
    for (let col = 0; col < DESKS_PER_ROW; col++) {

      const dx =
        rotated ? 0 :
        col * (DESK_W + DESK_GAP_X);

      const dz =
        rotated ?
        col * (DESK_W + DESK_GAP_X) :
        0;

      tryPlaceDeskAt(
        bx + dx,
        bz + dz,
        angle
      );
    }

    // Back row
    const backAngle = angle + Math.PI;

    for (let col = 0; col < DESKS_PER_ROW; col++) {

      const dx =
        rotated ? 0 :
        col * (DESK_W + DESK_GAP_X);

      const dz =
        rotated ?
        col * (DESK_W + DESK_GAP_X) :
        0;

      const boX =
        rotated ?
        (DESK_D + DESK_GAP_Z) :
        0;

      const boZ =
        rotated ?
        0 :
        (DESK_D + DESK_GAP_Z);

      tryPlaceDeskAt(
        bx + dx + boX,
        bz + dz + boZ,
        backAngle
      );
    }
  }
}

// ─────────────────────────────────────────────
// GLTF Loader
// ─────────────────────────────────────────────

const gltfLoader = new GLTFLoader();

let computerTemplate = null;

const pendingComputers = [];

// ─────────────────────────────────────────────
// Computer spawning
// ─────────────────────────────────────────────

function attachComputer(deskScene, sp) {

  if (!computerTemplate) {

    pendingComputers.push({
      deskScene,
      sp
    });

    return;
  }

  spawnComputerOnDesk(deskScene, sp);
}

// ─────────────────────────────────────────────
// LAMPS
// ─────────────────────────────────────────────

const lamps = [];

let lampTemplate = null;

function setLampOn(lampData, isOn) {

  lampData.isOn = isOn;

  lampData.light.visible = isOn;

  lampData.light.intensity =
    isOn
      ? lampData.lightPower
      : 0;
}

function getClickedLamp(object) {

  let current = object;

  while (current) {

    if (current.userData.lamp) {
      return current.userData.lamp;
    }

    current = current.parent;
  }

  return null;
}

function spawnLamp(deskScene, sp) {

  if (!lampTemplate) return;

  const lampScene =
    lampTemplate.clone(true);

  // ─────────────────────────────
  // SCALE
  // ─────────────────────────────

  const rawBox =
    new THREE.Box3()
      .setFromObject(lampScene);

  const rawSize =
    new THREE.Vector3();

  rawBox.getSize(rawSize);

  const scaleFactor =
    0.65 /
    Math.max(rawSize.x, rawSize.z);

  lampScene.scale.set(
    scaleFactor,
    scaleFactor,
    scaleFactor
  );

  lampScene.updateMatrixWorld(true);

  const scaledBox =
    new THREE.Box3()
      .setFromObject(lampScene);

  const scaledSize =
    new THREE.Vector3();

  scaledBox.getSize(scaledSize);

// ─────────────────────────────
// FLOOR POSITION
// ─────────────────────────────

const spread = 1.2;

const offX =
  (Math.random() - 0.5) * spread;

const offZ =
  (Math.random() - 0.5) * spread;

// Slightly above floor
const spawnY = 0.35;

lampScene.position.set(
  sp.x + offX,
  spawnY,
  sp.z + offZ
);

  lampScene.rotation.y =
    Math.random() * Math.PI * 2;

  lampScene.traverse((child) => {

    if (child.isMesh) {

      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // ─────────────────────────────
  // LIGHT
  // ─────────────────────────────

  const lampLight =
    new THREE.PointLight(
      0xfff1b0,
      1.4,
      7
    );

  lampLight.position.set(
    0,
    0.5,
    0
  );

  lampScene.add(lampLight);

  // ─────────────────────────────
  // DATA
  // ─────────────────────────────

  const lampData = {

    mesh: lampScene,

    light: lampLight,

    isOn: true,

    lightPower: 1.4,

    vx: 0,
    vy: 0,
    vz: 0,

    rotVX: 0,
    rotVZ: 0,

    angularVelocity: 0,

    friction: 0.90,
    angularFriction: 0.92,

    halfW: scaledSize.x * 0.35,
    halfD: scaledSize.z * 0.35,
    halfH: scaledSize.y * 0.45,

    bottomOffset:
      scaledSize.y * 0.5,

    grounded: true,

    isLamp: true
  };

  lampScene.userData.lamp =
    lampData;

  lamps.push(lampData);

  // IMPORTANT:
  // put into desks physics array
  desks.push(lampData);

  scene.add(lampScene);
}



function spawnComputerOnDesk(deskScene, sp) {

  const comp =
    computerTemplate.clone(true);

  // Scale
  const rawBox =
    new THREE.Box3().setFromObject(comp);

  const rawSize =
    new THREE.Vector3();

  rawBox.getSize(rawSize);

  const compScale =
    0.5 / Math.max(rawSize.x, rawSize.z);

  comp.scale.set(
    compScale,
    compScale,
    compScale
  );

  // IMPORTANT
  comp.updateMatrixWorld(true);

  // Final scaled size
  const scaledBox =
    new THREE.Box3().setFromObject(comp);

  const scaledSize =
    new THREE.Vector3();

  scaledBox.getSize(scaledSize);

  const deskBox =
    new THREE.Box3().setFromObject(deskScene);

  const offsetBack =
    (DESK_D / 2) * 0.35;

  const backX =
    -Math.sin(sp.angle) * offsetBack;

  const backZ =
    -Math.cos(sp.angle) * offsetBack;

  comp.rotation.y =
    sp.angle + Math.PI;

  const spawnY =
    deskBox.max.y +
    scaledSize.y * 0.5 +
    0.01;

  comp.position.set(
    sp.x + backX,
    spawnY,
    sp.z + backZ
  );

  comp.traverse((child) => {

    if (child.isMesh) {

      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  scene.add(comp);

  desks.push({

    mesh: comp,

    vx: 0,
    vy: 0,
    vz: 0,

    angularVelocity: 0,

    friction: 0.85,
    angularFriction: 0.88,

    halfW: scaledSize.x * 0.35,
    halfD: scaledSize.z * 0.35,
    halfH: scaledSize.y * 0.45,

    grounded: true,

    isComputer: true
  });
}

function spawnWaterDispensers() {

  if (!waterDispenserTemplate)
    return;

  for (const sp of dispenserSpawnPoints) {

    const disp =
      waterDispenserTemplate.clone(true);

    const bbox =
      new THREE.Box3()
        .setFromObject(disp);

    const size =
      new THREE.Vector3();

    bbox.getSize(size);

    const scale =
      1.2 / Math.max(size.x, size.z);

    disp.scale.set(
      scale,
      scale,
      scale
    );

    disp.updateMatrixWorld(true);

    const finalBox =
      new THREE.Box3()
        .setFromObject(disp);

    const finalSize =
      new THREE.Vector3();

    finalBox.getSize(finalSize);

    let x = sp.x;
    let z = sp.z;

    let rot = 0;
    const offset = 0.25;

    switch (sp.side) {

      case 'px':
        x -= offset;
        rot = -Math.PI / 2;
        break;

      case 'nx':
        x += offset;
        rot = Math.PI / 2;
        break;

      case 'pz':
        z -= offset;
        rot = Math.PI;
        break;

      case 'nz':
        z += offset;
        rot = 0;
        break;
    }

    disp.position.set(
      x,
      0,
      z
    );

    disp.rotation.y = rot;

    disp.traverse((child) => {

      if (child.isMesh) {

        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(disp);

    desks.push({

      mesh: disp,

      vx: 0,
      vy: 0,
      vz: 0,

      angularVelocity: 0,

      friction: 0.92,
      angularFriction: 0.95,

      halfW: finalSize.x * 0.5,
      halfD: finalSize.z * 0.5,
      halfH: finalSize.y * 0.5,

      bottomOffset: finalSize.y * 0.5,

      grounded: false,

      isWaterDispenser: true
    });
  }
}

// ─────────────────────────────────────────────
// Load computer
// ─────────────────────────────────────────────

gltfLoader.load(
  'retro_computer/scene.gltf',

  (gltf) => {

    const t = gltf.scene;

    const bbox =
      new THREE.Box3().setFromObject(t);

    const center =
      new THREE.Vector3();

    bbox.getCenter(center);

    t.position.sub(center);

    computerTemplate = t;

    for (const item of pendingComputers) {

      spawnComputerOnDesk(
        item.deskScene,
        item.sp
      );
    }

    pendingComputers.length = 0;
  }
);
// ─────────────────────────────────────────────
// LOAD LAMP TEMPLATE
// ─────────────────────────────────────────────

gltfLoader.load(
  'table_lamp_01/scene.gltf',

  (gltf) => {

    lampTemplate = gltf.scene;

    const bbox =
      new THREE.Box3()
        .setFromObject(lampTemplate);

    const center =
      new THREE.Vector3();

    bbox.getCenter(center);

    lampTemplate.position.sub(center);
  }
);

gltfLoader.load(
  'water_dispenser/water.gltf',

  (gltf) => {

    waterDispenserTemplate =
      gltf.scene;

    const bbox =
      new THREE.Box3()
        .setFromObject(
          waterDispenserTemplate
        );

    const center =
      new THREE.Vector3();

    bbox.getCenter(center);

    waterDispenserTemplate.position.sub(
      center
    );

    spawnWaterDispensers();
  }
);

// ─────────────────────────────────────────────
// Load desks
// ─────────────────────────────────────────────

gltfLoader.load(
  'metal_table/metal_table.gltf',

  (gltf) => {

    const template = gltf.scene;

    const bbox =
      new THREE.Box3().setFromObject(template);

    const size =
      new THREE.Vector3();

    bbox.getSize(size);

    const scaleFactor =
      DESK_W / Math.max(size.x, size.z);

    const center =
      new THREE.Vector3();

    bbox.getCenter(center);

    template.position.sub(center);

    template.scale.set(
      scaleFactor,
      scaleFactor,
      scaleFactor
    );

    template.traverse((child) => {

      if (child.isMesh) {

        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    for (const sp of spawnPoints) {

      const deskScene =
        template.clone(true);

      const cloneBox =
        new THREE.Box3().setFromObject(deskScene);

      const cloneSize =
        new THREE.Vector3();

      cloneBox.getSize(cloneSize);

      deskScene.position.set(
        sp.x,
        cloneSize.y * scaleFactor * 0.5,
        sp.z
      );

      deskScene.rotation.y = sp.angle;

      scene.add(deskScene);

      desks.push({

        mesh: deskScene,

        vx: 0,
        vz: 0,

        angularVelocity: 0,

        friction: 0.88,
        angularFriction: 0.90,

        halfW: DESK_W / 2,
        halfD: DESK_D / 2,
        halfH: cloneSize.y * 0.5,

        isComputer: false
      });

      attachComputer(
        deskScene,
        sp
      );

      // Random lamp chance
      if (lampTemplate && Math.random() < 0.35) {

        spawnLamp(
          deskScene,
          sp
        );
      }
    }
  }
);

// ─────────────────────────────────────────────
// Physics
// ─────────────────────────────────────────────

function getDeskBox(d) {
  return new THREE.Box3().setFromObject(d.mesh);
}

function resolveDeskCollisions() {

  for (let i = 0; i < desks.length; i++) {

    for (let j = i + 1; j < desks.length; j++) {

      const a = desks[i];
      const b = desks[j];

      // ─────────────────────────────
      // Vertical separation
      // ─────────────────────────────

      const aTop =
        a.mesh.position.y + a.halfH;

      const aBottom =
        a.mesh.position.y - a.halfH;

      const bTop =
        b.mesh.position.y + b.halfH;

      const bBottom =
        b.mesh.position.y - b.halfH;

      const verticalOverlap =
        Math.min(aTop, bTop) -
        Math.max(aBottom, bBottom);

      // Ignore if stacked vertically
      if (verticalOverlap < 0.15) {
        continue;
      }

      // ─────────────────────────────
      // Horizontal overlap
      // ─────────────────────────────

      const dx =
        b.mesh.position.x -
        a.mesh.position.x;

      const dz =
        b.mesh.position.z -
        a.mesh.position.z;

      const overlapX =
        (a.halfW + b.halfW) -
        Math.abs(dx);

      const overlapZ =
        (a.halfD + b.halfD) -
        Math.abs(dz);

      if (
        overlapX <= 0 ||
        overlapZ <= 0
      ) continue;

      // ─────────────────────────────
      // Resolve smallest axis
      // ─────────────────────────────

      if (overlapX < overlapZ) {

        const push =
          overlapX * 0.5;

        const sign =
          Math.sign(dx) || 1;

        a.mesh.position.x -=
          sign * push;

        b.mesh.position.x +=
          sign * push;

        // Bounce X
        const temp = a.vx;

        a.vx = b.vx * 0.7;
        b.vx = temp * 0.7;

      } else {

        const push =
          overlapZ * 0.5;

        const sign =
          Math.sign(dz) || 1;

        a.mesh.position.z -=
          sign * push;

        b.mesh.position.z +=
          sign * push;

        // Bounce Z
        const temp = a.vz;

        a.vz = b.vz * 0.7;
        b.vz = temp * 0.7;
      }

      // ─────────────────────────────
      // Computer tumbling only
      // ─────────────────────────────

      if (a.isComputer) {

        a.rotVX =
          (a.rotVX || 0) +
          (Math.random() - 0.5) * 0.02;

        a.rotVZ =
          (a.rotVZ || 0) +
          (Math.random() - 0.5) * 0.02;
      }

      if (b.isComputer) {

        b.rotVX =
          (b.rotVX || 0) +
          (Math.random() - 0.5) * 0.02;

        b.rotVZ =
          (b.rotVZ || 0) +
          (Math.random() - 0.5) * 0.02;
      }
    }
  }
}

function keepInsideWalls(d) {

  const margin = 0.15;

  const minAllowedX =
    minX + d.halfW + margin;

  const maxAllowedX =
    maxX - d.halfW - margin;

  const minAllowedZ =
    minZ + d.halfD + margin;

  const maxAllowedZ =
    maxZ - d.halfD - margin;

  // X
  if (d.mesh.position.x < minAllowedX) {

    d.mesh.position.x = minAllowedX;

    if (d.vx < 0) {
      d.vx = 0;
    }
  }

  if (d.mesh.position.x > maxAllowedX) {

    d.mesh.position.x = maxAllowedX;

    if (d.vx > 0) {
      d.vx = 0;
    }
  }

  // Z
  if (d.mesh.position.z < minAllowedZ) {

    d.mesh.position.z = minAllowedZ;

    if (d.vz < 0) {
      d.vz = 0;
    }
  }

  if (d.mesh.position.z > maxAllowedZ) {

    d.mesh.position.z = maxAllowedZ;

    if (d.vz > 0) {
      d.vz = 0;
    }
  }
}

function updateDesks() {

  const GRAVITY = 0.008;
  const FLOOR_Y = 0;

  for (const d of desks) {

    // ─────────────────────────────────────────
    // POSITION
    // ─────────────────────────────────────────

    d.mesh.position.x += d.vx;
    d.mesh.position.z += d.vz;

    // ─────────────────────────────────────────
    // COMPUTERS
    // ─────────────────────────────────────────

    if (d.isComputer || d.isLamp) {

      // Gravity
      d.vy -= GRAVITY;

      d.mesh.position.y += d.vy;

      // Rotational tumbling
      d.rotVX = d.rotVX || 0;
      d.rotVZ = d.rotVZ || 0;

      d.mesh.rotation.x += d.rotVX;
      d.mesh.rotation.z += d.rotVZ;

      // Rotation damping
      d.rotVX *= 0.985;
      d.rotVZ *= 0.985;

      // ─────────────────────────────
      // FLOOR COLLISION
      // ─────────────────────────────

      const bottom =
        d.mesh.position.y -
        (d.bottomOffset || d.halfH);

      if (bottom <= FLOOR_Y) {

        if (d.isLamp) {

          d.mesh.position.y = 0;

        } else {

          d.mesh.position.y =
          FLOOR_Y + d.halfH;
        }

        // Bounce
        if (d.isLamp) {

          // Lamps do not bounce
          d.vy = 0;

        } else {

          // Computers still bounce slightly
          d.vy *= -0.25;
        }

        // Friction
        d.vx *= 0.92;
        d.vz *= 0.92;

        // Floor rotational friction
        d.rotVX *= 0.9;
        d.rotVZ *= 0.9;

        if (Math.abs(d.vy) < 0.01) {
          d.vy = 0;
        }
      }

      // ─────────────────────────────
      // TABLE TOP COLLISION
      // ─────────────────────────────

      for (const other of desks) {

        if (
          other === d ||
          other.isComputer ||
          other.isLamp
        ) continue;

        const deskBox =
          new THREE.Box3()
            .setFromObject(other.mesh);

        const compBox =
          new THREE.Box3()
            .setFromObject(d.mesh);

        const horizontallyInside =
          compBox.max.x > deskBox.min.x &&
          compBox.min.x < deskBox.max.x &&
          compBox.max.z > deskBox.min.z &&
          compBox.min.z < deskBox.max.z;

        if (!horizontallyInside) continue;

        const topY = deskBox.max.y;
        const compBottom = compBox.min.y;

        if (
          compBottom <= topY + 0.05 &&
          compBottom >= topY - 0.4 &&
          d.vy <= 0
        ) {

          d.mesh.position.y =
            topY +
            (d.bottomOffset || d.halfH);

          if (d.isLamp) {

          d.vy = 0;

        } else {

          d.vy *= -0.15;
        }

          // Surface friction
          d.vx *= 0.96;
          d.vz *= 0.96;

          // Stabilize rotation slowly
          d.rotVX *= 0.96;
          d.rotVZ *= 0.96;

          if (Math.abs(d.vy) < 0.01) {
            d.vy = 0;
          }
        }
      }
    }

    // ─────────────────────────────────────────
    // Y ROTATION
    // ─────────────────────────────────────────

    d.mesh.rotation.y += d.angularVelocity;

    d.angularVelocity *= d.angularFriction;

    if (Math.abs(d.angularVelocity) < 0.0001) {
      d.angularVelocity = 0;
    }

    // ─────────────────────────────────────────
    // LINEAR FRICTION
    // ─────────────────────────────────────────

    const surfaceFriction =
      getSurfaceFrictionFactor(
        d.mesh.position.x,
        d.mesh.position.z
      );

    d.vx *= d.friction * surfaceFriction;
    d.vz *= d.friction * surfaceFriction;

    if (Math.abs(d.vx) < 0.001) d.vx = 0;
    if (Math.abs(d.vz) < 0.001) d.vz = 0;
    keepInsideWalls(d);
  }

  // ─────────────────────────────────────────
  // OBJECT COLLISIONS
  // ─────────────────────────────────────────

  resolveDeskCollisions();
}

// ─────────────────────────────────────────────
// Main loop
// ─────────────────────────────────────────────

let started = false;

onStart(() => {
  started = true;
});

// ─────────────────────────────────────────────
// LAMP INTERACTION
// ─────────────────────────────────────────────

renderer.domElement.addEventListener(
  'click',

  (event) => {

    const rect =
      renderer.domElement.getBoundingClientRect();

    mouse.x =
      ((event.clientX - rect.left) / rect.width) * 2 - 1;

    mouse.y =
      -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(
      mouse,
      camera
    );

    const hits =
      raycaster.intersectObjects(
        scene.children,
        true
      );

    for (const hit of hits) {

      const lampData =
        getClickedLamp(hit.object);

      if (lampData) {

        setLampOn(
          lampData,
          !lampData.isOn
        );

        break;
      }
    }
  }
);

function animate() {

  requestAnimationFrame(animate);

  controls.update();

  if (started) {

    updateDesks();

    rotation();

    move(updateSpeed);
  }

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {

  camera.aspect =
    window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
});

export {
  scene,
  camera,
  renderer,
  colliders,
  desks,
  controls,
  getFloorSurfaceAt,
  getSurfaceFrictionFactor
};