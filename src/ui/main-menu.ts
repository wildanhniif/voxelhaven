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
