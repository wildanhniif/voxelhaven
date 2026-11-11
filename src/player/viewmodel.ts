import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';

const SWING_DURATION = 0.2; // detik

// Pose tangan dihitung terhadap frustum kamera (FOV 70°, near 0.1):
// batas bawah layar di z=-0.5 adalah y=-0.35, jadi pangkal lengan harus
// DI ATAS -0.35 supaya tidak terpotong tepi layar.
// Yaw positif memutar ujung lengan ke TENGAH layar (bukan ke kanan).
const BASE_POS = new Vector3(0.28, -0.22, -0.5);
const BASE_ROT = new Vector3(-0.1, 0.55, 0.25);

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
 * Tangan FPP ala Minecraft: lengan memanjang dari pojok kanan-bawah ke arah
 * tengah layar. Child kamera; depthTest/depthWrite=false + renderOrder 999
 * menjamin selalu digambar paling depan (tidak tembus/tertutup blok).
 */
export function createViewModel(): ViewModelHandle {
  const group = new Group();
  group.position.copy(BASE_POS);
  group.rotation.set(BASE_ROT.x, BASE_ROT.y, BASE_ROT.z);

  // Lengan: pivot di pangkal, box menjulur ke depan (lokal -Z).
  const arm = new Mesh(
    new BoxGeometry(0.15, 0.15, 0.55),
    new MeshBasicMaterial({ color: 0xf5cba7, depthTest: false, depthWrite: false }),
  );
  arm.position.z = -0.275;
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
      // Bobbing naik-turun halus saat jalan.
      const bob = moving ? Math.sin(elapsed * 8) : 0;
      group.position.y = BASE_POS.y + bob * 0.015;
      group.position.x = BASE_POS.x - bob * 0.008;

      if (swingT >= 0) {
        swingT += delta / SWING_DURATION;
        if (swingT > 1) swingT = -1;
      }
      // Mukul: ujung lengan chop turun-ke depan (sinus mulus 0..1..0).
      const s = swingT < 0 ? 0 : Math.sin(swingT * Math.PI);
      group.rotation.x = BASE_ROT.x - s * 0.7;
      group.rotation.z = BASE_ROT.z + s * 0.15;
    },
    dispose() {
      arm.geometry.dispose();
      (arm.material as MeshBasicMaterial).dispose();
    },
  };
}
