export function createRenderLoop(canvasRef){
  let rafId = 0;
  let paused = false;
  const frame = (tick) => {
    if (paused) return;
    try { tick(); } catch(_){ }
    const c = canvasRef?.();
    try {
      if (c && typeof c.requestAnimationFrame === 'function') {
        rafId = c.requestAnimationFrame(() => frame(tick));
      } else if (typeof requestAnimationFrame === 'function') {
        rafId = requestAnimationFrame(() => frame(tick));
      } else {
        rafId = setTimeout(() => frame(tick), 16);
      }
    } catch(_){ rafId = setTimeout(() => frame(tick), 16); }
  };
  const start = (tick) => { paused = false; frame(tick); };
  const stop = () => {
    paused = true;
    const c = canvasRef?.();
    try { if (c && typeof c.cancelAnimationFrame === 'function' && rafId) c.cancelAnimationFrame(rafId); } catch(_){ }
    rafId = 0;
  };
  return { start, stop, isPaused: () => paused };
}