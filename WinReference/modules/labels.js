// modules/labels.js
// 职责：作为标签系统的“总指挥”，管理状态并调度 selection 和 renderer 模块。

import * as THREE from 'three';
import { camera, renderer, globeAssembly } from './scene.js';
import { selectWinningLabels } from './label-selection.js';
import { renderLabels } from './label-renderer.js';
import { LABEL_SELECT_INTERVAL_MS } from './label-constants.js';

const _sticky = new Map();
const _stickByLabel = new Map();
let _lastSelectTs = 0;
let _selectedCache = [];
const tempVec = new THREE.Vector3();

// ▼▼▼ 核心修改：函数签名增加 labelDensity 参数 ▼▼▼
export function updateLabels(focusedCountryCode, labelDensity) {
  // ▲▲▲ 核心修改 ▲▲▲
  globeAssembly.updateMatrixWorld(true);
  const rect = renderer.domElement.getBoundingClientRect();
  const W = rect.width, H = rect.height, LEFT = rect.left, TOP = rect.top;
  const camN = camera.position.clone().normalize();
  const now = performance.now();
  if ((now - _lastSelectTs) >= LABEL_SELECT_INTERVAL_MS) {
    // ▼▼▼ 核心修改：将 labelDensity 传递给筛选函数 ▼▼▼
    _selectedCache = selectWinningLabels(now, W, H, LEFT, TOP, camN, focusedCountryCode, _sticky, _stickByLabel, labelDensity);
    // ▲▲▲ 核心修改 ▲▲▲
    _lastSelectTs = now;
  }
  renderLabels(_selectedCache, W, H, LEFT, TOP, camN);
}