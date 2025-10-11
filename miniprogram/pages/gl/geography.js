// 地理与几何内核（纯函数）
// 所有外部接口使用 (lon, lat) 度数，内部自行做弧度换算

const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;

// 经度归一化到 [-180, 180)
export function normalizeLon(lon) {
  let x = lon;
  while (x <= -180) x += 360;
  while (x > 180) x -= 360;
  return x;
}

// 以 centerLon 为中心展开经度，使其落在 [centerLon-180, centerLon+180) 连续区间
export function wrapLonTo(lon, centerLon) {
  let x = lon;
  while ((x - centerLon) <= -180) x += 360;
  while ((x - centerLon) > 180) x -= 360;
  return x;
}

// 经纬 -> 球面三维坐标（右手系，贴图对齐 lon+180）
export function convertLatLonToVec3(lon, lat, radius = 1) {
  const phi = toRad(90 - lat);
  const theta = toRad(lon + 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z =  radius * Math.sin(phi) * Math.sin(theta);
  const y =  radius * Math.cos(phi);
  return { x, y, z };
}

// 球面三维 -> 经纬（自动根据向量长度计算半径）
export function convertVec3ToLatLon(x, y, z) {
  const r = Math.sqrt(x * x + y * y + z * z) || 1;
  let lon = -toDeg(Math.atan2(z, x));
  const lat = toDeg(Math.asin(y / r));
  // C-1 开关位（如需同号测试，在调用侧通过 setDebugFlags 控制，这里仅保留规范默认）
  lon = normalizeLon(lon);
  return [lon, lat];
}

// 计算在指定 centerLon 展开的包围盒（Polygon / MultiPolygon）
export function bboxOfWrapped(feature, centerLon) {
  let minLon = 181, minLat = 91, maxLon = -181, maxLat = -91;
  const scan = (p) => {
    const wx = wrapLonTo(p[0], centerLon);
    const ly = p[1];
    if (wx < minLon) minLon = wx;
    if (ly < minLat) minLat = ly;
    if (wx > maxLon) maxLon = wx;
    if (ly > maxLat) maxLat = ly;
  };
  if (feature.type === 'Polygon') {
    feature.coords.forEach(r => r.forEach(scan));
  } else if (feature.type === 'MultiPolygon') {
    feature.coords.forEach(poly => poly.forEach(r => r.forEach(scan)));
  }
  return [minLon, minLat, maxLon, maxLat];
}

const inBox = (b, lon, lat) => lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3];

// 射线法（经度按 centerLon 展开后再计算）
export function pointInRingWrapped(lon, lat, ring, centerLon) {
  const testX = wrapLonTo(lon, centerLon);
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = wrapLonTo(ring[i][0], centerLon), yi = ring[i][1];
    const xj = wrapLonTo(ring[j][0], centerLon), yj = ring[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) && (testX < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// 面命中（MultiPolygon 排除洞）：
// 先用 bboxOfWrapped(centerLon=lon) 粗过滤，再对外环命中且不在洞内时返回 true
export function featureContains(lon, lat, feature) {
  const centerLon = lon;
  const bbox = bboxOfWrapped(feature, centerLon);
  const wlon = wrapLonTo(lon, centerLon);
  if (!inBox(bbox, wlon, lat)) return false;

  const cs = feature.coords;
  if (feature.type === 'Polygon') {
    if (!pointInRingWrapped(wlon, lat, cs[0], centerLon)) return false;
    for (let k = 1; k < cs.length; k++) {
      if (pointInRingWrapped(wlon, lat, cs[k], centerLon)) return false; // 落在洞内
    }
    return true;
  } else if (feature.type === 'MultiPolygon') {
    for (const poly of cs) {
      if (!pointInRingWrapped(wlon, lat, poly[0], centerLon)) continue;
      let inHole = false;
      for (let k = 1; k < poly.length; k++) {
        if (pointInRingWrapped(wlon, lat, poly[k], centerLon)) { inHole = true; break; }
      }
      if (!inHole) return true;
    }
    return false;
  }
  return false;
}