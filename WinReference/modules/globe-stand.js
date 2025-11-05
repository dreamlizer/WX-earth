// modules/globe-stand.js
// 职责：只创建地球仪的支架（底座、垂直支撑杆、倾斜的子午圈）。

import * as THREE from 'three';

/**
 * 创建地球仪支架
 * @param {object} options
 * @param {object} options.config - AppConfig 配置文件对象
 * @returns {THREE.Group} - 包含完整支架的Three.js组对象
 */
export function createGlobeStand({ config }) {
    const standGroup = new THREE.Group();
    const standMaterial = new THREE.MeshStandardMaterial(config.GLOBE_STAND_MATERIAL);
    // ▼▼▼ 核心修改：引用新的几何配置 ▼▼▼
    const geo = config.GLOBE_STAND_GEOMETRY;
    // ▲▲▲ 核心修改 ▲▲▲

    // --- 1. 创建固定部分：底座和垂直支撑杆 ---
    const baseGroup = new THREE.Group();
    // ▼▼▼ 核心修改：使用配置参数 ▼▼▼
    const baseGeometry1 = new THREE.CylinderGeometry(geo.base_part1_radius, geo.base_part1_radius, geo.base_part1_height, 64);
    const base1 = new THREE.Mesh(baseGeometry1, standMaterial);
    const baseGeometry2 = new THREE.CylinderGeometry(geo.base_part2_radius, geo.base_part2_radius, geo.base_part2_height, 64);
    // ▲▲▲ 核心修改 ▲▲▲
    const base2 = new THREE.Mesh(baseGeometry2, standMaterial);
    base2.position.y = geo.base_part1_height / 2 + geo.base_part2_height / 2; // 确保正确堆叠
    baseGroup.add(base1, base2);
    baseGroup.position.y = config.GLOBE_CONFIG.base_y_position;
    baseGroup.name = 'stand_base_group';
    standGroup.add(baseGroup);

    const baseTopY = baseGroup.position.y + base2.position.y + (geo.base_part2_height / 2);
    const supportPoleTopY = 0;
    const supportHeight = supportPoleTopY - baseTopY;
    // ▼▼▼ 核心修改：使用配置参数 ▼▼▼
    const supportRadius = geo.support_radius;
    // ▲▲▲ 核心修改 ▲▲▲
    const supportGeometry = new THREE.CylinderGeometry(supportRadius, supportRadius, supportHeight, 16);
    const supportPole = new THREE.Mesh(supportGeometry, standMaterial);
    supportPole.position.y = (supportPoleTopY + baseTopY) / 2;
    supportPole.name = 'stand_support_pole';
    standGroup.add(supportPole);


    // --- 2. 创建倾斜部分：子午圈和转轴 ---
    const tiltedRingGroup = new THREE.Group();
    const EARTH_RADIUS = 2; // 仅用于计算的内部常量
    // ▼▼▼ 核心修改：使用配置参数 ▼▼▼
    const cloudRadius = EARTH_RADIUS + geo.cloud_offset;
    const ringCenterRadius = cloudRadius + geo.ring_gap + (geo.ring_width / 2);

    const ringGeometry = new THREE.TorusGeometry(ringCenterRadius, geo.ring_width / 2, 16, 100, Math.PI);
    // ▲▲▲ 核心修改 ▲▲▲
    const ring = new THREE.Mesh(ringGeometry, standMaterial);
    ring.rotation.x = Math.PI;
    ring.rotation.z = -Math.PI / 2;
    ring.rotation.y = Math.PI;
    tiltedRingGroup.add(ring);

    // ▼▼▼ 核心修改：使用配置参数 ▼▼▼
    const pivotHeight = geo.pivot_height;
    const pivotRadius = geo.pivot_radius;
    // ▲▲▲ 核心修改 ▲▲▲
    const pivotGeometry = new THREE.CylinderGeometry(pivotRadius, pivotRadius, pivotHeight, 16);
    const northPivot = new THREE.Mesh(pivotGeometry, standMaterial);
    northPivot.position.y = ringCenterRadius;
    tiltedRingGroup.add(northPivot);
    const southPivot = new THREE.Mesh(pivotGeometry, standMaterial);
    southPivot.position.y = -ringCenterRadius;
    tiltedRingGroup.add(southPivot);

    const tiltRadians = THREE.MathUtils.degToRad(config.GLOBE_CONFIG.axial_tilt_degrees);
    tiltedRingGroup.rotation.z = tiltRadians;
    tiltedRingGroup.name = 'stand_ring_group';

    standGroup.add(tiltedRingGroup);

    return standGroup;
}