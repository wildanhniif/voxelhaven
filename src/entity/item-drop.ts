import { BoxGeometry, Color, Group, Mesh, MeshLambertMaterial } from 'three';
import { BLOCK_COLORS } from '../world/mesher';
import type { BlockSource, VoxelType } from '../world/voxel';

const GRAVITY = 20; // blok/detik^2, sedikit lebih ringan dari player
const SIZE = 0.25;
/** Jarak (blok) pusat player-item untuk pickup. */
export const PICKUP_RANGE = 1.2;

interface Drop {
  type: VoxelType;
  mesh: Mesh;
  pos: { x: number; y: number; z: number };
  vy: number;
  /** Fase acak supaya bobbing tiap item tidak sinkron. */
  phase: number;
}

export interface ItemDropsHandle {
  /** Masukkan ke scene. */
  readonly group: Group;
  /** Spawn satu item di pusat blok (x, y, z). */
  spawn(type: VoxelType, x: number, y: number, z: number): void;
  /** Fisika jatuh + pickup. tryPickup return false = item tetap di tanah. */
  update(delta: number, player: { x: number; y: number; z: number }, world: BlockSource, tryPickup: (type: VoxelType) => boolean): void;
  dispose(): void;
}

/** Entity item drop: kotak kecil warna blok. */
function createDrop(type: VoxelType, x: number, y: number, z: number): Drop {
  const rgb = BLOCK_COLORS[type as Exclude<VoxelType, 0>];
  const mesh = new Mesh(
    new BoxGeometry(SIZE, SIZE, SIZE),
    new MeshLambertMaterial({ color: new Color(rgb[0], rgb[1], rgb[2]) }),
  );
  mesh.position.set(x, y, z);
  return { type, mesh, pos: { x, y, z }, vy: 0, phase: Math.random() * Math.PI * 2 };
}

/** Fisika gravitasi sederhana; berhenti di atas blok solid pertama. */
function applyGravity(drop: Drop, delta: number, world: BlockSource): void {
  const nextY = drop.pos.y + drop.vy * delta;
  const probe = Math.floor(nextY - SIZE / 2);
  const solid =
    world.getBlock([Math.floor(drop.pos.x), probe, Math.floor(drop.pos.z)]) !== 0;
  if (drop.vy <= 0 && solid) {
    drop.pos.y = probe + 1 + SIZE / 2;
    drop.vy = 0;
  } else {
    drop.pos.y = nextY;
    drop.vy -= GRAVITY * delta;
  }
}

/** Kumpulan item drop di dunia; satu Group dipakai bersama. */
export function createItemDrops(): ItemDropsHandle {
  const group = new Group();
  const drops: Drop[] = [];

  return {
    group,
    spawn(type, x, y, z) {
      const drop = createDrop(type, x, y, z);
      drops.push(drop);
      group.add(drop.mesh);
    },
    update(delta, player, world, tryPickup) {
      const px = player.x;
      const pz = player.z;
      for (let i = drops.length - 1; i >= 0; i--) {
        const drop = drops[i]!;
        applyGravity(drop, delta, world);
        drop.mesh.rotation.y += delta * 1.5;
        drop.mesh.position.set(drop.pos.x, drop.pos.y, drop.pos.z);
        // Bobbing + rotasi; fase acak per item.
        drop.mesh.position.y = drop.pos.y + Math.sin(Date.now() / 500 + drop.phase) * 0.05;

        const dx = drop.pos.x - px;
        const dy = drop.pos.y - (player.y + 0.9);
        const dz = drop.pos.z - pz;
        if (Math.hypot(dx, dy, dz) < PICKUP_RANGE && tryPickup(drop.type)) {
          drops.splice(i, 1);
          group.remove(drop.mesh);
        }
      }
    },
    dispose() {
      for (const d of drops) {
        d.mesh.geometry.dispose();
        (d.mesh.material as MeshLambertMaterial).dispose();
      }
      group.clear();
    },
  };
}
