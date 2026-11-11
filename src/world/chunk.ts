import { flatIndex, type VoxelType, type VoxelWorld } from './voxel';

export const CHUNK_SIZE = 32;

/**
 * Chunk 32x32x32, flat: layer terbawah stone, tengah dirt, atas grass.
 */
export interface Chunk extends VoxelWorld {
  readonly size: number;
}

export function generateFlatChunk(size = CHUNK_SIZE): Chunk {
  const data = new Uint8Array(size * size * size);
  const heights: Record<number, VoxelType> = {};
  const top = 2;
  for (let y = 0; y <= top; y++) {
    // 2 = grass (paling atas), 1 = dirt, 0 = stone.
    heights[y] = y === top ? 1 : y === top - 1 ? 2 : 3;
  }
  for (let y = 0; y < size; y++) {
    const type = heights[y] ?? 0;
    if (type === 0) continue;
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        data[flatIndex(x, y, z, size)] = type;
      }
    }
  }
  return { data, size };
}
