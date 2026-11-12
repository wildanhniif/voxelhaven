import { describe, expect, it } from 'vitest';
import { createInventory, getActiveBlock, selectSlot } from '../../src/state/inventory';

describe('inventory', () => {
  it('selectSlot memindah slot aktif', () => {
    const inv = createInventory();
    const next = selectSlot(inv, 4);
    expect(next.active).toBe(4);
    // Fungsi murni: original tidak berubah.
    expect(inv.active).toBe(1);
  });

  it('selectSlot dengan index tidak valid → tidak berubah', () => {
    const inv = createInventory();
    expect(selectSlot(inv, -1).active).toBe(1);
    expect(selectSlot(inv, 9).active).toBe(1);
  });

  it('getActiveBlock: slot kosong → null', () => {
    const inv = selectSlot(createInventory(), 5);
    expect(getActiveBlock(inv)).toBeNull();
  });

  it('getActiveBlock: slot terisi → tipe blok', () => {
    const inv = selectSlot(createInventory(), 3);
    expect(getActiveBlock(inv)).toBe(3);
  });

  it('default: slot 0 tangan kosong, slot 1-3 stack penuh, sisanya null', () => {
    const inv = createInventory();
    expect(inv.slots[0]).toBeNull();
    expect(inv.slots.slice(1, 4)).toEqual([
      { type: 1, count: 64 },
      { type: 2, count: 64 },
      { type: 3, count: 64 },
    ]);
    expect(inv.slots.slice(4)).toEqual([null, null, null, null]);
  });
});
