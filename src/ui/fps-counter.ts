export interface FpsSample {
  fps: number;
}

const UPDATE_INTERVAL_MS = 1000;

/**
 * FPS counter: menghitung frame dan flush nilai rata-rata 1x per detik.
 */
export function createFpsCounter(onSample: (fps: FpsSample) => void) {
  let frames = 0;
  let windowStart = 0;

  return {
    tick(now: number): void {
      if (windowStart === 0) windowStart = now;
      frames += 1;
      if (now - windowStart >= UPDATE_INTERVAL_MS) {
        const elapsed = now - windowStart;
        onSample({ fps: Math.round((frames * UPDATE_INTERVAL_MS) / elapsed) });
        frames = 0;
        windowStart = now;
      }
    },
  };
}
