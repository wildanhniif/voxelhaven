# AGENTS.md — Minecraft Clone (Web Voxel Sandbox)

## 1. Tujuan Proyek
Voxel sandbox game yang bisa dimainkan di browser. Voxel, bukan pixel-art 2D.
Target akhir: bisa jalan, bisa hancur/taruh blok, bisa eksplorasi terrain.
BUKAN target: multiplayer, mobs kompleks, redstone, modding API.

## 2. Stack (KUNCI — jangan diganti tanpa izin eksplisit dari user)
- Bahasa: TypeScript (strict mode)
- Build: Vite
- Rendering: Three.js
- Test: Vitest (unit) + Playwright (smoke E2E)
- Storage: localStorage (naik ke IndexedDB hanya jika diminta)
- Package manager: npm

## 3. Struktur Folder (patuhi, jangan bikin folder liar)
src/
  engine/       → renderer, loop, input, camera
  world/        → chunk, voxel data, mesher, terrain
  player/       → controller, collision, raycast
  ui/           → HUD, hotbar, debug overlay
  state/        → game state, save/load
  main.ts       → entry point
tests/
  unit/         → *.test.ts (Vitest)
  e2e/          → *.spec.ts (Playwright)
public/
  textures/     → atlas PNG (boleh generate placeholder)

4. Aturan Kerja (WAJIB)
Sebelum mulai: baca AGENTS.md, README.md, CHANGELOG.md, dan jalankan git log --oneline -5.

Kerjakan HANYA scope milestone yang diminta. JANGAN refactor di luar scope.

Ubah maksimal 8 file per milestone. Kalau butuh lebih, tanya dulu.

Setiap milestone selesai = 1 commit: feat(Mx): <ringkas>.

Sebelum bilang "selesai", WAJIB jalankan berurutan:

npm run build (harus 0 error, 0 warning TS)

npm test (harus hijau)

npx playwright test (harus hijau — hanya jika milestone punya E2E)

Kalau ada keputusan desain ambigu → TANYA. Jangan asumsi.

Kalau gagal 2 percobaan berturut-turut pada bug yang sama → STOP, laporkan apa yang sudah dicoba.

JANGAN hapus/ubah test yang sudah ada untuk "memperbaiki" hasil. Kalau test lama salah, jelaskan alasannya dulu.

JANGAN commit node_modules, dist, atau file hasil generate tanpa diminta.

Update CHANGELOG.md di setiap milestone: apa yang selesai, apa yang belum, risiko.

5. Definition of Done (semua milestone)
□ npm run build sukses
□ npm test hijau
□ Fitur bisa diverifikasi manual (tulis langkahnya di CHANGELOG)
□ README diperbarui jika kontrol/fitur berubah
□ Tidak ada any liar di TS, tidak ada console.log sisa debug (kecuali di logger resmi)
□ Ukuran bundle tidak naik > 30% tanpa alasan jelas
6. Konvensi Kode
Nama file: kebab-case.ts. Nama class/type: PascalCase. Nama fungsi/var: camelCase.

Satu file = satu tanggung jawab.

Fungsi maksimal ~60 baris. Kalau lebih, pecah.

Komentar Bahasa Indonesia singkat, HANYA untuk "kenapa", bukan "apa".

Tidak ada global mutable state kecuali di state/.

7. Format Laporan Akhir Milestone
Setelah setiap milestone, tulis blok ini di respons chat:

text
=== LAPORAN MILESTONE Mx ===
Status: SELESAI / SEBAGIAN / GAGAL

File diubah:
- path → alasan
- ...

Yang berhasil:
- ...

Yang BELUM / tidak dikerjakan:
- ...

Risiko / tech debt yang saya tinggalkan:
- ...

Hasil verifikasi:
- npm run build → OK / error: ...
- npm test → X pass, Y fail
- playwright → X pass, Y fail
- Uji manual (langkah singkat): ...

Pertanyaan untuk user (jika ada):
- ...
8. Hal yang DILARANG tanpa izin user
Mengganti library utama (Three.js → Babylon, Vite → Webpack, dll)

Menambah dependency baru di luar yang sudah ada

Menghapus test

Menulis kode "sementara" tanpa TODO yang jelas

Menyatakan "selesai" padahal build/test gagal

Menyembunyikan error dengan try/catch kosong

9. Cara Menjalankan
Dev: npm run dev

Build: npm run build

Test: npm test

E2E: npx playwright test

Preview build: npm run preview