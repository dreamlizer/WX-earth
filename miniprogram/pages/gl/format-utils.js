
// —— 数字格式化：跨端一致的千分位（避免部分手机不支持 toLocaleString 分组）
export const formatThousandsInt = (n) => {
  try {
    const v = Math.round(Number(n));
    if (!isFinite(v)) return '--';
    // 纯正则方案：兼容所有安卓/iOS版本（Intl 在旧版 WebView 可能缺失或行为不一致）
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  } catch(_){ return '--'; }
};

export const formatThousandsFixed = (n, digits = 2) => {
  try {
    const v = Number(n);
    if (!isFinite(v)) return '--';
    const fixed = v.toFixed(digits);
    const parts = fixed.split('.');
    const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? `${int}.${parts[1]}` : int;
  } catch(_){ return '--'; }
};
