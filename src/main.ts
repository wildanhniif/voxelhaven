import * as THREE from 'three';
import { createFpsCamera, tppCameraDistance } from './engine/camera-fps';
import { startLoop } from './engine/loop';
import { createDebugOverlay } from './ui/debug-overlay';
import { createHotbar } from './ui/hotbar';
import { createBlockStore } from './state/block-store';
import { createInventory, getActiveBlock, getCount, addItem, removeItem, selectSlot, type Inventory } from './state/inventory';
import { breakBlock, placeBlock, type PlayerBounds } from './world/block-edit';
import { createItemDrops } from './entity/item-drop';
import { ChunkManager } from './world/chunk-manager';
import { buildChunkGeometry } from './world/mesher';
import { createTextureAtlas } from './world/texture-atlas';
import { CHUNK_SIZE, DEFAULT_TERRAIN, worldToChunk, type Chunk } from './world/terrain';
import { createTouchControls } from './ui/touch-controls';
import { loadPlayer, savePlayer } from './state/player-save';
import type { VoxelType } from './world/voxel';
import { createFirstPersonArms } from './player/fpp-arms';
import { createController, EYE_HEIGHT } from './player/controller';
import { createPlayerModel } from './player/player-model';
import { createPlayerBody, resetIfFallenOut, updatePhysics } from './player/collision';
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

const material = new THREE.MeshLambertMaterial({ vertexColors: true, map: createTextureAtlas() });
const chunkGroup = new THREE.Group();
scene.add(chunkGroup);
const chunkMeshes = new Map<string, THREE.Mesh>();

scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(1, 2, 0.5);
scene.add(sun);

const blockStore = createBlockStore();
const chunkManager = new ChunkManager(
  DEFAULT_TERRAIN,
  (chunk) => buildMesh(chunk),
  (chunk) => removeMesh(chunk),
  blockStore,
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
  const mesh = new THREE.Mesh(
    buildChunkGeometry(chunk, DEFAULT_TERRAIN, (x, y, z) => chunkManager.getBlockLoaded([x, y, z])),
    material,
  );
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

// Restore posisi player dari save; fall back ke spawn default.
const saved = loadPlayer();
const savedY = saved !== null && Number.isFinite(saved.y) ? saved.y : findSpawnY();
const body = createPlayerBody(
  saved?.x ?? SPAWN_XZ.x + 0.5,
  savedY,
  saved?.z ?? SPAWN_XZ.z + 0.5,
);
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

// Model player: hanya untuk TPP. Di FPP, badan atas disembunyikan total
// (kamera ada di dalam kepala) dan diganti lengan FPP sederhana.
const playerModel = createPlayerModel();
scene.add(playerModel.group);
const fppArms = createFirstPersonArms();
camera.add(fppArms.group);
scene.add(camera);
const touchControls = createTouchControls(
  fpsCamera,
  (button) => {
    // Input touch: aksi instan, tanpa gate pointer lock (mobile tidak punya).
    performAction(button);
  },
);
const controller = createController(camera, body, () => fpsCamera.isLocked, touchControls ?? undefined);

const itemDrops = createItemDrops();
scene.add(itemDrops.group);

// Inventory: restore dari save kalau ada, else default.
let inventory: Inventory =
  saved !== null && Array.isArray(saved.slots)
    ? { slots: saved.slots.map((s) => (s === null ? null : { type: s.type as VoxelType, count: s.count })), active: saved.active }
    : createInventory();
let target: Vec3 | null = null;
let heldButton = -1;
let nextRepeatAt = 0;

const hotbar = createHotbar((index) => {
  inventory = selectSlot(inventory, index);
});

function playerBounds(): PlayerBounds {
  return { x: body.x, y: body.y, z: body.z };
}

/** Arah kamera sebagai [x,y,z] ke scratch (hindari alokasi). */
function lookDirection(): readonly [number, number, number] {
  camera.getWorldDirection(dirScratch);
  return [dirScratch.x, dirScratch.y, dirScratch.z];
}

/** Posisi mata player; dipakai kamera FPP/TPP dan raycast blok. */
function eyePosition(): readonly [number, number, number] {
  return [body.x, body.y + EYE_HEIGHT, body.z];
}

/**
 * Raycast selalu dari mata player, bukan dari kamera: di TPP kamera ada
 * di belakang badan, jadi block terdekat ke kamera bukan yang dibidik.
 */
function raycastFromEye(): { hit: ReturnType<typeof raycastVoxel> } {
  const eye: [number, number, number] = [body.x, body.y + EYE_HEIGHT, body.z];
  return { hit: raycastVoxel(eye, lookDirection(), REACH, chunkManager) };
}

function raycastFromCamera(): Vec3 | null {
  const { hit } = raycastFromEye();
  return hit === null ? null : hit.adjacent;
}

function breakAtCursor(): void {
  const { hit } = raycastFromEye();
  if (hit === null) return;
  const type = chunkManager.getBlock(hit.block);
  if (!breakBlock(hit.block, chunkManager)) return;
  remeshAround(hit.block[0], hit.block[2]);
  // Blok pecah jadi item fisik di pusat bloknya.
  itemDrops.spawn(type, hit.block[0] + 0.5, hit.block[1] + 0.5, hit.block[2] + 0.5);
}

function placeAtCursor(): void {
  // Slot kosong atau stok habis → tidak menaruh apa pun.
  const block = getActiveBlock(inventory);
  if (block === null) return;
  if (getCount(inventory, block) <= 0) return;
  if (target === null) return;
  if (placeBlock(target, block, chunkManager, playerBounds())) {
    inventory = removeItem(inventory, block);
    remeshAround(target[0], target[2]);
  }
}


/** Jalankan aksi tombol; dipakai saat mousedown dan saat repeat. */
function performAction(button: number): void {
  playerModel.swing();
  fppArms.swing();
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

/** Pilih slot via tombol 1..9; Backspace = reset world (hapus semua edit). */
function onKeyDown(event: KeyboardEvent): void {
  if (event.code === 'Backspace') {
    blockStore.clearEdits();
    location.reload();
    return;
  }
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

/**
 * Posisi kamera per mode. FPP: di mata. TPP: orbit mengelilingi player,
 * dikendalikan viewYaw (yaw + offset orbit), dibatasi camera collision.
 */
function applyCameraMode(): void {
  const eye = eyePosition();
  camera.position.set(eye[0], eye[1], eye[2]);
  const tpp = fpsCamera.mode === 'TPP' || fpsCamera.mode === 'TPP_FRONT';
  // FPP: seluruh badan disembunyikan (kamera di dalam kepala), ganti lengan FPP.
  playerModel.group.visible = tpp;
  fppArms.setVisible(!tpp);
  playerModel.update(body, fpsCamera.yaw, fpsCamera.pitch);
  if (tpp) {
    // Kamera mundur dari arah pandang render. viewYaw/viewPitch sudah
    // termasuk offset orbit (dan +180° untuk TPP_FRONT), jadi rumusnya seragam.
    const py = fpsCamera.viewYaw;
    const pp = fpsCamera.viewPitch;
    const dir: [number, number, number] = [
      -Math.sin(py) * Math.cos(pp),
      Math.sin(pp),
      -Math.cos(py) * Math.cos(pp),
    ];
    const dist = tppCameraDistance(eye, [-dir[0], -dir[1], -dir[2]], chunkManager);
    camera.position.set(
      eye[0] - dir[0] * dist,
      eye[1] - dir[1] * dist,
      eye[2] - dir[2] * dist,
    );
  }
}


const onFps = createDebugOverlay();
// Autosave tiap 10 detik: beforeunload tidak handal di mobile (tab bisa
// dibunuh OS tanpa event). Elapsed dalam detik.
const AUTOSAVE_INTERVAL = 10;
let nextAutosaveAt = AUTOSAVE_INTERVAL;
const loop = startLoop(({ elapsed, delta }) => {
  controller.update();
  updatePhysics(body, delta, chunkManager);
  resetIfFallenOut(body, spawn);
  applyCameraMode();

  chunkManager.update(body.x, body.z);

  target = raycastFromCamera();
  if (target === null) {
    highlight.visible = false;
  } else {
    highlight.visible = true;
    highlight.position.set(target[0] + 0.5, target[1] + 0.5, target[2] + 0.5);
  }
  updateHeldAction(performance.now());
  // Loop memberi delta dalam ms; animasi pakai detik.
  const moving = fpsCamera.isLocked && (body.vx !== 0 || body.vz !== 0);
  playerModel.animate(delta / 1000, moving);
  // Slot aktif menentukan "pegangan": kosong -> tangan tersembunyi (kecuali saat mukul).
  const activeSlot = inventory.slots[inventory.active];
  const held = activeSlot !== undefined && activeSlot !== null && activeSlot.count > 0;
  const heldType = held ? (activeSlot?.type ?? null) : null;
  fppArms.setHeldType(heldType);
  fppArms.update(delta / 1000, moving, fpsCamera.pitch, held ? 1 : 0);
  // TPP: tangan model juga memegang blok yang sama.
  playerModel.setHeldType(heldType);
  // Pickup item: inventory penuh → tryPickup false → item tetap di tanah.
  itemDrops.update(delta / 1000, body, chunkManager, (type) => {
    const next = addItem(inventory, type);
    if (next === inventory) return false; // penuh, diabaikan
    inventory = next;
    return true;
  });
  hotbar.update(inventory);
  renderer.render(scene, camera);
  if (elapsed >= nextAutosaveAt) {
    nextAutosaveAt = elapsed + AUTOSAVE_INTERVAL;
    savePlayer({ x: body.x, y: body.y, z: body.z, slots: inventory.slots, active: inventory.active });
  }
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
  savePlayer({ x: body.x, y: body.y, z: body.z, slots: inventory.slots, active: inventory.active });
  loop();
  controller.dispose();
  fpsCamera.dispose();
  itemDrops.dispose();
  playerModel.dispose();
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
