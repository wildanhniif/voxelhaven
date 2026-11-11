# CHANGELOG

## [M1] — Voxel world + FPS camera + collision
Tanggal: 2026-11-11

### Selesai
- `src/world/voxel.ts`: `VoxelType = 0 | 1 | 2 | 3`, `getBlock`/`setBlock`/`isSolid` murni, out-of-bounds = kosong.
- `src/world/chunk.ts`: chunk 32x32x32 `Uint8Array` (flat index X-tercepat, lalu Z, lalu Y); flat 3 layer: stone → dirt → grass.
- `src/world/mesher.ts`: chunk → satu `BufferGeometry`; vertex color per blok + shading per sisi; face yang bersentuhan blok solid di-cull.
- `src/engine/camera-fps.ts`: pointer lock (klik lock, ESC lepas), yaw/pitch dari mouse, pitch clamp ±89°.
- `src/player/controller.ts` + `constants.ts`: WASD relatif yaw, Space lompat (9 m/s), jalan 5 m/s.
- `src/player/collision.ts`: AABB 0.6x1.8x0.6 vs voxel, resolve X→Y→Z, gravitasi 28 m/s², landing snap, respawn bila jatuh keluar world.
- Rotasi kubus M0 dihapus (kubus diganti world mesh).
- `tests/unit/voxel.test.ts` (4 test) + `tests/unit/collision.test.ts` (5 test) + loop test M0 (1) = 10 test.

### Belum dikerjakan (non-goals M1)
- Hancur/taruh blok (M2), terrain noise (M4), tekstur, multiple chunks.

### Risiko / Tech Debt
- Satu chunk 32x32x32 = satu mesh; radius render terbatas pada chunk itu.
- Bundle 537 kB karena Three.js (warning > 500 kB tetap ada).
- Physics step pakai delta asli yang di-clamp 50 ms; belum fixed timestep, jadi perilaku bisa beda tipis antar FPS.
- `beforeunload` tidak selalu terpanggil saat tab ditutup, listener memang tidak dipakai ulang (tidak ada leak berarti).

### Cara Verifikasi Manual
1. `npm run dev` → buka http://localhost:5173 → terlihat world flat blok hijau/coklat/abu.
2. Klik kanvas → kursor hilang, gerakkan mouse → kamera berputar; ESC → lepas.
3. W/A/S/D → jalan di permukaan grass; Space → lompat lalu jatuh lagi.
4. Jalan ke tepi world lalu keluar tepi → jatuh; otomatis respawn di tengah (y=4).
5. Coba jalan menembus dinding blok (turun ke layer grass lalu ke sisi blok) → tertahan.
6. Overlay FPS kanan-atas kiri tetap update.

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
