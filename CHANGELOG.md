# CHANGELOG

## [M0] — Scaffold Vite + Three.js + Loop
Tanggal: 2026-11-11

### Selesai
- Init project: Vite + TypeScript (strict) + Three.js + Vitest.
- `src/main.ts`: renderer, scene, camera, 1 BoxGeometry di origin, loop render rAF, handle resize window.
- `src/engine/loop.ts`: `startLoop(onFrame)` reusable, mengembalikan stop-function.
- `src/ui/debug-overlay.ts` + `src/ui/fps-counter.ts`: FPS counter, update 1x per detik.
- `tests/unit/loop.test.ts`: test loop (fake timer, verifikasi tick & stop).
- README diperbarui.

### Belum dikerjakan (non-goals M0)
- Kamera gerak, kontrol, voxel/chunk, tekstur, save/load.

### Risiko / Tech Debt
- Bundle > 500 kB karena Three.js (minified ~530 kB). Bisa diperbaiki nanti via code-splitting/tree-shaking jika perlu.
- Rotasi kubus kecil ada di M0 (visual proof); tidak gameplay, bisa dipindah nanti.

### Cara Verifikasi Manual
1. `npm run dev` → buka http://localhost:5173 → kubus hijau terlihat, berputar pelan.
2. Overlay `FPS: xx` di pojok kiri atas, nilai update tiap detik.
3. Resize window → canvas ikut menyesuaikan.
