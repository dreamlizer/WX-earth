// modules/hit-test.js
// 职责：提供所有与“命中测试”相关的复杂几何计算功能。

import { geoFeatures } from './data.js';

// --- 核心导出函数：根据经纬度查找国家 ---
export function findCountryAt(lat, lon) {
    for (const f of geoFeatures) {
      if (!f || !f.geometry) continue;

      const g = f.geometry;
      if (g.type === 'Polygon') {
        if (polygonContains(g.coordinates, lat, lon)) return f;
      } else if (g.type === 'MultiPolygon') {
        for (const poly of g.coordinates) {
          if (polygonContains(poly, lat, lon)) return f;
        }
      }
    }
    // 南极洲的特殊处理
    if (lat < -60) {
      const antarctica = geoFeatures.find(f => (f.properties.ADM0_A3 === 'ATA'));
      if (antarctica) return antarctica;
    }
    return null;
}

// --- 内部辅助函数 ---

function polygonContains(poly, lat, lon) {
    if (!ringBBoxContains(poly[0], lat, lon)) return false;
    if (!pointInRing(lon, lat, poly[0])) return false;
    for (let i = 1; i < poly.length; i++) {
        if (pointInRing(lon, lat, poly[i])) return false;
    }
    return true;
}

function ringBBoxContains(ring, lat, lon) {
    let minL = Infinity, maxL = -Infinity, minA = Infinity, maxA = -Infinity;
    for (const p of ring) {
        const L = p[0], A = p[1];
        if (L < minL) minL = L;
        if (L > maxL) maxL = L;
        if (A < minA) minA = A;
        if (A > maxA) maxA = A;
    }
    const span = maxL - minL;
    const to360 = L => (L < 0 ? L + 360 : L);
    let min360 = Infinity, max360 = -Infinity;
    for (const p of ring) {
        const L = to360(p[0]);
        if (L < min360) min360 = L;
        if (L > max360) max360 = L;
    }
    const span360 = max360 - min360;

    if (span360 > 350) return lat >= minA && lat <= maxA;

    if (span <= 180) {
        return !(lat < minA || lat > maxA || lon < minL || lon > maxL);
    } else {
        const x = to360(lon);
        return !(lat < minA || lat > maxA || x < min360 || x > max360);
    }
}

function pointInRing(lon, lat, ring) {
    const EPS = 1e-9;
    const { ringAdj, x } = normalizeRingForDateline(ring, lon);
    let minX = Infinity, maxX = -Infinity;
    for (const [L] of ringAdj) {
        if (L < minX) minX = L;
        if (L > maxX) maxX = L;
    }
    let ringUse = ringAdj, xUse = x;

    if ((maxX - minX) > 350) {
        const wrapRel = d => {
            let v = d;
            while (v <= -180) v += 360;
            while (v > 180) v -= 360;
            return v;
        };
        ringUse = ringAdj.map(([L, A]) => [wrapRel(L - x), A]);
        xUse = 0;
    }

    const n = ringUse.length;
    const ringClean = (n >= 2 && ringUse[0][0] === ringUse[n - 1][0] && ringUse[0][1] === ringUse[n - 1][1]) ? ringUse.slice(0, n - 1) : ringUse;
    const y = lat + EPS;
    let inside = false;
    for (let i = 0, j = ringClean.length - 1; i < ringClean.length; j = i++) {
        const [xi, yi] = ringClean[i];
        const [xj, yj] = ringClean[j];
        if (((yi > y) !== (yj > y)) && (xUse < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

function normalizeRingForDateline(ring, testLon) {
    let min = Infinity, max = -Infinity;
    for (const p of ring) {
        const L = p[0];
        if (L < min) min = L;
        if (L > max) max = L;
    }
    if (max - min <= 180) return { ringAdj: ring, x: testLon };
    const to360 = L => (L < 0 ? L + 360 : L);
    return { ringAdj: ring.map(([L, A]) => [to360(L), A]), x: to360(testLon) };
}