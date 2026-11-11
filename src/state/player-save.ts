/**
 * Save state player: posisi + inventory, dipersist ke localStorage.
 * Terpisah dari block-store supaya kegagalan parse satu bagian tidak
 * mengorbankan bagian lain.
 */
const KEY_BASE = 'voxel-sandbox:player:v1';

export interface PlayerSave {
  x: number;
  y: number;
  z: number;
  /** Slot hotbar; null = kosong. */
  slots: ({ type: number; count: number } | null)[];
  active: number;
}

export function savePlayer(worldName: string, state: PlayerSave): void {
  try {
    localStorage.setItem(`${KEY_BASE}:${worldName}`, JSON.stringify(state));
  } catch {
    // Quota penuh/disk penuh: abaikan, game tetap jalan di sesi ini.
  }
}

export function loadPlayer(worldName: string): PlayerSave | null {
  const raw = localStorage.getItem(`${KEY_BASE}:${worldName}`);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return null;
    const s = parsed as PlayerSave;
    if (
      typeof s.x !== 'number' ||
      typeof s.y !== 'number' ||
      typeof s.z !== 'number' ||
      !Array.isArray(s.slots) ||
      typeof s.active !== 'number'
    ) {
      return null;
    }
    return s;
  } catch {
    return null;
  }
}
