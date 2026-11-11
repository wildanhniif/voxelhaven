import { BoxGeometry, Group, Mesh, MeshLambertMaterial } from 'three';

export interface PlayerModelHandle {
  readonly group: Group;
  /** Sinkron posisi/rotasi ke body player dan arah pandang kamera. */
  update(pos: { x: number; y: number; z: number }, yaw: number, pitch: number): void;
  dispose(): void;
}

function part(w: number, h: number, d: number, color: number): Mesh {
  return new Mesh(new BoxGeometry(w, h, d), new MeshLambertMaterial({ color }));
}

/**
 * Model player dari kotak-kotak (kepala, badan, 2 tangan, 2 kaki),
 * warna solid. Diposisikan di kaki player, menghadap arah yaw kamera.
 * Proporsi: kaki 0.8 + badan 0.55 + kepala 0.45 = 1.8 (tinggi player).
 */
export function createPlayerModel(): PlayerModelHandle {
  const group = new Group();
  const parts: Mesh[] = [];

  const add = (mesh: Mesh, x: number, y: number): void => {
    mesh.position.set(x, y, 0);
    group.add(mesh);
    parts.push(mesh);
  };

  const skin = 0xd7a558;
  const shirt = 0x2b6cd4;
  const pants = 0x3a3f4a;

  add(part(0.22, 0.8, 0.25, pants), -0.13, 0.4);
  add(part(0.22, 0.8, 0.25, pants), 0.13, 0.4);
  add(part(0.5, 0.55, 0.25, shirt), 0, 1.075);
  add(part(0.16, 0.55, 0.25, shirt), -0.33, 1.075);
  add(part(0.16, 0.55, 0.25, shirt), 0.33, 1.075);

  const head = part(0.45, 0.45, 0.45, skin);
  head.position.set(0, 1.575, 0);
  group.add(head);
  parts.push(head);

  return {
    group,
    update(pos, yaw, pitch) {
      group.position.set(pos.x, pos.y, pos.z);
      group.rotation.y = yaw;
      head.rotation.x = pitch;
    },
    dispose() {
      for (const p of parts) {
        p.geometry.dispose();
        (p.material as MeshLambertMaterial).dispose();
      }
    },
  };
}
