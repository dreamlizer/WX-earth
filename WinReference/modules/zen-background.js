// modules/zen-background.js
// 职责：创建并管理禅定模式下的星空背景。

import * as THREE from 'three';

// 顶点着色器
const vertexShader = `
  // 从JS接收的属性
  attribute float size;
  attribute float twinkleSpeed; // 每个星星独特的闪烁速度
  attribute float twinkleOffset; // 每个星星独特的闪烁起始相位

  // 从JS接收的全局变量
  uniform float time; // 持续更新的时间

  // 传递给片元着色器
  varying vec3 vColor;
  varying float vTwinkle; // 计算出的闪烁值

  void main() {
    vColor = color;

    // 计算闪烁值：使用 sin 函数创造 0 到 1 之间的平滑波动
    // 加上 position.x 可以让不同位置的星星有不同的闪烁相位
    vTwinkle = 0.5 * (1.0 + sin(time * twinkleSpeed + twinkleOffset + position.x));

    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
    gl_PointSize = size * ( 300.0 / -mvPosition.z );
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// 片元着色器
const fragmentShader = `
  varying vec3 vColor;
  varying float vTwinkle; // 接收闪烁值

  void main() {
    if ( length( gl_PointCoord - vec2( 0.5, 0.5 ) ) > 0.475 ) discard;

    // 最终颜色 = 星星基础色 * 闪烁值
    gl_FragColor = vec4( vColor * vTwinkle, 1.0 );
  }
`;


// 创建并导出一个函数，用于生成星空对象
export function createStarfield() {
  const starsCount = 30000;
  const positions = new Float32Array(starsCount * 3);
  const colors = new Float32Array(starsCount * 3);
  const sizes = new Float32Array(starsCount);
  // ▼▼▼ 新增代码：为每个星星定义闪烁属性 ▼▼▼
  const twinkleSpeeds = new Float32Array(starsCount);
  const twinkleOffsets = new Float32Array(starsCount);
  // ▲▲▲ 新增代码 ▲▲▲

  const geometry = new THREE.BufferGeometry();
  const color = new THREE.Color();

  for (let i = 0; i < starsCount; i++) {
    const i3 = i * 3;

    if (i < 20000) {
      // --- 生成普通星星 (前20000个) ---
      const radius = 100 + Math.random() * 80;
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.random() * Math.PI;

      positions[i3 + 0] = radius * Math.sin(theta) * Math.cos(phi);
      positions[i3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
      positions[i3 + 2] = radius * Math.cos(theta);

      if (Math.random() > 0.92) {
        color.set(Math.random() > 0.5 ? '#FFDDC1' : '#C1D4FF');
      } else {
        color.set('#FFFFFF');
      }
      const brightness = 0.7 + Math.random() * 0.3;
      colors[i3 + 0] = color.r * brightness;
      colors[i3 + 1] = color.g * brightness;
      colors[i3 + 2] = color.b * brightness;

      sizes[i] = 0.3 + Math.random() * 0.7;

      // ▼▼▼ 新增代码：设置闪烁参数 ▼▼▼
      twinkleSpeeds[i] = 0.5 + Math.random() * 2.0; // 随机速度
      twinkleOffsets[i] = Math.random() * Math.PI * 2; // 随机相位
      // ▲▲▲ 新增代码 ▲▲▲

    } else {
      // --- 生成星云尘埃 (后10000个) ---
      const radius = 120 + Math.random() * 30;
      const phi = Math.random() * Math.PI * 0.5;
      const theta = Math.random() * Math.PI * 0.5;

      positions[i3 + 0] = radius * Math.sin(theta) * Math.cos(phi);
      positions[i3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
      positions[i3 + 2] = radius * Math.cos(theta) - 50;

      color.set('#aa88ff');
      const brightness = 0.05 + Math.random() * 0.05;
      colors[i3 + 0] = color.r * brightness;
      colors[i3 + 1] = color.g * brightness;
      colors[i3 + 2] = color.b * brightness;

      sizes[i] = 0.2 + Math.random() * 0.3;

      // 星云不闪烁
      twinkleSpeeds[i] = 0.0;
      twinkleOffsets[i] = 0.0;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  // ▼▼▼ 新增代码：将闪烁属性也设置为几何体的属性 ▼▼▼
  geometry.setAttribute('twinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));
  geometry.setAttribute('twinkleOffset', new THREE.BufferAttribute(twinkleOffsets, 1));
  // ▲▲▲ 新增代码 ▲▲▲

  const material = new THREE.ShaderMaterial({
    uniforms: {
        // ▼▼▼ 新增代码：添加 time uniform ▼▼▼
        time: { value: 0.0 }
        // ▲▲▲ 新增代码 ▲▲▲
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    vertexColors: true,
    opacity: 0,
  });

  const starfield = new THREE.Points(geometry, material);
  starfield.name = 'starfield';

  return starfield;
}