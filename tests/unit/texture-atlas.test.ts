import { beforeEach, describe, expect, it, vi } from 'vitest';
// Static import OK: mock canvas dipasang dulu via stubGlobal di beforeEach,
// createTextureAtlas membaca document saat dipanggil, bukan saat modul dimuat.
import { NearestFilter } from 'three';
import {
  ATLAS_COLS,
  ATLAS_ROWS,
  ATLAS_TILES,
  TILE_PX,
  createTextureAtlas,
  tileUv,
} from '../../src/world/texture-atlas';

type CanvasImage = { width: number; height: number };

describe('createTextureAtlas', () => {
  beforeEach(() => {
    const ctx = {
      fillStyle: '',
      fillRect: vi.fn(),
    };
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        expect(tag).toBe('canvas');
        return { width: 0, height: 0, getContext: () => ctx };
      },
    });
  });

  it('membuat canvas 48x48 (atlas 3x3 tile 16x16) dengan NearestFilter', () => {
    const tex = createTextureAtlas();
    const image = tex.image as CanvasImage;
    expect(image.width).toBe(TILE_PX * ATLAS_COLS);
    expect(image.height).toBe(TILE_PX * ATLAS_ROWS);
    expect(ATLAS_COLS).toBe(3);
    expect(ATLAS_ROWS).toBe(3);
    expect(tex.magFilter).toBe(NearestFilter);
    expect(tex.minFilter).toBe(NearestFilter);
  });

  it('menggambar minimal 7x16x16 piksel (satu fillRect per piksel tile)', () => {
    const tex = createTextureAtlas();
    const image = tex.image as { getContext: () => { fillRect: ReturnType<typeof vi.fn> } };
    // 7 tile (grass x2, dirt, stone, wood x2, leaves) x 16x16 piksel dasar + detail.
    expect(image.getContext().fillRect.mock.calls.length).toBeGreaterThanOrEqual(7 * 16 * 16);
  });

  it('tileUv grass-top (0) = sel kiri-atas, grass-side (1) di kanannya', () => {
    const top = tileUv(ATLAS_TILES.grassTop);
    const side = tileUv(ATLAS_TILES.grassSide);
    const cell = 1 / ATLAS_COLS;
    expect(top.u0).toBeGreaterThan(0);
    expect(top.u1).toBeLessThan(cell);
    expect(side.u0).toBeGreaterThan(cell);
    expect(side.u1).toBeLessThan(2 * cell);
    // Keduanya di baris atas: v harus sama.
    expect(top.v0).toBeCloseTo(side.v0, 6);
  });

  it('tileUv memberi padding half-texel (anti bleeding) untuk semua tile', () => {
    for (const t of Object.values(ATLAS_TILES)) {
      const uv = tileUv(t);
      const du = 1 / ATLAS_COLS;
      const dv = 1 / ATLAS_ROWS;
      expect(uv.u1 - uv.u0).toBeLessThan(du);
      expect(uv.u1 - uv.u0).toBeGreaterThan(du - 2 * (0.5 / (TILE_PX * ATLAS_COLS)) - 1e-9);
      expect(uv.v1 - uv.v0).toBeLessThan(dv);
      expect(uv.v1 - uv.v0).toBeGreaterThan(dv - 2 * (0.5 / (TILE_PX * ATLAS_ROWS)) - 1e-9);
    }
  });

  it('tile baru (woodTop, woodSide, leaves) punya sel unik dan UV di dalam [0,1]', () => {
    const seen = new Set<string>();
    for (const t of [ATLAS_TILES.woodTop, ATLAS_TILES.woodSide, ATLAS_TILES.leaves]) {
      const uv = tileUv(t);
      expect(uv.u0).toBeGreaterThanOrEqual(0);
      expect(uv.v0).toBeGreaterThanOrEqual(0);
      expect(uv.u1).toBeLessThanOrEqual(1);
      expect(uv.v1).toBeLessThanOrEqual(1);
      seen.add(`${uv.u0.toFixed(6)},${uv.v0.toFixed(6)}`);
    }
    expect(seen.size).toBe(3);
  });
});
