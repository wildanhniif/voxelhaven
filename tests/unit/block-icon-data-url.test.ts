import { afterEach, describe, expect, it, vi } from 'vitest';
import { ATLAS_TILES } from '../../src/world/texture-atlas';

/** Mock canvas 2D context; catat crop drawImage (8 argumen) per call. */
async function freshModule(draws: { sx: number; sy: number }[]): Promise<void> {
  vi.resetModules();
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        imageSmoothingEnabled: false,
        fillStyle: '',
        setTransform: () => undefined,
        fillRect: () => undefined,
        drawImage: (
          _img: unknown,
          sx: number,
          sy: number,
          ...rest: number[]
        ) => {
          if (rest.length >= 6) draws.push({ sx, sy });
        },
      }),
      toDataURL: () => 'data:image/png;base64,BBB',
    }),
  });
  await import('../../src/world/texture-atlas');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('blockIconDataUrl', () => {
  it('menggambar 3 face: top sekali + side dua kali (grass: grassTop/grassSide)', async () => {
    const draws: { sx: number; sy: number }[] = [];
    await freshModule(draws);
    const { blockIconDataUrl } = await import('../../src/world/texture-atlas');
    const url = blockIconDataUrl(ATLAS_TILES.grassTop, ATLAS_TILES.grassSide);
    expect(url).toBe('data:image/png;base64,BBB');
    expect(draws).toEqual([
      { sx: 0, sy: 0 },
      { sx: 16, sy: 0 },
      { sx: 16, sy: 0 },
    ]);
  });

  it('cache: pasangan tile yang sama tidak digambar ulang', async () => {
    const draws: { sx: number; sy: number }[] = [];
    await freshModule(draws);
    const { blockIconDataUrl } = await import('../../src/world/texture-atlas');
    blockIconDataUrl(ATLAS_TILES.dirt, ATLAS_TILES.dirt);
    blockIconDataUrl(ATLAS_TILES.dirt, ATLAS_TILES.dirt);
    expect(draws).toHaveLength(3);
  });

  it('pasangan tile beda = entry cache terpisah', async () => {
    const draws: { sx: number; sy: number }[] = [];
    await freshModule(draws);
    const { blockIconDataUrl } = await import('../../src/world/texture-atlas');
    blockIconDataUrl(ATLAS_TILES.dirt, ATLAS_TILES.dirt);
    blockIconDataUrl(ATLAS_TILES.stone, ATLAS_TILES.stone);
    expect(draws).toHaveLength(6);
  });
});
