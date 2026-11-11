import { describe, expect, it } from 'vitest';
import { buildChunkGeometry } from '../../src/world/mesher';
import { CHUNK_SIZE, generateChunk, type TerrainConfig } from '../../src/world/terrain';
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
    // Seed unik tanpa pohon di area pengujian supaya jumlah face deterministik.
    const CFG: TerrainConfig = { seed: 20260712, amplitude: 9, base: 12 };
    const a = generateChunk(0, 0, CFG);
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
    const culled = buildChunkGeometry(a, CFG, getLoaded);
    const naive = buildChunkGeometry(a, CFG);
    expect(
      culled.getAttribute('position').count,
      'face tepi harus digenerate ulang (lebih banyak face)',
    ).toBeGreaterThan(naive.getAttribute('position').count);
  });

  it('chunk tetangga belum dimuat (null) fallback ke noise seperti sebelumnya', () => {
    const a = generateChunk(0, 0, DEFAULT_NO_TREE_TERRAIN);
    const withNull = buildChunkGeometry(a, DEFAULT_NO_TREE_TERRAIN, () => null);
    const without = buildChunkGeometry(a, DEFAULT_NO_TREE_TERRAIN);
    expect(withNull.getAttribute('position').count).toBe(
      without.getAttribute('position').count,
    );
  });
});

const DEFAULT_NO_TREE_TERRAIN: TerrainConfig = { seed: 20260712, amplitude: 9, base: 12 };
