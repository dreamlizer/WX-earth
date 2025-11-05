// 文本 -> CanvasTexture -> Sprite 的轻量工具
// 仅依赖 THREE 和小程序 2D Canvas，规避第三方字体库的环境耦合

const __cache = new Map(); // key -> {canvas, texture, w, h}

function getCanvas2D() {
  // 1) 小程序 OffscreenCanvas（优先）
  try {
    if (typeof wx !== 'undefined' && typeof wx.createOffscreenCanvas === 'function') {
      // 部分机型不接受 {type:'2d'}，改为双尝试
      try { return wx.createOffscreenCanvas({ type: '2d' }); } catch(_) {}
      try { return wx.createOffscreenCanvas(); } catch(_) {}
    }
  } catch(_) {}
  // 2) DevTools/浏览器兜底：不影响真机，仅用于本地预览
  try { return globalThis?.document?.createElement?.('canvas'); } catch(_) { return null; }
}

export function makeTextSprite(THREE, text, params = {}) {
  const font = params.font || 'bold 36px sans-serif';
  const color = params.color || '#ffffff';
  const padding = params.padding ?? 12; // 增加默认边距，避免描边/阴影被裁切
  const bg = params.bg || 'transparent';
  const worldHeight = params.worldHeight ?? 0.12; // 球半径=1的世界单位高度
  const strokeColor = params.strokeColor || '#000000';
  const strokeWidth = params.strokeWidth ?? 3; // 适度描边，降低裁切风险

  const key = JSON.stringify({ text, font, color, padding, bg, strokeColor, strokeWidth });
  let item = __cache.get(key);
  if (!item) {
    const canvas = getCanvas2D();
    if (!canvas) {
      try { console.warn('[text-sprite] 无法创建 2D canvas，放弃该标签：', text); } catch(_) {}
      return null;
    }
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) {
      try { console.warn('[text-sprite] 2D context 不可用，放弃该标签：', text); } catch(_) {}
      return null;
    }

    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const metrics = ctx.measureText(text);
    const ascent = metrics.actualBoundingBoxAscent || 24;
    const descent = metrics.actualBoundingBoxDescent || 10;
    const w = Math.ceil((metrics.width || (text.length * 18)) + padding * 2);
    const h = Math.ceil(ascent + descent + padding * 2);
    canvas.width = Math.max(2, w);
    canvas.height = Math.max(2, h);

    // 重绘：尺寸变化后需重新设置字体
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    if (bg && bg !== 'transparent') {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // 简单阴影增强可读性
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 2;
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // 黑边描边：先描边后填充，避免锯齿
    if (strokeWidth > 0) {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = strokeColor;
      ctx.strokeText(text, 0, 0);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    item = { canvas, texture, w: canvas.width, h: canvas.height };
    __cache.set(key, item);
  }

  // 为避免在不同平台出现材质实例共享导致的副作用，每次创建独立材质
  const material = new THREE.SpriteMaterial({ map: item.texture, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  const worldWidth = worldHeight * (item.w / item.h);
  sprite.scale.set(worldWidth, worldHeight, 1);
  sprite.center.set(0.5, 0.5);
  sprite.renderOrder = 999; // 确保在球体之上渲染
  return sprite;
}