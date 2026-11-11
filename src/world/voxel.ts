export type VoxelType = 0 | 1 | 2 | 3;

/** 0=kosong, 1=grass, 2=dirt, 3=stone */
export const VOXEL_AIR: VoxelType = 0;

export interface VoxelWorld {
  readonly data: Uint8Array;
  readonly size: number;
}

/** Indeks flat: urutan X tercepat, lalu Z, lalu Y. */
export function flatIndex(x: number, y: number, z: number, size: number): number {
  return y * size * size + z * size + x;
}

export function inBounds(x: number, y: number, z: number, size: number): boolean {
  return x >= 0 && x < size && y >= 0 && y < size && z >= 0 && z < size;
}

export function getBlock(pos: readonly [number, number, number], world: VoxelWorld): VoxelType {
  const [x, y, z] = pos;
  if (!inBounds(x, y, z, world.size)) return VOXEL_AIR;
  return world.data[flatIndex(x, y, z, world.size)] as VoxelType;
}

/** Return false kalau di luar batas (set diabaikan). */
export function setBlock(
  pos: readonly [number, number, number],
  type: VoxelType,
  world: VoxelWorld,
): boolean {
  const [x, y, z] = pos;
  if (!inBounds(x, y, z, world.size)) return false;
  world.data[flatIndex(x, y, z, world.size)] = type;
  return true;
}

export function isSolid(pos: readonly [number, number, number], world: VoxelWorld): boolean {
  return getBlock(pos, world) !== VOXEL_AIR;
}
