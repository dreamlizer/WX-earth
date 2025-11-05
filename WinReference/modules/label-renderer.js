// modules/label-renderer.js
// 职责：负责将筛选出的标签渲染到屏幕上，处理它们的位置、透明度和字体大小动画。

import * as THREE from 'three';
import { camera, globeAssembly } from './scene.js';
import { labels } from './data.js';
import { AppConfig } from './config.js';

import {
    LABEL_CUTOFF, LABEL_FADEIN, EDGE_FADE_PX,
    POS_SMOOTH, ALPHA_SMOOTH,
    FONT_SCALE_MIN_DIST, FONT_SCALE_MAX_DIST,
} from './label-constants.js';

const tempVec = new THREE.Vector3();
const worldPos = new THREE.Vector3();

/**
 * 将标签渲染到 DOM
 */
export function renderLabels(selectedCache, W, H, LEFT, TOP, camN) {
    const selectedSet = new Set(selectedCache.map(e => e.lbl));
    const camDistance = camera.position.length();

    for (const lbl of labels) {
        const wasVisible = (lbl._alpha ?? 0) > 0.01;
        const isSelected = selectedSet.has(lbl);
        if (!isSelected && !wasVisible) {
            if (lbl.element.style.display !== 'none') lbl.element.style.display = 'none';
            continue;
        }

        worldPos.copy(lbl.position).applyMatrix4(globeAssembly.matrixWorld);

        const screenPosVec = worldPos.clone().project(camera);
        const ax = (screenPosVec.x * 0.5 + 0.5) * W + LEFT;
        const ay = (screenPosVec.y * -0.5 + 0.5) * H + TOP;

        // --- ★ 核心修正: 同样采用更精确的几何方法来计算透明度 ---
        const normal = worldPos.clone().normalize();
        const viewVec = tempVec.subVectors(camera.position, worldPos).normalize();
        const dot = normal.dot(viewVec);

        let alphaNow = Math.max(0, Math.min(1, (dot - LABEL_CUTOFF) / (LABEL_FADEIN - LABEL_CUTOFF)));
        const xRel = ax - LEFT, yRel = ay - TOP;
        const edgeFade = Math.min(xRel / EDGE_FADE_PX, (W - xRel) / EDGE_FADE_PX, yRel / EDGE_FADE_PX, (H - yRel) / EDGE_FADE_PX);
        alphaNow *= Math.max(0, Math.min(1, edgeFade));
        const targetAlpha = isSelected ? alphaNow : 0;

        const px = (lbl._px ?? ax) + (ax - (lbl._px ?? ax)) * POS_SMOOTH;
        const py = (lbl._py ?? ay) + (ay - (lbl._py ?? ay)) * POS_SMOOTH;
        const pa = (lbl._alpha ?? 0) + (targetAlpha - (lbl._alpha ?? 0)) * ALPHA_SMOOTH;
        lbl._px = px; lbl._py = py; lbl._alpha = pa;

        if (pa <= 0.015) {
            if (lbl.element.style.display !== 'none') lbl.element.style.display = 'none';
            continue;
        }

        if (lbl.element.style.display !== 'block') lbl.element.style.display = 'block';
        lbl.element.style.transform = `translate(-50%, -50%) translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
        lbl.element.style.opacity = pa.toFixed(3);

        const FONT_BASE_SIZE = AppConfig.LABEL_FONT_BASE_SIZE;
        const FONT_MAX_SIZE = AppConfig.LABEL_FONT_MAX_SIZE;

        const scaleRange = FONT_SCALE_MAX_DIST - FONT_SCALE_MIN_DIST;
        const distInRange = Math.max(0, Math.min(scaleRange, FONT_SCALE_MAX_DIST - camDistance));
        let scaleFactor = distInRange / scaleRange;
        scaleFactor = Math.sin(scaleFactor * Math.PI / 2);
        const fontSize = FONT_BASE_SIZE + (FONT_MAX_SIZE - FONT_BASE_SIZE) * scaleFactor;
        lbl.element.style.fontSize = `${fontSize.toFixed(1)}px`;
    }
}