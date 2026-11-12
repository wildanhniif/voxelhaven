import type { VoxelType } from '../world/voxel';

export const HOTBAR_SIZE = 8;
export const MAX_STACK = 64;

/** Slot berisi stack blok; null = kosong. */
export interface ItemStack {
  type: VoxelType;
  count: number;
}

export interface Inventory {
  slots: (ItemStack | null)[];
  active: number;
}

/** Slot 0 dicadangkan untuk "tangan kosong" (bukan item). */
export const HAND_SLOT = 0;

/** Modal awal: slot 1-3 isi penuh (grass, dirt, stone), sisanya kosong. */
export function createInventory(): Inventory {
  const type = (t: VoxelType): ItemStack => ({ type: t, count: MAX_STACK });
  return {
    slots: [null, type(1), type(2), type(3), null, null, null, null],
    active: 1,
  };
}

/** Return inventory baru dengan slot aktif dipindah; index tidak valid → tidak berubah. */
export function selectSlot(inv: Inventory, index: number): Inventory {
  if (index < 0 || index >= HOTBAR_SIZE) return inv;
  return { ...inv, active: index };
}

/** Blok di slot aktif; null kalau kosong. */
export function getActiveBlock(inv: Inventory): VoxelType | null {
  return inv.slots[inv.active]?.type ?? null;
}

/** Total blok bertipe type di seluruh slot. */
export function getCount(inv: Inventory, type: VoxelType): number {
  return inv.slots.reduce((sum, s) => (s !== null && s.type === type ? sum + s.count : sum), 0);
}

/**
 * Tambah 1 blok bertipe type: isi slot bertipe sama yang belum penuh,
 * lalu slot kosong pertama. Kalau penuh semua → inventory tidak berubah
 * (return objek sama, caller bisa cek via getCount).
 */
export function addItem(inv: Inventory, type: VoxelType): Inventory {
  const partial = inv.slots.findIndex(
    (s) => s !== null && s.type === type && s.count < MAX_STACK,
  );
  // Index 0 = slot tangan kosong, item mulai dari index 1.
  const empty = inv.slots.findIndex((s, i) => i > HAND_SLOT && s === null);
  const target = partial >= 0 ? partial : empty;
  if (target < 0) return inv; // inventory penuh: item hangus (biarkan caller cek)

  const slots = [...inv.slots];
  const existing = slots[target];
  slots[target] =
    existing === undefined || existing === null
      ? { type, count: 1 }
      : { type: existing.type, count: existing.count + 1 };
  return { ...inv, slots };
}

/**
 * Kurangi n blok bertipe type (default 1) dari slot-slot yang cocok,
 * mulai dari paling kanan. Return inventory baru; kalau stok kurang,
 * return objek sama (tidak berubah).
 */
export function removeItem(inv: Inventory, type: VoxelType, n = 1): Inventory {
  if (getCount(inv, type) < n) return inv;
  const slots = [...inv.slots];
  let left = n;
  for (let i = slots.length - 1; i >= 0 && left > 0; i--) {
    const slot = slots[i];
    if (slot === undefined || slot === null || slot.type !== type) continue;
    const take = Math.min(slot.count, left);
    slots[i] = take === slot.count ? null : { type: slot.type, count: slot.count - take };
    left -= take;
  }
  return { ...inv, slots };
}
