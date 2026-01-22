
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
export const clamp01 = (v) => Math.max(0.0, Math.min(1.0, v));
export const smoothstep01 = (x) => {
  const t = clamp01(x);
  return t * t * (3.0 - 2.0 * t);
};
export const smoothstep = (edge0, edge1, x) => {
  const denom = Math.max(1e-6, edge1 - edge0);
  return smoothstep01((x - edge0) / denom);
};
