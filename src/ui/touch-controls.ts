import type { TouchMove } from '../player/controller';

export interface TouchControls {
  move: TouchMove;
  jump: boolean;
  dispose(): void;
  /** Set handler pinch-zoom (delta px; jari menjauh). */
  setZoomHandler(h: (deltaPx: number) => void): void;
}

const JOYSTICK_RADIUS = 60;
/** Tahan sekurang ini (ms) sebelum aksi dianggap "break" (bukan tap = place). */
const HOLD_MS = 250;
/** Interval repeat break saat tombol ditahan. */
const REPEAT_MS = 200;

// Key di luar prefix "voxel-sandbox:" (data world) supaya setting user
// tidak ikut terhapus saat "Hapus semua world".
const SENS_KEY = 'voxelhaven:sensitivity:v1';

export function loadSensitivity(): number {
  try {
    const raw = localStorage.getItem(SENS_KEY);
    return raw === null ? 1 : Number(raw);
  } catch {
    return 1;
  }
}

function saveSensitivity(mult: number): void {
  try {
    localStorage.setItem(SENS_KEY, String(mult));
  } catch {
    // localStorage tidak tersedia: abaikan.
  }
}

/**
 * Kontrol sentuh untuk mobile: joystick kiri (gerak), drag area kanan (lihat),
 * pinch zoom (jarak kamera), tombol aksi (tap = place, tahan = break) +
 * jump + keluar. Tidak aktif di desktop (tanpa touch).
 */
export function createTouchControls(
  camera: { applyLook(dx: number, dy: number): void },
  onAction: (button: number) => void,
  onExit: () => void,
  onRespawn: () => void,
  onClearWorlds: () => void,
  onSensitivity: (mult: number) => void,
): TouchControls | null {
  // Deteksi sederhana: hanya pasang di perangkat dengan sentuhan.
  if (!('ontouchstart' in window)) return null;

  // Skala kontrol dari luas layar (akar lebar×tinggi): basis 800px, clamp
  // supaya tidak terlalu kecil di HP kecil atau terlalu besar di tablet.
  const scale = Math.min(
    1.5,
    Math.max(0.7, Math.sqrt(window.innerWidth * window.innerHeight) / 800),
  );
  const px = (v: number): string => `${Math.round(v * scale)}px`;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.fontFamily = 'sans-serif';
  container.style.userSelect = 'none';
  container.style.zIndex = '10';
  document.body.appendChild(container);

  let zoomHandler: ((deltaPx: number) => void) | null = null;

  const controls: TouchControls = {
    move: { x: 0, z: 0 },
    jump: false,
    dispose() {
      document.removeEventListener('touchstart', onLookStart);
      document.removeEventListener('touchmove', onLookMove);
      document.removeEventListener('touchend', lookEnd);
      document.removeEventListener('touchcancel', lookEnd);
      container.remove();
    },
    setZoomHandler(h) {
      zoomHandler = h;
    },
  };

  let lookId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let pinchDist: number | null = null;
  let pinchMode = false;


  // Look + pinch di level document supaya bekerja di seluruh layar;
  // sentuhan yang diawali di atas tombol/joystick diabaikan (lihat isButton).
  const isButton = (el: EventTarget | null): boolean =>
    el instanceof Element && el.closest('[data-tc-btn]') !== null;

  let touchOnButton = false;
  const onLookStart = (e: TouchEvent): void => {
    const t = e.changedTouches[0];
    if (t === undefined) return;
    const onButton = isButton(t.target);
    if (e.touches.length === 2) {
      // Pinch hanya kalau tidak ada jari yang sedang memegang tombol.
      if (onButton || touchOnButton) return;
      pinchMode = true;
      lookId = null;
      const a = e.touches[0]!;
      const b = e.touches[1]!;
      pinchDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      return;
    }
    if (pinchMode) return;
    if (onButton) {
      touchOnButton = true;
      return;
    }
    lookId = t.identifier;
    lastX = t.clientX;
    lastY = t.clientY;
  };
  const onLookMove = (e: TouchEvent): void => {
    if (pinchMode) {
      if (e.touches.length === 2) {
        const a = e.touches[0]!;
        const b = e.touches[1]!;
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinchDist !== null && dist !== pinchDist) {
          // Jari merapat = zoom in (kamera mendekat); menjauh = zoom out.
          if (zoomHandler !== null) zoomHandler(dist - pinchDist);
          pinchDist = dist;
        }
      }
      return;
    }
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== lookId) continue;
      camera.applyLook(t.clientX - lastX, t.clientY - lastY);
      lastX = t.clientX;
      lastY = t.clientY;
    }
  };
  const lookEnd = (e: TouchEvent): void => {
    // Semua jari lepas: reset penanda tombol & pinch.
    if (e.touches.length === 0) {
      touchOnButton = false;
      pinchMode = false;
      pinchDist = null;
      lookId = null;
      return;
    }
    if (pinchMode && e.touches.length < 2) {
      pinchMode = false;
      pinchDist = null;
      return;
    }
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === lookId) lookId = null;
    }
  };
  document.addEventListener('touchstart', onLookStart, { passive: false });
  document.addEventListener('touchmove', onLookMove, { passive: false });
  document.addEventListener('touchend', lookEnd);
  document.addEventListener('touchcancel', lookEnd);
  // ── Tombol keluar (kanan-atas) ────────────────────────────────────────
  const mkBtn = (
    label: string,
    bottom: string,
    right: string,
    top: string,
  ): HTMLDivElement => {
    const b = document.createElement('div');
    b.textContent = label;
    b.style.position = 'absolute';
    b.style.borderRadius = '50%';
    b.style.background = 'rgba(0,0,0,0.35)';
    b.style.color = 'white';
    b.style.display = 'flex';
    b.style.alignItems = 'center';
    b.style.justifyContent = 'center';
    if (top === '') {
      b.style.bottom = bottom;
      b.style.right = right;
      b.style.width = px(72);
      b.style.height = px(72);
      b.style.fontSize = px(22);
    } else {
      b.style.top = top;
      b.style.right = right;
      b.style.width = px(56);
      b.style.height = px(56);
      b.style.fontSize = px(26);
    }
    b.style.pointerEvents = 'auto';
    b.style.touchAction = 'none';
    // Penanda: handler look di level document mengabaikan sentuhan yang
    // diawali di elemen bertanda ini (tombol menangani sendiri).
    b.dataset.tcBtn = '';
    container.appendChild(b);
    return b;
  };

  // ── Menu (kanan-atas): tombol ☰ membuka panel exit/respawn ──────────
  const menuBtn = mkBtn('☰', '', px(16), px(16));
  menuBtn.style.zIndex = '30';

  const menuPanel = document.createElement('div');
  menuPanel.style.cssText =
    `position:absolute;top:${px(80)};right:${px(16)};display:none;flex-direction:column;gap:${px(10)};z-index:30;background:rgba(0,0,0,0.75);border-radius:${px(12)};padding:${px(12)};`;
  menuPanel.dataset.tcBtn = '';

  const mkMenuAction = (text: string, fn: () => void): HTMLDivElement => {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText =
      'padding:10px 18px;font-size:16px;color:white;background:rgba(255,255,255,0.12);border-radius:8px;cursor:pointer;text-align:center;pointer-events:auto;';
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      menuPanel.style.display = 'none';
      fn();
    });
    return el;
  };

  menuPanel.appendChild(mkMenuAction('Respawn', onRespawn));
  menuPanel.appendChild(mkMenuAction('Keluar', onExit));
  menuPanel.appendChild(mkMenuAction('Hapus semua world', onClearWorlds));

  // Setting kepekaan look: slider 0.2x..3x, tersimpan di localStorage.
  const sensRow = document.createElement('div');
  sensRow.style.cssText = 'display:flex;align-items:center;gap:8px;pointer-events:auto;';
  const sensLabel = document.createElement('span');
  sensLabel.textContent = 'Sensitivitas';
  sensLabel.style.cssText = 'font-size:14px;color:white;';
  const sensInput = document.createElement('input');
  sensInput.type = 'range';
  sensInput.min = '0.2';
  sensInput.max = '3';
  sensInput.step = '0.1';
  sensInput.value = String(loadSensitivity());
  sensInput.style.width = '120px';
  const sensValue = document.createElement('span');
  sensValue.textContent = sensInput.value + 'x';
  sensValue.style.cssText = 'font-size:14px;color:white;';
  sensInput.addEventListener('input', () => {
    const mult = Number(sensInput.value);
    sensValue.textContent = `${mult.toFixed(1)}x`;
    saveSensitivity(mult);
    onSensitivity(mult);
  });
  sensRow.appendChild(sensLabel);
  sensRow.appendChild(sensInput);
  sensRow.appendChild(sensValue);
  menuPanel.appendChild(sensRow);
  menuBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    menuPanel.style.display = menuPanel.style.display === 'none' ? 'flex' : 'none';
  });

  // ── Joystick ─────────────────────────────────────────────────────────
  const base = document.createElement('div');
  base.style.position = 'absolute';
  base.style.left = px(24);
  base.style.bottom = px(24);
  base.style.width = px(140);
  base.style.height = px(140);
  base.style.borderRadius = '50%';
  base.style.border = '2px solid rgba(255,255,255,0.5)';
  base.style.background = 'rgba(0,0,0,0.2)';
  base.style.pointerEvents = 'auto';
  // Joystick menangani dragnya sendiri; kecualikan dari handler look.
  base.dataset.tcBtn = '';
  const knob = document.createElement('div');
  knob.style.position = 'absolute';
  knob.style.left = '50%';
  knob.style.top = '50%';
  knob.style.transform = 'translate(-50%,-50%)';
  knob.style.width = px(60);
  knob.style.height = px(60);
  knob.style.borderRadius = '50%';
  knob.style.background = 'rgba(255,255,255,0.55)';
  base.appendChild(knob);

  const resetJoystick = (): void => {
    controls.move.x = 0;
    controls.move.z = 0;
    knob.style.transform = 'translate(-50%,-50%)';
  };

  let joyId: number | null = null;
  base.addEventListener('touchstart', (e) => {
    if (joyId === null) {
      const t = e.changedTouches[0];
      if (t) joyId = t.identifier;
    }
    e.preventDefault();
  });
  base.addEventListener('touchmove', (e) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== joyId) continue;
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = t.clientX - cx;
      let dy = t.clientY - cy;
      const len = Math.hypot(dx, dy);
      const max = JOYSTICK_RADIUS * scale;
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      // z negatif = maju; skala sesuai besarnya dorongan.
      controls.move.x = dx / max;
      controls.move.z = dy / max;
    }
    e.preventDefault();
  });
  const joyEnd = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === joyId) {
        joyId = null;
        resetJoystick();
      }
    }
  };
  base.addEventListener('touchend', joyEnd);
  base.addEventListener('touchcancel', joyEnd);
  container.appendChild(base);

  // ── Tombol aksi: tap = place, tahan = break (dengan repeat) ──────────
  const actionBtn = mkBtn('⛏/⬛', px(24), px(24), '');
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let repeatTimer: ReturnType<typeof setInterval> | null = null;
  let held = false;

  const stopAction = (): void => {
    if (holdTimer !== null) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (repeatTimer !== null) {
      clearInterval(repeatTimer);
      repeatTimer = null;
    }
  };

  actionBtn.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      held = false;
      // Tahan lama = break (repeat terus selama ditahan).
      holdTimer = setTimeout(() => {
        held = true;
        onAction(0); // break instan pertama
        repeatTimer = setInterval(() => onAction(0), REPEAT_MS);
      }, HOLD_MS);
    },
    { passive: false },
  );
  const actionEnd = (e: TouchEvent): void => {
    e.preventDefault();
    if (!held) {
      // Tap singkat = place.
      onAction(2);
    }
    held = false;
    stopAction();
  };
  actionBtn.addEventListener('touchend', actionEnd, { passive: false });
  actionBtn.addEventListener('touchcancel', () => {
    held = false;
    stopAction();
  });

  // Jump.
  const jumpBtn = mkBtn('⬆', px(110), px(110), '');
  jumpBtn.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      controls.jump = true;
      setTimeout(() => {
        controls.jump = false;
      }, 100);
    },
    { passive: false },
  );


  return controls;
}
