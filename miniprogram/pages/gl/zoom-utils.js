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

/**
 * 计算滚轮缩放后的下一值
 * @param {number} current - 当前缩放值
 * @param {number} dy - 事件的 deltaY（>0 向下）
 * @param {number} min - 允许的最小值（例如 0.6）
 * @param {number} max - 允许的最大值（例如 2.86）
 * @param {number} stepAbs - 单步变化绝对值（默认 0.08）
 */
export function computeWheelZoom(current, dy, min, max, stepAbs = 0.08) {
  const step = dy > 0 ? -Math.abs(stepAbs) : (dy < 0 ? Math.abs(stepAbs) : 0);
  const next = current + step;
  return clamp(next, min, max);
}

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