// modules/right-sun-overlay.js
// 职责：创建一个独立的“日面”覆盖层，用于在禅定模式下模拟太阳光照效果。

import * as THREE from 'three';
import * as TWEEN from 'tween.js';
import { EARTH_RADIUS } from './scene.js';
import { AppConfig } from './config.js'; // 导入配置

const vertexShader=`varying vec3 vWorldNormal;varying vec3 vViewDirection;varying vec2 vUv;void main(){vUv=uv;vec4 worldPosition=modelMatrix*vec4(position,1.0);vWorldNormal=normalize(mat3(modelMatrix)*normal);vViewDirection=normalize(cameraPosition-worldPosition.xyz);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

const fragmentShader = `
  uniform sampler2D uDayTexture;
  uniform vec3 uSunDirection;
  uniform float uOpacity;

  // ▼▼▼ 新增 uniforms，用于接收来自 JS 的参数 ▼▼▼
  uniform float uBrightnessBoost;
  uniform float uTerminatorStart;
  uniform float uTerminatorEnd;
  // ▲▲▲ 新增 uniforms ▲▲▲

  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;
  varying vec2 vUv;

  void main() {
    float sunDot = dot(vWorldNormal, uSunDirection);

    // ▼▼▼ 使用 uniform 替代硬编码 ▼▼▼
    float terminatorMask = smoothstep(uTerminatorStart, uTerminatorEnd, sunDot);

    vec3 dayColor = texture2D(uDayTexture, vUv).rgb;

    // ▼▼▼ 使用 uniform 替代硬编码 ▼▼▼
    float diffuseBoost = pow(max(0.0, sunDot), 1.5) * uBrightnessBoost;
    vec3 boostedDayColor = dayColor + dayColor * diffuseBoost;

    vec3 specularHighlight = vec3(0.0);

    vec3 finalColor = boostedDayColor + specularHighlight;
    float finalAlpha = terminatorMask * uOpacity;

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

/**
 * 创建并管理日面覆盖层对象
 * @param {object} options - 配置
 * @param {THREE.Texture} options.dayTexture - 白天地球贴图
 * @returns {object} - 覆盖层控制器
 */
export function createRightSunOverlay({ dayTexture }) {
  const geometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.002, 64, 64);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uDayTexture: { value: dayTexture },
      uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
      uOpacity: { value: 0.0 },
      // ▼▼▼ 初始化新增的 uniforms，使用 config 中的默认值 ▼▼▼
      uBrightnessBoost: { value: AppConfig.ZEN_MODE_CONFIG.day_side_brightness_boost },
      uTerminatorStart: { value: AppConfig.ZEN_MODE_CONFIG.terminator_softness_start },
      uTerminatorEnd: { value: AppConfig.ZEN_MODE_CONFIG.terminator_softness_end },
      // ▲▲▲ 初始化新增的 uniforms ▲▲▲
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'day_overlay';
  mesh.renderOrder = 10;
  mesh.visible = false;

  const controller = {
    mesh,
    _tween: null,
    setEnabled(enabled) { mesh.visible = enabled; },
    setSunDirection(directionVec3) { material.uniforms.uSunDirection.value.copy(directionVec3); },
    setTexture(newTexture) { material.uniforms.uDayTexture.value = newTexture; },

    // ▼▼▼ 新增API，用于在运行时更新光照参数 ▼▼▼
    setBrightnessBoost(value) {
      material.uniforms.uBrightnessBoost.value = value;
    },
    setTerminatorSoftness(start, end) {
      material.uniforms.uTerminatorStart.value = start;
      material.uniforms.uTerminatorEnd.value = end;
    },
    // ▲▲▲ 新增API ▲▲▲

    fadeIn(duration = 1500) {
      if (this._tween) this._tween.stop();
      this._tween = new TWEEN.Tween(material.uniforms.uOpacity).to({ value: 1.0 }, duration).easing(TWEEN.Easing.Quadratic.Out).start();
    },
    fadeOut(duration = 500) {
      if (this._tween) this._tween.stop();
      this._tween = new TWEEN.Tween(material.uniforms.uOpacity).to({ value: 0.0 }, duration).easing(TWEEN.Easing.Quadratic.In).start();
    }
  };

  return controller;
}