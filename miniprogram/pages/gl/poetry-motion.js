// 职责：提供诗句移动相关的纯函数（起点、终点与贴近规则）。
// 说明：与页面状态解耦，调用方传入必要参数，便于复用与测试。

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function rand(min, max){ return min + Math.random() * (max - min); }

export function computeStartNearCenter(w, h, itemW, itemH, bounds, centerRatio = 0.35){
  const bx = bounds ? (bounds.maxX - bounds.minX) : w;
  const by = bounds ? (bounds.maxY - bounds.minY) : h;
  const cx = (bounds ? bounds.minX : 0) + bx * 0.5;
  const cy = (bounds ? bounds.minY : 0) + by * 0.5;
  const rx = bx * centerRatio * 0.5;
  const ry = by * centerRatio * 0.5;
  const rawX = rand(cx - rx, cx + rx);
  const rawY = rand(cy - ry, cy + ry);
  const x = clamp(rawX, (bounds ? bounds.minX : 0), (bounds ? bounds.maxX : w) - itemW);
  const y = clamp(rawY, (bounds ? bounds.minY : 0), (bounds ? bounds.maxY : h) - itemH);
  return { x, y };
}

/**
 * 计算移动终点（带“越靠边缘越向中上方中心偏向”的机制）
 */
export function computeMove(start, itemW, itemH, speedPxPerSec, showMs, bounds, opts = {}){
  const dist = Math.max(0, speedPxPerSec) * Math.max(0, showMs) / 1000;
  const bx = Math.max(1, (bounds.maxX - bounds.minX));
  const by = Math.max(1, (bounds.maxY - bounds.minY));
  const cx = bounds.minX + bx * 0.5;
  // 中上方中心比例（默认 35% 高度）
  const upperCenterYRatio = (typeof opts.upperCenterYRatio === 'number') ? opts.upperCenterYRatio : 0.35;
  const cyUp = bounds.minY + by * upperCenterYRatio;

  const dLeft   = Math.max(0, start.x - bounds.minX);
  const dRight  = Math.max(0, (bounds.maxX - itemW) - start.x);
  const dTop    = Math.max(0, start.y - bounds.minY);
  const dBottom = Math.max(0, (bounds.maxY - itemH) - start.y);
  const dMin = Math.min(dLeft, dRight, dTop, dBottom);
  const edgeThreshold = (typeof opts.edgeThresholdPx === 'number') ? opts.edgeThresholdPx : Math.max(24, Math.min(by, bx) * 0.25);
  const edgeScore = 1 - clamp(dMin / edgeThreshold, 0, 1); // 0=不靠边，1=贴边

  const randTheta = rand(0, Math.PI * 2);
  const randDirX = Math.cos(randTheta);
  const randDirY = Math.sin(randTheta);
  const biasX0 = (cx - start.x);
  const biasY0 = (cyUp - start.y);
  const biasLen = Math.max(1e-3, Math.sqrt(biasX0*biasX0 + biasY0*biasY0));
  const biasDirX = biasX0 / biasLen;
  const biasDirY = biasY0 / biasLen;

  const wMin = (typeof opts.wMin === 'number') ? opts.wMin : 0.30;
  const wMax = (typeof opts.wMax === 'number') ? opts.wMax : 0.68; // 贴边强化向中心
  const w = clamp(wMin + edgeScore * (wMax - wMin), wMin, wMax);

  const dirX = (biasDirX * w + randDirX * (1 - w));
  const dirY = (biasDirY * w + randDirY * (1 - w));
  const dirLen = Math.max(1e-3, Math.sqrt(dirX*dirX + dirY*dirY));
  const nx = dirX / dirLen;
  const ny = dirY / dirLen;

  let endX = start.x + dist * nx;
  let endY = start.y + dist * ny;
  endX = clamp(endX, bounds.minX, bounds.maxX - itemW);
  endY = clamp(endY, bounds.minY, bounds.maxY - itemH);
  return { endX, endY, tx: (endX - start.x), ty: (endY - start.y) };
}

export function nearbyFrom(end, itemW, itemH, bounds, limit){
  const safeEndX = clamp(end.x, bounds.minX, bounds.maxX - itemW);
  const safeEndY = clamp(end.y, bounds.minY, bounds.maxY - itemH);
  const dx = rand(-Math.max(6, limit * 0.5), Math.max(6, limit * 0.5));
  const dy = rand(-limit, limit);
  const x = clamp(safeEndX + dx, bounds.minX, bounds.maxX - itemW);
  const y = clamp(safeEndY + dy, bounds.minY, bounds.maxY - itemH);
  return { x, y };
}
// 用整个移动范围做保守检查，保证交接期间也不会重新滑进旧歌词。
// overlap / 较小文字框面积；不是按两个框的并集计算。
export function placePoetryAvoidingOverlap(start, itemW, itemH, move, bounds, previous, maxOverlap = 0.1){
  const limit = clamp(maxOverlap, 0, 1);
  const maxX = Math.max(bounds.minX, bounds.maxX - itemW);
  const maxY = Math.max(bounds.minY, bounds.maxY - itemH);
  const origin = { x: clamp(start.x, bounds.minX, maxX), y: clamp(start.y, bounds.minY, maxY) };
  const candidates = [origin];
  if (previous) {
    const xs = [origin.x, previous.x - itemW, previous.x + previous.w];
    const ys = [origin.y, previous.y - itemH, previous.y + previous.h];
    for (let i = 0; i <= 8; i++) {
      xs.push(bounds.minX + (maxX - bounds.minX)*i/8);
      ys.push(bounds.minY + (maxY - bounds.minY)*i/8);
    }
    for (const x of xs) for (const y of ys) candidates.push({
      x: clamp(x, bounds.minX, maxX), y: clamp(y, bounds.minY, maxY)
    });
    candidates.sort((a,b) => Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y));
  }
  for (const moving of [true, false]) {
    for (const point of candidates) {
      const endX = clamp(point.x + (moving ? move.tx : 0), bounds.minX, maxX);
      const endY = clamp(point.y + (moving ? move.ty : 0), bounds.minY, maxY);
      const x = Math.min(point.x, endX), y = Math.min(point.y, endY);
      const w = itemW + Math.abs(endX-point.x), h = itemH + Math.abs(endY-point.y);
      const overlap = previous ? Math.max(0, Math.min(x+w, previous.x+previous.w)-Math.max(x,previous.x)) *
        Math.max(0, Math.min(y+h, previous.y+previous.h)-Math.max(y,previous.y)) : 0;
      if (!previous || overlap <= limit * Math.min(itemW*itemH, previous.area)) {
        return { start: point, move: {endX, endY, tx:endX-point.x, ty:endY-point.y}, fits: true };
      }
    }
  }
  // 两个大文本框放不下时，由调用方收起旧句，不缩字、不延后歌词节拍。
  return {start: origin, move: {endX:origin.x,endY:origin.y,tx:0,ty:0}, fits:false};
}
