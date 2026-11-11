import * as THREE from 'three';
import { createFpsCamera } from './engine/camera-fps';
import { startLoop } from './engine/loop';
import { createDebugOverlay } from './ui/debug-overlay';
import { createHotbar } from './ui/hotbar';
import { createInventory, getActiveBlock, selectSlot, type Inventory } from './state/inventory';
import { breakBlock, placeBlock, type PlayerBounds } from './world/block-edit';
import { generateFlatChunk } from './world/chunk';
import { buildChunkGeometry } from './world/mesher';
import { createPlayerBody, resetIfFallenOut, updatePhysics } from './player/collision';
import { createController, EYE_HEIGHT } from './player/controller';
import { raycastVoxel, type Vec3 } from './player/raycast';

const SPAWN = { x: 16, y: 4, z: 16 } as const;
const REACH = 6;
/** Aksi pertama instan; repeat hanya saat tombol ditahan (Minecraft: ~4 blok/detik). */
const REPEAT_INTERVAL_MS = 200;

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

let inventory: Inventory = createInventory();
let target: Vec3 | null = null;
let heldButton = -1;
let nextRepeatAt = 0;

const hotbar = createHotbar((index) => {
  inventory = selectSlot(inventory, index);
});

function playerBounds(): PlayerBounds {
  return { x: body.x, y: body.y, z: body.z };
}

function raycastFromCamera(): Vec3 | null {
  camera.getWorldDirection(dirScratch);
  const hit = raycastVoxel(
    [camera.position.x, camera.position.y, camera.position.z],
    [dirScratch.x, dirScratch.y, dirScratch.z],
    REACH,
    chunk,
  );
  return hit === null ? null : hit.adjacent;
}

// Satu edit = rebuild seluruh mesh chunk; cukup untuk skala 1 chunk.
function rebuildWorld(): void {
  worldMesh.geometry.dispose();
  worldMesh.geometry = buildChunkGeometry(chunk);
}

function breakAtCursor(): void {
  camera.getWorldDirection(dirScratch);
  const hit = raycastVoxel(
    [camera.position.x, camera.position.y, camera.position.z],
    [dirScratch.x, dirScratch.y, dirScratch.z],
    REACH,
    chunk,
  );
  if (hit !== null && breakBlock(hit.block, chunk)) rebuildWorld();
}

function placeAtCursor(): void {
  // Slot kosong → tidak menaruh apa pun.
  const block = getActiveBlock(inventory);
  if (block === null) return;
  if (target === null) return;
  if (placeBlock(target, block, chunk, playerBounds())) rebuildWorld();
}

/** Jalankan aksi tombol; dipakai saat mousedown dan saat repeat. */
function performAction(button: number): void {
  if (button === 0) breakAtCursor();
  else if (button === 2) placeAtCursor();
}

function onMouseDown(event: MouseEvent): void {
  if (!fpsCamera.isLocked) return;
  if (event.button !== 0 && event.button !== 2) return;
  heldButton = event.button;
  performAction(heldButton);
  nextRepeatAt = performance.now() + REPEAT_INTERVAL_MS;
}

function onMouseUp(): void {
  heldButton = -1;
}

/** Kalau tab kehilangan fokus (alt-tab), stop repeat agar tidak "nyangkut" menahan klik. */
function onBlur(): void {
  heldButton = -1;
}

/** Pilih slot via tombol 1..9. */
function onKeyDown(event: KeyboardEvent): void {
  const index = Number(event.key) - 1;
  if (Number.isInteger(index) && index >= 0 && index < 9) {
    inventory = selectSlot(inventory, index);
  }
}

/** Repeat saat tombol ditahan, dijalankan dari loop render (tidak ada timer terpisah). */
function updateHeldAction(now: number): void {
  if (heldButton === -1 || !fpsCamera.isLocked) return;
  if (now < nextRepeatAt) return;
  performAction(heldButton);
  nextRepeatAt = now + REPEAT_INTERVAL_MS;
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

  updateHeldAction(performance.now());

  hotbar.update(inventory);
  renderer.render(scene, camera);
  onFps(elapsed);
});

document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mouseup', onMouseUp);
document.addEventListener('contextmenu', onContextMenu);
document.addEventListener('keydown', onKeyDown);
window.addEventListener('blur', onBlur);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('beforeunload', () => {
  loop();
  controller.dispose();
  fpsCamera.dispose();
  hotbar.dispose();
  document.removeEventListener('mousedown', onMouseDown);
  document.removeEventListener('mouseup', onMouseUp);
  document.removeEventListener('contextmenu', onContextMenu);
  document.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('blur', onBlur);
  highlight.geometry.dispose();
  (highlight.material as THREE.LineBasicMaterial).dispose();
});
