import { describe, expect, it } from 'vitest';
import {
  MAX_STACK,
  addItem,
  createInventory,
  getCount,
  removeItem,
} from '../../src/state/inventory';

describe('inventory stack count', () => {
  it('addItem menambah count pada stack tipe yang sama', () => {
    const inv = removeItem(createInventory(), 1, 1); // grass 63
    expect(getCount(inv, 1)).toBe(MAX_STACK - 1);
    const next = addItem(inv, 1);
    expect(getCount(next, 1)).toBe(MAX_STACK);
    // Fungsi murni.
    expect(getCount(inv, 1)).toBe(MAX_STACK - 1);
  });

  it('removeItem mengurangi count dan mengosongkan slot saat habis', () => {
    const once = removeItem(createInventory(), 3, 64);
    expect(getCount(once, 3)).toBe(0);
    expect(once.slots[2]).toBeNull();
  });

  it('removeItem tidak mengubah apa pun kalau stok kurang', () => {
    const inv = createInventory();
    const next = removeItem(inv, 3, MAX_STACK + 1);
    expect(next).toBe(inv);
  });

  it('max stack: addItem ke stack penuh memakai slot kosong berikutnya', () => {
    const inv = createInventory(); // slot 3-8 kosong
    const next = addItem(inv, 1);
    expect(getCount(next, 1)).toBe(MAX_STACK + 1);
    expect(next.slots[3]).toEqual({ type: 1, count: 1 });
  });

  it('inventory penuh → addItem tidak mengubah apa pun (item hangus)', () => {
    let inv = createInventory();
    // Isi semua slot dengan tipe berbeda agar tidak ada partial stack.
    inv = { ...inv, slots: inv.slots.map((s) => (s === null ? { type: 2, count: MAX_STACK } : s)) };
    const before = getCount(inv, 3);
    const next = addItem(inv, 3);
    expect(next).toBe(inv);
    expect(getCount(next, 3)).toBe(before);
  });

  it('addItem menempati slot kosong pertama saat tipe baru', () => {
    const inv = createInventory();
    const next = addItem(inv, 3);
    // Semua stack stone penuh, jadi masuk slot kosong pertama (index 3).
    expect(next.slots[3]).toEqual({ type: 3, count: 1 });
  });
});
