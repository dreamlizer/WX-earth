// 地理数据索引与加载
// 提供：loadCountries、bboxOf、buildIndex、gatherCandidates

import { normalizeLon } from './geography.js';

export function bboxOf(type, coords) {
  let minLon = 181, minLat = 91, maxLon = -181, maxLat = -91;
  const scan = p => { const lon = p[0], lat = p[1]; if (lon < minLon) minLon = lon; if (lat < minLat) minLat = lat; if (lon > maxLon) maxLon = lon; if (lat > maxLat) maxLat = lat; };
  if (type === 'Polygon') coords.forEach(r => r.forEach(scan));
  else if (type === 'MultiPolygon') coords.forEach(poly => poly.forEach(r => r.forEach(scan)));
  return [minLon, minLat, maxLon, maxLat];
}

export function loadCountries() {
  return new Promise((resolve, reject) => {
    try {
      const gj = require('../../assets/data/countries.json.js');
      const features = gj.features.map(f => ({
        props: f.properties || {},
        type: f.geometry.type,
        coords: f.geometry.coordinates || [],
        bbox: bboxOf(f.geometry.type, f.geometry.coordinates || [])
      }));
      resolve(features);
    } catch (e) { reject(e); }
  });
}

export function buildIndex(features) {
  // 基于经纬度网格的空间索引：将国家按包围盒投影到 1° 网格中，以快速缩小候选集
  const cellSize = 1; // 1° 网格
  const lonBuckets = Math.floor(360 / cellSize); // 360
  const latBuckets = Math.floor(180 / cellSize); // 180
  const grid = Object.create(null);
  const keyOf = (lx, ly) => `${lx}_${ly}`;
  const addCell = (lx, ly, fid) => {
    if (lx < 0 || lx >= lonBuckets || ly < 0 || ly >= latBuckets) return;
    const k = keyOf(lx, ly);
    const arr = grid[k] || (grid[k] = []);
    arr.push(fid);
  };
  const lonToIdx = (lon) => {
    const x = Math.floor((normalizeLon(lon) + 180) / cellSize);
    return Math.max(0, Math.min(lonBuckets - 1, x));
  };
  const latToIdx = (lat) => {
    const y = Math.floor((lat + 90) / cellSize);
    return Math.max(0, Math.min(latBuckets - 1, y));
  };

  features.forEach((f, fid) => {
    let [minLon, minLat, maxLon, maxLat] = f.bbox;
    minLon = normalizeLon(minLon); maxLon = normalizeLon(maxLon);
    // 反经线跨越检测：若跨度 > 180°，则拆分为两段覆盖
    const span = ((maxLon - minLon) + 360) % 360;
    const lonRanges = span > 180
      ? [[-180, maxLon], [minLon, 180]]
      : [[minLon, maxLon]];
    const latStart = latToIdx(minLat), latEnd = latToIdx(maxLat);
    for (const [a, b] of lonRanges) {
      const lonStart = lonToIdx(a), lonEnd = lonToIdx(b);
      const s = Math.min(lonStart, lonEnd), e = Math.max(lonStart, lonEnd);
      for (let ly = Math.min(latStart, latEnd); ly <= Math.max(latStart, latEnd); ly++) {
        for (let lx = s; lx <= e; lx++) addCell(lx, ly, fid);
      }
    }
  });
  return { grid, cellSize, lonBuckets, latBuckets };
}

export function gatherCandidates(search, lon, lat, limit) {
  // 在网格中按同心圈逐步放宽，收集候选国家 ID
  if (!search || !search.grid) return [];
  const lonBuckets = search.lonBuckets, latBuckets = search.latBuckets;
  const cellSize = search.cellSize;
  const lonIdx = Math.floor((normalizeLon(lon) + 180) / cellSize);
  const latIdx = Math.floor((lat + 90) / cellSize);
  const seen = new Set();
  const result = [];
  const keyOf = (lx, ly) => `${lx}_${ly}`;
  const clampLat = (v) => Math.max(0, Math.min(latBuckets - 1, v));
  const wrapLon = (v) => (v % lonBuckets + lonBuckets) % lonBuckets;

  const radii = [0, 1, 2, 3, 4, 6, 8];
  for (const r of radii) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const lx = wrapLon(lonIdx + dx);
        const ly = clampLat(latIdx + dy);
        const k = keyOf(lx, ly);
        const cell = search.grid[k];
        if (!cell) continue;
        for (const fid of cell) {
          if (!seen.has(fid)) {
            seen.add(fid);
            result.push(fid);
            if (result.length >= limit) return result;
          }
        }
      }
    }
  }
  return result;
}