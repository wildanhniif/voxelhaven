import type { Inventory } from '../state/inventory';
import { BLOCK_NAMES, BLOCK_SWATCH } from './block-names';

export interface HotbarHandle {
  update(inv: Inventory): void;
  dispose(): void;
}

/**
 * Hotbar 9 slot di bawah layar (DOM overlay, bukan 3D).
 * Highlight slot aktif + nama blok aktif sebagai label.
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

  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.style.cssText =
      'width:40px;height:40px;box-sizing:border-box;border:2px solid rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center;font:12px monospace;color:#fff;cursor:pointer;';
    const swatch = document.createElement('div');
    swatch.style.cssText = 'width:28px;height:28px;display:none;';
    cell.appendChild(swatch);
    cell.addEventListener('click', () => onSlotSelected(i));
    cells.push(cell);
    swatches.push(swatch);
    root.appendChild(cell);
  }

  document.body.appendChild(root);
  document.body.appendChild(label);

  return {
    update(inv: Inventory) {
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]!;
        const swatch = swatches[i]!;
        const type = inv.slots[i] ?? null;
        cell.style.borderColor = i === inv.active ? '#ffffff' : 'rgba(255,255,255,0.35)';
        cell.style.background = i === inv.active ? 'rgba(255,255,255,0.22)' : 'transparent';
        if (type === null) {
          swatch.style.display = 'none';
          cell.textContent = String(i + 1);
        } else {
          swatch.style.display = 'block';
          swatch.style.background = BLOCK_SWATCH[type] ?? '#888';
          cell.textContent = '';
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
