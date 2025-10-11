// Lightweight fallback tz-lookup: returns timezone offset in minutes based on longitude.
// NOTE: This is an approximation by rounding longitude/15 to the nearest hour.
// For full accuracy (political time zones, DST), replace with a real tz-lookup library.

// 高精度 IANA 时区映射：使用 geo-tz 根据纬度/经度返回 IANA 时区字符串
// 参考：https://www.npmjs.com/package/geo-tz

// IANA 时区查询器：优先使用 geo-tz（高精度），不可用时回退到经度估算的 Etc/GMT±N
// 说明：Etc/GMT 的符号与常规相反，UTC+8 对应 "Etc/GMT-8"；UTC-5 对应 "Etc/GMT+5"

let __findGeoTz = null;
try {
  // 在已构建 npm 的小程序环境下可用
  const mod = require('geo-tz');
  __findGeoTz = (mod && (mod.find || (mod.default && mod.default.find))) || null;
} catch (e) {
  __findGeoTz = null;
}

export default function tzlookup(lat, lon) {
  if (!isFinite(lat) || !isFinite(lon)) return null;
  try {
    if (typeof __findGeoTz === 'function') {
      const tz = __findGeoTz(lat, lon);
      return Array.isArray(tz) ? (tz[0] || null) : (tz || null);
    }
    const hours = Math.round(lon / 15); // 每 15° 经度约一小时
    const zone = hours === 0 ? 'Etc/GMT' : `Etc/GMT${hours > 0 ? '-' : '+'}${Math.abs(hours)}`;
    return zone;
  } catch (e) {
    console.warn('[tzlookup] failed:', e);
    return null;
  }
}