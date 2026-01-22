
import { makeTextSprite } from './text-sprite.js';
import * as _const from './label-constants.js';

// 常量
const LABEL_ALTITUDE = _const?.LABEL_ALTITUDE ?? 0.02;
const RES_SCALE = _const?.RES_SCALE ?? 3.0;

const FONT_COUNTRY_PX = (_const?.FONT_COUNTRY_BASE ? Math.max(18, Math.round(_const.FONT_COUNTRY_BASE * 1.6)) : 36) * RES_SCALE; 
const FONT_CITY_PX = (_const?.FONT_CITY_BASE ? Math.max(14, Math.round((_const.FONT_CITY_BASE + 2) * 1.6)) : 26) * RES_SCALE;

const COUNTRY_TEXT_COLOR = _const?.COUNTRY_TEXT_COLOR ?? '#ffffff';
const CITY_TEXT_COLOR = _const?.CITY_TEXT_COLOR ?? '#d7e1ea';
const CITY_STROKE_WIDTH = _const?.CITY_STROKE_WIDTH ?? 2;
const CITY_FONT_WEIGHT = _const?.CITY_FONT_WEIGHT ?? 400;
const CITY_FONT_FAMILY = _const?.CITY_FONT_FAMILY ?? 'sans-serif';
const CITY_USE_CAPSULE = _const?.CITY_USE_CAPSULE ?? true;
const CITY_BG_COLOR = _const?.CITY_BG_COLOR ?? 'rgba(255, 255, 255, 0.7)';
const CITY_PADDING_PX = _const?.CITY_PADDING_PX ?? 10;
const DEFAULT_WORLD_HEIGHT = _const?.DEFAULT_WORLD_HEIGHT ?? 0.125;
const CITY_WORLD_HEIGHT = _const?.CITY_WORLD_HEIGHT ?? 0.070;

const LABEL_MESHES = new Map(); // id -> Sprite
const LABEL_STATES = new Map(); // id -> { alpha, lastWinAt }

export const LabelsRender = {
  get LABEL_MESHES() { return LABEL_MESHES; },
  get LABEL_STATES() { return LABEL_STATES; },

  clearAll(globeGroup) {
    LABEL_MESHES.forEach(mesh => {
      globeGroup?.remove(mesh);
      try { mesh.material?.map?.dispose?.(); mesh.material?.dispose?.(); } catch(_) {}
    });
    LABEL_MESHES.clear();
    LABEL_STATES.clear();
  },

  forceHideAll() {
    LABEL_MESHES.forEach(mesh => {
      mesh.visible = false;
    });
  },

  // 获取或创建 Mesh
  getOrCreateMesh(id, meta, ctx) {
    let mesh = LABEL_MESHES.get(id);
    if (mesh) return mesh;

    if (!meta || !meta.baseVec3 || !ctx) return null;
    const { THREE, globeGroup } = ctx;

    const isCity = meta.isCity;
    const px = isCity ? FONT_CITY_PX : FONT_COUNTRY_PX;
    const wh = isCity ? CITY_WORLD_HEIGHT : DEFAULT_WORLD_HEIGHT;
    const color = isCity ? CITY_TEXT_COLOR : COUNTRY_TEXT_COLOR;
    const useCapsule = isCity && CITY_USE_CAPSULE;
    const baseStroke = isCity ? CITY_STROKE_WIDTH : 3;
    const strokeWidth = (useCapsule ? 0 : baseStroke) * RES_SCALE;
    const bg = useCapsule ? CITY_BG_COLOR : null;
    const padding = (isCity ? CITY_PADDING_PX : 14) * RES_SCALE;
    const fontWeight = isCity ? CITY_FONT_WEIGHT : 600;

    mesh = makeTextSprite(THREE, meta.text, { 
      worldHeight: wh, 
      padding, 
      strokeWidth, 
      font: `${fontWeight} ${px}px ${CITY_FONT_FAMILY}`, 
      color, 
      bg, 
      capsule: useCapsule 
    });

    if (mesh) {
      mesh.visible = false;
      const local = new THREE.Vector3(meta.baseVec3.x, meta.baseVec3.y, meta.baseVec3.z).multiplyScalar(1 + LABEL_ALTITUDE);
      mesh.position.set(local.x, local.y, local.z);
      mesh.userData.baseScaleX = mesh.scale.x;
      mesh.userData.baseScaleY = mesh.scale.y;
      
      if (mesh.material) { mesh.material.depthTest = false; mesh.material.depthWrite = false; }
      mesh.renderOrder = 999;
      
      globeGroup.add(mesh);
      LABEL_MESHES.set(id, mesh);
      
      if (!LABEL_STATES.has(id)) {
        LABEL_STATES.set(id, { alpha: 0, lastWinAt: 0 });
      }
    }
    return mesh;
  },

  // 重建 Mesh (用于文本更新)
  rebuildMesh(id, meta, ctx) {
    const old = LABEL_MESHES.get(id);
    if (old) {
      ctx.globeGroup?.remove(old);
      try {
        old.material?.map?.dispose?.();
        old.material?.dispose?.();
      } catch(_) {}
      LABEL_MESHES.delete(id);
    }
    return this.getOrCreateMesh(id, meta, ctx);
  },

  resetState(id) {
    const st = LABEL_STATES.get(id);
    if (st) {
      delete st.pulsePending;
      delete st.pulseStart;
      delete st.pulseDur;
    } else {
      LABEL_STATES.set(id, { alpha: 0, lastWinAt: 0 });
    }
  }
};
