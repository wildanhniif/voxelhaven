# Voxel Sandbox (Minecraft Clone)

Clone Minecraft berbasis web. Voxel 3D, kamera FPS, hancur/taruh blok.

## Status
M1 selesai: world voxel flat 32x32 + kamera FPS + gerak + collision. Lihat `CHANGELOG.md`.

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
| Space | Lompat |
| Jatuh keluar world | Otomatis respawn di tengah |

Input gerak hanya aktif saat pointer lock aktif.

## Struktur relevan
- `src/world/voxel.ts` → tipe blok + get/set blok (fungsi murni)
- `src/world/chunk.ts` → chunk 32x32x32, generate flat (stone/dirt/grass)
- `src/world/mesher.ts` → chunk ke BufferGeometry, face culling + vertex color
- `src/engine/camera-fps.ts` → pointer lock, yaw/pitch
- `src/player/controller.ts` → input WASD/Space
- `src/player/collision.ts` → AABB vs voxel, resolve X→Y→Z, gravitasi

## Roadmap
Lihat AGENTS.md dan CHANGELOG.md.
