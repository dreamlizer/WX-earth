import { applyLandNormal } from './earth-land-normal.js';
import { fixTexture } from './asset-manager.js';

let earthPackage = null;
let moonPackage = null;
let moonColorPackage = null;
export function ensureEarthVisualPackage() {
  if (!earthPackage) earthPackage = new Promise((resolve, reject) => {
    require('../../earth-look-assets/ready.js', resolve, reject);
  }).catch(error => { earthPackage = null; throw error; });
  return earthPackage;
}
export function ensureMoonVisualPackage() {
  if (!moonPackage) moonPackage = new Promise((resolve, reject) => {
    require('../../moon-look-assets/ready.js', resolve, reject);
  }).catch(error => { moonPackage = null; throw error; });
  return moonPackage;
}
export function ensureMoonColorPackage() {
  if (!moonColorPackage) moonColorPackage = new Promise((resolve, reject) => {
    require('../../moon-color-assets/ready.js', resolve, reject);
  }).catch(error => { moonColorPackage = null; throw error; });
  return moonColorPackage;
}

export async function installEarthVisual(ctx) {
  const { THREE, refs, globeGroup, checkState, config } = ctx;
  const textures = [];
  let installed = false;
  try {
    await ensureEarthVisualPackage();
    if (!checkState()) return false;
    const loader = new THREE.TextureLoader();
    const load = filename => new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => { settled = true; reject(new Error(filename + ' timeout')); }, 15000);
      loader.load('/earth-look-assets/' + filename, texture => {
        clearTimeout(timer);
        if (settled || !checkState()) { texture.dispose(); if (!settled) resolve(null); return; }
        settled = true;
        texture.encoding = THREE.LinearEncoding;
        texture.flipY = true;
        texture.wrapS = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.anisotropy = 1;
        fixTexture(texture, config.isPCClient);
        texture.needsUpdate = true;
        textures.push(texture);
        resolve(texture);
      }, undefined, error => { clearTimeout(timer); if (!settled) { settled = true; reject(error || new Error(filename)); } });
    });
    const results = await Promise.allSettled(['earth-water-mask.png','earth-normal.jpg'].map(load));
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    if (!checkState()) return false;
    // Do not change an Earth material while the voyage owns its backup.
    while (refs.page()?.data?.moonVoyageActive && checkState()) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!checkState()) return false;
    const earth = refs.earthMesh();
    if (!earth) throw new Error('Earth mesh not ready');
    const previous = earth.userData.landNormal;
    const [mask, normal] = results.map(result => result.value);
    earth.userData.landNormal = { mask, normal, strength: 2 };
    applyLandNormal(THREE, earth.material, earth.userData.landNormal,
      !refs.zenActive() && refs.currentTheme() !== 'night');
    if (previous) { previous.mask.dispose(); previous.normal.dispose(); }
    installed = true;
    console.log('[Planet visual] Original Earth maps and lighting retained; land normal ready');
    return true;
  } catch (error) {
    if (checkState()) console.warn('[Planet visual] Keeping existing Earth:', error?.message || error);
    return false;
  } finally {
    if (!installed) textures.forEach(texture => texture.dispose());
  }
}

