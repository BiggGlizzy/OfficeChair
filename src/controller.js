import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { scene, colliders } from './scene.js';

var loader, chair;
var chairSize = 1.8;

//creates the chair to make things work in the first place
function controlStart() {
    loader = new FBXLoader();

    loader.load('red-pleather-rolling-office-chair/source/Office_Chair_PBR_SGroup.fbx', (object) => {
        var bbox = new THREE.Box3().setFromObject(object);
        var center = new THREE.Vector3(); 
        var size = new THREE.Vector3();

        bbox.getCenter(center);
        bbox.getSize(size);
        object.position.sub(center);

        var scaleFactor = chairSize / Math.max(size.x, size.y, size.z);
        object.scale.set(scaleFactor, scaleFactor, scaleFactor);
        object.position.set(0, 0, 0);
        object.rotation.y = 0;

        object.traverse(function(child) {
            if(child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        chair = object;
        chair.name = "chair";
        scene.add(chair);
    }, (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
    },
    (error) => {
        console.log(error)
    });
}

//weeds of the controls 
// ----- SETUP OF KEYPRESSES -------
var w = false;
var a = false; 
var s = false; 
var d = false;

document.addEventListener('keydown', function(event) {
    switch (event.keyCode) {
        case 87: // W
            w = true;
            break;
        case 65: // A
            a = true;
            break;
        case 83: // S
            s = true;
            break;
        case 68: // D
            d = true;
            break;
    }
});

document.addEventListener('keyup', function(event) {
    switch (event.keyCode) {
        case 87: // W
            w = false;
            break;
        case 65: // A
            a = false;
            break;
        case 83: // S
            s = false;
            break;
        case 68: // D
            d = false;
            break;
    }
});

var rotationSpeed = 0.05;

function rotation() {
    if(!chair) return;

    if(a === true) {
        chair.rotation.y += rotationSpeed;
    }

    if(d === true) {
        chair.rotation.y -= rotationSpeed;
    }
}

const chairColliderSize = new THREE.Vector3(1.2, 1.8, 1.2);

function isColliding(nextX, nextZ) {
    if(!chair) return false;

    const chairBox = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(nextX, chairColliderSize.y / 2, nextZ),
        chairColliderSize
    );

    for(const object of colliders) {
        const objectBox = new THREE.Box3().setFromObject(object);

        if(chairBox.intersectsBox(objectBox)) {
            return true;
        }
    }

    return false;
}

var velocity = 0; 
var acceleration = 0.03; 
var maxSpeed = 0.1;
var decelleration = 0.02;

function move() {
    if(!chair) return;

    if(w === true) {
        velocity += acceleration;

        if(velocity > maxSpeed) {
            velocity = maxSpeed;
        }
    } else if(s === true) {
        velocity -= acceleration;

        if(velocity < -maxSpeed) {
            velocity = -maxSpeed;
        }
    } else {
        if(velocity > 0) {
            if(velocity - decelleration < 0) {
                velocity = 0;
            } else {
                velocity -= decelleration;
            }
        } else if(velocity < 0) { 
            if(velocity + decelleration > 0) {
                velocity = 0;
            } else {
                velocity += decelleration;
            }
        }
    }

    const nextZ = chair.position.z - Math.sin(chair.rotation.y) * velocity;
    const nextX = chair.position.x + Math.cos(chair.rotation.y) * velocity;

    if(!isColliding(nextX, nextZ)) {
        chair.position.z = nextZ;
        chair.position.x = nextX;
    } else {
        velocity = 0;
    }
}

controlStart();

export { rotation, move };