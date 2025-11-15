import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js'; // ← VRButton oficial

let camera, scene, renderer, clock;
let player, rings = [];
let cabina, score = 0;
let scoreElement, timerElement, endScreen, finalScore, debugElement;
let gameOver = false;
let gameTime = 60;
let gameStarted = false;

// Controles
let vrControls = null;
let gamepadConnected = false;
let currentGamepad = null;

// Vuelo
let velocity = new THREE.Vector3();
let acceleration = 0;
let maxSpeed = 50;
let rollAngle = 0;
let pitchAngle = 0;
const rollSensitivity = 2.5;
const pitchSensitivity = 1.5;

// DeviceOrientationControls manual (para móviles sin VR)
class DeviceOrientationControls {
  constructor(object) {
    this.object = object;
    this.object.rotation.reorder('YXZ');
    this.enabled = true;
    this.deviceOrientation = {};
    this.screenOrientation = 0;

    const onDeviceOrientation = (event) => {
      if (event.alpha !== null) {
        this.deviceOrientation = {
          alpha: THREE.MathUtils.degToRad(event.alpha),
          beta: THREE.MathUtils.degToRad(event.beta),
          gamma: THREE.MathUtils.degToRad(event.gamma)
        };
      }
    };

    const onScreenOrientation = () => {
      this.screenOrientation = window.orientation || 0;
    };

    window.addEventListener('deviceorientation', onDeviceOrientation);
    window.addEventListener('orientationchange', onScreenOrientation);

    this.connect = () => {
      onScreenOrientation();
    };

    this.update = () => {
      if (!this.deviceOrientation.alpha) return;
      const { alpha, beta, gamma } = this.deviceOrientation;
      this.object.quaternion.setFromEuler(new THREE.Euler(beta, alpha, -gamma, 'YXZ'));
    };

    this.dispose = () => {
      window.removeEventListener('deviceorientation', onDeviceOrientation);
      window.removeEventListener('orientationchange', onScreenOrientation);
    };
  }
}

export function startGame() {
  if (!gameStarted) {
    gameStarted = true;
    init();
    animate();
  }
}
window.startGame = startGame;

function init() {
  scoreElement = document.getElementById('scoreHUD');
  timerElement = document.getElementById('timerHUD');
  endScreen = document.getElementById('endScreen');
  finalScore = document.getElementById('finalScore');
  debugElement = document.getElementById('debugHUD');

  scoreElement.style.display = 'block';
  timerElement.style.display = 'block';
  debugElement.style.display = 'block';

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.xr.enabled = true; // ← Necesario para WebXR
  document.getElementById('container').appendChild(renderer.domElement);

  // Escena
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0f0f1f, 0.001);

  // Cámara
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 1.8, 5);

  // === VR BUTTON ===
  const vrButton = VRButton.createButton(renderer);
  document.getElementById('vrButton').replaceWith(vrButton);
  document.getElementById('vrButtonContainer').style.display = 'block';

  // Fallback: orientación del dispositivo
  if (!navigator.xr) {
    vrControls = new DeviceOrientationControls(camera);
    vrControls.connect();
  }

  // Skybox
  const cubeLoader = new THREE.CubeTextureLoader();
  cubeLoader.setPath('cubemap/');
  scene.background = cubeLoader.load(['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png']);

  const textureLoader = new THREE.TextureLoader();

  // Jugador
  player = new THREE.Object3D();
  scene.add(player);

  // Cabina HUD (solo visible en modo no-VR o en VR con overlay)
  const cabinaTexture = textureLoader.load('textures/avionhud.png');
  const cabinaMaterial = new THREE.MeshBasicMaterial({
    map: cabinaTexture,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthTest: false
  });

  const aspect = window.innerWidth / window.innerHeight;
  const hudHeight = 1.4;
  const hudWidth = hudHeight * aspect * 0.8;

  cabina = new THREE.Mesh(new THREE.PlaneGeometry(hudWidth, hudHeight), cabinaMaterial);
  cabina.position.set(0, 0, -0.8);
  camera.add(cabina);
  scene.add(camera);

  // Luces
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0x99ccff, 1.3);
  sun.position.set(100, 100, 50);
  sun.castShadow = true;
  scene.add(sun);

  // Aros
  generateRings(40);

  // Eventos
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('gamepadconnected', onGamepadConnect);
  window.addEventListener('gamepaddisconnected', onGamepadDisconnect);

  clock = new THREE.Clock();
  startTimer();

  // Iniciar render loop
  renderer.setAnimationLoop(animate); // ← WebXR usa setAnimationLoop
}

function onGamepadConnect(e) {
  gamepadConnected = true;
  currentGamepad = e.gamepad;
  debugElement.innerHTML = `Gamepad: ${e.gamepad.id}`;
}

function onGamepadDisconnect() {
  gamepadConnected = false;
  currentGamepad = null;
  debugElement.innerHTML = 'Gamepad desconectado';
}

function generateRings(count) {
  const geometry = new THREE.TorusGeometry(15, 3.5, 16, 100);
  for (let i = 0; i < count; i++) {
    const color = new THREE.Color(`hsl(${Math.random() * 360}, 100%, 60%)`);
    const material = new THREE.MeshStandardMaterial({
      color, metalness: 0.9, roughness: 0.2,
      emissive: color.clone().multiplyScalar(0.4), emissiveIntensity: 0.8
    });

    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = Math.PI;
    ring.position.set(
      (Math.random() - 0.5) * 300,
      Math.random() * 15,
      -200 - i * 60 - Math.random() * 40
    );
    ring.castShadow = true;
    ring.userData = {
      hue: Math.random() * 360,
      rotationSpeed: 0.015 + Math.random() * 0.03,
      colorSpeed: 0.4 + Math.random() * 0.6
    };
    rings.push(ring);
    scene.add(ring);
  }
}

// Controles teclado
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
function onKeyDown(e) { if (!gameOver) { if (e.code === 'KeyW') moveForward = true; if (e.code === 'KeyS') moveBackward = true; if (e.code === 'KeyA') moveLeft = true; if (e.code === 'KeyD') moveRight = true; } }
function onKeyUp(e) { if (e.code === 'KeyW') moveForward = false; if (e.code === 'KeyS') moveBackward = false; if (e.code === 'KeyA') moveLeft = false; if (e.code === 'KeyD') moveRight = false; }

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  const aspect = window.innerWidth / window.innerHeight;
  if (cabina) {
    cabina.geometry.dispose();
    cabina.geometry = new THREE.PlaneGeometry(1.4 * aspect * 0.8, 1.4);
  }
}

function updateFlightControls(delta) {
  if (gamepadConnected && currentGamepad) {
    const gp = currentGamepad;
    const stickLX = gp.axes[0] || 0;
    const stickLY = gp.axes[1] || 0;

    rollAngle = THREE.MathUtils.clamp(stickLX * rollSensitivity, -1.5, 1.5);
    pitchAngle = -THREE.MathUtils.clamp(stickLY * pitchSensitivity, -1.2, 1.2);

    const accel = gp.buttons[0].pressed || gp.buttons[7].pressed;
    const brake = gp.buttons[1].pressed || gp.buttons[6].pressed;

    if (accel) acceleration = Math.min(acceleration + 30 * delta, maxSpeed);
    else if (brake) acceleration = Math.max(acceleration - 35 * delta, 0);
    else acceleration *= 0.94;

    debugElement.innerHTML = `Speed: ${acceleration.toFixed(0)} | Roll: ${rollAngle.toFixed(1)} | Pitch: ${pitchAngle.toFixed(1)}`;
  } else {
    if (moveForward) acceleration = Math.min(acceleration + 30 * delta, maxSpeed);
    if (moveBackward) acceleration = Math.max(acceleration - 35 * delta, 0);
    else acceleration *= 0.94;

    if (moveLeft) rollAngle = Math.max(rollAngle - 2.5 * delta, -1.5);
    if (moveRight) rollAngle = Math.min(rollAngle + 2.5 * delta, 1.5);
    else rollAngle *= 0.88;

    pitchAngle *= 0.9;
  }
}

function updatePlayer(delta) {
  updateFlightControls(delta);

  player.rotation.z = rollAngle * 0.7;
  player.rotation.x = pitchAngle * 0.5;

  const forwardSpeed = acceleration * delta;
  const forward = new THREE.Vector3(0, -Math.sin(pitchAngle), -Math.cos(pitchAngle));
  velocity.add(forward.multiplyScalar(forwardSpeed));
  velocity.x += rollAngle * 0.3 * forwardSpeed * delta;
  velocity.multiplyScalar(0.98);
  player.position.add(velocity);
  player.position.y = THREE.MathUtils.clamp(player.position.y, -20, 40);

  // Cámara sigue al jugador
  camera.position.lerp(player.position.clone().add(new THREE.Vector3(0, 1.8, 5)), 0.1);

  // Orientación del dispositivo (solo si no estamos en VR)
  if (vrControls && !renderer.xr.isPresenting) {
    vrControls.update();
  }
}

function checkRingCollisions() {
  rings.forEach(r => {
    if (player.position.distanceTo(r.position) < 12) {
      score += 10;
      scoreElement.innerHTML = `SCORE: ${score}`;
      r.position.z = player.position.z - 300 - Math.random() * 200;
      r.position.x = (Math.random() - 0.5) * 300;
      r.position.y = Math.random() * 20;
    }
  });
}

function startTimer() {
  const interval = setInterval(() => {
    if (gameOver) { clearInterval(interval); return; }
    gameTime--;
    timerElement.innerHTML = `TIME: ${gameTime}s`;
    if (gameTime <= 0) { clearInterval(interval); endGame(); }
  }, 1000);
}

function endGame() {
  gameOver = true;
  acceleration = 0;
  velocity.set(0, 0, 0);
  ['scoreHUD', 'timerHUD', 'debugHUD'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  finalScore.textContent = score;
  endScreen.style.display = 'flex';
}

function animate() {
  const delta = clock.getDelta();
  if (!gameOver && gameStarted) {
    updatePlayer(delta);
    checkRingCollisions();

    rings.forEach(r => {
      r.position.z += (12 + acceleration * 0.1) * delta;
      r.rotation.z += r.userData.rotationSpeed;
      r.userData.hue = (r.userData.hue + r.userData.colorSpeed) % 360;
      const color = new THREE.Color(`hsl(${r.userData.hue}, 100%, 60%)`);
      r.material.color.copy(color);
      r.material.emissive.copy(color.clone().multiplyScalar(0.4));
      if (r.position.z > player.position.z + 100) {
        r.position.z = player.position.z - 300 - Math.random() * 200;
        r.position.x = (Math.random() - 0.5) * 300;
        r.position.y = Math.random() * 20;
      }
    });

    // Gamepad polling
    const gamepads = navigator.getGamepads();
    if (gamepads[0]) { currentGamepad = gamepads[0]; gamepadConnected = true; }
  }

  renderer.render(scene, camera);
}
