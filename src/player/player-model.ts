import { BoxGeometry, Group, Mesh, MeshLambertMaterial, type Material } from 'three';

export interface PlayerModelHandle {
  readonly group: Group;
  /** Sinkron posisi/rotasi ke body player + arah pandang kamera. */
  update(pos: { x: number; y: number; z: number }, yaw: number, pitch: number): void;
  /** Animasi: ayun kaki+tangan saat jalan; swing tangan kanan saat aksi blok. */
  animate(delta: number, walking: boolean): void;
  /** Picu ayunan tangan kanan (aksi blok). */
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

  // Kepala + wajah: mata hitam kecil menghadap -Z (arah pandang player).
  const head = part(0.45, 0.45, 0.45, skin);
  head.position.set(0, 1.575, 0);
  const eyeL = new Mesh(new BoxGeometry(0.06, 0.06, 0.02), new MeshLambertMaterial({ color: 0x111111 }));
  eyeL.position.set(-0.11, 0.05, -0.23);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.11;
  head.add(eyeL, eyeR);
  group.add(head);

  const torso = part(0.5, 0.55, 0.25, shirt);
  torso.position.set(0, 1.075, 0);
  group.add(torso);

  // Tangan: pivot di bahu (y = 1.35).
  const armL = limb(0.16, 0.55, 0.25, shirt);
  armL.position.set(-0.33, 1.35, 0);
  const armR = limb(0.16, 0.55, 0.25, shirt);
  armR.position.set(0.33, 1.35, 0);
  group.add(armL, armR);

  // Kaki: pivot di panggul (y = 0.8).
  const legL = limb(0.22, 0.8, 0.25, pants);
  legL.position.set(-0.13, 0.8, 0);
  const legR = limb(0.22, 0.8, 0.25, pants);
  legR.position.set(0.13, 0.8, 0);
  group.add(legL, legR);

  let elapsed = 0;
  let swingT = -1; // -1 = idle, 0..1 = sedang mengayun tangan kanan
  const SWING_DURATION = 0.25;

  return {
    group,
    update(pos, yaw, pitch) {
      group.position.set(pos.x, pos.y, pos.z);
      group.rotation.y = yaw;
      head.rotation.x = pitch; // kepala ikut lihat atas/bawah
    },
    animate(delta, walking) {
      elapsed += delta;
      const ph = Math.sin(elapsed * 8) * (walking ? 0.5 : 0);
      legL.rotation.x = ph;
      legR.rotation.x = -ph;
      armL.rotation.x = -ph * 0.6;
      armR.rotation.x = ph * 0.6;
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
