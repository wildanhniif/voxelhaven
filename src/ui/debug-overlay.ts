import { createFpsCounter } from './fps-counter';

/**
 * Overlay debug sederhana: teks FPS di pojok kiri atas,
 * diperbarui 1x per detik oleh fps-counter.
 */
export function createDebugOverlay(): (fps: number) => void {
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.top = '8px';
  el.style.left = '8px';
  el.style.font = '14px monospace';
  el.style.padding = '4px 8px';
  el.style.background = 'rgba(0, 0, 0, 0.5)';
  el.style.color = '#fff';
  el.style.pointerEvents = 'none';
  el.textContent = 'FPS: --';
  document.body.appendChild(el);

  const counter = createFpsCounter(({ fps }) => {
    el.textContent = `FPS: ${fps}`;
  });

  return (fps: number) => counter.tick(fps);
}
