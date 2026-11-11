import type { BlockPos, VoxelType } from '../world/voxel';

const STORAGE_KEY = 'voxel-sandbox:edits:v1';

/** Log edit blok (delta vs terrain noise) dengan persistence localStorage. */
export interface BlockStore {
  recordEdit(pos: BlockPos, type: VoxelType): void;
  getEdit(pos: BlockPos): VoxelType | null;
  /** Edit di dalam chunk (cx, cz); dipakai chunk-manager saat chunk dimuat. */
  editsInChunk(cx: number, cz: number, size: number): Iterable<[BlockPos, VoxelType]>;
  clearEdits(): void;
  flush(): void;
  readonly size: number;
}

export function posKey(pos: BlockPos): string {
  return pos[0] + ',' + pos[1] + ',' + pos[2];
}

function parseKey(key: string): BlockPos | null {
  const parts = key.split(',');
  if (parts.length !== 3) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  const z = Number(parts[2]);
  if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) return null;
  return [x, y, z];
}

/**
 * Ambang flush: simpan ke localStorage max sekali per threshold edit
 * supaya tidak sinkron ke disk setiap klik. beforeunload tetap flush sisa.
 */
const FLUSH_THRESHOLD = 20;

export function createBlockStore(): BlockStore {
  const edits = new Map<string, VoxelType>();
  let dirty = 0;

  const flush = (): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...edits]));
    dirty = 0;
  };

  const restore = (): void => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      for (const entry of parsed) {
        if (
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === 'string' &&
          typeof entry[1] === 'number'
        ) {
          edits.set(entry[0], entry[1] as VoxelType);
        }
      }
    } catch {
      // Data korup: anggap kosong, edit berikutnya akan menimpa.
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  restore();

  return {
    recordEdit(pos, type) {
      edits.set(posKey(pos), type);
      dirty += 1;
      if (dirty >= FLUSH_THRESHOLD) flush();
    },

    getEdit(pos) {
      return edits.get(posKey(pos)) ?? null;
    },

    *editsInChunk(cx, cz, size) {
      const minX = cx * size;
      const maxX = minX + size - 1;
      const minZ = cz * size;
      const maxZ = minZ + size - 1;
      for (const [key, type] of edits) {
        const pos = parseKey(key);
        if (pos === null) continue;
        const [x, , z] = pos;
        if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) yield [pos, type];
      }
    },

    clearEdits() {
      edits.clear();
      localStorage.removeItem(STORAGE_KEY);
      dirty = 0;
    },

    flush,

    get size() {
      return edits.size;
    },
  };
}
