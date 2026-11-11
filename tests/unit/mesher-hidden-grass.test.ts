import { describe, expect, it } from 'vitest';
import { buildChunkGeometry } from '../../src/world/mesher';
import { CHUNK_SIZE, generateChunk, type Chunk, type TerrainConfig } from '../../src/world/terrain';
import { flatIndex, type VoxelType } from '../../src/world/voxel';
import { ATLAS_TILES, tileUv } from '../../src/world/texture-atlas';

const CFG = { seed: 1, amplitude: 0, base: 0 } as TerrainConfig;
// Di tengah chunk supaya face samping tidak kena culling tepi (noise).
const X = 16;
const Z = 16;

function chunkWith(coverType: VoxelType | null): Chunk {
  const chunk = generateChunk(0, 0, CFG);
  chunk.data.fill(0);
  chunk.data[flatIndex(X, 1, Z, CHUNK_SIZE)] = 1;
  if (coverType !== null) chunk.data[flatIndex(X, 2, Z, CHUNK_SIZE)] = coverType;
  return chunk;
}

/** Semua face samping blok grass (menempati y=1..2), sebagai grup 4 vertex. */
function grassSideFaces(geo: ReturnType<typeof buildChunkGeometry>): number[][] {
  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');
  const faces: number[][] = [];
  for (let i = 0; i < pos.count; i += 4) {
    const minY = Math.min(pos.getY(i), pos.getY(i + 1), pos.getY(i + 2), pos.getY(i + 3));
    const maxY = Math.max(pos.getY(i), pos.getY(i + 1), pos.getY(i + 2), pos.getY(i + 3));
    if (minY !== 1 || maxY !== 2) continue; // hanya blok grass
    if (norm.getX(i) === 0 && norm.getZ(i) === 0) continue; // hanya face samping
    faces.push([i, i + 1, i + 2, i + 3]);
  }
  return faces;
}

describe('mesher grass tertutup', () => {
  it('grass yang tertutup blok di atasnya: face samping pakai tile dirt (grass botak)', () => {
    const geo = buildChunkGeometry(chunkWith(3), CFG);
    const faces = grassSideFaces(geo);
    expect(faces).toHaveLength(4);
    const uv = geo.getAttribute('uv');
    const dirt = tileUv(ATLAS_TILES.dirt);
    for (const idx of faces) {
      const [i0, i1, i2, i3] = idx as [number, number, number, number];
      for (const i of [i0, i1, i2, i3]) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        // Cek titik sudut UV berada di dalam tile dirt (u DAN v), bukan cuma v.
        const insideDirt =
          u >= dirt.u0 - 1e-6 && u <= dirt.u1 + 1e-6 && v >= dirt.v0 - 1e-6 && v <= dirt.v1 + 1e-6;
        expect(insideDirt).toBe(true);
      }
    }
  });

  it('grass tanpa penutup: face samping tetap pakai tile grassSide', () => {
    const geo = buildChunkGeometry(chunkWith(null), CFG);
    const faces = grassSideFaces(geo);
    expect(faces).toHaveLength(4);
    const uv = geo.getAttribute('uv');
    const side = tileUv(ATLAS_TILES.grassSide);
    for (const face of faces) {
      for (const i of face) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        const insideSide =
          u >= side.u0 - 1e-6 && u <= side.u1 + 1e-6 && v >= side.v0 - 1e-6 && v <= side.v1 + 1e-6;
        expect(insideSide).toBe(true);
      }
    }
  });
});
