/**
 * Identitas world: nama → seed deterministik + key localStorage.
 * Growtopia-style: setiap nama = world tersendiri dengan save sendiri.
 */

/** Hash FNV-1a 32-bit; deterministik lintas platform, cukup untuk seed. */
export function worldSeed(name: string): number {
  // Normalisasi di sini: seed konsisten meski nama dipanggil dari URL
  // atau menu (menu juga menormalisasi, ini defense-in-depth).
  const n = name.trim().toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < n.length; i++) {
    h ^= n.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Normalisasi nama world: trim + lowercase. Aturan validasi terpisah
 * (validateWorldName) dipakai di menu sebelum onPlay.
 */
export function normalizeWorldName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Validasi nama world: tidak kosong, tidak diawali angka, tanpa spasi,
 * hanya huruf/angka/underscore. Mengembalikan pesan error atau null.
 */
export function validateWorldName(name: string): string | null {
  const n = normalizeWorldName(name);
  if (n.length === 0) return 'Nama world tidak boleh kosong';
  if (/\d/.test(n[0] ?? '')) return 'Nama world tidak boleh diawali angka';
  if (!/^\w+$/.test(n)) return 'Nama world hanya boleh huruf, angka, dan _ (tanpa spasi)';
  return null;
}

/** Key storage memakai nama ternormalisasi (lowercase) agar konsisten. */
export function storageKey(worldName: string): string {
  return `voxel-sandbox:edits:v1:${worldName.trim().toLowerCase()}`;
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


/** Hapus SEMUA data world: riwayat, save player, dan edit blok. */
export function clearAllWorlds(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null && k.startsWith('voxel-sandbox:')) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    // localStorage tidak tersedia: abaikan.
  }
}
