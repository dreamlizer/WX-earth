// 创建昼夜平滑混合材质（单材质，避免“双球体空心”）
// 用法：import { createDayNightMaterial } from './shaders/dayNightMix.glsl.js'
// 在禅模式使用该材质，传入白天/夜晚贴图，并在每帧更新 uLightDirWorld 和 uGlobeCenterWorld。

export function createDayNightMaterial(THREE, dayTex, nightTex, softness = 0.18, gamma = 1.0, nightDarkness = 0.85, dayContrast = 1.0, mixPower = 1.0, dayNightContrast = 1.0) {
  const uniforms = {
    uDayTex: { value: dayTex || null },
    uNightTex: { value: nightTex || null },
    // 世界坐标系光线方向（从光源指向地球），由外部每帧更新
    uLightDirWorld: { value: new THREE.Vector3(1, 0, 0) },
    // 地球球心世界坐标，由外部每帧更新（避免位移导致法线不准确）
    uGlobeCenterWorld: { value: new THREE.Vector3(0, 0, 0) },
    // 终止线柔和宽度，越大过渡越宽
    uSoftness: { value: softness },
    // Gamma 调整，保持与现有纹理感受一致
    uGamma: { value: gamma },
    // 夜侧暗度（乘法系数，<1 更暗）
    uNightDarkness: { value: nightDarkness },
    // 白天对比（仅对白天纹理做伽马调整）
    uDayContrast: { value: dayContrast },
    // 混合曲线幂次（形状），>1 更靠向白天侧
    uMixPower: { value: mixPower },
    // 日夜对比度（整体拉开白天/黑夜差异；围绕 0.5 做线性拉伸）
    uDayNightContrast: { value: dayNightContrast },
    // 新增：白天侧增益（仅对白天侧生效；1 为不增益）
    uDaySideGain: { value: 1.0 },
    // 新增：整体曝光（乘法系数；1 为不变），用于快速整体提亮
    uExposure: { value: 1.0 },
  };

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    precision mediump float;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    uniform sampler2D uDayTex;
    uniform sampler2D uNightTex;
    uniform vec3 uLightDirWorld;
    uniform vec3 uGlobeCenterWorld;
    uniform float uSoftness;
    uniform float uGamma;
    uniform float uNightDarkness;
    uniform float uDayContrast;
    uniform float uMixPower;
    uniform float uDayNightContrast;
    uniform float uDaySideGain;
    uniform float uExposure;

    void main() {
      // 基于世界坐标计算球面法线（纠正位移对法线的影响）
      vec3 N = normalize(vWorldPos - uGlobeCenterWorld);
      vec3 L = normalize(uLightDirWorld);
      float d = dot(N, L); // >0 朝阳面，<0 夜面

      // 终止线过渡：[-softness, +softness] 范围内平滑
      float t = smoothstep(-uSoftness, uSoftness, d);
      // 可调混合曲线形状：幂次变换
      t = pow(t, uMixPower);
      // 围绕 0.5 做线性拉伸以拉开日夜对比（>1 更极端）
      t = clamp(0.5 + (t - 0.5) * uDayNightContrast, 0.0, 1.0);

      vec4 day = texture2D(uDayTex, vUv);
      // 白天对比：伽马调整（>1 提升对比）
      day.rgb = pow(day.rgb, vec3(uDayContrast));
      // 白天侧增益：仅随 t 在白天侧逐步放大亮度（避免终止线硬切）
      float dayGain = mix(1.0, uDaySideGain, t);
      day.rgb *= dayGain;
      vec4 night = texture2D(uNightTex, vUv);
      // 夜侧暗度：乘法调整（<1 更暗）
      night.rgb *= uNightDarkness;
      vec4 color = mix(night, day, t);
      // 整体曝光：在伽马之前乘以曝光系数，便于统一提亮
      color.rgb *= uExposure;

      // 简易 gamma 调整，保持贴图观感
      color.rgb = pow(color.rgb, vec3(uGamma));
      gl_FragColor = color;
    }
  `;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.FrontSide,
    transparent: false,
    depthTest: true,
    depthWrite: true,
  });

  return mat;
}