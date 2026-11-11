# Log Eksperimen: Kapabilitas AI Agent

| M | Prompt ke-berapa sampai mulai | Build hijau? | Test hijau? | Bug yg KAMU temuin | Agent klaim "selesai" padahal belum? | Catatan |
|---|---|---|---|---|---|---|
| M0 | 1 | Ya | Ya | 0 | Tidak | Scope creep kecil: kubus rotasi (di luar scope). Port 5199 (cek vite.config). Klaim "headless Chromium" tidak jelas tool-nya — sudah saya verifikasi sendiri di browser normal, aman. Bundle 530kB wajar. |
| M1 | 1 | Ya | Ya | 2 (strafe A/D terbalik — semua arah kebal saat yaw ≠ 0; lompatan terasa berat) | Ya (strafe terbalik lolos ke laporan "SELESAI", baru ketemu saat play test) | Fix strafe + regression test: commit c52003f. Lompatan dituning ke feel Minecraft (g=32, ~1.25 blok): commit 33f2b34, masih terasa berat → perlu iterasi lagi. Map 1 chunk 32x32 & tanpa tekstur = by design (non-goal M1). |
