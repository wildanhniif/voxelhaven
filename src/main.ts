import * as THREE from 'three';
import { createFpsCamera } from './engine/camera-fps';
import { startLoop } from './engine/loop';
import { createDebugOverlay } from './ui/debug-overlay';
import { generateFlatChunk } from './world/chunk';
import { buildChunkGeometry } from './world/mesher';
import { createPlayerBody, resetIfFallenOut, updatePhysics } from './player/collision';
import { createController, EYE_HEIGHT } from './player/controller';

const SPAWN = { x: 16, y: 4, z: 16 } as const;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 300);

const chunk = generateFlatChunk();
const worldMesh = new THREE.Mesh(
  buildChunkGeometry(chunk),
  new THREE.MeshLambertMaterial({ vertexColors: true }),
);
scene.add(worldMesh);

scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(1, 2, 0.5);
scene.add(sun);

const fpsCamera = createFpsCamera(camera, renderer.domElement);
const body = createPlayerBody(SPAWN.x, SPAWN.y, SPAWN.z);
const controller = createController(camera, body, () => fpsCamera.isLocked);

const onFps = createDebugOverlay();
const loop = startLoop(({ elapsed, delta }) => {
  controller.update();
  updatePhysics(body, delta, chunk);
  resetIfFallenOut(body, SPAWN.y);
  camera.position.set(body.x, body.y + EYE_HEIGHT, body.z);
  renderer.render(scene, camera);
  onFps(elapsed);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('beforeunload', () => {
  loop();
  controller.dispose();
  fpsCamera.dispose();
});
