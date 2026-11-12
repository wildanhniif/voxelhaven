import type { Inventory } from '../state/inventory';
import { BLOCK_NAMES } from './block-names';
import { blockIconDataUrl, ATLAS_TILES, type AtlasTile } from '../world/texture-atlas';

/** Jumlah slot yang tampil di hotbar (sisanya via panel inventory). */
const HOTBAR_VISIBLE = 4;

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

function slotCell(
  onSlotSelected: (index: number) => void,
  i: number,
  size = 40,
): {
  cell: HTMLElement;
  swatch: HTMLElement;
  number: HTMLElement;
  badge: HTMLElement;
} {
  const cell = document.createElement('div');
  cell.style.cssText = `width:${size}px;height:${size}px;box-sizing:border-box;border:2px solid rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center;font:12px monospace;color:#fff;cursor:pointer;position:relative;`;

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

  const badge = document.createElement('span');
  badge.style.cssText =
    'position:absolute;right:2px;bottom:0;font:11px monospace;color:#fff;text-shadow:0 1px 2px #000;';
  cell.appendChild(badge);

  cell.addEventListener('click', () => onSlotSelected(i));
  return { cell, swatch, number, badge };
}

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

  for (let i = 0; i < HOTBAR_VISIBLE; i++) {
    const parts = slotCell(onSlotSelected, i);
    cells.push(parts.cell);
    swatches.push(parts.swatch);
    numbers.push(parts.number);
    badges.push(parts.badge);
    root.appendChild(parts.cell);
  }

  // ─── Panel inventory: grid Growtopia-style, bisa di-scroll vertikal ──
  // Kernel item dimasukkan ke sini (bukan ke hotbar) supaya panel berisi
  // seluruh 8 slot dan tetap bisa digulir kalau nanti slot bertambah.
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;bottom:66px;left:50%;transform:translateX(-50%);display:none;grid-template-columns:repeat(10,34px);gap:4px;padding:8px;background:rgba(0,0,0,0.7);border-radius:8px;max-height:55vh;overflow-y:auto;z-index:20;';

  const panelCells: HTMLElement[] = [];
  const panelSwatches: HTMLElement[] = [];
  const panelNumbers: HTMLElement[] = [];
  const panelBadges: HTMLElement[] = [];
  for (let i = 0; i < 8; i++) {
    const parts = slotCell(onSlotSelected, i, 34);
    panelCells.push(parts.cell);
    panelSwatches.push(parts.swatch);
    panelNumbers.push(parts.number);
    panelBadges.push(parts.badge);
    panel.appendChild(parts.cell);
  }

  // Penanda kecil di bawah panel: swipe up untuk buka, swipe ke bawah untuk tutup.
  const hint = document.createElement('div');
  hint.textContent = '∧';
  hint.style.cssText =
    'position:fixed;bottom:56px;left:50%;transform:translateX(-50%);font:12px monospace;color:rgba(255,255,255,0.55);text-shadow:0 1px 2px #000;z-index:20;pointer-events:none;';

  const setPanelOpen = (open: boolean): void => {
    panel.style.display = open ? 'grid' : 'none';
    hint.textContent = open ? '∨' : '∧';
  };
  document.body.appendChild(root);
  document.body.appendChild(label);
  document.body.appendChild(panel);
  document.body.appendChild(hint);

  // Gesture drawer: geser hotbar ke atas → panel naik; geser panel turun
  // atau ketuk area kosong di luar panel → tertutup.
  let touchStartY: number | null = null;
  root.addEventListener(
    'touchstart',
    (e) => {
      touchStartY = e.touches[0]?.clientY ?? null;
    },
    { passive: true },
  );
  root.addEventListener(
    'touchend',
    (e) => {
      const endY = e.changedTouches[0]?.clientY ?? null;
      if (touchStartY === null || endY === null) return;
      if (endY - touchStartY < -30) setPanelOpen(true);
      touchStartY = null;
    },
    { passive: true },
  );
  panel.addEventListener(
    'touchstart',
    (e) => {
      touchStartY = e.touches[0]?.clientY ?? null;
    },
    { passive: true },
  );
  panel.addEventListener(
    'touchend',
    (e) => {
      const endY = e.changedTouches[0]?.clientY ?? null;
      if (endY !== null && touchStartY !== null && endY - touchStartY > 30) setPanelOpen(false);
      touchStartY = null;
    },
    { passive: true },
  );
  // Ketuk di luar panel (canvas kosong) menutup drawer.
  const onDocTouch = (e: TouchEvent): void => {
    if (panel.style.display === 'none') return;
    const t = e.target as Node | null;
    if (t !== null && (panel.contains(t) || root.contains(t))) return;
    setPanelOpen(false);
  };
  document.addEventListener('touchstart', onDocTouch, { passive: true });

  const updateSlots = (
    inv: Inventory,
    cs: HTMLElement[],
    sw: HTMLElement[],
    nums: HTMLElement[],
    bgs: HTMLElement[],
  ): void => {
    for (let i = 0; i < cs.length; i++) {
      const cell = cs[i]!;
      const swatch = sw[i]!;
      const number = nums[i]!;
      const badge = bgs[i]!;
      const slot = inv.slots[i];
      cell.style.borderColor = i === inv.active ? '#ffffff' : 'rgba(255,255,255,0.35)';
      cell.style.background = i === inv.active ? 'rgba(255,255,255,0.22)' : 'transparent';
      if (slot === undefined || slot === null || slot.count <= 0) {
        swatch.style.display = 'none';
        number.style.display = 'block';
        badge.textContent = '';
        cell.style.filter = 'brightness(0.5)';
      } else {
        cell.style.filter = 'brightness(1)';
        swatch.style.display = 'block';
        swatch.style.backgroundImage = `url(${blockIcon(slot.type)})`;
        number.style.display = 'none';
        badge.textContent = String(slot.count);
      }
    }
  };

  return {
    update(inv: Inventory) {
      updateSlots(inv, cells, swatches, numbers, badges);
      updateSlots(inv, panelCells, panelSwatches, panelNumbers, panelBadges);
      const active = inv.slots[inv.active];
      label.textContent =
        active === undefined || active === null || active.count <= 0
          ? 'Slot kosong'
          : (BLOCK_NAMES[active.type] ?? 'Unknown');
    },
    dispose() {
      document.removeEventListener('touchstart', onDocTouch);
      root.remove();
      label.remove();
      panel.remove();
      hint.remove();
    },
  };
}
