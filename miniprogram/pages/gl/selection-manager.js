import { convertLatLonToVec3, convertVec3ToLatLon, normalizeLon, featureContains } from './geography.js';
import { gatherCandidates } from './geoindex.js';
import { FRONT_DOT_MIN_EDGE, HIT_CENTER_MAX_DEG } from './label-constants.js';

export class SelectionManager {
  constructor({ THREE, raycaster, camera, globeGroup, RADIUS, earthMeshRef, colliderGroupRef, countryFeaturesRef, searchRef, debugSelect, debugLog, lonSameSign, zoomRef }){
    this.THREE = THREE;
    this.raycaster = raycaster;
    this.camera = camera;
    this.globeGroup = globeGroup;
    this.RADIUS = RADIUS;
    this.earthMeshRef = earthMeshRef;
    this.colliderGroupRef = colliderGroupRef;
    this.countryFeaturesRef = countryFeaturesRef;
    this.searchRef = searchRef;
    this.debugSelect = debugSelect;
    this.debugLog = debugLog;
    this.lonSameSign = !!lonSameSign;
    this.zoomRef = zoomRef;
  }

  tap({ downX, downY, width, height }){
    const THREE = this.THREE;
    const raycaster = this.raycaster;
    const camera = this.camera;
    const globeGroup = this.globeGroup;
    const earthMesh = (typeof this.earthMeshRef === 'function') ? this.earthMeshRef() : null;
    const colliderGroup = (typeof this.colliderGroupRef === 'function') ? this.colliderGroupRef() : null;
    const COUNTRY_FEATURES = (typeof this.countryFeaturesRef === 'function') ? this.countryFeaturesRef() : null;
    const search = (typeof this.searchRef === 'function') ? this.searchRef() : null;
    const RADIUS = this.RADIUS;
    const debugSelect = this.debugSelect;
    const debugLog = this.debugLog;
    const lonSameSign = this.lonSameSign;
    const zoom = (typeof this.zoomRef === 'function') ? this.zoomRef() : 1;
    return performTapSelection({ THREE, raycaster, width, height, camera, globeGroup, earthMesh, colliderGroup, downX, downY, RADIUS, COUNTRY_FEATURES, search, debugSelect, debugLog, lonSameSign, zoom });
  }
}

export function performTapSelection(opts) {
  try {
    const {
      THREE,
      raycaster,
      width,
      height,
      camera,
      globeGroup,
      earthMesh,
      colliderGroup,
      downX,
      downY,
      RADIUS,
      COUNTRY_FEATURES,
      search,
      debugSelect,
      debugLog,
      lonSameSign,
      zoom
    } = opts || {};
    if (!earthMesh || !search || width <= 0 || height <= 0) return { hit: null, highlightTargets: null };
    raycaster.setFromCamera({ x: (downX / width) * 2 - 1, y: -(downY / height) * 2 + 1 }, camera);
    let inter = null; let interCountry = null;
    try { if (colliderGroup) interCountry = raycaster.intersectObject(colliderGroup, true)[0]; } catch(_) { }
    if (interCountry) {
      try {
        const globeCenter = new THREE.Vector3(); globeGroup.getWorldPosition(globeCenter);
        const normalP = interCountry.point.clone().sub(globeCenter).normalize();
        const viewP = camera.position.clone().sub(interCountry.point).normalize();
        const dotP = normalP.dot(viewP);
        if (dotP >= (typeof FRONT_DOT_MIN_EDGE === 'number' ? FRONT_DOT_MIN_EDGE : 0.0)) inter = interCountry;
      } catch(_) { inter = interCountry; }
    }
    if (!inter) {
      const interEarth = raycaster.intersectObject(earthMesh, true)[0];
      if (interEarth) {
        try {
          const globeCenter = new THREE.Vector3(); globeGroup.getWorldPosition(globeCenter);
          const normalP = interEarth.point.clone().sub(globeCenter).normalize();
          const viewP = camera.position.clone().sub(interEarth.point).normalize();
          const dotP = normalP.dot(viewP);
          if (dotP >= (typeof FRONT_DOT_MIN_EDGE === 'number' ? FRONT_DOT_MIN_EDGE : 0.0)) { inter = interEarth; }
        } catch(_) { inter = interEarth; }
      }
    }
    if (!inter) { return { hit: null, highlightTargets: null }; }
    const pLocal = globeGroup.worldToLocal(inter.point.clone());
    let [lon, lat] = convertVec3ToLatLon(pLocal.x, pLocal.y, pLocal.z);
    if (lonSameSign) lon = normalizeLon(lon);
    const v = convertLatLonToVec3(lon, lat, RADIUS + 0.003);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 16, 16), new THREE.MeshBasicMaterial({ color: 0x33ccff }));
    dot.position.set(v.x, v.y, v.z);
    globeGroup.add(dot);
    setTimeout(() => { try { globeGroup.remove(dot); dot.geometry?.dispose?.(); dot.material?.dispose?.(); } catch(_){} }, 800);
    let meshHit = null;
    const fidFromCollider = inter?.object?.userData?.fid;
    const isColliderHit = (typeof fidFromCollider === 'number');
    if (isColliderHit && COUNTRY_FEATURES && COUNTRY_FEATURES[fidFromCollider]) {
      const f0 = COUNTRY_FEATURES[fidFromCollider];
      if (featureContains(lon, lat, f0)) { meshHit = f0; }
    }
    let steps = [12, 24, 48, 80];
    try {
      const z = (typeof zoom === 'number' && isFinite(zoom) && zoom > 0) ? zoom : 1;
      const f = 1 / z;
      steps = Array.from(new Set(steps.map(v => Math.max(8, Math.min(96, Math.round(v * f)))))).sort((a,b) => a-b);
    } catch(_){ }
    let hit = null;
    if (meshHit) hit = meshHit;
    if (!hit) { for (const k of steps) {
      const candIds = gatherCandidates(search, lon, lat, k);
      if (debugLog && debugSelect) {
        try {
          const sample = candIds.slice(0, Math.min(10, candIds.length)).map(fid => {
            const f = COUNTRY_FEATURES[fid];
            const p = f?.props || {};
            const a3 = String(p.ISO_A3||'').toUpperCase();
            const name = p.NAME || p.ADMIN || a3 || `#${fid}`;
            return `${a3}:${name}`;
          });
          console.log('[hit-test] step', k, 'lon=', lon.toFixed(4), 'lat=', lat.toFixed(4), 'cand=', candIds.length, sample.join(', '));
        } catch(_){}
      }
      for (const fid of candIds) {
        const f = COUNTRY_FEATURES[fid];
        try {
          const b = f.bbox || [-180,-90,180,90];
          const cLon = (b[0] + b[2]) * 0.5;
          const cLat = (b[1] + b[3]) * 0.5;
          const A = convertLatLonToVec3(lon, lat, 1);
          const B = convertLatLonToVec3(cLon, cLat, 1);
          const va = new THREE.Vector3(A.x, A.y, A.z).normalize();
          const vb = new THREE.Vector3(B.x, B.y, B.z).normalize();
          const dot = Math.max(-1, Math.min(1, va.dot(vb)));
          const ang = Math.acos(dot) * 180 / Math.PI;
          if (ang > (typeof HIT_CENTER_MAX_DEG === 'number' ? HIT_CENTER_MAX_DEG : 60)) { continue; }
        } catch(_){ }
        if (featureContains(lon, lat, f)) { hit = f; break; }
      }
      if (hit) break;
    } }
    if (!hit && COUNTRY_FEATURES && COUNTRY_FEATURES.length) {
      for (let i = 0; i < COUNTRY_FEATURES.length; i++) {
        const f = COUNTRY_FEATURES[i];
        try {
          const b = f.bbox || [-180,-90,180,90];
          const cLon = (b[0] + b[2]) * 0.5;
          const cLat = (b[1] + b[3]) * 0.5;
          const A = convertLatLonToVec3(lon, lat, 1);
          const B = convertLatLonToVec3(cLon, cLat, 1);
          const va = new THREE.Vector3(A.x, A.y, A.z).normalize();
          const vb = new THREE.Vector3(B.x, B.y, B.z).normalize();
          const dot = Math.max(-1, Math.min(1, va.dot(vb)));
          const ang = Math.acos(dot) * 180 / Math.PI;
          if (ang > (typeof HIT_CENTER_MAX_DEG === 'number' ? HIT_CENTER_MAX_DEG : 60)) { continue; }
        } catch(_){ }
        if (featureContains(lon, lat, f)) { hit = f; break; }
      }
    }
    try {
      const nearby = [];
      for (let i = 0; i < (COUNTRY_FEATURES ? COUNTRY_FEATURES.length : 0); i++) {
        const f = COUNTRY_FEATURES[i];
        if (!featureContains(lon, lat, f)) continue;
        const b = f.bbox || [-180,-90,180,90];
        const cLon = (b[0] + b[2]) * 0.5;
        const cLat = (b[1] + b[3]) * 0.5;
        const A = convertLatLonToVec3(lon, lat, 1);
        const B = convertLatLonToVec3(cLon, cLat, 1);
        const va = new THREE.Vector3(A.x, A.y, A.z).normalize();
        const vb = new THREE.Vector3(B.x, B.y, B.z).normalize();
        const dot = Math.max(-1, Math.min(1, va.dot(vb)));
        const ang = Math.acos(dot) * 180 / Math.PI;
        nearby.push({ f, d: ang });
      }
      if (nearby.length >= 2) {
        nearby.sort((a,b) => a.d - b.d);
        const pick = nearby[0]?.f || null;
        if (pick) hit = pick;
      }
    } catch(_){ }

    try {
      let frFeat = null, xkFeat = null;
      for (let i = 0; i < (COUNTRY_FEATURES ? COUNTRY_FEATURES.length : 0); i++) {
        const f = COUNTRY_FEATURES[i];
        if (!featureContains(lon, lat, f)) continue;
        const p = f?.props || {};
        const codeA3 = String(p.ISO_A3 || '').toUpperCase();
        const codeA2 = String(p.ISO_A2 || p.ISO || p.ISO2 || p.CC || '').toUpperCase();
        const nm = p.NAME || p.ADMIN || '';
        const isFR = (codeA3 === 'FRA' || codeA2 === 'FR');
        const isXK = (codeA3 === 'XKX' || codeA2 === 'XK' || /KOSOVO/i.test(nm));
        if (isFR) frFeat = f;
        if (isXK) xkFeat = f;
      }
      if (frFeat && xkFeat && hit) {
        const hp = hit?.props || {};
        const hA3 = String(hp.ISO_A3 || '').toUpperCase();
        const hA2 = String(hp.ISO_A2 || hp.ISO || hp.ISO2 || hp.CC || '').toUpperCase();
        const hNm = hp.NAME || hp.ADMIN || '';
        const hitIsXK = (hA3 === 'XKX' || hA2 === 'XK' || /KOSOVO/i.test(hNm));
        if (hitIsXK) { hit = frFeat; }
      }
    } catch(_){ }
    if (debugLog && debugSelect) {
      try {
        const multi = [];
        for (let i = 0; i < (COUNTRY_FEATURES ? COUNTRY_FEATURES.length : 0); i++) {
          const f = COUNTRY_FEATURES[i];
          if (featureContains(lon, lat, f)) {
            const p = f?.props || {};
            const a3 = String(p.ISO_A3||'').toUpperCase();
            const name = p.NAME || p.ADMIN || a3 || `#${i}`;
            multi.push(`${a3}:${name}`);
            if (multi.length >= 6) break;
          }
        }
        if (multi.length > 1) {
          console.warn('[hit-test] multi-matches@', lon.toFixed(4), lat.toFixed(4), '=>', multi.join(' | '));
        } else if (multi.length === 1) {
          console.log('[hit-test] single-match@', lon.toFixed(4), lat.toFixed(4), '=>', multi[0]);
        } else {
          console.log('[hit-test] no-match@', lon.toFixed(4), lat.toFixed(4));
        }
      } catch(_){ }
    }
    try {
      let __highlightTarget = hit;
      const p = hit?.props || {};
      const codeRaw = p.ISO_A3 || p.ISO_A2 || p.ISO || p.CC || p.ISO3 || p.SOV_A3 || null;
      const code = (codeRaw ? String(codeRaw).toUpperCase() : null);
      if (code === 'TWN' || code === 'TW') {
        let fCN = null;
        if (COUNTRY_FEATURES && COUNTRY_FEATURES.length) {
          for (let i = 0; i < COUNTRY_FEATURES.length; i++) {
            const fi = COUNTRY_FEATURES[i];
            const pi = fi?.props || {};
            const ciRaw = pi.ISO_A3 || pi.ISO_A2 || pi.ISO || pi.CC || pi.ISO3 || pi.SOV_A3 || null;
            const ci = (ciRaw ? String(ciRaw).toUpperCase() : null);
            if (ci === 'CHN') { fCN = fi; break; }
          }
        }
        if (fCN) { __highlightTarget = [fCN, hit]; }
      } else if (code === 'CHN' || code === 'CN') {
        let fTW = null;
        if (COUNTRY_FEATURES && COUNTRY_FEATURES.length) {
          for (let i = 0; i < COUNTRY_FEATURES.length; i++) {
            const fi = COUNTRY_FEATURES[i];
            const pi = fi?.props || {};
            const ciRaw = pi.ISO_A3 || pi.ISO_A2 || pi.ISO || pi.CC || pi.ISO3 || pi.SOV_A3 || null;
            const ci = (ciRaw ? String(ciRaw).toUpperCase() : null);
            if (ci === 'TWN' || ci === 'TW') { fTW = fi; break; }
          }
        }
        if (fTW) { __highlightTarget = [hit, fTW]; }
      }
      return { hit, highlightTargets: __highlightTarget, lon, lat };
    } catch(_) { return { hit, highlightTargets: hit, lon, lat }; }
  } catch(_) { return { hit: null, highlightTargets: null }; }
}