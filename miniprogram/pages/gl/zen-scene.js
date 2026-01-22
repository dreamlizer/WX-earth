
// 禅定模式 - 3D 场景与动画逻辑
// 职责：处理地球材质切换、镜头推拉动画、惯性旋转与刹车

export const zenState = { active: false, tiltZ: 0, zoom: 1.0, anim: null, brake: null, delayEnter: false, stableSince: 0, restore: null };

export function resetZenState() {
  zenState.active = false;
  zenState.tiltZ = 0;
  zenState.zoom = 1.0;
  zenState.anim = null;
  zenState.brake = null;
  zenState.delayEnter = false;
  zenState.stableSince = 0;
  zenState.restore = { rotX: 0, rotY: 0, zoom: 1.0 };
}

export function applyZenAutoRotate(touch, dtSec, now, cfg, zenActive, animating, zenStableSince){
  try {
    if (zenActive && !animating) {
      if (zenStableSince === 0) zenStableSince = now;
      if (cfg?.enabled && (now - zenStableSince) >= (cfg.startDelayMs || 0)) {
        const w = (cfg.degPerSec || 0) * Math.PI / 180;
        touch.rotY += w * dtSec;
      }
    }
  } catch(_){ }
  return zenStableSince;
}

export function applyZenBrake(brake, touch, now, logFlag, onBrakeCompleted){
  try {
    if (!brake) return brake;
    const t = Math.max(0, Math.min(1, (now - brake.t0) / Math.max(1, brake.dur)));
    const easeOut = 1 - Math.pow(1 - t, 3);
    const scale = Math.max(0, 1 - easeOut);
    touch.velX *= scale; touch.velY *= scale;
    if (t >= 1) {
      brake = null; touch.velX = 0; touch.velY = 0;
      try { if (logFlag) console.log('[zen] pre-stop done'); } catch(_){ }
      try { if (typeof onBrakeCompleted === 'function') onBrakeCompleted(); } catch(_){ }
    }
  } catch(_){ }
  return brake;
}

export function advanceZenAnimation(anim, now, ctx){
  try {
    if (!anim) return { anim, tiltZ: ctx.tiltZ, zoom: ctx.zoom, zenStableSince: ctx.zenStableSince };
    const { t0, dur, from, to } = anim;
    const t = Math.max(0, Math.min(1, (now - t0) / Math.max(1, dur)));
    const ease = (x) => x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3)/2;
    const k = ease(t);
    const tiltZ = from.tiltZ + (to.tiltZ - from.tiltZ) * k;
    const nx = from.rotX + (to.rotX - from.rotX) * k;
    const nzm = from.zoom + (to.zoom - from.zoom) * k;
    if (ctx.globeGroup && from.posY !== undefined && to.posY !== undefined) {
      const ny = from.posY + (to.posY - from.posY) * k;
      ctx.globeGroup.position.y = ny;
    }
    ctx.touch.rotX = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, nx));
    const newZoom = ctx.clampZoom(nzm);
    if (Math.abs(newZoom - ctx.zoom) > 1e-6) { ctx.zoom = newZoom; ctx.updateCamDist(ctx.camera, ctx.baseDist, ctx.zoom); }
    ctx.touch.velX = 0; ctx.touch.velY = 0;
    if (t >= 1) {
      const next = anim.next;
      const after = anim.after;
      if (next && next.from && next.to && next.dur) {
        next.t0 = Date.now();
        anim = next;
      } else {
        anim = null;
        ctx.zenStableSince = now;
        try { if (typeof after === 'function') after(); } catch(_){ }
      }
    }
    return { anim, tiltZ, zoom: ctx.zoom, zenStableSince: ctx.zenStableSince };
  } catch(_){ }
  return { anim, tiltZ: ctx.tiltZ, zoom: ctx.zoom, zenStableSince: ctx.zenStableSince };
}

export function advanceRotationFrame(ctx){
  try {
    const { touch, dtSec, now, LIGHT_CFG, zenActive, globeGroup, camera, baseDist, clampZoom, updateCamDist, flyMgr, INTERACTION_DEBUG_LOG, render, setZenMode } = ctx;
    let tiltZ = ctx.tiltZ;
    let zoom = ctx.zoom;
    let anim = ctx.__zenAnim;
    let brake = ctx.__zenBrake;
    let zenStableSince = ctx.zenStableSince;
    let __zenDelayEnter = ctx.__zenDelayEnter;
    if (!touch.isDragging && !touch.pinch) {
      if (anim) {
        const res = advanceZenAnimation(anim, now, { touch, globeGroup, camera, baseDist, clampZoom, updateCamDist, tiltZ, zoom, zenStableSince });
        anim = res.anim; tiltZ = res.tiltZ; zoom = res.zoom; zenStableSince = res.zenStableSince;
      } else if (flyMgr.advanceFlight(now)) {
      } else {
        if (zenActive && !anim) {
          const targetTilt = ((LIGHT_CFG?.zen?.tiltDeg ?? 23) * Math.PI / 180);
          const targetZoom = Number(LIGHT_CFG?.zen?.zoom ?? 0.74);
          const offR = Number(LIGHT_CFG?.zen?.globeYOffsetR ?? -0.35);
          const baseY0 = -0.55;
          const targetY = baseY0 + offR;
          const curY = globeGroup?.position?.y || 0;
          const needTilt = Math.abs(tiltZ - targetTilt) > 1e-3;
          const needZoom = Math.abs(zoom - targetZoom) > 1e-3;
          const needPos = Math.abs(curY - targetY) > 1e-3;
          if (needTilt || needZoom || needPos) {
            anim = { t0: now, dur: Number(LIGHT_CFG?.zen?.animMs ?? 1000), from: { rotX: touch.rotX, zoom, tiltZ, posY: curY }, to: { rotX: 0, zoom: targetZoom, tiltZ: targetTilt, posY: targetY } };
          }
        }
        if (!anim) {
          zenStableSince = applyZenAutoRotate(touch, dtSec, now, LIGHT_CFG.zen?.autoRotate, zenActive, !!anim, zenStableSince);
        }
        brake = applyZenBrake(brake, touch, now, INTERACTION_DEBUG_LOG, () => { if (__zenDelayEnter) { __zenDelayEnter = false; try { setZenMode(true); } catch(_){ } } });
        if (Math.abs(touch.velX) > 0.0002 || Math.abs(touch.velY) > 0.0002) {
          touch.rotX += zenActive ? 0 : touch.velX; touch.rotY += touch.velY;
          touch.rotX = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, touch.rotX));
          touch.velX *= touch.damping; touch.velY *= touch.damping;
          try {
            if (INTERACTION_DEBUG_LOG) {
              if (!render.__lastInertiaLog || (now - render.__lastInertiaLog) > 300) {
                console.log('[inertia:apply]', {
                  velX: Number(touch.velX.toFixed(5)),
                  velY: Number(touch.velY.toFixed(5)),
                  damping: Number(touch.damping.toFixed(3)),
                  maxSpeed: Number(touch.maxSpeed.toFixed(3))
                });
                render.__lastInertiaLog = now;
              }
            }
          } catch(_){ }
        } else { touch.velX = 0; touch.velY = 0; }
      }
    }
    return { tiltZ, zoom, __zenAnim: anim, __zenBrake: brake, zenStableSince, __zenDelayEnter };
  } catch(_){ }
  return { tiltZ: ctx.tiltZ, zoom: ctx.zoom, __zenAnim: ctx.__zenAnim, __zenBrake: ctx.__zenBrake, zenStableSince: ctx.zenStableSince, __zenDelayEnter: ctx.__zenDelayEnter };
}

export function createZenController(ctx) {
  const {
    APP_CFG, LIGHT_CFG, touch, globeGroup, 
    flyMgr, highlight, page, starCtl, lighting,
    TROPIC_GROUP_REF, BORDER_GROUP_REF, 
    earthMeshRef, earthDayTexRef, earthPureDayTexRef, earthNightTexRef,
    themeController, THREE, scene, camera, width, height, 
    sysInfo, RADIUS, dirLightBase, ambientLight, dirLight,
    createPoetry3D, applyZenOverlayFactors, restoreOverlayFactors,
    applyZenMaterial, restoreZenMaterial,
    getZenStarOpacityTarget, getNormalStarOpacityTarget,
    ambientBase, brightnessScale,
    refs, setters
  } = ctx;

  const setMode = (on) => {
    const next = !!on;
    if (next === zenState.active) return;
    
    const _doTransition = () => {
      if (next) {
        const res = enterZenMode({
            APP_CFG, LIGHT_CFG, touch, globeGroup, zoom: zenState.zoom, tiltZ: zenState.tiltZ,
            flyMgr, highlight, page, starCtl, lighting,
            TROPIC_GROUP: TROPIC_GROUP_REF(), BORDER_GROUP: BORDER_GROUP_REF(), 
            applyZenOverlayFactors,
            applyZenMaterial, 
            earthMesh: earthMeshRef(), 
            earthDayTex: earthDayTexRef(), 
            earthPureDayTex: earthPureDayTexRef(), 
            earthNightTex: earthNightTexRef(), 
            currentTheme: themeController.currentTheme,
            themeState: themeController.themeState, 
            THREE, scene, camera, width, height, createPoetry3D,
            getZenStarOpacityTarget, sysInfo, __isIOS: sysInfo.isIOS, __isHarmony: sysInfo.isHarmony,
            RADIUS, __earthOldMat: refs.earthOldMat?.(), dirLightBase, ambientLight, dirLight, poetry3d: refs.poetry3d?.()
        }, (res) => {
            if (res.poetry3d) setters.setPoetry3d?.(res.poetry3d);
            if (res.__earthOldMat) setters.setEarthOldMat?.(res.__earthOldMat);
        });
        zenState.anim = res.anim;
        zenState.restore = res.restore;
        zenState.active = true;
        zenState.stableSince = 0;
      } else {
        const res = exitZenMode({
            APP_CFG, LIGHT_CFG, touch, globeGroup, zoom: zenState.zoom, tiltZ: zenState.tiltZ,
            getNormalStarOpacityTarget, starCtl, lighting,
            restoreOverlayFactors, restoreZenMaterial,
            earthMesh: earthMeshRef(), 
            earthDayTex: earthDayTexRef(), 
            earthPureDayTex: earthPureDayTexRef(), 
            earthNightTex: earthNightTexRef(), 
            currentTheme: themeController.currentTheme,
            themeState: themeController.themeState, 
            THREE, poetry3d: refs.poetry3d?.(), 
            TROPIC_GROUP: TROPIC_GROUP_REF(), BORDER_GROUP: BORDER_GROUP_REF(),
            __earthOldMat: refs.earthOldMat?.(), ambientBase, dirLightBase, __brightnessScale: brightnessScale()
        }, (res) => {
            if (res.__earthOldMat === null) setters.setEarthOldMat?.(null);
            if (res.refreshTheme) themeController.refresh();
        });
        zenState.anim = res.anim;
        zenState.active = false;
      }
    };

    if (next) {
      const moving = (Math.abs(touch.velX) > 0.0002) || (Math.abs(touch.velY) > 0.0002) || !!touch.isDragging;
      if (moving && !zenState.anim) {
        zenState.restore = { rotX: touch.rotX, rotY: touch.rotY, zoom: zenState.zoom, posY: globeGroup?.position?.y || 0 };
        try { flyMgr?.cancel?.(); } catch(_){ }
        zenState.brake = { t0: Date.now(), dur: (APP_CFG?.zen?.preStopMs ?? 1000) };
        zenState.delayEnter = true;
        return;
      }
    }

    _doTransition();
  };

  return { 
    setMode,
    getPoetry3D: () => refs.poetry3d?.()
  };
}

export function enterZenMode(ctx, onComplete) {
    try {
        const {
            APP_CFG, LIGHT_CFG, touch, globeGroup, zoom, tiltZ,
            flyMgr, highlight, page, starCtl, lighting, 
            TROPIC_GROUP, BORDER_GROUP, applyZenOverlayFactors,
            applyZenMaterial, earthMesh, earthDayTex, earthPureDayTex, earthNightTex, currentTheme,
            themeState, THREE, scene, camera, width, height, createPoetry3D,
            getZenStarOpacityTarget, sysInfo, __isIOS, __isHarmony
        } = ctx;

        try { highlight.setHighlight(null); } catch(_){}
        try { page?.onCountryPicked?.(null); } catch(_){}
        try { page.selectedTimezone = null; page.setData?.({ hoverText: '' }); page.lastTimeUpdate = 0; } catch(_){}

        const restore = { rotX: touch.rotX, rotY: touch.rotY, zoom, posY: globeGroup?.position?.y || 0 };
        zenState.restore = restore;
        
        try { flyMgr?.cancel?.(); } catch(_){ }
        
        const offR = (LIGHT_CFG?.zen?.globeYOffsetR ?? -0.35);
        const targetY = (restore.posY || 0) + (offR * (ctx.RADIUS || 1));
        const ZEN_ZOOM = (APP_CFG?.zen?.zoom ?? 0.74);
        const ZEN_TILT_RAD = ((APP_CFG?.zen?.tiltDeg ?? 23) * Math.PI / 180);
        
        const anim = { t0: Date.now(), dur: (APP_CFG?.zen?.animMs ?? 1000), from: { rotX: touch.rotX, zoom, tiltZ, posY: restore.posY }, to: { rotX: 0, zoom: ZEN_ZOOM, tiltZ: ZEN_TILT_RAD, posY: targetY } };
        
        try {
            const use3D = !!(APP_CFG?.poetry?.use3D);
            if (use3D) {
                anim.after = () => {
                    try {
                        let poetry3d = ctx.poetry3d;
                        if (!poetry3d && earthMesh) {
                            poetry3d = createPoetry3D(THREE, scene, camera, earthMesh, width, height, APP_CFG?.poetry || {});
                            if (onComplete) onComplete({ poetry3d });
                        }
                        poetry3d?.setEnabled?.(true);
                    } catch(_){ }
                };
            }
        } catch(_){ }
        
        try {
            globeGroup.rotation.order = 'ZXY';
            const q = globeGroup.quaternion.clone();
            const e = new THREE.Euler().setFromQuaternion(q, 'ZXY');
            globeGroup.rotation.set(e.x, e.y, e.z);
        } catch(_){}
        
        zenState.active = true;
        
        try { 
            const op = getZenStarOpacityTarget(LIGHT_CFG?.zen || {}); 
            starCtl?.setTargetOpacity?.(op); 
        } catch(_){}
        try { starCtl?.applyZen?.(LIGHT_CFG?.zen || {}); } catch(_){}
        try { starCtl?.enableBreathDiagnostics?.(15000); } catch(_){}
        try { lighting.applyZenIntensity(); } catch(_){}
        
        zenState.stableSince = 0;
        
        try { if (TROPIC_GROUP) TROPIC_GROUP.visible = true; } catch(_){}
        try { applyZenOverlayFactors(BORDER_GROUP, TROPIC_GROUP, LIGHT_CFG.zen?.overlays || {}); } catch(_){}
        
        try {
            if (earthMesh && earthMesh.material) {
                const hasDay = !!earthDayTex;
                const hasNight = !!earthNightTex;
                const hasPureDay = !!earthPureDayTex;
                const useShader = (APP_CFG?.zen?.useShaderMaterial !== false);
                let shaderApplied = false;
                
                if (useShader && hasDay && hasNight) {
                    try {
                        let oldMat = ctx.__earthOldMat;
                        if (!oldMat) {
                            if (earthMesh.material && earthMesh.material.type !== 'ShaderMaterial') {
                                oldMat = earthMesh.material;
                            } else {
                                try { console.warn('[zen] Old material missing/invalid, creating fallback Phong'); } catch(_){}
                                oldMat = new THREE.MeshPhongMaterial({
                                    map: earthDayTex || earthPureDayTex,
                                    shininess: (LIGHT_CFG.earthMaterial?.shininess ?? 8),
                                    transparent: true
                                });
                            }
                        }
                        
                        const dayTexForZen = (currentTheme === 'day8k' && hasPureDay) ? earthPureDayTex : earthDayTex;
                        const res0 = applyZenMaterial({ THREE, earthMesh, earthDayTex: dayTexForZen, earthPureDayTex: earthPureDayTex, earthNightTex, currentTheme, LIGHT_CFG, dirLightBase: ctx.dirLightBase, camera, ambientLight: ctx.ambientLight, dirLight: ctx.dirLight, useSimpleShader: (__isIOS || __isHarmony), workaroundTransparent: __isHarmony });
                        
                        themeState.setMat(res0.dayNightMat);
                        earthMesh.material = res0.dayNightMat;
                        try { earthMesh.renderOrder = 10; } catch(_){}
                        earthMesh.material.needsUpdate = true;
                        shaderApplied = true;
                        
                        if (onComplete) onComplete({ __earthOldMat: oldMat });
                    } catch(e){ shaderApplied = false; }
                }
                
                if (!shaderApplied) {
                    const dayTexForTheme = (currentTheme === 'day8k' && hasPureDay) ? earthPureDayTex : earthDayTex;
                    const mapTex = (currentTheme === 'night' && earthNightTex) ? earthNightTex : dayTexForTheme;
                    earthMesh.material = new THREE.MeshPhongMaterial({ map: mapTex, shininess: (LIGHT_CFG.earthMaterial?.shininess ?? 8) });
                    earthMesh.material.needsUpdate = true;
                    try { themeState.setMat(null); } catch(_){}
                }
            }
        } catch(e){ try { console.error('[zen:material] Critical error', e); } catch(_){} }

        return { anim, restore };
    } catch(e){ console.error('[zen:enter] failed', e); return {}; }
}

export function exitZenMode(ctx, onComplete) {
    try {
        const {
            APP_CFG, LIGHT_CFG, touch, globeGroup, zoom, tiltZ,
            getNormalStarOpacityTarget, starCtl, lighting,
            restoreOverlayFactors, restoreZenMaterial,
            earthMesh, earthDayTex, earthPureDayTex, earthNightTex, currentTheme,
            themeState, THREE, poetry3d, TROPIC_GROUP, BORDER_GROUP,
            __earthOldMat, ambientBase, dirLightBase, __brightnessScale
        } = ctx;

        const restore = zenState.restore || { rotX: 0, rotY: 0, zoom: 1.0, posY: 0 };
        
        try { 
            const op = getNormalStarOpacityTarget(LIGHT_CFG?.normal || {}); 
            starCtl?.setTargetOpacity?.(op); 
        } catch(_){}
        try { starCtl?.applyNormal?.(LIGHT_CFG?.normal || {}); } catch(_){}
        
        const anim = {
            t0: Date.now(), dur: 500,
            from: { rotX: touch.rotX, zoom, tiltZ, posY: globeGroup?.position?.y || 0 },
            to:   { rotX: 0,          zoom: 1.0, tiltZ, posY: restore.posY },
            next: {
                dur: (APP_CFG?.zen?.exitMs ?? 700),
                from: { rotX: 0, zoom: 1.0, tiltZ, posY: restore.posY },
                to:   { rotX: 0, zoom: 1.0, tiltZ: 0, posY: restore.posY },
                after: () => {
                    try {
                        globeGroup.rotation.order = 'XYZ';
                        const q = globeGroup.quaternion.clone();
                        const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
                        globeGroup.rotation.set(e.x, e.y, e.z);
                    } catch(_){}
                    try { lighting.applyNormalIntensitySmooth(ambientBase * __brightnessScale, dirLightBase * __brightnessScale, 300); } catch(_){}
                    try { restoreOverlayFactors(BORDER_GROUP, TROPIC_GROUP); } catch(_){ }
                    
                    let restored = false;
                    try {
                        if (__earthOldMat && __earthOldMat.type !== 'ShaderMaterial') {
                            const res2 = restoreZenMaterial({ earthMesh, earthOldMat: __earthOldMat });
                            restored = true;
                        }
                    } catch(_){}
                    
                    if (!restored || (earthMesh && earthMesh.material && earthMesh.material.type === 'ShaderMaterial')) {
                        try { console.warn('[zen] Force restoring Phong material'); } catch(_){}
                        try {
                           let fallbackTex = earthDayTex;
                           if (currentTheme === 'night' && earthNightTex) fallbackTex = earthNightTex;
                           else if (currentTheme === 'day8k' && earthPureDayTex) fallbackTex = earthPureDayTex;
 
                           const newMat = new THREE.MeshPhongMaterial({ 
                               map: fallbackTex, 
                               shininess: (LIGHT_CFG.earthMaterial?.shininess ?? 8),
                               transparent: true,
                               opacity: 1 
                           });
                           if (earthMesh) {
                               earthMesh.material = newMat;
                               earthMesh.material.needsUpdate = true;
                           }
                        } catch(_){}
                    }

                    try { if (earthMesh) earthMesh.renderOrder = 0; } catch(_){}

                    try { themeState.setMat(null); } catch(_){ }
                    
                    try { 
                         if (onComplete) onComplete({ __earthOldMat: null, refreshTheme: true });
                    } catch(_){}
                }
            }
        };
        
        return { anim, restore };
    } catch(e){ console.error('[zen:exit] failed', e); return {}; }
}
