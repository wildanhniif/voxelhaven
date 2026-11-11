import { describe, expect, it } from 'vitest';
import { createInventory, getActiveBlock, selectSlot } from '../../src/state/inventory';

describe('inventory', () => {
  it('selectSlot memindah slot aktif', () => {
    const inv = createInventory();
    const next = selectSlot(inv, 4);
    expect(next.active).toBe(4);
    // Fungsi murni: original tidak berubah.
    expect(inv.active).toBe(0);
  });

  it('selectSlot dengan index tidak valid → tidak berubah', () => {
    const inv = createInventory();
    expect(selectSlot(inv, -1).active).toBe(0);
    expect(selectSlot(inv, 9).active).toBe(0);
  });

  it('getActiveBlock: slot kosong → null', () => {
    const inv = selectSlot(createInventory(), 5);
    expect(getActiveBlock(inv)).toBeNull();
  });

  it('getActiveBlock: slot terisi → tipe blok', () => {
    const inv = selectSlot(createInventory(), 2);
    expect(getActiveBlock(inv)).toBe(3);
  });

  it('default: slot 0-2 stack penuh (grass, dirt, stone), sisanya null', () => {
    const inv = createInventory();
    expect(inv.slots.slice(0, 3)).toEqual([
      { type: 1, count: 64 },
      { type: 2, count: 64 },
      { type: 3, count: 64 },
    ]);
    expect(inv.slots.slice(3)).toEqual([null, null, null, null, null, null]);
  });
});
