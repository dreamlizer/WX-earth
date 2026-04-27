export function createRenderLoop(canvasRef){
  let rafId = 0;
  let rafKind = '';
  let paused = true;
  let currentTick = null;

  const cancelScheduled = () => {
    const c = canvasRef?.();
    try {
      if (rafKind === 'canvas' && c && typeof c.cancelAnimationFrame === 'function' && rafId) c.cancelAnimationFrame(rafId);
      else if (rafKind === 'global' && typeof cancelAnimationFrame === 'function' && rafId) cancelAnimationFrame(rafId);
      else if (rafKind === 'timeout' && rafId) clearTimeout(rafId);
    } catch(_){ }
    rafId = 0;
    rafKind = '';
  };

  const schedule = () => {
    const c = canvasRef?.();
    try {
      if (c && typeof c.requestAnimationFrame === 'function') {
        rafKind = 'canvas';
        rafId = c.requestAnimationFrame(frame);
      } else if (typeof requestAnimationFrame === 'function') {
        rafKind = 'global';
        rafId = requestAnimationFrame(frame);
      } else {
        rafKind = 'timeout';
        rafId = setTimeout(frame, 16);
      }
    } catch(e){
       console.warn('[RenderLoop] raf failed, fallback to timeout', e);
       rafKind = 'timeout';
       rafId = setTimeout(frame, 16);
    }
  };

  const frame = () => {
    if (paused) return;
    rafId = 0;
    rafKind = '';
    const tick = currentTick;
    if (typeof tick !== 'function') {
      paused = true;
      console.warn('[RenderLoop] missing tick, paused');
      return;
    }
    try { tick(); } catch(e){
      // 节流打印，避免刷屏
      const now = Date.now();
      if (now - (frame.lastError || 0) > 2000) {
         console.error('[RenderLoop] tick failed:', e);
         frame.lastError = now;
      }
    }
    if (!paused) schedule();
  };
  const start = (tick) => {
    if (typeof tick === 'function') currentTick = tick;
    if (typeof currentTick !== 'function') {
      console.warn('[RenderLoop] start skipped: missing tick');
      return;
    }
    if (!paused) return;
    paused = false;
    frame();
  };
  const stop = () => {
    paused = true;
    cancelScheduled();
  };
  return { start, stop, isPaused: () => paused };
}
