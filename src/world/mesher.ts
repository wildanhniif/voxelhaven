import { BufferAttribute, BufferGeometry } from 'three';
import { CHUNK_HEIGHT, CHUNK_SIZE, type Chunk } from './terrain';
import { flatIndex, VOXEL_AIR, type VoxelType } from './voxel';

type Vec3 = readonly [number, number, number];

/** Warna RGB 0..1 per jenis blok. */
export const BLOCK_COLORS: Record<Exclude<VoxelType, 0>, Vec3> = {
  1: [0.36, 0.65, 0.28], // grass
  2: [0.55, 0.38, 0.22], // dirt
  3: [0.5, 0.5, 0.52], // stone
};

/** 4 vertex per face, winding CCW dilihat dari luar. */
const FACES: ReadonlyArray<{
  readonly normal: Vec3;
  readonly corners: readonly [Vec3, Vec3, Vec3, Vec3];
}> = [
  { normal: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { normal: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { normal: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { normal: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

const FACE_INDICES = [0, 1, 2, 0, 2, 3] as const;
const AO_SHADE = [0.75, 0.85, 1, 0.9, 0.95, 0.8] as const;

/**
 * Blok di koordinat lokal chunk (x, y, z); 0 kalau di luar chunk.
 * `neighbor` dipakai untuk face di tepi chunk supaya culling lintas chunk benar.
 */
function blockAt(chunk: Chunk, x: number, y: number, z: number): VoxelType {
  if (y < 0 || y >= CHUNK_HEIGHT) return VOXEL_AIR;
  if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
    return chunk.data[flatIndex(x, y, z, CHUNK_SIZE)] as VoxelType;
  }
  const n = chunk.neighbor?.(x, y, z);
  return n ?? VOXEL_AIR;
}

/**
 * Ubah satu chunk jadi BufferGeometry lokal (origin chunk).
 * Face yang nempel blok solid (termasuk chunk tetangga) tidak digenerate.
 */
export function buildChunkGeometry(chunk: Chunk): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const type = blockAt(chunk, x, y, z);
        if (type === VOXEL_AIR) continue;
        const rgb = BLOCK_COLORS[type as Exclude<VoxelType, 0>];
        for (let f = 0; f < FACES.length; f++) {
          const face = FACES[f]!;
          const [nx, ny, nz] = face.normal;
          if (blockAt(chunk, x + nx, y + ny, z + nz) !== VOXEL_AIR) continue;
          const base = positions.length / 3;
          const shade = AO_SHADE[f]!;
          for (const [cx, cy, cz] of face.corners) {
            positions.push(x + cx, y + cy, z + cz);
            normals.push(nx, ny, nz);
            colors.push(rgb[0] * shade, rgb[1] * shade, rgb[2] * shade);
          }
          for (const i of FACE_INDICES) indices.push(base + i);
        }
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1));
  geometry.computeBoundingSphere();
  return geometry;
}
