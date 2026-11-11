# CHANGELOG

## [M6.2b] — Polish viewmodel + fix bolong perbatasan chunk
Tanggal: 2026-11-11

### Selesai
- src/player/viewmodel.ts: lengan kecil proporsional (0.24x0.24x0.55) + blok kecil 0.15 yang dipegang, posisi kanan-bawah (0.42, -0.38, -0.75), rotasi miring X-15/Y15/Z-15.
- Depth fix: viewmodel dirender di scene terpisah setelah world (renderer.autoClear=false + clearDepth), jadi tidak pernah tembus ke dalam blok saat nempel dinding.
- Animasi: swing sinus halus 200ms (chop turun + maju), bobbing pelan saat jalan. Semua pakai delta time detik.
- FIX BUG BOLONG: mesher kini membaca data chunk tetangga yang SUDAH dimuat (ChunkManager.getBlockLoaded) untuk culling tepi; fallback ke noise hanya jika chunk belum dimuat. Sebelumnya galian di perbatasan chunk membuat face chunk sebelah ter-cull = bolong ke langit tapi tidak tembus.
- src/world/chunk-manager.ts: tambah getBlockLoaded(pos) -> VoxelType | null.
- tests/unit/mesher-neighbor-culling.test.ts (2 test); total suite 62 test.

### Risiko / Tech Debt
- getLoaded dipanggil per face tepi; jika kelak jadi bottleneck, cache hasil per kolom.

### Cara Verifikasi Manual
1. FPP: tangan terlihat proporsional di kanan bawah, memegang blok kecil; nempel dinding: tangan tetap di depan (tidak tembus).
2. Klik kiri/kanan: ayunan mulus ~200ms; jalan: bobbing pelan.
3. Gali blok di perbatasan chunk (dekat tepi 16x16): tidak ada bolong ke langit.
4. F5 TPP lalu balik FPP: tangan muncul/hilang dengan benar.

## [M6.2.2] — Fix pivot tangan FPP (kayak patah)
Tanggal: 2026-11-11

### Selesai
- src/player/viewmodel.ts: mesh lengan kini di-offset dari pivot (0.6 unit ke depan) sehingga ayunan berporos di bahu/siku, bukan tengah lengan; bobbing juga ada sway horizontal halus.

### Cara Verifikasi Manual
1. FPP: jalan + klik: tangan bobbing dan berayun al dari ujung, bukan tampak terlipat di tengah.

## [M6.2.1] — Fix animasi tangan + animasi jalan TPP + wajah
Tanggal: 2026-11-11

### Selesai
- Bug fix: viewmodel.update sebelumnya menerima delta dalam ms dari loop, tetapi animasi memakai detik: swing selesai dalam 1 frame (tak terlihat) dan bobbing aliasing. Kini delta dikonversi ke detik di main.ts.
- src/player/player-model.ts: animasi jalan (kaki + tangan berayun bergantian, pivot di panggul/bahu), swing tangan kanan saat aksi blok, mata hitam di depan kepala (wajah terlihat).
- src/main.ts: performAction memicu swing player model; loop memanggil playerModel.animate tiap frame.

### Risiko / Tech Debt
- Animasi jalan sederhana (sinus), belum ada animasi idle/transisi berhenti.

### Cara Verifikasi Manual
1. FPP: klik kiri/kanan: tangan berayun; jalan: tangan bobbing.
2. F5 ke TPP: jalan: kaki+tangan berayun; klik: tangan kanan mengayun; mata terlihat di depan kepala.

## [M6.2] — Viewmodel & Third-Person Camera (TPP)
Tanggal: 2026-11-11

### Selesai
- src/player/viewmodel.ts (baru): tangan FPP sederhana (BoxGeometry) menempel di kamera, idle bobbing saat bergerak + swing singkat saat klik kiri/kanan.
- src/player/player-model.ts (baru): badan player kotak-kotak (2 kaki, badan, 2 tangan, kepala), warna solid, posisi di kaki player, kepala mengikuti pitch.
- src/engine/camera-fps.ts: mode kamera FPP/TPP, tombol F5 toggle (dialihkan dari refresh), helper murni tppCameraDistance untuk camera collision.
- src/main.ts: wiring viewmodel (child kamera) + player model; posisi kamera TPP mundur 4 blok dengan collision (tidak tembus blok); viewmodel disembunyikan di TPP; raycast blok tetap dari mata player supaya akurat di kedua mode.
- tests/unit/tpp-camera.test.ts (4 test); total suite 60 test.

### Risiko / Tech Debt
- Camera collision memakai langkah diskret 0.1 blok (step) bukan raycast kontinu: cukup rapat untuk blok 1px, tapi cek visual di layar asli tetap disarankan.
- Model player pakai warna solid, belum skin; animasi kaki statis (non-goal M6.2).
- F5 di-preventDefault sehingga tidak refresh halaman saat toggle kamera.

### Cara Verifikasi Manual
1. npm run dev -> FPP terlihat tangan kanan bawah, ayun saat klik kiri/kanan, bob saat jalan.
2. Tekan F5 -> TPP, badan player terlihat utuh di belakang kamera.
3. Di TPP, mundur sampai membelakangi tembok: kamera maju otomatis, tidak tembus.
4. Tekan F5 lagi -> balik FPP.

### Catatan Kalau Mentok
- Kalau kamera TPP tembus pandang / nyangkut di kepala: STOP, laporkan, jangan lanjut M7.

## [M6.1.1] — Ikon blok isometric di hotbar
Tanggal: 2026-11-11

### Selesai
- src/world/texture-atlas.ts: blockIconDataUrl(top, side) -> komposit ikon isometric 32x32 (top face + 2 sisi miring + shading) dari tile atlas, cache per pasangan tile.
- src/ui/hotbar.ts: swatch memakai ikon isometric (grass: grassTop+grassSide, dirt, stone), background-size: contain. Map lama HOTBAR_TILES digantikan HOTBAR_FACES.
- src/ui/block-names.ts: hapus BLOCK_SWATCH (tidak terpakai sejak M6.1).
- tests/unit/block-icon-data-url.test.ts (3 test); total suite 56 test.

### Risiko / Tech Debt
- Komposit ikon pakai transform canvas per-face; posisi crop sudah mengikuti ATLAS_COLS/ROWS, jadi aman untuk grid atlas baru.

### Cara Verifikasi Manual
1. npm run dev -> hotbar slot 1-3 menampilkan ikon blok isometric (atas + 2 sisi), mirip item Minecraft.

## [M6.1] — Tekstur asli di hotbar UI
Tanggal: 2026-11-11

### Selesai
- `src/world/texture-atlas.ts`: helper `tileDataUrl(tile)` -> crop satu tile 16x16 dari atlas jadi data URL PNG, di-cache per tile.
- `src/ui/hotbar.ts`: swatch slot memakai `background-image` tekstur atlas (grass pakai grass-side, dirt, stone), `image-rendering: pixelated`, `background-size: cover`. Kotak warna solid (BLOCK_SWATCH) tidak dipakai lagi.
- Fix bug lama M3: `cell.textContent = ''` ikut menghapus swatch karena swatch adalah child cell; nomor slot kini di `<span>` terpisah.
- `tests/unit/tile-data-url.test.ts` (3 test); total suite 53 test.

### Risiko / Tech Debt
- `BLOCK_SWATCH` di `src/ui/block-names.ts` sekarang tidak terpakai (kandidat hapus).
- Tile hotbar di-hardcode per blok; kalau blok baru ditambah, update HOTBAR_TILES.

### Cara Verifikasi Manual
1. `npm run dev` -> hotbar slot 1-3 menampilkan tekstur grass/dirt/stone, bukan warna solid.
2. Swatch tetap tajam (pixelated) walau di-scale dari 16px ke 28px.
## [M6] — Texture atlas
Tanggal: 2026-11-11

### Selesai
- `src/world/texture-atlas.ts` (baru): atlas procedural 2x2 tile 16x16 px via canvas 2D (grass-top, grass-side, dirt, stone), noise deterministik mulberry32, `CanvasTexture` + NearestFilter (mag & min), mipmaps off, sRGB.
- `src/world/mesher.ts`: attribute `uv` di BufferGeometry; UV per face (grass top / grass-side / dirt-bottom), half-texel inset untuk anti bleeding; `BLOCK_COLORS` + AO shade tetap dipakai sebagai vertex color (dikali texture).
- `src/main.ts`: `MeshLambertMaterial({ vertexColors: true, map: atlas })`.
- `tests/unit/texture-atlas.test.ts` (4 test); total suite 47 test.

### Perbaikan pasca-M6
- Grass tertutup dirender polos (tile dirt) oleh mesher — type blok tetap grass, jadi bongkar penutup = rumput tumbuh lagi. Band grass-side ditipiskan (2px + ragged). Ditambah `tests/unit/mesher-hidden-grass.test.ts`.
- `16b0bf4`: placeBlock di atas grass mengonversi grass di bawahnya jadi dirt (khas Minecraft), jadi grass yang ditumpuk tidak menampilkan band rumput ganda. Band grass-side juga ditipiskan (2px + ragged). Ditambah 2 test di `tests/unit/block-edit.test.ts`.
- `c65eea8`: UV face samping terbalik vertikal — band hijau grass-side muncul di sisi BAWAH blok, bukan atas. Akibat: grass yang ditumpuk di atas dirt terlihat tidak menyatu. Ditambah `tests/unit/mesher-uv.test.ts` (regression). Sisi bawah blok grass tetap tile dirt.

### Belum dikerjakan (non-goals M6)
- Mipmapping (bisa bikin bleeding), lighting/AO sungguhan, animasi tekstur.

### Risiko / Tech Debt
- Half-texel inset membuat 1 piksel tepi tile sedikit menyusut; visually fine di NearestFilter.
- Tile baru perlu ditambahkan ke grid atlas (ATLAS_COLS/ROWS dan ATLAS_TILES) — belum generik.
- Vertex color × texture membuat warna tergantung keduanya; kalau vertex color jadi 0, tile gelap.

### Cara Verifikasi Manual
1. `npm run dev` → terrain bertekstur pixel-art (grain), bukan warna solid.
2. Zoom dekat: tepi tekstur tajam/pixelated, tidak blur.
3. Tidak ada garis/warna aneh di sambungan antar blok (UV bleeding).
4. Blok grass: permukaan atas hijau bergrain, sisi bawah hijau-ke-cokelat (band 5px) — beda dari atas.
5. FPS stabil (~60 headless, avg 16.62 ms, max 18.00 ms — tidak drop).

## [M5] — Persistence untuk edit blok
Tanggal: 2026-11-11

### Selesai
- `src/state/block-store.ts` (baru): log edit delta (`Map<"x,y,z", VoxelType>`), persistence ke localStorage key `voxel-sandbox:edits:v1`, flush batched (tiap 20 edit) + flush di `beforeunload`.
- `src/world/chunk-manager.ts`: setiap chunk yang dimuat di-timpa dengan edit dari `EditLog` (interface `editsInChunk`); `setBlock` otomatis `recordEdit`.
- Reset world: tombol **Backspace** → hapus localStorage + reload.
- `tests/unit/block-store.test.ts` (7 test); total suite 43 test.

### Belum dikerjakan (non-goals M5)
- Save inventory player, posisi player, IndexedDB.

### Risiko / Tech Debt
- `editsInChunk` scan linear semua edit (O(n)); jadi lambat kalau edit > ribuan. Perlu index per-chunk kalau world edit-nya masif.
- Quota localStorage (~5 MB) belum di-handle; `flush` bisa lempar `QuotaExceededError` pada world yang sangat banyak diedit. Edit 1 blok ≈ 15 byte JSON, jadi baru bahaya di ~300 ribu edit; risiko rendah untuk sekarang.
- Reset world tidak meminta konfirmasi (Backspace langsung reload).

### Cara Verifikasi Manual
1. `npm run dev` → taruh blok → jalan jauh sampai chunk ter-unload → kembali: blok masih ada.
2. Refresh (F5): blok masih ada.
3. Tekan Backspace: world reset ke terrain polos.

## [M4] — Terrain noise + chunk streaming
Tanggal: 2026-11-11

### Selesai
- `src/world/terrain.ts` (baru): `heightAt(x, z, config)` (simplex-noise seeded mulberry32), `generateChunk(cx, cz, config)` murni & deterministik, `topSolidY`, `worldToChunk`; layer stone → dirt (3 blok) → grass.
- `src/world/chunk-manager.ts` (baru): streaming chunk, load radius 4, unload radius 6, antrian terurut jarak, max 1 chunk di-generate per frame; implements `BlockSource` koordinat dunia.
- `src/world/voxel.ts`: interface `BlockSource { getBlock, setBlock }` + adapter `asBlockSource`; physics/raycast/edit sekarang koordinat dunia.
- `src/world/mesher.ts`: per-chunk mesh, culling face tepi chunk via terrain noise (`66dc422`).
- `src/world/chunk.ts` (hapus): diganti terrain.ts.
- `src/main.ts`: mesh per chunk diposisikan di grid, spawn player di atas permukaan terrain, fog, remesh chunk + tetangga saat edit.
- Dependency baru: `simplex-noise` (diizinkan untuk milestone ini).
- `tests/unit/terrain.test.ts` (4 test) + `tests/unit/mesher-culling.test.ts` (2 test).

### Belum dikerjakan (non-goals M4)
- Bioma, gua/ore, greedy meshing (perf).

### Risiko / Tech Debt
- `sim.experimental.frameTimeMetrics` rata-rata ~16.6 ms di Chromium headless (≈60 FPS); max frame 17.7 ms → tidak ada spike > 50 ms saat streaming. Perf nyata perlu cek di mesin user.

### Cara Verifikasi Manual
1. `npm run dev` → spawn di atas terrain bergelombang (bukan datar).
2. Jalan ke arah mana pun → chunk baru muncul bertahap di depan (1 chunk/frame, terdekat dulu).
3. Edit blok tetap bekerja di koordinat dunia lintas chunk.

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
- Remesh penuh per edit; diganti remesh chunk + tetangga di M4.

## [M1] — Voxel world + FPS camera + collision
Tanggal: 2026-11-11

### Selesai
- `src/world/voxel.ts`: `VoxelType = 0 | 1 | 2 | 3`, `getBlock`/`setBlock`/`isSolid` murni, out-of-bounds = kosong.
- Chunk 32x32x32 `Uint8Array`; flat 3 layer: stone → dirt → grass (diganti terrain noise di M4).
- `src/world/mesher.ts`: chunk → satu `BufferGeometry`; vertex color per blok + shading per sisi; face yang bersentuhan blok solid di-cull.
- `src/engine/camera-fps.ts`: pointer lock (klik lock, ESC lepas), yaw/pitch dari mouse, pitch clamp ±89°.
- `src/player/controller.ts` + `constants.ts`: WASD relatif yaw, Space lompat, jalan 5 m/s, gravitasi 32 m/s² (~1.25 blok).
- `src/player/collision.ts`: AABB 0.6x1.8x0.6 vs voxel, resolve X→Y→Z, landing snap, respawn bila jatuh keluar world.

### Perbaikan pasca-M1
- `c52003f`: tanda rotasi strafe A/D (dan W/S saat yaw≠0) terbalik; ditambah `tests/unit/controller.test.ts`.
- `33f2b34`: tuner lompatan ke feel Minecraft (gravitasi 32, jump ~1.25 blok).

### Risiko / Tech Debt
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
