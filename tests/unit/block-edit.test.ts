import { describe, expect, it } from 'vitest';
import { breakBlock, placeBlock } from '../../src/world/block-edit';
import { asBlockSource, getBlock, type VoxelWorld } from '../../src/world/voxel';

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

describe('block-edit', () => {
  it('breakBlock menghapus blok solid', () => {
    const world = makeWorld((_x, y) => y === 0);
    expect(breakBlock([16, 0, 16], asBlockSource(world))).toBe(true);
    expect(getBlock([16, 0, 16], world)).toBe(0);
  });

  it('breakBlock pada blok kosong: false, tidak ada perubahan', () => {
    const world = makeWorld((_x, y) => y === 0);
    expect(breakBlock([16, 5, 16], asBlockSource(world))).toBe(false);
  });

  it('placeBlock menaruh grass di sel kosong', () => {
    const world = makeWorld((_x, y) => y === 0);
    expect(placeBlock([16, 5, 16], 1, asBlockSource(world))).toBe(true);
    expect(getBlock([16, 5, 16], world)).toBe(1);
  });

  it('placeBlock di sel solid: false', () => {
    const world = makeWorld((_x, y) => y === 0);
    expect(placeBlock([16, 0, 16], 1, asBlockSource(world))).toBe(false);
  });

  it('placeBlock di luar batas world: false', () => {
    const world = makeWorld((_x, y) => y === 0);
    expect(placeBlock([-1, 5, 16], 1, asBlockSource(world))).toBe(false);
    expect(placeBlock([32, 5, 16], 1, asBlockSource(world))).toBe(false);
  });

  it('placeBlock overlap AABB player: false', () => {
    const world = makeWorld((_x, y) => y === 0);
    const player = { x: 16.5, y: 1, z: 16.5 };
    expect(placeBlock([16, 1, 16], 1, asBlockSource(world), player)).toBe(false);
    expect(placeBlock([10, 1, 10], 1, asBlockSource(world), player)).toBe(true);
  });

});
