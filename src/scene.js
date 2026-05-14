// scene.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { rotation, move } from './controller.js';
import { onStart, updateSpeed } from "./ui.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5);

const colliders = [];  // static: walls only
const desks = [];      // dynamic: desks that can be knocked around

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(6, 6, 6);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = true;
controls.minDistance = 2;
controls.maxDistance = 50;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;

scene.add(new THREE.AmbientLight(0xffffff, 0.3));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
light.castShadow = true;
light.shadow.camera.left   = -60;
light.shadow.camera.right  =  60;
light.shadow.camera.top    =  60;
light.shadow.camera.bottom = -60;
light.shadow.camera.near   = 0.5;
light.shadow.camera.far    = 200;
light.shadow.mapSize.width  = 2048;
light.shadow.mapSize.height = 2048;
scene.add(light);


const loader = new THREE.TextureLoader(); 
const wallTexture = loader.load('textures/wall_texture.jpg');
wallTexture.wrapS = THREE.RepeatWrapping;
wallTexture.wrapT = THREE.RepeatWrapping;

const floorTexture = loader.load('textures/wood.jpg');
floorTexture.wrapS = THREE.RepeatWrapping;
floorTexture.wrapT = THREE.RepeatWrapping;

const wallHeight = 4;
const wallMat  = new THREE.MeshStandardMaterial({ map: wallTexture });
const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture });


const CELL = 4;

function rndInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRoomCells() {
  const cells = new Set();
  const mark = (cx, cz) => cells.add(`${cx},${cz}`);
  const has  = (cx, cz) => cells.has(`${cx},${cz}`);

  const baseW = rndInt(3, 5);
  const baseD = rndInt(3, 5);
  const offX  = -Math.floor(baseW / 2);
  const offZ  = -Math.floor(baseD / 2);

  for (let cx = offX; cx < offX + baseW; cx++)
    for (let cz = offZ; cz < offZ + baseD; cz++)
      mark(cx, cz);

  const wingCount = rndInt(1, 3);
  for (let w = 0; w < wingCount; w++) {
    const list  = [...cells];
    const pivot = list[Math.floor(Math.random() * list.length)].split(',').map(Number);
    const dirs  = [[1,0],[-1,0],[0,1],[0,-1]];
    const dir   = dirs[Math.floor(Math.random() * dirs.length)];
    const wW = rndInt(2, 4);
    const wD = rndInt(2, 4);
    const startX = pivot[0] + dir[0];
    const startZ = pivot[1] + dir[1];

    for (let cx = startX; cx < startX + wW; cx++)
      for (let cz = startZ; cz < startZ + wD; cz++)
        if (!has(cx, cz)) mark(cx, cz);
  }

  return cells;
}

const roomCells = generateRoomCells();

// Floor
for (const key of roomCells) {
  const [cx, cz] = key.split(',').map(Number);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(CELL, CELL), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx * CELL + CELL / 2, 0, cz * CELL + CELL / 2);
  floor.receiveShadow = true;
  scene.add(floor);
}

// Walls — static colliders
const wallThickness = 0.3;
const neighbours = { px: [1,0], nx: [-1,0], pz: [0,1], nz: [0,-1] };

function placeWall(cx, cz, side) {
  const wx = cx * CELL + CELL / 2;
  const wz = cz * CELL + CELL / 2;

  let wall;
  if (side === 'px' || side === 'nx') {
    wall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight, CELL),
      wallMat
    );
    wall.position.set(
      wx + (side === 'px' ? CELL / 2 : -CELL / 2),
      wallHeight / 2,
      wz
    );
  } else {
    wall = new THREE.Mesh(
      new THREE.BoxGeometry(CELL, wallHeight, wallThickness),
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

// Bounds
let minX = Infinity, maxX = -Infinity;
let minZ = Infinity, maxZ = -Infinity;

for (const key of roomCells) {
  const [cx, cz] = key.split(',').map(Number);
  minX = Math.min(minX, cx * CELL);
  maxX = Math.max(maxX, cx * CELL + CELL);
  minZ = Math.min(minZ, cz * CELL);
  maxZ = Math.max(maxZ, cz * CELL + CELL);
}

function inside(x, z) {
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  return roomCells.has(`${cx},${cz}`);
}

// ─── Desk spawn positions (calculated before model loads) ─────────────────────

const DESK_W      = 1.5;
const DESK_D      = 1.0;
const MIN_GAP     = 0.5;
const SPAWN_CLEAR = 2.5;
const CARDINALS   = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];

const placedAABBs = [];
const spawnPoints = []; // store {x, z, angle} then apply when model is ready

function overlapsAny(ax1, ax2, az1, az2) {
  for (const b of placedAABBs) {
    if (ax1 < b.maxX + MIN_GAP &&
        ax2 > b.minX - MIN_GAP &&
        az1 < b.maxZ + MIN_GAP &&
        az2 > b.minZ - MIN_GAP) {
      return true;
    }
  }
  return false;
}

const attempts = 300;
const maxDesks  = 15;

for (let i = 0; i < attempts && spawnPoints.length < maxDesks; i++) {
  const x = minX + Math.random() * (maxX - minX);
  const z = minZ + Math.random() * (maxZ - minZ);

  if (!inside(x, z)) continue;
  if (Math.hypot(x, z) < SPAWN_CLEAR) continue;

  const clearance = Math.max(DESK_W, DESK_D) / 2 + 0.4;
  if (!inside(x - clearance, z) || !inside(x + clearance, z) ||
      !inside(x, z - clearance) || !inside(x, z + clearance)) continue;

  const angle   = CARDINALS[Math.floor(Math.random() * 4)];
  const rotated = angle === Math.PI / 2 || angle === Math.PI * 1.5;
  const hx = (rotated ? DESK_D : DESK_W) / 2;
  const hz = (rotated ? DESK_W : DESK_D) / 2;

  if (overlapsAny(x - hx, x + hx, z - hz, z + hz)) continue;

  spawnPoints.push({ x, z, angle });
  placedAABBs.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
}

// ─── Load the glTF desk model, then clone it for every spawn point ────────────

const gltfLoader = new GLTFLoader();

// ─── Lamp spawn positions ────────────────────────────────────────────────────

const LAMP_W = 0.8;
const LAMP_D = 0.8;
const lampSpawnPoints = [];
const maxLamps = 6;
const lampAttempts = 300;

for (let i = 0; i < lampAttempts && lampSpawnPoints.length < maxLamps; i++) {
  const x = minX + Math.random() * (maxX - minX);
  const z = minZ + Math.random() * (maxZ - minZ);

  if (!inside(x, z)) continue;
  if (Math.hypot(x, z) < SPAWN_CLEAR) continue;

  const clearance = Math.max(LAMP_W, LAMP_D) / 2 + 0.4;
  if (!inside(x - clearance, z) || !inside(x + clearance, z) ||
      !inside(x, z - clearance) || !inside(x, z + clearance)) continue;

  if (overlapsAny(x - clearance, x + clearance, z - clearance, z + clearance)) continue;

  lampSpawnPoints.push({ x, z });
  placedAABBs.push({
    minX: x - clearance,
    maxX: x + clearance,
    minZ: z - clearance,
    maxZ: z + clearance
  });
}

// ─── Load the glTF lamp model, then clone it for every spawn point ────────────

gltfLoader.load(
  'table_lamp_01/scene.gltf',
  (gltf) => {
    const template = gltf.scene;

    const bbox = new THREE.Box3().setFromObject(template);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    const scaleFactor = 1.2 / Math.max(size.x, size.y, size.z);

    const center = new THREE.Vector3();
    bbox.getCenter(center);
    template.position.sub(center);
    template.scale.set(scaleFactor, scaleFactor, scaleFactor);

    template.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    for (const sp of lampSpawnPoints) {
      const lampScene = template.clone(true);

      const cloneBox = new THREE.Box3().setFromObject(lampScene);
      const cloneSize = new THREE.Vector3();
      cloneBox.getSize(cloneSize);

      lampScene.position.set(sp.x, 0, sp.z);

      const lampLight = new THREE.PointLight(0xfff1b0, 1.8, 8);
      lampLight.position.set(0, 0, 0);
      lampLight.castShadow = false;
      lampScene.add(lampLight);
      
      scene.add(lampScene);

      desks.push({
        mesh: lampScene,
        vx: 0,
        vz: 0,
        angularVelocity: 0,
        friction: 0.90,
        angularFriction: 0.92,
        halfW: LAMP_W / 2,
        halfD: LAMP_D / 2,
      });
    }
  },
  (xhr) => {
    console.log('lamp: ' + Math.round(xhr.loaded / xhr.total * 100) + '% loaded');
  },
  (err) => {
    console.error('Failed to load table_lamp_01/scene.gltf', err);
  }
);

gltfLoader.load(
  'metal_table/metal_table.gltf',
  (gltf) => {
    const template = gltf.scene;

    // Measure the raw model size so we can scale it to match DESK_W x DESK_D
    const bbox = new THREE.Box3().setFromObject(template);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    // Scale so the longest horizontal dimension matches DESK_W
    const scaleFactor = DESK_W / Math.max(size.x, size.z);

    // Centre the template at the origin before cloning
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    template.position.sub(center);
    template.scale.set(scaleFactor, scaleFactor, scaleFactor);

    // Enable shadows on every mesh in the template
    template.traverse((child) => {
      if (child.isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
      }
    });

    // Spawn one clone per pre-calculated position
    for (const sp of spawnPoints) {
      const deskScene = template.clone(true); // deep clone — shares geometry/materials

      // Raise to sit on the floor (y = 0); the template is centred at origin
      const cloneBox  = new THREE.Box3().setFromObject(deskScene);
      const cloneSize = new THREE.Vector3();
      cloneBox.getSize(cloneSize);

      deskScene.position.set(sp.x, cloneSize.y * scaleFactor * 0.5, sp.z);
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
      });
    }
  },
  (xhr) => { console.log('desk: ' + Math.round(xhr.loaded / xhr.total * 100) + '% loaded'); },
  (err) => { console.error('Failed to load metal_table.gltf', err); }
);

// ─── Collision helpers ────────────────────────────────────────────────────────

function getDeskBox(d) {
  return new THREE.Box3().setFromObject(d.mesh);
}

function getOverlapPush(boxA, boxB) {
  const overlapX = Math.min(boxA.max.x, boxB.max.x) - Math.max(boxA.min.x, boxB.min.x);
  const overlapZ = Math.min(boxA.max.z, boxB.max.z) - Math.max(boxA.min.z, boxB.min.z);

  if (overlapX <= 0 || overlapZ <= 0) return null;

  if (overlapX < overlapZ) {
    const sign = (boxA.max.x + boxA.min.x) < (boxB.max.x + boxB.min.x) ? -1 : 1;
    return { px: sign * overlapX, pz: 0 };
  } else {
    const sign = (boxA.max.z + boxA.min.z) < (boxB.max.z + boxB.min.z) ? -1 : 1;
    return { px: 0, pz: sign * overlapZ };
  }
}

function resolveDeskWalls(d) {
  const deskBox = getDeskBox(d);

  for (const wall of colliders) {
    const wallBox = new THREE.Box3().setFromObject(wall);
    const push    = getOverlapPush(deskBox, wallBox);
    if (!push) continue;

    d.mesh.position.x += push.px;
    d.mesh.position.z += push.pz;

    if (push.px !== 0) d.vx = -d.vx * 0.25;
    if (push.pz !== 0) d.vz = -d.vz * 0.25;

    d.angularVelocity *= 0.3;

    deskBox.setFromObject(d.mesh);
  }
}

function resolveDeskDesk(a, b) {
  const boxA = getDeskBox(a);
  const boxB = getDeskBox(b);
  const push = getOverlapPush(boxA, boxB);
  if (!push) return;

  a.mesh.position.x += push.px * 0.5;
  a.mesh.position.z += push.pz * 0.5;
  b.mesh.position.x -= push.px * 0.5;
  b.mesh.position.z -= push.pz * 0.5;

  if (push.px !== 0) {
    const tmp = a.vx;
    a.vx = b.vx * 0.8;
    b.vx = tmp  * 0.8;
  }
  if (push.pz !== 0) {
    const tmp = a.vz;
    a.vz = b.vz * 0.8;
    b.vz = tmp  * 0.8;
  }

  const spinTransfer = (a.angularVelocity - b.angularVelocity) * 0.3;
  a.angularVelocity -= spinTransfer;
  b.angularVelocity += spinTransfer;
}

// ─── Main desk physics update (called every frame) ────────────────────────────

function updateDesks() {
  for (const d of desks) {
    if (d.vx === 0 && d.vz === 0 && d.angularVelocity === 0) continue;

    d.mesh.position.x += d.vx;
    d.mesh.position.z += d.vz;

    d.mesh.rotation.y += d.angularVelocity;
    d.angularVelocity *= d.angularFriction;
    if (Math.abs(d.angularVelocity) < 0.0001) d.angularVelocity = 0;

    d.vx *= d.friction;
    d.vz *= d.friction;
    if (Math.abs(d.vx) < 0.001) d.vx = 0;
    if (Math.abs(d.vz) < 0.001) d.vz = 0;
  }

  for (let iter = 0; iter < 2; iter++) {
    for (const d of desks) {
      resolveDeskWalls(d);
    }
  }

  for (let i = 0; i < desks.length; i++) {
    for (let j = i + 1; j < desks.length; j++) {
      resolveDeskDesk(desks[i], desks[j]);
    }
  }
}

// Render loop
let started = false;
onStart(() => { started = true; });

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
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

export { scene, camera, renderer, colliders, desks };