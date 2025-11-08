// 抽离：缩放计算工具（纯函数）
// 目标：统一滚轮与按钮缩放的数值计算与边界处理，页面层仅负责读取事件与调用 setZoom

/**
 * 数值钳制到区间 [min, max]
 */
export function clamp(value, min, max) {
  const lo = Number.isFinite(min) ? min : Number.NEGATIVE_INFINITY;
  const hi = Number.isFinite(max) ? max : Number.POSITIVE_INFINITY;
  return Math.max(lo, Math.min(hi, value));
}

// 已移除：滚轮缩放计算（不再支持）

/**
 * 计算按钮加减缩放后的下一值
 * @param {number} current - 当前缩放值
 * @param {number} step - 增量（正加负减）例如 +0.08 / -0.08
 * @param {number} min - 最小值（可传 -Infinity 表示不限制）
 * @param {number} max - 最大值（可传 +Infinity 表示不限制）
 */
export function computeIncrement(current, step, min, max) {
  const next = current + step;
  return clamp(next, min, max);
}