import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/webxr/VRButton.js';

///scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);
renderer.xr.enabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

//boton VR
document.body.appendChild(VRButton.createButton(renderer));

//texture HDRI
const loader = new THREE.CubeTextureLoader();
loader.setPath('cubemap/');
const textureCube = loader.load([
  'px.png', 'nx.png',
  'py.png', 'ny.png',
  'pz.png', 'nz.png'
]);
scene.background = textureCube

//manager
const manager = new THREE.LoadingManager();
// Modelos GLB
const loaderGLB = new GLTFLoader(manager);

//orbit
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.update();

const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( geometry, material );
cube.position.set(0, 2, -3);
scene.add( cube );

camera.position.z = 5;

//Modelos GLB
function loadAndAddGLBModel(filePath, position, scale, rotation, scene) {
  loaderGLB.load(filePath, function (gltf) {
    const model = gltf.scene;
    model.position.set(position.x, position.y, position.z);
    model.scale.set(scale.x, scale.y, scale.z);
    model.rotation.set(rotation.x, rotation.y, rotation.z);
    model.castShadow = true;
    model.receiveShadow = true;
    scene.add(model);
  }, undefined, function (error) {
    console.error('Error loading GLB model:', error);
  });
}
//verde
loadAndAddGLBModel(
  'modelos/avion2.glb',
  { x: 0, y: 2, z: -3},
  { x: 0.003, y: 0.003, z: 0.003 },
  { x: 0, y: Math.PI/2, z: 0 },
  scene
);

let vrController = null;
let laserPointer = null;

const laserGeometry = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, -20)
]);
const laserMaterial = new THREE.LineBasicMaterial({
  color: 0xff0000,
  linewidth: 3,
  opacity: 0.8,
  transparent: true
});
laserPointer = new THREE.Line(laserGeometry, laserMaterial);
laserPointer.visible = false;

// Zona de muerte y sensibilidad
const DEADZONE = 0.25;
const SENSITIVITY = 3.0;

// Detectar cuando se conecta el mando VRBox
renderer.xr.addEventListener('sessionstart', () => {
  const controller = renderer.xr.getController(0);
  
  // ¡¡ESTAS SON LAS LÍNEAS CLAVE!!
  controller.position.set(0, 10, 0);   // altura de ojos
  controller.rotation.set(THREE.MathUtils.degToRad(15), 0, 0);

  controller.add(laserPointer);
  scene.add(controller);
  vrController = controller;

  controller.addEventListener('select', () => {
    performRaycastClick();
  });

  const grip = renderer.xr.getControllerGrip(0);
  grip.position.copy(controller.position);
  grip.rotation.copy(controller.rotation);
  scene.add(grip);
});

// Manejar el joystick con zona de muerte
function handleController(controller) {
  if (!controller?.gamepad) return;

  const axes = controller.gamepad.axes;
  if (axes.length < 2) return;

  let x = axes[0];
  let y = axes[1];

  // Zona de muerte
  if (Math.abs(x) < DEADZONE) x = 0;
  if (Math.abs(y) < DEADZONE) y = 0;

  // Aplicar movimiento suave
  controller.rotation.y -= x * SENSITIVITY * 0.05;
  controller.rotation.x -= y * SENSITIVITY * 0.05;

  // Limitar arriba/abajo
  controller.rotation.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, controller.rotation.x));
}
// NUEVAS FUNCIONALIDADES (agregar al final de tu main.js)
// ================================================================

let isAvionRotating = false;        // para rotar el avión al hacer clic
let infoSphere = null;              // esfera de curiosidades
let playButton = null;              // botón verde "Jugar"

// 1. Crear esfera de curiosidades (lado izquierdo)
function createCuriositiesSphere() {
  const geo = new THREE.SphereGeometry(0.4, 32, 32);
  const mat = new THREE.MeshStandardMaterial({ 
    color: 0x00aaff, 
    emissive: 0x0088ff,
    emissiveIntensity: 0.6,
    metalness: 0.3,
    roughness: 0.4
  });
  infoSphere = new THREE.Mesh(geo, mat);
  infoSphere.position.set(-2, 2, -3);
  infoSphere.userData.clickable = true;
  infoSphere.userData.type = "info";
  scene.add(infoSphere);

  // Texto flotante encima
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 512; canvas.height = 128;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0,0,512,128);
  ctx.font = "bold 56px Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.fillText("Curiosidades WW2", 256, 85);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(3, 0.8, 1);
  sprite.position.set(-2.5, 2.7, -3);
  scene.add(sprite);
}

// 2. Crear botón "Jugar Minijuego" (lado izquierdo)
function createPlayButton() {
  const geo = new THREE.BoxGeometry(1.2, 0.6, 0.2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
  playButton = new THREE.Mesh(geo, mat);
  playButton.position.set(2, 2, -3);
  playButton.userData.clickable = true;
  playButton.userData.type = "play";
  scene.add(playButton);

  // Texto "JUGAR"
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 512; canvas.height = 128;
  ctx.fillStyle = "#006600";
  ctx.fillRect(0,0,512,128);
  ctx.font = "bold 80px Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.fillText("JUGAR", 256, 90);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  sprite.scale.set(1.5, 0.75, 1);
  sprite.position.copy(playButton.position);
  scene.add(sprite);
}

// 3. Panel de curiosidades (HTML flotante)
function showCuriositiesPanel() {
  if (document.getElementById("curiositiesPanel")) return;

  const panel = document.createElement("div");
  panel.id = "curiositiesPanel";
  panel.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 90%; max-width: 700px; background: rgba(0,0,0,0.95);
    color: white; padding: 30px; border-radius: 20px; z-index: 9999;
    font-family: Arial; text-align: center; border: 4px solid #00aaff;
  `;
  panel.innerHTML = `
    <h2>CURIOSIDADES DEL AVIÓN WW2</h2>
    <ul style="text-align:left; font-size:20px; line-height:2.2;">
      <li>El Spitfire podía girar más rápido que cualquier caza alemán</li>
      <li>El P-51 Mustang voló desde Inglaterra hasta Berlín y regresó</li>
      <li>El Zero japonés era tan ligero que no llevaba blindaje</li>
      <li>El Messerschmitt Bf 109 fue el más producido de la guerra</li>
      <li>El F4U Corsair tenía alas "gaviota" invertidas para mejor aterrizaje</li>
    </ul>
    <button onclick="this.parentElement.remove()" 
            style="margin-top:20px; padding:15px 40px; font-size:22px; background:#00aaff; border:none; border-radius:12px; cursor:pointer;">
      Cerrar
    </button>
  `;
  document.body.appendChild(panel);
}

// 4. Minijuego (el mismo que me diste, pero simplificado y funcional en VR)
function launchMinigame() {
  const overlay = document.createElement("div");
  overlay.id = "minigameOverlay";
  overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:black; z-index:10000;";
  overlay.innerHTML = `
    <div style="position:absolute; top:20px; left:20px; color:white; font-size:30px;">SCORE: <span id="mgScore">0</span></div>
    <div style="position:absolute; top:20px; right:20px; color:white; font-size:30px;">TIME: <span id="mgTime">60</span>s</div>
    <div id="mgEnd" style="display:none; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:rgba(0,0,0,0.9); padding:40px; border-radius:20px; text-align:center; color:white;">
      <h1>¡Fin del juego!</h1>
      <h2>Puntuación: <span id="mgFinal">0</span></h2>
      <button onclick="document.getElementById('minigameOverlay').remove()" 
              style="margin-top:20px; padding:15px 40px; font-size:24px; background:#00ff00; border:none; border-radius:12px; cursor:pointer;">
        Volver
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  let mgScore = 0;
  let mgTime = 60;
  const scoreEl = document.getElementById("mgScore");
  const timeEl = document.getElementById("mgTime");

  const timer = setInterval(() => {
    mgTime--;
    timeEl.textContent = mgTime;
    if (mgTime <= 0) {
      clearInterval(timer);
      document.getElementById("mgFinal").textContent = mgScore;
      document.getElementById("mgEnd").style.display = "block";
    }
  }, 1000);

  // Aquí puedes poner un mensaje simple o un mini-canvas 2D si quieres
  // Por ahora solo cuenta puntos al hacer clic con el gatillo mientras dura el tiempo
  const clickHandler = () => {
    if (mgTime > 0) {
      mgScore += 10;
      scoreEl.textContent = mgScore;
    }
  };
  const tempHandler = () => { vrController.addEventListener("select", clickHandler); };
  tempHandler();
}

// Crear los objetos UI al cargar el modelo
gltfLoader.load('modelos/avionV.glb', (gltf) => {
  // ... tu código actual de carga del avión ...

  scene.add(gltf.scene);
  createCuriositiesSphere();
  createPlayButton();
});

// Modificar la función performRaycastClick() que ya tienes para que reconozca los nuevos objetos
// (reemplaza SOLO esta función, el resto queda igual)
function performRaycastClick() {
  if (!vrController) return;

  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(vrController.matrixWorld);
  const raycaster = new THREE.Raycaster();
  raycaster.ray.origin.setFromMatrixPosition(vrController.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    const obj = intersects[0].object;

    // 1. Clic en el avión → activar/desactivar rotación
    if (obj.parent && obj.parent.type === "Group" && obj.parent.position.y === 2) { // detecta tu avión
      isAvionRotating = !isAvionRotating;
    }

    // 2. Clic en esfera de curiosidades
    if (obj === infoSphere) {
      showCuriositiesPanel();
    }

    // 3. Clic en botón JUGAR
    if (obj === playButton) {
      launchMinigame();
    }
  }
}

function animate() {
  if (isAvionRotating && avionModel) {
    avionModel.rotation.y += 0.01;
  }
  // Manejar mando VRBox
  if (vrController) {
    handleController(vrController);
    laserPointer.visible = true;
  } else {
    laserPointer.visible = false;
  }

  controls.update();

  renderer.render( scene, camera );

}
