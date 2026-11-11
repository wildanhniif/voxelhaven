import * as THREE from 'three';
import { createFpsCamera } from './engine/camera-fps';
import { startLoop } from './engine/loop';
import { createDebugOverlay } from './ui/debug-overlay';
import { breakBlock, placeBlock, type PlayerBounds } from './world/block-edit';
import { generateFlatChunk } from './world/chunk';
import { buildChunkGeometry } from './world/mesher';
import { createPlayerBody, resetIfFallenOut, updatePhysics } from './player/collision';
import { createController, EYE_HEIGHT } from './player/controller';
import { raycastVoxel, type Vec3 } from './player/raycast';

const SPAWN = { x: 16, y: 4, z: 16 } as const;
const REACH = 6;
const CLICK_DEBOUNCE_MS = 200;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 300);

const chunk = generateFlatChunk();
const material = new THREE.MeshLambertMaterial({ vertexColors: true });
const worldMesh = new THREE.Mesh(buildChunkGeometry(chunk), material);
scene.add(worldMesh);

scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(1, 2, 0.5);
scene.add(sun);

// Scratch vector: raycast & highlight tiap frame tanpa alokasi baru.
const dirScratch = new THREE.Vector3();
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.001, 1.001, 1.001)),
  new THREE.LineBasicMaterial({ color: 0xffffff }),
);
highlight.visible = false;
scene.add(highlight);

const fpsCamera = createFpsCamera(camera, renderer.domElement);
const body = createPlayerBody(SPAWN.x, SPAWN.y, SPAWN.z);
const controller = createController(camera, body, () => fpsCamera.isLocked);

let target: Vec3 | null = null;
let lastClickAt = -CLICK_DEBOUNCE_MS;

function playerBounds(): PlayerBounds {
  return { x: body.x, y: body.y, z: body.z };
}

function raycastFromCamera(): Vec3 | null {
  camera.getWorldDirection(dirScratch);
  const origin: Vec3 = [camera.position.x, camera.position.y, camera.position.z];
  const direction: Vec3 = [dirScratch.x, dirScratch.y, dirScratch.z];
  const hit = raycastVoxel(origin, direction, REACH, chunk);
  return hit === null ? null : hit.adjacent;
}

// Edit blok membangun ulang seluruh mesh chunk (32^3 sel, ~10-20 ms sekali klik).
function rebuildWorld(): void {
  worldMesh.geometry.dispose();
  worldMesh.geometry = buildChunkGeometry(chunk);
}

function onMouseDown(event: MouseEvent): void {
  if (!fpsCamera.isLocked || target === null) return;
  const now = performance.now();
  if (now - lastClickAt < CLICK_DEBOUNCE_MS) return;
  lastClickAt = now;

  if (event.button === 0) {
    // Blok yang di-target = sel tetangga dari adjacent, retrace untuk dapat blok aslinya.
    camera.getWorldDirection(dirScratch);
    const hit = raycastVoxel(
      [camera.position.x, camera.position.y, camera.position.z],
      [dirScratch.x, dirScratch.y, dirScratch.z],
      REACH,
      chunk,
    );
    if (hit !== null && breakBlock(hit.block, chunk)) rebuildWorld();
  } else if (event.button === 2) {
    if (placeBlock(target, 1, chunk, playerBounds())) rebuildWorld();
  }
}

const onContextMenu = (event: MouseEvent): void => event.preventDefault();

const onFps = createDebugOverlay();
const loop = startLoop(({ elapsed, delta }) => {
  controller.update();
  updatePhysics(body, delta, chunk);
  resetIfFallenOut(body, SPAWN.y);
  camera.position.set(body.x, body.y + EYE_HEIGHT, body.z);

  target = raycastFromCamera();
  if (target === null) {
    highlight.visible = false;
  } else {
    highlight.visible = true;
    highlight.position.set(target[0] + 0.5, target[1] + 0.5, target[2] + 0.5);
  }

  renderer.render(scene, camera);
  onFps(elapsed);
});

document.addEventListener('mousedown', onMouseDown);
document.addEventListener('contextmenu', onContextMenu);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('beforeunload', () => {
  loop();
  controller.dispose();
  fpsCamera.dispose();
  document.removeEventListener('mousedown', onMouseDown);
  document.removeEventListener('contextmenu', onContextMenu);
  highlight.geometry.dispose();
  (highlight.material as THREE.LineBasicMaterial).dispose();
});
