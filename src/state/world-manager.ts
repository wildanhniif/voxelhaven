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

/** Key riwayat: daftar nama world yang pernah dikunjungi (urutan terbalik). */
const RECENT_KEY = 'voxel-sandbox:recents:v1';

/** Tambah world ke riwayat; maksimal 32 entri unik. */
export function recordWorld(name: string): void {
  const trimmed = name.trim();
  if (trimmed.length === 0) return;
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
    // Hapus duplikat, lalu sisipkan yang baru di depan.
    const filtered = list.filter((n) => n !== trimmed);
    filtered.unshift(trimmed);
    if (filtered.length > 32) filtered.pop();
    localStorage.setItem(RECENT_KEY, JSON.stringify(filtered));
  } catch {
    // localStorage rusak/engagement: abaikan.
  }
}

/** Riwayat world terakhir dikunjungi (nama baru duluan). */
export function getRecentWorlds(): string[] {
  try {
    return (JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]).filter((n) =>
      n.trim().length > 0,
    );
  } catch {
    return [];
  }
}

/** Hapus satu world dari riwayat; kembali list setelahnya. */
export function forgetWorld(name: string): string[] {
  const trimmed = name.trim();
  if (trimmed.length === 0) return [];
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
    const out = list.filter((n) => n !== trimmed);
    localStorage.setItem(RECENT_KEY, JSON.stringify(out));
    return out;
  } catch {
    return [];
  }
}


