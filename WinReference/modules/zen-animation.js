// modules/zen-animation.js
// 职责：统一管理进入禅定模式的3D场景动画。

import * as TWEEN from 'tween.js';
import * as THREE from 'three';
import { AppConfig } from './config.js';

/**
 * 播放“进入禅定模式”的3D场景动画
 * @param {object} targets - 包含所有需要动画的3D对象的集合
 * @param {function} onComplete - 动画全部完成后的回调函数
 */
export function playEnterAnimation(targets, onComplete) {
    const { camera, globeAssembly, stand, starfield, zenFillLight } = targets;
    const ease = TWEEN.Easing.Quadratic.InOut;
    const duration = 1200;

    new TWEEN.Tween(starfield.material).to({ opacity: 1.0 }, duration).start();
    new TWEEN.Tween(camera.position).to(new THREE.Vector3(0, 0, 10), duration).easing(ease).start();

    const tiltAngle = THREE.MathUtils.degToRad(AppConfig.GLOBE_CONFIG.axial_tilt_degrees);
    new TWEEN.Tween(globeAssembly.rotation)
      .to({ z: tiltAngle }, duration)
      .easing(TWEEN.Easing.Cubic.InOut)
      .onComplete(() => {
        animateStandAndLights(stand, zenFillLight, onComplete);
      })
      .start();
}

/**
 * 内部辅助函数，处理支架和灯光的出现动画
 */
function animateStandAndLights(stand, zenFillLight, onComplete) {
    stand.visible = true;
    stand.position.y = -0.5;
    stand.traverse(c => { if (c.isMesh) { c.material.transparent = true; c.material.opacity = 0; } });

    const opacityProxy = { value: 0 };
    new TWEEN.Tween(opacityProxy)
        .to({ value: 1 }, 800)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(() => {
            stand.traverse(c => { if (c.isMesh) c.material.opacity = opacityProxy.value; });
        })
        .onComplete(() => {
            stand.traverse(c => { if (c.isMesh) c.material.transparent = false; });
            if (onComplete) onComplete();
        })
        .start();

    new TWEEN.Tween(stand.position).to({ y: 0 }, 1000).easing(TWEEN.Easing.Cubic.Out).start();

    const sunConfig = AppConfig.ZEN_MODE_CONFIG;
    if (zenFillLight) new TWEEN.Tween(zenFillLight).to({ intensity: sunConfig.zen_fill_light_intensity }, 1200).easing(TWEEN.Easing.Quadratic.InOut).start();
}