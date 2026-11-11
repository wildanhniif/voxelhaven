# Voxel Sandbox (Minecraft Clone)

Clone Minecraft berbasis web. Voxel 3D, kamera FPS, hancur/taruh blok.

## Status
M8 selesai: world selector (menu input nama + seed dari nama) + world bounds (bedrock Y=0, dinding gaib X/Z, spawn tengah). measurement: 569.8 kB bundle, 73 tests. Lihat `CHANGELOG.md`.

## Cara Menjalankan
```bash
npm install
npm run dev
```
Buka http://localhost:5173

## Kontrol
| Input | Aksi |
| --- | --- |
| Klik kanvas | Aktifkan pointer lock (mouse menggerakkan kamera) |
| ESC | Lepas pointer lock; saat sudah lepas: keluar world → menu |
| Mouse | Lihat sekeliling (pitch dibatasi ±89°) |
| W / A / S / D | Jalan (5 m/s) |
| Space | Lompat (~1.25 blok) |
| Klik kiri | Hancurkan blok → item drop kecil muncul di tanah |
| Klik kanan | Taruh blok sesuai slot aktif (butuh count > 0) |
| 1–9 | Pilih slot hotbar |
| Backspace | Reset world (hapus semua edit, tanpa konfirmasi) |
| Jatuh keluar terrain | Otomatis respawn di titik spawn |

Input gerak & edit hanya aktif saat pointer lock aktif. Reach maksimal 6 blok. Klik yang ditahan otomatis repeat tiap 200 ms.

Blok yang dihancurkan jadi item di tanah dan otomatis masuk hotbar saat kamu mendekat
(jarak ±1 blok). Hotbar menampilkan jumlah per slot (maks 64/slot); slot kosong tampak gelap.
Taruh blok mengurangi jumlah; kalau 0, taruh dibatalkan.

## World & Save System
Game punya **world selector**: saat pertama buka, muncul menu untuk memasukkan nama world.
Nama world menentukan:
- **Terrain**: seed = hash FNV-1a(nama) → nama beda = terrain beda.
- **Edit blok**: key `voxel-sandbox:edits:v1:<nama>` di localStorage.
- **State player**: key `voxel-sandbox:player:v1:<nama>` (posisi + inventory).

Edit disimpan sebagai delta di atas terrain deterministik, bukan snapshot world.
Chunk yang di-unload dan dimuat ulang tetap membawa editanmu. Backspace menghapus
semua edit **world aktif saja**.

**World bounds**: dunia 256×256 blok (8×8 chunk), tinggi Y=0..31.
Y=0 adalah bedrock yang tidak bisa dihancurkan; dinding gaib di tepi X/Z mencegah
player keluar ke area tanpa chunk. Spawn di tengah dunia (128,128).

**Ganti world**: ESC saat pointer lock sudah lepas → save otomatis lalu kembali ke menu.

## Struktur relevan
- `src/world/voxel.ts` → tipe blok + `BlockSource` (interface koordinat dunia)
- `src/world/terrain.ts` → `heightAt`, `getTreeHeight`, `generateChunk` (deterministik, termasuk pohon lintas chunk), `topSolidY`
- `src/world/chunk-manager.ts` → streaming load/unload chunk + penerapan edit saat load
- `src/world/mesher.ts` → chunk ke BufferGeometry, face culling lintas chunk
- `src/world/block-edit.ts` → break/place + guard batas & AABB player
- `src/state/block-store.ts` → log edit + persistence localStorage
- `src/engine/camera-fps.ts` → pointer lock, yaw/pitch
- `src/player/controller.ts` → input WASD/Space
- `src/player/collision.ts` → AABB vs voxel, resolve X→Y→Z, gravitasi
- `src/player/raycast.ts` → raycast voxel DDA (Amanatides-Woo)
- `src/state/inventory.ts` → state hotbar 9 slot berisi stack `{ type, count }` (fungsi murni)
- `src/entity/item-drop.ts` → entity item drop: fisika jatuh, putar/bobbing, pickup radius
- `src/ui/hotbar.ts` → render hotbar DOM + badge count + nama blok
- `src/ui/touch-controls.ts` → joystick virtual + drag look + tombol aksi (mobile)
- `src/state/world-manager.ts` → seed deterministik dari nama world + key localStorage per world
- `src/world/world-bounds.ts` → konstanta batas dunia (256×256, Y 0..31) + predikat bounds
- `src/ui/main-menu.ts` → overlay menu: input nama world + tombol Play

## Roadmap
Lihat AGENTS.md dan CHANGELOG.md.
