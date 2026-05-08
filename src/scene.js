// import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { rotation , move } from './controller.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 20);
camera.lookAt(0,0,0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

//controls setup 
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = true;
controls.minDistance = 2; 
controls.maxDistance = 50; 
controls.enableDamping = true; 
controls.dampingFactor = 0.08; 
controls.enablePan = false;
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5,10,5);
light.castShadow = true;
scene.add(light);

// Generate room shape
const wallHeight = 4;
const sides = 5 + Math.floor(Math.random() * 3);
const radius = 10;

const points = [];

for (let i = 0; i < sides; i++) {
  const angle = (i / sides) * Math.PI * 2;
  const r = radius * (0.8 + Math.random() * 0.4);

  points.push(new THREE.Vector2(
    Math.cos(angle) * r,
    Math.sin(angle) * r
  ));
}

// Floor
const shape = new THREE.Shape(points);
const floorGeo = new THREE.ShapeGeometry(shape);
floorGeo.rotateX(-Math.PI / 2);

const floor = new THREE.Mesh(
  floorGeo,
  new THREE.MeshStandardMaterial({ color: 0x888888, side: THREE.DoubleSide })
);

floor.receiveShadow = true;
scene.add(floor);

// Walls
const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

for (let i = 0; i < points.length; i++) {
  const p1 = points[i];
  const p2 = points[(i + 1) % points.length];

  const dx = p2.x - p1.x;
  const dz = p2.y - p1.y;
  const length = Math.sqrt(dx*dx + dz*dz);

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(length, wallHeight, 0.3),
    wallMat
  );

  wall.position.set(
    (p1.x + p2.x) / 2,
    wallHeight / 2,
    (p1.y + p2.y) / 2
  );

  wall.rotation.y = -Math.atan2(dz, dx);
  wall.receiveShadow = true;

  scene.add(wall);
}

// Get room bounds
let minX = Infinity, maxX = -Infinity;
let minZ = Infinity, maxZ = -Infinity;

points.forEach(p => {
  minX = Math.min(minX, p.x);
  maxX = Math.max(maxX, p.x);
  minZ = Math.min(minZ, p.y);
  maxZ = Math.max(maxZ, p.y);
});

// Check if point is inside polygon
function inside(x, z) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, zi = points[i].y;
    const xj = points[j].x, zj = points[j].y;

    const intersect =
      ((zi > z) !== (zj > z)) &&
      (x < (xj - xi) * (z - zi) / (zj - zi) + xi);

    if (intersect) inside = !inside;
  }
  return inside;
}

// Create desks in a grid
const deskMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
const spacing = 3;

for (let x = minX + 2; x < maxX - 2; x += spacing) {
  for (let z = minZ + 2; z < maxZ - 2; z += spacing) {
    if (inside(x, z)) {
      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1, 1),
        deskMat
      );

      desk.position.set(x, 0.5, z);
      desk.castShadow = true;

      scene.add(desk);
    }
  }
}

// Render loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
  rotation();
  move()
}

animate();

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

export { scene , camera, renderer };