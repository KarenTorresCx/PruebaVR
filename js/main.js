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

camera.position.z = 5;

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

function animate() {

  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;

  renderer.render( scene, camera );

}
