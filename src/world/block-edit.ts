import { VOXEL_AIR, type BlockPos, type BlockSource, type VoxelType } from './voxel';
import { inWorldXZ, inWorldY } from './world-bounds';

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
export function breakBlock(pos: BlockPos, world: BlockSource): boolean {
  const [x, y, z] = pos;
  // Y=0 = bedrock: tidak bisa dihancurkan, mencegah player jatuh ke void.
  if (y === 0) return false;
  if (!inWorldXZ(x, z) || !inWorldY(y)) return false;
  if (world.getBlock(pos) === VOXEL_AIR) return false;
  return world.setBlock(pos, VOXEL_AIR);
}

/**
 * Taruh blok. Return false kalau:
 * - target di luar batas (chunk tidak ada / y di luar tinggi)
 * - target sudah solid
 * - target overlap AABB player
 */
export function placeBlock(
  pos: BlockPos,
  type: VoxelType,
  world: BlockSource,
  player?: PlayerBounds,
): boolean {
  const [x, y, z] = pos;
  if (!inWorldXZ(x, z) || !inWorldY(y)) return false;
  if (type === VOXEL_AIR) return false;
  if (world.getBlock(pos) !== VOXEL_AIR) return false;
  if (player !== undefined && overlapsPlayer(x, y, z, player)) return false;
  return world.setBlock(pos, type);
}
