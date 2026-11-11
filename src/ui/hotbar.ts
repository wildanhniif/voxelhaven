import type { Inventory } from '../state/inventory';
import { BLOCK_NAMES } from './block-names';
import { tileDataUrl, type AtlasTile, ATLAS_TILES } from '../world/texture-atlas';

export interface HotbarHandle {
  update(inv: Inventory): void;
  dispose(): void;
}

/** Tile yang mewakili tiap jenis blok di hotbar (grass pakai grass-side biar khas). */
const HOTBAR_TILES: Record<number, AtlasTile> = {
  1: ATLAS_TILES.grassSide,
  2: ATLAS_TILES.dirt,
  3: ATLAS_TILES.stone,
};

/**
 * Hotbar 9 slot di bawah layar (DOM overlay, bukan 3D).
 * Highlight slot aktif + nama blok aktif sebagai label.
 * Swatch memakai tekstur atlas asli (pixelated, tanpa smoothing).
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

  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.style.cssText =
      'width:40px;height:40px;box-sizing:border-box;border:2px solid rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center;font:12px monospace;color:#fff;cursor:pointer;';

    // Nomor slot: label terpisah supaya tidak menimpa swatch.
    const number = document.createElement('span');
    number.textContent = String(i + 1);
    cell.appendChild(number);

    // image-rendering: pixelated = wajib biar 16x16 tile tidak blur saat di-scale.
    const swatch = document.createElement('div');
    swatch.style.cssText =
      'width:28px;height:28px;display:none;background-size:cover;image-rendering:pixelated;';
    cell.appendChild(swatch);

    cell.addEventListener('click', () => onSlotSelected(i));
    cells.push(cell);
    swatches.push(swatch);
    numbers.push(number);
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
        const type = inv.slots[i] ?? null;
        cell.style.borderColor = i === inv.active ? '#ffffff' : 'rgba(255,255,255,0.35)';
        cell.style.background = i === inv.active ? 'rgba(255,255,255,0.22)' : 'transparent';
        if (type === null) {
          swatch.style.display = 'none';
          number.style.display = 'block';
        } else {
          swatch.style.display = 'block';
          swatch.style.backgroundImage = `url(${tileDataUrl(HOTBAR_TILES[type] ?? ATLAS_TILES.stone)})`;
          number.style.display = 'none';
        }
      }
      const active = inv.slots[inv.active] ?? null;
      label.textContent = active === null ? 'Slot kosong' : (BLOCK_NAMES[active] ?? 'Unknown');
    },
    dispose() {
      root.remove();
      label.remove();
    },
  };
}
