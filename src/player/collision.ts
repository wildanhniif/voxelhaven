import type { BlockPos, BlockSource } from '../world/voxel';
import { WORLD_SIZE } from '../world/world-bounds';
import { GRAVITY } from './constants';

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const TERMINAL_VELOCITY = 55; // m/s

export interface PlayerBody {
  /** Posisi kaki (pusat bawah AABB). */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
}

export function createPlayerBody(x: number, y: number, z: number): PlayerBody {
  return { x, y, z, vx: 0, vy: 0, vz: 0, onGround: false };
}

/** Half-extent AABB di sumbu horizontal. */
const HALF_W = PLAYER_WIDTH / 2;
const SKIN = 1e-4; // toleransi supaya resolve tidak osilasi antar frame

/** Apakah AABB player (di posisi px,py,pz) overlap blok solid? */
function collides(px: number, py: number, pz: number, world: BlockSource): boolean {
  const minX = Math.floor(px - HALF_W + SKIN);
  const maxX = Math.floor(px + HALF_W - SKIN);
  const minY = Math.floor(py + SKIN);
  const maxY = Math.floor(py + PLAYER_HEIGHT - SKIN);
  const minZ = Math.floor(pz - HALF_W + SKIN);
  const maxZ = Math.floor(pz + HALF_W - SKIN);
  for (let y = minY; y <= maxY; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        if (world.getBlock([x, y, z] as BlockPos) !== 0) return true;
      }
    }
  }
  return false;
}

/**
 * Integrasi + resolve tabrakan sumbu-per-sumbu (X, Y, lalu Z).
 * Fungsi murni terhadap world; memutasi body.
 */
export function updatePhysics(body: PlayerBody, delta: number, world: BlockSource): void {
  const dt = Math.min(delta, 0.05); // clamp agar tabrakan tetap stabil saat frame drop

  // Dinding gaib di tepi dunia: clamp AABB supaya player tidak bisa keluar
  // ke area tanpa chunk (yang akan terbaca sebagai udara lalu jatuh).
  const minX = HALF_W;
  const maxX = WORLD_SIZE - HALF_W;
  const nextX = Math.min(Math.max(body.x + body.vx * dt, minX), maxX);
  if (!collides(nextX, body.y, body.z, world)) {
    body.x = nextX;
  } else {
    body.vx = 0;
  }

  // Z
  const nextZ = Math.min(Math.max(body.z + body.vz * dt, minX), maxX);
  if (!collides(body.x, body.y, nextZ, world)) {
    body.z = nextZ;
  } else {
    body.vz = 0;
  }


  // Y
  body.vy = Math.max(body.vy - GRAVITY * dt, -TERMINAL_VELOCITY);
  const nextY = body.y + body.vy * dt;
  if (!collides(body.x, nextY, body.z, world)) {
    body.y = nextY;
    body.onGround = false;
  } else if (body.vy < 0) {
    // Mendarat: snap ke permukaan atas blok (grid selaras integer).
    body.y = Math.ceil(nextY);
    body.vy = 0;
    body.onGround = true;
  } else {
    // Kepala kena langit-langit.
    body.vy = 0;
  }
}

/** Bila player jatuh keluar world (void), reset ke posisi spawn. */
export function resetIfFallenOut(
  body: PlayerBody,
  spawn: { x: number; y: number; z: number },
  limit = -20,
): void {
  if (body.y < limit) {
    body.x = spawn.x;
    body.y = spawn.y;
    body.z = spawn.z;
    body.vx = 0;
    body.vy = 0;
    body.vz = 0;
  }
}
