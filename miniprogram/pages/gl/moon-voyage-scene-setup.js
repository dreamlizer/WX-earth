
import { APP_CFG } from './config.js';
import { createMilkyWay, createStarDustLayer } from './moon-voyage-visuals.js';
import { fixTexture } from './asset-manager.js';

export const rebuildMilkyWay = (THREE, scene, mgrState) => {
  if (!THREE || !scene) return;

  try {
    if (mgrState.milkyWayMesh) {
      try { scene.remove(mgrState.milkyWayMesh); } catch (_) {}
      try { mgrState.milkyWayMesh.geometry?.dispose?.(); } catch (_) {}
      try { mgrState.milkyWayMesh.material?.dispose?.(); } catch (_) {}
    }
  } catch (_) {}

  mgrState.milkyWayMesh = createMilkyWay(THREE, APP_CFG, { tunnelYaw: mgrState._voyageTargetRotY });
  if (mgrState.milkyWayMesh && scene) {
    scene.add(mgrState.milkyWayMesh);
    mgrState.milkyWayMesh.visible = false;
  }

  if (mgrState._moonDebug) {
    try {
      const cfg = APP_CFG?.moonVoyage?.starCorridor || {};
      const u = mgrState.milkyWayMesh?.material?.uniforms || {};
      console.log('[Moon] MilkyWay rebuilt', {
        xMin: cfg.xMin, xMax: cfg.xMax, yRange: cfg.yRange, zMin: cfg.zMin, zMax: cfg.zMax,
        beltYHalfRange: cfg.beltYHalfRange, beltZMin: cfg.beltZMin, beltZMax: cfg.beltZMax,
        opacity: u?.uOpacity?.value, sizeScale: u?.uSizeScale?.value, brightnessGain: u?.uBrightnessGain?.value
      });
    } catch (_) {}
  }
};

export const rebuildStarDust = (THREE, scene, mgrState) => {
  if (!THREE || !scene) return;

  const cleanup = (mesh) => {
    if (!mesh) return;
    try { scene.remove(mesh); } catch (_) {}
    try { mesh.geometry?.dispose?.(); } catch (_) {}
    try { mesh.material?.dispose?.(); } catch (_) {}
  };

  cleanup(mgrState._dustSlowMesh);
  cleanup(mgrState._dustFastMesh);
  cleanup(mgrState._dustBgMesh);
  mgrState._dustSlowMesh = null;
  mgrState._dustFastMesh = null;
  mgrState._dustBgMesh = null;

  mgrState._dustSlowMesh = createStarDustLayer(THREE, APP_CFG, { kind: 'slow' });
  mgrState._dustFastMesh = createStarDustLayer(THREE, APP_CFG, { kind: 'fast' });
  mgrState._dustBgMesh = createStarDustLayer(THREE, APP_CFG, { kind: 'bg' });
  [mgrState._dustBgMesh, mgrState._dustSlowMesh, mgrState._dustFastMesh].forEach((m) => {
    if (!m) return;
    m.visible = false;
    m.frustumCulled = false;
    if (m === mgrState._dustBgMesh) m.renderOrder = -3;
    else m.renderOrder = -2;
    try { scene.add(m); } catch (_) {}
  });
};

export const refreshMainStarfieldMesh = (scene, mgrState) => {
  mgrState._mainStarfieldMesh = null;
  try {
    if (scene && typeof scene.getObjectByName === 'function') {
      mgrState._mainStarfieldMesh = scene.getObjectByName('starfield') || null;
    } else if (scene && typeof scene.traverse === 'function') {
      scene.traverse((o) => {
        if (mgrState._mainStarfieldMesh) return;
        if (o && o.name === 'starfield') mgrState._mainStarfieldMesh = o;
      });
    }
  } catch (_) {
    mgrState._mainStarfieldMesh = null;
  }
  return mgrState._mainStarfieldMesh;
};

export const createMoon = (THREE, scene, mgrState) => {
  if (mgrState.moonMesh || !mgrState.texPath) return;

  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const loader = new THREE.TextureLoader();
  
  mgrState._moonTexReady = false;
  const map = loader.load(
    mgrState.texPath,
    () => { mgrState._moonTexReady = true; },
    null,
    () => { mgrState._moonTexReady = true; }
  );
  
  map.encoding = THREE.sRGBEncoding;
  // PC 微信客户端忽略 flipY，会让月球贴图上下颠倒；与地球同款纹理矩阵翻转修正（非 PC 下为 no-op）
  try { fixTexture(map, !!mgrState._isPCClient); } catch (_) {}

  const material = new THREE.MeshStandardMaterial({
    map: map,
    roughness: 0.9,
    metalness: 0.0,
    color: 0xdddddd
  });
  material.transparent = true;
  material.opacity = 0.0;

  mgrState.moonMesh = new THREE.Mesh(geometry, material);
  mgrState.moonMesh.visible = false;
  
  mgrState.moonMesh.position.set(0, 20, -20);
  mgrState.moonMesh.scale.set(0.1, 0.1, 0.1);
  
  if (scene) {
    scene.add(mgrState.moonMesh);
  }
};
