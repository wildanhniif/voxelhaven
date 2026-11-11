import { describe, expect, it } from 'vitest';
import { tppCameraDistance, TPP_DISTANCE } from '../../src/engine/camera-fps';
import type { BlockSource } from '../../src/world/voxel';

/** World mock: solid hanya di koordinat yang terdaftar. */
function worldOf(solid: ReadonlySet<string>): BlockSource {
  return {
    getBlock: (pos) => (solid.has(pos.join(',')) ? 1 : 0),
    setBlock: () => false,
  };
}

describe('tppCameraDistance', () => {
  it('udara kosong: jarak penuh (4 blok)', () => {
    expect(tppCameraDistance([0.5, 10.5, 0.5], [1, 0, 0], worldOf(new Set()))).toBe(TPP_DISTANCE);
  });

  it('tembok di belakang: kamera berhenti sebelum margin', () => {
    // Eye (0.5, 10.5, 0.5), mundur ke +X. Blok x=2 solid pertama kena di d≈1.5.
    const world = worldOf(new Set(['2,10,0', '2,11,0', '2,10,1']));
    const d = tppCameraDistance([0.5, 10.5, 0.5], [1, 0, 0], world);
    expect(d).toBeGreaterThan(1.2);
    expect(d).toBeLessThanOrEqual(1.5);
  });

  it('langit-langit di atas: berhenti lebih dekat', () => {
    // Eye y=10.5, mundur ke +Y. Blok y=11 kena di d≈0.5.
    const world = worldOf(new Set(['0,11,0']));
    const d = tppCameraDistance([0.5, 10.5, 0.5], [0, 1, 0], world);
    expect(d).toBeGreaterThan(0.2);
    expect(d).toBeLessThanOrEqual(0.5);
  });

  it('blok tepat di belakang mata: tidak pernah negatif', () => {
    const world = worldOf(new Set(['0,10,0']));
    const d = tppCameraDistance([0.5, 10.5, 0.5], [-1, 0, 0], world);
    expect(d).toBeGreaterThanOrEqual(0);
  });
});
