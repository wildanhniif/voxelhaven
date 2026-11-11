import * as THREE from 'three';
import { startLoop } from './engine/loop';
import { createDebugOverlay } from './ui/debug-overlay';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(3, 3, 5);
camera.lookAt(0, 0, 0);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x4caf50 }),
);
scene.add(cube);

const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
scene.add(light);

const onFps = createDebugOverlay();
const loop = startLoop(({ elapsed }) => {
  // Kubus berputar pelan supaya terlihat 3D; kamera tetap diam.
  cube.rotation.y = elapsed * 0.0005;
  renderer.render(scene, camera);
  onFps(elapsed);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('beforeunload', loop);
