import { PERF_DIAG_LOG } from './label-constants.js';

/**
 * 调试与诊断管理器
 * 职责：提供控制台调试工具（如缩放、微调中心点、输出渲染管线信息），辅助开发与排查。
 */

const _tmName = (THREE, v) => {
  try {
    const names = ['NoToneMapping','LinearToneMapping','ReinhardToneMapping','CineonToneMapping','ACESFilmicToneMapping'];
    for (const n of names) { if (THREE?.[n] === v) return n; }
  } catch(_){}
  return String(v);
};

export const dumpRendererInfo = (THREE, renderer) => {
  if (!PERF_DIAG_LOG) return;
  try {
    const colorSpace = (renderer.outputColorSpace ?? renderer.outputEncoding);
    const tone = renderer.toneMapping;
    const exposure = (renderer.toneMappingExposure ?? 1.0);
    console.info('[PIPELINE]', {
      pixelRatio: (typeof renderer.getPixelRatio === 'function' ? renderer.getPixelRatio() : undefined),
      size: (typeof renderer.getSize === 'function' ? renderer.getSize(new THREE.Vector2()).toArray() : undefined),
      outputColorSpace: (colorSpace && colorSpace.name) ? colorSpace.name : colorSpace,
      toneMapping: _tmName(THREE, tone),
      toneMappingExposure: Number(exposure).toFixed(3),
    });
  } catch(_){}
};

export const exposeDebugTools = (wx, { setZoom, touch, flyMgr, RADIUS, convertVec3ToLatLon, THREE, INTERACTION_DEBUG_LOG }) => {
  if (typeof wx === 'undefined') return;

  // 控制台缩放方法
  wx.__earthSetZoom = setZoom;

  // 诊断工具：直接在当前视角上“推”中心
  const nudgeCenter = (dLatDeg = 0, dLonDeg = 0) => {
    try {
      const rad = Math.PI / 180;
      const nx = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, touch.rotX + dLatDeg * rad));
      const ny = touch.rotY + dLonDeg * rad;
      touch.rotX = nx; touch.rotY = ny; 
      touch.velX = 0; touch.velY = 0; 
      try { flyMgr?.cancel?.(); } catch(_){ }
      
      const v = new THREE.Vector3(0, 0, RADIUS);
      v.applyEuler(new THREE.Euler(nx, ny, 0, 'XYZ'));
      const [clon, clat] = convertVec3ToLatLon(v.x, v.y, v.z);
      try { console.log('[nudgeCenter]', 'dLatDeg=', dLatDeg, 'dLonDeg=', dLonDeg, 'center lon=', clon.toFixed(4), 'lat=', clat.toFixed(4)); } catch(_){}
    } catch(_){ }
  };

  wx.nudgeCenter = (cfg) => {
    try { const dLat = Number(cfg?.lat || 0), dLon = Number(cfg?.lon || 0); nudgeCenter(dLat, dLon); } catch(_){}
  };
};
