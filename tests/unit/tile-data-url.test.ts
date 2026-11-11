import { afterEach, describe, expect, it, vi } from 'vitest';
import { ATLAS_TILES } from '../../src/world/texture-atlas';

/** Muat ulang modul supaya cache tileDataUrl bersih antar test (module boundary). */
async function freshModule(draws: { sx: number; sy: number }[]): Promise<void> {
  vi.resetModules();
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: '',
        fillRect: () => undefined,
        drawImage: (
          _img: unknown,
          sx: number,
          sy: number,
          ...rest: number[]
        ) => {
          // Hanya catat panggilan crop (8 argumen), bukan blit atlas penuh (3 argumen).
          if (rest.length >= 6) draws.push({ sx, sy });
        },
      }),
      toDataURL: () => 'data:image/png;base64,AAA',
    }),
  });
  await import('../../src/world/texture-atlas');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tileDataUrl', () => {
  it('crop tile dari posisi grid atlas yang benar (grass-side = kolom 1 baris 0)', async () => {
    const draws: { sx: number; sy: number }[] = [];
    await freshModule(draws);
    const { tileDataUrl } = await import('../../src/world/texture-atlas');
    const url = tileDataUrl(ATLAS_TILES.grassSide);
    expect(url).toBe('data:image/png;base64,AAA');
    expect(draws).toEqual([{ sx: 16, sy: 0 }]);
  });

  it('crop dirt = kolom 0 baris 1, stone = kolom 1 baris 1', async () => {
    const draws: { sx: number; sy: number }[] = [];
    await freshModule(draws);
    const { tileDataUrl } = await import('../../src/world/texture-atlas');
    tileDataUrl(ATLAS_TILES.dirt);
    tileDataUrl(ATLAS_TILES.stone);
    expect(draws).toEqual([
      { sx: 0, sy: 16 },
      { sx: 16, sy: 16 },
    ]);
  });

  it('cache: tile yang sama tidak digambar ulang', async () => {
    const draws: { sx: number; sy: number }[] = [];
    await freshModule(draws);
    const { tileDataUrl } = await import('../../src/world/texture-atlas');
    tileDataUrl(ATLAS_TILES.dirt);
    tileDataUrl(ATLAS_TILES.dirt);
    expect(draws).toHaveLength(1);
  });
});
