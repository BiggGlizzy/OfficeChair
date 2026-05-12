// controller.js
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { scene, colliders, desks } from './scene.js';

var loader, chair;
var chairSize = 1.8;

function controlStart() {
  loader = new FBXLoader();

  loader.load('red-pleather-rolling-office-chair/source/Office_Chair_PBR_SGroup.fbx', (object) => {
    var bbox = new THREE.Box3().setFromObject(object);
    var center = new THREE.Vector3();
    var size   = new THREE.Vector3();

    bbox.getCenter(center);
    bbox.getSize(size);
    object.position.sub(center);

    var scaleFactor = chairSize / Math.max(size.x, size.y, size.z);
    object.scale.set(scaleFactor, scaleFactor, scaleFactor);
    object.position.set(0, 0, 0);
    object.rotation.y = 0;

    object.traverse(function (child) {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    chair = object;
    chair.name = 'chair';
    scene.add(chair);
  },
  (xhr) => { console.log((xhr.loaded / xhr.total) * 100 + '% loaded'); },
  (error) => { console.log(error); });
}

// Key state
var w = false, a = false, s = false, d = false;

document.addEventListener('keydown', (e) => {
  if (e.keyCode === 87) w = true;
  if (e.keyCode === 65) a = true;
  if (e.keyCode === 83) s = true;
  if (e.keyCode === 68) d = true;
});

document.addEventListener('keyup', (e) => {
  if (e.keyCode === 87) w = false;
  if (e.keyCode === 65) a = false;
  if (e.keyCode === 83) s = false;
  if (e.keyCode === 68) d = false;
});

var rotationSpeed = 0.05;

function rotation() {
  if (!chair) return;
  if (a) chair.rotation.y += rotationSpeed;
  if (d) chair.rotation.y -= rotationSpeed;
}

// Chair glide physics
var vx = 0;           // world-space velocity
var vz = 0;
const ACCELERATION  = 0.006;
const MAX_SPEED     = 0.18;
const FRICTION      = 0.96;  // high = glides a long way
const TURN_FRICTION = 0.92;  // extra drag while steering

const chairColliderSize = new THREE.Vector3(1.2, 1.8, 1.2);

// Returns the desk object that would be hit at (nx, nz), or null
function collidingDesk(nx, nz) {
  const chairBox = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(nx, chairColliderSize.y / 2, nz),
    chairColliderSize
  );

  for (const d of desks) {
    const deskBox = new THREE.Box3().setFromObject(d.mesh);
    if (chairBox.intersectsBox(deskBox)) return d;
  }
  return null;
}

// Returns true if (nx, nz) hits a static wall collider
function collidingWall(nx, nz) {
  const chairBox = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(nx, chairColliderSize.y / 2, nz),
    chairColliderSize
  );

  for (const wall of colliders) {
    if (chairBox.intersectsBox(new THREE.Box3().setFromObject(wall))) return true;
  }
  return false;
}

function move() {
  if (!chair) return;

  const fwd = new THREE.Vector3(
    Math.cos(chair.rotation.y),
    0,
    -Math.sin(chair.rotation.y)
  );

  if (w) {
    vx += fwd.x * ACCELERATION;
    vz += fwd.z * ACCELERATION;
  } else if (s) {
    vx -= fwd.x * ACCELERATION;
    vz -= fwd.z * ACCELERATION;
  }

  // Clamp to max speed
  const speed = Math.sqrt(vx * vx + vz * vz);
  if (speed > MAX_SPEED) {
    vx = (vx / speed) * MAX_SPEED;
    vz = (vz / speed) * MAX_SPEED;
  }

  // Extra friction while turning so it doesn't feel like ice while steering
  const friction = (a || d) ? TURN_FRICTION : FRICTION;
  vx *= friction;
  vz *= friction;

  if (Math.abs(vx) < 0.0001) vx = 0;
  if (Math.abs(vz) < 0.0001) vz = 0;

  const nx = chair.position.x + vx;
  const nz = chair.position.z + vz;

  // Check desk collision first
  const hitDesk = collidingDesk(nx, nz);

  if (hitDesk) {
    // Impulse magnitude scales with how fast the chair is going
    const impulsePower = speed * 1.8;

    // Push the desk in the chair's travel direction
    const dir = new THREE.Vector3(vx, 0, vz).normalize();
    hitDesk.vx += dir.x * impulsePower;
    hitDesk.vz += dir.z * impulsePower;

    // Chair loses momentum on impact — harder hit = more bounce-back
    const restitution = 0.3;
    vx = -vx * restitution;
    vz = -vz * restitution;

  } else if (collidingWall(nx, nz)) {
    // Bounce off walls with a little restitution
    vx = -vx * 0.25;
    vz = -vz * 0.25;

  } else {
    chair.position.x = nx;
    chair.position.z = nz;
  }
}

controlStart();

export { rotation, move };