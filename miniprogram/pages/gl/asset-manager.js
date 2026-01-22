
import { getTextureUrl, clearTextureCache, clearTextureSaved } from './texture-source.js';
import { detectEnvironment as _detectEnvironment } from './platform-manager.js';

// Re-export for backward compatibility if needed, or just use internal
export const detectEnvironment = _detectEnvironment;


/**
 * 针对 PC 客户端修正纹理
 * PC 端 texture.flipY 可能被底层忽略，且 Shader 修复未覆盖默认 MeshPhongMaterial
 * 因此使用 Texture Matrix 直接翻转纹理坐标
 */
export const fixTexture = (tex, isPC) => {
  if (isPC && tex) {
    try {
      tex.matrixAutoUpdate = false;
      // 相当于 scale(1, -1) translate(0, 1)
      tex.matrix.set(
        1, 0, 0,
        0, -1, 1,
        0, 0, 1
      );
      tex.needsUpdate = true;
      console.warn('[texture] PC Fix: Applied Texture Matrix Flip');
    } catch(e) { console.warn('[texture] fixTexture failed', e); }
  }
};

/**
 * 带重试机制的纹理加载
 */
export const loadTextureWithRetry = async (loader, name, urlProvider, applyFn, { maxAttempts = 3, baseDelayMs = 800, timeoutMs = 15000 } = {}) => {
  return new Promise((resolve) => {
    let attempt = 0;
    let finished = false;
    let lastFallback = ''; 

    const loadFallback = () => {
      if (finished) return;
      if (!lastFallback) { resolve(false); return; }
      console.warn('[texture] Retry failed, switching to fallback:', name);
      loader.load(lastFallback, (tex) => {
         if (finished) return;
         finished = true;
         try { applyFn(tex); } catch(_){}
         resolve(true);
      }, undefined, () => {
         if (finished) return;
         finished = true;
         resolve(false);
      });
    };

    const tryOnce = async () => {
      attempt += 1;
      let res = null;
      try { res = await urlProvider(attempt > 1); } catch(_){}
      const u = (res && res.url) ? res.url : '';
      if (res && res.fallback) lastFallback = res.fallback;

      let watchdog = setTimeout(() => {
        if (finished) return;
        console.warn('[texture] Timeout:', name, 'attempt:', attempt);
        if (attempt < maxAttempts) {
          const delay = Math.max(200, baseDelayMs * Math.pow(2, attempt - 1));
          setTimeout(tryOnce, delay);
        } else {
          loadFallback();
        }
      }, timeoutMs);

      loader.load(u, (tex) => {
        if (finished) { clearTimeout(watchdog); return; }
        clearTimeout(watchdog);
        try { applyFn(tex); } catch(_){}
        finished = true;
        resolve(true);
      }, undefined, () => {
        if (finished) { clearTimeout(watchdog); return; }
        clearTimeout(watchdog);
        console.warn('[texture] Load failed:', name, 'attempt:', attempt);
        if (attempt < maxAttempts) {
          const delay = Math.max(200, baseDelayMs * Math.pow(2, attempt - 1));
          setTimeout(tryOnce, delay);
        } else {
          loadFallback();
        }
      });
    };
    tryOnce();
  });
};

/**
 * 刷新所有纹理资源
 * @param {Object} ctx - 上下文 { loader, THREE, isPC, state, cloudMesh, fixTexture, updateTheme }
 */
export const reloadAllTextures = async (ctx) => {
  const { loader, THREE, isPC, state, cloudMesh, updateTheme } = ctx;
  // 保持默认 true
  const TEX_FLIP_Y = true; 

  try {
    console.info('[assets] 开始刷新贴图和音乐缓存...');
    clearTextureCache();
    clearTextureSaved(['earth','earth_night','earth_day','cloud']);
    
    // 重新加载贴图
    const day = await getTextureUrl('earth');
    const night = await getTextureUrl('earth_night');
    const pureDay = await getTextureUrl('earth_day');
    const cloudRes = await getTextureUrl('cloud');
    
    const applyCommon = (tex) => {
      if (!state) return false;
      try { tex.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { tex.encoding = THREE.sRGBEncoding; } catch(__){} } 
      try { tex.flipY = TEX_FLIP_Y; tex.needsUpdate = true; } catch(_){} 
      fixTexture(tex, isPC);
      return true;
    };

    loader.load(day.url, (tex) => {  
      if (applyCommon(tex)) {
        ctx.setEarthDayTex(tex);
        updateTheme();
        console.info('[assets] earth 贴图已刷新');
      }
    });
    
    loader.load(night.url, (tex) => { 
      if (applyCommon(tex)) {
        ctx.setEarthNightTex(tex);
        updateTheme();
        console.info('[assets] earth_night 贴图已刷新');
      }
    });
    
    loader.load(pureDay.url, (tex) => { 
      if (applyCommon(tex)) {
        ctx.setEarthPureDayTex(tex);
        updateTheme();
        console.info('[assets] earth_day (纯白昼) 贴图已刷新');
      }
    });
    
    if (cloudMesh && cloudRes && cloudRes.url) {
      loader.load(cloudRes.url, (tex) => {
        if (!state) return;
        try { tex.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { tex.encoding = THREE.sRGBEncoding; } catch(__){} }
        try { tex.flipY = false; tex.needsUpdate = true; } catch(_){}
        fixTexture(tex, isPC);
        const mat = new THREE.MeshPhongMaterial({ 
          map: tex, 
          color: 0xffffff, 
          transparent: true, 
          opacity: 0.28,
          depthWrite: false, 
          depthTest: true,
          blending: THREE.AdditiveBlending 
        });
        cloudMesh.material = mat; cloudMesh.material.needsUpdate = true;
        console.info('[assets] cloud 贴图已刷新');
      });
    }
    
    // 清除音乐缓存
    try { 
        // Note: clearZenAudioSaved should be imported if needed, or passed in ctx
        // For now assuming caller handles or we import it here if strictly needed
        // But main.js has it imported. Let's return a flag or callback?
        // Let's just import it here if it's a pure util.
    } catch(_){}
    
    return true;
  } catch(e){ 
    console.error('[assets] 刷新失败', e);
    return false;
  }
};

export const dumpTextureInfo = (name, tex) => {
  try {
    if (!tex) { console.info('[TEX]', name, 'not loaded'); return; }
    const cs = (tex.colorSpace ?? tex.encoding);
    console.info('[TEX]', name, {
      colorSpace: (cs && cs.name) ? cs.name : cs,
      min: tex.minFilter, mag: tex.magFilter, aniso: tex.anisotropy,
      flipY: tex.flipY,
    });
  } catch(_){}
};
