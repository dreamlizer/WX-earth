import { createDayNightMaterial } from './shaders/dayNightMix.glsl.js';

// 辅助函数：安全更新 Uniform
const setVal = (u, key, val) => { if (u[key]) u[key].value = val; };

export function applyTheme(opts) {
  try {
    const {
      THREE, earthMesh, earthDayTex, earthPureDayTex, earthNightTex,
      APP_CFG, zenActive, kind, dayNightMat, savedDayTexForShader, nightThemeActive
    } = opts || {};

    // 兼容旧参数名 earthDay8kTex -> earthPureDayTex
    const _pureDayTex = earthPureDayTex || opts?.earthDay8kTex;

    let __dayNightMat = dayNightMat || null;
    let __savedDayTexForShader = savedDayTexForShader || null;
    let __nightThemeActive = !!nightThemeActive;
    
    // 规范化主题名称
    let currentTheme = (kind === 'day8k' || kind === 'night') ? kind : 'default';

    try { console.log('[theme:set]', { kind: currentTheme, zenActive, matType: earthMesh?.material?.type }); } catch(_){ }
    
    // 如果是 Zen 模式，且 earthMesh 已经是 ShaderMaterial，则认为是 Shader 状态
    // 注意：这里不再负责切换 Shader/Phong 的“类型”，只负责更新当前材质的“内容”
    // 类型的切换由 external (main.js) 的 setZenMode / applyZenMaterial 控制
    if (zenActive) {
      // Zen 模式下，如果已经是 ShaderMaterial，尝试更新 Shader Uniforms
      if (__dayNightMat && earthMesh?.material === __dayNightMat) {
        return updateShaderTheme({ 
          dayNightMat: __dayNightMat, 
          currentTheme, 
          earthDayTex, 
          earthPureDayTex: _pureDayTex, 
          earthNightTex, 
          APP_CFG,
          savedDayTexForShader: __savedDayTexForShader,
          nightThemeActive: __nightThemeActive
        });
      }
      // 如果 Zen 模式下是 MeshPhong (iOS降级或Shader失败)，则走 Phong 更新逻辑
      // fallthrough to Phong logic
    }

    // 非 Zen 模式，或者 Zen 模式下的 Phong 降级
    // 这里的逻辑主要用于更新 MeshPhongMaterial 的 map
    return updatePhongTheme({
      earthMesh,
      currentTheme,
      earthDayTex,
      earthPureDayTex: _pureDayTex,
      earthNightTex,
      dayNightMat: __dayNightMat, // 保持引用
      savedDayTexForShader: __savedDayTexForShader,
      nightThemeActive: __nightThemeActive
    });

  } catch(err) { 
    try { console.error('[theme:set] 异常', err); } catch(_){ } 
    return { dayNightMat: opts?.dayNightMat || null, savedDayTexForShader: opts?.savedDayTexForShader || null, nightThemeActive: !!(opts?.nightThemeActive) }; 
  }
}

// 专门处理 ShaderMaterial 的主题切换（更新 Uniforms）
function updateShaderTheme({ dayNightMat, currentTheme, earthDayTex, earthPureDayTex, earthNightTex, APP_CFG, savedDayTexForShader, nightThemeActive }) {
  let __savedDayTexForShader = savedDayTexForShader;
  let __nightThemeActive = nightThemeActive;
  const u = dayNightMat.uniforms;

  // 1. 处理纯夜景模式 (Pure Night)
  const pureNight = !!(APP_CFG?.normal?.nightThemePure);
  if (currentTheme === 'night' && pureNight && earthNightTex) {
    if (!__savedDayTexForShader) __savedDayTexForShader = u.uDayTex.value || earthDayTex || earthPureDayTex;
    
    // 将白天纹理临时替换为夜景纹理，实现"全黑+灯光"效果
    setVal(u, 'uDayTex', earthNightTex);
    setVal(u, 'uNightTex', earthNightTex);
    
    // 调整曝光和增益以适配夜景
    const ncfg = APP_CFG?.normal || {};
    if (typeof ncfg.nightExposure === 'number') setVal(u, 'uExposure', Math.min(2.5, Math.max(0.7, ncfg.nightExposure)));
    if (typeof ncfg.nightDaySideGain === 'number') setVal(u, 'uDaySideGain', Math.min(3.0, Math.max(0.7, ncfg.nightDaySideGain)));
    
    __nightThemeActive = true;
    try { console.info('[theme:shader] night (pure)'); } catch(_){ }
  } 
  else {
    // 2. 恢复/设置正常模式
    const dayTexForTheme = (currentTheme === 'day8k' && earthPureDayTex) ? earthPureDayTex : earthDayTex;
    
    if (__nightThemeActive) {
      // 从夜景模式恢复
      if (earthNightTex) setVal(u, 'uNightTex', earthNightTex);
      const restoreDay = dayTexForTheme || __savedDayTexForShader || u.uDayTex.value;
      setVal(u, 'uDayTex', restoreDay);
      __nightThemeActive = false;
      __savedDayTexForShader = null;
    } else {
      // 正常的白天/高清切换
      if (dayTexForTheme) {
        setVal(u, 'uDayTex', dayTexForTheme);
        try { console.info('[theme:shader] dayTex=', (currentTheme === 'day8k' ? 'pureDay' : 'default')); } catch(_){ }
      } else {
        try { console.warn('[theme:shader] 缺失白昼贴图，保持原值'); } catch(_){ }
      }
    }
  }
  
  return { dayNightMat, savedDayTexForShader: __savedDayTexForShader, nightThemeActive: __nightThemeActive };
}

// 专门处理 MeshPhongMaterial 的主题切换（更新 map）
function updatePhongTheme({ earthMesh, currentTheme, earthDayTex, earthPureDayTex, earthNightTex, dayNightMat, savedDayTexForShader, nightThemeActive }) {
  const m = earthMesh?.material;
  if (!m) return { dayNightMat, savedDayTexForShader, nightThemeActive };

  let mapTex = null;
  if (currentTheme === 'night' && earthNightTex) {
    mapTex = earthNightTex;
  } else if (currentTheme === 'day8k' && earthPureDayTex) {
    mapTex = earthPureDayTex;
  } else if (earthDayTex) {
    mapTex = earthDayTex;
  }
  
  if (mapTex) {
    m.map = mapTex;
    try { if (m.map) m.map.needsUpdate = true; } catch(_){}
    m.needsUpdate = true;
    try { console.log('[theme:phong] switch map', { kind: currentTheme, uuid: mapTex.uuid }); } catch(_){ }
  } else {
    try { console.warn('[theme:phong] no texture available'); } catch(_){ }
  }

  // 如果从 Shader 降级下来，或者混合状态，重置 Shader 相关的状态变量
  return { dayNightMat: null, savedDayTexForShader: null, nightThemeActive: false };
}

export function createThemeState() {
  const s = { current: 'default', dayNightMat: null, savedDayTexForShader: null, nightThemeActive: false };
  return {
    get() { return { ...s }; },
    setTheme(kind) { s.current = (kind === 'day8k' || kind === 'night') ? kind : 'default'; },
    setMat(m) { s.dayNightMat = m || null; },
    update(res) { 
      s.dayNightMat = res?.dayNightMat || null; 
      s.savedDayTexForShader = res?.savedDayTexForShader || null; 
      s.nightThemeActive = !!(res?.nightThemeActive); 
    }
  };
}

export function applyThemeWithState(opts) {
  const { themeState, ...rest } = opts || {};
  const cur = themeState?.get?.() || {};
  const res = applyTheme({ 
    ...rest, 
    kind: rest.kind || cur.current, 
    dayNightMat: cur.dayNightMat, 
    savedDayTexForShader: cur.savedDayTexForShader, 
    nightThemeActive: cur.nightThemeActive 
  });
  try { themeState?.update?.(res); } catch(_){}
  return res;
}

export function applyZenMaterial({ THREE, earthMesh, earthDayTex, earthPureDayTex, earthNightTex, currentTheme, LIGHT_CFG, dirLightBase, camera, ambientLight, dirLight, useSimpleShader = false, workaroundTransparent = false, flipY = false }) {
  // 兼容旧参数名
  const _pureDayTex = earthPureDayTex || arguments[0]?.earthDay8kTex;
  
  const res = { earthOldMat: null, dayNightMat: null };
  if (!earthMesh) return res;
  
  try {
    res.earthOldMat = earthMesh.material;
    const APP_CFG = LIGHT_CFG;
    let __dayNightMat = null;

    try {
      const dayTexForTheme = (currentTheme === 'day8k' && _pureDayTex) ? _pureDayTex : earthDayTex;
      const zen = APP_CFG?.zen || {};
      
      // 传入 useSimpleShader
      __dayNightMat = createDayNightMaterial(
        THREE, 
        dayTexForTheme, 
        earthNightTex, 
        zen.mixSoftness ?? 0.20, 
        zen.gamma ?? 1.0, 
        zen.nightDarkness ?? 0.85, 
        zen.dayContrast ?? 1.0, 
        zen.mixPower ?? 1.0, 
        zen.dayNightContrast ?? 1.0, 
        useSimpleShader
      );
      
      if (__dayNightMat) {
        try { tuneZenMaterialUniforms(__dayNightMat, { LIGHT_CFG, dirLightBase, camera }); } catch(_){}
        try { if (workaroundTransparent) { __dayNightMat.depthWrite = false; __dayNightMat.alphaTest = 0.001; __dayNightMat.transparent = true; } } catch(_){}
        // 针对 PC 客户端的纹理翻转修复
        try { if (flipY) setVal(__dayNightMat.uniforms, 'uFlipY', 1.0); } catch(_){}
      }
      res.dayNightMat = __dayNightMat;
    } catch(e){ console.error('[theme] createDayNightMaterial failed', e); }
    
    return res;
  } catch(e){ console.error('[theme] applyZenMaterial failed', e); return res; }
}

export function restoreZenMaterial(opts){
  try {
    const { earthMesh, earthOldMat } = opts || {};
    if (!earthMesh || !earthOldMat) return { dayNightMat: null, earthOldMat: null };
    earthMesh.material = earthOldMat;
    earthMesh.material.needsUpdate = true;
    
    // 检查恢复后的材质是否是 ShaderMaterial
    let dayNightMat = null;
    try { 
      if (earthMesh.material && earthMesh.material.type === 'ShaderMaterial') { 
        dayNightMat = earthMesh.material; 
      } 
    } catch(_){ }
    
    return { dayNightMat, earthOldMat: null };
  } catch(_){ return { dayNightMat: null, earthOldMat: null }; }
}

export function tuneZenMaterialUniforms(dayNightMat, opts){
  try {
    const { LIGHT_CFG, dirLightBase, camera } = opts || {};
    const u = dayNightMat?.uniforms || {};
    const zen = LIGHT_CFG?.zen || {};
    
    // 基础参数
    setVal(u, 'uNightDarkness', zen.nightDarkness ?? 0.85);
    setVal(u, 'uDayContrast', zen.dayContrast ?? 1.0);
    setVal(u, 'uMixPower', zen.mixPower ?? 1.0);
    setVal(u, 'uDayNightContrast', zen.dayNightContrast ?? 1.0);
    setVal(u, 'uHighlightsRoll', Math.max(0.0, Math.min(1.0, zen.highlightsRoll ?? 0.05)));

    // DaySideGain 自动计算
    if (u.uDaySideGain) {
      const base = dirLightBase || 1;
      const target = zen.dirLightIntensityRight ?? base;
      const fallback = Math.max(1.0, Math.min(3.0, target / base));
      const cfg = zen.daySideGain;
      u.uDaySideGain.value = (cfg !== undefined) ? Math.min(3.0, Math.max(0.7, cfg)) : fallback;
    }

    // Exposure 自动计算
    if (u.uExposure) {
      const base = dirLightBase || 1;
      const target = zen.dirLightIntensityRight ?? base;
      const ratio = target / base;
      const fallback = Math.max(1.0, Math.min(2.2, ratio * 1.15));
      const cfg = zen.exposure;
      u.uExposure.value = (cfg !== undefined) ? Math.min(2.5, Math.max(0.7, cfg)) : fallback;
    }

    // 高光与水面参数
    const shininess = LIGHT_CFG?.earthMaterial?.shininess ?? 8;
    setVal(u, 'uShininess', Math.max(1.0, shininess));
    setVal(u, 'uSpecularStrength', Math.max(0.0, Math.min(2.0, zen.specularStrength ?? 1.20)));
    if (u.uSpecularColor) u.uSpecularColor.value.set(1,1,1);
    setVal(u, 'uSpecularUseTex', 0.0);
    setVal(u, 'uSpecularAutoMask', 1.0);
    
    setVal(u, 'uWaterMaskGain', Math.max(0.5, Math.min(3.0, zen.waterMaskGain ?? 2.0)));
    setVal(u, 'uWaterSpecularStrength', Math.max(1.0, Math.min(3.0, zen.waterSpecularStrength ?? 1.6)));
    setVal(u, 'uWaterShininess', Math.max(1.0, zen.waterShininess ?? 8.0));
    setVal(u, 'uWaterFresnel', Math.max(0.0, Math.min(1.0, zen.waterFresnel ?? 0.6)));
    setVal(u, 'uWaterNormalPerturb', Math.max(0.0, Math.min(0.3, zen.waterNormalPerturb ?? 0.06)));
    
    // 波纹噪声
    setVal(u, 'uWaveNoiseScale', Math.max(4.0, Math.min(64.0, zen.waveNoiseScale ?? 24.0)));
    setVal(u, 'uWaveNoiseStrength', Math.max(0.0, Math.min(1.0, zen.waveNoiseStrength ?? 0.25)));
    setVal(u, 'uWaveNoiseSpeed', Math.max(0.0, Math.min(1.0, zen.waveNoiseSpeed ?? 0.05)));
    
    if (u.uCameraPosWorld && camera?.position) u.uCameraPosWorld.value.copy(camera.position);
    
  } catch(_){ }
}
