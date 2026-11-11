export interface FrameContext {
  readonly elapsed: number;
  readonly delta: number;
}

export type FrameCallback = (ctx: FrameContext) => void;

/**
 * Loop render berbasis requestAnimationFrame.
 * Mengembalikan stop-function supaya mudah diuji/di-teardown.
 */
export function startLoop(onFrame: FrameCallback): () => void {
  let rafId = 0;
  let running = true;
  let last = performance.now();

  const tick = (now: number): void => {
    if (!running) return;
    const delta = now - last;
    last = now;
    onFrame({ elapsed: now, delta });
    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    running = false;
    cancelAnimationFrame(rafId);
  };
}
