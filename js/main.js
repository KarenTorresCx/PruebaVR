import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/webxr/VRButton.js';

// Escena y renderer
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

// Botón VR
document.body.appendChild(VRButton.createButton(renderer));

// HDRI (opcional)
const cubeLoader = new THREE.CubeTextureLoader();
cubeLoader.setPath('cubemap/');
cubeLoader.load(
    ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'],
    (tex) => scene.background = tex,
    undefined,
    () => console.warn("cubemap/ no encontrado → fondo negro")
);

// Variables globales
let vrController = null;
let laserPointer = null;
let selectedModel = null;
let isRotating = false;
let infoSphere = null;
let infoPanel = null;
let infoTextElement = null;
let currentInfoIndex = 0;
let gameSphere = null;

// Láser rojo
const laserGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -20)]);
const laserMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3, transparent: true, opacity: 0.8 });
laserPointer = new THREE.Line(laserGeometry, laserMaterial);
laserPointer.visible = false;

// Cargar modelo avión verde
const loaderGLB = new GLTFLoader();
loaderGLB.load('modelos/avion2.glb', (gltf) => {
    const model = gltf.scene;
    model.userData.isGLTFModel = true;
    model.position.set(0, 2, -3);
    model.scale.set(0.003, 0.003, 0.003);
    model.rotation.y = Math.PI / 2;
    model.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    scene.add(model);

    //ESFERA DE CURIOSIDADES 
    const infoGeo = new THREE.SphereGeometry(0.2, 32, 32);
    const infoMat = new THREE.MeshBasicMaterial({ color: 0x00aaff });
    infoSphere = new THREE.Mesh(infoGeo, infoMat);
    infoSphere.position.set(-1, 3, 0);
    infoSphere.userData.type = "info";
    scene.add(infoSphere);

    //curiosidades
    const curiosidades = [
        "El Messerschmitt Bf 109 fue el caza más producido de la historia: ¡más de 34.000 unidades!",
        "Podía alcanzar los 700 km/h y subir a 12.000 metros de altura.",
        "Fue pilotado por ases como Erich Hartmann, con 352 victorias aéreas.",
        "Usaba un motor Daimler-Benz DB 605 de inyección directa, algo revolucionario en 1939.",
        "¡Combatió desde el primer hasta el último día de la guerra!"
    ];

    // Panel DOM (solo se crea una vez)
    infoPanel = document.getElementById('infoPanel');
    infoTextElement = document.getElementById('infoText');

    document.getElementById('closeBtn').onclick = () => {
        infoPanel.style.display = 'none';
    };

    // === ESFERA DE MINIJUEGO (más a la izquierda) ===
    const gameGeo = new THREE.SphereGeometry(0.2, 32, 32);
    const gameMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    gameSphere = new THREE.Mesh(gameGeo, gameMat);
    gameSphere.position.set(1, 3, -3);
    gameSphere.userData.type = "game";
    scene.add(gameSphere);

    const gameBtn = document.createElement('div');
    gameBtn.className = 'game-button';
    document.body.appendChild(gameBtn);
});

// Controlador VRBox
renderer.xr.addEventListener('sessionstart', () => {
    const controller = renderer.xr.getController(0);
    controller.position.set(0, 1.6, 0.3);
    controller.rotation.x = THREE.MathUtils.degToRad(-15);
    controller.add(laserPointer);
    scene.add(controller);
    vrController = controller;

    controller.addEventListener('select', performRaycastClick);
});

// Zona de muerte + joystick
const DEADZONE = 0.25;
const SENSITIVITY = 3.0;
function handleController(c) {
    if (!c?.gamepad) return;
    const axes = c.gamepad.axes;
    if (axes.length < 2) return;
    let x = axes[0], y = axes[1];
    if (Math.abs(x) < DEADZONE) x = 0;
    if (Math.abs(y) < DEADZONE) y = 0;
    c.rotation.y -= x * SENSITIVITY * 0.05;
    c.rotation.x -= y * SENSITIVITY * 0.05;
    c.rotation.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, c.rotation.x));
}

// Raycast + acciones
function performRaycastClick() {
    if (!vrController) return;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    raycaster.ray.origin.setFromMatrixPosition(vrController.matrixWorld);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(vrController.quaternion);
    raycaster.ray.direction.copy(dir);

    const hits = raycaster.intersectObjects(scene.children, true);

    if (hits.length > 0) {
        let obj = hits[0].object;

        // Detectar modelo GLTF
        while (obj && !obj.userData.isGLTFModel && !obj.userData.type) obj = obj.parent;
        if (!obj) return;

        // 1. Rotar avión
        if (obj.userData.isGLTFModel) {
            if (selectedModel === obj) isRotating = !isRotating;
            else { selectedModel = obj; isRotating = true; }
            return;
        }

        // 2. Botón de curiosidades
        if (obj.userData.type === "info") {
            if (obj.userData.type === "info") {
                // Mostrar panel dentro del VR
                currentInfoIndex = (currentInfoIndex + 1) % curiosidades.length;
                infoTextElement.textContent = curiosidades[currentInfoIndex];
                infoPanel.style.display = 'block';
                return;
            }
        }

        // 3. Botón de minijuego
        if (obj.userData.type === "game") {
            if (confirm("¿Quieres jugar al minijuego de vuelo?")) {
                location.href = "minigame.html";   // ← crea este archivo después
            }
            return;
        }
    }
}

// Bucle principal
function animate() {
    if (vrController) {
        handleController(vrController);
        laserPointer.visible = true;
    } else {
        laserPointer.visible = false;
    }

    if (isRotating && selectedModel) selectedModel.rotation.y += 0.01;

    renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

// Responsive
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
