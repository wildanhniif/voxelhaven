import { describe, expect, it } from 'vitest';
import {
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  DEFAULT_TERRAIN,
  flatIndex,
  generateChunk,
  heightAt,
  topSolidY,
  type TerrainConfig,
} from '../../src/world/terrain';

describe('terrain', () => {
  it('deterministik: seed sama menghasilkan chunk identik', () => {
    const a = generateChunk(2, -3, DEFAULT_TERRAIN);
    const b = generateChunk(2, -3, DEFAULT_TERRAIN);
    expect(a.data).toEqual(b.data);

    const other: TerrainConfig = { ...DEFAULT_TERRAIN, seed: 999 };
    const c = generateChunk(2, -3, other);
    expect(c.data).not.toEqual(a.data);
  });

  it('tinggi masuk range 1..CHUNK_HEIGHT-1 di banyak sampel', () => {
    for (let x = -100; x < 100; x += 7) {
      for (let z = -100; z < 100; z += 7) {
        const h = heightAt(x, z, DEFAULT_TERRAIN);
        expect(h).toBeGreaterThanOrEqual(1);
        expect(h).toBeLessThanOrEqual(CHUNK_HEIGHT - 1);
      }
    }
  });

  it('generateChunk sesuai koordinat: topSolid == heightAt dan layer benar', () => {
    const chunk = generateChunk(-1, 4, DEFAULT_TERRAIN);
    for (const [lx, lz] of [
      [0, 0],
      [15, 20],
      [31, 8],
    ] as const) {
      const wx = -1 * CHUNK_SIZE + lx;
      const wz = 4 * CHUNK_SIZE + lz;
      const expected = heightAt(wx, wz, DEFAULT_TERRAIN);
      expect(topSolidY(chunk, lx, lz)).toBe(expected);
      // Grass di atas, stone paling bawah.
      expect(chunk.data[flatIndex(lx, expected, lz, CHUNK_SIZE)]).toBe(1);
      expect(chunk.data[flatIndex(lx, 0, lz, CHUNK_SIZE)]).toBe(3);
      // Di atas permukaan harus kosong.
      expect(chunk.data[flatIndex(lx, expected + 1, lz, CHUNK_SIZE)]).toBe(0);
    }
  });

  it('chunk berbeda koordinat menghasilkan konten beda', () => {
    const a = generateChunk(0, 0, DEFAULT_TERRAIN);
    const b = generateChunk(5, -7, DEFAULT_TERRAIN);
    expect(a.data).not.toEqual(b.data);
  });
});
