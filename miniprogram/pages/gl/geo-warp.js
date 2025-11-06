// 轻量形变校正（Warp Grid）
// 目标：对 (lon, lat) 做微小位移以贴合底图视觉差异
// 说明：默认不启用；开启后按锚点的高斯权重叠加位移

import { APP_CFG } from './config.js';

// 常量集中：单位均为“度”
const DEFAULT_STRENGTH = 1.0; // 位移强度乘因子
const DEFAULT_SIGMA = 2.5;    // 高斯影响半径（σ，度）

// 锚点示例（东亚近海的初始微调；可根据诊断数据更新）
// 每个锚点：中心经纬 + 建议位移量（度）+ 可选覆盖半径
// 注意：这是轻微示例值，尽量控制在 0.1° 以内，避免明显错位
const ANCHORS = [
  // 渤海湾（天津附近）
  { lon: 117.5, lat: 39.0, dlon: -0.06, dlat: -0.02, radius: 4.0 },
  // 山东半岛东端
  { lon: 122.5, lat: 37.5, dlon: -0.05, dlat: -0.02, radius: 4.0 },
  // 朝鲜半岛西岸（平壤附近）
  { lon: 125.5, lat: 39.0, dlon: -0.05, dlat: -0.02, radius: 4.5 },
  // 黄海中部（缓和整体）
  { lon: 123.0, lat: 36.0, dlon: -0.04, dlat: -0.01, radius: 5.0 },
];

export function getAnchors(){ return ANCHORS.slice(); }

// 高斯权重（基于球面近似的经纬度距离，简化为平面小角度）
function weightGaussian(dDeg, sigma){
  const s = sigma > 0 ? sigma : DEFAULT_SIGMA;
  const k = -0.5 * (dDeg * dDeg) / (s * s);
  return Math.exp(k);
}

function degDistance(aLon, aLat, bLon, bLat){
  const dLon = aLon - bLon;
  const dLat = aLat - bLat;
  // 近似：小角度下的欧氏距离（度）
  return Math.sqrt(dLon * dLon + dLat * dLat);
}

// 应用形变：输入/输出为度
export function applyWarp(lon, lat){
  try {
    const warpCfg = (APP_CFG?.warp) || {};
    if (!warpCfg.enabled) return [lon, lat];
    const strength = (typeof warpCfg.strength === 'number') ? warpCfg.strength : DEFAULT_STRENGTH;
    const sigma = (typeof warpCfg.sigmaDeg === 'number') ? warpCfg.sigmaDeg : DEFAULT_SIGMA;
    let sumW = 0, sumDLon = 0, sumDLat = 0;
    for (const a of ANCHORS){
      const r = (typeof a.radius === 'number') ? a.radius : sigma;
      const d = degDistance(lon, lat, a.lon, a.lat);
      if (d > r * 3) continue; // 远离 3σ 直接忽略
      const w = weightGaussian(d, r);
      sumW += w;
      sumDLon += w * (a.dlon || 0);
      sumDLat += w * (a.dlat || 0);
    }
    if (sumW <= 1e-6) return [lon, lat];
    const adjLon = lon + strength * (sumDLon / sumW);
    const adjLat = lat + strength * (sumDLat / sumW);
    return [adjLon, adjLat];
  } catch(_){ return [lon, lat]; }
}