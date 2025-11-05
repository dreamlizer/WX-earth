// modules/scene.js
// 职责：初始化 Three.js 场景，并以一个稳定、垂直的方式组装地球仪。

import * as THREE from 'three';
import { OrbitControls } from '../assets/js/OrbitControls.js';
import { AppConfig } from './config.js';
import { createGlobeStand } from './globe-stand.js';

// --- 导出核心对象 ---
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
export const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
export const controls = new OrbitControls(camera, renderer.domElement);
export let sphere;
export let cloudSphere;
export const EARTH_RADIUS = 2;

// --- 导出材质、贴图和程序集 ---
export let earthMat;
export let dayTexture;
export let nightTexture;
export let zenDayTexture;
export let ambientLight;
export let mainLight, fillLight, rimLight;
export let globeAssembly;
export let stand;
export let zenMasterGroup;

// --- 初始化函数 ---
export function initScene() {
  camera.position.set(0, 0, 10);

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild(renderer.domElement);
  renderer.domElement.classList.add('webgl');

  ambientLight = new THREE.AmbientLight(0xd0d8f0, 1.0);
  scene.add(ambientLight);
  mainLight = new THREE.DirectionalLight(0xffffff, 4.5);
  mainLight.position.set(5, 5, 5);
  scene.add(mainLight);
  fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
  fillLight.position.set(-5, 2, -5);
  scene.add(fillLight);
  rimLight = new THREE.DirectionalLight(0xffffff, 2.0);
  rimLight.position.set(0, 3, -8);
  scene.add(rimLight);

  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enablePan = false;
  controls.minDistance = 3.0;
  controls.maxDistance = 20.0;
  controls.target.set(0, 0, 0);
  controls.update();

  const textureLoader = new THREE.TextureLoader();
  dayTexture = textureLoader.load('./assets/earth-dark.jpg');
  nightTexture = textureLoader.load('./assets/earth_night.webp');
  zenDayTexture = textureLoader.load('./assets/earth_day8k.webp');

  dayTexture.colorSpace = THREE.SRGBColorSpace;
  nightTexture.colorSpace = THREE.SRGBColorSpace;
  zenDayTexture.colorSpace = THREE.SRGBColorSpace;

  earthMat = new THREE.MeshStandardMaterial({
    map: dayTexture,
    metalness: 0.0,
    roughness: 0.8,
    emissiveMap: nightTexture,
    // ▼▼▼ 核心修正：将基础自发光颜色从白色改为黑色 ▼▼▼
    emissive: 0x000000,
    // ▲▲▲ 核心修正 ▲▲▲
    emissiveIntensity: 0,
  });

  earthMat.onBeforeCompile = (shader) => {
    // 目标：修改计算自发光的部分，让它只在暗部生效
    const emissiveFragmentChunk = `
      #ifdef USE_EMISSIVEMAP
        vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
        float sunlit = 0.0;
        #if NUM_DIR_LIGHTS > 0
          sunlit = saturate( dot( vNormal, directionalLights[ 0 ].direction ) );
        #endif
        float darksideMask = 1.0 - sunlit;
        darksideMask = pow(darksideMask, 3.0);
        // 在原有的自发光基础上（现在是黑色），加上我们计算出的、只在暗部显示的夜景灯光
        totalEmissiveRadiance += emissiveColor.rgb * darksideMask;
      #endif
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      emissiveFragmentChunk
    );
  };

  const sphereGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
  sphere = new THREE.Mesh(sphereGeometry, earthMat);
  sphere.name = 'earth_sphere';

  const cloudGeometry = new THREE.SphereGeometry(EARTH_RADIUS + 0.05, 64, 64);
  cloudSphere = new THREE.Mesh(cloudGeometry, new THREE.MeshStandardMaterial({ alphaMap: textureLoader.load('./assets/cloud.webp'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  cloudSphere.name = 'clouds';
  cloudSphere.visible = false;

  globeAssembly = new THREE.Group();
  globeAssembly.add(sphere);
  globeAssembly.add(cloudSphere);

  stand = createGlobeStand({ config: AppConfig });
  stand.visible = false;

  zenMasterGroup = new THREE.Group();
  zenMasterGroup.name = 'zen_master_group';

  scene.add(zenMasterGroup);
  scene.add(globeAssembly);
  scene.add(stand);

  window.addEventListener('resize', onResize);
  onResize();
}

function onResize() {
  const rect = renderer.domElement.getBoundingClientRect();
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}