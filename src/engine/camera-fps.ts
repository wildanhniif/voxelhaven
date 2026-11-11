import { Euler, MathUtils, PerspectiveCamera } from 'three';

const MAX_PITCH = MathUtils.degToRad(89);
const SENSITIVITY = 0.0022;

export interface FpsCameraHandle {
  readonly camera: PerspectiveCamera;
  readonly yaw: number;
  readonly pitch: number;
  readonly isLocked: boolean;
  dispose(): void;
}

/**
 * Kamera FPS: yaw/pitch dari mouse saat pointer lock aktif.
 * Klik canvas untuk lock, ESC (browser) untuk lepas.
 */
export function createFpsCamera(camera: PerspectiveCamera, domElement: HTMLElement): FpsCameraHandle {
  let yaw = 0;
  let pitch = 0;

  const applyRotation = (): void => {
    camera.rotation.copy(new Euler(pitch, yaw, 0, 'YXZ'));
  };

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
    dispose() {
      domElement.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onLockChange);
    },
  };
}
