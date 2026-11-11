import { Group, Mesh, MeshLambertMaterial } from 'three';
import { blockBoxGeometry } from '../world/mesher';
import { atlasTexture } from '../world/texture-atlas';
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
  readonly group: Group;
  spawn(type: VoxelType, x: number, y: number, z: number): void;
  update(
    delta: number,
    player: { x: number; y: number; z: number },
    world: BlockSource,
    tryPickup: (type: VoxelType) => boolean,
  ): void;
  dispose(): void;
}

let dropMaterial: MeshLambertMaterial | null = null;
/** Satu material atlas dipakai semua item (UV per geometri sudah di-remap). */
function material(): MeshLambertMaterial {
  if (dropMaterial === null) dropMaterial = new MeshLambertMaterial({ map: atlasTexture() });
  return dropMaterial;
}

/** Entity item drop: kotak kecil bertekstur blok. */
function createDrop(type: VoxelType, x: number, y: number, z: number): Drop {
  const mesh = new Mesh(blockBoxGeometry(type, SIZE), material());
  mesh.position.set(x, y, z);
  return { type, mesh, pos: { x, y, z }, vy: 0, phase: Math.random() * Math.PI * 2 };
}

/** Fisika gravitasi sederhana; berhenti di atas blok solid. */
function applyGravity(drop: Drop, delta: number, world: BlockSource): void {
  const nextY = drop.pos.y + drop.vy * delta;
  const bottom = nextY - SIZE / 2;
  const bx = Math.floor(drop.pos.x);
  const bz = Math.floor(drop.pos.z);
  const groundY = Math.floor(bottom);
  const solid = world.getBlock([bx, groundY, bz]) !== 0;
  if (drop.vy <= 0 && solid) {
    // Berhenti tepat di permukaan atas blok.
    drop.pos.y = groundY + 1 + SIZE / 2;
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
        // Bobbing halus di atas permukaan.
        drop.mesh.position.set(
          drop.pos.x,
          drop.pos.y + Math.sin(Date.now() / 500 + drop.phase) * 0.02,
          drop.pos.z,
        );

        const dx = drop.pos.x - px;
        const dy = drop.pos.y - (player.y + 0.9);
        const dz = drop.pos.z - pz;
        if (Math.hypot(dx, dy, dz) < PICKUP_RANGE && tryPickup(drop.type)) {
          drops.splice(i, 1);
          group.remove(drop.mesh);
          drop.mesh.geometry.dispose();
          (drop.mesh.material as MeshLambertMaterial).dispose();
        }
      }
    },
    dispose() {
      for (const d of drops) {
        d.mesh.geometry.dispose();
        (d.mesh.material as MeshLambertMaterial).dispose();
      }
      group.clear();
      dropMaterial?.dispose();
      dropMaterial = null;
    },
  };
}
