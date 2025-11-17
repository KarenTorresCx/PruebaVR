import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/webxr/VRButton.js';

// === ESCENA BÁSICA ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.xr.enabled = true;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// HDRI
const cubeLoader = new THREE.CubeTextureLoader();
cubeLoader.setPath('cubemap/');
const envMap = cubeLoader.load(['px.png','nx.png','py.png','ny.png','pz.png','nz.png']);
scene.background = envMap;

// === CARGAR AVIÓN ===
let avionModel = null;
let isRotating = false;
const loaderGLB = new GLTFLoader();

loaderGLB.load('modelos/avion2.glb', (gltf) => {
  avionModel = gltf.scene;
  avionModel.position.set(0, 2, -3);
  avionModel.scale.set(0.003, 0.003, 0.003);
  avionModel.rotation.y = Math.PI / 2;
  avionModel.userData.isAvion = true;

  avionModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  scene.add(avionModel);
});

// === CONTROLADOR VR + LÁSER ===
let vrController = null;
let laserPointer = null;

const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-20)]);
const laserMat = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3, transparent: true, opacity: 0.8 });
laserPointer = new THREE.Line(laserGeo, laserMat);
laserPointer.visible = false;

const DEADZONE = 0.25;
const SENSITIVITY = 3.0;

renderer.xr.addEventListener('sessionstart', () => {
  const controller = renderer.xr.getController(0);
  controller.position.set(0, 1.6, 0.3);
  controller.add(laserPointer);
  scene.add(controller);
  vrController = controller;

  controller.addEventListener('select', onSelect);
});

function handleController(controller) {
  if (!controller?.gamepad) return;
  const axes = controller.gamepad.axes;
  if (axes.length < 2) return;

  let x = axes[0];
  let y = axes[1];
  if (Math.abs(x) < DEADZONE) x = 0;
  if (Math.abs(y) < DEADZONE) y = 0;

  controller.rotation.y -= x * SENSITIVITY * 0.05;
  controller.rotation.x -= y * SENSITIVITY * 0.05;
  controller.rotation.x = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, controller.rotation.x));
}

// === CLIC CON LÁSER ===
function onSelect() {
  if (!vrController) return;

  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(vrController.matrixWorld);

  const raycaster = new THREE.Raycaster();
  raycaster.ray.origin.setFromMatrixPosition(vrController.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    let obj = intersects[0].object;
    while (obj && !obj.userData.isAvion && obj.parent) obj = obj.parent;

    // 1. Rotar avión
    if (obj && obj.userData.isAvion) {
      isRotating = !isRotating;
      console.log(isRotating ? "Rotando avión" : "Avión detenido");
      return;
    }

    // 2. Botón de curiosidades
    if (intersects[0].object.name === 'infoButton') {
      alert("¡Aquí irán las curiosidades del avión de la Segunda Guerra Mundial!");
      return;
    }

    // 3. Botón de juego
    if (intersects[0].object.name === 'gameButton') {
      alert("¡Iniciando minijuego de vuelo!");
      // Aquí en el futuro irá el minijuego
      return;
    }
  }
}

// === BOTONES FLOTANTES EN 3D (para VR) ===
function createVRButton(name, position, color) {
  const buttonGroup = new THREE.Group();
  buttonGroup.name = name;

  const geo = new THREE.SphereGeometry(0.2, 32, 32);
  const mat = new THREE.MeshStandardMaterial({ 
    color: color,
    metalness: 0.8,
    roughness: 0.2,
    emissive: color,
    emissiveIntensity: 0.3
  });
  const sphere = new THREE.Mesh(geo, mat);
  sphere.name = name;
  buttonGroup.add(sphere);

  buttonGroup.position.copy(position);
  scene.add(buttonGroup);
  return buttonGroup;
}

const infoBtn = createVRButton('infoButton', new THREE.Vector3(-3, 1.8, -3), 0x0096ff);
const gameBtn = createVRButton('gameButton', new THREE.Vector3(3, 1.8, -3), 0x00c832);

// === ANIMACIÓN ===
function animate() {
  if (isRotating && avionModel) {
    avionModel.rotation.y += 0.015;
  }

  if (vrController) {
    handleController(vrController);
    laserPointer.visible = true;
  } else {
    laserPointer.visible = false;
  }

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// Responsive
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
