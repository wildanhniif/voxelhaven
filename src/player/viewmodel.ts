import { BoxGeometry, Group, Mesh, MeshLambertMaterial, Vector3 } from 'three';

const SWING_DURATION = 0.25; // detik
const BASE_POS = new Vector3(0.35, -0.3, -0.5);

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
 * Tangan FPP di pojok kanan bawah layar.
 * Mesh lengan digeser supaya pivot rotasi di ujung belakang (bahu),
 * bukan di tengah kotak, biar ayunannya kayak siku, bukan patah.
 */
export function createViewModel(): ViewModelHandle {
  const group = new Group();
  group.position.copy(BASE_POS);
  group.rotation.set(0, -0.2, 0);

  const pivot = new Group();
  const arm = new Mesh(
    new BoxGeometry(0.22, 0.22, 0.6),
    new MeshLambertMaterial({ color: 0xd7a558 }),
  );
  arm.position.z = -0.3; // lengan menjulur ke depan dari pivot
  pivot.add(arm);
  pivot.rotation.x = -0.15;
  group.add(pivot);

  let elapsed = 0;
  let swingT = -1; // -1 = idle, 0..1 = sedang mengayun

  return {
    group,
    swing() {
      swingT = 0;
    },
    update(delta, moving) {
      elapsed += delta;
      const bob = Math.sin(elapsed * 8);
      group.position.y = BASE_POS.y + (moving ? bob * 0.015 : 0);
      group.position.x = BASE_POS.x + (moving ? Math.cos(elapsed * 4) * 0.01 : 0);
      if (swingT >= 0) {
        swingT += delta / SWING_DURATION;
        if (swingT > 1) swingT = -1;
      }
      const swing = swingT < 0 ? 0 : Math.sin(swingT * Math.PI);
      pivot.rotation.x = -0.15 - swing * 0.8;
    },
    dispose() {
      arm.geometry.dispose();
      (arm.material as MeshLambertMaterial).dispose();
    },
  };
}
