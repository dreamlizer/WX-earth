// 独立大气壳体着色器：以 AdditiveBlending 叠加到地球外缘
// 目的：避免地表着色器或光照/伽马压缩覆盖，直观呈现“蓝色光环”
// 用法：import { createAtmosphereShellMaterial } from './shaders/atmosphereShell.glsl.js'
// 注意：需在每帧同步 uGlobeCenterWorld 与 uCameraPosWorld，以稳定 Fresnel

export function createAtmosphereShellMaterial(THREE) {
  const uniforms = {
    uGlobeCenterWorld: { value: new THREE.Vector3(0, 0, 0) },
    uCameraPosWorld: { value: new THREE.Vector3(0, 0, 5) },
    uColor: { value: new THREE.Color(0.5, 0.8, 1.0) },
    uIntensity: { value: 0.15 },
    uPower: { value: 2.0 },
    uDebugSolid: { value: 0.0 }, // 调试：输出纯色层以确认是否生效
  };

  const vertexShader = `
    varying vec3 vWorldPos;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    precision mediump float;
    varying vec3 vWorldPos;
    uniform vec3 uGlobeCenterWorld;
    uniform vec3 uCameraPosWorld;
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform float uPower;
    uniform float uDebugSolid;

    void main() {
      // 球面法线（世界坐标系）
      vec3 N = normalize(vWorldPos - uGlobeCenterWorld);
      // 观察方向（世界）
      vec3 V = normalize(uCameraPosWorld - vWorldPos);
      // Fresnel：观察方向与法线越垂直，越强
      float nv = max(dot(N, V), 0.0);
      float fres = pow(1.0 - nv, max(0.1, uPower)) * max(0.0, uIntensity);

      // 调试：输出纯色层
      if (uDebugSolid > 0.5) {
        gl_FragColor = vec4(uColor, 1.0);
        return;
      }

      // 使用 alpha 传递强度，Additive 混合将颜色累加到背景
      gl_FragColor = vec4(uColor * fres, fres);
    }
  `;

  const mat = new THREE.ShaderMaterial({
    name: 'AtmosphereShellMaterial',
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.FrontSide,     // 渲染外层正面；配合深度测试只在边缘可见
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,         // 不写深度，避免影响后续绘制
  });

  return mat;
}