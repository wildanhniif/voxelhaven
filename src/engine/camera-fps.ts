import { Euler, MathUtils, PerspectiveCamera } from 'three';
import type { BlockSource } from '../world/voxel';

const MAX_PITCH = MathUtils.degToRad(89);
const SENSITIVITY = 0.0022;

/** Jarak default kamera TPP di belakang player (blok). */
export const TPP_DISTANCE = 4;
const TPP_STEP = 0.1;
const TPP_MARGIN = 0.2;

export type CameraMode = 'FPP' | 'TPP' | 'TPP_FRONT';

/**
 * Jarak aman kamera TPP: jarak bebas-tabrak dari mata player ke arah
 * mundur kamera. Pure supaya bisa di-unit test tanpa Three.js.
 */
export function tppCameraDistance(
  eye: readonly [number, number, number],
  back: readonly [number, number, number],
  world: BlockSource,
  maxDistance = TPP_DISTANCE,
): number {
  for (let d = TPP_STEP; d <= maxDistance; d += TPP_STEP) {
    const x = Math.floor(eye[0] + back[0] * d);
    const y = Math.floor(eye[1] + back[1] * d);
    const z = Math.floor(eye[2] + back[2] * d);
    if (world.getBlock([x, y, z]) !== 0) return Math.max(0, d - TPP_MARGIN);
  }
  return maxDistance;
}

export interface FpsCameraHandle {
  readonly camera: PerspectiveCamera;
  readonly yaw: number;
  readonly pitch: number;
  readonly isLocked: boolean;
  readonly mode: CameraMode;
  dispose(): void;
}
/**
 * Kamera FPS: yaw/pitch dari mouse saat pointer lock aktif.
 * Klik canvas untuk lock, ESC (browser) untuk lepas.
 * F5 = toggle FPP/TPP.
 */
export function createFpsCamera(camera: PerspectiveCamera, domElement: HTMLElement): FpsCameraHandle {
  let mode: CameraMode = 'FPP';
  let yaw = 0;
  let pitch = 0;

  const onKey = (event: KeyboardEvent): void => {
    if (event.code !== 'F5') return;
    // F5 default = refresh; kita pakai untuk ganti kamera.
    event.preventDefault();
    // FPP -> TPP belakang -> TPP depan (lihat muka) -> FPP.
    mode = mode === 'FPP' ? 'TPP' : mode === 'TPP' ? 'TPP_FRONT' : 'FPP';
    applyRotation();
  };
  const applyRotation = (): void => {
    // TPP_FRONT: kamera di depan player dan harus melihat ke arah player,
    // jadi arah pandang dibalik (yaw+180°, pitch terbalik).
    if (mode === 'TPP_FRONT') {
      camera.rotation.copy(new Euler(-pitch, yaw + Math.PI, 0, 'YXZ'));
    } else {
      camera.rotation.copy(new Euler(pitch, yaw, 0, 'YXZ'));
    }
  }

  const onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== domElement) return;
    yaw -= event.movementX * SENSITIVITY;
    pitch = MathUtils.clamp(pitch - event.movementY * SENSITIVITY, -MAX_PITCH, MAX_PITCH);
    applyRotation();
  };

  const onClick = (): void => {
    if (document.pointerLockElement !== domElement) {
      void domElement.requestPointerLock();
    }
  };

  const onLockChange = (): void => {
    // Tidak ada aksi tambahan; listener cukup agar state lock konsisten.
  };

  domElement.addEventListener('click', onClick);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onLockChange);
  window.addEventListener('keydown', onKey);
  applyRotation();


  return {
    camera,
    get yaw() {
      return yaw;
    },
    get pitch() {
      return pitch;
    },
    get isLocked() {
      return document.pointerLockElement === domElement;
    },
    get mode() {
      return mode;
    },
    dispose() {
      domElement.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerlockchange', onLockChange);
    },
  };
}
