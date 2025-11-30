
export function createTweenManager() {
  const tweens = [];
  return {
    to(target, props, duration, easing = t => t, onUpdate = null, onComplete = null) {
      const start = {};
      for (const k in props) start[k] = (typeof target[k] === 'number') ? target[k] : 0;
      tweens.push({ target, start, end: props, startTime: Date.now(), duration, easing, onUpdate, onComplete });
    },
    update(now) {
      for (let i = tweens.length - 1; i >= 0; i--) {
        const t = tweens[i];
        const elapsed = now - t.startTime;
        let progress = Math.min(1, elapsed / t.duration);
        progress = t.easing(progress);
        for (const k in t.end) {
            const s = t.start[k];
            const e = t.end[k];
            t.target[k] = s + (e - s) * progress;
        }
        if (t.onUpdate) t.onUpdate(t.target);
        if (progress >= 1) {
          tweens.splice(i, 1);
          if (t.onComplete) t.onComplete();
        }
      }
    }
  };
}
