// scene.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { rotation, move } from './controller.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5);

const colliders = [];  // static: walls only
const desks = [];      // dynamic: desks that can be knocked around

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 20);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
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
scene.add(light);

const wallHeight = 4;
const wallMat  = new THREE.MeshStandardMaterial({ color: 0xffffff });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x888888 });

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

// Scattered desks — dynamic bodies
const deskMat    = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
const DESK_W     = 1.5;
const DESK_D     = 1.0;
const MIN_GAP    = 0.5;
const SPAWN_CLEAR = 2.5;
const CARDINALS  = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];

const placedAABBs = [];

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
const maxDesks  = 40;

for (let i = 0; i < attempts && placedAABBs.length < maxDesks; i++) {
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

  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(DESK_W, 1, DESK_D),
    deskMat
  );
  desk.position.set(x, 0.5, z);
  desk.rotation.y = angle;
  desk.castShadow = true;
  scene.add(desk);

  // Each desk carries its own velocity and friction for sliding physics
  desks.push({
    mesh: desk,
    vx: 0,
    vz: 0,
    friction: 0.88,    // how quickly it slows down (lower = slidier)
    halfW: DESK_W / 2,
    halfD: DESK_D / 2,
  });

  placedAABBs.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
}

// Step all desk physics — called every frame from animate()
function updateDesks() {
  for (const d of desks) {
    if (d.vx === 0 && d.vz === 0) continue;

    const nx = d.mesh.position.x + d.vx;
    const nz = d.mesh.position.z + d.vz;

    // Wall boundary check — stop if it would leave the room
    if (inside(nx, nz)) {
      d.mesh.position.x = nx;
      d.mesh.position.z = nz;
    } else {
      d.vx = 0;
      d.vz = 0;
    }

    // Friction
    d.vx *= d.friction;
    d.vz *= d.friction;

    if (Math.abs(d.vx) < 0.001) d.vx = 0;
    if (Math.abs(d.vz) < 0.001) d.vz = 0;
  }
}

// Render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateDesks();
  renderer.render(scene, camera);
  rotation();
  move();
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

export { scene, camera, renderer, colliders, desks };