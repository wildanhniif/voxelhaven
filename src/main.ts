import * as THREE from 'three';
import { createFpsCamera, tppCameraDistance } from './engine/camera-fps';
import { startLoop } from './engine/loop';
import { createDebugOverlay } from './ui/debug-overlay';
import { createHotbar } from './ui/hotbar';
import { createBlockStore } from './state/block-store';
import {
  createInventory,
  getActiveBlock,
  getCount,
  addItem,
  removeItem,
  selectSlot,
  HOTBAR_SIZE,
  type Inventory,
} from './state/inventory';
import { breakBlock, placeBlock, type PlayerBounds } from './world/block-edit';
import { createItemDrops } from './entity/item-drop';
import { ChunkManager } from './world/chunk-manager';
import { buildChunkGeometry } from './world/mesher';
import { createTextureAtlas } from './world/texture-atlas';
import {
  CHUNK_SIZE,
  worldToChunk,
  type Chunk,
  type TerrainConfig,
} from './world/terrain';
import { createTouchControls, loadSensitivity } from './ui/touch-controls';
import { loadPlayer, savePlayer } from './state/player-save';
import { clearAllWorlds, recordWorld, worldSeed } from './state/world-manager';
import type { VoxelType } from './world/voxel';
import { createFirstPersonArms } from './player/fpp-arms';
import { createController, EYE_HEIGHT } from './player/controller';
import { createPlayerModel } from './player/player-model';
import { createPlayerBody, resetIfFallenOut, updatePhysics } from './player/collision';
import { raycastVoxel, type Vec3 } from './player/raycast';
import { createMainMenu } from './ui/main-menu';
import { WORLD_CENTER, WORLD_SIZE } from './world/world-bounds';

const REACH = 6;
/** Aksi instan; repeat tiap REPEAT_INTERVAL_MS saat ditahan. */
const REPEAT_INTERVAL_MS = 200;
/** Autosave tiap AUTOSAVE_INTERVAL detik. */
const AUTOSAVE_INTERVAL = 10;

// ─── Renderer & scene (di luar boot supaya canvas stabil saat ganti world) ───
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 130);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 400);

const material = new THREE.MeshLambertMaterial({ vertexColors: true, map: createTextureAtlas() });

/**
 * Boot game untuk world tertentu. Bisa dipanggil berulang kali (ganti world).
 * Semua state game di-local-kan supayaGC bersih saat boot ulang.
 */
function boot(worldName: string): void {
  // Bersihkan scene lama (chunk mesh dari game sebelumnya).
  // Copy daftar anak dulu karena remove memodifikasi array anak.
  for (const child of [...scene.children]) scene.remove(child);
  // Re-add static lights (habis di-remove di atas).
  scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(1, 2, 0.5);
  scene.add(sun);
  scene.add(camera);

  const seed = worldSeed(worldName);
  const terrain: TerrainConfig = { seed, amplitude: 9, base: 12 };
  const blockStore = createBlockStore(worldName);
  const chunkManager = new ChunkManager(
    terrain,
    (chunk) => buildMesh(chunk),
    (chunk) => removeMesh(chunk),
    blockStore,
  );
  const chunkGroup = new THREE.Group();
  scene.add(chunkGroup);
  const chunkMeshes = new Map<string, THREE.Mesh>();

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
      buildChunkGeometry(chunk, terrain, (x, y, z) => chunkManager.getBlockLoaded([x, y, z])),
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

  /** Rebuild mesh chunk yang berubah + tetangga yang ada (culling tepi). */
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

  // ── Spawn ──────────────────────────────────────────────────────────────
  const spawnXZ = WORLD_CENTER;
  function findSpawnY(): number {
    for (let i = 0; i < 40; i++) {
      if (chunkManager.chunkAt(spawnXZ, spawnXZ) !== null) break;
      chunkManager.update(spawnXZ, spawnXZ);
    }
    for (let y = CHUNK_SIZE - 1; y >= 0; y--) {
      if (chunkManager.getBlock([spawnXZ, y, spawnXZ]) !== 0) return y + 1;
    }
    return CHUNK_SIZE;
  }
  // Titik respawn terpisah dari posisi save: selalu tengah dunia di atas
  // permukaan. Save hanya menentukan posisi awal, bukan tujuan respawn.
  const spawn = { x: spawnXZ + 0.5, y: findSpawnY(), z: spawnXZ + 0.5 };
  const saved = loadPlayer(worldName);
  const savedY = saved !== null && Number.isFinite(saved.y) ? saved.y : spawn.y;
  const body = createPlayerBody(
    saved?.x ?? spawn.x,
    savedY,
    saved?.z ?? spawn.z,
  );

  // Scratch vector: raycast & highlight tanpa alokasi tiap frame.
  const dirScratch = new THREE.Vector3();
  const highlight = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.001, 1.001, 1.001)),
    new THREE.LineBasicMaterial({ color: 0xffffff }),
  );
  highlight.visible = false;
  scene.add(highlight);

  const fpsCamera = createFpsCamera(camera, renderer.domElement);
  // Terapkan kepekaan look tersimpan (diatur lewat menu ☰ > Sensitivitas).
  fpsCamera.setLookSensitivity(loadSensitivity());

  const playerModel = createPlayerModel();
  scene.add(playerModel.group);
  const fppArms = createFirstPersonArms();
  camera.add(fppArms.group);

  const touchControls = createTouchControls(
    fpsCamera,
    (button) => {
      // Input touch: aksi instan, tanpa gate pointer lock (mobile tidak punya).
      performAction(button);
    },
    () => {
      // Tombol keluar: flush save lalu reload ke menu (tanpa param world).
      savePlayer(worldName, {
        x: body.x,
        y: body.y,
        z: body.z,
        slots: inventory.slots,
        active: inventory.active,
      });
      blockStore.flush();
      // Keluar ke menu: hapus param world lalu muat ulang halaman.
      const url = new URL(window.location.href);
      url.search = '';
      window.location.href = url.toString();
    },
    () => {
      // Respawn: pindah ke titik spawn dunia & reset kecepatan.
      body.x = spawn.x;
      body.y = spawn.y;
      body.z = spawn.z;
      body.vx = 0;
      body.vy = 0;
      body.vz = 0;
    },
    () => {
      // Hapus semua world tersimpan (riwayat, save, edit blok) lalu kembali
      // ke menu: data lama dunia tidak akan dirender lagi.
      blockStore.flush();
      clearAllWorlds();
      const url = new URL(window.location.href);
      url.search = '';
      window.location.href = url.toString();
    },
    (mult) => {
      // Slider sensitivitas di menu: langsung dipakai kamera.
      fpsCamera.setLookSensitivity(mult);
    },
  );
  if (touchControls !== null) {
    touchControls.setZoomHandler((delta) => fpsCamera.zoomCamera(delta));
  }
  const controller = createController(
    camera,
    body,
    () => fpsCamera.isLocked,
    touchControls ?? undefined,
  );
  const itemDrops = createItemDrops();
  scene.add(itemDrops.group);

  let inventory: Inventory =
    saved !== null && Array.isArray(saved.slots)
      ? {
          slots: saved.slots.map((s) =>
            s === null ? null : { type: s.type as VoxelType, count: s.count },
          ),
          active: saved.active,
        }
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

  function lookDirection(): readonly [number, number, number] {
    camera.getWorldDirection(dirScratch);
    return [dirScratch.x, dirScratch.y, dirScratch.z];
  }

  function eyePosition(): readonly [number, number, number] {
    return [body.x, body.y + EYE_HEIGHT, body.z];
  }

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
    itemDrops.spawn(type, hit.block[0] + 0.5, hit.block[1] + 0.5, hit.block[2] + 0.5);
  }

  function placeAtCursor(): void {
    const block = getActiveBlock(inventory);
    if (block === null) return;
    if (getCount(inventory, block) <= 0) return;
    if (target === null) return;
    if (placeBlock(target, block, chunkManager, playerBounds())) {
      inventory = removeItem(inventory, block);
      remeshAround(target[0], target[2]);
    }
  }

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

  function onBlur(): void {
    heldButton = -1;
  }

  /** Backspace = hapus semua edit world ini + reload; ESC = exit ke menu. */
  function onKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Backspace') {
      blockStore.clearEdits();
      location.reload();
      return;
    }
    if (event.code === 'Escape') {
      savePlayer(worldName, {
        x: body.x,
        y: body.y,
        z: body.z,
        slots: inventory.slots,
        active: inventory.active,
      });
      blockStore.flush();
      const url = new URL(window.location.href);
      url.search = '';
      window.location.href = url.toString();
      return;
    }
    const index = Number(event.key) - 1;
    if (Number.isInteger(index) && index >= 0 && index < HOTBAR_SIZE) {
      inventory = selectSlot(inventory, index);
    }
  }

  function updateHeldAction(now: number): void {
    if (heldButton === -1 || !fpsCamera.isLocked) return;
    if (now < nextRepeatAt) return;
    performAction(heldButton);
    nextRepeatAt = now + REPEAT_INTERVAL_MS;
  }

  const onContextMenu = (event: MouseEvent): void => event.preventDefault();

  let lastFaceYaw = fpsCamera.yaw;

  /** Tinggi permukaan solid tertinggi di kolom (x, z); 0 kalau kosong. */
  function groundHeightBelow(x: number, z: number): number {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    for (let y = CHUNK_SIZE - 1; y >= 0; y--) {
      if (chunkManager.getBlock([bx, y, bz]) !== 0) return y + 1;
    }
    return 0;
  }

  function applyCameraMode(): void {
    const eye = eyePosition();
    camera.position.set(eye[0], eye[1], eye[2]);
    const tpp = fpsCamera.mode === 'TPP' || fpsCamera.mode === 'TPP_FRONT';
    playerModel.group.visible = tpp;
    fppArms.setVisible(!tpp);
    // Karakter mengikuti arah gerak joystick; saat berhenti, tetap hadap
    // arah terakhir (tidak "snap" balik ke arah kamera).
    const moveSpeed = Math.hypot(body.vx, body.vz);
    if (moveSpeed > 0.01) lastFaceYaw = Math.atan2(-body.vx, -body.vz);
    playerModel.update(body, lastFaceYaw, fpsCamera.pitch);
    if (tpp) {
      const py = fpsCamera.viewYaw;
      const pp = fpsCamera.viewPitch;
      const dir: [number, number, number] = [
        -Math.sin(py) * Math.cos(pp),
        Math.sin(pp),
        -Math.cos(py) * Math.cos(pp),
      ];
      const dist = tppCameraDistance(eye, [-dir[0], -dir[1], -dir[2]], chunkManager, fpsCamera.zoomDistance);
      let cx = eye[0] - dir[0] * dist;
      let cy = eye[1] - dir[1] * dist;
      let cz = eye[2] - dir[2] * dist;
      // Jaga kamera tetap di dalam dunia (tidak ke-liat keluar tepi).
      cx = THREE.MathUtils.clamp(cx, 1, WORLD_SIZE - 1);
      cz = THREE.MathUtils.clamp(cz, 1, WORLD_SIZE - 1);
      // Jangan pernah taruh kamera di dalam/di bawah blok: angkat ke atas
      // permukaan tertinggi di bawah posisi kamera. Kamera di bawah tanah
      // membuat terrain terlihat "hampa" (face interior tidak digenerate).
      const below = groundHeightBelow(cx, cz);
      if (cy < below + 1.5) cy = below + 1.5;
      camera.position.set(cx, cy, cz);
    }
  }

  const onFps = createDebugOverlay();
  let nextAutosaveAt = AUTOSAVE_INTERVAL;

  const loop = startLoop(({ elapsed, delta }) => {
    controller.update();
    updatePhysics(body, delta / 1000, chunkManager);
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

    const moving = fpsCamera.isLocked && (body.vx !== 0 || body.vz !== 0);
    playerModel.animate(delta / 1000, moving);
    const activeSlot = inventory.slots[inventory.active];
    const held = activeSlot !== undefined && activeSlot !== null && activeSlot.count > 0;
    const heldType = held ? (activeSlot?.type ?? null) : null;
    fppArms.setHeldType(heldType);
    fppArms.update(delta / 1000, moving, fpsCamera.pitch, held ? 1 : 0);
    playerModel.setHeldType(heldType);

    itemDrops.update(delta / 1000, body, chunkManager, (type) => {
      const next = addItem(inventory, type);
      if (next === inventory) return false;
      inventory = next;
      return true;
    });
    hotbar.update(inventory);
    renderer.render(scene, camera);

    if (elapsed >= nextAutosaveAt) {
      nextAutosaveAt = elapsed + AUTOSAVE_INTERVAL;
      savePlayer(worldName, {
        x: body.x,
        y: body.y,
        z: body.z,
        slots: inventory.slots,
        active: inventory.active,
      });
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
    savePlayer(worldName, {
      x: body.x,
      y: body.y,
      z: body.z,
      slots: inventory.slots,
      active: inventory.active,
    });
    blockStore.flush();
    loop();
    controller.dispose();
    fpsCamera.dispose();
    itemDrops.dispose();
    playerModel.dispose();
    touchControls?.dispose();
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
}

// ─── Fase menu ──────────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const worldFromUrl = urlParams.get('world');
if (worldFromUrl) {
  recordWorld(worldFromUrl);
  boot(worldFromUrl);
} else {
  const menu = createMainMenu((name) => {
    const trimmed = name.trim();
    // Sembunyikan menu segera; kalau tidak, overlay tetap nutup game.
    menu.dispose();
    recordWorld(trimmed);
    // Simpan nama ke URL supaya bookmark/share ke world langsung.
    const params = new URLSearchParams({ world: trimmed });
    const url = new URL(window.location.href);
    url.search = params.toString();
    window.history.replaceState({}, '', url.toString());
    boot(trimmed);
  });
}
