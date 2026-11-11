import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { flatIndex, type VoxelType } from './voxel';

export { flatIndex };

export const CHUNK_SIZE = 32;
export const CHUNK_HEIGHT = 32;
export const DIRT_DEPTH = 3;

export interface Chunk {
  data: Uint8Array;
  size: number;
  /** Koordinat grid chunk (x, z). */
  cx: number;
  cz: number;
  /**
   * Blok dari chunk tetangga untuk koordinat lokal di luar [0, CHUNK_SIZE).
   * Dipakai mesher supaya culling face di tepi chunk benar.
   */
  neighbor?: (x: number, y: number, z: number) => VoxelType | undefined;
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
 * Generate chunk deterministik dari (cx, cz) dan seed.
 * Blok solid dari y=0 sampai heightAt; grass di atas, dirt DIRT_DEPTH blok, stone sisanya.
 */
export function generateChunk(cx: number, cz: number, config: TerrainConfig): Chunk {
  const size = CHUNK_SIZE;
  const data = new Uint8Array(size * size * CHUNK_HEIGHT);
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const h = heightAt(cx * size + x, cz * size + z, config);
      for (let y = 0; y <= h; y++) {
        const type: VoxelType = y === h ? 1 : y >= h - DIRT_DEPTH + 1 ? 2 : 3;
        data[flatIndex(x, y, z, size)] = type;
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
