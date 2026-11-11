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
  /** Yaw render kamera (termasuk offset orbit TPP). */
  readonly viewYaw: number;
  /** Pitch render kamera (termasuk offset orbit TPP). */
  readonly viewPitch: number;
  readonly pitch: number;
  readonly isLocked: boolean;
  readonly mode: CameraMode;
  /** Putar kamera dari delta px layar; touch drag memakai ini. */
  applyLook(dx: number, dy: number): void;
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
  // Orbit TPP: offset dari yaw/pitch player, bisa diputar 360° penuh
  // supaya player bisa dilihat dari sudut mana pun tanpa memutar badannya.
  const ORBIT_MAX_PITCH = MathUtils.degToRad(85);
  let orbitYaw = 0;
  let orbitPitch = 0;

  const onKey = (event: KeyboardEvent): void => {
    if (event.code !== 'F5') return;
    // F5 default = refresh; kita pakai untuk ganti kamera.
    event.preventDefault();
    // FPP -> TPP belakang -> TPP depan (lihat muka) -> FPP.
    mode = mode === 'FPP' ? 'TPP' : mode === 'TPP' ? 'TPP_FRONT' : 'FPP';
    orbitYaw = 0;
    orbitPitch = 0;
    applyRotation();
  };

  /**
   * Sudut kamera untuk render. FPP mengikuti player. TPP: player tetap
   * menghadap yaw-nya, kamera mengorbit. TPP_FRONT menghadap balik.
   */
  const viewAngles = (): { y: number; p: number } => {
    if (mode === 'FPP') return { y: yaw, p: pitch };
    const front = mode === 'TPP_FRONT' ? Math.PI : 0;
    return {
      y: yaw + orbitYaw + front,
      p: mode === 'TPP_FRONT' ? -pitch : pitch + orbitPitch,
    };
  };

  const applyRotation = (): void => {
    const a = viewAngles();
    camera.rotation.copy(new Euler(a.p, a.y, 0, 'YXZ'));
  };

  /**
   * Putar kamera dari delta layar (px). Dipakai mouse (movementX/Y) dan
   * drag sentuh. TPP memutar orbit, FPP memutar badan player.
   */
  const applyLook = (dx: number, dy: number): void => {
    if (mode === 'FPP') {
      yaw -= dx * SENSITIVITY;
      pitch = MathUtils.clamp(pitch - dy * SENSITIVITY, -MAX_PITCH, MAX_PITCH);
    } else {
      orbitYaw -= dx * SENSITIVITY;
      orbitPitch = MathUtils.clamp(orbitPitch - dy * SENSITIVITY, -ORBIT_MAX_PITCH, ORBIT_MAX_PITCH);
    }
    applyRotation();
  };

  const onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== domElement) return;
    applyLook(event.movementX, event.movementY);
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
    get viewYaw() {
      return viewAngles().y;
    },
    get viewPitch() {
      return viewAngles().p;
    },
    get mode() {
      return mode;
    },
    applyLook,
    dispose() {
      domElement.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerlockchange', onLockChange);
    },
  };
}
