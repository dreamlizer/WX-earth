function pickExpectedEarthTexture({ currentTheme, earthDayTex, earthPureDayTex, earthNightTex } = {}) {
  if (currentTheme === 'night') return earthNightTex || earthDayTex || null;
  if (currentTheme === 'day8k') return earthPureDayTex || earthDayTex || null;
  return earthDayTex || null;
}

function textureLooksUsable(tex) {
  if (!tex) return false;
  if (tex.image === null) return false;
  return true;
}

function getShaderUniforms(material) {
  return material?.uniforms || null;
}

export function inspectEarthTextureState({ earthMesh, earthDayTex, earthPureDayTex, earthNightTex, currentTheme } = {}) {
  if (!earthMesh) return { ok: false, reason: 'missing-mesh' };
  const material = earthMesh.material;
  if (!material) return { ok: false, reason: 'missing-material' };

  const expected = pickExpectedEarthTexture({ currentTheme, earthDayTex, earthPureDayTex, earthNightTex });
  const uniforms = getShaderUniforms(material);
  if (uniforms?.uDayTex) {
    const shaderDay = uniforms.uDayTex.value;
    if (textureLooksUsable(shaderDay)) return { ok: true, reason: 'ok' };
    return { ok: false, reason: expected ? 'missing-shader-texture' : 'missing-source-texture' };
  }

  if (textureLooksUsable(material.map)) return { ok: true, reason: 'ok' };
  return { ok: false, reason: expected ? 'missing-map' : 'missing-source-texture' };
}

export function repairEarthTexture({ earthMesh, earthDayTex, earthPureDayTex, earthNightTex, currentTheme } = {}) {
  const state = inspectEarthTextureState({ earthMesh, earthDayTex, earthPureDayTex, earthNightTex, currentTheme });
  if (state.ok) return { ...state, action: 'none' };

  const tex = pickExpectedEarthTexture({ currentTheme, earthDayTex, earthPureDayTex, earthNightTex });
  const material = earthMesh?.material;
  if (!material || !textureLooksUsable(tex)) return { ...state, action: 'reload' };

  const uniforms = getShaderUniforms(material);
  try {
    if (uniforms?.uDayTex) {
      uniforms.uDayTex.value = tex;
      if (currentTheme === 'night' && uniforms.uNightTex) uniforms.uNightTex.value = tex;
    } else {
      material.map = tex;
    }
    tex.needsUpdate = true;
    material.needsUpdate = true;
    earthMesh.visible = true;
    return { ok: true, reason: state.reason, action: 'rebind' };
  } catch(_) {
    return { ...state, action: 'reload' };
  }
}

export function createTextureHealthChecker({ APP_CFG, refs, refreshTextures, diagnostics, logger, isReady } = {}) {
  const cfg = APP_CFG?.textureHealth || {};
  const enabled = cfg.enabled !== false;
  const intervalMs = Math.max(1000, Number(cfg.intervalMs ?? 3000));
  const startDelayMs = Math.max(0, Number(cfg.startDelayMs ?? 2500));
  const minReloadGapMs = Math.max(intervalMs, Number(cfg.minReloadGapMs ?? 15000));
  const log = typeof logger === 'function'
    ? logger
    : (payload) => { try { console.warn('[texture-health]', payload); } catch(_){} };
  let nextCheckAt = startDelayMs;
  let lastReloadAt = -Infinity;
  let reloadInFlight = null;

  const snapshot = () => ({
    earthMesh: refs?.earthMesh?.(),
    earthDayTex: refs?.earthDayTex?.(),
    earthPureDayTex: refs?.earthPureDayTex?.(),
    earthNightTex: refs?.earthNightTex?.(),
    currentTheme: refs?.currentTheme?.() || 'default'
  });

  const tick = async (now) => {
    const t = Number(now || Date.now());
    if (!enabled || t < nextCheckAt) return { ok: true, reason: 'skipped', action: 'none' };
    nextCheckAt = t + intervalMs;
    if (typeof isReady === 'function' && !isReady()) {
      return { ok: true, reason: 'not-ready', action: 'none' };
    }

    const result = repairEarthTexture(snapshot());
    diagnostics?.recordTextureState?.(result);
    if (result.action !== 'reload') return result;

    if (reloadInFlight) return { ...result, action: 'reload-pending' };
    if ((t - lastReloadAt) < minReloadGapMs) return { ...result, action: 'reload-throttled' };

    lastReloadAt = t;
    try { log(result); } catch(_){}
    if (typeof refreshTextures !== 'function') return result;
    reloadInFlight = Promise.resolve()
      .then(() => refreshTextures())
      .finally(() => { reloadInFlight = null; });
    try { await reloadInFlight; } catch(_){}
    return result;
  };

  return { tick };
}
