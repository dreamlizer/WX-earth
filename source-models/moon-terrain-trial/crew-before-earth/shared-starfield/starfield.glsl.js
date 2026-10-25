// starfield.glsl.js
// 职责：在小程序 threejs-miniprogram 环境下创建“低干扰、缓慢闪烁”的星空背景

import { PERF_HIDE_STAR_ON_ON_DRAG } from './label-constants.js';

export function createStarfieldMaterial(THREE, initialConfig = {}) {
  const vertexShader = (initialConfig && initialConfig.scrollEnabled) ? `
    attribute float size;
    attribute float twinkleSpeed;
    attribute float twinkleOffset;
    attribute float groupId;
    uniform float time;
    uniform float uSizeScale;
    uniform float uScrollSpeed;
    uniform float uZMin;
    uniform float uZMax;
    uniform float uBeltZMin;
    uniform float uBeltZMax;
    varying vec3 vColor;
    varying float vTwinkle;
    varying float vPhase;
    void main() {
      vColor = color;
      vPhase = twinkleOffset + position.x * 0.17 + position.y * 0.11;
      vTwinkle = 0.5 * (1.0 + sin(time * twinkleSpeed + vPhase));

      float zMin = (groupId > 0.5) ? uBeltZMin : uZMin;
      float zMax = (groupId > 0.5) ? uBeltZMax : uZMax;
      float len = max(1e-6, abs(zMax - zMin));
      float zFar = min(zMin, zMax);
      float zLocal = position.z + time * uScrollSpeed;
      float rel = zLocal - zFar;
      float wrapped = mod(rel, len);
      float z = zFar + wrapped;

      vec4 mvPosition = modelViewMatrix * vec4( vec3(position.x, position.y, z), 1.0 );
      gl_PointSize = size * uSizeScale * ( 600.0 / -mvPosition.z );
      gl_Position = projectionMatrix * mvPosition;
    }
  ` : `
    attribute float size;
    attribute float twinkleSpeed;
    attribute float twinkleOffset;
    uniform float time;
    uniform float uSizeScale;
    varying vec3 vColor;
    varying float vTwinkle;
    varying float vPhase;
    void main() {
      vColor = color;
      vPhase = twinkleOffset + position.x * 0.17 + position.y * 0.11;
      vTwinkle = 0.5 * (1.0 + sin(time * twinkleSpeed + vPhase));
      vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
      gl_PointSize = size * uSizeScale * ( 600.0 / -mvPosition.z );
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = (initialConfig && initialConfig.opacityAffectsColor) ? `
    varying vec3 vColor;
    varying float vTwinkle;
    varying float vPhase;
    uniform float uOpacity;
    uniform float time;
    uniform float uBrightnessGain;
    uniform float uCorePower;
    uniform float uGlowFactor;
    uniform float uBreathSpeed;
    uniform float uBreathStrength;
    void main() {
      vec2 uv = gl_PointCoord - vec2(0.5, 0.5);
      float r = length(uv);
      if ( r > 0.5 ) discard;
      float core = 1.0 - smoothstep(0.0, 0.16, r);
      core = pow(core, uCorePower);
      float glow = 1.0 - smoothstep(0.16, 0.5, r);
      float breath = 0.5 + 0.5 * sin(time * uBreathSpeed + vPhase);
      float breathMul = 1.0 + uBreathStrength * (breath - 0.5) * 2.0;
      float intensity = (core + glow * uGlowFactor) * vTwinkle * breathMul * uBrightnessGain;
      float alpha = clamp(uOpacity * (core + glow * 0.5), 0.0, 1.0);
      gl_FragColor = vec4( vColor * intensity * uOpacity, alpha );
    }
  ` : `
    varying vec3 vColor;
    varying float vTwinkle;
    varying float vPhase;
    uniform float uOpacity;
    uniform float time;
    uniform float uBrightnessGain;
    uniform float uCorePower;
    uniform float uGlowFactor;
    uniform float uBreathSpeed;
    uniform float uBreathStrength;
    void main() {
      vec2 uv = gl_PointCoord - vec2(0.5, 0.5);
      float r = length(uv);
      if ( r > 0.5 ) discard;
      float core = 1.0 - smoothstep(0.0, 0.16, r);
      core = pow(core, uCorePower);
      float glow = 1.0 - smoothstep(0.16, 0.5, r);
      float breath = 0.5 + 0.5 * sin(time * uBreathSpeed + vPhase);
      float breathMul = 1.0 + uBreathStrength * (breath - 0.5) * 2.0;
      float intensity = (core + glow * uGlowFactor) * vTwinkle * breathMul * uBrightnessGain;
      float alpha = clamp(uOpacity * (core + glow * 0.5), 0.0, 1.0);
      gl_FragColor = vec4( vColor * intensity, alpha );
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      uOpacity: { value: 1.0 },
      uSizeScale: { value: 1.8 },
      uBrightnessGain: { value: 2.2 },
      uCorePower: { value: 4.0 },
      uGlowFactor: { value: 0.25 },
      uBreathSpeed: { value: 0.5 },
      uBreathStrength: { value: 0.25 },
      uScrollSpeed: { value: 0.0 },
      uZMin: { value: -60.0 },
      uZMax: { value: -260.0 },
      uBeltZMin: { value: -110.0 },
      uBeltZMax: { value: -190.0 }
    },
    vertexShader,
    fragmentShader,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    vertexColors: true,
  });

  const u = material.uniforms || {};
  if (u.uOpacity && typeof initialConfig.starOpacity === 'number') u.uOpacity.value = initialConfig.starOpacity;
  if (u.uSizeScale && typeof initialConfig.starSizeScale === 'number') u.uSizeScale.value = initialConfig.starSizeScale;
  if (u.uBrightnessGain && typeof initialConfig.starBrightnessGain === 'number') u.uBrightnessGain.value = initialConfig.starBrightnessGain;
  if (u.uBreathSpeed && typeof initialConfig.starBreathSpeed === 'number') u.uBreathSpeed.value = initialConfig.starBreathSpeed;
  if (u.uBreathStrength && typeof initialConfig.starBreathStrength === 'number') u.uBreathStrength.value = initialConfig.starBreathStrength;
  if (u.uCorePower && typeof initialConfig.starCorePower === 'number') u.uCorePower.value = initialConfig.starCorePower;
  if (u.uGlowFactor && typeof initialConfig.starGlowFactor === 'number') u.uGlowFactor.value = initialConfig.starGlowFactor;
  if (u.uScrollSpeed && typeof initialConfig.scrollSpeed === 'number') u.uScrollSpeed.value = initialConfig.scrollSpeed;
  if (u.uZMin && typeof initialConfig.zMin === 'number') u.uZMin.value = initialConfig.zMin;
  if (u.uZMax && typeof initialConfig.zMax === 'number') u.uZMax.value = initialConfig.zMax;
  if (u.uBeltZMin && typeof initialConfig.beltZMin === 'number') u.uBeltZMin.value = initialConfig.beltZMin;
  if (u.uBeltZMax && typeof initialConfig.beltZMax === 'number') u.uBeltZMax.value = initialConfig.beltZMax;

  return material;
}

export function createStarfield(THREE) {
  // 兼容旧版 threejs-miniprogram：优先使用 Float32BufferAttribute；
  // BufferGeometry 可能只支持 addAttribute（老版本）或 setAttribute（新版本）
  const BufAttr = THREE.Float32BufferAttribute || THREE.BufferAttribute;
  function setAttrCompat(geom, name, attr) {
    if (typeof geom.setAttribute === 'function') { geom.setAttribute(name, attr); return 'setAttribute'; }
    if (typeof geom.addAttribute === 'function') { geom.addAttribute(name, attr); return 'addAttribute'; }
    throw new Error('BufferGeometry has no setAttribute/addAttribute');
  }
  // 顶点着色器：为每个点提供独立闪烁速度与相位
  const vertexShader = `
    attribute float size;
    attribute float twinkleSpeed;
    attribute float twinkleOffset;
    uniform float time;
    uniform float uSizeScale;
    varying vec3 vColor;
    varying float vTwinkle;
    varying float vPhase;
    void main() {
      vColor = color;
      // 平滑闪烁：不同速度+不同相位，整体节奏缓慢
      vPhase = twinkleOffset + position.x * 0.17 + position.y * 0.11;
      vTwinkle = 0.5 * (1.0 + sin(time * twinkleSpeed + vPhase));
      vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
      gl_PointSize = size * uSizeScale * ( 600.0 / -mvPosition.z );
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  // 片元着色器：亮中心 + 微光晕（更接近“单个明亮星点”的观感）
  const fragmentShader = `
    varying vec3 vColor;
    varying float vTwinkle;
    varying float vPhase;
    uniform float uOpacity;
    uniform float time;            // 片元也需要访问时间用于全局呼吸
    uniform float uBrightnessGain; // 整体提亮系数（配置可调）
    uniform float uCorePower;      // 中心亮度幂次（越大中心越尖锐）
    uniform float uGlowFactor;     // 光晕权重（越大光晕越明显）
    // 新增：全局“呼吸式”闪烁（低频、同步感），与点级 twinkle 相乘
    uniform float uBreathSpeed;    // 呼吸速度（弧度/秒）
    uniform float uBreathStrength; // 呼吸振幅（0~1，0 为关闭）
    void main() {
      vec2 uv = gl_PointCoord - vec2(0.5, 0.5);
      float r = length(uv);
      if ( r > 0.5 ) discard;
      // 中心亮度：很小半径内快速上升，形成尖锐亮点
      float core = 1.0 - smoothstep(0.0, 0.16, r);
      core = pow(core, uCorePower);
      // 外侧微光晕：较宽范围的柔和提升
      float glow = 1.0 - smoothstep(0.16, 0.5, r);
      // 全局呼吸：缓慢脉动的乘法因子（保持“有生命感”但不抢眼）
      // 引入每颗星的相位偏移，使“全局呼吸”呈现交错群组效果而非完全同步
      float breath = 0.5 + 0.5 * sin(time * uBreathSpeed + vPhase);
      float breathMul = 1.0 + uBreathStrength * (breath - 0.5) * 2.0; // 范围约 [1-振幅, 1+振幅]
      float intensity = (core + glow * uGlowFactor) * vTwinkle * breathMul * uBrightnessGain;
      // 透明度随淡入淡出控制；中心比光晕更不透明
      float alpha = clamp(uOpacity * (core + glow * 0.5), 0.0, 1.0);
      gl_FragColor = vec4( vColor * intensity, alpha );
    }
  `;

  const starsCount = 16000; // 适配移动端：数量适中以保证性能
  const positions = new Float32Array(starsCount * 3);
  const colors    = new Float32Array(starsCount * 3);
  const sizes     = new Float32Array(starsCount);
  const speeds    = new Float32Array(starsCount);
  const phases    = new Float32Array(starsCount);

  const geometry = new THREE.BufferGeometry();
  const color = new THREE.Color();

  for (let i = 0; i < starsCount; i++) {
    const i3 = i * 3;
    // 分层：普通星 + 稀疏星云尘埃
    const radius = (i < starsCount * 0.75) ? (95 + Math.random()*55) : (120 + Math.random()*30);
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.random() * Math.PI;
    positions[i3 + 0] = radius * Math.sin(theta) * Math.cos(phi);
    positions[i3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
    positions[i3 + 2] = radius * Math.cos(theta) - (i < starsCount * 0.75 ? 0 : 40);

    if (i < starsCount * 0.75) {
      // 普通星：以白为主，少量偏暖/偏冷
      if (Math.random() > 0.94) color.set(Math.random()>0.5 ? '#FFDDC1' : '#C1D4FF'); else color.set('#FFFFFF');
      const b = 0.6 + Math.random()*0.35;
      colors[i3+0] = color.r * b; colors[i3+1] = color.g * b; colors[i3+2] = color.b * b;
      sizes[i] = 0.35 + Math.random()*0.65;
      speeds[i] = 0.35 + Math.random()*1.2; // 慢速闪烁，避免抢眼
      phases[i] = Math.random()*Math.PI*2;
    } else {
      // 星云尘埃：更暗更小，不闪烁
      color.set('#aa88ff');
      const b = 0.04 + Math.random()*0.04;
      colors[i3+0] = color.r * b; colors[i3+1] = color.g * b; colors[i3+2] = color.b * b;
      sizes[i] = 0.24 + Math.random()*0.26;
      speeds[i] = 0.0; phases[i] = 0.0;
    }
  }

  const methodUsed = setAttrCompat(geometry, 'position', new BufAttr(positions, 3));
  setAttrCompat(geometry, 'color',    new BufAttr(colors,    3));
  setAttrCompat(geometry, 'size',     new BufAttr(sizes,     1));
  setAttrCompat(geometry, 'twinkleSpeed', new BufAttr(speeds, 1));
  setAttrCompat(geometry, 'twinkleOffset', new BufAttr(phases, 1));
  // 静默此日志（需要时再开启）
  // try { console.info('[star] attribute method:', methodUsed); } catch(_){}

  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      uOpacity: { value: 0.0 },
      uSizeScale: { value: 1.8 },
      uBrightnessGain: { value: 2.2 },
      uCorePower: { value: 4.0 },
      uGlowFactor: { value: 0.25 },
      uBreathSpeed: { value: 0.5 },   // 默认较慢的呼吸节奏
      uBreathStrength: { value: 0.25 } // 默认温和振幅
    },
    vertexShader, fragmentShader,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    vertexColors: true,
  });

  const starfield = new THREE.Points(geometry, material);
  starfield.name = 'starfield';
  return starfield;
}
export function applyZenStarUniforms(starfield, cfg = {}) {
  const u = starfield?.material?.uniforms || {};
  if (u.uSizeScale && typeof cfg.starSizeScale === 'number') u.uSizeScale.value = cfg.starSizeScale;
  if (u.uBrightnessGain && typeof cfg.starBrightnessGain === 'number') u.uBrightnessGain.value = cfg.starBrightnessGain;
  if (u.uBreathSpeed && typeof cfg.starBreathSpeed === 'number') u.uBreathSpeed.value = cfg.starBreathSpeed;
  if (u.uBreathStrength && typeof cfg.starBreathStrength === 'number') u.uBreathStrength.value = cfg.starBreathStrength;
}
export function applyNormalStarUniforms(starfield, cfg = {}) {
  const u = starfield?.material?.uniforms || {};
  if (u.uSizeScale && typeof cfg.starSizeScale === 'number') u.uSizeScale.value = cfg.starSizeScale;
  if (u.uBrightnessGain && typeof cfg.starBrightnessGain === 'number') u.uBrightnessGain.value = cfg.starBrightnessGain;
  if (u.uBreathSpeed && typeof cfg.starBreathSpeed === 'number') u.uBreathSpeed.value = cfg.starBreathSpeed;
  if (u.uBreathStrength && typeof cfg.starBreathStrength === 'number') u.uBreathStrength.value = cfg.starBreathStrength;
}
export function getZenStarOpacityTarget(cfg = {}) {
  return (typeof cfg.starOpacity === 'number') ? cfg.starOpacity : 0.18;
}
export function getNormalStarOpacityTarget(cfg = {}) {
  return (typeof cfg.starOpacity === 'number') ? cfg.starOpacity : 0.0;
}
export function tickStarfield(starfield, now, dtSec, targetOpacity){
  try {
    const mat = starfield?.material;
    if (!mat) return { opacity: 0.0, visible: false };
    const cur = (mat.uniforms && mat.uniforms.uOpacity) ? (mat.uniforms.uOpacity.value || 0.0) : 0.0;
    const lerpK = Math.min(1.0, dtSec * 2.8);
    const next = cur + (targetOpacity - cur) * lerpK;
    if (mat.uniforms && mat.uniforms.uOpacity) mat.uniforms.uOpacity.value = Math.max(0.0, Math.min(1.0, next));
    if (mat.uniforms && mat.uniforms.time) mat.uniforms.time.value = now * 0.001;
    starfield.visible = next > 0.01;
    return { opacity: next, visible: starfield.visible };
  } catch(_){ return { opacity: 0.0, visible: false }; }
}
export function createStarfieldController(THREE, scene, initialConfig = {}){
  const mesh = createStarfield(THREE);
  if (mesh) { 
    mesh.renderOrder = -1; 
    mesh.visible = false; 
    try { scene.add(mesh); } catch(_){ } 
    
    // 应用初始配置
    if (initialConfig && mesh.material && mesh.material.uniforms) {
      const u = mesh.material.uniforms;
      if (u.uSizeScale && typeof initialConfig.starSizeScale === 'number') u.uSizeScale.value = initialConfig.starSizeScale;
      if (u.uBrightnessGain && typeof initialConfig.starBrightnessGain === 'number') u.uBrightnessGain.value = initialConfig.starBrightnessGain;
      if (u.uBreathSpeed && typeof initialConfig.starBreathSpeed === 'number') u.uBreathSpeed.value = initialConfig.starBreathSpeed;
      if (u.uBreathStrength && typeof initialConfig.starBreathStrength === 'number') u.uBreathStrength.value = initialConfig.starBreathStrength;
    }
  }
  
  let target = 0.0;
  let baseTarget = 0.0;
  let isDragging = false;
  
  // 诊断状态
  let __breathDiagUntil = 0;
  let __breathLogNext = 0;
  let __starLogNext = 0;
  let __starLogNextMiss = 0;
  let __starUniformWarned = false;
  const STAR_LOG = false; // 内部开关，或通过配置传入

  return {
            mesh,
            setTargetOpacity(v){ 
              try { 
                baseTarget = Math.max(0, Math.min(1, Number(v)||0)); 
                if (!isDragging || !PERF_HIDE_STAR_ON_ON_DRAG) {
                  target = baseTarget;
                }
              } catch(_){ target = 0.0; } 
            },
            applyZen(cfg){ try { applyZenStarUniforms(mesh, cfg||{}); } catch(_){ } },
            applyNormal(cfg){ try { applyNormalStarUniforms(mesh, cfg||{}); } catch(_){ } },
            
            setDragging(dragging) {
              try {
                isDragging = !!dragging;
                if (PERF_HIDE_STAR_ON_ON_DRAG && isDragging) {
                  target = 0.0;
                } else {
                  target = baseTarget;
                }
              } catch(_){}
            },

            enableBreathDiagnostics(durationMs = 12000) {
      try { __breathDiagUntil = Date.now() + durationMs; } catch(_){}
    },

    tick(now, dtSec){ 
      // 1. 调用基础更新逻辑
      const res = tickStarfield(mesh, now, dtSec, target);
      
      // 2. 诊断与日志逻辑 (移植自 main.js)
      try {
        if (mesh && mesh.material) {
          const mat = mesh.material;
          if ((!mat.uniforms || !mat.uniforms.uOpacity) && !__starUniformWarned && STAR_LOG) {
            __starUniformWarned = true;
            try { console.warn('[star] warn: uOpacity uniform missing on material'); } catch(_){}
          }
          
          if (STAR_LOG && now >= __starLogNext) { 
            __starLogNext = now + 1000; 
            try { console.log('[star] tick:', { target: Number(target.toFixed?.(3) || target), cur: Number(res.opacity?.toFixed?.(3) || res.opacity || 0), visible: !!res.visible }); } catch(_){} 
          }

          // 诊断：在窗口期内采样“呼吸乘子”
          if (now <= __breathDiagUntil && now >= __breathLogNext) {
            __breathLogNext = now + 1500;
            try {
              const speed = mat.uniforms?.uBreathSpeed?.value ?? 0;
              const strength = mat.uniforms?.uBreathStrength?.value ?? 0;
              const t = mat.uniforms?.time?.value ?? 0;
              const breathMul = 1.0 + strength * Math.sin(t * speed);
              // console.info('[star breath]', { speed, strength, time: t, mul: breathMul });
            } catch(_){}
          }
        } else {
          if (STAR_LOG && now >= __starLogNextMiss) {
            __starLogNextMiss = now + 2000;
            try { console.warn('[star] not ready:', { hasObj: !!mesh, hasMat: !!(mesh && mesh.material) }); } catch(_){}
          }
        }
      } catch(_){}

      return res;
    }
  };
}
