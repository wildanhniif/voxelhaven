/**
 * Identitas world: nama → seed deterministik + key localStorage.
 * Growtopia-style: setiap nama = world tersendiri dengan save sendiri.
 */

/** Hash FNV-1a 32-bit; deterministik lintas platform, cukup untuk seed. */
export function worldSeed(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Nama world dipakai apa adanya sebagai suffix key localStorage. */
export function storageKey(worldName: string): string {
  return `voxel-sandbox:edits:v1:${worldName}`;
}

/** Nama world valid: 1-32 karakter, tanpa karakter kontrol. */
export function validWorldName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 32;
}
