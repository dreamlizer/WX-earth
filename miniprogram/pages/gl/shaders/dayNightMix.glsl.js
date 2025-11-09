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
    // 摄像机世界坐标（用于计算观察方向 V）
    uCameraPosWorld: { value: new THREE.Vector3(0, 0, 5) },
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
    // 新增：高光压缩（ToneMap）系数；>0 时压低高亮避免“冲白”
    uHighlightsRoll: { value: 0.0 },
    // 新增：高光相关参数（可选贴图 + 强度/锐度/颜色）
    uSpecularTex: { value: null },
    uSpecularUseTex: { value: 0.0 }, // 0=不采样贴图，1=采样贴图
    uSpecularStrength: { value: 0.9 },
    uShininess: { value: 16.0 },
    uSpecularColor: { value: new THREE.Color(1, 1, 1) },
    // —— 大气辉光（Fresnel）参数 ——
    // 颜色：柔和天蓝；强度：0 关闭；幂次：边缘锐度
    uAtmosphereColor: { value: new THREE.Color(0.5, 0.8, 1.0) },
    uAtmosphereIntensity: { value: 0.0 },
    uAtmospherePower: { value: 2.0 },
    // 调试：仅显示大气辉光（关闭其他通道），0 关闭 / 1 开启
    uAtmosphereDebugOnly: { value: 0.0 },
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
    // 大气辉光（Fresnel）
    uniform vec3 uAtmosphereColor;
    uniform float uAtmosphereIntensity;
    uniform float uAtmospherePower;
    uniform float uAtmosphereDebugOnly;

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

      // —— 高光（Blinn-Phong）——
      // 仅在朝阳面产生（乘以 max(d,0) 并在终止线附近平滑衰减）
      vec3 V = normalize(uCameraPosWorld - vWorldPos);
      vec3 H = normalize(V + L);
      float nh = max(dot(N, H), 0.0);
      float specBase = pow(nh, max(1.0, uShininess));
      specBase *= max(d, 0.0); // 只在白天侧出现
      // 终止线附近再额外柔化，避免硬边闪烁
      specBase *= smoothstep(0.05, 0.35, d);
      float specMask = 1.0;
      if (uSpecularUseTex > 0.5) {
        // 贴图的 R 通道作为高光强度遮罩（常见于 ocean 高光）
        specMask = texture2D(uSpecularTex, vUv).r;
      }
      vec3 specular = uSpecularColor * (uSpecularStrength * specBase * specMask);
      color.rgb += specular;

      // 高光压缩：在曝光后进行柔和的高亮滚降，避免过曝发灰
      // 采用简单的 Reinhard 近似：c' = c / (1 + k * c)
      if (uHighlightsRoll > 0.0001) {
        color.rgb = color.rgb / (vec3(1.0) + vec3(uHighlightsRoll) * color.rgb);
      }

      // —— 大气辉光（Fresnel）：观察方向与法线越垂直，辉光越强 ——
      // F = (1 - dot(N,V))^power * intensity
      float nv = max(dot(N, V), 0.0);
      float fres = pow(1.0 - nv, max(0.1, uAtmospherePower)) * max(0.0, uAtmosphereIntensity);
      color.rgb += uAtmosphereColor * fres;

      // 调试：仅显示辉光层，便于确认效果是否产生
      if (uAtmosphereDebugOnly > 0.5) {
        gl_FragColor = vec4(uAtmosphereColor * fres, 1.0);
        return;
      }

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