import { CanvasTexture, NearestFilter, SRGBColorSpace, type Texture } from 'three';

/** TILE_PX = resolusi satu tile; ATLAS = grid tile (3x3). */
export const TILE_PX = 16;
export const ATLAS_COLS = 3;
export const ATLAS_ROWS = 3;

/** Indeks tile di atlas 3x3. */
export const ATLAS_TILES = {
  grassTop: 0,
  grassSide: 1,
  dirt: 2,
  stone: 3,
  woodTop: 4,
  woodSide: 5,
  leaves: 6,
} as const;

export type AtlasTile = (typeof ATLAS_TILES)[keyof typeof ATLAS_TILES];

/** PRNG deterministik supaya noise tekstur sama tiap load. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rgb = readonly [number, number, number];

function paintNoise(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  base: Rgb,
  variation: number,
  random: () => number,
  seedPixels?: (set: (px: number, py: number, rgb: Rgb) => void) => void,
): void {
  const set = (px: number, py: number, rgb: Rgb): void => {
    ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    ctx.fillRect(ox + px, oy + py, 1, 1);
  };
  for (let py = 0; py < TILE_PX; py++) {
    for (let px = 0; px < TILE_PX; px++) {
      const d = Math.round((random() - 0.5) * 2 * variation);
      set(px, py, [base[0] + d, base[1] + d, base[2] + d]);
    }
  }
  seedPixels?.(set);
}

let cachedAtlas: Texture | null = null;

/** Singleton atlas texture (biar tidak buat ulang untuk tiap mesh). */
export function atlasTexture(): Texture {
  if (cachedAtlas === null) cachedAtlas = createTextureAtlas();
  return cachedAtlas;
}

/**
 * Bangun atlas tekstur 3x3 tile (grass, dirt, stone, wood, leaves),
 * tiap tile 16x16 px digambar procedural. NearestFilter supaya pixelated.
 */
export function createTextureAtlas(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_PX * ATLAS_COLS;
  canvas.height = TILE_PX * ATLAS_ROWS;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D context tidak tersedia');

  const random = mulberry32(0xbeef);

  // Tile 0: grass top. Saturasi tinggi: base vivid + clump gelap kontras +
  // blade highlight neon + dot kuning-hijau. 5 lapis warna.
  paintNoise(ctx, 0, 0, [104, 178, 72], 14, random, (set) => {
    for (let i = 0; i < 20; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [66, 132, 46]); // clump gelap kontras
      if (random() < 0.5) set((px + 1) % TILE_PX, py, [82, 152, 54]);
    }
    for (let i = 0; i < 12; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [140, 208, 92]); // highlight neon
    }
    for (let i = 0; i < 6; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [186, 224, 108]); // dot kuning-hijau (rumput muda)
    }
    for (let i = 0; i < 8; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [48, 104, 38]); // bayangan dalam
    }
  });

  // Tile 1: grass side. Band 4px tebal + ragged 3-level + tetes dirt +
  // highlight vertikal di band.
  paintNoise(ctx, TILE_PX, 0, [146, 106, 66], 14, random, (set) => {
    for (let py = 0; py < 4; py++) {
      for (let px = 0; px < TILE_PX; px++) {
        const d = Math.round((random() - 0.5) * 24);
        set(px, py, [88 + d, 168 + d, 56 + d]);
      }
    }
    for (let px = 0; px < TILE_PX; px++) {
      const depth = random() < 0.3 ? 3 : random() < 0.5 ? 2 : 1;
      for (let dy = 0; dy < depth; dy++) {
        const d = Math.round((random() - 0.5) * 24);
        set(px, 4 + dy, [80 + d, 156 + d, 50 + d]);
      }
    }
    for (let i = 0; i < 10; i++) {
      const px = Math.floor(random() * TILE_PX);
      set(px, 5 + Math.floor(random() * 5), [116, 82, 50]); // tetes dirt
    }
    for (let i = 0; i < 6; i++) {
      const px = Math.floor(random() * TILE_PX);
      set(px, Math.floor(random() * 3), [136, 208, 92]); // highlight band
    }
  });

  // Tile 2: dirt. Kontras kuat: clump gelap besar + terang + kerikil +
  // dot merah-bata. 5 tone.
  paintNoise(ctx, 2 * TILE_PX, 0, [148, 106, 66], 14, random, (set) => {
    for (let i = 0; i < 20; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [116, 80, 46]);
      if (random() < 0.4) set((px + 1) % TILE_PX, py, [124, 88, 52]);
    }
    for (let i = 0; i < 14; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [172, 132, 86]); // clump terang
    }
    for (let i = 0; i < 6; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [140, 92, 66]); // dot merah-bata
    }
    for (let i = 0; i < 5; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [136, 140, 148]); // kerikil abu
    }
    for (let i = 0; i < 4; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [92, 62, 38]); // pori gelap
    }
  });

  // Tile 3: stone. Kontras kuat: retakan tebal bercabang + blotch gelap
  // besar + highlight + dot mineral.
  paintNoise(ctx, 0, TILE_PX, [150, 148, 146], 10, random, (set) => {
    for (let i = 0; i < 4; i++) {
      // Retakan bercabang: garis horizontal + tetesan vertikal.
      const py = 2 + Math.floor(random() * 12);
      const px = Math.floor(random() * 9);
      const len = 5 + Math.floor(random() * 4);
      for (let k = 0; k < len && px + k < TILE_PX; k++) {
        set(px + k, py, [104, 100, 100]);
        if (random() < 0.4) set(px + k, py + 1, [118, 114, 112]);
        if (random() < 0.2) set(px + k, py - 1, [128, 124, 122]);
      }
    }
    for (let i = 0; i < 10; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [116, 112, 112]); // blotch gelap
      if (random() < 0.5) set((px + 1) % TILE_PX, py, [126, 122, 120]);
    }
    for (let i = 0; i < 10; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [176, 174, 168]); // highlight
    }
    for (let i = 0; i < 5; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [178, 148, 108]); // dot mineral coklat (fleck)
    }
  });
  // Tile 4: wood top (cincin tahun cahaya di tengah).
  paintNoise(ctx, TILE_PX, TILE_PX, [166, 134, 86], 12, random, (set) => {
    for (let i = 0; i < 12; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [188, 156, 104]);
    }
  });

  // Tile 5: wood side (serat vertikal, garis selang-seling terang/gelap).
  paintNoise(ctx, 2 * TILE_PX, TILE_PX, [148, 112, 70], 10, random, (set) => {
    for (let i = 0; i < 16; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [122, 90, 54]);
    }
    for (let px = 0; px < TILE_PX; px += 2) {
      if (random() < 0.5) continue;
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [180, 146, 96]);
      set(Math.min(px + 1, TILE_PX - 1), py, [180, 146, 96]);
    }
  });

  // Tile 6: leaves (hijau pekat + bercak gelap/terang, non-transparan dulu).
  paintNoise(ctx, 0, 2 * TILE_PX, [58, 116, 48], 18, random, (set) => {
    for (let i = 0; i < 10; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [40, 84, 34]);
    }
    for (let i = 0; i < 6; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [92, 150, 70]);
    }
  });
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * UV per tile, di-offset half-texel ke dalam supaya sampling di tepi
 * tidak mengambil piksel tile sebelahnya (UV bleeding).
 */
export function tileUv(tile: AtlasTile): { u0: number; v0: number; u1: number; v1: number } {
  const col = tile % ATLAS_COLS;
  // Canvas origin kiri-atas; WebGL origin kiri-bawah, jadi baris dibalik.
  const row = ATLAS_ROWS - 1 - Math.floor(tile / ATLAS_COLS);
  const half = 0.5 / (TILE_PX * ATLAS_COLS);
  const halfV = 0.5 / (TILE_PX * ATLAS_ROWS);
  return {
    u0: col / ATLAS_COLS + half,
    v0: row / ATLAS_ROWS + halfV,
    u1: (col + 1) / ATLAS_COLS - half,
    v1: (row + 1) / ATLAS_ROWS - halfV,
  };
}

/**
 * Satu tile atlas sebagai data URL PNG 16x16 (dipakai UI hotbar).
 * Dibuat sekali per tile lalu di-cache, supaya tidak menggambar ulang tiap frame.
 */
const tileImageCache = new Map<AtlasTile, string>();

export function tileDataUrl(tile: AtlasTile): string {
  const cached = tileImageCache.get(tile);
  if (cached !== undefined) return cached;

  const src = document.createElement('canvas');
  src.width = TILE_PX * ATLAS_COLS;
  src.height = TILE_PX * ATLAS_ROWS;
  const srcCtx = src.getContext('2d');
  if (srcCtx === null) throw new Error('Canvas 2D context tidak tersedia');
  srcCtx.drawImage(createTextureAtlas().image as HTMLCanvasElement, 0, 0);

  const out = document.createElement('canvas');
  out.width = TILE_PX;
  out.height = TILE_PX;
  const outCtx = out.getContext('2d');
  if (outCtx === null) throw new Error('Canvas 2D context tidak tersedia');
  outCtx.drawImage(
    src,
    (tile % ATLAS_COLS) * TILE_PX,
    Math.floor(tile / ATLAS_COLS) * TILE_PX,
    TILE_PX,
    TILE_PX,
    0,
    0,
    TILE_PX,
    TILE_PX,
  );

  const url = out.toDataURL('image/png');
  tileImageCache.set(tile, url);
  return url;
}

/**
 * Ikon blok isometric ala Minecraft: top face + 2 sisi, digambar sekali
 * ke canvas 32x32 lalu di-cache sebagai data URL. Dipakai UI hotbar
 * supaya item blok terlihat "3D", bukan tile datar.
 */
const iconImageCache = new Map<string, string>();

export function blockIconDataUrl(top: AtlasTile, side: AtlasTile): string {
  const key = `${top}|${side}`;
  const cached = iconImageCache.get(key);
  if (cached !== undefined) return cached;

  const src = document.createElement('canvas');
  src.width = TILE_PX * ATLAS_COLS;
  src.height = TILE_PX * ATLAS_ROWS;
  const srcCtx = src.getContext('2d');
  if (srcCtx === null) throw new Error('Canvas 2D context tidak tersedia');
  srcCtx.drawImage(createTextureAtlas().image as HTMLCanvasElement, 0, 0);

  const out = document.createElement('canvas');
  out.width = 32;
  out.height = 32;
  const ctx = out.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D context tidak tersedia');
  ctx.imageSmoothingEnabled = false;

  // Kubus isometric di 32x32: top face A(0,8) B(16,0) C(32,8) D(16,16).
  // Top face: unit square -> parallelogram miring kanan.
  ctx.setTransform(1, -0.5, 1, 0.5, 0, 8);
  ctx.drawImage(
    src,
    (top % ATLAS_COLS) * TILE_PX,
    Math.floor(top / ATLAS_COLS) * TILE_PX,
    TILE_PX,
    TILE_PX,
    0,
    0,
    TILE_PX,
    TILE_PX,
  );

  // Sisi kiri (shading tipis) dan kanan (shading lebih gelap) untuk kesan depth.
  ctx.setTransform(1, 0.5, 0, 1, 0, 8);
  ctx.drawImage(
    src,
    (side % ATLAS_COLS) * TILE_PX,
    Math.floor(side / ATLAS_COLS) * TILE_PX,
    TILE_PX,
    TILE_PX,
    0,
    0,
    TILE_PX,
    TILE_PX,
  );
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);

  ctx.setTransform(1, -0.5, 0, 1, 16, 16);
  ctx.drawImage(
    src,
    (side % ATLAS_COLS) * TILE_PX,
    Math.floor(side / ATLAS_COLS) * TILE_PX,
    TILE_PX,
    TILE_PX,
    0,
    0,
    TILE_PX,
    TILE_PX,
  );
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);

  const url = out.toDataURL('image/png');
  iconImageCache.set(key, url);
  return url;
}
