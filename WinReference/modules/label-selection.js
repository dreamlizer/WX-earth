// modules/label-selection.js
// 职责：实现标签的筛选核心算法，根据一系列规则（LOD、视角、分数、碰撞）选出“获胜”的标签。

import * as THREE from 'three';
import { camera, globeAssembly } from './scene.js';
import { labels, extraData, propsByCode } from './data.js';
import { AppConfig } from './config.js';

import {
    LABEL_CUTOFF, LABEL_FADEIN, EDGE_FADE_PX, GRID_SIZE,
    LOD_NEAR_DIST_COUNTRY, LOD_FAR_DIST_COUNTRY,
    AREA_MIN_FAR, AREA_MIN_MID, POP_MIN_FAR, POP_MIN_MID,
    LOD_CITIES_START_APPEAR, LOD_CITIES_ALL_APPEAR,
    SCORE_BONUS_COUNTRY, SCORE_BONUS_CITY, IMPORTANCE_BONUS_FACTOR,
    STICKY_SWITCH_GAIN, STICKY_LABEL_BONUS,
    FORCE_DISPLAY_MAX_DIST, FORCE_DISPLAY_RADIUS_PX, FORCE_DISPLAY_SCORE_MULTIPLIER
} from './label-constants.js';

const tempVec = new THREE.Vector3();
const worldPos = new THREE.Vector3();

// ▼▼▼ 核心修改：函数签名增加 labelDensity 参数 ▼▼▼
export function selectWinningLabels(now, W, H, LEFT, TOP, camN, focusedCountryCode, _sticky, _stickByLabel, labelDensity) {
    // ▲▲▲ 核心修改 ▲▲▲

    // ▼▼▼ 核心修改：处理“无”标签的情况 ▼▼▼
    if (labelDensity === 'none') {
        return []; // 如果设置为无，直接返回空数组，不显示任何标签
    }
    // ▲▲▲ 核心修改 ▲▲▲

    const camDistance = camera.position.length();
    const { level: countryLodLevel, factor: budgetFactor } = getCountryLodInfo(camDistance);

    // ▼▼▼ 核心修改：根据密度系数调整标签预算 ▼▼▼
    const densityModifier = AppConfig.LABEL_DENSITY_MODIFIERS[labelDensity] || 1.0;
    const baseBudget = (W < 768 ? AppConfig.MAX_LABELS_MOBILE : AppConfig.MAX_LABELS_DESKTOP) * densityModifier;
    // ▲▲▲ 核心修改 ▲▲▲
    const budget = Math.max(10, Math.round(baseBudget * budgetFactor));

    const candidates = [];

    for (const lbl of labels) {
        worldPos.copy(lbl.position).applyMatrix4(globeAssembly.matrixWorld);
        const normal = worldPos.clone().normalize();
        const viewVec = tempVec.subVectors(camera.position, worldPos).normalize();
        const dot = normal.dot(viewVec);
        if (dot <= LABEL_CUTOFF) continue;
        if (lbl.type === 'country') {
            if (!passesCountryLOD(lbl.code, countryLodLevel)) continue;
        } else if (lbl.type === 'city') {
            if (camDistance > LOD_CITIES_START_APPEAR) continue;
            if (lbl.importance < 2 && camDistance > LOD_CITIES_ALL_APPEAR) continue;
            if (focusedCountryCode && lbl.country_code !== focusedCountryCode) continue;
        }
        const screenPosVec = worldPos.clone().project(camera);
        const ax = (screenPosVec.x * 0.5 + 0.5) * W + LEFT;
        const ay = (screenPosVec.y * -0.5 + 0.5) * H + TOP;
        let alpha = (dot - LABEL_CUTOFF) / (LABEL_FADEIN - LABEL_CUTOFF);
        alpha = Math.max(0, Math.min(1, alpha));
        const xRel = ax - LEFT, yRel = ay - TOP;
        const edgeFade = Math.min(xRel / EDGE_FADE_PX, (W - xRel) / EDGE_FADE_PX, yRel / EDGE_FADE_PX, (H - yRel) / EDGE_FADE_PX);
        alpha *= Math.max(0, Math.min(1, edgeFade));
        if (alpha <= 0.02) continue;
        const centerBoost = 1 / (1 + Math.hypot(xRel - W / 2, yRel - H / 2) / 300);
        let score = alpha * (0.6 + 0.4 * dot) * centerBoost;
        if (lbl.importance > 1) score *= (1 + lbl.importance * IMPORTANCE_BONUS_FACTOR);
        if (lbl.type === 'country') score *= SCORE_BONUS_COUNTRY;
        else score *= SCORE_BONUS_CITY;
        if (lbl.type === 'city' && focusedCountryCode && lbl.country_code === focusedCountryCode) score *= AppConfig.FOCUSED_COUNTRY_CITY_SCORE_BOOST;
        const isNearCenter = Math.hypot(xRel - W / 2, yRel - H / 2) < FORCE_DISPLAY_RADIUS_PX;
        if (camDistance < FORCE_DISPLAY_MAX_DIST && isNearCenter) score *= FORCE_DISPLAY_SCORE_MULTIPLIER;
        const seen = _stickByLabel.get(lbl);
        if (seen && now < seen.till) score *= (1 + STICKY_LABEL_BONUS);
        candidates.push({ lbl, score, x: xRel, y: yRel });
    }

    const gridBest = new Map();
    for (const cand of candidates) {
        const key = `${Math.floor(cand.x / GRID_SIZE)},${Math.floor(cand.y / GRID_SIZE)}`;
        const exist = gridBest.get(key);
        if (!exist || cand.score > exist.score) gridBest.set(key, { lbl: cand.lbl, score: cand.score });
    }

    const chosenByCell = new Map();
    for (const [key, cand] of gridBest.entries()) {
        const prev = _sticky.get(key);
        if (prev && now < prev.till && prev.lbl && (!cand || cand.score < prev.score * (1 + STICKY_SWITCH_GAIN))) chosenByCell.set(key, prev);
        else {
            const next = { lbl: cand.lbl, score: cand.score, till: now + AppConfig.LABEL_STICKY_DURATION_MS };
            _sticky.set(key, next);
            chosenByCell.set(key, next);
        }
    }
    _sticky.forEach((v, key) => { if (now >= v.till) _sticky.delete(key); });

    let winners = Array.from(chosenByCell.values());
    winners.sort((a, b) => b.score - a.score);

    const selected = winners.slice(0, budget);
    selected.forEach(e => _stickByLabel.set(e.lbl, { till: now + AppConfig.LABEL_STICKY_DURATION_MS }));

    return selected;
}

// ... getCountryLodInfo 和 passesCountryLOD 函数无变化 ...
function getCountryLodInfo(dist){let level="mid";dist<=LOD_NEAR_DIST_COUNTRY?level="near":dist>=LOD_FAR_DIST_COUNTRY&&(level="far");const budgetFactor={near:1.2,mid:1,far:.6}[level];return{level,factor:budgetFactor}}function passesCountryLOD(code,lodLevel){if(!code)return!0;const area=extraData[code]&&+extraData[code].AREA_KM2||null,pop=propsByCode[code]&&+propsByCode[code].POP_EST||null;return"near"===lodLevel?!0:"mid"===lodLevel?null==area||null==pop||!(area<AREA_MIN_MID&&pop<POP_MIN_MID):null==area||null==pop||!(area<AREA_MIN_FAR&&pop<POP_MIN_FAR)}