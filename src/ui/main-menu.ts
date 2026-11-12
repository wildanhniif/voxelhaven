import { getRecentWorlds } from '../state/world-manager';

/**
 * Main menu overlay: input nama world + tombol Play.
 * Callback onPlay dipanggil dengan nama world yang sudah divalidasi.
 */
export function createMainMenu(onPlay: (worldName: string) => void): { dispose(): void } {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.gap = '16px';
  overlay.style.background = 'rgba(0,0,0,0.85)';
  overlay.style.zIndex = '100';
  overlay.style.fontFamily = 'sans-serif';
  overlay.style.color = 'white';

  const title = document.createElement('h1');
  title.textContent = 'VoxelHaven';
  title.style.margin = '0';
  overlay.appendChild(title);

  const hint = document.createElement('p');
  hint.textContent = 'Masukkan nama world';
  hint.style.margin = '0';
  hint.style.opacity = '0.8';
  overlay.appendChild(hint);

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Nama world';
  input.maxLength = 32;
  input.style.padding = '12px 16px';
  input.style.fontSize = '18px';
  input.style.borderRadius = '8px';
  input.style.border = '1px solid #666';
  input.autofocus = true;
  overlay.appendChild(input);
  // Riwayat world terakhir: ketuk untuk isi nama, langsung bisa Play.
  const recents = getRecentWorlds();
  if (recents.length > 0) {
    const listTitle = document.createElement('p');
    listTitle.textContent = 'World terakhir';
    listTitle.style.cssText = 'margin:0;opacity:0.7;font-size:14px;';
    overlay.appendChild(listTitle);

    const list = document.createElement('div');
    list.style.cssText =
      'display:flex;flex-direction:column;gap:6px;max-height:35vh;overflow-y:auto;width:240px;';
    for (const name of recents.slice(0, 10)) {
      const item = document.createElement('button');
      item.textContent = name;
      item.style.cssText =
        'padding:10px 14px;font-size:16px;border-radius:6px;border:1px solid #666;background:rgba(255,255,255,0.08);color:white;text-align:left;cursor:pointer;';
      item.addEventListener('click', () => onPlay(name));
      list.appendChild(item);
    }
    overlay.appendChild(list);
  }

  const button = document.createElement('button');
  button.textContent = 'Play';
  button.style.padding = '12px 32px';
  button.style.fontSize = '18px';
  button.style.borderRadius = '8px';
  button.style.border = 'none';
  button.style.background = '#4a9';
  button.style.color = 'white';
  overlay.appendChild(button);

  const error = document.createElement('p');
  error.textContent = ' ';
  error.style.margin = '0';
  error.style.minHeight = '1em';
  error.style.color = '#f88';
  error.style.fontSize = '14px';
  overlay.appendChild(error);

  const submit = (): void => {
    const name = input.value.trim();
    if (name.length === 0) {
      error.textContent = 'Nama world tidak boleh kosong';
      return;
    }
    onPlay(name);
  };
  button.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });

  document.body.appendChild(overlay);

  return {
    dispose() {
      overlay.remove();
    },
  };
}
