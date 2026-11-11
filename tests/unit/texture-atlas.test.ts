import { beforeEach, describe, expect, it, vi } from 'vitest';
// Static import OK: mock canvas dipasang dulu via stubGlobal di beforeEach,
// createTextureAtlas membaca document saat dipanggil, bukan saat modul dimuat.
import { NearestFilter } from 'three';
import {
  ATLAS_TILES,
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

  it('membuat canvas 32x32 (atlas 2x2 tile 16x16) dengan NearestFilter', () => {
    const tex = createTextureAtlas();
    const image = tex.image as CanvasImage;
    expect(image.width).toBe(32);
    expect(image.height).toBe(32);
    expect(tex.magFilter).toBe(NearestFilter);
    expect(tex.minFilter).toBe(NearestFilter);
  });

  it('menggambar 4x16x16 piksel (satu fillRect per piksel tile)', () => {
    const tex = createTextureAtlas();
    const image = tex.image as { getContext: () => { fillRect: ReturnType<typeof vi.fn> } };
    // 4 tile x 16x16 piksel dasar + detail ekstra (grass band, bercak dirt/stone).
    expect(image.getContext().fillRect.mock.calls.length).toBeGreaterThanOrEqual(4 * 16 * 16);
  });

  it('tileUv grass-top (0) = kuadran kiri-atas, grass-side (1) = kanan-atas', () => {
    const top = tileUv(ATLAS_TILES.grassTop);
    const side = tileUv(ATLAS_TILES.grassSide);
    expect(top.u0).toBeGreaterThan(0);
    expect(top.u1).toBeLessThan(0.5);
    expect(side.u0).toBeGreaterThan(0.5);
    expect(side.u1).toBeLessThan(1);
  });

  it('tileUv memberi padding half-texel (anti bleeding)', () => {
    for (const t of Object.values(ATLAS_TILES)) {
      const uv = tileUv(t);
      expect(uv.u1 - uv.u0).toBeLessThan(0.5);
      expect(uv.u1 - uv.u0).toBeGreaterThan(0.4);
      expect(uv.v1 - uv.v0).toBeLessThan(0.5);
      expect(uv.v1 - uv.v0).toBeGreaterThan(0.4);
    }
  });
});
