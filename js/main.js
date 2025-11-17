import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/webxr/VRButton.js';

// --- Escena base ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 1);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.xr.enabled = true;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// Fondo HDRI
new THREE.CubeTextureLoader().setPath('cubemap/').load(
  ['px.png','nx.png','py.png','ny.png','pz.png','nz.png'],
  tex => scene.background = tex
);

// --- Variables ---
let vrController = null;
let laserPointer = null;
let avionModel = null;
let isRotating = false;
let infoSphere, gameSphere;
const curiosidadText = document.getElementById('curiosidad-text');

// --- Láser ---
const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-30)]);
const laserMat = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 4, transparent: true, opacity: 0.8 });
laserPointer = new THREE.Line(laserGeo, laserMat);
laserPointer.visible = false;

// --- Cargar avión ---
const loader = new GLTFLoader();
loader.load('modelos/avion2.glb', gltf => {
  avionModel = gltf.scene;
  avionModel.userData.type = 'avion';
  avionModel.position.set(0, 2, -3);
  avionModel.scale.set(0.003, 0.003, 0.003);
  avionModel.rotation.y = Math.PI / 2;
  avionModel.traverse(child => { if (child.isMesh) child.castShadow = true; });
  scene.add(avionModel);

  // --- Esfera Curiosidades ---
  infoSphere = createInteractiveSphere(0x0088ff, -1, 7, -3, 'info');
  // --- Esfera Minijuego ---
  gameSphere = createInteractiveSphere(0x00ff88, 1, 7, -3, 'game');
});

// Crear esferas interactivas
function createInteractiveSphere(color, x, y, z, type) {
  const geo = new THREE.SphereGeometry(0.2, 32, 32);
  const mat = new THREE.MeshBasicMaterial({ color });
  const sphere = new THREE.Mesh(geo, mat);
  sphere.position.set(x, y, z);
  sphere.userData.type = type;
  scene.add(sphere);

  // Pulsación visual
  const originalScale = sphere.scale.clone();
  const pulse = () => {
    const s = 1 + 0.15 * Math.sin(Date.now() * 0.005);
    sphere.scale.copy(originalScale).multiplyScalar(s);
    if (sphere.visible) requestAnimationFrame(pulse);
  };
  pulse();

  return sphere;
}

// --- Controlador VR ---
renderer.xr.addEventListener('sessionstart', () => {
  const controller = renderer.xr.getController(0);
  controller.position.set(0, 1.6, 0.3);
  controller.rotation.x = THREE.MathUtils.degToRad(-20);
  controller.add(laserPointer);
  scene.add(controller);
  vrController = controller;

  controller.addEventListener('selectstart', onSelect);
});

// Zona de muerte
const DEADZONE = 0.25;
function handleController() {
  if (!vrController?.gamepad) return;
  const axes = vrController.gamepad.axes;
  if (axes.length < 2) return;
  let x = axes[0], y = axes[1];
  if (Math.abs(x) < DEADZONE) x = 0;
  if (Math.abs(y) < DEADZONE) y = 0;
  vrController.rotation.y -= x * 0.15;
  vrController.rotation.x -= y * 0.15;
  vrController.rotation.x = THREE.MathUtils.clamp(vrController.rotation.x, -1.4, 0.8);
}

// --- Raycast preciso por tipo ---
function onSelect() {
  if (!vrController) return;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3(0,0,-1);
  direction.applyQuaternion(vrController.quaternion);
  raycaster.ray.origin.copy(vrController.getWorldPosition(origin));
  raycaster.ray.direction.copy(direction);

  const allObjects = scene.children;

  // 1. Solo avión → rotar
  if (avionModel) {
    const hitsAvion = raycaster.intersectObject(avionModel, true);
    if (hitsAvion.length > 0) {
      isRotating = !isRotating;
      return;
    }
  }

  // 2. Esfera info → mostrar texto 3D
  if (infoSphere) {
    const hitsInfo = raycaster.intersectObject(infoSphere);
    if (hitsInfo.length > 0) {
      showCuriosidad();
      return;
    }
  }

  // 3. Esfera juego → ir al minijuego
  if (gameSphere) {
    const hitsGame = raycaster.intersectObject(gameSphere);
    if (hitsGame.length > 0) {
      if (confirm("Iniciar minijuego de vuelo?")) {
        location.href = "minigame.html";
      }
      return;
    }
  }
}

// --- Mostrar curiosidad en 3D ---
const curiosidades = [
  "Messerschmitt Bf 109\nEl caza más producido de la historia\n+34.000 unidades",
  "Velocidad máxima: 700 km/h\nMotor Daimler-Benz DB 605",
  "Armamento: 2× MG 131 + 1× MG 151/20\nPilotos legendarios: Hartmann (352 victorias)",
  "Usado desde 1937 hasta 1945\nTambién por España, Finlandia y Rumanía"
];
let currentIndex = 0;

function showCuriosidad() {
  curiosidadText.textContent = curiosidades[currentIndex];
  curiosidadText.classList.add('show');
  currentIndex = (currentIndex + 1) % curiosidades.length;

  setTimeout(() => {
    curiosidadText.classList.remove('show');
  }, 6000);
}

// --- Animación ---
function animate() {
  handleController();

  if (isRotating && avionModel) {
    avionModel.rotation.y += 0.012;
  }

  laserPointer.visible = !!vrController;
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

// Responsive
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
