import { describe, expect, it } from 'vitest';
import { raycastVoxel } from '../../src/player/raycast';
import type { VoxelWorld } from '../../src/world/voxel';

const SIZE = 32;

function makeWorld(solid: (x: number, y: number, z: number) => boolean): VoxelWorld {
  const world: VoxelWorld = { data: new Uint8Array(SIZE ** 3), size: SIZE };
  for (let y = 0; y < SIZE; y++) {
    for (let z = 0; z < SIZE; z++) {
      for (let x = 0; x < SIZE; x++) {
        if (solid(x, y, z)) world.data[y * SIZE * SIZE + z * SIZE + x] = 1;
      }
    }
  }
  return world;
}

describe('raycastVoxel (DDA)', () => {
  it('ray ke lantai: kena blok di bawah, adjacent tepat di atasnya', () => {
    const world = makeWorld((_x, y, _z) => y === 0);
    const hit = raycastVoxel([16.5, 4, 16.5], [0, -1, 0], 16, world);
    expect(hit).not.toBeNull();
    expect(hit!.block).toEqual([16, 0, 16]);
    expect(hit!.adjacent).toEqual([16, 1, 16]);
  });

  it('ray meleset dari semua blok solid: null', () => {
    const world = makeWorld((x, _y, _z) => x === 3 && _y > 0 && _y < 3);
    const hit = raycastVoxel([16, 2, 16], [0, 0, 1], 20, world);
    expect(hit).toBeNull();
  });

  it('ray miring menembus beberapa kolom sebelum kena dinding jauh', () => {
    // Dinding di x=10.
    const world = makeWorld((x, y) => y === 0 || (x === 10 && y > 0 && y < 6));
    const hit = raycastVoxel([2, 3, 16], [1, 0, 0], 20, world);
    expect(hit).not.toBeNull();
    expect(hit!.block).toEqual([10, 3, 16]);
    expect(hit!.adjacent).toEqual([9, 3, 16]);
  });

  it('ray dari dalam blok solid: kena sel asal, bukan step pertama', () => {
    const world = makeWorld((_x, y) => y === 0);
    const hit = raycastVoxel([16, 0.5, 16], [0, -1, 0], 8, world);
    expect(hit).not.toBeNull();
    expect(hit!.block).toEqual([16, 0, 16]);
  });

  it('mematuhi maxDistance', () => {
    const world = makeWorld((x, y) => y === 0 || (x === 10 && y > 0 && y < 6));
    const hit = raycastVoxel([2, 3, 16], [1, 0, 0], 4, world);
    expect(hit).toBeNull();
  });

  it('ray dari luar grid, menjauh: null tanpa crash', () => {
    const world = makeWorld(() => true);
    const hit = raycastVoxel([40, 0.5, 0.5], [1, 0, 0], 8, world);
    expect(hit).toBeNull();
  });
});
