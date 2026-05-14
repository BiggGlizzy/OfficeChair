// controller.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, colliders, desks, camera } from './scene.js';

var loader, chair;
var chairSize = 1.8;

function controlStart() {
  loader = new GLTFLoader();

  loader.load('office_chair/scene.gltf', (gltf) => {
    var bbox = new THREE.Box3().setFromObject(gltf.scene);
    var center = new THREE.Vector3();
    var size   = new THREE.Vector3();

    bbox.getCenter(center);
    bbox.getSize(size);
    gltf.scene.position.sub(center);

    var scaleFactor = chairSize / Math.max(size.x, size.y, size.z);
    gltf.scene.scale.set(scaleFactor, scaleFactor, scaleFactor);
    gltf.scene.position.set(0, chairSize * 0.5, 0);
    gltf.scene.rotation.y = 0;

    gltf.scene.traverse(function (child) {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    chair = gltf.scene;
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
var vx = 0;
var vz = 0;
const ACCELERATION  = 0.006;
const MAX_SPEED     = 0.18;
const FRICTION      = 0.96;
const TURN_FRICTION = 0.92;

const chairColliderSize = new THREE.Vector3(1.2, 1.8, 1.2);

// Returns the desk object the chair would overlap at (nx, nz), or null
function collidingDesk(nx, nz) {
  const chairBox = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(nx, chairColliderSize.y / 2, nz),
    chairColliderSize
  );
  for (const d of desks) {
    if (chairBox.intersectsBox(new THREE.Box3().setFromObject(d.mesh))) return d;
  }
  return null;
}

// Returns true if (nx, nz) overlaps a static wall collider
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

function move(speedCallback) {
  if (!chair) return;

  const fwd = new THREE.Vector3(
    Math.sin(chair.rotation.y),
    0,
    Math.cos(chair.rotation.y)
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

  const friction = (a || d) ? TURN_FRICTION : FRICTION;
  vx *= friction;
  vz *= friction;

  if (Math.abs(vx) < 0.0001) vx = 0;
  if (Math.abs(vz) < 0.0001) vz = 0;

  const nx = chair.position.x + vx;
  const nz = chair.position.z + vz;

  const hitDesk = collidingDesk(nx, nz);

  if (hitDesk) {
    const impulsePower = speed * 1.8;

    // Linear push in the chair's travel direction
    const dir = new THREE.Vector3(vx, 0, vz).normalize();
    hitDesk.vx += dir.x * impulsePower;
    hitDesk.vz += dir.z * impulsePower;

    // Torque: 2D cross product of offset vs travel direction.
    // Glancing / corner hits produce high spin; dead-centre hits produce near zero.
    const offset = new THREE.Vector3(
      hitDesk.mesh.position.x - chair.position.x,
      0,
      hitDesk.mesh.position.z - chair.position.z
    ).normalize();
    const torque = offset.x * dir.z - offset.z * dir.x;
    hitDesk.angularVelocity += torque * speed * 0.4;

    // Chair bounces back
    const restitution = 0.3;
    vx = -vx * restitution;
    vz = -vz * restitution;

  } else if (collidingWall(nx, nz)) {
    vx = -vx * 0.25;
    vz = -vz * 0.25;

  } else {
    chair.position.x = nx;
    chair.position.z = nz;
    camera.position.x += vx;
    camera.position.z += vz;
  }

  camera.lookAt(chair.position.x, chair.position.y, chair.position.z);

  if (speedCallback) speedCallback(vx, vz);
}

controlStart();

export { rotation, move };