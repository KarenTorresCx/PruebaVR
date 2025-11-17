import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
const scene = new THREE.Scene();

scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// Luces
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// Controles desktop
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const loader = new GLTFLoader();

// ==================== CARGA DE MODELOS POR SEPARADO ====================
//amarillo
async function cargarAvion1() {
    const gltf = await loader.loadAsync('modelos/avion1.glb');
    const avion = gltf.scene;
    avion.position.set(0, 0, 0);
    avion.scale.set(0.3, 0.3, 0.3);
    avion.traverse(child => { if (child.isMesh) child.castShadow = true; });
    scene.add(avion);
    return avion
}
//verde
async function cargarAvion2() {
    const gltf = await loader.loadAsync('modelos/avion2.glb');
    const avion = gltf.scene;
    avion.position.set(10, 0, 0);
    avion.rotation.y = Math.PI / 2;
    avion.scale.set(0.005, 0.005, 0.005);
    avion.traverse(child => { if (child.isMesh) child.castShadow = true; });
    scene.add(avion);
    return avion;
}
//rojo
async function cargarAvion3() {
    const gltf = await loader.loadAsync('modelos/avion3.glb');
    const avion = gltf.scene;
    avion.position.set(20, 0, 0);
    avion.scale.set(0.1, 0.1, 0.1);
    avion.traverse(child => { if (child.isMesh) child.castShadow = true; });
    scene.add(avion);
    return avion;
}

// Carga todos los aviones (puedes comentar los que no uses)
Promise.all([
    cargarAvion1(),
    cargarAvion2(),
    cargarAvion3()
]).then(aviones => {
    console.log("¡Todos los aviones cargados!", aviones);
}).catch(err => console.error("Error cargando algún avión:", err));

// ==================== HOTSPOTS (para avanzar) ====================
const hotspotMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.7 });
const hotspots = [];

const posicionesHotspots = [
    new THREE.Vector3(2, 1.5, 0),    //avión 1
    new THREE.Vector3(12, 1.5, 0),   //avión 2
    new THREE.Vector3(22, 1.5, 0)    //avión 3 Inicio mini juego
];

posicionesHotspots.forEach((pos, i) => {
    const hotspot = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), hotspotMaterial);
    hotspot.position.copy(pos);
    hotspot.userData = { action: i < 2 ? 'next' : 'game', index: i };
    scene.add(hotspot);
    hotspots.push(hotspot);
});

// ==================== INTERACCIÓN POR MIRADA (GAZE) ====================
const raycaster = new THREE.Raycaster();
const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.8, transparent: true })
);
reticle.visible = false;
scene.add(reticle);

let hovered = null;
let gazeTime = 0;
const DWELL_TIME = 2; // segundos

let enJuego = false;
let score = 0;
const targets = [];

function iniciarMiniJuego() {
    enJuego = true;
    hotspots.forEach(h => h.visible = false);

    // Crear 8 objetivos aleatorios
    for (let i = 0; i < 8; i++) {
        const geo = new THREE.SphereGeometry(0.4);
        const mat = new THREE.MeshBasicMaterial({ color: Math.random() * 0xffffff });
        const target = new THREE.Mesh(geo, mat);
        target.position.set(
            (Math.random() - 0.5) * 15,
            Math.random() * 4 + 1,
            (Math.random() - 0.5) * 15 - 8
        );
        target.userData.action = 'target';
        scene.add(target);
        targets.push(target);
    }
    console.log("¡Mini juego iniciado! Destruye todos los objetivos.");
}

// ==================== LOOP DE ANIMACIÓN ====================
function animate() {
    renderer.setAnimationLoop(() => {
        if (renderer.xr.isPresenting) {
            // ---- MODO VR (mirada) ----
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            const intersects = raycaster.intersectObjects(scene.children, true);

            if (intersects.length > 0) {
                const obj = intersects[0].object;

                if (obj.userData.action && obj !== hovered) {
                    hovered = obj;
                    reticle.visible = true;
                    reticle.position.copy(intersects[0].point);
                    gazeTime = 0;
                }
            } else {
                reticle.visible = false;
                hovered = null;
                gazeTime = 0;
            }

            if (hovered) {
                gazeTime += 1 / 60;
                // Progreso visual del retículo (opcional)
                reticle.scale.set(1 + gazeTime / DWELL_TIME * 0.5, 1 + gazeTime / DWELL_TIME * 0.5, 1);

                if (gazeTime >= DWELL_TIME) {
                    // ---- ACCIÓN ----
                    if (hovered.userData.action === 'next') {
                        const nextIndex = hovered.userData.index + 1;
                        const nuevaPos = new THREE.Vector3(10 * nextIndex, 1.6, 5);
                        camera.position.lerp(nuevaPos, 0.3);
                    } else if (hovered.userData.action === 'game') {
                        iniciarMiniJuego();
                    } else if (hovered.userData.action === 'target') {
                        scene.remove(hovered);
                        targets.splice(targets.indexOf(hovered), 1);
                        score++;
                        console.log("¡Impacto! Puntos:", score);
                        if (targets.length === 0) {
                            console.log("¡GANASTE! Puntuación final:", score);
                            enJuego = false;
                        }
                    }
                    hovered = null;
                    reticle.visible = false;
                    gazeTime = 0;
                }
            } else {
                reticle.scale.set(1, 1, 1);
            }
        } else {
            // ---- MODO ESCRITORIO ----
            controls.update();
        }

        renderer.render(scene, camera);
    });
}

animate();

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
