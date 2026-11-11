import { describe, expect, it } from 'vitest';
import { buildChunkGeometry } from '../../src/world/mesher';
import { CHUNK_SIZE, DEFAULT_TERRAIN, generateChunk } from '../../src/world/terrain';
import type { Chunk } from '../../src/world/terrain';
import type { VoxelType } from '../../src/world/voxel';
import { flatIndex, VOXEL_AIR } from '../../src/world/voxel';

/** Ambil blok paling atas kolom terrain (y tertinggi yang solid). */
function surfaceY(chunk: Chunk, lx: number, lz: number): number {
  for (let y = CHUNK_SIZE - 1; y >= 0; y--) {
    if (chunk.data[flatIndex(lx, y, lz, CHUNK_SIZE)] !== VOXEL_AIR) return y;
  }
  return -1;
}

describe('mesher culling tepi pakai data chunk tetangga', () => {
  it('galian di perbatasan chunk tetangga tidak membuat face tetangga ter-cull', () => {
    const a = generateChunk(0, 0, DEFAULT_TERRAIN);
    const topY = surfaceY(a, CHUNK_SIZE - 1, 0);
    expect(topY).toBeGreaterThan(1);

    // "getLoaded" klaim: kolom tetangga (di chunk b, x lokal 0) sudah digali
    // sampai kosong, meski noise heightAt masih bilang solid sampai topY.
    const getLoaded = (x: number, y: number, z: number): VoxelType | null => {
      // Blok tepi chunk tetangga: kolom dunia x = CHUNK_SIZE (lokal x=0 chunk b).
      if (x === CHUNK_SIZE && z === 0) return VOXEL_AIR;
      // Semua posisi lain: asumsikan terrain penuh sampai surface.
      return y <= topY ? 1 : VOXEL_AIR;
    };

    // Face tepi x=CHUNK_SIZE-1 chunk a harus TETAP digenerate
    // karena chunk tetangga (loaded) bilang udara.
    const culled = buildChunkGeometry(a, DEFAULT_TERRAIN, getLoaded);
    const naive = buildChunkGeometry(a, DEFAULT_TERRAIN);
    expect(
      culled.getAttribute('position').count,
      'face tepi harus digenerate ulang (lebih banyak face)',
    ).toBeGreaterThan(naive.getAttribute('position').count);
  });

  it('chunk tetangga belum dimuat (null) fallback ke noise seperti sebelumnya', () => {
    const a = generateChunk(0, 0, DEFAULT_TERRAIN);
    const withNull = buildChunkGeometry(a, DEFAULT_TERRAIN, () => null);
    const without = buildChunkGeometry(a, DEFAULT_TERRAIN);
    expect(withNull.getAttribute('position').count).toBe(
      without.getAttribute('position').count,
    );
  });
});
