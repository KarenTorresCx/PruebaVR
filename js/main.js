import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

let camera, scene, renderer, clock;
let player, rings = [];
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let cabina, score = 0;
let scoreElement, timerElement, endScreen, finalScore;
let gameOver = false;
let gameTime = 60;
let gameStarted = false;

// GAMEPAD
let lastButtons = [];
let lastAxes = [];
let gamepadConnected = false;
const AXIS_THRESHOLD = 0.25;

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

  scoreElement.style.display = 'block';
  timerElement.style.display = 'block';

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.xr.enabled = true;
  document.getElementById('container')?.appendChild(renderer.domElement);

  document.body.appendChild(VRButton.createButton(renderer));

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0f0f1f, 0.001);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 2, 5);

  const cubeLoader = new THREE.CubeTextureLoader();
  cubeLoader.setPath('cubemap/');
  const textureCube = cubeLoader.load(['px.png','nx.png','py.png','ny.png','pz.png','nz.png']);
  scene.background = textureCube;

  const textureLoader = new THREE.TextureLoader();

  const playerGeometry = new THREE.CapsuleGeometry(0.5, 1.5, 8, 16);
  const playerMaterial = new THREE.MeshBasicMaterial({ visible: false });
  player = new THREE.Mesh(playerGeometry, playerMaterial);
  scene.add(player);

  const cabinaTexture = textureLoader.load('textures/avionhud.png');
  const cabinaMaterial = new THREE.MeshBasicMaterial({
    map: cabinaTexture,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    depthTest: false
  });

  const aspect = window.innerWidth / window.innerHeight;
  const hudHeight = 2;
  const hudWidth = hudHeight * aspect;

  cabina = new THREE.Mesh(new THREE.PlaneGeometry(hudWidth, hudHeight), cabinaMaterial);
  cabina.position.set(0, 0, -1.4);
  camera.add(cabina);
  scene.add(camera);

  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const sun = new THREE.DirectionalLight(0x99ccff, 1.2);
  sun.position.set(100, 100, 50);
  sun.castShadow = true;
  scene.add(sun);

  generateRings(30);

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  window.addEventListener("gamepadconnected", e => {
    console.log("Gamepad conectado:", e.gamepad);
    gamepadConnected = true;
    trackGamepad();
  });

  window.addEventListener("resize", onWindowResize);

  clock = new THREE.Clock();
  startTimer();
}

function generateRings(count) {
  const geometry = new THREE.TorusGeometry(18, 4, 16, 100);

  for (let i = 0; i < count; i++) {
    const color = new THREE.Color(`hsl(${Math.random() * 360}, 100%, 60%)`);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 1.0,
      roughness: 0.15,
      emissive: color.clone().multiplyScalar(0.5),
      emissiveIntensity: 0.7
    });

    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = Math.PI;
    ring.position.set((Math.random() - 0.5) * 400, 5, -150 - i * 70 - Math.random() * 50);

    ring.userData = {
      hue: Math.random() * 360,
      rotationSpeed: Math.random() * 0.02 + 0.01,
      colorSpeed: 0.5 + Math.random() * 0.5
    };

    rings.push(ring);
    scene.add(ring);
  }
}

// KEYBOARD
function onKeyDown(e) {
  if (gameOver) return;
  if (e.code === 'KeyW') moveForward = true;
  if (e.code === 'KeyS') moveBackward = true;
  if (e.code === 'KeyA') moveLeft = true;
  if (e.code === 'KeyD') moveRight = true;
}
function onKeyUp(e) {
  if (e.code === 'KeyW') moveForward = false;
  if (e.code === 'KeyS') moveBackward = false;
  if (e.code === 'KeyA') moveLeft = false;
  if (e.code === 'KeyD') moveRight = false;
}

function trackGamepad() {
  const gp = navigator.getGamepads()[0];
  if (!gp) {
    requestAnimationFrame(trackGamepad);
    return;
  }

  gp.buttons.forEach((btn, i) => {
    if (btn.pressed !== lastButtons[i]) {
      console.log("Botón", i, btn.pressed);
      lastButtons[i] = btn.pressed;

      if (i === 2) moveForward = btn.pressed; // Botón C
    }
  });

  gp.axes.forEach((value, i) => {
    const v = Math.abs(value) < AXIS_THRESHOLD ? 0 : Number(value.toFixed(2));
    if (v !== lastAxes[i]) {
      console.log("Eje", i, v);
      lastAxes[i] = v;

      if (i === 0) { moveLeft = v < -0.3; moveRight = v > 0.3; }
      if (i === 1) { moveForward = v < -0.3; moveBackward = v > 0.3; }
    }
  });

  requestAnimationFrame(trackGamepad);
}

function updatePlayer(delta) {
  const speed = 20 * delta;
  if (moveForward) player.position.z -= speed;
  if (moveBackward) player.position.z += speed;
  if (moveLeft) player.position.x -= speed;
  if (moveRight) player.position.x += speed;

  camera.position.copy(player.position).add(new THREE.Vector3(0, 2, 5));
  camera.lookAt(player.position.x, player.position.y + 2, player.position.z - 5);
}

function checkRingCollisions() {
  rings.forEach(r => {
    const dist = player.position.distanceTo(r.position);
    if (dist < 10) {
      score += 10;
      scoreElement.innerHTML = `SCORE: ${score}`;
      r.position.z = -200 - Math.random() * 200;
      r.position.x = (Math.random() - 0.5) * 200;
      r.position.y = Math.random() * 10 + 2;
    }
  });
}

function startTimer() {
  const interval = setInterval(() => {
    if (gameOver) return clearInterval(interval);

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
  finalScore.textContent = score;

  scoreElement.style.display = 'none';
  timerElement.style.display = 'none';
  endScreen.style.display = 'flex';
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    if (!gameOver && gameStarted) {
      updatePlayer(delta);
      checkRingCollisions();

      rings.forEach(r => {
        r.position.z += 8 * delta;
        r.rotation.z += r.userData.rotationSpeed;

        r.userData.hue = (r.userData.hue + r.userData.colorSpeed) % 360;
        const newColor = new THREE.Color(`hsl(${r.userData.hue}, 100%, 60%)`);
        r.material.color.copy(newColor);
        r.material.emissive.copy(newColor.clone().multiplyScalar(0.5));

        if (r.position.z > 50) {
          r.position.z = -200 - Math.random() * 200;
          r.position.x = (Math.random() - 0.5) * 200;
        }
      });
    }

    renderer.render(scene, camera);
  });
}
