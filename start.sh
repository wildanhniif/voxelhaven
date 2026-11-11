#!/data/data/com.termux/files/usr/bin/bash
# Start dev server dengan wake lock aktif.
# Kenapa bukan `npm run dev`: shebang .bin/vite pakai /usr/bin/env yang tidak
# ada di Termux, jadi node dipanggil langsung.
termux-wake-lock
cd "$HOME/vh"
exec node node_modules/vite/bin/vite.js --host
