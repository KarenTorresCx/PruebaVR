import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// === ELEMENTOS ===
let camera, scene, renderer, player;
let rings = [];
let score = 0, timeLeft = 60, gameOver = false;
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');

// === FÍSICA ===
let speed = 0;
let lateral = 0;
const MAX_SPEED = 40;
const MAX_LATERAL = 25;
const DEADZONE = 0.2;
const TUNNEL_WIDTH = 80;

// === INICIO ===
init();
animate();
startTimer();

// === INICIALIZACIÓN ===
function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.getElementById('container').appendChild(renderer.domElement);

  // VR Button
  document.getElementById('vrButton').appendChild(VRButton.createButton(renderer));

  // Escena
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x001122, 0.002);

  // Cámara
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.8, 5);

  // Skybox
  const loader = new THREE.CubeTextureLoader();
  loader.setPath('cubemap/');
  scene.background = loader.load(['px.png','nx.png','py.png','ny.png','pz.png','nz.png']);

  // Luces
  scene.add(new THREE.AmbientLight(0x404040));
  const sun = new THREE.DirectionalLight(0xaaccff, 1.2);
  sun.position.set(50, 100, 50);
  scene.add(sun);

  // Jugador
  player = new THREE.Object3D();
  scene.add(player);

  // HUD Cabina
  const hudTex = new THREE.TextureLoader().load('textures/avionhud.png');
  const hudMat = new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, opacity: 0.8, depthTest: false });
  const hud = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), hudMat);
  hud.position.z = -1;
  camera.add(hud);
  scene.add(camera);

  // Generar aros
  generateRings(30);

  // Resize
  window.addEventListener('resize', onWindowResize);
}

// === GENERAR AROS ===
function generateRings(count) {
  const geo = new THREE.TorusGeometry(12, 3, 16, 100);
  for (let i = 0; i < count; i++) {
    const hue = Math.random() * 360;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(`hsl(${hue}, 100%, 60%)`),
      emissive: new THREE.Color(`hsl(${hue}, 100%, 40%)`),
      metalness: 0.8, roughness: 0.2
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = Math.PI;
    ring.position.set(
      (Math.random() - 0.5) * 200,
      Math.random() * 20,
      -100 - i * 50
    );
    ring.userData = { hue, speed: 0.02 + Math.random() * 0.02 };
    rings.push(ring);
    scene.add(ring);
  }
}

// === CONTROLES JOYSTICK ===
function updateControls() {
  const gp = navigator.getGamepads()[0];
  if (!gp) return;

  const x = gp.axes[0] || 0;
  const y = gp.axes[1] || 0;

  // Acelerar / Frenar
  if (y < -DEADZONE) speed = THREE.MathUtils.lerp(speed, MAX_SPEED, 0.1);
  else if (y > DEADZONE) speed = THREE.MathUtils.lerp(speed, 0, 0.15);
  else speed *= 0.94;

  // Lateral
  if (Math.abs(x) > DEADZONE) lateral = THREE.MathUtils.lerp(lateral, x * MAX_LATERAL, 0.12);
  else lateral *= 0.88;
}

// === ACTUALIZAR JUGADOR ===
function updatePlayer(delta) {
  updateControls();

  // Avanzar
  player.position.z -= speed * delta;

  // Lateral
  player.position.x += lateral * delta;
  player.position.x = THREE.MathUtils.clamp(player.position.x, -TUNNEL_WIDTH, TUNNEL_WIDTH);

  // Rotación visual
  player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, -lateral * 0.03, 0.1);
  player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, speed > 10 ? -0.15 : 0, 0.1);

  // Cámara
  const camPos = player.position.clone().add(new THREE.Vector3(0, 1.8, 5));
  camera.position.lerp(camPos, 0.1);
}

// === COLISIONES ===
function checkCollisions() {
  rings.forEach(ring => {
    const dist = player.position.distanceTo(ring.position);
    if (dist < 10) {
      score += 10;
      scoreEl.textContent = `SCORE: ${score}`;
      respawnRing(ring);
    }
  });
}

function respawnRing(ring) {
  ring.position.z = player.position.z - 300 - Math.random() * 200;
  ring.position.x = (Math.random() - 0.5) * 200;
  ring.position.y = Math.random() * 20;
}

// === TIMER ===
function startTimer() {
  const interval = setInterval(() => {
    if (gameOver) return clearInterval(interval);
    timeLeft--;
    timerEl.textContent = `TIME: ${timeLeft}s`;
    if (timeLeft <= 0) endGame();
  }, 1000);
}

function endGame() {
  gameOver = true;
  finalScoreEl.textContent = score;
  gameOverEl.style.display = 'flex';
}

// === REINICIAR CON A ===
document.addEventListener('keydown', e => {
  if (gameOver && e.code === 'KeyA') location.reload();
});

// === RESIZE ===
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// === LOOP ===
function animate() {
  const delta = renderer.xr.isPresenting ? 0.016 : performance.now() / 1000;
  if (!gameOver) {
    updatePlayer(delta);
    checkCollisions();

    // Mover aros
    rings.forEach(r => {
      r.position.z += (10 + speed * 0.1) * delta;
      r.rotation.z += r.userData.speed;
      if (r.position.z > player.position.z + 50) respawnRing(r);
    });
  }

  renderer.render(scene, camera);
  renderer.setAnimationLoop(animate);
}
