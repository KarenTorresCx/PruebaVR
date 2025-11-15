import * as THREE from 'three';

let camera, scene, renderer, clock;
let player, rings = [];
let cabina, score = 0;
let scoreElement, timerElement, endScreen, finalScore, debugElement;
let gameOver = false;
let gameTime = 60;
let gameStarted = false;

// Controles VR
let vrControls = null;
let gamepadConnected = false;
let currentGamepad = null;

// Variables de vuelo mejoradas
let velocity = new THREE.Vector3();
let acceleration = 0;
let maxSpeed = 50;
let rollAngle = 0;
let pitchAngle = 0;
let yawAngle = 0;
const rollSensitivity = 2.5;
const pitchSensitivity = 1.5;
const joystickThreshold = 0.15;

// Implementación manual de DeviceOrientationControls (deprecado en r134+, fuente oficial Three.js)
class DeviceOrientationControls {
  constructor(object) {
    const scope = this;

    this.object = object;
    this.object.rotation.reorder('YXZ');

    this.enabled = true;
    this.deviceOrientation = {};
    this.screenOrientation = 0;
    this.alphaOffset = 0; // radians
    this.initialOffset = null;

    const onDeviceOrientationChangeEvent = (event) => {
      const device = scope.deviceOrientation;

      if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
        device.alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) + scope.alphaOffset : 0;
        device.beta = event.beta ? THREE.MathUtils.degToRad(event.beta) : 0;
        device.gamma = event.gamma ? THREE.MathUtils.degToRad(event.gamma) : 0;

        if (scope.initialOffset === null) {
          scope.initialOffset = device.alpha;
        }
      } else {
        device.alpha = 0;
        device.beta = 0;
        device.gamma = 0;
      }
    };

    const onScreenOrientationChangeEvent = () => {
      scope.screenOrientation = window.orientation || 0;
    };

    // Listen
    window.addEventListener('orientationchange', onScreenOrientationChangeEvent, false);
    window.addEventListener('deviceorientation', onDeviceOrientationChangeEvent, false);

    // Initial
    onScreenOrientationChangeEvent();

    this.connect = () => {
      onScreenOrientationChangeEvent();
      setTimeout(() => onDeviceOrientationChangeEvent({ alpha: 0, beta: 0, gamma: 0 }), 1000);
    };

    this.update = () => {
      if (scope.deviceOrientation.alpha !== null) {
        scope.object.rotation.y = -scope.deviceOrientation.alpha + this.alphaOffset;
        scope.object.rotation.x = scope.deviceOrientation.beta;
        scope.object.rotation.z = scope.deviceOrientation.gamma;
      }
    };

    this.dispose = () => {
      window.removeEventListener('orientationchange', onScreenOrientationChangeEvent);
      window.removeEventListener('deviceorientation', onDeviceOrientationChangeEvent);
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

  // HUD
  scoreElement.style.display = 'block';
  timerElement.style.display = 'block';
  debugElement.style.display = 'block';

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.xr.enabled = true; // Habilitar XR para VR
  document.getElementById('container')?.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0f0f1f, 0.001);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 2, 5);

  // Controles VR (usando la clase manual)
  vrControls = new DeviceOrientationControls(camera);
  vrControls.connect();

  // Skybox
  const cubeLoader = new THREE.CubeTextureLoader();
  cubeLoader.setPath('cubemap/');
  const textureCube = cubeLoader.load([
    'px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'
  ]);
  scene.background = textureCube;

  const textureLoader = new THREE.TextureLoader();

  // Jugador (ahora invisible, cámara es el jugador)
  player = new THREE.Object3D();
  player.position.set(0, 0, 0);
  scene.add(player);

  // Cabina VR (HUD optimizado para VR)
  const cabinaTexture = textureLoader.load('textures/avionhud.png');
  const cabinaMaterial = new THREE.MeshBasicMaterial({
    map: cabinaTexture,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthTest: false
  });

  const hudHeight = 1.5;
  const aspect = window.innerWidth / window.innerHeight;
  const hudWidth = hudHeight * aspect * 0.8;

  cabina = new THREE.Mesh(new THREE.PlaneGeometry(hudWidth, hudHeight), cabinaMaterial);
  cabina.position.set(0, 0, -0.8);
  camera.add(cabina);

  scene.add(camera);

  // Luces
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0x99ccff, 1.5);
  sun.position.set(100, 100, 50);
  sun.castShadow = true;
  scene.add(sun);

  // Generar aros
  generateRings(40);

  // Event listeners
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', onWindowResize);
  
  // Gamepad
  window.addEventListener('gamepadconnected', onGamepadConnect);
  window.addEventListener('gamepaddisconnected', onGamepadDisconnect);

  clock = new THREE.Clock();
  startTimer();
}

function onGamepadConnect(e) {
  gamepadConnected = true;
  currentGamepad = e.gamepad;
  debugElement.innerHTML += `<br>Gamepad: ${currentGamepad.id}`;
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
      color: color,
      metalness: 0.9,
      roughness: 0.2,
      emissive: color.clone().multiplyScalar(0.4),
      emissiveIntensity: 0.8
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
      rotationSpeed: Math.random() * 0.03 + 0.015,
      colorSpeed: 0.4 + Math.random() * 0.6
    };

    rings.push(ring);
    scene.add(ring);
  }
}

// Controles teclado (backup)
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
function onKeyDown(e) {
  if (gameOver) return;
  switch(e.code) {
    case 'KeyW': moveForward = true; break;
    case 'KeyS': moveBackward = true; break;
    case 'KeyA': moveLeft = true; break;
    case 'KeyD': moveRight = true; break;
  }
}

function onKeyUp(e) {
  switch(e.code) {
    case 'KeyW': moveForward = false; break;
    case 'KeyS': moveBackward = false; break;
    case 'KeyA': moveLeft = false; break;
    case 'KeyD': moveRight = false; break;
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  const aspect = window.innerWidth / window.innerHeight;
  if (cabina) {
    cabina.geometry.dispose();
    cabina.geometry = new THREE.PlaneGeometry(1.5 * aspect * 0.8, 1.5);
  }
}

function updateFlightControls(delta) {
  // Gamepad principal (joystick izquierdo típico)
  if (gamepadConnected && currentGamepad) {
    const gp = currentGamepad;
    
    // Joystick izquierdo: Roll (X) y Pitch (Y)
    const stickLX = gp.axes[0] || 0;
    const stickLY = gp.axes[1] || 0;
    
    rollAngle = THREE.MathUtils.clamp(stickLX * rollSensitivity, -1.5, 1.5);
    pitchAngle = -THREE.MathUtils.clamp(stickLY * pitchSensitivity, -1.2, 1.2);
    
    // Aceleración (botones principales)
    const accelPressed = (gp.buttons[0].pressed || gp.buttons[7].pressed); // Botón 0 o Trigger superior
    const brakePressed = gp.buttons[1].pressed || gp.buttons[6].pressed; // Botón 1 o Trigger inferior
    
    if (accelPressed) acceleration = THREE.MathUtils.clamp(acceleration + 25 * delta, 0, maxSpeed);
    else if (brakePressed) acceleration = THREE.MathUtils.clamp(acceleration - 30 * delta, 0, maxSpeed);
    else acceleration *= 0.95; // Fricción natural
    
    debugElement.innerHTML = `Speed: ${acceleration.toFixed(0)} | Roll: ${rollAngle.toFixed(1)} | Pitch: ${pitchAngle.toFixed(1)}`;
  } else {
    // Fallback teclado
    if (moveForward) acceleration = THREE.MathUtils.clamp(acceleration + 25 * delta, 0, maxSpeed);
    if (moveBackward) acceleration = THREE.MathUtils.clamp(acceleration - 30 * delta, 0, maxSpeed);
    else acceleration *= 0.95;
    
    // Roll básico con teclado
    if (moveLeft) rollAngle = THREE.MathUtils.clamp(rollAngle - 2 * delta, -1.5, 1.5);
    if (moveRight) rollAngle = THREE.MathUtils.clamp(rollAngle + 2 * delta, -1.5, 1.5);
    else rollAngle *= 0.9;
    
    pitchAngle *= 0.92;
  }
}

function updatePlayer(delta) {
  updateFlightControls(delta);
  
  // Aplicar rotaciones de vuelo
  player.rotation.z = rollAngle * 0.7; // Roll visual
  player.rotation.x = pitchAngle * 0.5; // Pitch visual
  
  // Velocidad forward con pitch
  const forwardSpeed = acceleration * delta;
  const forwardVector = new THREE.Vector3(0, -Math.sin(pitchAngle), -Math.cos(pitchAngle));
  velocity.add(forwardVector.multiplyScalar(forwardSpeed));
  
  // Roll afecta movimiento lateral
  const rollInfluence = rollAngle * 0.3;
  velocity.x += rollInfluence * forwardSpeed * delta;
  
  // Fricción aire
  velocity.multiplyScalar(0.98);
  
  // Actualizar posición
  player.position.add(velocity);
  
  // Mantener en límites Y
  player.position.y = THREE.MathUtils.clamp(player.position.y, -20, 40);
  
  // Camera sigue al player con offset VR
  camera.position.lerp(player.position, 0.1);
  camera.position.y += 1.8; // Altura ojos
  
  // Orientación VR + controles de vuelo
  if (vrControls && vrControls.enabled) {
    vrControls.update();
  }
}

function checkRingCollisions() {
  rings.forEach((r, index) => {
    const dist = player.position.distanceTo(r.position);
    if (dist < 12) {
      score += 10;
      scoreElement.innerHTML = `SCORE: ${score}`;
      
      // Respawn ring
      r.position.z = player.position.z - 250 - Math.random() * 150;
      r.position.x = player.position.x + (Math.random() - 0.5) * 250;
      r.position.y = player.position.y + (Math.random() - 0.5) * 20;
    }
  });
}

function startTimer() {
  const interval = setInterval(() => {
    if (gameOver) {
      clearInterval(interval);
      return;
    }
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
  velocity.set(0, 0, 0);

  document.getElementById('scoreHUD').style.display = 'none';
  document.getElementById('timerHUD').style.display = 'none';
  document.getElementById('debugHUD').style.display = 'none';

  finalScore.textContent = score;
  endScreen.style.display = 'flex';
}

function animate() {
  const delta = clock.getDelta();
  
  requestAnimationFrame(animate);
  
  if (!gameOver && gameStarted) {
    updatePlayer(delta);
    checkRingCollisions();

    // Actualizar rings
    rings.forEach(r => {
      r.position.z += (12 + acceleration * 0.1) * delta;
      r.rotation.z += r.userData.rotationSpeed;

      // Animación color
      r.userData.hue = (r.userData.hue + r.userData.colorSpeed) % 360;
      const newColor = new THREE.Color(`hsl(${r.userData.hue}, 100%, 60%)`);
      r.material.color.copy(newColor);
      r.material.emissive.copy(newColor.clone().multiplyScalar(0.4));

      // Respawn
      if (r.position.z > player.position.z + 100) {
        r.position.z = player.position.z - 250 - Math.random() * 150;
        r.position.x = player.position.x + (Math.random() - 0.5) * 250;
        r.position.y = player.position.y + (Math.random() - 0.5) * 20;
      }
    });

    // Poll gamepads cada frame
    if (navigator.getGamepads) {
      const gamepads = navigator.getGamepads();
      if (gamepads[0]) {
        currentGamepad = gamepads[0];
        gamepadConnected = true;
      }
    }
  }

  renderer.render(scene, camera);
}