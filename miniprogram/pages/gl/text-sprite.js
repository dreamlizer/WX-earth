// 文本 -> CanvasTexture -> Sprite 的轻量工具
// 仅依赖 THREE 和小程序 2D Canvas，规避第三方字体库的环境耦合

import { getSystemInfo } from './sys-info.js';

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
  // 动态超采样系数：基于设备像素比（DPR），保底 4.0，最高 6.0
  // 目标：在任何设备上都提供“视网膜级”的清晰度
  // 计算逻辑：Math.max(4.0, (DPR * 2.0)) -> 限制在 [4.0, 6.0]
  const dpr = (getSystemInfo()?.pixelRatio || 2);
  let PR = Math.min(6.0, Math.max(4.0, dpr * 2.0));
  
  const font = params.font || 'bold 34px sans-serif';
  const color = params.color || '#ffffff';
  const padding = params.padding ?? 12; // 增加默认边距，避免描边/阴影被裁切
  
  // 扁平化处理：将垂直内边距 (vPadding) 设为水平 padding 的 40%，让胶囊更扁
  const vPadding = params.capsule ? padding * 0.4 : padding;
  
  const bg = params.bg || 'transparent';
  const worldHeight = params.worldHeight ?? 0.12; // 球半径=1的世界单位高度
  const strokeColor = params.strokeColor || '#000000';
  const strokeWidth = params.strokeWidth ?? 3; // 适度描边，降低裁切风险

  const key = JSON.stringify({ text, font, color, padding, bg, strokeColor, strokeWidth, PR });
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

    // 1. 测量逻辑尺寸（在未缩放状态下）
    ctx.save();
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const metrics = ctx.measureText(text);
    const ascent = metrics.actualBoundingBoxAscent || 24;
    const descent = metrics.actualBoundingBoxDescent || 10;
    // 逻辑宽高
    const wLogical = Math.ceil((metrics.width || (text.length * 18)) + padding * 2);
    const hLogical = Math.ceil(ascent + descent + vPadding * 2);
    ctx.restore();

    // 2. 设置物理尺寸（应用超采样）
    // 限制单边最大尺寸，防止 Canvas 创建失败 (2048/4096 安全阈值)
    // 若超限，则被迫降低 PR
    const MAX_DIM = 4096;
    if (wLogical * PR > MAX_DIM || hLogical * PR > MAX_DIM) {
      PR = Math.min(PR, MAX_DIM / Math.max(wLogical, hLogical));
    }
    
    canvas.width = Math.max(4, Math.ceil(wLogical * PR));
    canvas.height = Math.max(4, Math.ceil(hLogical * PR));

    // 3. 绘制：缩放坐标系
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(PR, PR); // 坐标系放大，后续绘制参数使用逻辑值

    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    if (bg && bg !== 'transparent') {
      ctx.fillStyle = bg;
      if (params.capsule) {
        // 绘制圆角矩形（胶囊）
        const r = hLogical / 2;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(wLogical - r, 0);
        ctx.arc(wLogical - r, r, r, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(r, hLogical);
        ctx.arc(r, r, r, Math.PI / 2, -Math.PI / 2);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, wLogical, hLogical);
      }
    }
    
    // 简单阴影增强可读性（注意：shadowBlur 受 scale 影响，这里设为逻辑值即可）
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 2; // 实际物理模糊半径会是 2 * PR
    ctx.translate(wLogical / 2, hLogical / 2);

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
    
    ctx.restore(); // 恢复 context 状态

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    
    // 强制开启各向异性过滤
    try {
      const maxAniso = THREE.Capabilities?.getMaxAnisotropy?.() || 
                       (renderer?.capabilities?.getMaxAnisotropy?.()) || 1;
      if (maxAniso > 1) texture.anisotropy = Math.min(16, maxAniso);
    } catch(_){}
    
    texture.needsUpdate = true;
    item = { canvas, texture, w: canvas.width, h: canvas.height }; // 缓存物理尺寸
    __cache.set(key, item);
  }

  // ... (Material 创建部分保持不变，注意 worldWidth 计算需匹配物理尺寸比例)
  const material = new THREE.SpriteMaterial({
    map: item.texture,
    transparent: true,
    depthTest: (params.depthTest === true),
    depthWrite: (params.depthWrite === true)
  });
  const sprite = new THREE.Sprite(material);
  // item.w / item.h 是物理宽高比，等于逻辑宽高比，所以 worldWidth 计算正确
  const worldWidth = worldHeight * (item.w / item.h);
  sprite.scale.set(worldWidth, worldHeight, 1);
  sprite.center.set(0.5, 0.5);
  // 默认置顶；如需被地球遮挡，调用方可传入较低 renderOrder
  sprite.renderOrder = (typeof params.renderOrder === 'number') ? params.renderOrder : 999;
  return sprite;
}
