import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
} from 'three';

const SWING_DURATION = 0.22; // detik
/** Pose dasar lengan FPP (relatif kamera): kanan bawah, sedikit ke depan. */
const BASE_POS_X = 0.3;
const BASE_POS_Y = -0.3;
const BASE_POS_Z = -0.55;
/** Geser seluruh pasangan lengan secara horizontal (negatif = ke kiri). */
const GROUP_OFFSET_X = -0.06;

export interface FirstPersonArmsHandle {
  /** Child dari camera. */
  readonly group: Group;
  swing(): void;
  /** delta DETIK; pitch = rotasi kamera X (radian). */
  update(delta: number, moving: boolean, pitch: number, yaw: number): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

function armMesh(color: number): Mesh {
  return new Mesh(
    new BoxGeometry(0.14, 0.14, 0.5),
    new MeshBasicMaterial({ color, depthTest: false, depthWrite: false }),
  );
}

/**
 * Lengan FPP pengganti badan: dua kotak kecil di pojok bawah layar yang ikut
 * pitch kamera. Dipakai karena kamera FPP ada DI DALAM kepala model, jadi
 * badan atas (kerah/bahu) tidak boleh dirender (tampak seperti tembok).
 */
export function createFirstPersonArms(): FirstPersonArmsHandle {
  const group = new Group();
  group.position.x = GROUP_OFFSET_X;

  const skin = 0xd7a558;
  const shirt = 0x2b6cd4;

  function buildArm(side: 1 | -1): Group {
    const pivot = new Group();
    // Sleeve (dekat kamera) + tangan (ujung jauh).
    const sleeve = armMesh(shirt);
    sleeve.scale.set(1.15, 1.15, 0.45);
    sleeve.position.z = -0.08;
    const hand = armMesh(skin);
    hand.position.z = -0.36;
    pivot.add(sleeve, hand);
    pivot.rotation.y = side * 0.22;
    pivot.position.set(side * BASE_POS_X, BASE_POS_Y, BASE_POS_Z);
    pivot.renderOrder = 999;
    sleeve.renderOrder = 999;
    hand.renderOrder = 999;
    return pivot;
  }

  const armR = buildArm(1);
  const armL = buildArm(-1);
  group.add(armR, armL);

  let elapsed = 0;
  let swingT = -1;

  return {
    group,
    swing() {
      swingT = 0;
    },
    update(delta, moving, pitch, yaw) {
      elapsed += delta;
      const bob = moving ? Math.sin(elapsed * 8) : 0;

      // Pitch kamera menggerakkan lengan naik/turun sepanjang layar.
      const lift = pitch * 0.35;
      armR.position.y = BASE_POS_Y + bob * 0.02 + lift;
      armL.position.y = BASE_POS_Y + bob * 0.02 + lift;
      // Yaw menggeser sedikit: lengan ikut rotasi badan.
      armR.position.x = BASE_POS_X - bob * 0.01 + yaw * 0.02;
      armL.position.x = -BASE_POS_X - bob * 0.01 + yaw * 0.02;

      if (swingT >= 0) {
        swingT += delta / SWING_DURATION;
        if (swingT > 1) swingT = -1;
      }
      const s = swingT < 0 ? 0 : Math.sin(swingT * Math.PI);
      armR.rotation.x = -s * 0.9;
      armR.position.z = BASE_POS_Z - s * 0.1;
    },
    setVisible(visible) {
      group.visible = visible;
    },
    dispose() {
      group.traverse((obj: Object3D) => {
        const mesh = obj as Mesh;
        if (!mesh.geometry) return;
        mesh.geometry.dispose();
        const mat = mesh.material as MeshBasicMaterial;
        mat.dispose();
      });
    },
  };
}
