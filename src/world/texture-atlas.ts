import { CanvasTexture, NearestFilter, SRGBColorSpace, type Texture } from 'three';

/** TILE_PX = resolusi satu tile; ATLAS = grid tile (2x2). */
export const TILE_PX = 16;
export const ATLAS_COLS = 2;
export const ATLAS_ROWS = 2;

/** Indeks tile di atlas 2x2. */
export const ATLAS_TILES = {
  grassTop: 0,
  grassSide: 1,
  dirt: 2,
  stone: 3,
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
 * Bangun atlas tekstur 2x2 tile (grass top, grass side, dirt, stone),
 * tiap tile 16x16 px digambar procedural. NearestFilter supaya pixelated.
 */
export function createTextureAtlas(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_PX * ATLAS_COLS;
  canvas.height = TILE_PX * ATLAS_ROWS;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D context tidak tersedia');

  const random = mulberry32(0xbeef);

  // Tile 0: grass top (hijau gelap, sedikit bercak terang).
  paintNoise(ctx, 0, 0, [86, 152, 62], 16, random);

  // Tile 1: grass side: band hijau tipis 2px + 1px ragged, sisanya dirt.
  // Tipis supaya grass yang ditumpuk tidak terlihat band ganda tebal.
  paintNoise(ctx, TILE_PX, 0, [134, 96, 60], 14, random, (set) => {
    for (let py = 0; py < 2; py++) {
      for (let px = 0; px < TILE_PX; px++) {
        const d = Math.round((random() - 0.5) * 22);
        set(px, py, [86 + d, 152 + d, 62 + d]);
      }
    }
    for (let px = 0; px < TILE_PX; px++) {
      if (random() < 0.5) continue; // tepi bawah bergerigi
      const d = Math.round((random() - 0.5) * 22);
      set(px, 2, [86 + d, 152 + d, 62 + d]);
    }
  });

  // Tile 2: dirt.
  paintNoise(ctx, 0, TILE_PX, [134, 96, 60], 14, random, (set) => {
    for (let i = 0; i < 10; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [104, 72, 44]);
    }
  });

  // Tile 3: stone (abu-abu dengan kerikil gelap).
  paintNoise(ctx, TILE_PX, TILE_PX, [128, 128, 132], 12, random, (set) => {
    for (let i = 0; i < 14; i++) {
      const px = Math.floor(random() * TILE_PX);
      const py = Math.floor(random() * TILE_PX);
      set(px, py, [104, 104, 110]);
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
