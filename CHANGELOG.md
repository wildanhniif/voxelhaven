# CHANGELOG


## [M8] — World selector + world bounds (Growtopia-style)
Tanggal: 2026-11-11

### Selesai
- `src/state/world-manager.ts` (baru): `worldSeed()` FNV-1a 32-bit dari nama world, `storageKey()`, `validWorldName()`. Nama beda → terrain beda + save beda.
- `src/world/world-bounds.ts` (baru): `WORLD_SIZE=256`, `WORLD_HEIGHT=CHUNK_HEIGHT` (0..31), `WORLD_CENTER=128`, predikat `inWorldXZ/inWorldY/inWorldChunk`.
- `src/ui/main-menu.ts` (baru): overlay DOM input nama world + tombol Play (validasi non-empty, Enter submit).
- `src/main.ts`: seluruh init game dibungkus `boot(worldName)`; menu tampil bila `?world=` tidak ada di URL; seed terrain = `worldSeed(nama)`; spawn `WORLD_CENTER`; ESC (saat pointer lock sudah lepas) → flush save + reload ke menu.
- `src/state/block-store.ts`: `createBlockStore(worldName)` → key localStorage `voxel-sandbox:edits:v1:<nama>`.
- `src/state/player-save.ts`: `savePlayer(worldName, …)` / `loadPlayer(worldName)` → key `voxel-sandbox:player:v1:<nama>`.
- `src/world/block-edit.ts`: `breakBlock` menolak Y=0 (bedrock) + koordinat di luar bounds; `placeBlock` menolak koordinat di luar bounds.
- `src/world/chunk-manager.ts`: chunk di luar 8×8 dunia tidak diantri/generate.
- `src/player/collision.ts`: clamp X/Z ke `[HALF_W, WORLD_SIZE-HALF_W]` (dinding gaib).
- `tests/unit/block-edit.test.ts`: test "menghapus blok solid" diubah jadi blok Y=1; **test baru**: `breakBlock` di Y=0 ditolak (bedrock). Perubahan assertion karena behavior Y=0 memang berubah by design di M8.
- `tests/unit/block-store.test.ts`: semua `createBlockStore()` → `createBlockStore('TestWorld')` (signature baru).

### Catatan desain
- **Y tetap 0..31**: vertical chunking (Y=64) berisiko regresi besar; keputusan disetujui user.
- **Restart via reload**: ganti world = `location.reload` setelah update `?world=` param; paling minim risiko memory leak (tidak perlu teardown penuh Three.js scene).
- **9 file disentuh** (batas AGENTS.md 8): scope M8 memang butuh wiring lintas layer (bounds + selector + save); diungkapkan di laporan.

### Verifikasi manual (desktop)
1. `npm run dev` → muncul menu "VoxelHaven".
2. Masukkan nama (mis. `test1`) → Play → masuk world, terrain konsisten.
3. Break/place blok → ESC → kembali ke menu.
4. Masuk `test1` lagi → editan tetap ada; masuk `test2` → terrain/save beda.
5. Jalan ke tepi dunia → tidak bisa lewat (dinding gaib); gali sampai Y=0 → bedrock tidak bisa dihancurkan.

### Measurement
- Bundle: **569.78 kB** (gzip 144.92 kB), Three.js dominan.
- Tests: **73 passed / 73** (baseline M7.2: 72; +1 test bedrock baru).
- tsc strict: 0 error.
Tanggal: 2026-11-11

### Selesai
- `src/world/mesher.ts` (fix bug): vertex color sebelumnya memakai `BLOCK_COLORS` per jenis blok padahal material chunk memakai `map` + `vertexColors: true` → warna blok dan tekstur **dikalikan dua** (leaves jadi hitam pekat, terlihat saat break dan di sekitar tajuk pohon). Vertex color sekarang hanya membawa shade wajah (AO). `BLOCK_COLORS` dihapus karena tidak terpakai lagi.
- `src/world/terrain.ts`: `TREE_PROBABILITY` 0.2 → 0.04 (pohon jauh lebih jarang, ~0.4 pohon/chunk).
- `src/state/player-save.ts` (baru): persist posisi player + inventory ke localStorage (`voxel-sandbox:player:v1`), dengan validasi parse. Autosave tiap 10 detik di loop render + flush di `beforeunload` (beforeunload tidak handal di mobile, OS bisa bunuh tab tanpa event).
- Edit blok sudah terpersist via `block-store` (localStorage), seed world fixed 1337 → world konsisten antar reload.

### Catatan desain
- **"Database"**: untuk game browser single-player, localStorage + serialisasi delta (edit blok) + state player adalah pilihan yang benar — tanpa dependency baru, sinkron, cukup untuk ratusan ribu edit. SQLite/Postgres hanya relevan kalau nanti ada multiplayer.
- Kendala verifikasi: blok hitam dianalisis lewat data geometri headless (vertex color terbukti sumber masalah) tapi render visual mobile belum dicek ulang di device.

## [M7.1] — Kontrol sentuh mobile (gerak dasar)
Tanggal: 2026-11-11

### Selesai
- `src/ui/touch-controls.ts` (baru): joystick virtual kiri (gerak analog), drag di area atas untuk memutar pandangan, tombol jump/break/place. Hanya dipasang kalau `ontouchstart` ada, jadi desktop tidak terpengaruh.
- `src/player/controller.ts`: `createController` menerima sumber input touch opsional (`move` x/z analog + `jump`); joystick aktif tanpa pointer lock karena mobile tidak punya Pointer Lock API.
- `src/engine/camera-fps.ts`: rotasi mouse diekstrak ke `applyLook(dx, dy)` dan diekspos di `FpsCameraHandle`; touch drag memakai jalur yang sama.
- `src/main.ts`: touch controls di-wire ke `performAction` (break/place instan) dan ke controller.

### Yang BELUM / tidak dikerjakan
- Hotbar touch (pilih slot) dan inventory mobile.
- Repeat saat tombol break/place ditahan di touch (hanya tap tunggal).
- Tuning sensitivitas look per perangkat.

### Cara Verifikasi Manual
1. Buka game di Chrome Android (bukan desktop mode) -> joystick, tombol jump/break/place muncul.
2. Dorong joystick -> player bergerak; drag area atas -> kamera berputar.
3. Tap tombol ⛏ di depan blok -> blok hancur.

## [M7] — Pohon prosedural (oak) + generasi lintas chunk
Tanggal: 2026-11-11

### Selesai
- `src/world/voxel.ts`: `VoxelType` diperluas — 4=Wood, 5=Leaves.
- `src/world/terrain.ts`: `getTreeHeight(x, z, config)` — pohon deterministik per kolom dunia (hash 2D seeded, sel grid 10x10 dengan jitter, peluang sel 20%, tinggi batang 4-6 blok; jarak minimum antar pohon ~7 blok). `generateChunk` juga menempatkan daun dari pohon kolom tetangga (radius 1, lintas chunk) sehingga tajuk tidak terpotong di perbatasan chunk. Bentuk tajuk oak: lapis bawah plus-shape 3x3 tanpa sudut, tengah 3x3 penuh, puncak 1 blok.
- `src/world/texture-atlas.ts`: atlas 2x2 -> 3x3; tile baru `woodTop`, `woodSide`, `leaves` (procedural, NearestFilter).
- `src/world/mesher.ts`: `BLOCK_COLORS` + `TILES` untuk Wood (atas/bawah beda dengan sisi) dan Leaves (solid, belum transparan).
- `src/ui/hotbar.ts` + `src/ui/block-names.ts`: nama + ikon isometric blok baru (muncul saat item Wood/Leaves masuk inventory lewat tebang).
- Tests: `tests/unit/terrain.test.ts` +3 (determinisme pohon, pohon tidak melayang + tajuk, daun lintas chunk). Test atlas/tile/hidden-grass/neighbor-culling disesuaikan ke grid 3x3 (asumsi koordinat 2x2 tidak berlaku lagi; hidden-grass kini cek u+v, bukan hanya v). Total 72 test.

### Yang BELUM / tidak dikerjakan (non-goals)
- Transparansi daun (alpha blending), variasi jenis pohon, animasi daun.

### Risiko / Tech Debt
- Scan daun per kolom (9 kolom kandidat) menambah biaya generateChunk; masih 1 chunk/frame, tidak ada spike terasa.
- `getTreeHeight` dipanggil berulang untuk kolom yang sama saat scan tetangga; bisa di-cache per (x,z) jika terasa lambat.
- Jarak minimum antar pohon ~7 blok (TREE_MIN_GAP=3, TREE_CELL=10) membatasi kepadatan ~2 pohon/chunk; kalau terasa terlalu jarang tinggalkan TREE_PROBABILITY=0.2.

### Cara Verifikasi Manual
1. `npm run dev` -> muncul pohon oak: batang Wood (sisi beda dengan atas) + tajuk Leaves.
2. Jalan ke perbatasan chunk -> tajuk utuh, tidak ada daun/batang terpotong.
3. Tebang batang/daun dengan klik kiri -> item drop masuk hotbar dengan nama & ikon benar.

## [M6.5.5] — Kamera TPP depan (lihat muka) + TPP pegang blok
Tanggal: 2026-11-11

### Selesai
- F5 kini 3 mode: FPP → TPP belakang → TPP depan (kamera di depan player, menghadap balik; yaw dibalik 180°, pitch terbalik).
- Model player (TPP) kini memegang blok bertekstur di tangan kanan, sinkron dengan slot hotbar aktif (sama seperti FPP).

### Cara Verifikasi Manual
1. Tekan F5 dua kali → kamera di depan, muka + mata player terlihat.
2. Pilih slot grass → blok grass bertekstur di tangan kanan model.
3. Ganti slot → blok berganti; slot tangan kosong → tangan kosong.

## [M6.5.7] — Tangan 3D, muka lebih bagus, orbit kamera TPP 360 derajat
Tanggal: 2026-11-11

### Selesai
- FPP arms: sleeve (baju) + forearm (kulit) + hand (kulit pipih) + jari + ibu jari → keliatan 3D.
- Player model (muka TPP): mata putih+pupil hitam+mulut coklat; tangan: lengan atas (baju) + forearm + hand kulit di ujung bawah.
- TPP orbit 360 derajat: mouse di TPP mode memutar orbit kamera tanpa mengubah arah hadap player. Player diam menghadap yaw awal; kamera bisa dilihat dari sudut mana pun (depan, samping, atas, dll).

### Cara Verifikasi Manual
1. FPP: tangan kanan/kiri terlihat bersegmen (sleeve+baju, forearm+kulit, jari+jari).
2. Pilih slot grass → blok rumput bertekstur di tangan.
3. Tekan F5 -> TPP. Gerakkan mouse: kamera berputar mengelilingi player (360). Player diam, bisa lihat muka dari depan.

## [M6.5.6] — Fix TPP depan: kamera kini benar-benar tampak muka
Tanggal: 2026-11-11

### Selesai
- Fix bug TPP_FRONT: posisi kamera sebelumnya dihitung dari arah kamera (yang sudah dibalik 180°), sehingga kamera bermukim di belakang player dan membelakangi player. Sekarang posisi dihitung dari arah hadap player (yaw/pitch), kamera di depan player menghadap balik ke arah player.

### Cara Verifikasi Manual
1. Tekan F5 dua kali → badan player terlihat penuh dari depan (muka + mata).
2. Gerakkan mouse → kamera tetap mengorbit menghadap player.
3. Pilih slot blok → tangan kanan model tetap memegang blok bertekstur.

## [M6.5.4] — Slot tangan kosong, held block bertekstur, fix item ngambang
Tanggal: 2026-11-11

### Selesai
- Slot 0 hotbar = tangan kosong (ikon ✋); item mulai slot 1 (HAND_SLOT). Modal awal: slot 1-3 grass/dirt/stone.
- fpp-arms: held block di ujung tangan kanan pakai geometri bertekstur atlas (blockBoxGeometry), bukan warna solid.
- Fix item drop ngambang: fisika gravitasi kini cek blok solid di bawah item dan snap ke permukaan atas blok tersebut.
- Item drop juga pakai tekstur atlas (bukan warna solid).

### Cara Verifikasi Manual
1. Hotbar: slot kiri ada ikon tangan; slot 1-3 blok (badge 64).
2. Pilih slot grass → tangan kanan memegang blok grass bertekstur (bukan kotak abu).
3. Hancurkan blok → item jatuh ke tanah (tidak ngambang), bertekstur sesuai blok.

## [M6.5.3] — Fix: stack 22 blok dianggap pegang 2 tangan
Tanggal: 2026-11-11

### Selesai
- Bug: main.ts mengirim COUNT stack (mis. 22 grass) ke heldCount, padahal fpp-arms mengharapkan jumlah JENIS item yang dipegang -> memegang grass 22 muncul 2 tangan.
- Fix: kirim 1 (ada item di slot aktif) atau 0 (kosong), bukan count stack.

## [M6.5.2] — Aturan tampilnya tangan FPP (spec user)
Tanggal: 2026-11-11

### Selesai
- Jarak lengan dilebar: BASE_POS_X 0.3 -> 0.55 (dekat tepi kiri/kanan layar).
- Aturan visibilitas: slot aktif kosong (count 0) -> tangan tersembunyi; saat mukul (swing) tangan kanan muncul sejenak. Pegang item -> tangan kanan tampil; 2 jenis item dipegang -> kedua tangan.
- fpp-arms.update kini menerima heldCount; main.ts menghitungnya dari slot aktif.

### Cara Verifikasi Manual
1. Slot aktif kosong (slot 4-9 atau count 0): tangan tidak terlihat; klik -> tangan kanan muncul sekejap mengayun.
2. Slot aktif berisi blok: tangan kanan selalu terlihat.

## [M6.5.1] — Fix lengan FPP bergeser saat kamera diputar terus
Tanggal: 2026-11-11

### Selesai
- Bug: yaw kamera tidak di-wrap ke ±π (terus membesar saat muter), sedangkan fpp-arms memakai yaw*0.02 sebagai offset horizontal → setelah berputar beberapa kali lengan bergeser sampai keluar layar.
- Fix: hapus pengaruh yaw terhadap posisi lengan + drop parameter yaw dari update().

### Cara Verifikasi Manual
1. FPP: gulir mouse ke kanan/kiri terus menerus 10+ putaran → lengan tetap di tempat.

## [M6.5] — Item drops & inventory count
Tanggal: 2026-11-11

### Selesai
- src/state/inventory.ts: slot jadi stack { type, count } (maks 64). API baru: addItem, removeItem, getCount. Modal awal slot 0-2 penuh (grass/dirt/stone).
- src/entity/item-drop.ts (baru): entity item drop — kotak 0.25 warna blok, gravitasi, putar + bobbing, pickup radius 1.2 blok via callback tryPickup (inventory penuh → item tetap di tanah).
- main.ts: breakAtCursor spawn drop; placeAtCursor cek getCount > 0 lalu removeItem; loop update drops tiap frame.
- src/ui/hotbar.ts: badge jumlah di pojok kanan bawah tiap slot; slot kosong/count-0 gelap (brightness 0.5).
- tests/unit/inventory-count.test.ts (6 test); tests/unit/inventory.test.ts disesuaikan ke API stack. Total 67 test.
- README: kontrol + mekanik item drop.

### Yang BELUM / tidak dikerjakan
- Drag & drop inventory, stack menyebar otomatis (by design: item hangus kalau penuh).
- Item drop tidak di-persist ke localStorage (hilang saat refresh).

### Risiko / Tech Debt
- Item drop yang tidak pernah di-pickup menumpuk tanpa GC; kalau jadi lag perlu despawn timer.
- Pickup pakai jarak euclidean pusat-ke-pusat (bukan AABB); cukup untuk sekarang.

### Cara Verifikasi Manual
1. Klik kiri blok → muncul item kecil di tanah, muter + bobbing.
2. Dekati item → hilang, count slot di hotbar +1.
3. Klik kanan → count berkurang; count 0 → tidak bisa taruh, slot gelap.
4. Break 65+ blok sejenis tanpa pickup tidak mungkin melebihi 64/slot — kelebihan masuk slot baru.

## [M6.4.1] — Pasangan lengan FPP di tengah, tetap renggang
Tanggal: 2026-11-11

### Selesai
- Jarak lengan kiri-kanan dikembalikan seperti semula (BASE_POS_X 0.3, renggang, tidak nyambung).
- Seluruh pasangan lengan digeser horizontal GROUP_OFFSET_X -0.06: posisi di tengah layar, sedikit ke kiri.

## [M6.4] — Lengan FPP terpisah, badan disembunyikan
Tanggal: 2026-11-11

### Selesai
- Root cause badan aneh: kamera FPP ada DI DALAM kepala model; saat pitch ekstrem, bahu/kerah torso terlihat dari dalam dan tampak seperti tembok.
- Solusi: di FPP seluruh model player disembunyikan; diganti src/player/fpp-arms.ts — dua lengan kecil (sleeve biru + tangan kulit) child kamera, depthTest:false + renderOrder 999.
- Lengan FPP mengikuti pitch kamera (lift = pitch*0.35): lihat atas → lengan naik ke tengah layar, lihat bawah → lengan turun. Tidak ada badan/kerah yang aneh lagi.
- Klik break/place: swing sinus 220ms di lengan kanan. Jalan: bobbing.
- TPP tidak berubah: model player penuh (kepala terlihat).

### Cara Verifikasi Manual
1. FPP: lihat ke atas (awan) → dua lengan naik terlihat; lihat ke bawah → lengan turun, TIDAK ada badan/kerah aneh.
2. Klik → lengan kanan mengayun; jalan → bobbing.
3. F5 TPP → model penuh normal; F5 balik → hanya lengan FPP.

## [M6.3.2] — Fix lengan saat lihat ke bawah
Tanggal: 2026-11-11

### Selesai
- Bug: pitch kamera dikali 0.8 tanpa clamp; lihat lurus ke bawah (pitch ~1.55 rad) membuat lengan berotasi ~1.8 rad = terpaksa naik ke depan muka (jelek).
- Fix: pengaruh pitch di-clamp (armPitch 0.45x, rentang [-0.5, +0.35]). Lihat bawah → lengan hampir lurus ke bawah dekat badan (tidak menutup layar); lihat atas → lengan sedikit terangkat.

### Cara Verifikasi Manual
1. FPP: lihat lurus ke bawah → lengan lurus ke bawah dekat badan, badan/kaki terlihat wajar, tidak ada lengan menutup layar.
2. Lihat ke langit → lengan terangkat sedikit, normal.

## [M6.3.1] — Tangan mengikuti pitch kamera
Tanggal: 2026-11-11

### Selesai
- src/player/player-model.ts: tangan diberi pose dasar diangkat ke depan (ARM_FORWARD 0.55 rad) dan offset mengikuti pitch kamera (x0.8): lihat ke bawah → tangan turun, lihat ke atas → tangan terangkat.
- Pitch kamera disimpan di update() lalu dipakai animate(), jadi arah tangan konsisten dengan pandangan.

### Cara Verifikasi Manual
1. FPP: lihat lurus ke bawah → kedua tangan turun mengikuti pandangan; lihat ke atas (langit) → tangan terangkat.
2. Jalan + klik: ayunan kaki/tangan tetap jalan dan tidak bertabrakan dengan offset pitch.

## [M6.3] — FPP pakai model player asli (kamera di kepala)
Tanggal: 2026-11-11

### Selesai
- HAPUS src/player/viewmodel.ts: viewmodel tangan palsu dibuang total.
- FPP kini memakai model player asli: kamera di posisi mata (1.62), kepala disembunyikan supaya tidak menutupi pandangan, badan/tangan/kaki terlihat seperti aslinya.
- src/player/player-model.ts: tambah setHeadVisible(visible) untuk toggle kepala FPP/TPP.
- src/main.ts: model player selalu dirender; applyCameraMode hanya mengatur posisi kamera dan visibilitas kepala.
- Animasi jalan + swing tangan tetap jalan di kedua mode (tangan kanan mengayun saat break/place).

### Risiko / Tech Debt
- Tangan model bisa sedikit menutupi pandangan saat berayun; amplitudo animasi sudah moderat (0.5 rad).
- Kamera di dalam kepala yang disembunyikan: aman, tapi kalau nanti ada headwear/helmet harus ikut disembunyikan.

### Cara Verifikasi Manual
1. FPP: lihat ke bawah → kaki terlihat; jalan → kaki & tangan berayun; klik → tangan kanan mengayun.
2. F5: TPP dengan kepala terlihat; F5 lagi → balik FPP tanpa kepala.

## [M6.2d] — Pose tangan FPP dihitung terhadap frustum
Tanggal: 2026-11-11

### Selesai
- Root cause terpotong: base y=-0.35 tepat di tepi bawah frustum (y=-0.35 di z=-0.5, FOV 70°) dan yaw -0.4 memutar ujung lengan menjauhi tengah layar.
- Pose baru dihitung numerik terhadap frustum: base (0.28, -0.22, -0.5) = NDC (0.44, -0.63), rot (-0.1, +0.55, 0.25) → ujung lengan menunjuk ke tengah layar NDC (0, -0.41). Kedua ujung terverifikasi di dalam layar.
- Panjang lengan 0.55, lebar/tinggi 0.15, warna 0xF5CBA7, pivot pangkal, depth flags + renderOrder 999 tetap.

### Cara Verifikasi Manual
1. FPP: lengan menjulur dari kanan-bawah ke arah tengah, tidak ada bagian terpotong tepi layar.

## [M6.2c] — Hard fix viewmodel (skala, posisi, depth)
Tanggal: 2026-11-11

### Selesai
- src/player/viewmodel.ts: lengan tunggal BoxGeometry(0.15, 0.15, 0.6) warna kulit 0xF5CBA7, pivot di pangkal (mesh di z=-0.3). Base posisi (0.35, -0.35, -0.5), rotasi (-0.2, -0.4, 0.1).
- Material MeshBasicMaterial depthTest:false + depthWrite:false, renderOrder 999: tangan selalu digambar paling akhir sehingga tidak tertutup blok.
- Tangan digantung sebagai child Camera (scene.add(camera) + camera.add(viewmodel.group)), bukan scene terpisah.
- Animasi: bobbing sin saat jalan; swing sinus mulus 200ms yang mengayun ke depan-turun dari base transform.

### Risiko / Tech Debt
- depthTest:false berarti tangan juga akan menembus UI 3D lain di masa depan; saat ini aman karena hanya ada world.

### Cara Verifikasi Manual
1. FPP: tangan memanjang ke depan (bukan gepeng), ujung tidak terpotong layar.
2. Nempel ke dinding: tangan tetap terlihat penuh, tidak masuk ke blok.
3. Klik kiri: ayunan mulus ke depan lalu kembali.
4. Jalan: tangan bobbing pelan. F5: tangan hilang di TPP, muncul lagi di FPP.

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
