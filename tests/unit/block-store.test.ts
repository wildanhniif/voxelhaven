import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlockStore, posKey } from '../../src/state/block-store';

// localStorage in-memory untuk environment node.
function installLocalStorage(): Map<string, string> {
  const map = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  });
  return map;
}

describe('block-store', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it('recordEdit lalu getEdit mengembalikan tipe blok', () => {
    const store = createBlockStore();
    store.recordEdit([1, 2, 3], 1);
    expect(store.getEdit([1, 2, 3])).toBe(1);
    expect(store.size).toBe(1);
  });

  it('getEdit pada posisi yang belum diedit: null', () => {
    const store = createBlockStore();
    expect(store.getEdit([9, 9, 9])).toBeNull();
  });

  it('overwrite: edit kedua pada posisi sama menimpa yang pertama', () => {
    const store = createBlockStore();
    store.recordEdit([4, 5, 6], 1);
    store.recordEdit([4, 5, 6], 0);
    expect(store.getEdit([4, 5, 6])).toBe(0);
    expect(store.size).toBe(1);
  });

  it('clearEdits menghapus semua edit termasuk dari localStorage', () => {
    const store = createBlockStore();
    store.recordEdit([1, 1, 1], 3);
    store.flush();
    store.clearEdits();
    expect(store.size).toBe(0);
    expect(store.getEdit([1, 1, 1])).toBeNull();

    // Store baru membaca dari localStorage yang sudah bersih.
    const fresh = createBlockStore();
    expect(fresh.size).toBe(0);
  });

  it('persist: edit terbaca lagi oleh store baru setelah flush', () => {
    const store = createBlockStore();
    store.recordEdit([7, 2, -3], 2);
    store.flush();

    const fresh = createBlockStore();
    expect(fresh.getEdit([7, 2, -3])).toBe(2);
  });

  it('editsInChunk hanya mengembalikan edit di chunk yang diminta', () => {
    const store = createBlockStore();
    store.recordEdit([5, 10, 5], 1); // chunk (0,0), size 32
    store.recordEdit([40, 10, 5], 2); // chunk (1,0)
    store.recordEdit([5, 10, 70], 0); // chunk (0,2)

    const inChunk00 = [...store.editsInChunk(0, 0, 32)];
    expect(inChunk00).toHaveLength(1);
    expect(inChunk00[0]![0]).toEqual([5, 10, 5]);
    expect(inChunk00[0]![1]).toBe(1);
  });

  it('posKey memakai format x,y,z yang stabil', () => {
    expect(posKey([-1, 2, 30])).toBe('-1,2,30');
  });
});
