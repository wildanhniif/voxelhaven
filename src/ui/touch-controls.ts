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
 * Kontrol sentuh untuk mobile: joystick kiri (gerak), drag layar (lihat),
 * pinch zoom, tombol aksi (tap = place, tahan = break) + jump + menu.
 * Semua input memakai Pointer Events (satu model, andal di Android).
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
  container.style.touchAction = 'none';
  document.body.appendChild(container);

  let zoomHandler: ((deltaPx: number) => void) | null = null;

  // ── Look + pinch di level document ───────────────────────────────────
  // Klasifikasi per pointer: pointer di atas tombol/joystick (bertanda
  // data-tc-btn) tidak ikut look. Look mendukung beberapa jari; pinch
  // aktif hanya saat tepat dua pointer look aktif (Growtopia-style:
  // pegang joystick sambil geser kamera).
  const lookPts = new Map<number, { x: number; y: number }>();
  // Semua pointer yang sedang aktif di layar (termasuk di atas tombol):
  // pembanding untuk membuang pointer hantu dari lookPts.
  const livePointers = new Set<number>();
  let pinchDist: number | null = null;

  const isButton = (el: EventTarget | null): boolean =>
    el instanceof Element && el.closest('[data-tc-btn]') !== null;

  const pinchLen = (): number => {
    const pts = Array.from(lookPts.values());
    if (pts.length < 2) return 0;
    const [a, b] = [pts[0]!, pts[1]!];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (e: PointerEvent): void => {
    livePointers.add(e.pointerId);
    if (isButton(e.target)) return;
    lookPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (lookPts.size === 2) pinchDist = pinchLen();
  };

  const onPointerMove = (e: PointerEvent): void => {
    // Buang pointer hantu (up-nya tertelan) sebelum proses move.
    // pinchDist TIDAK di-reset di sini supaya pinch aktif tetap jalan;
    // kalau pointer benar-benar hilang, size < 2 otomatis melumpuhkan
    // cabang pinch di bawah.
    syncLivePointers();
    // Toast overlay Android (kursor/aksesibilitas) menelan pointerup:
    // pointer masih tercatat tapi tombolnya sudah lepas (buttons===0).
    // Begitu terdeteksi lewat move berikutnya, buang.
    const p = lookPts.get(e.pointerId);
    if (p === undefined) return;
    if ((e.buttons & 1) === 0) {
      lookPts.delete(e.pointerId);
      livePointers.delete(e.pointerId);
      pinchDist = null;
      return;
    }
    if (lookPts.size === 2) {
      if (pinchDist === null) pinchDist = pinchLen();
      p.x = e.clientX;
      p.y = e.clientY;
      const dist = pinchLen();
      // Jari merapat = zoom out (menjauh); menjauh = zoom in (mendekat).
      if (dist !== pinchDist) {
        if (zoomHandler !== null) zoomHandler(pinchDist - dist);
        pinchDist = dist;
      }
      return;
    }
    camera.applyLook(e.clientX - p.x, e.clientY - p.y);
    p.x = e.clientX;
    p.y = e.clientY;
  };

  const onPointerUp = (e: PointerEvent): void => {
    // Selalu hapus pointer dari daftar look, termasuk pointer yang
    // menimpa tombol/joystick (pointerdown-nya tidak tercatat, tapi
    // delete id yang tidak ada tidak berefek). Tanpa ini, pointer
    // "hantu" menumpuk dan lookPts.size===2 membekukan kamera.
    lookPts.delete(e.pointerId);
    livePointers.delete(e.pointerId);
    pinchDist = null;
  };

  const syncLivePointers = (): void => {
    // Bersihkan pointer yang sudah tidak ada (mis. palm reject, sistem
    // menelan event up). Tidak menyentuh pinchDist: hanya meaningful
    // saat size===2, dan onPointerUp/releaseAll sudah me-reset-nya.
    for (const id of lookPts.keys()) {
      if (!livePointers.has(id)) lookPts.delete(id);
    }
  };
  const releaseAll = (): void => {
    // App ke-blur/hidden (notifikasi, multitask) atau toggle menu:
    // browser kadang tidak kirim pointerup. Reset total supaya tidak
    // ada pointer hantu — termasuk joyId, kalau tidak joystick macet
    // ke arah terakhir (control move tidak pernah nol).
    lookPts.clear();
    livePointers.clear();
    pinchDist = null;
    joyId = null;
    resetJoystick();
  };

  // pointermove di document: jari di atas tombol/joystick TIDAK masuk
  // lookPts (pointerdown-nya difilter), tapi pointermove-nya tetap
  // lewat di sini. syncLivePointers membuang pointer yang up/cancel-nya
  // tertelan (mis. panel menu muncul, notifikasi Android, swipe sistem).
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('blur', releaseAll);
  // visibilitychange WAJIB: buka menu / panel sistem sering memicu
  // pointercancel tanpa pointerup; tanpa reset, pointer hantu menumpuk
  // dan lookPts.size===2 membekukan kamera.
  document.addEventListener('visibilitychange', releaseAll);

  const controls: TouchControls = {
    move: { x: 0, z: 0 },
    jump: false,
    dispose() {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('blur', releaseAll);
      document.removeEventListener('visibilitychange', releaseAll);
      container.remove();
    },
    setZoomHandler(h) {
      zoomHandler = h;
    },
  };

  // ── Pabrik tombol bundar ─────────────────────────────────────────────
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
    // Penanda: handler look di document mengecualikan tombol ini.
    b.dataset.tcBtn = '';
    b.style.zIndex = '20';
    container.appendChild(b);
    return b;
  };

  // ── Menu (kanan-atas): tombol ☰ membuka panel exit/respawn ──────────
  const menuBtn = mkBtn('☰', '', px(16), px(16));
  menuBtn.style.zIndex = '30';

  const menuPanel = document.createElement('div');
  menuPanel.style.cssText =
    `position:absolute;top:${px(80)};right:${px(16)};display:none;flex-direction:column;gap:${px(10)};z-index:30;background:rgba(0,0,0,0.75);border-radius:${px(12)};padding:${px(12)};`;

  const mkMenuAction = (text: string, fn: () => void): HTMLDivElement => {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText =
      'padding:10px 18px;font-size:16px;color:white;background:rgba(255,255,255,0.12);border-radius:8px;cursor:pointer;text-align:center;pointer-events:auto;';
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      menuPanel.style.display = 'none';
      fn();
    });
    return el;
  };

  menuPanel.appendChild(mkMenuAction('Respawn', onRespawn));
  menuPanel.appendChild(mkMenuAction('Keluar', onExit));
  menuPanel.appendChild(mkMenuAction('Hapus semua world', onClearWorlds));
  menuPanel.dataset.tcBtn = '';

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

  menuBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const akanBuka = menuPanel.style.display === 'none';
    menuPanel.style.display = akanBuka ? 'flex' : 'none';
    // Reset total pointer: buka/tutup panel sering menelan pointerup
    // (jari masih di atas tombol saat panel berubah), sehingga pointer
    // hantu tertinggal di lookPts dan kamera beku + joystick macet.
    releaseAll();
  });

  // Klik/tap di luar panel menutup panel, sama seperti tombol ☰.
  // Dipasang di document dengan fase capture agar tidak bisa di-stop
  // oleh elemen lain. Panel terbuka = bukan klik di dalam panel.
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (menuPanel.style.display === 'none') return;
      if (e.target instanceof Element && e.target.closest('[data-tc-btn]') !== null) return;
      menuPanel.style.display = 'none';
      releaseAll();
    },
    true,
  );
  container.appendChild(menuPanel);

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
  base.style.touchAction = 'none';
  base.dataset.tcBtn = '';
  base.style.zIndex = '20';
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
  base.addEventListener('pointerdown', (e) => {
    if (joyId === null) joyId = e.pointerId;
  });
  window.addEventListener('pointermove', (e) => {
    // Listen di window: jari sering keluar dari area base saat menggerakkan
    // knob; jika hanya listen di base, gerakan terpotong dan joystick
    // terasa "nyangkut" ke arah terakhir.
    if (e.pointerId !== joyId) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
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
  });
  const joyEnd = (e: PointerEvent): void => {
    if (e.pointerId === joyId) {
      joyId = null;
      resetJoystick();
    }
  };
  // Release di window: jari bisa lepas di luar base.
  window.addEventListener('pointerup', joyEnd);
  window.addEventListener('pointercancel', joyEnd);
  container.appendChild(base);

  // ── Tombol aksi: tap = place, tahan = break (dengan repeat) ──────────
  const actionBtn = mkBtn('⛏/⬛', px(24), px(24), '');
  let holdTimer: number | null = null;
  let repeatTimer: number | null = null;
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

  actionBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    held = false;
    // Tahan lama = break (repeat terus selama ditahan).
    holdTimer = setTimeout(() => {
      held = true;
      onAction(0); // break instan pertama
      repeatTimer = setInterval(() => onAction(0), REPEAT_MS);
    }, HOLD_MS);
  });
  const actionEnd = (e: PointerEvent): void => {
    e.stopPropagation();
    if (!held) {
      // Tap singkat = place.
      onAction(2);
    }
    held = false;
    stopAction();
  };
  actionBtn.addEventListener('pointerup', actionEnd);
  actionBtn.addEventListener('pointercancel', () => {
    held = false;
    stopAction();
  });

  // Jump.
  const jumpBtn = mkBtn('⬆', px(110), px(110), '');
  jumpBtn.addEventListener(
    'pointerdown',
    (e) => {
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
