import type { VoxelType } from '../world/voxel';

export const HOTBAR_SIZE = 9;

export interface Inventory {
  /** 9 slot; null = kosong. */
  slots: (VoxelType | null)[];
  active: number;
}

export function createInventory(): Inventory {
  return {
    slots: [1, 2, 3, null, null, null, null, null, null],
    active: 0,
  };
}

/** Return inventory baru dengan slot aktif dipindah; index tidak valid → tidak berubah. */
export function selectSlot(inv: Inventory, index: number): Inventory {
  if (index < 0 || index >= HOTBAR_SIZE) return inv;
  return { ...inv, active: index };
}

/** Return inventory baru dengan slot diisi; index tidak valid → tidak berubah. */
export function setSlot(inv: Inventory, index: number, type: VoxelType | null): Inventory {
  if (index < 0 || index >= HOTBAR_SIZE) return inv;
  const slots = [...inv.slots];
  slots[index] = type;
  return { ...inv, slots };
}

/** Blok di slot aktif; null kalau kosong. */
export function getActiveBlock(inv: Inventory): VoxelType | null {
  return inv.slots[inv.active] ?? null;
}
