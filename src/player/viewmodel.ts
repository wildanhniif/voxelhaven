import {
  BoxGeometry,
  Group,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three';

const SWING_DURATION = 0.2; // detik
const BASE_POS = new Vector3(0.42, -0.38, -0.75);
const BASE_ROT = new Vector3(
  (-15 * Math.PI) / 180,
  (15 * Math.PI) / 180,
  (-15 * Math.PI) / 180,
);

export interface ViewModelHandle {
  /** Masukkan ke scene viewmodel (bukan scene world) + render dengan vmCamera. */
  readonly group: Group;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** Picu animasi mukul (klik kiri/kanan). */
  swing(): void;
  /** delta dalam DETIK. */
  update(delta: number, moving: boolean): void;
  dispose(): void;
}

/**
 * Tangan FPP ala Minecraft: lengan kecil proporsional di pojok kanan bawah.
 * Live di scene terpisah yang dirender setelah world (clear depth), jadi
 * tidak pernah tembus ke dalam blok saat player nempel dinding.
 */
export function createViewModel(): ViewModelHandle {
  const scene = new Scene();
  const camera = new PerspectiveCamera(70, 1, 0.01, 10);
  const group = new Group();
  scene.add(group);
  scene.add(new HemisphereLight(0xffffff, 0x666666, 1.2));
  group.position.copy(BASE_POS);
  group.rotation.set(BASE_ROT.x, BASE_ROT.y, BASE_ROT.z);

  const skin = new MeshLambertMaterial({ color: 0xd7a558 });

  // Lengan: pivot di ujung belakang (bahu), mesh menjulur ke depan.
  const pivot = new Group();
  const arm = new Mesh(new BoxGeometry(0.24, 0.24, 0.55), skin);
  arm.position.z = -0.275;
  pivot.add(arm);

  // Blok kecil yang "dipegang" di ujung lengan.
  const held = new Mesh(new BoxGeometry(0.15, 0.15, 0.15), new MeshLambertMaterial({ color: 0x6b6b6e }));
  held.position.set(0, 0.05, -0.55);
  held.rotation.set(0.3, 0.6, 0);
  pivot.add(held);
  group.add(pivot);

  let elapsed = 0;
  let swingT = -1; // -1 = idle, 0..1 = sedang mukul

  return {
    group,
    scene,
    camera,
    swing() {
      swingT = 0;
    },
    update(delta, moving) {
      elapsed += delta;
      // Bobbing pelan mengikuti langkah; sway halus.
      const bob = moving ? Math.sin(elapsed * 8) : 0;
      group.position.y = BASE_POS.y + bob * 0.02;
      group.position.x = BASE_POS.x - bob * 0.008;

      if (swingT >= 0) {
        swingT += delta / SWING_DURATION;
        if (swingT > 1) swingT = -1;
      }
      // Mukul: kurva sinus halus 0..1..0, ujung lengan chop turun + maju sedikit.
      const s = swingT < 0 ? 0 : Math.sin(swingT * Math.PI);
      pivot.rotation.x = -s * 0.9;
      pivot.position.z = -s * 0.1;
    },
    dispose() {
      arm.geometry.dispose();
      held.geometry.dispose();
      skin.dispose();
      (held.material as MeshLambertMaterial).dispose();
    },
  };
}
