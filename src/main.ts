import * as THREE from 'three';
import { createFpsCamera } from './engine/camera-fps';
import { startLoop } from './engine/loop';
import { createDebugOverlay } from './ui/debug-overlay';
import { createHotbar } from './ui/hotbar';
import { createInventory, getActiveBlock, selectSlot, type Inventory } from './state/inventory';
import { breakBlock, placeBlock, type PlayerBounds } from './world/block-edit';
import { ChunkManager } from './world/chunk-manager';
import { buildChunkGeometry } from './world/mesher';
import { CHUNK_SIZE, DEFAULT_TERRAIN, worldToChunk, type Chunk } from './world/terrain';
import { createPlayerBody, resetIfFallenOut, updatePhysics } from './player/collision';
import { createController, EYE_HEIGHT } from './player/controller';
import { raycastVoxel, type Vec3 } from './player/raycast';

const SPAWN_XZ = { x: 8, z: 8 } as const;
const REACH = 6;
/** Aksi pertama instan; repeat hanya saat tombol ditahan (Minecraft: ~4 blok/detik). */
const REPEAT_INTERVAL_MS = 200;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 130);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 400);

const material = new THREE.MeshLambertMaterial({ vertexColors: true });
const chunkGroup = new THREE.Group();
scene.add(chunkGroup);
const chunkMeshes = new Map<string, THREE.Mesh>();

scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(1, 2, 0.5);
scene.add(sun);

const chunkManager = new ChunkManager(
  DEFAULT_TERRAIN,
  (chunk) => buildMesh(chunk),
  (chunk) => removeMesh(chunk),
);

function chunkKey(chunk: Chunk): string {
  return chunk.cx + ',' + chunk.cz;
}

function buildMesh(chunk: Chunk): void {
  const key = chunkKey(chunk);
  const existing = chunkMeshes.get(key);
  if (existing !== undefined) {
    existing.geometry.dispose();
    chunkGroup.remove(existing);
    chunkMeshes.delete(key);
  }
  const mesh = new THREE.Mesh(buildChunkGeometry(chunk), material);
  mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
  chunkMeshes.set(key, mesh);
  chunkGroup.add(mesh);
}

function removeMesh(chunk: Chunk): void {
  const key = chunkKey(chunk);
  const mesh = chunkMeshes.get(key);
  if (mesh === undefined) return;
  mesh.geometry.dispose();
  chunkGroup.remove(mesh);
  chunkMeshes.delete(key);
}

/** Edit blok: rebuild mesh chunk yang berubah + tetangga yang ada (culling tepi). */
function remeshAround(x: number, z: number): void {
  const { cx, cz } = worldToChunk(x, z);
  const candidates: [number, number][] = [
    [cx, cz],
    [cx + 1, cz],
    [cx - 1, cz],
    [cx, cz + 1],
    [cx, cz - 1],
  ];
  for (const [nx, nz] of candidates) {
    const centerX = nx * CHUNK_SIZE + CHUNK_SIZE / 2;
    const centerZ = nz * CHUNK_SIZE + CHUNK_SIZE / 2;
    const chunk = chunkManager.chunkAt(centerX, centerZ);
    if (chunk !== null) buildMesh(chunk);
  }
}

// Spawn: tinggi permukaan di kolom spawn (chunk dijamin dimuat dulu).
function findSpawnY(): number {
  for (let i = 0; i < 40; i++) {
    if (chunkManager.chunkAt(SPAWN_XZ.x, SPAWN_XZ.z) !== null) break;
    chunkManager.update(SPAWN_XZ.x, SPAWN_XZ.z);
  }
  for (let y = CHUNK_SIZE - 1; y >= 0; y--) {
    if (chunkManager.getBlock([SPAWN_XZ.x, y, SPAWN_XZ.z]) !== 0) return y + 1;
  }
  return CHUNK_SIZE;
}

const body = createPlayerBody(SPAWN_XZ.x + 0.5, findSpawnY(), SPAWN_XZ.z + 0.5);
const spawn = { x: body.x, y: body.y, z: body.z };

// Scratch vector: raycast & highlight tiap frame tanpa alokasi baru.
const dirScratch = new THREE.Vector3();
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.001, 1.001, 1.001)),
  new THREE.LineBasicMaterial({ color: 0xffffff }),
);
highlight.visible = false;
scene.add(highlight);

const fpsCamera = createFpsCamera(camera, renderer.domElement);
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
    chunkManager,
  );
  return hit === null ? null : hit.adjacent;
}

function breakAtCursor(): void {
  camera.getWorldDirection(dirScratch);
  const hit = raycastVoxel(
    [camera.position.x, camera.position.y, camera.position.z],
    [dirScratch.x, dirScratch.y, dirScratch.z],
    REACH,
    chunkManager,
  );
  if (hit !== null && breakBlock(hit.block, chunkManager)) {
    remeshAround(hit.block[0], hit.block[2]);
  }
}

function placeAtCursor(): void {
  // Slot kosong → tidak menaruh apa pun.
  const block = getActiveBlock(inventory);
  if (block === null) return;
  if (target === null) return;
  if (placeBlock(target, block, chunkManager, playerBounds())) {
    remeshAround(target[0], target[2]);
  }
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
  updatePhysics(body, delta, chunkManager);
  resetIfFallenOut(body, spawn);
  camera.position.set(body.x, body.y + EYE_HEIGHT, body.z);

  chunkManager.update(body.x, body.z);

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
  for (const mesh of chunkMeshes.values()) mesh.geometry.dispose();
  material.dispose();
  highlight.geometry.dispose();
  (highlight.material as THREE.LineBasicMaterial).dispose();
});
