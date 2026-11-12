import type { TouchMove } from '../player/controller';

export interface TouchControls {
  move: TouchMove;
  jump: boolean;
  dispose(): void;
  /** Set handler pinch-zoom (delta px; positif = jari menjauh). */
  setZoomHandler(h: (deltaPx: number) => void): void;
}

const JOYSTICK_RADIUS = 60;
/** Tahan sekurang ini (ms) sebelum aksi dianggap "break" (bukan tap = place). */
const HOLD_MS = 250;
/** Interval repeat break saat tombol ditahan. */
const REPEAT_MS = 200;

/**
 * Kontrol sentuh untuk mobile: joystick kiri (gerak), drag area kanan (lihat),
 * pinch zoom (jarak kamera), tombol aksi (tap = place, tahan = break) +
 * jump + keluar. Tidak aktif di desktop (tanpa touch).
 */
export function createTouchControls(
  camera: { applyLook(dx: number, dy: number): void },
  onAction: (button: number) => void,
  onExit: () => void,
): TouchControls | null {
  // Deteksi sederhana: hanya pasang di perangkat dengan sentuhan.
  if (!('ontouchstart' in window)) return null;

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
      container.remove();
    },
    setZoomHandler(h) {
      zoomHandler = h;
    },
  };

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
      b.style.width = '72px';
      b.style.height = '72px';
      b.style.fontSize = '22px';
    } else {
      b.style.top = top;
      b.style.right = right;
      b.style.width = '56px';
      b.style.height = '56px';
      b.style.fontSize = '26px';
    }
    b.style.pointerEvents = 'auto';
    b.style.touchAction = 'none';
    container.appendChild(b);
    return b;
  };

  const exitBtn = mkBtn('⏻', '', '16px', '16px');
  // lookArea (top 55%) ditambah belakangan di DOM dan menutupi tombol ini
  // kalau z-index sama; angkat supaya sentuhan sampai ke tombol.
  exitBtn.style.zIndex = '30';
  exitBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onExit();
  });

  // ── Joystick ─────────────────────────────────────────────────────────
  const base = document.createElement('div');
  base.style.position = 'absolute';
  base.style.left = '24px';
  base.style.bottom = '24px';
  base.style.width = '140px';
  base.style.height = '140px';
  base.style.borderRadius = '50%';
  base.style.border = '2px solid rgba(255,255,255,0.5)';
  base.style.background = 'rgba(0,0,0,0.2)';
  base.style.pointerEvents = 'auto';
  base.style.touchAction = 'none';
  const knob = document.createElement('div');
  knob.style.position = 'absolute';
  knob.style.left = '50%';
  knob.style.top = '50%';
  knob.style.transform = 'translate(-50%,-50%)';
  knob.style.width = '60px';
  knob.style.height = '60px';
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
      const max = JOYSTICK_RADIUS;
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
  const actionBtn = mkBtn('⛏/⬛', '24px', '24px', '');
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
  const jumpBtn = mkBtn('⬆', '110px', '110px', '');
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

  // ── Area look + pinch zoom ────────────────────────────────────────────
  const lookArea = document.createElement('div');
  lookArea.style.position = 'absolute';
  lookArea.style.left = '0';
  lookArea.style.top = '0';
  lookArea.style.width = '100%';
  lookArea.style.height = '55%';
  lookArea.style.pointerEvents = 'auto';
  lookArea.style.touchAction = 'none';
  let lookId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let pinchDist: number | null = null;
  let pinchMode = false;

  lookArea.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length === 2) {
        pinchMode = true;
        lookId = null;
        const a = e.touches[0]!;
        const b = e.touches[1]!;
        pinchDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      } else if (e.touches.length === 1) {
        const t = e.changedTouches[0];
        if (t === undefined) return;
        lookId = t.identifier;
        lastX = t.clientX;
        lastY = t.clientY;
      }
    },
    { passive: false },
  );
  lookArea.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault();
      if (pinchMode && e.touches.length === 2) {
        const a = e.touches[0]!;
        const b = e.touches[1]!;
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinchDist !== null && dist !== pinchDist) {
          // Jari merapat = zoom in (kamera mendekat); menjauh = zoom out.
          if (zoomHandler !== null) zoomHandler(pinchDist - dist);
          pinchDist = dist;
        }
        return;
      }
      if (pinchMode) return;
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== lookId) continue;
        camera.applyLook(t.clientX - lastX, t.clientY - lastY);
        lastX = t.clientX;
        lastY = t.clientY;
      }
    },
    { passive: false },
  );
  const lookEnd = (e: TouchEvent): void => {
    if (pinchMode && e.touches.length < 2) {
      pinchMode = false;
      pinchDist = null;
      return;
    }
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === lookId) lookId = null;
    }
  };
  lookArea.addEventListener('touchend', lookEnd);
  lookArea.addEventListener('touchcancel', lookEnd);
  container.appendChild(lookArea);

  return controls;
}
