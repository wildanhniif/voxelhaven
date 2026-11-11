import { blockBoxGeometry } from '../world/mesher';
import { atlasTexture } from '../world/texture-atlas';
import type { VoxelType } from '../world/voxel';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, Object3D } from 'three';

const SWING_DURATION = 0.22; // detik
/** Pose dasar lengan FPP (relatif kamera): kanan bawah, sedikit ke depan. */
const BASE_POS_X = 0.55;
const BASE_POS_Y = -0.3;
const BASE_POS_Z = -0.55;
/** Geser seluruh pasangan lengan secara horizontal (negatif = ke kiri). */
const GROUP_OFFSET_X = -0.06;

export interface FirstPersonArmsHandle {
  /** Child dari camera. */
  readonly group: Group;
  /** Set blok yang dipegang di ujung tangan kanan (null = genggaman kosong). */
  setHeldType(type: VoxelType | null): void;
  swing(): void;
  /**
   * delta DETIK; pitch = rotasi kamera X (radian).
   * heldCount = jumlah jenis item yang dipegang (0 = tangan kosong).
   */
  update(delta: number, moving: boolean, pitch: number, heldCount: number): void;
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

  /**
   * Lengan bersegmen: sleeve -> forearm kulit -> tangan -> jari + ibu jari.
   * Dibongkar dari satu kotak biar kelihatan 3D, bukan balok datar.
   */
  function buildArm(side: 1 | -1): Group {
    const pivot = new Group();
    const parts: Mesh[] = [];

    const sleeve = armMesh(shirt);
    sleeve.scale.set(1.05, 1.05, 0.52); // 0.26 panjang
    sleeve.position.z = -0.05;
    parts.push(sleeve);

    const forearm = armMesh(skin);
    forearm.scale.set(0.95, 0.95, 0.4); // 0.2 panjang
    forearm.position.z = -0.28;
    parts.push(forearm);

    const hand = armMesh(skin);
    hand.scale.set(1, 0.75, 0.24); // pipih ke bawah
    hand.position.z = -0.42;
    parts.push(hand);

    // Jari: kecil, sedikit turun dari telapak.
    const fingers = armMesh(skin);
    fingers.scale.set(0.9, 0.5, 0.12);
    fingers.position.set(0, -0.025, -0.5);
    parts.push(fingers);

    // Ibu jari di sisi dalam (arah tengah layar).
    const thumb = armMesh(skin);
    thumb.scale.set(0.3, 0.4, 0.14);
    thumb.position.set(-side * 0.075, 0.005, -0.45);
    parts.push(thumb);

    pivot.add(...parts);
    pivot.rotation.y = side * 0.22;
    pivot.position.set(side * BASE_POS_X, BASE_POS_Y, BASE_POS_Z);
    pivot.renderOrder = 999;
    for (const p of parts) p.renderOrder = 999;
    return pivot;
  }

  const armR = buildArm(1);
  const armL = buildArm(-1);
  group.add(armR, armL);

  // Blok yang sedang dipegang, menempel di ujung tangan kanan.
  let heldBlock = new Mesh(
    blockBoxGeometry(1, 0.18),
    new MeshLambertMaterial({ map: atlasTexture(), depthTest: false, depthWrite: false }),
  );
  heldBlock.position.set(0, 0.04, -0.58);
  heldBlock.renderOrder = 999;
  heldBlock.visible = false;
  armR.add(heldBlock);

  let elapsed = 0;
  let swingT = -1;

  return {
    group,
    setHeldType(type) {
      if (type === null) { heldBlock.visible = false; return; }
      heldBlock.visible = true;
      armR.remove(heldBlock);
      heldBlock.geometry.dispose();
      const geo = blockBoxGeometry(type, 0.18);
      const mat = new MeshLambertMaterial({ map: atlasTexture(), depthTest: false, depthWrite: false });
      const next = new Mesh(geo, mat);
      next.position.set(0, 0.04, -0.58);
      next.renderOrder = 999;
      armR.add(next);
      heldBlock = next;
    },
    swing() {
      swingT = 0;
    },
    update(delta, moving, pitch, heldCount) {
      elapsed += delta;
      const bob = moving ? Math.sin(elapsed * 8) : 0;

      // Pitch kamera menggerakkan lengan naik-turun sepanjang layar.
      const lift = pitch * 0.35;
      armR.position.y = BASE_POS_Y + bob * 0.02 + lift;
      armL.position.y = BASE_POS_Y + bob * 0.02 + lift;
      // Lengan tetap di sisi kiri/kanan, hanya bobbing saat jalan.
      armR.position.x = BASE_POS_X - bob * 0.01;
      armL.position.x = -BASE_POS_X - bob * 0.01;

      if (swingT >= 0) {
        swingT += delta / SWING_DURATION;
        if (swingT > 1) swingT = -1;
      }
      const s = swingT < 0 ? 0 : Math.sin(swingT * Math.PI);
      armR.rotation.x = -s * 0.9;
      armR.position.z = BASE_POS_Z - s * 0.1;

      // Tangan kosong: tangan tersembunyi, tapi muncul saat mukul.
      // Pegang 1 item -> tangan kanan; 2 item -> dua-duanya.
      const swinging = swingT >= 0;
      armR.visible = heldCount >= 1 || swinging;
      armL.visible = heldCount >= 2;
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
