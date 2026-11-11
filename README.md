# Voxel Sandbox (Minecraft Clone)

Clone Minecraft berbasis web. Voxel 3D, kamera FPS, hancur/taruh blok.

## Status
M6 selesai: terrain noise + chunk streaming + persistence edit blok + texture atlas pixel-art. Lihat `CHANGELOG.md`.

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
| ESC | Lepas pointer lock |
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

## Save System
Semua blok yang kamu hancurkan/taruh disimpan sebagai delta di localStorage
(key `voxel-sandbox:edits:v1`), bukan snapshot world. Terrain di-regenerate
deterministik dari noise, lalu edit diterapkan di atasnya. Akibatnya:

- Chunk yang di-unload dan dimuat ulang tetap membawa editanmu.
- Refresh browser (F5) tidak menghilangkan editan.
- Backspace menghapus semua edit (reset ke terrain polos).
- Yang TIDAK disimpan (by design): inventory, posisi player.

## Struktur relevan
- `src/world/voxel.ts` → tipe blok + `BlockSource` (interface koordinat dunia)
- `src/world/terrain.ts` → `heightAt`, `generateChunk` (deterministik), `topSolidY`
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

## Roadmap
Lihat AGENTS.md dan CHANGELOG.md.
