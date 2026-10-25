
import { APP_CFG } from './config.js';
import { createMilkyWay, createStarDustLayer } from './moon-voyage-visuals.js';
import { fixTexture } from './asset-manager.js';
import { PLANET_PARAMS } from './planet-materials.js';

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

  const lifecycleToken = mgrState._lifecycleToken;
  const current = () => !mgrState._isLifecycleCurrent || mgrState._isLifecycleCurrent(lifecycleToken);
  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const loader = new THREE.TextureLoader();
  let remaining = mgrState.normPath ? 2 : 1;
  mgrState._moonTexReady = false;
  const loaded = texture => {
    if (!current()) { texture?.dispose?.(); return; }
    if (--remaining === 0) mgrState._moonTexReady = true;
  };
  const failed = () => {
    if (!current()) return;
    console.warn('[Moon] Local visual texture failed');
    if (--remaining === 0) mgrState._moonTexReady = true;
  };
  const map = loader.load(mgrState.texPath, loaded, null, failed);
  map.encoding = THREE.sRGBEncoding;
  fixTexture(map, !!mgrState._isPCClient);
  const normalMap = mgrState.normPath ? loader.load(mgrState.normPath, loaded, null, failed) : null;
  if (normalMap) {
    normalMap.encoding = THREE.LinearEncoding;
    normalMap.minFilter = THREE.LinearFilter; normalMap.generateMipmaps = false;
    fixTexture(normalMap, !!mgrState._isPCClient);
  }
  const material = new THREE.MeshStandardMaterial({
    map, normalMap,
    normalScale: new THREE.Vector2(PLANET_PARAMS.moonNormalScale, PLANET_PARAMS.moonNormalScale),
    roughness: PLANET_PARAMS.moonRoughness, metalness: 0, color: 0xdddddd
  });
  // 2026-10-09 细化前的贴图、材质与原生色彩输出，仅叠加地形法线。
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
