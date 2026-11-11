import { PerspectiveCamera } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlayerBody } from '../../src/player/collision';
import { createController } from '../../src/player/controller';
import { WALK_SPEED } from '../../src/player/constants';

// window diganti EventTarget asli supaya dispatchEvent terhubung ke listener controller.
beforeEach(() => {
  vi.stubGlobal('window', new EventTarget());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup(yaw: number) {
  const camera = new PerspectiveCamera();
  camera.rotation.y = yaw;
  const body = createPlayerBody(0, 0, 0);
  const controller = createController(camera, body, () => true);
  const press = (code: string, down: boolean): void => {
    const event = new Event(down ? 'keydown' : 'keyup') as KeyboardEvent;
    Object.defineProperty(event, 'code', { value: code });
    window.dispatchEvent(event);
  };
  return { body, controller, press };
}

describe('controller arah gerak relatif yaw', () => {
  // Kamera default three.js menghadap -Z.
  it('yaw 0: W ke -Z, D ke +X (tidak terbalik)', () => {
    const { body, controller, press } = setup(0);
    press('KeyW', true);
    controller.update();
    expect(body.vz).toBeCloseTo(-WALK_SPEED, 5);
    expect(body.vx).toBeCloseTo(0, 5);
    press('KeyW', false);

    press('KeyD', true);
    controller.update();
    expect(body.vx).toBeCloseTo(WALK_SPEED, 5);
    expect(body.vz).toBeCloseTo(0, 5);
    press('KeyD', false);
    controller.dispose();
  });

  it('yaw +90° (menghadap -X): W ke -X, D ke -Z', () => {
    const { body, controller, press } = setup(Math.PI / 2);
    press('KeyW', true);
    controller.update();
    expect(body.vx).toBeCloseTo(-WALK_SPEED, 5);
    expect(body.vz).toBeCloseTo(0, 5);
    press('KeyW', false);

    press('KeyD', true);
    controller.update();
    expect(body.vx).toBeCloseTo(0, 5);
    expect(body.vz).toBeCloseTo(-WALK_SPEED, 5);
    press('KeyD', false);
    controller.dispose();
  });
});
