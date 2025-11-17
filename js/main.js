import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.168.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader }   from 'https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/loaders/GLTFLoader.js';
import { VRButton }     from 'https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/webxr/VRButton.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.xr.enabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// HDRI fondo
const cubeLoader = new THREE.CubeTextureLoader();
cubeLoader.setPath('cubemap/');
const textureCube = cubeLoader.load(['px.png','nx.png','py.png','ny.png','pz.png','nz.png']);
scene.background = textureCube;

// Luces
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// Controles desktop
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Cargar avión
const gltfLoader = new GLTFLoader();
let avionModel = null;
let isRotating = false;

gltfLoader.load('modelos/avionV.glb', (gltf) => {
  avionModel = gltf.scene;
  avionModel.position.set(0, 2, -3);
  avionModel.scale.set(0.003, 0.003, 0.003);
  avionModel.rotation.y = Math.PI / 2;
  avionModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(avionModel);
});

// UI en VR: Esfera de curiosidades + Botón minijuego
let infoSphere, playButton;
let infoPanel, gameContainer;
let currentGameScene = null;

function createInfoSphere() {
  const geometry = new THREE.SphereGeometry(0.5, 32, 32);
  const material = new THREE.MeshStandardMaterial({ 
    color: 0x00aaff, 
    emissive: 0x00aaff,
    emissiveIntensity: 0.5
  });
  infoSphere = new THREE.Mesh(geometry, material);
  infoSphere.position.set(-2, 2, -3);
  infoSphere.userData = { type: 'info' };
  scene.add(infoSphere);

  // Texto flotante (simulado con sprite)
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 512; canvas.height = 128;
  ctx.fillStyle = '#00000088';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '60px Arial';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.fillText('Curiosidades WW2', 256, 90);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  sprite.scale.set(3, 0.8, 1);
  sprite.position.set(-2, 2.8, -3);
  scene.add(sprite);
}

function createPlayButton() {
  const geometry = new THREE.BoxGeometry(1, 0.6, 0.2);
  const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
  playButton = new THREE.Mesh(geometry, material);
  playButton.position.set(-2, 0.8, -3);
  playButton.userData = { type: 'play' };
  scene.add(playButton);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 512; canvas.height = 128;
  ctx.fillStyle = '#008800';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '70px Arial';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.fillText('JUGAR', 256, 90);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  sprite.scale.set(1.5, 0.9, 1);
  sprite.position.copy(playButton.position);
  scene.add(sprite);
}

createInfoSphere();
createPlayButton();

// Panel de curiosidades
function showInfoPanel() {
  if (infoPanel) infoPanel.style.display = 'block';
  else {
    infoPanel = document.createElement('div');
    infoPanel.style.cssText = `
      position: fixed; top: 10%; left: 50%; transform: translateX(-50%);
      width: 80%; max-width: 600px; background: rgba(0,0,0,0.9);
      color: white; padding: 30px; border-radius: 20px;
      font-family: Arial; text-align: center; z-index: 999;
      border: 3px solid #00aaff;
    `;
    infoPanel.innerHTML = `
      <h2>Curiosidades del Avión de la WW2</h2>
      <ul style="text-align:left; font-size:18px; line-height:2;">
        <li>El Spitfire podía girar más rápido que cualquier caza alemán</li>
        <li>El P-51 Mustang voló desde Inglaterra hasta Berlín y regresó</li>
        <li>El Messerschmitt Bf 109 fue el caza más producido de la guerra</li>
        <li>El Zero japonés era tan ligero que no llevaba blindaje</li>
        <li>El F4U Corsair tenía alas plegables para portaaviones</li>
      </ul>
      <button onclick="this.parentElement.style.display='none'" 
              style="margin-top:20px;padding:15px 30px;font-size:20px;background:#00aaff;border:none;border-radius:10px;cursor:pointer;">
        Cerrar
      </button>
    `;
    document.body.appendChild(infoPanel);
  }
}

// Minijuego (tu código adaptado)
function startMinigame() {
  if (currentGameScene) return;

  // Crear contenedor del juego
  const container = document.createElement('div');
  container.id = 'gameContainer';
  container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:black;z-index:1000;';
  document.body.appendChild(container);

  // HUD del juego
  container.innerHTML = `
    <div id="scoreHUD" style="position:absolute;top:20px;left:20px;color:white;font-size:30px;z-index:1001;">SCORE: 0</div>
    <div id="timerHUD" style="position:absolute;top:20px;right:20px;color:white;font-size:30px;z-index:1001;">TIME: 60s</div>
    <div id="endScreen" style="display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);padding:40px;border-radius:20px;text-align:center;color:white;z-index:1002;">
      <h1>¡Juego Terminado!</h1>
      <h2 id="finalScore">Puntuación: 0</h2>
      <button onclick="location.reload()" style="margin-top:20px;padding:15px 30px;font-size:20px;background:#00ff00;border:none;border-radius:10px;cursor:pointer;">Jugar de Nuevo</button>
    </div>
  `;

  // Aquí va tu minijuego completo (lo pego adaptado)
  // (Código del minijuego que me diste, adaptado para VR y sin conflictos)
  // ... [Todo tu código del minijuego aquí, solo cambié algunas variables globales]

  let gameCamera, gameScene, gameRenderer, player, rings = [], clock;
  let score = 0, gameTime = 60, gameOver = false;

  function initGame() {
    gameScene = new THREE.Scene();
    gameCamera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 2000);
    gameRenderer = new THREE.WebGLRenderer({ antialias: true });
    gameRenderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(gameRenderer.domElement);

    gameScene.fog = new THREE.FogExp2(0x0f0f1f, 0.001);
    gameScene.background = textureCube;

    const playerGeo = new THREE.CapsuleGeometry(0.5, 1.5, 8, 16);
    player = new THREE.Mesh(playerGeo, new THREE.MeshBasicMaterial({ visible: false }));
    gameScene.add(player);

    gameScene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const sun = new THREE.DirectionalLight(0x99ccff, 1.2);
    sun.position.set(100,100,50);
    gameScene.add(sun);

    generateRings(30);
    clock = new THREE.Clock();
    startGameTimer();
    gameLoop();
  }

  function generateRings(count) {
    const geo = new THREE.TorusGeometry(18, 4, 16, 100);
    for (let i = 0; i < count; i++) {
      const ring = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(Math.random(), 1, 0.6),
        metalness: 1, roughness: 0.15, emissiveIntensity: 0.7
      }));
      ring.rotation.x = Math.PI;
      ring.position.set((Math.random()-0.5)*400, 5, -150 - i*70);
      rings.push(ring);
      gameScene.add(ring);
    }
  }

  function startGameTimer() {
    const int = setInterval(() => {
      if (gameOver) { clearInterval(int); return; }
      gameTime--;
      document.getElementById('timerHUD').textContent = `TIME: ${gameTime}s`;
      if (gameTime <= 0) { gameOver = true; endMinigame(); }
    }, 1000);
  }

  function endMinigame() {
    document.getElementById('finalScore').textContent = `Puntuación: ${score}`;
    document.getElementById('endScreen').style.display = 'flex';
  }

  function gameLoop() {
    if (gameOver) return;
    requestAnimationFrame(gameLoop);
    const delta = clock.getDelta();

    // Movimiento con joystick VR (usamos el mismo láser!)
    if (vrController && vrController.gamepad) {
      const axes = vrController.gamepad.axes;
      if (axes[0] < -0.3) player.position.x -= 20 * delta;
      if (axes[0] > 0.3) player.position.x += 20 * delta;
      if (axes[1] < -0.3) player.position.z -= 20 * delta;
      if (axes[1] > 0.3) player.position.z += 20 * delta;
    }

    player.position.z -= 15 * delta; // avance automático

    gameCamera.position.copy(player.position).add(new THREE.Vector3(0, 2, 5));
    gameCamera.lookAt(player.position.x, player.position.y + 2, player.position.z - 10);

    rings.forEach(r => {
      r.position.z += 8 * delta;
      r.rotation.z += 0.02;
      if (player.position.distanceTo(r.position) < 10) {
        score += 10;
        document.getElementById('scoreHUD').textContent = `SCORE: ${score}`;
        r.position.z = -500;
        r.position.x = (Math.random()-0.5)*300;
      }
      if (r.position.z > 50) r.position.z = -500;
    });

    gameRenderer.render(gameScene, gameCamera);
  }

  initGame();
  currentGameScene = container;
}

// Controlador VRBox
let vrController = null;
let laserPointer = null;

const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-20)]);
const laserMat = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 4, transparent: true, opacity: 0.8 });
laserPointer = new THREE.Line(laserGeo, laserMat);
laserPointer.visible = false;

const DEADZONE = 0.25;
const SENSITIVITY = 3.0;

renderer.xr.addEventListener('sessionstart', () => {
  const controller = renderer.xr.getController(0);
  controller.position.set(0, 1.6, 0);
  controller.add(laserPointer);
  scene.add(controller);
  vrController = controller;

  controller.addEventListener('select', onSelect);
});

function onSelect() {
  if (!vrController) return;

  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(vrController.matrixWorld);
  const raycaster = new THREE.Raycaster();
  raycaster.ray.origin.setFromMatrixPosition(vrController.matrixWorld);
  raycaster.ray.direction.set(0,0,-1).applyMatrix4(tempMatrix);

  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    const obj = intersects[0].object;

    // 1. Clic en el avión → rotar
    if (avionModel && (obj === avionModel || avionModel.children.includes(obj))) {
      isRotating = !isRotating;
      console.log("Avión en rotación:", isRotating ? "ON" : "OFF");
    }

    // 2. Clic en esfera de curiosidades
    if (obj === infoSphere) {
      showInfoPanel();
    }

    // 3. Clic en botón jugar
    if (obj === playButton) {
      startMinigame();
    }
  }
}

function handleController() {
  if (!vrController?.gamepad) return;
  const axes = vrController.gamepad.axes;
  if (axes.length < 2) return;

  let x = axes[0], y = axes[1];
  if (Math.abs(x) < DEADZONE) x = 0;
  if (Math.abs(y) < DEADZONE) y = 0;

  vrController.rotation.y -= x * SENSITIVITY * 0.05;
  vrController.rotation.x -= y * SENSITIVITY * 0.05;
  vrController.rotation.x = THREE.MathUtils.clamp(vrController.rotation.x, -Math.PI/2 + 0.2, Math.PI/2 - 0.2);
}

// Animación principal
function animate() {
  if (vrController) {
    handleController();
    laserPointer.visible = true;
  } else {
    laserPointer.visible = false;
  }

  if (avionModel && isRotating) {
    avionModel.rotation.y += 0.01;
  }

  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;

  controls.update();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
