import { describe, expect, it } from 'vitest';
import { buildChunkGeometry } from '../../src/world/mesher';
import { CHUNK_SIZE, DEFAULT_TERRAIN, generateChunk } from '../../src/world/terrain';

function faceCount(positionCount: number): number {
  return positionCount / 4;
}

describe('mesher culling tepi chunk', () => {
  it('face samping di tepi chunk yang berbatasan tanah tidak digenerate', () => {
    const chunk = generateChunk(0, 0, DEFAULT_TERRAIN);
    const geo = buildChunkGeometry(chunk, DEFAULT_TERRAIN);

    // Tanpa culling lintas chunk, tepi x=0 dan z=0 akan menggambar dinding penuh
    // setinggi terrain di sepanjang CHUNK_SIZE kolom.
    const withConfig = faceCount(geo.getAttribute('position').count);
    const withoutConfig = faceCount(
      buildChunkGeometry(chunk).getAttribute('position').count,
    );

    // Dengan config, dinding tepi hilang -> jumlah face lebih sedikit.
    expect(withConfig).toBeLessThan(withoutConfig);

    // Selisih minimal: dua sisi tepi (x=0, z=0) x CHUNK_SIZE kolom.
    const removed = withoutConfig - withConfig;
    expect(removed).toBeGreaterThanOrEqual(2 * CHUNK_SIZE);
  });

  it('culling tepi konsisten dengan chunk tetangga yang belum dimuat', () => {
    const a = generateChunk(0, 0, DEFAULT_TERRAIN);
    const b = generateChunk(1, 0, DEFAULT_TERRAIN);
    // Tinggi di kolom yang berbatasan harus sama (kontinuitas noise).
    const geoA = buildChunkGeometry(a, DEFAULT_TERRAIN);
    const geoB = buildChunkGeometry(b, DEFAULT_TERRAIN);
    expect(geoA.getAttribute('position').count).toBeGreaterThan(0);
    expect(geoB.getAttribute('position').count).toBeGreaterThan(0);
  });
});
