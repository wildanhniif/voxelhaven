import { describe, expect, it } from 'vitest';
import { buildChunkGeometry } from '../../src/world/mesher';
import { CHUNK_SIZE, generateChunk, type Chunk, type TerrainConfig } from '../../src/world/terrain';
import { flatIndex, type VoxelType } from '../../src/world/voxel';
import { ATLAS_TILES, tileUv } from '../../src/world/texture-atlas';

/** Chunk dummy berisi blok tunggal di (0,1,0). */
function singleBlockChunk(type: VoxelType): Chunk {
  const chunk = generateChunk(0, 0, { seed: 1, amplitude: 0, base: 0 } satisfies TerrainConfig);
  chunk.data.fill(0);
  chunk.data[flatIndex(0, 1, 0, CHUNK_SIZE)] = type;
  return chunk;
}

describe('mesher UV orientasi face samping', () => {
  it('vertex atas blok grass memakai v atas tile (band hijau di atas, bukan bawah)', () => {
    const geo = buildChunkGeometry(singleBlockChunk(1));
    const pos = geo.getAttribute('position');
    const norm = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');
    const tile = tileUv(ATLAS_TILES.grassSide);

    let checkedSides = 0;
    for (let i = 0; i < pos.count; i++) {
      const isSide = norm.getX(i) !== 0 || norm.getZ(i) !== 0;
      if (!isSide) continue;
      const py = pos.getY(i);
      // Vertex atas blok (y=1) harus sampling v atas tile, vertex bawah (y=0) v bawah.
      expect(uv.getY(i)).toBeCloseTo(py > 1.5 ? tile.v1 : tile.v0, 6);
      checkedSides++;
    }
    // Blok tunggal: 4 side face x 4 vertex = 16.
    expect(checkedSides).toBe(16);
  });
});
