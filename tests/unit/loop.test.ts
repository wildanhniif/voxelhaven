import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startLoop } from '../../src/engine/loop';

// Environment node: requestAnimationFrame disub dengan timer agar deterministik.
describe('startLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: (now: number) => void): number =>
        setTimeout(() => cb(performance.now()), 0) as unknown as number,
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      (id: number): void => clearTimeout(id),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('memanggil onFrame untuk setiap tick, lalu berhenti setelah stop()', async () => {
    const onFrame = vi.fn();
    const stop = startLoop(onFrame);

    await vi.advanceTimersByTimeAsync(0);
    expect(onFrame.mock.calls.length).toBeGreaterThanOrEqual(1);

    stop();
    const callsAfterStop = onFrame.mock.calls.length;
    await vi.advanceTimersByTimeAsync(0);
    expect(onFrame.mock.calls.length).toBe(callsAfterStop);
  });
});
