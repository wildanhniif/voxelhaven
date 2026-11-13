import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// WebView file:// menolak module script ber-atribut crossorigin (origin
// null). Strip atribut itu dari HTML final.
const stripCrossorigin = {
  name: 'strip-crossorigin',
  transformIndexHtml: (html: string): string =>
    html.replace(/<script([^>]*)\s+crossorigin([^>]*)>/g, '<script$1$2>'),
};

// Build khusus APK: satu file HTML berisi semua JS/CSS (inline),
// supaya WebView bisa memuatnya lewat file:// tanpa server.
export default defineConfig({
  plugins: [viteSingleFile(), stripCrossorigin],
  base: './',
  build: {
    outDir: 'dist-apk',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    reportCompressedSize: false,
  },
});
