import { getBlock, setBlock, VOXEL_AIR, type VoxelType, type VoxelWorld } from './voxel';

export interface PlayerBounds {
  x: number;
  y: number;
  z: number;
}

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;

/** Apakah blok (bx,by,bz) overlap AABB player (posisi kaki px,py,pz)? */
export function overlapsPlayer(
  bx: number,
  by: number,
  bz: number,
  player: PlayerBounds,
): boolean {
  const halfW = PLAYER_WIDTH / 2;
  const px = player.x;
  const py = player.y;
  const pz = player.z;
  return (
    bx < px + halfW &&
    bx + 1 > px - halfW &&
    by < py + PLAYER_HEIGHT &&
    by + 1 > py &&
    bz < pz + halfW &&
    bz + 1 > pz - halfW
  );
}

/** Hancur blok di posisi pos; true kalau ada yang berubah. */
export function breakBlock(pos: readonly [number, number, number], world: VoxelWorld): boolean {
  if (getBlock(pos, world) === VOXEL_AIR) return false;
  return setBlock(pos, VOXEL_AIR, world);
}

/**
 * Taruh blok. Return false kalau:
 * - target di luar batas world
 * - target sudah solid
 * - target overlap AABB player
 */
export function placeBlock(
  pos: readonly [number, number, number],
  type: VoxelType,
  world: VoxelWorld,
  player?: PlayerBounds,
): boolean {
  const [x, y, z] = pos;
  if (type === VOXEL_AIR) return false;
  if (getBlock(pos, world) !== VOXEL_AIR) return false;
  if (player !== undefined && overlapsPlayer(x, y, z, player)) return false;
  return setBlock(pos, type, world);
}
