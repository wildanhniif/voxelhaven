import type { TouchMove } from '../player/controller';

export interface TouchControls {
  move: TouchMove;
  jump: boolean;
  dispose(): void;
}

const JOYSTICK_RADIUS = 60;

/**
 * Kontrol sentuh untuk mobile: joystick kiri (gerak), drag di area kanan
 * (lihat), tombol jump + break + place. Tidak aktif di desktop (tanpa touch).
 */
export function createTouchControls(
  camera: { applyLook(dx: number, dy: number): void },
  onAction: (button: number) => void,
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

  const controls: TouchControls = {
    move: { x: 0, z: 0 },
    jump: false,
    dispose() {
      container.remove();
    },
  };

  // Joystick: base + knob.
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

  // Jump, break, place: tombol bulat kanan-bawah.
  const mkBtn = (label: string, bottom: string, right: string, cb: () => void): void => {
    const b = document.createElement('div');
    b.textContent = label;
    b.style.position = 'absolute';
    b.style.bottom = bottom;
    b.style.right = right;
    b.style.width = '72px';
    b.style.height = '72px';
    b.style.borderRadius = '50%';
    b.style.background = 'rgba(0,0,0,0.35)';
    b.style.color = 'white';
    b.style.display = 'flex';
    b.style.alignItems = 'center';
    b.style.justifyContent = 'center';
    b.style.fontSize = '22px';
    b.style.pointerEvents = 'auto';
    b.style.touchAction = 'none';
    b.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cb();
    });
    container.appendChild(b);
  };

  mkBtn('⬆', '24px', '110px', () => {
    controls.jump = true;
    setTimeout(() => {
      controls.jump = false;
    }, 100);
  });
  mkBtn('⛏', '110px', '24px', () => onAction(0)); // break = tombol kiri mouse
  mkBtn('⬛', '24px', '24px', () => onAction(2)); // place = tombol kanan mouse

  // Drag untuk melihat: area kanan atas (bukan joystick, bukan tombol).
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
  lookArea.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    if (t === undefined) return;
    lookId = t.identifier;
    lastX = t.clientX;
    lastY = t.clientY;
  });
  lookArea.addEventListener('touchmove', (e) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== lookId) continue;
      camera.applyLook(t.clientX - lastX, t.clientY - lastY);
      lastX = t.clientX;
      lastY = t.clientY;
    }
    e.preventDefault();
  });
  const lookEnd = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === lookId) lookId = null;
    }
  };
  lookArea.addEventListener('touchend', lookEnd);
  lookArea.addEventListener('touchcancel', lookEnd);
  container.appendChild(lookArea);

  return controls;
}
