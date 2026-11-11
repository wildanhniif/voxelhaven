import type { Inventory } from '../state/inventory';
import { BLOCK_NAMES } from './block-names';
import { blockIconDataUrl, ATLAS_TILES, type AtlasTile } from '../world/texture-atlas';

export interface HotbarHandle {
  update(inv: Inventory): void;
  dispose(): void;
}

/** Face tile per jenis blok: [top, side]. Digabung jadi ikon isometric. */
const HOTBAR_FACES: Record<number, readonly [AtlasTile, AtlasTile]> = {
  1: [ATLAS_TILES.grassTop, ATLAS_TILES.grassSide],
  2: [ATLAS_TILES.dirt, ATLAS_TILES.dirt],
  3: [ATLAS_TILES.stone, ATLAS_TILES.stone],
  4: [ATLAS_TILES.woodTop, ATLAS_TILES.woodSide],
  5: [ATLAS_TILES.leaves, ATLAS_TILES.leaves],
};

/** Ikon isometric per jenis blok, dibuat sekali (canvas -> data URL). */
function blockIcon(type: number): string {
  const [top, side] = HOTBAR_FACES[type] ?? HOTBAR_FACES[3]!;
  return blockIconDataUrl(top, side);
}

/**
 * Hotbar 9 slot di bawah layar (DOM overlay).
 * Highlight slot aktif + nama blok aktif sebagai label.
 * Ikon slot = render isometric blok (top + 2 sisi), pixelated tanpa smoothing.
 * Badge jumlah (pojok kanan bawah slot); slot kosong gelap.
 */
export function createHotbar(onSlotSelected: (index: number) => void): HotbarHandle {
  const root = document.createElement('div');
  root.style.cssText =
    'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:4px;padding:4px;background:rgba(0,0,0,0.35);border-radius:6px;';

  const label = document.createElement('div');
  label.style.cssText =
    'position:fixed;bottom:66px;left:50%;transform:translateX(-50%);font:12px monospace;color:#fff;text-shadow:0 1px 2px #000;';

  const cells: HTMLElement[] = [];
  const swatches: HTMLElement[] = [];
  const numbers: HTMLElement[] = [];
  const badges: HTMLElement[] = [];

  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.style.cssText =
      'width:40px;height:40px;box-sizing:border-box;border:2px solid rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center;font:12px monospace;color:#fff;cursor:pointer;position:relative;';

    // Nomor slot: label terpisah supaya tidak menimpa swatch.
    const number = document.createElement('span');
    number.textContent = String(i + 1);
    cell.appendChild(number);

    // Slot 0 = tangan kosong: ikon tangan, bukan nomor.
    if (i === 0) {
      number.textContent = '✋';
      number.style.font = '18px monospace';
    }

    // image-rendering: pixelated = wajib biar ikon 32x32 tidak blur saat di-scale.
    const swatch = document.createElement('div');
    swatch.style.cssText =
      'width:28px;height:28px;display:none;background-size:contain;background-position:center;background-repeat:no-repeat;image-rendering:pixelated;';
    cell.appendChild(swatch);

    // Badge jumlah (pojok kanan bawah slot).
    const badge = document.createElement('span');
    badge.style.cssText =
      'position:absolute;right:2px;bottom:0;font:11px monospace;color:#fff;text-shadow:0 1px 2px #000;';
    cell.appendChild(badge);

    cell.addEventListener('click', () => onSlotSelected(i));
    cells.push(cell);
    swatches.push(swatch);
    numbers.push(number);
    badges.push(badge);
    root.appendChild(cell);
  }

  document.body.appendChild(root);
  document.body.appendChild(label);

  return {
    update(inv: Inventory) {
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]!;
        const swatch = swatches[i]!;
        const number = numbers[i]!;
        const badge = badges[i]!;
        const slot = inv.slots[i];
        cell.style.borderColor = i === inv.active ? '#ffffff' : 'rgba(255,255,255,0.35)';
        cell.style.background = i === inv.active ? 'rgba(255,255,255,0.22)' : 'transparent';
        if (slot === undefined || slot === null || slot.count <= 0) {
          swatch.style.display = 'none';
          number.style.display = 'block';
          badge.textContent = '';
          // Slot kosong = gelap (no item).
          cell.style.filter = 'brightness(0.5)';
        } else {
          cell.style.filter = 'brightness(1)';
          swatch.style.display = 'block';
          swatch.style.backgroundImage = `url(${blockIcon(slot.type)})`;
          number.style.display = 'none';
          badge.textContent = String(slot.count);
        }
      }
      const active = inv.slots[inv.active];
      label.textContent = active === undefined || active === null || active.count <= 0 ? 'Slot kosong' : (BLOCK_NAMES[active.type] ?? 'Unknown');
    },
    dispose() {
      root.remove();
      label.remove();
    },
  };
}
