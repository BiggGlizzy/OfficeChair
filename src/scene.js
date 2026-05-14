// scene.js

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { rotation, move } from './controller.js';
import { onStart, updateSpeed } from "./ui.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5);

const colliders = [];
const desks = [];

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

const floorTexture = texLoader.load(
  'wood_floor/wood_floor_deck_diff_4k.jpg'
);

floorTexture.wrapS = THREE.RepeatWrapping;
floorTexture.wrapT = THREE.RepeatWrapping;

// Lower detail repetition
floorTexture.repeat.set(1, 1);

floorTexture.anisotropy = 0;

floorTexture.magFilter = THREE.NearestFilter;
floorTexture.minFilter = THREE.NearestFilter;

floorTexture.generateMipmaps = false;

// ─────────────────────────────────────────────

const wallHeight = 4;

// Cheaper material than standard
const wallMat = new THREE.MeshLambertMaterial({
  map: wallTexture
});

const floorMat = new THREE.MeshLambertMaterial({
  map: floorTexture
});

// ─────────────────────────────────────────────
// Room generation
// ─────────────────────────────────────────────

const CELL = 4;

function rndInt(min, max) {

  return Math.floor(
    Math.random() * (max - min + 1)
  ) + min;
}

function generateRoomCells() {

  const cells = new Set();

  const mark = (cx, cz) => {
    cells.add(`${cx},${cz}`);
  };

  const has = (cx, cz) => {
    return cells.has(`${cx},${cz}`);
  };

  const baseW = rndInt(3, 5);
  const baseD = rndInt(3, 5);

  const offX = -Math.floor(baseW / 2);
  const offZ = -Math.floor(baseD / 2);

  for (let cx = offX; cx < offX + baseW; cx++) {

    for (let cz = offZ; cz < offZ + baseD; cz++) {
      mark(cx, cz);
    }
  }

  const wingCount = rndInt(1, 3);

  for (let w = 0; w < wingCount; w++) {

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
          mark(cx, cz);
        }
      }
    }
  }

  return cells;
}

const roomCells = generateRoomCells();

for (const key of roomCells) {

  const [cx, cz] = key.split(',').map(Number);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(CELL, CELL),
    floorMat
  );

  floor.rotation.x = -Math.PI / 2;

  floor.position.set(
    cx * CELL + CELL / 2,
    0,
    cz * CELL + CELL / 2
  );

  floor.receiveShadow = true;

  scene.add(floor);
}

// ─────────────────────────────────────────────
// Walls
// ─────────────────────────────────────────────

const wallThickness = 0.3;

const neighbours = {
  px: [1,0],
  nx: [-1,0],
  pz: [0,1],
  nz: [0,-1]
};

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

  wall.receiveShadow = true;

  scene.add(wall);

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

    halfW: scaledSize.x / 2,
    halfD: scaledSize.z / 2,
    halfH: scaledSize.y / 2,

    grounded: true,

    isComputer: true
  });
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

        isComputer: false
      });

      attachComputer(
        deskScene,
        sp
      );
    }
  }
);

// ─────────────────────────────────────────────
// Physics
// ─────────────────────────────────────────────

function getDeskBox(d) {
  return new THREE.Box3().setFromObject(d.mesh);
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

    if (d.isComputer) {

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

      // Floor collision
      const bottom =
        d.mesh.position.y - d.halfH;

      if (bottom <= FLOOR_Y) {

        d.mesh.position.y =
          FLOOR_Y + d.halfH;

        // Bounce
        d.vy *= -0.25;

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

      // Table collisions
      for (const other of desks) {

        if (
          other === d ||
          other.isComputer
        ) continue;

        const deskBox =
          new THREE.Box3().setFromObject(other.mesh);

        const compBox =
          new THREE.Box3().setFromObject(d.mesh);

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
            topY + d.halfH;

          d.vy *= -0.15;

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

    d.vx *= d.friction;
    d.vz *= d.friction;

    if (Math.abs(d.vx) < 0.001) d.vx = 0;
    if (Math.abs(d.vz) < 0.001) d.vz = 0;
  }
}

// ─────────────────────────────────────────────
// Main loop
// ─────────────────────────────────────────────

let started = false;

onStart(() => {
  started = true;
});

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
  desks
};