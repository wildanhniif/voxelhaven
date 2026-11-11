import type { BlockSource, BlockPos, VoxelType } from '../world/voxel';
import { flatIndex, VOXEL_AIR } from '../world/voxel';
import { CHUNK_SIZE, generateChunk, type Chunk, type TerrainConfig } from './terrain';
import { inWorldChunk } from './world-bounds';

export const LOAD_RADIUS = 4;
export const UNLOAD_RADIUS = 6;
/** Max chunk yang di-generate per frame agar tidak freeze. */
const MAX_CHUNKS_PER_FRAME = 1;

/** Persistence minimal yang dibutuhkan chunk manager (implementasi: BlockStore). */
export interface EditLog {
  recordEdit(pos: BlockPos, type: VoxelType): void;
  /** Edit per chunk (posisi absolut, tipe). */
  editsInChunk(cx: number, cz: number, size: number): Iterable<[BlockPos, VoxelType]>;
}

/** Cache chunk yang sudah dimuat, plus streaming radius. */
export class ChunkManager implements BlockSource {
  private readonly chunks = new Map<string, Chunk>();
  private readonly queue: { cx: number; cz: number; dist: number }[] = [];

  constructor(
    private readonly config: TerrainConfig,
    private readonly onChunkLoaded: (chunk: Chunk) => void,
    private readonly onChunkUnloaded: (chunk: Chunk) => void,
    private readonly edits: EditLog | null = null,
  ) {}

  /** Config terrain dipakai mesher untuk culling di tepi chunk. */
  get terrainConfig(): TerrainConfig {
    return this.config;
  }

  get loadedCount(): number {
    return this.chunks.size;
  }

  /** Koordinat dunia → chunk; null kalau chunk belum dimuat. */
  chunkAt(x: number, z: number): Chunk | null {
    const { cx, cz } = worldToChunk(x, z);
    return this.chunks.get(key(cx, cz)) ?? null;
  }

  getBlock(pos: BlockPos): VoxelType {
    const [x, y, z] = pos;
    if (y < 0 || y >= CHUNK_SIZE) return VOXEL_AIR;
    const chunk = this.chunkAt(x, z);
    if (chunk === null) return VOXEL_AIR;
    const lx = x - chunk.cx * CHUNK_SIZE;
    const lz = z - chunk.cz * CHUNK_SIZE;
    return chunk.data[flatIndex(lx, y, lz, CHUNK_SIZE)] as VoxelType;
  }

  /** Sama dengan getBlock, tapi null kalau chunk belum dimuat (bukan udara). */
  getBlockLoaded(pos: BlockPos): VoxelType | null {
    const [x, y, z] = pos;
    if (y < 0 || y >= CHUNK_SIZE) return VOXEL_AIR;
    const chunk = this.chunkAt(x, z);
    if (chunk === null) return null;
    const lx = x - chunk.cx * CHUNK_SIZE;
    const lz = z - chunk.cz * CHUNK_SIZE;
    return chunk.data[flatIndex(lx, y, lz, CHUNK_SIZE)] as VoxelType;
  }

  setBlock(pos: BlockPos, type: VoxelType): boolean {
    const [x, y, z] = pos;
    if (y < 0 || y >= CHUNK_SIZE) return false;
    const chunk = this.chunkAt(x, z);
    if (chunk === null) return false;
    const lx = x - chunk.cx * CHUNK_SIZE;
    const lz = z - chunk.cz * CHUNK_SIZE;
    chunk.data[flatIndex(lx, y, lz, CHUNK_SIZE)] = type;
    this.edits?.recordEdit(pos, type);
    this.onChunkLoaded(chunk);
    return true;
  }

  /**
   * Antri chunk dalam radius LOAD_RADIUS player (terdekat dulu),
   * generate max MAX_CHUNKS_PER_FRAME per panggilan, unload > UNLOAD_RADIUS.
   * Return chunk yang baru selesai dimuat frame ini (max 1).
   */
  update(playerX: number, playerZ: number): Chunk | null {
    const { cx: pcx, cz: pcz } = worldToChunk(playerX, playerZ);

    this.queue.length = 0;
    for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
      for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
        if (!inWorldChunk(pcx + dx, pcz + dz)) continue;
        if (!this.chunks.has(key(pcx + dx, pcz + dz))) {
          this.queue.push({ cx: pcx + dx, cz: pcz + dz, dist: dx * dx + dz * dz });
        }
      }
    }
    this.queue.sort((a, b) => a.dist - b.dist);

    let loadedChunk: Chunk | null = null;
    for (let i = 0; i < MAX_CHUNKS_PER_FRAME && this.queue.length > 0; i++) {
      const { cx, cz } = this.queue.shift()!;
      const chunk = generateChunk(cx, cz, this.config);
      this.applyEdits(chunk);
      this.chunks.set(key(cx, cz), chunk);
      this.onChunkLoaded(chunk);
      loadedChunk = chunk;
    }

    for (const [chunkKey, chunk] of this.chunks) {
      const dist = Math.max(Math.abs(chunk.cx - pcx), Math.abs(chunk.cz - pcz));
      if (dist > UNLOAD_RADIUS) {
        this.chunks.delete(chunkKey);
        this.onChunkUnloaded(chunk);
      }
    }

    return loadedChunk;
  }

  /** Timpa hasil generate dengan edit player untuk chunk ini. */
  private applyEdits(chunk: Chunk): void {
    if (this.edits === null) return;
    for (const [pos, type] of this.edits.editsInChunk(chunk.cx, chunk.cz, CHUNK_SIZE)) {
      const [x, y, z] = pos;
      if (y < 0 || y >= CHUNK_SIZE) continue;
      const lx = x - chunk.cx * CHUNK_SIZE;
      const lz = z - chunk.cz * CHUNK_SIZE;
      chunk.data[flatIndex(lx, y, lz, CHUNK_SIZE)] = type;
    }
  }
}

function worldToChunk(x: number, z: number): { cx: number; cz: number } {
  return { cx: Math.floor(x / CHUNK_SIZE), cz: Math.floor(z / CHUNK_SIZE) };
}

function key(cx: number, cz: number): string {
  return cx + ',' + cz;
}
