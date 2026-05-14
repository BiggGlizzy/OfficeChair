
// controller.js

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, colliders, desks, camera } from './scene.js';

let loader;
let chair;

const chairSize = 1.8;

// ─────────────────────────────────────────────
// LOAD CHAIR
// ─────────────────────────────────────────────

function controlStart() {

  loader = new GLTFLoader();

  loader.load(

    'office_chair/scene.gltf',

    (gltf) => {

      const bbox = new THREE.Box3()
        .setFromObject(gltf.scene);

      const center = new THREE.Vector3();
      const size = new THREE.Vector3();

      bbox.getCenter(center);
      bbox.getSize(size);

      gltf.scene.position.sub(center);

      const scaleFactor =
        chairSize /
        Math.max(size.x, size.y, size.z);

      gltf.scene.scale.set(
        scaleFactor,
        scaleFactor,
        scaleFactor
      );

      gltf.scene.position.set(
        0,
        chairSize * 0.5,
        0
      );

      gltf.scene.rotation.y = 0;

      gltf.scene.traverse((child) => {

        if (child.isMesh) {

          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      chair = gltf.scene;

      chair.name = 'chair';

      scene.add(chair);
    },

    (xhr) => {

      console.log(
        (xhr.loaded / xhr.total) * 100 +
        '% loaded'
      );
    },

    (error) => {

      console.log(error);
    }
  );
}

// ─────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────

let w = false;
let a = false;
let s = false;
let d = false;

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

// ─────────────────────────────────────────────
// ROTATION
// ─────────────────────────────────────────────

const rotationSpeed = 0.05;

function rotation() {

  if (!chair) return;

  if (a) chair.rotation.y += rotationSpeed;
  if (d) chair.rotation.y -= rotationSpeed;
}

// ─────────────────────────────────────────────
// MOVEMENT PHYSICS
// ─────────────────────────────────────────────

let vx = 0;
let vz = 0;

const ACCELERATION = 0.006;
const MAX_SPEED = 0.18;

const FRICTION = 0.96;
const TURN_FRICTION = 0.92;

const chairColliderSize =
  new THREE.Vector3(
    1.2,
    1.8,
    1.2
  );

// ─────────────────────────────────────────────
// COLLISION HELPERS
// ─────────────────────────────────────────────

function collidingDesk(nx, nz) {

  const chairBox =
    new THREE.Box3()
      .setFromCenterAndSize(

        new THREE.Vector3(
          nx,
          chairColliderSize.y / 2,
          nz
        ),

        chairColliderSize
      );

  for (const d of desks) {

    const box =
      new THREE.Box3()
        .setFromObject(d.mesh);

    if (chairBox.intersectsBox(box)) {
      return d;
    }
  }

  return null;
}

function collidingWall(nx, nz) {

  const chairBox =
    new THREE.Box3()
      .setFromCenterAndSize(

        new THREE.Vector3(
          nx,
          chairColliderSize.y / 2,
          nz
        ),

        chairColliderSize
      );

  for (const wall of colliders) {

    const wallBox =
      new THREE.Box3()
        .setFromObject(wall);

    if (chairBox.intersectsBox(wallBox)) {
      return true;
    }
  }

  return false;
}

// ─────────────────────────────────────────────
// MAIN MOVEMENT
// ─────────────────────────────────────────────

function move(speedCallback) {

  if (!chair) return;

  const fwd = new THREE.Vector3(

    Math.sin(chair.rotation.y),

    0,

    Math.cos(chair.rotation.y)
  );

  // ─────────────────────────────
  // INPUT ACCELERATION
  // ─────────────────────────────

  if (w) {

    vx += fwd.x * ACCELERATION;
    vz += fwd.z * ACCELERATION;

  } else if (s) {

    vx -= fwd.x * ACCELERATION;
    vz -= fwd.z * ACCELERATION;
  }

  // ─────────────────────────────
  // SPEED LIMIT
  // ─────────────────────────────

  const speed =
    Math.sqrt(vx * vx + vz * vz);

  if (speed > MAX_SPEED) {

    vx =
      (vx / speed) * MAX_SPEED;

    vz =
      (vz / speed) * MAX_SPEED;
  }

  // ─────────────────────────────
  // FRICTION
  // ─────────────────────────────

  const friction =
    (a || d)
      ? TURN_FRICTION
      : FRICTION;

  vx *= friction;
  vz *= friction;

  if (Math.abs(vx) < 0.0001) vx = 0;
  if (Math.abs(vz) < 0.0001) vz = 0;

  // ─────────────────────────────
  // NEXT POSITION
  // ─────────────────────────────

  const nx = chair.position.x + vx;
  const nz = chair.position.z + vz;

  const hitDesk =
    collidingDesk(nx, nz);

  // ─────────────────────────────
  // DESK / COMPUTER HIT
  // ─────────────────────────────

  if (hitDesk) {

    const impulsePower =
      speed * 1.8;

    const dir =
      new THREE.Vector3(
        vx,
        0,
        vz
      ).normalize();

    // Push object
    hitDesk.vx +=
      dir.x * impulsePower;

    hitDesk.vz +=
      dir.z * impulsePower;

    // ─────────────────────────
    // COMPUTER TUMBLING
    // ─────────────────────────

    if (hitDesk.isComputer) {

      // Launch upward
      hitDesk.vy +=
        speed * 0.08;

      // Random tumble spin
      hitDesk.rotVX =
        (hitDesk.rotVX || 0) +
        (Math.random() - 0.5) *
        speed *
        1.8;

      hitDesk.rotVZ =
        (hitDesk.rotVZ || 0) +
        (Math.random() - 0.5) *
        speed *
        1.8;

      // Extra yaw spin
      hitDesk.angularVelocity +=
        (Math.random() - 0.5) *
        speed *
        0.6;
    }

    // ─────────────────────────
    // DESK TORQUE
    // ─────────────────────────

    const offset =
      new THREE.Vector3(

        hitDesk.mesh.position.x -
        chair.position.x,

        0,

        hitDesk.mesh.position.z -
        chair.position.z

      ).normalize();

    const torque =
      offset.x * dir.z -
      offset.z * dir.x;

    hitDesk.angularVelocity +=
      torque *
      speed *
      0.4;

    // ─────────────────────────
    // CHAIR BOUNCE
    // ─────────────────────────

    const restitution = 0.3;

    vx = -vx * restitution;
    vz = -vz * restitution;

  }

  // ─────────────────────────────
  // WALL COLLISION
  // ─────────────────────────────

  else if (collidingWall(nx, nz)) {

    vx = -vx * 0.25;
    vz = -vz * 0.25;
  }

  // ─────────────────────────────
  // NORMAL MOVEMENT
  // ─────────────────────────────

  else {

    chair.position.x = nx;
    chair.position.z = nz;

    camera.position.x += vx;
    camera.position.z += vz;
  }

  // ─────────────────────────────
  // CAMERA
  // ─────────────────────────────

  camera.lookAt(

    chair.position.x,

    chair.position.y,

    chair.position.z
  );

  if (speedCallback) {
    speedCallback(vx, vz);
  }
}

controlStart();

export {
  rotation,
  move
};