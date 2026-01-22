// 创建昼夜平滑混合材质（单材质，避免“双球体空心”）
// 用法：import { createDayNightMaterial } from './shaders/dayNightMix.glsl.js'
// 在禅模式使用该材质，传入白天/夜晚贴图，并在每帧更新 uLightDirWorld 和 uGlobeCenterWorld。

export function createDayNightMaterial(THREE, dayTex, nightTex, softness = 0.18, gamma = 1.0, nightDarkness = 0.85, dayContrast = 1.0, mixPower = 1.0, dayNightContrast = 1.0, useSimpleShader = false) {
  const uniforms = {
    uDayTex: { value: dayTex || null },
    uNightTex: { value: nightTex || null },
    uDayUvMat: { value: new THREE.Matrix3() },
    uNightUvMat: { value: new THREE.Matrix3() },
    uLightDirWorld: { value: new THREE.Vector3(1, 0, 0) },
    uGlobeCenterWorld: { value: new THREE.Vector3(0, 0, 0) },
    uCameraPosWorld: { value: new THREE.Vector3(0, 0, 5) },
    uSoftness: { value: softness },
    uGamma: { value: gamma },
    uNightDarkness: { value: nightDarkness },
    uDayContrast: { value: dayContrast },
    uMixPower: { value: mixPower },
    uDayNightContrast: { value: dayNightContrast },
    uDaySideGain: { value: 1.0 },
    uExposure: { value: 1.0 },
    uHighlightsRoll: { value: 0.0 },
    // 高光参数保留以兼容 uniforms 结构，但在简单模式下不使用
    uSpecularTex: { value: null },
    uSpecularUseTex: { value: 0.0 },
    uSpecularStrength: { value: 0.9 },
    uShininess: { value: 16.0 },
    uSpecularColor: { value: new THREE.Color(1, 1, 1) },
    uSpecularAutoMask: { value: 0.0 },
    uWaterMaskGain: { value: 2.0 },
    uWaterSpecularStrength: { value: 1.6 },
    uWaterShininess: { value: 8.0 },
    uWaterFresnel: { value: 0.6 },
    uTime: { value: 0.0 },
    uWaveNoiseScale: { value: 24.0 },
    uWaveNoiseStrength: { value: 0.25 },
    uWaveNoiseSpeed: { value: 0.05 },
    uWaterNormalPerturb: { value: 0.06 },
    uOpacity: { value: 1.0 },
    // uFlipY: { value: 0.0 }, // 移除 PC 端翻转修正，改为 Texture Matrix 修复
  };

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    // uniform float uFlipY;
    void main() {
      vUv = uv; // mix(uv.y, 1.0 - uv.y, uFlipY));
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // 简化版 Shader：去除高光、噪声、水面扰动，只保留最核心的 mix
  const fragmentShaderSimple = `
    precision highp float;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    uniform sampler2D uDayTex;
    uniform sampler2D uNightTex;
    uniform mat3 uDayUvMat;
    uniform mat3 uNightUvMat;
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

    uniform float uOpacity;
    void main() {
      vec3 N = normalize(vWorldPos - uGlobeCenterWorld);
      vec3 L = normalize(uLightDirWorld);
      float d = dot(N, L);
      
      float t = smoothstep(-uSoftness, uSoftness, d);
      // t = pow(t, uMixPower); // 简化：移除幂次
      t = clamp(0.5 + (t - 0.5) * uDayNightContrast, 0.0, 1.0);

      vec2 uvDay = (uDayUvMat * vec3(vUv, 1.0)).xy;
      vec2 uvNight = (uNightUvMat * vec3(vUv, 1.0)).xy;

      vec4 day = texture2D(uDayTex, uvDay);
      // day.rgb = pow(day.rgb, vec3(uDayContrast)); // 简化：移除 Gamma/Contrast
      float dayGain = mix(1.0, uDaySideGain, t);
      day.rgb *= dayGain;
      
      vec4 night = texture2D(uNightTex, uvNight);
      night.rgb *= uNightDarkness;
      
      vec4 color = mix(night, day, t);
      color.rgb *= uExposure;
      // color.rgb = pow(color.rgb, vec3(uGamma)); // 简化：移除 Gamma
      
      gl_FragColor = vec4(color.rgb, uOpacity);
    }
  `;

  const fragmentShader = `
    precision highp float;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    uniform sampler2D uDayTex;
    uniform sampler2D uNightTex;
    uniform mat3 uDayUvMat;
    uniform mat3 uNightUvMat;
    uniform vec3 uLightDirWorld;
    uniform vec3 uGlobeCenterWorld;
    uniform vec3 uCameraPosWorld;
    uniform float uSoftness;
    uniform float uGamma;
    uniform float uNightDarkness;
    uniform float uDayContrast;
    uniform float uMixPower;
    uniform float uDayNightContrast;
    uniform float uDaySideGain;
    uniform float uExposure;
    uniform float uHighlightsRoll;
    uniform sampler2D uSpecularTex;
    uniform float uSpecularUseTex;
    uniform float uSpecularStrength;
    uniform float uShininess;
    uniform vec3 uSpecularColor;
    uniform float uSpecularAutoMask;
    uniform float uWaterMaskGain;
    uniform float uWaterSpecularStrength;
    uniform float uWaterShininess;
    uniform float uWaterFresnel;
    uniform float uTime;
    uniform float uWaveNoiseScale;
    uniform float uWaveNoiseStrength;
    uniform float uWaveNoiseSpeed;
    uniform float uWaterNormalPerturb;

    uniform float uOpacity;
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

      vec2 uvDay = (uDayUvMat * vec3(vUv, 1.0)).xy;
      vec2 uvNight = (uNightUvMat * vec3(vUv, 1.0)).xy;

      vec4 day = texture2D(uDayTex, uvDay);
      vec4 dayRaw = texture2D(uDayTex, uvDay);
      // 白天对比：伽马调整（>1 提升对比）
      day.rgb = pow(day.rgb, vec3(uDayContrast));
      // 白天侧增益：仅随 t 在白天侧逐步放大亮度（避免终止线硬切）
      float dayGain = mix(1.0, uDaySideGain, t);
      day.rgb *= dayGain;
      vec4 night = texture2D(uNightTex, uvNight);
      // 夜侧暗度：乘法调整（<1 更暗）
      night.rgb *= uNightDarkness;
      vec4 color = mix(night, day, t);
      // 整体曝光：在伽马之前乘以曝光系数，便于统一提亮
      color.rgb *= uExposure;

      // —— 高光（Blinn-Phong）——
      // 仅在朝阳面产生（乘以 max(d,0) 并在终止线附近平滑衰减）
      vec3 V = normalize(uCameraPosWorld - vWorldPos);
      vec3 H = normalize(V + L);
      float specMask = 1.0;
      if (uSpecularUseTex > 0.5) {
        // 贴图的 R 通道作为高光强度遮罩（常见于 ocean 高光）
        specMask = texture2D(uSpecularTex, uvDay).r;
      }
      if (uSpecularAutoMask > 0.5) {
        float waterness = max(0.0, dayRaw.b - max(dayRaw.r, dayRaw.g));
        float w = clamp(waterness * uWaterMaskGain, 0.0, 1.0);
        specMask = max(specMask, w);
      }
      vec2 np2 = vUv * uWaveNoiseScale + vec2(uTime * uWaveNoiseSpeed);
      float n1 = fract(sin(dot(np2 + vec2(0.123, 0.456), vec2(12.9898, 78.233))) * 43758.5453);
      float n2 = fract(sin(dot(np2 + vec2(0.654, 0.321), vec2(93.9898, 67.345))) * 12741.4230);
      vec3 r = vec3(n1 - 0.5, n2 - 0.5, 0.0);
      vec3 T = normalize(r - N * dot(N, r));
      float perturb = uWaterNormalPerturb * specMask;
      vec3 Np = normalize(N + T * perturb);
      float nh = max(dot(Np, H), 0.0);
      float shininessEff = mix(uShininess, uWaterShininess, specMask);
      float specBase = pow(nh, max(1.0, shininessEff));
      specBase *= max(d, 0.0); // 只在白天侧出现
      // 终止线附近再额外柔化，避免硬边闪烁
      specBase *= smoothstep(0.05, 0.35, d);
      float nv = max(dot(Np, V), 0.0);
      // 华为 Mali GPU 修复：避免 1.0 - nv 为微小负数导致 pow(NaN)
      float fresnelBase = max(0.0, 1.0 - nv);
      float fresnel = pow(fresnelBase, 5.0);
      float strengthBoost = mix(1.0, uWaterSpecularStrength, specMask);
      float fresnelBoost = 1.0 + (specMask * uWaterFresnel * fresnel);
      vec2 np = uvDay * uWaveNoiseScale + vec2(uTime * uWaveNoiseSpeed);
      float waveNoise = fract(sin(dot(np, vec2(12.9898, 78.233))) * 43758.5453);
      float waveBoost = 1.0 + specMask * uWaveNoiseStrength * (waveNoise - 0.5) * 2.0;
      vec3 specular = uSpecularColor * (uSpecularStrength * strengthBoost * fresnelBoost * waveBoost * specBase * specMask);
      color.rgb += specular;

      // 高光压缩：在曝光后进行柔和的高亮滚降，避免过曝发灰
      // 采用简单的 Reinhard 近似：c' = c / (1 + k * c)
      if (uHighlightsRoll > 0.0001) {
        color.rgb = color.rgb / (vec3(1.0) + vec3(uHighlightsRoll) * color.rgb);
      }

      // 简易 gamma 调整，保持贴图观感
      color.rgb = pow(color.rgb, vec3(uGamma));
      gl_FragColor = vec4(color.rgb, uOpacity);
    }
  `;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader: useSimpleShader ? fragmentShaderSimple : fragmentShader,
    side: THREE.FrontSide,
    transparent: true,
    depthTest: true,
    depthWrite: true,
  });

  const __id = new THREE.Matrix3();
  const __tmp = new THREE.Matrix3();
  const __updateUvMat = (tex, uniformVal) => {
    if (!uniformVal) return;
    if (!tex || !tex.matrix) { uniformVal.copy(__id); return; }
    try { if (tex.matrixAutoUpdate && typeof tex.updateMatrix === 'function') tex.updateMatrix(); } catch(_){ }
    try { __tmp.copy(tex.matrix); uniformVal.copy(__tmp); } catch(_){ uniformVal.copy(__id); }
  };

  mat.onBeforeRender = () => {
    try { __updateUvMat(mat.uniforms.uDayTex.value, mat.uniforms.uDayUvMat.value); } catch(_){ }
    try { __updateUvMat(mat.uniforms.uNightTex.value, mat.uniforms.uNightUvMat.value); } catch(_){ }
  };

  return mat;
}
