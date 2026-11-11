# CHANGELOG

## [M3] — Hotbar + inventory
Tanggal: 2026-11-11

### Selesai
- `src/state/inventory.ts`: `Inventory` 9 slot (fungsi murni: `selectSlot`, `setSlot`, `getActiveBlock`); default slot 0=grass, 1=dirt, 2=stone, sisanya null.
- `src/ui/hotbar.ts` + `src/ui/block-names.ts`: hotbar DOM di bawah layar, slot aktif di-highlight, nama blok aktif sebagai label; swatch warna per jenis blok.
- Input: tombol 1-9 pilih slot (klik mouse pada slot juga bisa), klik kanan menaruh blok dari slot aktif, slot kosong = tidak menaruh apa pun.
- `tests/unit/inventory.test.ts` (6 test) → total suite 30 test.

### Belum dikerjakan (non-goals M3)
- Crafting, stack count, drag & drop. Viewmodel tangan player (diusulkan, belum di-scope).

### Risiko / Tech Debt
- `hotbar.update(inv)` dipanggil tiap frame meski state tidak berubah; murah (9 DOM node) tapi bisa dipindah ke event-driven.
- Swatch hotbar pakai warna solid, belum sinkron otomatis dengan `BLOCK_COLORS` mesher (duplikasi konstanta).

### Cara Verifikasi Manual
1. `npm run dev` → hotbar 9 kotak muncul di bawah, slot 1 highlight, label "Grass".
2. Tekan 1-9 → highlight pindah, label berubah (Grass/Dirt/Stone/Slot kosong).
3. Tekan 4 (slot kosong) → klik kanan tidak menaruh apa pun.
4. Tekan 2 → klik kanan → blok dirt muncul (bukan grass).
5. Klik kanan ditahan → repeat tetap pakai blok slot aktif.

## [M2] — Break/place blok + raycast
Tanggal: 2026-11-11

### Selesai
- `src/player/raycast.ts`: `raycastVoxel(origin, direction, maxDistance, world)` dengan DDA (Amanatides-Woo), mengembalikan `{ block, adjacent }`.
- `src/world/block-edit.ts`: `breakBlock`, `placeBlock` (guard: luar batas, sudah solid, overlap AABB player), plus `overlapsPlayer`.
- Highlight target: `LineSegments` wireframe putih 1.001x di blok yang di-target kamera (reach 6 blok).
- Input: klik kiri hancur, klik kanan taruh blok dari slot aktif, aksi pertama instan + hold-to-repeat 200 ms (`d01cb25`), hanya saat pointer lock.
- Update mesh setelah edit (bangun ulang geometri chunk sekali per klik).
- `tests/unit/raycast.test.ts` (6 test) + `tests/unit/block-edit.test.ts` (6 test).

### Risiko / Tech Debt
- Remesh setelah edit membangun ulang seluruh chunk (32^3). Cukup cepat untuk klik manual ber-debounce tapi bukan remesh per-chunk-selectif; wajib diganti saat chunk banyak.
- Tidak ada batas tinggi bangun selain batas chunk.

## [M1] — Voxel world + FPS camera + collision
Tanggal: 2026-11-11

### Selesai
- `src/world/voxel.ts`: `VoxelType = 0 | 1 | 2 | 3`, `getBlock`/`setBlock`/`isSolid` murni, out-of-bounds = kosong.
- `src/world/chunk.ts`: chunk 32x32x32 `Uint8Array` (flat index X-tercepat, lalu Z, lalu Y); flat 3 layer: stone → dirt → grass.
- `src/world/mesher.ts`: chunk → satu `BufferGeometry`; vertex color per blok + shading per sisi; face yang bersentuhan blok solid di-cull.
- `src/engine/camera-fps.ts`: pointer lock (klik lock, ESC lepas), yaw/pitch dari mouse, pitch clamp ±89°.
- `src/player/controller.ts` + `constants.ts`: WASD relatif yaw, Space lompat, jalan 5 m/s, gravitasi 32 m/s² (~1.25 blok).
- `src/player/collision.ts`: AABB 0.6x1.8x0.6 vs voxel, resolve X→Y→Z, landing snap, respawn bila jatuh keluar world.
- Rotasi kubus M0 dihapus (kubus diganti world mesh).

### Perbaikan pasca-M1
- `c52003f`: tanda rotasi strafe A/D (dan W/S saat yaw≠0) terbalik; ditambah `tests/unit/controller.test.ts`.
- `33f2b34`: tuner lompatan ke feel Minecraft (gravitasi 32, jump ~1.25 blok).

### Risiko / Tech Debt
- Satu chunk 32x32x32 = satu mesh; radius render terbatas pada chunk itu.
- Physics pakai delta asli yang di-clamp 50 ms; belum fixed timestep.

## [M0] — Scaffold Vite + Three.js + Loop
Tanggal: 2026-11-11

### Selesai
- Init project: Vite + TypeScript (strict) + Three.js + Vitest.
- `src/main.ts`: renderer, scene, camera, loop render rAF, handle resize window.
- `src/engine/loop.ts`: `startLoop(onFrame)` reusable, mengembalikan stop-function.
- `src/ui/debug-overlay.ts` + `src/ui/fps-counter.ts`: FPS counter, update 1x per detik.
- `tests/unit/loop.test.ts`: test loop (fake timer, verifikasi tick & stop).

### Catatan
- Kubus M0 sudah dihapus di M1 (diganti world mesh).
- Bundle > 500 kB karena Three.js.
