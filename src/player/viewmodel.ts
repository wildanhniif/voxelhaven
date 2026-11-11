import { BoxGeometry, Group, Mesh, MeshLambertMaterial } from 'three';

const SWING_DURATION = 0.25; // detik
const BASE_Y = -0.3;

export interface ViewModelHandle {
  /** Ditambahkan sebagai child kamera (scene.add(camera) di caller). */
  readonly group: Group;
  /** Picu animasi ayun (klik kiri/kanan). */
  swing(): void;
  /** delta dalam DETIK (konsisten dengan unit animasi). */
  update(delta: number, moving: boolean): void;
  dispose(): void;
}

/**
 * Tangan FPP sederhana di pojok kanan bawah layar.
 * Idle bobbing saat player bergerak; swing saat aksi blok.
 */
export function createViewModel(): ViewModelHandle {
  const group = new Group();
  const arm = new Mesh(
    new BoxGeometry(0.25, 0.25, 0.7),
    new MeshLambertMaterial({ color: 0xd7a558 }),
  );
  const baseRot = -0.15;
  arm.rotation.set(baseRot, 0, 0);
  group.add(arm);
  group.position.set(0.35, BASE_Y, -0.5);
  group.rotation.set(0, -0.2, 0);

  let elapsed = 0;
  let swingT = -1; // -1 = idle, 0..1 = sedang mengayun

  return {
    group,
    swing() {
      swingT = 0;
    },
    update(delta, moving) {
      elapsed += delta;
      const bobY = moving ? Math.sin(elapsed * 8) * 0.015 : 0;
      group.position.y = BASE_Y + bobY;
      if (swingT >= 0) {
        swingT += delta / SWING_DURATION;
        if (swingT > 1) swingT = -1;
      }
      const swing = swingT < 0 ? 0 : Math.sin(swingT * Math.PI);
      arm.rotation.x = baseRot - swing * 0.8;
    },
    dispose() {
      arm.geometry.dispose();
      (arm.material as MeshLambertMaterial).dispose();
    },
  };
}
