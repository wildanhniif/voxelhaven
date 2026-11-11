import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';

const SWING_DURATION = 0.2; // detik

// Base transform tangan (di kamera). Posisi & rotasi eksplisit sesuai spec.
const BASE_POS = new Vector3(0.35, -0.35, -0.5);
const BASE_ROT = new Vector3(-0.2, -0.4, 0.1);

export interface ViewModelHandle {
  /** Tambahkan ke object Camera sebagai child. */
  readonly group: Group;
  /** Picu animasi mukul (klik kiri/kanan). */
  swing(): void;
  /** delta dalam DETIK. */
  update(delta: number, moving: boolean): void;
  dispose(): void;
}

/**
 * Tangan FPP ala Minecraft: lengan kecil memanjang ke depan di pojok kanan
 * bawah, digantung sebagai child kamera (selalu ikut pandang).
 * material depthTest/depthWrite=false + renderOrder 999 menjamin selalu
 * digambar paling depan: tidak pernah tertutup/tembus blok 3D.
 */
export function createViewModel(): ViewModelHandle {
  const group = new Group();
  group.position.copy(BASE_POS);
  group.rotation.set(BASE_ROT.x, BASE_ROT.y, BASE_ROT.z);

  // Lengan: pivot di pangkal (belakang), box menjulur ke depan.
  const arm = new Mesh(
    new BoxGeometry(0.15, 0.15, 0.6),
    new MeshBasicMaterial({ color: 0xf5cba7, depthTest: false, depthWrite: false }),
  );
  arm.position.z = -0.3;
  arm.renderOrder = 999;
  group.add(arm);

  let elapsed = 0;
  let swingT = -1; // -1 = idle, 0..1 = sedang mukul

  return {
    group,
    swing() {
      swingT = 0;
    },
    update(delta, moving) {
      elapsed += delta;
      // Bobbing naik-turun halus saat jalan; sway kecil.
      const bob = moving ? Math.sin(elapsed * 8) : 0;
      group.position.y = BASE_POS.y + bob * 0.02;
      group.position.x = BASE_POS.x - bob * 0.01;

      if (swingT >= 0) {
        swingT += delta / SWING_DURATION;
        if (swingT > 1) swingT = -1;
      }
      // Mukul: ayunan mulus memanjang ke depan-turun (sin 0..1..0).
      const s = swingT < 0 ? 0 : Math.sin(swingT * Math.PI);
      group.rotation.x = BASE_ROT.x - s * 0.8;
      group.position.z = BASE_POS.z - s * 0.08;
    },
    dispose() {
      arm.geometry.dispose();
      (arm.material as MeshBasicMaterial).dispose();
    },
  };
}
