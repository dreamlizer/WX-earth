// 触控工具：把任意组件触摸事件统一转换到 canvas 坐标系（x/y），纯函数实现

/**
 * 将事件中的触点坐标映射到画布坐标（相对 rect 左上角，裁剪到范围内）。
 * 输入为 WeChat 事件对象和已测量的 canvas 边界矩形。
 */
export function normalizeToCanvasTouches(e, rect){
  const ts = (e && e.touches) ? e.touches : [];
  if (!rect || !ts || ts.length === 0) return e;
  const mapped = ts.map(t => {
    const px = (t.pageX ?? t.clientX ?? t.x ?? 0);
    const py = (t.pageY ?? t.clientY ?? t.y ?? 0);
    const x = Math.max(0, Math.min(rect.width,  px - rect.left));
    const y = Math.max(0, Math.min(rect.height, py - rect.top));
    return { x, y };
  });
  return { touches: mapped };
}