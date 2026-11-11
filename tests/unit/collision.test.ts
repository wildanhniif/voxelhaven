import { describe, expect, it } from 'vitest';
import { createPlayerBody, resetIfFallenOut, updatePhysics, type PlayerBody } from '../../src/player/collision';
import { asBlockSource, type VoxelWorld } from '../../src/world/voxel';

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

function stepSeconds(body: PlayerBody, world: VoxelWorld, seconds: number): void {
  const src = asBlockSource(world);
  for (let i = 0; i < seconds * 60; i++) updatePhysics(body, 1 / 60, src);
}

describe('collision', () => {
  it('player jatuh karena gravitasi dan mendarat di atas blok', () => {
    const world = makeWorld((_x, y, _z) => y === 0);
    const body = createPlayerBody(16, 5, 16);
    stepSeconds(body, world, 3);
    expect(body.onGround).toBe(true);
    expect(body.y).toBeCloseTo(1, 5);
    expect(body.vy).toBe(0);
  });

  it('player tidak bisa menembus dinding dari arah +X', () => {
    // Dinding di x=3, tinggi penuh, di semua z.
    const world = makeWorld((x, y) => y === 0 || (x === 3 && y > 0 && y < 6));
    const body = createPlayerBody(2.2, 1, 16);
    body.vx = 5;
    stepSeconds(body, world, 2);
    // Muka dinding di x=3, half-width player 0.3 -> pusat maksimum 2.7.
    expect(body.x).toBeLessThanOrEqual(2.7 + 1e-9);
  });

  it('player tidak bisa menembus dinding dari arah -X', () => {
    const world = makeWorld((x, y) => y === 0 || (x === 10 && y > 0 && y < 6));
    const body = createPlayerBody(11.8, 1, 16);
    body.vx = -5;
    stepSeconds(body, world, 2);
    // Muka dinding di x=11, half-width 0.3 -> pusat minimum 11.3.
    expect(body.x).toBeGreaterThanOrEqual(11.3 - 1e-9);
  });

  it('player meluncur bebas di world kosong (tidak nyangkut)', () => {
    const world = makeWorld(() => false);
    const body = createPlayerBody(16, 3, 16);
    body.vx = 5;
    stepSeconds(body, world, 1);
    expect(body.x).toBeGreaterThan(16);
    expect(body.onGround).toBe(false);
  });

  it('resetIfFallenOut mengembalikan player ke spawn', () => {
    const body = createPlayerBody(2, 1, 2);
    body.y = -50;
    resetIfFallenOut(body, { x: 16, y: 4, z: 16 });
    expect(body.x).toBe(16);
    expect(body.y).toBe(4);
    expect(body.z).toBe(16);
    expect(body.vy).toBe(0);
  });
});
