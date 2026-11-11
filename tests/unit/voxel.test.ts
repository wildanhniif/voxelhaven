import { describe, expect, it } from 'vitest';
import { flatIndex, getBlock, isSolid, setBlock, type VoxelWorld } from '../../src/world/voxel';

function emptyWorld(size = 4): VoxelWorld {
  return { data: new Uint8Array(size ** 3), size };
}

describe('voxel get/set', () => {
  it('setBlock lalu getBlock mengembalikan nilai yang sama', () => {
    const world = emptyWorld();
    expect(setBlock([1, 2, 3], 2, world)).toBe(true);
    expect(getBlock([1, 2, 3], world)).toBe(2);
    expect(getBlock([1, 2, 3], world)).not.toBe(0);
  });

  it('setBlock menulis di indeks flat yang benar', () => {
    const world = emptyWorld();
    setBlock([2, 1, 3], 1, world);
    expect(world.data[flatIndex(2, 1, 3, 4)]).toBe(1);
  });

  it('di luar batas: getBlock 0, setBlock false', () => {
    const world = emptyWorld();
    expect(getBlock([-1, 0, 0], world)).toBe(0);
    expect(getBlock([4, 0, 0], world)).toBe(0);
    expect(getBlock([0, 4, 0], world)).toBe(0);
    expect(getBlock([0, 0, 4], world)).toBe(0);
    expect(setBlock([-1, 0, 0], 1, world)).toBe(false);
    expect(setBlock([4, 0, 0], 1, world)).toBe(false);
  });

  it('isSolid mengikuti isi blok', () => {
    const world = emptyWorld();
    expect(isSolid([0, 0, 0], world)).toBe(false);
    setBlock([0, 0, 0], 3, world);
    expect(isSolid([0, 0, 0], world)).toBe(true);
  });
});
