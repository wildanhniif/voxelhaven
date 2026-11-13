# Prompt Blockbench MCP — Grass Block Voxelhaven (Original, Bukan Turunan Minecraft)

## Tujuan

Generate model + tekstur grass block untuk game Voxelhaven, dengan gaya visual
yang terinspirasi dari "low-poly voxel sandbox game" secara umum, BUKAN tiruan
aset Minecraft. Aset dipakai di game web Three.js (Voxelhaven), jadi output
harus kompatibel dengan pipeline export GLTF/GLB.

## Konteks Game

- Game web Three.js, tekstur di-sample dari atlas 3x3 tile, 16x16 px per tile
- NearestFilter (pixelated, tanpa anti-aliasing)
- Sumber tekstur saat ini di game: `src/world/texture-atlas.ts` (procedural)
- Tile grass terdiri dari: grass_top (tile 0), grass_side (tile 1), dirt (tile 2)
- Grass block dipakai sebagai blok permukaan terrain

## Spec Teknis

- 1 cube 16x16x16 (ukuran standar voxel)
- Origin di center-bottom (0,0,0 di kaki blok)
- 6 face, tiap face 16x16 UV
- UV mapping:
  - top  → grass_top
  - side → grass_side
  - bottom → dirt

## Spec Warna (RGB, diambil dari texture-atlas.ts Voxelhaven)

### grass_top
- Base: RGB(86, 152, 62)
- Noise per-pixel: ±16 brightness, deterministic
- Tanpa pola khusus, hanya noise grain halus

### grass_side
- Base bawah: dirt RGB(134, 96, 60), noise ±14
- Band atas: 2px hijau RGB(86, 152, 62) noise ±22
- Tepi bawah band hijau: bergerigi (random 50% pixel di row 3)
- Band tipis (2px) supaya grass bertumpuk tidak double-band

### dirt
- Base: RGB(134, 96, 60), noise ±14
- 10 pixel acak warna RGB(104, 72, 44) (bercak gelap)

## Instruksi Anti-Minecraft

- JANGAN gunakan: palet warna Minecraft persis, pola pixel Minecraft persis,
  layout UV Minecraft, layout grass_side Minecraft (band hijau atas 4px + dirt
  di bawah dengan bercak batu)
- GAYA kami: band hijau lebih tipis (2px, bukan 4px), noise lebih halus,
  bercak dirt lebih jarang (10px per tile, bukan padat)
- Band hijau dengan tepi bergerigi (ragged edge) — pola ini TIDAK ada di
  Minecraft
- Warna hijau lebih gelap dan lebih "cool-toned" daripada Minecraft
  (Minecraft: hijau yellow-green; kami: hijau sederhana 86,152,62)

## Output yang Diharapkan

1. Model: 1 cube, UV sesuai spec
2. Tekstur: buat 3 tile 16x16 (grass_top, grass_side, dirt) dalam satu atlas
   3x3 (sisa tile dibiarkan kosong atau pakai warna netral)
3. Textures di-paint langsung di Blockbench (bukan file PNG terpisah)
4. Export ke .bbmodel, dan siap export GLB untuk Three.js

## Prompt Singkat (untuk ditempel ke MCP agent)

```
Buat grass block untuk game voxel sandbox "Voxelhaven". 1 cube 16x16x16,
origin center-bottom, 6 face dengan UV: top=grass_top, side=grass_side,
bottom=dirt. Tekstur 16x16 per tile, pixelated (NearestFilter), digambar
langsung di Blockbench.

grass_top: hijau sederhana RGB(86,152,62) dengan noise grain per-pixel
±16 brightness, tanpa pola khusus.

grass_side: band hijau TIPIS 2px di atas dengan noise ±22 dan tepi bawah
bergerigi (ragged, random 50%), sisanya dirt. Band harus tipis supaya grass
bertumpuk tidak double-band.

dirt: coklat RGB(134,96,60) noise ±14, dengan 10 pixel bercak gelap
RGB(104,72,44) tersebar acak.

PENTING: gaya visual original Voxelhaven, BUKAN tiruan Minecraft. Jangan
pakai palet warna Minecraft, pola pixel Minecraft, atau layout grass_side
Minecraft (band hijau 4px + bercak batu). Warna hijau lebih dark dan
cool-toned. Band 2px bergerigi adalah signature kami.
```
