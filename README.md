# Voxel Sandbox (Minecraft Clone)

Clone Minecraft berbasis web. Voxel 3D, kamera FPS, hancur/taruh blok.

## Status
M4 selesai: terrain noise + chunk streaming. Lihat `CHANGELOG.md`.

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
| Klik kiri | Hancurkan blok yang di-target (outline putih) |
| Klik kanan | Taruh blok sesuai slot aktif |
| 1–9 | Pilih slot hotbar |
| Jatuh keluar terrain | Otomatis respawn di titik spawn |

Input gerak & edit hanya aktif saat pointer lock aktif. Reach maksimal 6 blok. Klik yang ditahan otomatis repeat tiap 200 ms.

World: terrain simplex noise, chunk 32x32x32 streaming (load radius 4 chunk, unload radius 6, 1 chunk per frame).

## Struktur relevan
- `src/world/voxel.ts` → tipe blok + `BlockSource` (interface koordinat dunia)
- `src/world/terrain.ts` → `heightAt`, `generateChunk` (deterministik), `topSolidY`
- `src/world/chunk-manager.ts` → streaming load/unload chunk
- `src/world/mesher.ts` → chunk ke BufferGeometry, face culling lintas chunk
- `src/world/block-edit.ts` → break/place + guard batas & AABB player
- `src/engine/camera-fps.ts` → pointer lock, yaw/pitch
- `src/player/controller.ts` → input WASD/Space
- `src/player/collision.ts` → AABB vs voxel, resolve X→Y→Z, gravitasi
- `src/player/raycast.ts` → raycast voxel DDA (Amanatides-Woo)
- `src/state/inventory.ts` → state hotbar 9 slot (fungsi murni)
- `src/ui/hotbar.ts` → render hotbar DOM + slot aktif + nama blok

## Roadmap
Lihat AGENTS.md dan CHANGELOG.md.
