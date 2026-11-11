import { describe, expect, it } from 'vitest';
import {
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  DEFAULT_TERRAIN,
  flatIndex,
  generateChunk,
  getTreeHeight,
  heightAt,
  type TerrainConfig,
} from '../../src/world/terrain';
const WOOD = 4;
const LEAVES = 5;
const GRASS = 1;

/** Cari kolom dunia (dalam satu chunk) yang punya batang pohon. */
function findTreeColumn(
  cx: number,
  cz: number,
  config: TerrainConfig,
): { wx: number; wz: number } | null {
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const wx = cx * CHUNK_SIZE + x;
      const wz = cz * CHUNK_SIZE + z;
      if (getTreeHeight(wx, wz, config) !== null) return { wx, wz };
    }
  }
  return null;
}

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

  it('generateChunk: permukaan terrain sesuai heightAt, layer stone->dirt->grass', () => {
    const chunk = generateChunk(-1, 4, DEFAULT_TERRAIN);
    for (const [lx, lz] of [
      [0, 0],
      [15, 20],
      [31, 8],
    ] as const) {
      const wx = -1 * CHUNK_SIZE + lx;
      const wz = 4 * CHUNK_SIZE + lz;
      const expected = heightAt(wx, wz, DEFAULT_TERRAIN);
      const hasTree = getTreeHeight(wx, wz, DEFAULT_TERRAIN) !== null;

      // Blok permukaan adalah grass — kecuali kolom itu batang pohon (wood).
      const surface = chunk.data[flatIndex(lx, expected, lz, CHUNK_SIZE)]!;
      expect(surface).toBe(hasTree ? WOOD : GRASS);
      // Layer paling bawah (y=0) selalu stone.
      expect(chunk.data[flatIndex(lx, 0, lz, CHUNK_SIZE)]).toBe(3);
      // Tanpa pohon di kolom ini: tepat di atas permukaan kosong atau daun
      // dari pohon tetangga (radius 1), tidak pernah wood.
      if (!hasTree) {
        const above = chunk.data[flatIndex(lx, expected + 1, lz, CHUNK_SIZE)]!;
        expect([0, LEAVES]).toContain(above);
      }
    }
  });

  it('chunk berbeda koordinat menghasilkan konten beda', () => {
    const a = generateChunk(0, 0, DEFAULT_TERRAIN);
    const b = generateChunk(5, -7, DEFAULT_TERRAIN);
    expect(a.data).not.toEqual(b.data);
  });
});

describe('pohon prosedural', () => {
  it('deterministik: seed sama -> getTreeHeight identik, seed beda -> pola beda', () => {
    let sameCount = 0;
    let diffCount = 0;
    const other: TerrainConfig = { ...DEFAULT_TERRAIN, seed: DEFAULT_TERRAIN.seed + 1 };
    for (let x = -80; x < 80; x++) {
      for (let z = -80; z < 80; z += 3) {
        const a1 = getTreeHeight(x, z, DEFAULT_TERRAIN);
        const a2 = getTreeHeight(x, z, DEFAULT_TERRAIN);
        expect(a1).toBe(a2);
        if (getTreeHeight(x, z, other) !== a1) diffCount++;
        if (a1 !== null) sameCount++;
      }
    }
    expect(sameCount).toBeGreaterThan(0);
    expect(diffCount).toBeGreaterThan(0);
  });

  it('pohon tidak melayang: batang menempel ke permukaan grass + tajuk di atasnya', () => {
    // Cari chunk yang pasti punya pohon, lalu verifikasi strukturnya di dunia.
    const config = DEFAULT_TERRAIN;
    let checked = 0;
    for (let cx = -4; cx <= 4 && checked < 5; cx++) {
      for (let cz = -4; cz <= 4 && checked < 5; cz++) {
        const found = findTreeColumn(cx, cz, config);
        if (found === null) continue;
        const { wx, wz } = found;
        const th = getTreeHeight(wx, wz, config);
        expect(th).not.toBeNull();
        const base = heightAt(wx, wz, config);
        const chunk = generateChunk(cx, cz, config);
        const lx = wx - cx * CHUNK_SIZE;
        const lz = wz - cz * CHUNK_SIZE;

        // Batang: dari base+1 sampai base+th semuanya wood (kolom ini).
        for (let ty = 1; ty <= (th as number); ty++) {
          const idx = flatIndex(lx, base + ty, lz, CHUNK_SIZE);
          if (base + ty < CHUNK_HEIGHT) {
            expect(chunk.data[idx], `wood y=${base + ty}`).toBe(WOOD);
          }
        }
        // Batang tidak boleh mulai di atas permukaan (melayang).
        expect(chunk.data[flatIndex(lx, base, lz, CHUNK_SIZE)]).not.toBe(0);
        // Ada daun di sekitar puncak batang (tajuk tidak kosong).
        let leafCount = 0;
        for (let dy = 0; dy < 3; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              const y = base + (th as number) + dy;
              const x2 = lx + dx;
              const z2 = lz + dz;
              if (y >= CHUNK_HEIGHT || x2 < 0 || x2 >= CHUNK_SIZE || z2 < 0 || z2 >= CHUNK_SIZE) {
                continue;
              }
              if (chunk.data[flatIndex(x2, y, z2, CHUNK_SIZE)] === LEAVES) leafCount++;
            }
          }
        }
        expect(leafCount).toBeGreaterThan(0);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('daun lintas chunk konsisten: pohon di tepi chunk muncul utuh dari kedua chunk', () => {
    // Cari kolom pohon yang batangnya dekat tepi chunk (x lokal <= 1) sehingga
    // tajuknya menyeberang ke chunk sebelah.
    const config: TerrainConfig = { seed: 20260101, amplitude: 9, base: 12 };
    let found: { cx: number; cz: number; lx: number; lz: number } | null = null;
    for (let cx = -3; cx <= 3 && found === null; cx++) {
      for (let cz = -3; cz <= 3 && found === null; cz++) {
        for (let x = 0; x < CHUNK_SIZE && found === null; x++) {
          for (let z = 0; z < CHUNK_SIZE && found === null; z++) {
            if (x !== 0 && x !== CHUNK_SIZE - 1) continue;
            const wx = cx * CHUNK_SIZE + x;
            const wz = cz * CHUNK_SIZE + z;
            if (getTreeHeight(wx, wz, config) === null) continue;
            // Pastikan tajuk benar-benar menyeberang (butuh radius 1 blok).
            found = { cx, cz, lx: x, lz: z };
          }
        }
      }
    }
    expect(found).not.toBeNull();
    const f = found as { cx: number; cz: number; lx: number; lz: number };
    const chunk = generateChunk(f.cx, f.cz, config);
    const base = heightAt(f.cx * CHUNK_SIZE + f.lx, f.cz * CHUNK_SIZE + f.lz, config);
    const th = getTreeHeight(f.cx * CHUNK_SIZE + f.lx, f.cz * CHUNK_SIZE + f.lz, config) as number;

    // Kolom tepi luar (x=-1 di dunia = chunk sebelah) yang seharusnya berisi daun.
    // Karena batang di x lokal 0, daun menyeberang ke x lokal -1 (chunk tetangga).
    const neighborCx = f.lx === 0 ? f.cx - 1 : f.cx + 1;
    const neighbor = generateChunk(neighborCx, f.cz, config);
    const neighborLx = f.lx === 0 ? CHUNK_SIZE - 1 : 0;
    let neighborLeaves = 0;
    for (let dy = 0; dy < 3; dy++) {
      const y = base + th + dy;
      if (y >= CHUNK_HEIGHT) continue;
      if (neighbor.data[flatIndex(neighborLx, y, f.lz, CHUNK_SIZE)] === LEAVES) {
        neighborLeaves++;
      }
    }
    // Chunk tetangga harus ikut menggambar daun pohon yang batangnya di chunk ini.
    expect(neighborLeaves).toBeGreaterThan(0);
    void chunk;
  });
});
