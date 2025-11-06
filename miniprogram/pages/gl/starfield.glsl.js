// starfield.glsl.js
// 职责：在小程序 threejs-miniprogram 环境下创建“低干扰、缓慢闪烁”的星空背景

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
    void main() {
      vColor = color;
      // 平滑闪烁：不同速度+不同相位，整体节奏缓慢
      vTwinkle = 0.5 * (1.0 + sin(time * twinkleSpeed + twinkleOffset + position.x*0.1));
      vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
      gl_PointSize = size * uSizeScale * ( 600.0 / -mvPosition.z );
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  // 片元着色器：亮中心 + 微光晕（更接近“单个明亮星点”的观感）
  const fragmentShader = `
    varying vec3 vColor;
    varying float vTwinkle;
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
      float breath = 0.5 + 0.5 * sin(time * uBreathSpeed);
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