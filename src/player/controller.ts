import type { PerspectiveCamera } from 'three';
import { JUMP_SPEED, WALK_SPEED } from './constants';
import type { PlayerBody } from './collision';

export const EYE_HEIGHT = 1.62;

interface Keys {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
}

/** Arah gerak dari joystick virtual: -1..1, dipakai kalau isLocked false. */
export interface TouchMove {
  x: number;
  z: number;
}

const KEY_MAP: Readonly<Record<string, keyof Keys>> = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'jump',
};

/**
 * Input WASD + Space saat pointer lock; joystick virtual (touch) aktif tanpa
 * pointer lock karena mobile tidak punya Pointer Lock API.
 * Menggerakkan body dan menempelkan kamera ke mata player.
 */
export function createController(
  camera: PerspectiveCamera,
  body: PlayerBody,
  isLocked: () => boolean,
  touch?: { move: TouchMove; jump: boolean },
): { update: () => void; dispose: () => void } {
  const keys: Keys = { forward: false, back: false, left: false, right: false, jump: false };

  const setKey = (e: KeyboardEvent, down: boolean): void => {
    const key = KEY_MAP[e.code];
    if (key === undefined) return;
    if (e.code === 'Space') e.preventDefault();
    keys[key] = down;
  };

  const onKeyDown = (e: KeyboardEvent): void => setKey(e, true);
  const onKeyUp = (e: KeyboardEvent): void => setKey(e, false);
  const syncCamera = (): void => {
    camera.position.set(body.x, body.y + EYE_HEIGHT, body.z);
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  syncCamera();

  return {
    update() {
      const locked = isLocked();
      let dx = 0;
      let dz = 0;
      if (locked) {
        if (keys.forward) dz -= 1;
        if (keys.back) dz += 1;
        if (keys.left) dx -= 1;
        if (keys.right) dx += 1;
      }
      // Joystick virtual: z negatif = maju, selalu aktif (tanpa pointer lock).
      if (touch !== undefined) {
        dx += touch.move.x;
        dz += touch.move.z;
      }
      const jump = (locked && keys.jump) || touch?.jump === true;
      const yaw = camera.rotation.y;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      const len = Math.hypot(dx, dz);
      if (len > 0) {
        // Forward kamera di yaw: (-sin, -cos); kanan: (cos, -sin).
        // Joystick analog: dorongan dinormalkan ke 1 lalu diskala besarnya
        // (max 1) supaya setengah dorongan = setengah kecepatan.
        const speed = WALK_SPEED * Math.min(len, 1);
        body.vx = ((dx * cos + dz * sin) / len) * speed;
        body.vz = ((dz * cos - dx * sin) / len) * speed;
      } else {
        body.vx = 0;
        body.vz = 0;
      }

      if (jump && body.onGround) {
        body.vy = JUMP_SPEED;
        body.onGround = false;
      }

      syncCamera();
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
}
