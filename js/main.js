import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/webxr/VRButton.js';

// === Escena básica ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 1);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// Fondo HDRI
new THREE.CubeTextureLoader().setPath('cubemap/').load(
  ['px.png','nx.png','py.png','ny.png','pz.png','nz.png'],
  tex => scene.background = tex
);

// === Variables globales ===
let vrController = null;
let laserPointer = null;
let selectedModel = null;
let isRotating = false;
let infoSphere = null;
let gameSphere = null;
let infoPanel = null;   
let hoveredButton = null;

// === Láser rojo ===
const laserGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0,0,0),
  new THREE.Vector3(0,0,-30)
]);
laserPointer = new THREE.Line(
  laserGeo,
  new THREE.LineBasicMaterial({color:0xff0000, transparent:true, opacity:0.8})
);
laserPointer.visible = false;

// === Cargar avión ===
const loader = new GLTFLoader();
loader.load('modelos/avion2.glb', gltf => {
  const avion = gltf.scene;
  avion.userData.isGLTFModel = true;
  avion.position.set(0, 1.6, -3);
  avion.scale.set(0.003, 0.003, 0.003);
  avion.rotation.y = Math.PI / 2;
  avion.traverse(n => { if (n.isMesh) n.castShadow = n.receiveShadow = true; });
  scene.add(avion);

  // === Botón CURIOSIDADES ===
  infoSphere = createInteractiveButton("CURIOSIDADES", 0x0066ff, -1, 4, -3, "info");
  scene.add(infoSphere);

  // === Botón MINIJUEGO ===
  gameSphere = createInteractiveButton("MINIJUEGO", 0x00cc66, 1, 4, -3, "game");
  scene.add(gameSphere);

  // Panel de curiosidades (inicialmente oculto)
  infoPanel = createInfoPanel();
  infoPanel.visible = false;
  scene.add(infoPanel);
});

// === Crear botón 3D interactivo ===
function createInteractiveButton(label, color, x, y, z, type, width = 1.2, height = 0.6) {

  const geo = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  });

  const button = new THREE.Mesh(geo, mat);
  button.position.set(x, y, z);
  button.userData.type = type;

  // Texto encima del botón
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.font = '50px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const textMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true
  });

  const textMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), textMaterial);
  textMesh.position.z = 0.001;
  button.add(textMesh);

  return button;
}

// === Panel de curiosidades 3D ===
function createInfoPanel() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = '60px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('CURIOSIDADES DEL BF 109', 512, 100);
  ctx.font = '40px Arial';
  ctx.fillText('• Más de 34.000 unidades producidas', 512, 200);
  ctx.fillText('• Velocidad máxima: 700 km/h', 512, 280);
  ctx.fillText('• Armamento: 2 ametralladoras + 1 cañón', 512, 360);
  ctx.fillText('¡Apunta y dispara para cerrar!', 512, 460);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), material);
  panel.position.set(-1, 5, -4);
  return panel;
}

// === Hover VR ===
function highlightButton(button) {
  button.material.color.setHex(0xffff66);
  button.material.opacity = 1;
  button.children[0].material.opacity = 1;
}

function resetButtonColor(button) {
  if (button.userData.type === "info") button.material.color.setHex(0x0066ff);
  if (button.userData.type === "game") button.material.color.setHex(0x00cc66);

  button.material.opacity = 0.9;
  button.children[0].material.opacity = 1;
}

function checkHover() {
  if (!vrController) return;

  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3(0,0,-1).applyQuaternion(vrController.quaternion);

  raycaster.ray.set(vrController.getWorldPosition(origin), direction);

  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    let obj = intersects[0].object;
    while (obj && !obj.userData.type) obj = obj.parent;

    if (obj && obj.userData.type) {
      if (hoveredButton !== obj) {
        if (hoveredButton) resetButtonColor(hoveredButton);
        highlightButton(obj);
        hoveredButton = obj;
      }
      return;
    }
  }

  if (hoveredButton) {
    resetButtonColor(hoveredButton);
    hoveredButton = null;
  }
}

// === Controlador VRBox ===
renderer.xr.addEventListener('sessionstart', () => {
  const controller = renderer.xr.getController(0);
  controller.position.set(0, 1.6, 0.5);
  controller.rotation.x = THREE.MathUtils.degToRad(-20);
  controller.add(laserPointer);
  scene.add(controller);
  vrController = controller;
  controller.addEventListener('select', onSelect);
});

// Zona muerta del joystick
const DEADZONE = 0.25;
function handleController() {
  if (!vrController?.gamepad) return;
  const a = vrController.gamepad.axes;
  let x = a[0] || 0, y = a[1] || 0;
  if (Math.abs(x) < DEADZONE) x = 0;
  if (Math.abs(y) < DEADZONE) y = 0;
  vrController.rotation.y -= x * 0.08;
  vrController.rotation.x -= y * 0.08;
  vrController.rotation.x = THREE.MathUtils.clamp(vrController.rotation.x, -1.4, 0.8);
}

// === Click principal VR ===
function onSelect() {
  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3(0,0,-1).applyQuaternion(vrController.quaternion);
  raycaster.ray.set(vrController.getWorldPosition(origin), direction);

  const hits = raycaster.intersectObjects(scene.children, true);
  if (hits.length === 0) {
    if (infoPanel && infoPanel.visible) infoPanel.visible = false;
    return;
  }

  let obj = hits[0].object;
  while (obj && !obj.userData.isGLTFModel && !obj.userData.type) obj = obj.parent;
  if (!obj) return;

  // 1. Rotar el avión
  if (obj.userData.isGLTFModel) {
    if (selectedModel === obj) isRotating = !isRotating;
    else { selectedModel = obj; isRotating = true; }
    if (infoPanel) infoPanel.visible = false;
  }

  // 2. Botón INFO
  else if (obj.userData.type === "info") {
    infoPanel.visible = true;
  }

  // 3. Botón JUEGO
  else if (obj.userData.type === "game") {
    if (confirm("¿Iniciar minijuego de vuelo?")) location.href = "minigame.html";
  }
}

// === Bucle de animación ===
function animate() {
  if (vrController) {
    handleController();
    laserPointer.visible = true;
    checkHover();
  } else {
    laserPointer.visible = false;
  }

  if (isRotating && selectedModel) {
    selectedModel.rotation.y += 0.01;
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
