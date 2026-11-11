import { blockBoxGeometry } from '../world/mesher';
import { atlasTexture } from '../world/texture-atlas';
import type { VoxelType } from '../world/voxel';
import { BoxGeometry, Group, Mesh, MeshLambertMaterial, type Material } from 'three';

/** Pose dasar tangan: sedikit diangkat ke depan (radian), biar gak menggantung kaku. */
const ARM_FORWARD = 0.55;

export interface PlayerModelHandle {
  readonly group: Group;
  /** Sinkron posisi/rotasi ke body player + arah pandang kamera. */
  update(pos: { x: number; y: number; z: number }, yaw: number, pitch: number): void;
  /** Animasi: ayun kaki+tangan saat jalan; swing tangan kanan saat aksi blok. */
  animate(delta: number, walking: boolean): void;
  /** Tampilkan/sembunyikan kepala (disembunyikan di FPP biar tidak nutup kamera). */
  setHeadVisible(visible: boolean): void;
  /** Set blok yang dipegang di tangan kanan (null = tangan kosong). */
  setHeldType(type: VoxelType | null): void;
  swing(): void;
  dispose(): void;
}

function part(w: number, h: number, d: number, color: number): Mesh {
  return new Mesh(new BoxGeometry(w, h, d), new MeshLambertMaterial({ color }));
}

/**
 * Anggota badan yang berayun: mesh digeser ke bawah setengah tinggi
 * supaya pivot rotasi ada di ujung atas (bahu/panggul), bukan tengah kotak.
 */
function limb(w: number, h: number, d: number, color: number): Group {
  const pivot = new Group();
  const mesh = part(w, h, d, color);
  mesh.position.y = -h / 2;
  pivot.add(mesh);
  return pivot;
}

/** Tempel hand (warna kulit) di ujung bawah lengan supaya tidak kaku. */
function addHand(arm: Group): void {
  const hand = part(0.16, 0.14, 0.24, 0xd7a558);
  hand.position.y = -0.28;
  arm.add(hand);
}

/**
 * Model player kotak-kotak (2 kaki, badan, 2 tangan, kepala) warna solid,
 * plus mata supaya muka terlihat. Diposisikan di kaki player, menghadap yaw.
 * Tinggi: kaki 0.8 + badan 0.55 + kepala 0.45 = 1.8 (sama dengan PLAYER_HEIGHT).
 */
export function createPlayerModel(): PlayerModelHandle {
  const group = new Group();

  const skin = 0xd7a558;
  const shirt = 0x2b6cd4;
  const pants = 0x3a3f4a;

  // Kepala + wajah: mata putih + pupil hitam + mulut, menghadap -Z.
  const head = part(0.45, 0.45, 0.45, skin);
  head.position.set(0, 1.575, 0);
  const eyeWhite = new Mesh(
    new BoxGeometry(0.1, 0.08, 0.02),
    new MeshLambertMaterial({ color: 0xffffff }),
  );
  const pupil = new Mesh(
    new BoxGeometry(0.04, 0.04, 0.02),
    new MeshLambertMaterial({ color: 0x111111 }),
  );
  pupil.position.z = -0.011;
  eyeWhite.add(pupil);
  const eyeL = eyeWhite.clone();
  eyeL.position.set(-0.1, 0.05, -0.23);
  const eyeR = eyeWhite.clone();
  eyeR.position.set(0.1, 0.05, -0.23);
  const mouth = new Mesh(
    new BoxGeometry(0.16, 0.03, 0.02),
    new MeshLambertMaterial({ color: 0x8b5a3c }),
  );
  mouth.position.set(0, -0.12, -0.23);
  head.add(eyeL, eyeR, mouth);
  group.add(head);

  const torso = part(0.5, 0.55, 0.25, shirt);
  torso.position.set(0, 1.075, 0);
  group.add(torso);

  // Tangan: pivot di bahu; forearm + hand skin supaya lebih 3D.
  const armL = limb(0.16, 0.55, 0.25, shirt);
  armL.position.set(-0.33, 1.35, 0);
  const armR = limb(0.16, 0.55, 0.25, shirt);
  armR.position.set(0.33, 1.35, 0);
  addHand(armL);
  addHand(armR);
  group.add(armL, armR);

  // Kaki: pivot di panggul (y = 0.8).
  const legL = limb(0.22, 0.8, 0.25, pants);
  legL.position.set(-0.13, 0.8, 0);
  const legR = limb(0.22, 0.8, 0.25, pants);
  legR.position.set(0.13, 0.8, 0);
  group.add(legL, legR);

  let pitch = 0;
  let elapsed = 0;
  let swingT = -1; // -1 = idle, 0..1 = sedang mengayun tangan kanan
  const SWING_DURATION = 0.25;
  // Blok dipegang di tangan kanan (untuk TPP).
  let heldBlock: Mesh | null = null;

  return {
    group,
    update(pos, yaw, camPitch) {
      group.position.set(pos.x, pos.y, pos.z);
      group.rotation.y = yaw;
      head.rotation.x = camPitch; // kepala ikut lihat atas/bawah
      pitch = camPitch;
    },
    setHeldType(type) {
      if (heldBlock !== null) {
        armR.remove(heldBlock);
        heldBlock.geometry.dispose();
        (heldBlock.material as MeshLambertMaterial).dispose();
        heldBlock = null;
      }
      if (type === null) return;
      heldBlock = new Mesh(
        blockBoxGeometry(type, 0.2),
        new MeshLambertMaterial({ map: atlasTexture() }),
      );
      heldBlock.position.set(0, -0.55, -0.1);
      armR.add(heldBlock);
    },
    animate(delta, walking) {
      elapsed += delta;
      const ph = Math.sin(elapsed * 8) * (walking ? 0.5 : 0);
      legL.rotation.x = ph;
      legR.rotation.x = -ph;
      // Lengan mengikuti arah pandang, tapi dibatasi:
      // lihat bawah → lengan lurus ke bawah (dekat badan, tidak menutup layar),
      // lihat atas → lengan sedikit terangkat. Clamp mencegah lengan naik ke muka.
      const armPitch = Math.min(Math.max(pitch * 0.45, -0.5), 0.35);
      armL.rotation.x = ARM_FORWARD - ph * 0.6 + armPitch;
      armR.rotation.x = ARM_FORWARD + ph * 0.6 + armPitch;
      if (swingT >= 0) {
        swingT += delta / SWING_DURATION;
        if (swingT > 1) swingT = -1;
      }
      const swing = swingT < 0 ? 0 : Math.sin(swingT * Math.PI) * 0.9;
      armR.rotation.x += swing;
    },
    swing() {
      swingT = 0;
    },
    setHeadVisible(visible) {
      head.visible = visible;
    },
    dispose() {
      group.traverse((obj) => {
        const mesh = obj as Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as Material | Material[] | undefined;
        if (Array.isArray(mat)) {
          for (const m of mat) m.dispose();
        } else if (mat) {
          mat.dispose();
        }
      });
    },
  };
}
