import { CHUNK_HEIGHT } from './terrain';

/**
 * Batas dunia. X/Z 0..WORLD_SIZE-1, Y 0..WORLD_HEIGHT-1.
 * Dipakai terrain, chunk-manager, block-edit, dan collision supaya tidak ada
 * dua definisi batas yang bisa berbeda.
 */
export const WORLD_SIZE = 256;
export const WORLD_HEIGHT = CHUNK_HEIGHT;
/** Jumlah chunk per sumbu; WORLD_SIZE harus kelipatan bulat CHUNK_SIZE. */
export const WORLD_CHUNKS = 8;

export function inWorldXZ(x: number, z: number): boolean {
  return x >= 0 && x < WORLD_SIZE && z >= 0 && z < WORLD_SIZE;
}

export function inWorldY(y: number): boolean {
  return y >= 0 && y < WORLD_HEIGHT;
}

/** Chunk (cx, cz) masih di dalam dunia? */
export function inWorldChunk(cx: number, cz: number): boolean {
  return cx >= 0 && cx < WORLD_CHUNKS && cz >= 0 && cz < WORLD_CHUNKS;
}

/** Titik tengah dunia, dipakai spawn default. */
export const WORLD_CENTER = WORLD_SIZE / 2;
