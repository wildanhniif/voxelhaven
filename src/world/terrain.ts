import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { flatIndex, type VoxelType } from './voxel';

export { flatIndex };

export const CHUNK_SIZE = 32;
export const CHUNK_HEIGHT = 32;
export const DIRT_DEPTH = 3;

/** Peluang satu kolom grass punya pohon. */
export const TREE_PROBABILITY = 0.02;
/** Jarak horizontal maksimum daun dari batang. */
export const TREE_LEAF_RADIUS = 1;

export interface Chunk {
  data: Uint8Array;
  size: number;
  /** Koordinat grid chunk (x, z). */
  cx: number;
  cz: number;
}

export const DEFAULT_SEED = 1337;

export interface TerrainConfig {
  readonly seed: number;
  /** Amplitudo tinggi dari baseline (blok). */
  readonly amplitude: number;
  /** Baseline tengah world (blok). */
  readonly base: number;
}

export const DEFAULT_TERRAIN: TerrainConfig = { seed: DEFAULT_SEED, amplitude: 9, base: 12 };

// Noise mahal dibuat; cache per config object supaya heightAt murah per kolom.
const noiseCache = new WeakMap<TerrainConfig, NoiseFunction2D>();

function noiseFor(config: TerrainConfig): NoiseFunction2D {
  const cached = noiseCache.get(config);
  if (cached !== undefined) return cached;

  // PRNG deterministik mulberry32, seeded dari config.seed.
  let a = config.seed >>> 0;
  const random = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const noise = createNoise2D(random);
  noiseCache.set(config, noise);
  return noise;
}

/**
 * Tinggi permukaan terrain di koordinat dunia (x, z). Deterministik terhadap seed.
 */
export function heightAt(x: number, z: number, config: TerrainConfig): number {
  const h = (noiseFor(config)(x * 0.02, z * 0.02) + 1) / 2; // 0..1
  const raw = Math.round(config.base + h * config.amplitude);
  return Math.max(1, Math.min(CHUNK_HEIGHT - 1, raw));
}

/**
 * Hash deterministik 2D -> 0..1, terdistribusi merata untuk koordinat menyebar.
 * Murmurnya sengaja diperkaya supaya kolom bertetangga tidak berkorelasi.
 */
function hash2d(x: number, z: number, seed: number): number {
  let a = (Math.imul(x, 0x9e3779b1) ^ Math.imul(z, 0x85ebca77) ^ seed) >>> 0;
  a ^= a >>> 16;
  a = Math.imul(a, 0x7feb352d);
  a ^= a >>> 15;
  a = Math.imul(a, 0x846ca68b);
  a ^= a >>> 16;
  return (a >>> 0) / 4294967296;
}

/**
 * Apakah (x, z) di koordinat dunia berdiri batang pohon?
 * Return tinggi batang (4..6 blok) atau null kalau tidak ada pohon.
 * Murni fungsi dunia (bukan chunk) supaya pohon konsisten lintas chunk.
 */
export function getTreeHeight(x: number, z: number, config: TerrainConfig): number | null {
  const r = hash2d(x, z, config.seed);
  if (r >= TREE_PROBABILITY) return null;
  return 4 + Math.floor(hash2d(x, z, config.seed ^ 0x5f5f) * 3);
}

/** Bentuk tajuk oak sederhana relatif ke batang. dy: 0 = level bawah tajuk. */
function oakLeafTest(dy: number, dx: number, dz: number): boolean {
  const ax = Math.abs(dx);
  const az = Math.abs(dz);
  if (dy === 0) return ax <= 1 && az <= 1 && ax + az <= 2; // plus-shape tanpa sudut
  if (dy === 1) return ax <= 1 && az <= 1; // 3x3 penuh
  return dx === 0 && dz === 0; // puncak
}

function placeTreePart(
  data: Uint8Array,
  size: number,
  x: number,
  y: number,
  z: number,
  type: VoxelType,
  overwrite: boolean,
): void {
  if (x < 0 || x >= size || z < 0 || z >= size || y < 0 || y >= CHUNK_HEIGHT) return;
  const i = flatIndex(x, y, z, size);
  if (!overwrite && data[i] !== 0) return;
  data[i] = type;
}

/**
 * Taruh daun pohon di kolom lokal (x,z) chunk, dari pohon yang batangnya di
 * kolom dunia (tx,tz). Kolom ini di koordinat dunia (wx,wz) — offset horizontal
 * dihitung murni di koordinat dunia sehingga aman lintas chunk.
 */
function placeTreeColumn(
  data: Uint8Array,
  size: number,
  x: number,
  z: number,
  wx: number,
  wz: number,
  tx: number,
  tz: number,
  config: TerrainConfig,
): void {
  const th = getTreeHeight(tx, tz, config);
  if (th === null) return;
  const ox = wx - tx;
  const oz = wz - tz;
  const base = heightAt(tx, tz, config);
  for (let dy = 0; dy < 3; dy++) {
    if (!oakLeafTest(dy, ox, oz)) continue;
    placeTreePart(data, size, x, base + th + dy, z, 5, false);
  }
}

/**
 * Generate chunk deterministik dari (cx, cz) dan seed.
 * Blok solid dari y=0 sampai heightAt; grass di atas, dirt DIRT_DEPTH blok, stone sisanya.
 * Pohon: batang di kolom sendiri; daun dari pohon radius 1 kolom (termasuk tetangga
 * lintas chunk) supaya tajuk tidak terpotong di perbatasan chunk.
 */
export function generateChunk(cx: number, cz: number, config: TerrainConfig): Chunk {
  const size = CHUNK_SIZE;
  const data = new Uint8Array(size * size * CHUNK_HEIGHT);
  const origX = cx * size;
  const origZ = cz * size;
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const h = heightAt(origX + x, origZ + z, config);
      for (let y = 0; y <= h; y++) {
        const type: VoxelType = y === h ? 1 : y >= h - DIRT_DEPTH + 1 ? 2 : 3;
        data[flatIndex(x, y, z, size)] = type;
      }
      const tree = getTreeHeight(origX + x, origZ + z, config);
      if (tree === null) continue;
      const base = heightAt(origX + x, origZ + z, config);
      if (base + tree + 2 >= CHUNK_HEIGHT) continue;
      for (let ty = 1; ty <= tree; ty++) {
        placeTreePart(data, size, x, base + ty, z, 4, true);
      }
    }
  }
  // Daun lintas chunk: scan kolom tetangga (radius daun) termasuk kolom sendiri.
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const wx = origX + x;
      const wz = origZ + z;
      for (let dx = -TREE_LEAF_RADIUS; dx <= TREE_LEAF_RADIUS; dx++) {
        for (let dz = -TREE_LEAF_RADIUS; dz <= TREE_LEAF_RADIUS; dz++) {
          placeTreeColumn(data, size, x, z, wx, wz, wx + dx, wz + dz, config);
        }
      }
    }
  }
  return { data, size, cx, cz };
}

/** y tertinggi yang solid di kolom (x, z) chunk; -1 kalau kosong. */
export function topSolidY(chunk: Chunk, x: number, z: number): number {
  const { size, data } = chunk;
  for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
    if (data[flatIndex(x, y, z, size)] !== 0) return y;
  }
  return -1;
}

/** Koordinat chunk dari koordinat dunia (blok). */
export function worldToChunk(x: number, z: number): { cx: number; cz: number } {
  return { cx: Math.floor(x / CHUNK_SIZE), cz: Math.floor(z / CHUNK_SIZE) };
}
