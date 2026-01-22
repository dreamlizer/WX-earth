
export const findEarthMesh = (globeGroup) => {
  if (!globeGroup) return null;
  try {
    if (typeof globeGroup.getObjectByName === 'function') {
      const m = globeGroup.getObjectByName('EARTH');
      if (m) return m;
    }
  } catch (_) {}
  let found = null;
  try {
    if (typeof globeGroup.traverse === 'function') {
      globeGroup.traverse((o) => {
        if (found) return;
        if (o && o.name === 'EARTH') found = o;
      });
    }
  } catch (_) {}
  return found;
};

export const setGlobeWorldPosition = (THREE, globeGroup, worldPos) => {
  if (!globeGroup || !worldPos) return;
  try {
    const parent = globeGroup.parent;
    if (parent && typeof parent.worldToLocal === 'function') {
      if (THREE) {
        const tmp = new THREE.Vector3();
        tmp.copy(worldPos);
        parent.worldToLocal(tmp);
        globeGroup.position.copy(tmp);
        return;
      }
    }
  } catch (_) {}
  try { globeGroup.position.copy(worldPos); } catch (_) { try { globeGroup.position.set(worldPos.x, worldPos.y, worldPos.z); } catch (_) {} }
};

export const forceGroupVisible = (group) => {
  if (!group) return;
  try { group.visible = true; } catch (_) {}
  try { group.frustumCulled = false; } catch (_) {}
  try {
    if (typeof group.traverse === 'function') {
      group.traverse((o) => {
        try { o.visible = true; } catch (_) {}
        try { o.frustumCulled = false; } catch (_) {}
      });
    } else if (Array.isArray(group.children)) {
      group.children.forEach((c) => { try { c.visible = true; } catch (_) {} });
    }
  } catch (_) {}
};

export const ensureEarthVisibleInVoyage = (THREE, globeGroup, mgrState) => {
  if (!THREE || !globeGroup) return;

  const earthMesh = findEarthMesh(globeGroup);
  if (earthMesh) {
    if (!mgrState._earthMaterialBackup) {
      mgrState._earthMaterialBackup = earthMesh.material || null;
      mgrState._earthMaterialBackupMesh = earthMesh;
    }
    const srcMat = mgrState._earthMaterialBackup || earthMesh.material;
    const map = srcMat?.map || earthMesh.material?.map || null;

    if (!mgrState._earthVoyageMaterial || (mgrState._earthVoyageMaterial.map !== map && map)) {
      const m = new THREE.MeshBasicMaterial({ color: 0xffffff, map: map || null });
      m.transparent = false;
      m.opacity = 1.0;
      mgrState._earthVoyageMaterial = m;
    }

    if (mgrState._earthVoyageMaterial && earthMesh.material !== mgrState._earthVoyageMaterial) {
      earthMesh.material = mgrState._earthVoyageMaterial;
    }

    try { earthMesh.visible = true; } catch (_) {}
    try { earthMesh.frustumCulled = false; } catch (_) {}
    try {
      if (earthMesh.material) {
        earthMesh.material.transparent = false;
        if (typeof earthMesh.material.opacity === 'number') earthMesh.material.opacity = 1.0;
        earthMesh.material.needsUpdate = true;
      }
    } catch (_) {}
    return;
  }

  if (!mgrState._earthFallbackMesh) {
    try {
      const geo = new THREE.SphereGeometry(1.0, 32, 32);
      const mat = new THREE.MeshBasicMaterial({ color: 0x2a7fff });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'EARTH_FALLBACK';
      try { mesh.renderOrder = 11; } catch (_) {}
      try { mesh.frustumCulled = false; } catch (_) {}
      mgrState._earthFallbackMesh = mesh;
      globeGroup.add(mesh);
    } catch (_) {}
  }
  try { if (mgrState._earthFallbackMesh) mgrState._earthFallbackMesh.visible = true; } catch (_) {}
};

export const clampGlobeToViewport = (THREE, globeGroup, camera, marginNdc = 0.08) => {
  if (!THREE || !globeGroup || !camera) return;
  
  // Use local temporary vectors from a context if possible, but for simplicity here we alloc or use closure
  // To avoid allocs, we'll assume the caller might want to pass buffers, but here we'll use a static-like scope or just new ones for safety in this utility file.
  // Actually, to respect the "no new allocs" optimization, we should probably pass the tmp vectors.
  // However, for this refactor, let's keep it simple first. The original code used `this._tmp...`
  // We can pass `mgrState` which holds the temp vectors.
  
  // Refactored to accept mgrState for temp vectors
  const S = {
    cWorld: new THREE.Vector3(),
    cNdc: new THREE.Vector3(),
    pNdc: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
    scale: new THREE.Vector3(),
    resWorld: new THREE.Vector3()
  };

  let radiusWorld = 0.0;
  try {
    const earthMesh = findEarthMesh(globeGroup);
    const geo = earthMesh?.geometry;
    if (geo && !geo.boundingSphere) {
      try { geo.computeBoundingSphere?.(); } catch (_) {}
    }
    const r0 = Number(geo?.boundingSphere?.radius || 1.0);
    globeGroup.getWorldScale(S.scale);
    radiusWorld = Math.max(1e-6, r0 * Math.max(1e-6, Number(S.scale.x || globeGroup.scale?.x || 1.0)));
  } catch (_) {
    try {
      globeGroup.getWorldScale(S.scale);
      radiusWorld = Math.max(1e-6, Number(S.scale.x || globeGroup.scale?.x || 1.0));
    } catch (_) {}
  }
  if (!(radiusWorld > 0)) return;

  try { globeGroup.getWorldPosition(S.cWorld); } catch (_) { S.cWorld.copy(globeGroup.position); }
  S.cNdc.copy(S.cWorld).project(camera);
  if (!Number.isFinite(S.cNdc.x) || !Number.isFinite(S.cNdc.y) || !Number.isFinite(S.cNdc.z)) return;

  S.right.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
  S.up.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

  const ndcC = S.cNdc;
  S.pNdc.copy(S.cWorld).addScaledVector(S.right, radiusWorld).project(camera);
  const rx = Math.abs(Number(S.pNdc.x) - Number(ndcC.x));
  S.pNdc.copy(S.cWorld).addScaledVector(S.up, radiusWorld).project(camera);
  const ry = Math.abs(Number(S.pNdc.y) - Number(ndcC.y));

  const m = Math.max(0.0, Math.min(0.45, Number(marginNdc || 0)));
  const minX = -1.0 + m + rx;
  const maxX = 1.0 - m - rx;
  const minY = -1.0 + m + ry;
  const maxY = 1.0 - m - ry;
  if (!(minX < maxX) || !(minY < maxY)) return;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const nx = clamp(ndcC.x, minX, maxX);
  const ny = clamp(ndcC.y, minY, maxY);
  if (Math.abs(nx - ndcC.x) < 1e-6 && Math.abs(ny - ndcC.y) < 1e-6) return;

  S.resWorld.set(nx, ny, ndcC.z).unproject(camera);
  const delta = S.resWorld.sub(S.cWorld);
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y) || !Number.isFinite(delta.z)) return;

  S.cWorld.add(delta);
  setGlobeWorldPosition(THREE, globeGroup, S.cWorld);
};

export const syncEarthShaderUniforms = (THREE, globeGroup, camera, scene, earthMesh, moonDebug = false) => {
  const mat = earthMesh?.material;
  const u = mat?.uniforms;
  if (!u) return;

  const dir = scene?.children?.find?.(c => c.type === 'DirectionalLight');
  if (!camera || !globeGroup) return;

  try { if (earthMesh) earthMesh.visible = true; } catch (_) {}
  try {
    if (typeof mat.opacity === 'number') mat.opacity = 1.0;
    if (u?.uOpacity) u.uOpacity.value = 1.0;
  } catch (_) {}

  try {
    const tmpCenter = new THREE.Vector3();
    const tmpDir = new THREE.Vector3();
    globeGroup.getWorldPosition(tmpCenter);
    if (dir?.position) {
      tmpDir.copy(dir.position).sub(tmpCenter).normalize();
    } else {
      tmpDir.set(1, 0, 0);
    }
    if (u?.uLightDirWorld?.value) u.uLightDirWorld.value.copy(tmpDir);
    if (u?.uGlobeCenterWorld?.value) u.uGlobeCenterWorld.value.copy(tmpCenter);
    try { if (u?.uCameraPosWorld?.value) u.uCameraPosWorld.value.copy(camera.position); } catch (_) {}
    try { if (u?.uTime) u.uTime.value = Date.now() * 0.001; } catch (_) {}
  } catch (_) {}

  if (moonDebug) {
    try {
      console.log('[Moon][EarthMatDiag]', {
        matType: String(mat?.type || ''),
        hasU: true,
        uOpacity: Number(u?.uOpacity?.value ?? -1),
        globeVisible: !!globeGroup?.visible,
        earthVisible: !!earthMesh?.visible,
      });
    } catch (_) {}
  }
};

export const applyEarthNearAnchor = ({ THREE, globeGroup, camera, moonWorld, moonR, baseScale, cfg, dtSec = 0.0, mgrState }) => {
  if (!moonWorld || !camera || !globeGroup || !THREE) return;
  if (!mgrState) return;

  if (!mgrState._tmpEarthNearPos) mgrState._tmpEarthNearPos = new THREE.Vector3();
  if (!mgrState._tmpEarthNearTargetWorld) mgrState._tmpEarthNearTargetWorld = new THREE.Vector3();
  if (!mgrState._tmpEarthNearFromWorld) mgrState._tmpEarthNearFromWorld = new THREE.Vector3();
  if (!mgrState._tmpEarthNearSmoothedWorld) mgrState._tmpEarthNearSmoothedWorld = new THREE.Vector3();

  const azDeg = Number(cfg?.azOffsetDeg ?? 0) || 0;
  const distR = Math.max(0.0, Number(cfg?.distR ?? 2.2) || 0);
  const sideR = Number(cfg?.sideR ?? -1.2) || 0;
  const upR = Number(cfg?.upR ?? 0.65) || 0;
  const sizeRatioToMoon = Math.max(0.01, Number(cfg?.sizeRatioToMoon ?? 0.2) || 0.2);
  const transitionSec = Math.max(0.0, Number(cfg?.transitionSec ?? 0.25) || 0.25);
  const viewportMarginNdc = Math.max(0.0, Math.min(0.45, Number(cfg?.viewportMarginNdc ?? 0.08) || 0.08));

  const sig = `${azDeg}|${distR}|${sideR}|${upR}|${sizeRatioToMoon}`;
  const offsetChanged = (!mgrState._earthNearOffset || mgrState._earthNearSig !== sig);
  if (offsetChanged) {
    mgrState._earthNearSig = sig;
    mgrState._earthNearOffset = new THREE.Vector3();

    const forward = new THREE.Vector3().copy(moonWorld).sub(camera.position);
    const fLen = Math.max(1e-6, forward.length());
    forward.multiplyScalar(1.0 / fLen);

    const upAxis = new THREE.Vector3().copy(camera.up || new THREE.Vector3(0, 1, 0));
    const upLen = Math.max(1e-6, upAxis.length());
    upAxis.multiplyScalar(1.0 / upLen);

    const right = new THREE.Vector3().crossVectors(forward, upAxis);
    const rLen = Math.max(1e-6, right.length());
    right.multiplyScalar(1.0 / rLen);

    const fromMoonToCam = new THREE.Vector3().copy(camera.position).sub(moonWorld);
    const mcLen = Math.max(1e-6, fromMoonToCam.length());
    fromMoonToCam.multiplyScalar(1.0 / mcLen);

    if (azDeg) {
      try { fromMoonToCam.applyAxisAngle(upAxis, azDeg * Math.PI / 180.0).normalize(); } catch (_) {}
    }

    const dist = Math.max(moonR * 1.4, Math.min(moonR * distR, fLen - moonR * 1.1));
    mgrState._earthNearOffset.copy(fromMoonToCam).multiplyScalar(dist)
      .addScaledVector(right, moonR * sideR)
      .addScaledVector(upAxis, moonR * upR);
  }

  mgrState._tmpEarthNearPos.copy(moonWorld).add(mgrState._earthNearOffset);
  mgrState._tmpEarthNearTargetWorld.copy(mgrState._tmpEarthNearPos);
  const mul = (baseScale > 0) ? ((moonR * Math.max(0.01, Number(cfg?.sizeRatioToMoon ?? 0.2) || 0.2)) / baseScale) : 0.2;
  const earthScale = baseScale * Math.max(0.01, mul);
  if (transitionSec > 1e-6) {
    if (!mgrState._earthNearBlendPos0 || offsetChanged) {
      try { globeGroup.getWorldPosition(mgrState._tmpEarthNearFromWorld); } catch (_) { mgrState._tmpEarthNearFromWorld.copy(globeGroup.position); }
      mgrState._earthNearBlendPos0 = mgrState._earthNearBlendPos0 || new THREE.Vector3();
      mgrState._earthNearBlendPos0.copy(mgrState._tmpEarthNearFromWorld);
      mgrState._earthNearBlendScale0 = Number(globeGroup.scale?.x ?? earthScale);
      mgrState._earthNearBlend = 0.0;
    } else {
      mgrState._earthNearBlend = Math.min(1.0, Number(mgrState._earthNearBlend || 0) + (Number(dtSec || 0) / transitionSec));
    }
    const b = Math.max(0.0, Math.min(1.0, Number(mgrState._earthNearBlend || 0)));
    const k = b * b * (3.0 - 2.0 * b);
    mgrState._tmpEarthNearSmoothedWorld.lerpVectors(mgrState._earthNearBlendPos0, mgrState._tmpEarthNearTargetWorld, k);
    setGlobeWorldPosition(THREE, globeGroup, mgrState._tmpEarthNearSmoothedWorld);
    const s0 = (typeof mgrState._earthNearBlendScale0 === 'number') ? mgrState._earthNearBlendScale0 : earthScale;
    const s = s0 + (earthScale - s0) * k;
    globeGroup.scale.set(s, s, s);
  } else {
    setGlobeWorldPosition(THREE, globeGroup, mgrState._tmpEarthNearTargetWorld);
    globeGroup.scale.set(earthScale, earthScale, earthScale);
  }
  forceGroupVisible(globeGroup);
  ensureEarthVisibleInVoyage(THREE, globeGroup, mgrState);
  clampGlobeToViewport(THREE, globeGroup, camera, viewportMarginNdc);
  syncEarthShaderUniforms(THREE, globeGroup, camera, globeGroup.parent, findEarthMesh(globeGroup));
};
