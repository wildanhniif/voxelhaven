import { isSolid, type VoxelWorld } from '../world/voxel';

export type Vec3 = readonly [number, number, number];

export interface RayHit {
  /** Posisi blok yang kena. */
  readonly block: Vec3;
  /** Posisi blok kosong tepat di sisi kena (untuk taruh blok). */
  readonly adjacent: Vec3;
}

/**
 * Raycast voxel dengan DDA (Amanatides-Woo): step antar sel mengikuti
 * perpotongan grid, tidak iterasi per voxel.
 * `direction` HARUS dinormalisasi.
 */
export function raycastVoxel(
  origin: Vec3,
  direction: Vec3,
  maxDistance: number,
  world: VoxelWorld,
): RayHit | null {
  const [ox, oy, oz] = origin;
  const [dx, dy, dz] = direction;
  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);

  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

  // Jarak t sampai perpotongan grid pertama; delta jarak antar bidang.
  const boundX = stepX > 0 ? x + 1 - ox : ox - x;
  const boundY = stepY > 0 ? y + 1 - oy : oy - y;
  const boundZ = stepZ > 0 ? z + 1 - oz : oz - z;
  const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Infinity;
  let tMaxX = stepX !== 0 ? boundX * tDeltaX : Infinity;
  let tMaxY = stepY !== 0 ? boundY * tDeltaY : Infinity;
  let tMaxZ = stepZ !== 0 ? boundZ * tDeltaZ : Infinity;

  // Sel asal diperiksa dulu (ray mulai di dalam blok).
  if (isSolid([x, y, z], world)) {
    return { block: [x, y, z], adjacent: [x - stepX, y - stepY, z - stepZ] };
  }

  let traveled = 0;
  let normal: Vec3 = [0, 0, 0];
  while (traveled <= maxDistance) {
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      traveled = tMaxX;
      tMaxX += tDeltaX;
      normal = [-stepX, 0, 0];
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      traveled = tMaxY;
      tMaxY += tDeltaY;
      normal = [0, -stepY, 0];
    } else {
      z += stepZ;
      traveled = tMaxZ;
      tMaxZ += tDeltaZ;
      normal = [0, 0, -stepZ];
    }
    if (isSolid([x, y, z], world)) {
      return {
        block: [x, y, z],
        adjacent: [x + normal[0], y + normal[1], z + normal[2]],
      };
    }
  }
  return null;
}
