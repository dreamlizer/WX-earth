function readDiagnosticsConfig(APP_CFG) {
  return APP_CFG?.diagnostics || {};
}

function enabledFromGlobal(globalDataRef) {
  try {
    const g = globalDataRef?.() || {};
    return !!(g.wxEarthDiagnostics || g.glDiagnostics || g.runtimeDiagnostics);
  } catch(_) {
    return false;
  }
}

function makeEmptyStats() {
  return {
    frames: 0,
    slowFrames: 0,
    maxFrameMs: 0,
    spans: {},
    texture: null
  };
}

export function createRuntimeDiagnostics({ APP_CFG, globalDataRef, logger } = {}) {
  const cfg = readDiagnosticsConfig(APP_CFG);
  const flushIntervalMs = Math.max(1000, Number(cfg.flushIntervalMs || 5000));
  const slowFrameMs = Math.max(16, Number(cfg.slowFrameMs || 34));
  const log = typeof logger === 'function'
    ? logger
    : (payload) => { try { console.info('[diag]', payload); } catch(_){} };
  let stats = makeEmptyStats();
  let lastFlushAt = 0;
  let cachedEnabled = !!cfg.enabled;
  let nextFlagCheckAt = 0;

  const isEnabled = (now) => {
    if (cfg.enabled) return true;
    const t = Number(now || Date.now());
    if (t >= nextFlagCheckAt) {
      cachedEnabled = enabledFromGlobal(globalDataRef);
      nextFlagCheckAt = t + 1000;
    }
    return cachedEnabled;
  };

  const reset = () => {
    stats = makeEmptyStats();
  };

  const recordFrame = (now, dtSec) => {
    if (!isEnabled(now)) return;
    const dtMs = Math.max(0, Number(dtSec || 0) * 1000);
    stats.frames += 1;
    if (dtMs >= slowFrameMs) stats.slowFrames += 1;
    if (dtMs > stats.maxFrameMs) stats.maxFrameMs = dtMs;
  };

  const recordSpan = (name, ms) => {
    if (!isEnabled()) return;
    const key = String(name || 'unknown');
    const value = Math.max(0, Number(ms || 0));
    const s = stats.spans[key] || (stats.spans[key] = { count: 0, totalMs: 0, maxMs: 0 });
    s.count += 1;
    s.totalMs += value;
    if (value > s.maxMs) s.maxMs = value;
  };

  const measure = (name, fn, nowFn = Date.now) => {
    if (!isEnabled()) return fn();
    const start = nowFn();
    try {
      return fn();
    } finally {
      recordSpan(name, nowFn() - start);
    }
  };

  const recordTextureState = (state) => {
    if (!isEnabled()) return;
    stats.texture = state ? { ...state } : null;
  };

  const flush = (now) => {
    const t = Number(now || Date.now());
    if (!isEnabled(t)) return false;
    if (lastFlushAt && (t - lastFlushAt) < flushIntervalMs) return false;
    if (!lastFlushAt && t < flushIntervalMs) return false;
    lastFlushAt = t;
    const spans = {};
    for (const [name, s] of Object.entries(stats.spans)) {
      spans[name] = {
        count: s.count,
        avgMs: s.count ? Number((s.totalMs / s.count).toFixed(2)) : 0,
        maxMs: Number(s.maxMs.toFixed(2))
      };
    }
    const payload = {
      frames: stats.frames,
      slowFrames: stats.slowFrames,
      maxFrameMs: Number(stats.maxFrameMs.toFixed(2)),
      spans,
      texture: stats.texture
    };
    try { log(payload); } catch(_){}
    reset();
    return true;
  };

  return {
    isEnabled,
    recordFrame,
    recordSpan,
    recordTextureState,
    measure,
    flush
  };
}
