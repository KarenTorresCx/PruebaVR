import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

let camera, scene, renderer, clock;
let player, rings = [];
let cabina, score = 0;
let scoreElement, timerElement, endScreen, finalScore, debugElement;
let gameOver = false;
let gameTime = 60;
let gameStarted = false;

// Controles
let gamepadConnected = false;
let currentGamepad = null;

// Física
let velocity = new THREE.Vector3();
let acceleration = 0;
let maxSpeed = 40;
let lateralSpeed = 0;
let maxLateral = 25;
let playerXLimit = 80;
const DEADZONE = 0.2;

// DeviceOrientation (fuera de VR)
let deviceOrientation = null;

export function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  init();
}
window.startGame = startGame;

// === ARRANQUE AUTOMÁTICO ===
window.addEventListener('load', () => {
  setTimeout(startGame, 100);
});

function init() {
  // HUD
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
  renderer.xr.enabled = true;
  document.getElementById('container').appendChild(renderer.domElement);

  // Escena
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0f0f1f, 0.001);

  // Cámara
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 1.8, 5);

  // === VR BUTTON ===
  const vrButton = VRButton.createButton(renderer);
  document.getElementById('vrButtonContainer').appendChild(vrButton);

  // === ORIENTACIÓN MÓVIL (solo si no hay VR) ===
  if (!navigator.xr) {
    deviceOrientation = new DeviceOrientationControls(camera);
    deviceOrientation.connect();
  }

  // Skybox
  const cubeLoader = new THREE.CubeTextureLoader();
  cubeLoader.setPath('cubemap/');
  scene.background = cubeLoader.load(['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png']);

  const textureLoader = new THREE.TextureLoader();

  // Jugador
  player = new THREE.Object3D();
  player.position.set(0, 0, 0);
  scene.add(player);

  // Cabina HUD
  const cabinaTexture = textureLoader.load('textures/avionhud.png');
  const cabinaMaterial = new THREE.MeshBasicMaterial({
    map: cabinaTexture,
    transparent: true,
    opacity: 0.9,
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
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('gamepadconnected', onGamepadConnect);
  window.addEventListener('gamepaddisconnected', onGamepadDisconnect);

  // === REINICIAR CON TECLA A ===
  document.addEventListener('keydown', (e) => {
    if (gameOver && e.code === 'KeyA') {
      location.reload();
    }
  });

  clock = new THREE.Clock();
  startTimer();

  // Render loop (WebXR)
  renderer.setAnimationLoop(animate);
}

// === DEVICE ORIENTATION MANUAL ===
class DeviceOrientationControls {
  constructor(object) {
    this.object = object;
    this.object.rotation.reorder('YXZ');
    this.deviceOrientation = {};

    const onDeviceOrientation = (event) => {
      if (event.alpha !== null) {
        this.deviceOrientation = {
          alpha: THREE.MathUtils.degToRad(event.alpha),
          beta: THREE.MathUtils.degToRad(event.beta),
          gamma: THREE.MathUtils.degToRad(event.gamma)
        };
      }
    };

    window.addEventListener('deviceorientation', onDeviceOrientation);
    this.connect = () => {};
    this.update = () => {
      if (!this.deviceOrientation.alpha) return;
      const { alpha, beta, gamma } = this.deviceOrientation;
      this.object.quaternion.setFromEuler(new THREE.Euler(beta, alpha, -gamma, 'YXZ'));
    };
    this.dispose = () => {
      window.removeEventListener('deviceorientation', onDeviceOrientation);
    };
  }
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

// === CONTROLES DEL JOYSTICK ===
function updateFlightControls(delta) {
  const gp = navigator.getGamepads()[0];
  if (!gp) return;

  const stickX = gp.axes[0] || 0;
  const stickY = gp.axes[1] || 0;

  // ACELERACIÓN / FRENO (Y)
  if (stickY < -DEADZONE) {
    acceleration = THREE.MathUtils.lerp(acceleration, maxSpeed, 0.1);
  } else if (stickY > DEADZONE) {
    acceleration = THREE.MathUtils.lerp(acceleration, 0, 0.15);
  } else {
    acceleration *= 0.94;
  }

  // MOVIMIENTO LATERAL (X)
  if (Math.abs(stickX) > DEADZONE) {
    lateralSpeed = THREE.MathUtils.lerp(lateralSpeed, stickX * maxLateral, 0.12);
  } else {
    lateralSpeed *= 0.88;
  }

  // Debug
  debugElement.innerHTML = `
    Speed: ${acceleration.toFixed(0)} 
    | Lateral: ${lateralSpeed.toFixed(1)} 
    | X: ${player.position.x.toFixed(1)}
  `;
}

// === ACTUALIZAR JUGADOR ===
function updatePlayer(delta) {
  updateFlightControls(delta);

  // Avanzar en Z
  player.position.z -= acceleration * delta;

  // Mover lateralmente
  player.position.x += lateralSpeed * delta;

  // LÍMITES DEL TÚNEL
  player.position.x = THREE.MathUtils.clamp(player.position.x, -playerXLimit, playerXLimit);
  player.position.y = THREE.MathUtils.clamp(player.position.y, -15, 35);

  // ROTACIÓN VISUAL
  player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, -lateralSpeed * 0.03, 0.1);
  player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, acceleration > 10 ? -0.15 : 0, 0.1);

  // CÁMARA SIGUE
  const targetCamPos = player.position.clone().add(new THREE.Vector3(0, 1.8, 5));
  camera.position.lerp(targetCamPos, 0.1);

  // Orientación móvil
  if (deviceOrientation && !renderer.xr.isPresenting) {
    deviceOrientation.update();
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
    if (gameTime <= 0) {
      clearInterval(interval);
      endGame();
    }
  }, 1000);
}

function endGame() {
  gameOver = true;
  acceleration = 0;
  lateralSpeed = 0;
  velocity.set(0, 0, 0);

  ['scoreHUD', 'timerHUD', 'debugHUD'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });

  finalScore.textContent = score;
  endScreen.style.display = 'flex';

  // Mensaje de reinicio
  const msg = document.createElement('p');
  msg.textContent = 'Pulsa A para reiniciar';
  msg.style.color = '#00ffff';
  msg.style.marginTop = '20px';
  msg.style.fontSize = '18px';
  endScreen.querySelector('.end-content').appendChild(msg);
}

function animate() {
  const delta = clock.getDelta();
  if (!gameOver && gameStarted) {
    updatePlayer(delta);
    checkRingCollisions();

    // Mover aros
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
  }

  renderer.render(scene, camera);
}
