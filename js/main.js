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
// // Modelos GLB
// const loaderGLB = new GLTFLoader(manager);

//orbit
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.update();

const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( geometry, material );
scene.add( cube );

camera.position.z = 15;

// //Modelos GLB
// function loadAndAddGLBModel(filePath, position, scale, rotation, scene) {
//   loaderGLB.load(filePath, function (gltf) {
//     const model = gltf.scene;
//     model.position.set(position.x, position.y, position.z);
//     model.scale.set(scale.x, scale.y, scale.z);
//     model.rotation.set(rotation.x, rotation.y, rotation.z);
//     model.castShadow = true;
//     model.receiveShadow = true;
//     scene.add(model);
//   }, undefined, function (error) {
//     console.error('Error loading GLB model:', error);
//   });
// }

// loadAndAddGLBModel(
//   'modelos/caldero.glb',
//   { x: -2, y: 0, z: 3},
//   { x: 0.02, y: 0.02, z: 0.02 },
//   { x: 0, y: 0, z: 0 },
//   scene
// );

// loadAndAddGLBModel(
//   'modelos/calabaza.glb',
//   { x: 3, y: 0, z: -3},
//   { x: 0.5, y: 0.5, z: 0.5 },
//   { x: 0, y: 2.5, z: 0 },
//   scene
// );
// loadAndAddGLBModel(
//   'modelos/calabaza.glb',
//   { x: 3, y: 0, z: -1},
//   { x: 0.3, y: 0.3, z: 0.3 },
//   { x: 0, y: 2.5, z: 0 },
//   scene
// );
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
  controller.position.set(0, 0, 10);   // altura de ojos
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

// Raycast al hacer clic
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
    console.log("Tocaste:", obj);

    if (obj === cube) {
      cube.material.color.set(Math.random() * 0xffffff);
      cube.scale.set(1.5, 1.5, 1.5);
      setTimeout(() => cube.scale.set(1, 1, 1), 200);
    }
  }
}

function animate() {

  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;

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
