
import { APP_CFG } from './config.js';
import { clamp01, smoothstep, easeInOut } from './moon-voyage-easing.js';
import { updateLighting } from './moon-voyage-lighting.js';
import { 
  applyEarthNearAnchor, 
  forceGroupVisible, 
  ensureEarthVisibleInVoyage, 
  clampGlobeToViewport,
  syncEarthShaderUniforms,
  findEarthMesh
} from './moon-voyage-earth-utils.js';

const mergeCompanionRobotCfg = (baseCfg, tuneCfg) => {
  const b = baseCfg || {};
  const t = tuneCfg || {};
  const b1 = b?.robot1 || {};
  const b2 = b?.robot2 || {};
  const t1 = t?.robot1 || {};
  const t2 = t?.robot2 || {};
  return {
    ...b,
    ...t,
    robot1: { ...b1, ...t1 },
    robot2: { ...b2, ...t2 }
  };
};

export const updateTimeline = (mgr, t, dtSec = 0.0) => {
  const TARGET_ROT_Y = mgr._voyageTargetRotY;

  const tl = (APP_CFG?.moonVoyage?.timeline || {});
  const T_EARTH_EXIT = Math.max(0.1, Number(tl.earthExitSec ?? 30.0) || 30.0);
  const T_CORRIDOR = Math.max(0.1, Number(tl.corridorSec ?? 35.0) || 35.0);
  const T_MOON_APPROACH = Math.max(0.1, Number(tl.moonApproachSec ?? 35.0) || 35.0);
  const T1 = T_EARTH_EXIT;

  const s = mgr._startState;

  const earthRaw = clamp01(t / T1);
  const earthP = earthRaw * earthRaw * earthRaw;
  const lightP = (t < T1) ? earthP : 1.0;
  updateLighting(mgr, lightP);

  mgr.camera.rotation.y = s.camRot.y + (TARGET_ROT_Y - s.camRot.y) * earthP;
  mgr.camera.position.x = s.camPos.x + (0 - s.camPos.x) * earthP;
  mgr.camera.position.y = s.camPos.y + (0 - s.camPos.y) * earthP;
  mgr.camera.position.z = s.camPos.z + (5 - s.camPos.z) * earthP;

  const earthTargetZ = -35.0;
  const earthTargetY = -0.55 - 0.5;
  const earthTargetScale = 0.35;
  mgr.globeGroup.position.z = s.globePos.z + (earthTargetZ - s.globePos.z) * earthP;
  mgr.globeGroup.position.y = s.globePos.y + (earthTargetY - s.globePos.y) * earthP;
  const earthBaseScale = s.globeScale.x + (earthTargetScale - s.globeScale.x) * earthP;

  const earthSpinRadPerSec = 0.06;
  mgr.globeGroup.rotation.y += earthSpinRadPerSec * dtSec;

  const node1Time = T1;
  const node2Time = node1Time + T_CORRIDOR;
  const node3Time = node2Time + T_MOON_APPROACH;

  if (mgr._isDevtools) {
    try {
      if (!mgr.__companionNode2Logged && t >= node2Time && t <= (node2Time + 0.6)) {
        mgr.__companionNode2Logged = true;
        console.log('[Moon][CompanionPhaseCut]', { cut: 'node2', t: Number(t.toFixed(2)) });
      }
      if (!mgr.__companionNode3Logged && t >= node3Time && t <= (node3Time + 0.6)) {
        mgr.__companionNode3Logged = true;
        console.log('[Moon][CompanionPhaseCut]', { cut: 'node3', t: Number(t.toFixed(2)) });
      }
    } catch (_) {}
  }

  try {
    const now = Date.now();
    if (!mgr._mainStarfieldMesh && now >= (mgr.__starResolveNext || 0)) {
      mgr.__starResolveNext = now + 1000;
      mgr._refreshMainStarfieldMesh();
    }
  } catch (_) {}

  const EARTH_DISAPPEAR_AT = Math.max(0.0, Math.min(T_EARTH_EXIT, Number(tl.earthDisappearAtSec ?? 25.0) || 25.0));
  const earthFadeSec = Math.max(0.0, Number(tl.earthFadeSec ?? 2.4) || 2.4);
  const earthFadeStart = Math.max(0.0, EARTH_DISAPPEAR_AT - earthFadeSec);
  const earthFadeK = smoothstep(earthFadeStart, earthFadeStart + earthFadeSec, t);
  const earthScaleMul = 1.0 - earthFadeK;
  const earthFinalScale = earthBaseScale * earthScaleMul;
  mgr.globeGroup.scale.set(earthFinalScale, earthFinalScale, earthFinalScale);

  const SHOW_EARTH_AFTER_DEPARTURE = false;
  mgr.globeGroup.visible = ((t < node1Time) && (earthScaleMul > 0.02)) || (SHOW_EARTH_AFTER_DEPARTURE && (t >= node2Time));

  if (mgr._isDevtools) {
    try {
      const now = Date.now();
      if (t >= (node1Time - 2.0) && t <= (node1Time + 6.0) && now >= (mgr.__cutDiagNext || 0)) {
        mgr.__cutDiagNext = now + 450;
        console.log('[Moon][Phase2Cut]', { t: Number(t.toFixed(2)), dt: Number(dtSec.toFixed(4)) });
      }
    } catch (_) {}
  }

  if (mgr._mainStarfieldMesh) {
    const driftStart = node1Time - 6.0;
    const driftEnd = node3Time + 8.0;
    const driftK = smoothstep(driftStart, driftStart + 4.0, t) * (1.0 - smoothstep(driftEnd - 4.0, driftEnd, t));
    const rotRadPerSec = -0.008;
    if (driftK > 0.0001) {
      mgr._mainStarfieldMesh.rotation.y += rotRadPerSec * dtSec * driftK;
    }

    if (mgr._isDevtools) {
      try {
        const now = Date.now();
        if (t >= node1Time && t <= node2Time && now >= (mgr.__bgDiagNext || 0)) {
          mgr.__bgDiagNext = now + 2500;
          console.log('[Moon][BgStar]', { t: Number(t.toFixed(2)), driftK: Number(driftK.toFixed(3)) });
        }
      } catch (_) {}
    }
  }

  const moonEnd = { x: -5.8, y: -1.2, z: 0.0, s: 0.9 };
  const moonP = easeInOut(clamp01((t - node2Time) / Math.max(1e-6, node3Time - node2Time)));
  if (mgr.moonMesh) {
    const THREE = mgr.THREE;
    if (!mgr._tmpMoonStart) mgr._tmpMoonStart = new THREE.Vector3();

    const moonEndWorld = mgr._tmpMoonStart;
    moonEndWorld.set(moonEnd.x, moonEnd.y, moonEnd.z);

    if (!mgr._moonStartReady && mgr.camera && t >= node1Time) {
      try {
        if (!mgr._moonStartWorld) mgr._moonStartWorld = new THREE.Vector3();
        const endVec = moonEndWorld.clone().sub(mgr.camera.position);
        const endDist = Math.max(1e-6, endVec.length());
        const dir = endVec.normalize();
        const right = new THREE.Vector3().crossVectors(dir, mgr.camera.up).normalize();
        const startDir = dir.clone().addScaledVector(right, -0.85).normalize();
        const startDist = Math.max(12.0, endDist + 6.0);
        mgr._moonStartWorld.copy(mgr.camera.position).addScaledVector(startDir, startDist);
        mgr._moonStartReady = true;
      } catch (_) {}
    }

    const canStartShow = (t >= node2Time) && !!mgr._moonTexReady;
    if (canStartShow && mgr._moonShowT0 == null) mgr._moonShowT0 = t;
    if (!canStartShow) mgr._moonShowT0 = null;

    const showK = (mgr._moonShowT0 == null) ? 0.0 : smoothstep(mgr._moonShowT0, mgr._moonShowT0 + 0.55, t);
    const moonOpacity = showK;

    try {
      const m = mgr.moonMesh.material;
      if (m) {
        m.transparent = true;
        if (typeof m.opacity === 'number') m.opacity = moonOpacity;
        m.needsUpdate = true;
      }
    } catch (_) {}

    if (moonOpacity <= 0.001) {
      mgr.moonMesh.visible = false;
      mgr.moonMesh.scale.set(1e-6, 1e-6, 1e-6);
      if (mgr._moonStartReady && mgr._moonStartWorld) mgr.moonMesh.position.copy(mgr._moonStartWorld);
      else mgr.moonMesh.position.copy(moonEndWorld);
    } else {
      mgr.moonMesh.visible = true;
      const startPos = (mgr._moonStartReady && mgr._moonStartWorld) ? mgr._moonStartWorld : moonEndWorld;
      mgr.moonMesh.position.x = startPos.x + (moonEnd.x - startPos.x) * moonP;
      mgr.moonMesh.position.y = startPos.y + (moonEnd.y - startPos.y) * moonP;
      mgr.moonMesh.position.z = startPos.z + (moonEnd.z - startPos.z) * moonP;
      const startScale = 0.05;
      const ms = startScale + (moonEnd.s - startScale) * moonP;
      mgr.moonMesh.scale.set(ms, ms, ms);
    }
    // 降低自转速度以衔接稳定后的自转 (约 3.4 deg/s，稍微加快以便肉眼可见)
    const moonSpinRadPerSec = 0.06;
    mgr.moonMesh.rotation.y += moonSpinRadPerSec * dtSec;
  }

  if (SHOW_EARTH_AFTER_DEPARTURE && t >= node2Time && t < node3Time && mgr.camera && mgr.moonMesh && mgr.globeGroup) {
    const cfg = APP_CFG?.moonVoyage?.earthNear;
    const baseScale = Number(mgr._originalLights?.globeScale?.x || 1.0);
    const moonR = Number(mgr.moonMesh?.scale?.x || 1.0);
    const moonWorldAnchor = mgr._tmpMoonStart ? mgr._tmpMoonStart : mgr.moonMesh.position;
    if (cfg?.enabled) {
      applyEarthNearAnchor({ THREE: mgr.THREE, globeGroup: mgr.globeGroup, camera: mgr.camera, moonWorld: moonWorldAnchor, moonR, baseScale, cfg, dtSec, mgrState: mgr });
    } else {
      const THREE = mgr.THREE;
      if (!mgr._tmpMoonForward) mgr._tmpMoonForward = new THREE.Vector3();
      if (!mgr._tmpMoonLeft) mgr._tmpMoonLeft = new THREE.Vector3();
      if (!mgr._tmpEarthBetweenPos) mgr._tmpEarthBetweenPos = new THREE.Vector3();

      const forward = mgr._tmpMoonForward.copy(moonWorldAnchor).sub(mgr.camera.position);
      const distCamMoon = Math.max(1e-6, forward.length());
      forward.normalize();

      const right = mgr._tmpMoonLeft.crossVectors(forward, mgr.camera.up).normalize();
      const side = -Math.max(0.7, moonR * 1.1);
      const up = 0.55;
      const k = 0.45;
      const distFromCam = Math.max(0.35, Math.min(distCamMoon * k, distCamMoon - Math.max(0.25, moonR * 1.1)));

      mgr._tmpEarthBetweenPos.copy(mgr.camera.position)
        .addScaledVector(forward, distFromCam)
        .addScaledVector(right, side)
        .addScaledVector(mgr.camera.up, up);

      mgr.globeGroup.position.copy(mgr._tmpEarthBetweenPos);
      const earthScale = baseScale * 0.5;
      mgr.globeGroup.scale.set(earthScale, earthScale, earthScale);
      forceGroupVisible(mgr.globeGroup);
      ensureEarthVisibleInVoyage(THREE, mgr.globeGroup, mgr);
      clampGlobeToViewport(THREE, mgr.globeGroup, mgr.camera, Math.max(0.0, Math.min(0.45, Number(cfg?.viewportMarginNdc ?? 0.08) || 0.08)), mgr);
      syncEarthShaderUniforms(THREE, mgr.globeGroup, mgr.camera, mgr.scene, findEarthMesh(mgr.globeGroup), mgr._moonDebug);
    }
  }

  const moonWorldNow = mgr._tmpMoonStart ? mgr._tmpMoonStart : null;
  if (mgr._orbitSeq && t >= node3Time && mgr.camera && moonWorldNow) {
    const baseScale = Number(mgr._originalLights?.globeScale?.x || 1.0);
    const dbg = !!mgr._moonDebug;
    if (!mgr.__orbitEnteredOnce) {
      mgr.__orbitEnteredOnce = true;
      try { console.log('[Moon][OrbitEnter]', { t: Number(t.toFixed(2)) }); } catch (_) {}
    }
    try { if (mgr.globeGroup) mgr.globeGroup.visible = false; } catch (_) {}
    const earthNearCfg = APP_CFG?.moonVoyage?.earthNear;
    const moonR = Number(mgr.moonMesh?.scale?.x || 1.0);
    const earthNearEnabled = !!earthNearCfg?.enabled;
    const ratio = Math.max(0.01, Number(earthNearCfg?.sizeRatioToMoon ?? 0.2) || 0.2);
    const earthScaleMul = earthNearEnabled ? ((moonR * ratio) / Math.max(1e-6, baseScale)) : 0.5;
    const distR = Math.max(0.0, Number(earthNearCfg?.distR ?? 2.2) || 0);
    const sideR = Number(earthNearCfg?.sideR ?? -1.2) || 0;
    const upR = Number(earthNearCfg?.upR ?? 0.65) || 0;
    const azOffsetDeg = Number(earthNearCfg?.azOffsetDeg ?? 0) || 0;
    const res = mgr._orbitSeq.tick({
      t,
      node3Time,
      camera: mgr.camera,
      moonWorld: moonWorldNow,
      globeGroup: null,
      baseGlobeScale: baseScale,
      orbitDurationSec: Math.max(1.0, Number(tl.orbitDurationSec ?? 90.0) || 90.0),
      enterBlendSec: Math.max(0.0, Number(tl.orbitEnterBlendSec ?? 0.85) || 0.0),
      enterLightBlendSec: Math.max(0.0, Number(tl.orbitEnterLightBlendSec ?? 3.0) || 0.0),
      orbitEndDeg: 630.0,
      appearDeg: 0.0,
      appearFullDeg: 8.0,
      disappearDeg: 999.0,
      disappearEndDeg: 999.0,
      earthMode: earthNearEnabled ? 'near' : 'between',
      earthBetweenK: 0.45,
      earthBetweenSide: -0.9,
      earthBetweenUp: 0.55,
      earthBetweenRotate: false,
      earthBetweenRotateDegOffset: 0.0,
      earthDist: moonR * distR,
      earthSide: moonR * sideR,
      earthUp: moonR * upR,
      earthAzOffsetDeg: azOffsetDeg,
      earthOccludeFade: earthNearEnabled ? !!earthNearCfg?.occludeFade : true,
      earthScaleMul,
      moonRadius: moonR,
      sunDist: 520.0,
      sunSide: -34.0,
      sunUp: 18.0,
      sunLightDist: 28.0,
      sunOpacity: 0.0,
      sunBaseScale: 1.6,
      sunScaleAdd: 0.9,
      cameraMinY: 5.4,
      cameraLiftEndDeg: 70.0,
      lookBlendDeg: 55.0,
      enableSun: false,
      debug: dbg,
      lockDirLight: true,
      maxAmbient: 0.07,
      minDir: 1.10,
    });
    if (res?.active) {
      if (mgr.milkyWayMesh) {
        try {
          const u = mgr.milkyWayMesh.material?.uniforms;
          if (u?.uOpacity) u.uOpacity.value = 0.0;
        } catch (_) {}
        mgr.milkyWayMesh.visible = false;
      }
      mgr.phase = 'ORBIT';
      if (mgr._moonDebug) {
        try {
          const now = Date.now();
          if (!mgr.__orbitDiagNext) mgr.__orbitDiagNext = now + 600;
          if (now >= mgr.__orbitDiagNext) {
            mgr.__orbitDiagNext = now + 600;
            console.log('[Moon][OrbitDiag]', {
              t: Number(t.toFixed(2)),
              orbitDeg: Number((res.orbitDeg || 0).toFixed(1)),
              showK: Number((res.showK || 0).toFixed(3)),
            });
          }
        } catch (_) {}
      }
    }
  }

  try {
    if (SHOW_EARTH_AFTER_DEPARTURE && mgr.globeGroup && t >= node2Time && t < node3Time) {
      const cfg = APP_CFG?.moonVoyage?.earthNear;
      forceGroupVisible(mgr.globeGroup);
      ensureEarthVisibleInVoyage(mgr.THREE, mgr.globeGroup, mgr);
      clampGlobeToViewport(mgr.THREE, mgr.globeGroup, mgr.camera, Math.max(0.0, Math.min(0.45, Number(cfg?.viewportMarginNdc ?? 0.08) || 0.08)), mgr);
      syncEarthShaderUniforms(mgr.THREE, mgr.globeGroup, mgr.camera, mgr.scene, findEarthMesh(mgr.globeGroup), mgr._moonDebug);
    }
  } catch (_) {}

  if (mgr.milkyWayMesh) {
    const corridorLocalSec = Math.max(0.0, Math.min(T_CORRIDOR, t - node1Time));
    const inCorridor = (t >= node1Time) && (t <= node2Time);
    const corridorCfg = APP_CFG?.moonVoyage?.starCorridor || {};
    const fx = corridorCfg?.effects || {};
    const pulseCfg = fx?.pulse || {};
    const rollCfg = fx?.roll || {};

    if (t < node1Time) mgr._milkyWayScrollTime = 0.0;

    const r = clamp01(corridorLocalSec / Math.max(1e-6, T_CORRIDOR));
    const pulseEnabled = !!pulseCfg?.enabled;
    const pulseCenters = Array.isArray(pulseCfg?.centers) ? pulseCfg.centers : [0.32, 0.72];
    const pulseHalfW = Math.max(0.005, Number(pulseCfg?.halfWidth ?? 0.06) || 0.06);
    const bump = (c, x) => smoothstep(c - pulseHalfW, c, x) * (1.0 - smoothstep(c, c + pulseHalfW, x));
    let pulseK = 0.0;
    if (inCorridor && pulseEnabled) {
      for (let i = 0; i < pulseCenters.length; i++) {
        const c = Number(pulseCenters[i]);
        if (!isFinite(c)) continue;
        pulseK += bump(Math.max(0.0, Math.min(1.0, c)), r);
      }
      pulseK = clamp01(pulseK);
    }

    if (inCorridor) {
      const accelSec = 10.0;
      const decelSec = 10.0;
      const peakMult = 1.5;
      const accelK = smoothstep(0.0, accelSec / T_CORRIDOR, r);
      const decelK = 1.0 - smoothstep(1.0 - decelSec / T_CORRIDOR, 1.0, r);
      const speedMult = 1.0 + (peakMult - 1.0) * accelK * decelK;
      const pulseSpeedGain = Math.max(0.0, Number(pulseCfg?.speedGain ?? 0.22) || 0.0);
      const speedMult2 = speedMult * (1.0 + pulseSpeedGain * pulseK);
      mgr._milkyWayScrollTime += dtSec * speedMult2;
    }

    const fadeInSec = 8.0;
    const fadeOutSec = 8.0;
    const appear = smoothstep(0.0, fadeInSec, corridorLocalSec);
    const disappear = 1.0 - smoothstep(T_CORRIDOR - fadeOutSec, T_CORRIDOR, corridorLocalSec);
    const opacity = (inCorridor ? (appear * disappear) : 0.0);

    const u = mgr.milkyWayMesh.material?.uniforms;
    if (u?.time) u.time.value = mgr._milkyWayScrollTime;
    if (u?.uOpacity) u.uOpacity.value = opacity;
    if (u?.uSizeScale && mgr._milkyWayBaseSizeScale != null) {
      const baseBoost = inCorridor ? 1.05 : 1.0;
      const pulseSizeGain = Math.max(0.0, Number(pulseCfg?.sizeGain ?? 0.06) || 0.0);
      u.uSizeScale.value = mgr._milkyWayBaseSizeScale * baseBoost * (1.0 + pulseSizeGain * pulseK);
    }
    if (u?.uBrightnessGain && mgr._milkyWayBaseBrightnessGain != null) {
      const baseBoost = inCorridor ? 1.15 : 1.0;
      const pulseBrightGain = Math.max(0.0, Number(pulseCfg?.brightnessGain ?? 0.18) || 0.0);
      u.uBrightnessGain.value = mgr._milkyWayBaseBrightnessGain * baseBoost * (1.0 + pulseBrightGain * pulseK);
    }

    const rotRadPerSec = 0.003;
    const yawOffsetRaw = corridorCfg?.yawOffset;
    const yawOffset = (typeof yawOffsetRaw === 'number' && isFinite(yawOffsetRaw)) ? yawOffsetRaw : 0.85;
    mgr.milkyWayMesh.rotation.y = mgr.camera.rotation.y + yawOffset;
    mgr.milkyWayMesh.rotation.z += rotRadPerSec * dtSec;
    mgr.milkyWayMesh.visible = opacity > 0.01;

    if (mgr.camera && !!rollCfg?.enabled) {
      const baseZ = Number(mgr._startState?.camRot?.z ?? 0) || 0;
      if (inCorridor) {
        const maxDeg = Math.max(0.0, Number(rollCfg?.maxDeg ?? 0.55) || 0.0);
        const freqHz = Math.max(0.0, Number(rollCfg?.freqHz ?? 0.12) || 0.0);
        const fadeInSec = Math.max(0.0, Number(rollCfg?.fadeInSec ?? 6.0) || 0.0);
        const fadeOutSec = Math.max(0.0, Number(rollCfg?.fadeOutSec ?? 6.0) || 0.0);
        const rollK =
          smoothstep(0.0, Math.max(1e-6, fadeInSec), corridorLocalSec) *
          (1.0 - smoothstep(T_CORRIDOR - fadeOutSec, T_CORRIDOR, corridorLocalSec));
        const rollRad = (maxDeg * Math.PI / 180.0) * rollK * Math.sin(corridorLocalSec * (2.0 * Math.PI) * freqHz);
        mgr.camera.rotation.z = baseZ + rollRad;
        mgr._corridorRollApplied = true;
      } else if (mgr._corridorRollApplied) {
        mgr.camera.rotation.z = baseZ;
        mgr._corridorRollApplied = false;
      }
    } else if (mgr._corridorRollApplied) {
      mgr._corridorRollApplied = false;
    }
  }

  {
    const streakKeepSec = 5.0;
    const fadeOutSec = 2.2;
    const streakEnd = node2Time + streakKeepSec;
    const appear = smoothstep(node1Time, node1Time + 2.0, t);
    const fadeOut = 1.0 - smoothstep(streakEnd, streakEnd + fadeOutSec, t);
    const corridorActive = (t >= node1Time) && (t <= (streakEnd + fadeOutSec));
    const k = corridorActive ? (appear * fadeOut) : 0.0;
    const bgBase = smoothstep(node1Time, node1Time + 2.0, t) * (1.0 - smoothstep(node3Time + 2.0, node3Time + 8.0, t));
    const kBg = Math.max(k, 0.35 * bgBase);
    const orbitFade = 1.0 - smoothstep(node3Time, node3Time + 4.0, t);
    const corridorLocalSec = Math.max(0.0, Math.min(T_CORRIDOR, t - node1Time));
    const inCorridor = (t >= node1Time) && (t <= node2Time);
    const pulseCfg = (APP_CFG?.moonVoyage?.starCorridor?.effects?.pulse) || {};
    const pulseEnabled = !!pulseCfg?.enabled;
    const pulseCenters = Array.isArray(pulseCfg?.centers) ? pulseCfg.centers : [0.32, 0.72];
    const pulseHalfW = Math.max(0.005, Number(pulseCfg?.halfWidth ?? 0.06) || 0.06);
    const bump = (c, x) => smoothstep(c - pulseHalfW, c, x) * (1.0 - smoothstep(c, c + pulseHalfW, x));
    const r = clamp01(corridorLocalSec / Math.max(1e-6, T_CORRIDOR));
    let pulseK = 0.0;
    if (inCorridor && pulseEnabled) {
      for (let i = 0; i < pulseCenters.length; i++) {
        const c = Number(pulseCenters[i]);
        if (!isFinite(c)) continue;
        pulseK += bump(Math.max(0.0, Math.min(1.0, c)), r);
      }
      pulseK = clamp01(pulseK);
    }
    const dustGain = Math.max(0.0, Number(pulseCfg?.dustOpacityGain ?? 0.25) || 0.0);
    const dustPulseMul = 1.0 + Math.max(0.0, Math.min(1.0, dustGain)) * pulseK;
    const k2 = k * orbitFade;
    const kBg2 = kBg * orbitFade;

    if (mgr.camera) {
      const THREE = mgr.THREE;
      if (!mgr._tmpDustForward) mgr._tmpDustForward = new THREE.Vector3();
      if (!mgr._tmpDustRight) mgr._tmpDustRight = new THREE.Vector3();
      if (!mgr._tmpDustPos) mgr._tmpDustPos = new THREE.Vector3();
      if (!mgr._dustLocalZ) mgr._dustLocalZ = new THREE.Vector3(0, 0, 1);
      mgr.camera.getWorldDirection(mgr._tmpDustForward);
      mgr._tmpDustForward.normalize();
      mgr._tmpDustRight.crossVectors(mgr._tmpDustForward, mgr.camera.up).normalize();
      mgr._tmpDustPos.copy(mgr.camera.position);
      mgr._tmpDustPos.addScaledVector(mgr._tmpDustForward, 120.0);

      [mgr._dustBgMesh, mgr._dustSlowMesh, mgr._dustFastMesh].forEach((m) => {
        if (!m) return;
        m.position.copy(mgr._tmpDustPos);
        m.quaternion.setFromUnitVectors(mgr._dustLocalZ, mgr._tmpDustRight);
      });
    }

    if (mgr._dustBgMesh) {
      const u = mgr._dustBgMesh.material?.uniforms;
      mgr._dustBgTime += dtSec;
      if (u?.time) u.time.value = mgr._dustBgTime;
      if (u?.uOpacity) u.uOpacity.value = 0.18 * kBg2 * dustPulseMul;
      mgr._dustBgMesh.visible = (u?.uOpacity?.value || 0) > 0.01;
      if (mgr._isDevtools) {
        const now = Date.now();
        if (!mgr.__dustDiagNext) mgr.__dustDiagNext = now + 900;
        if (now >= mgr.__dustDiagNext) {
          mgr.__dustDiagNext = now + 900;
          try {
            console.log('[Moon][DustDiag]', {
              t: Number(t.toFixed(2)),
              k: Number(k.toFixed(3)),
              bgVisible: !!mgr._dustBgMesh.visible
            });
          } catch (_) {}
        }
      }
    }
    if (mgr._dustSlowMesh) {
      const u = mgr._dustSlowMesh.material?.uniforms;
      mgr._dustSlowTime += dtSec;
      if (u?.time) u.time.value = mgr._dustSlowTime;
      if (u?.uOpacity) u.uOpacity.value = 0.22 * k2 * dustPulseMul;
      mgr._dustSlowMesh.visible = (u?.uOpacity?.value || 0) > 0.01;
    }
    if (mgr._dustFastMesh) {
      const u = mgr._dustFastMesh.material?.uniforms;
      mgr._dustFastTime += dtSec;
      if (u?.time) u.time.value = mgr._dustFastTime;
      if (u?.uOpacity) u.uOpacity.value = 0.62 * k2 * dustPulseMul;
      mgr._dustFastMesh.visible = (u?.uOpacity?.value || 0) > 0.01;
    }

    try {
      const baseCfg = (APP_CFG?.moonVoyage?.starCorridor?.effects?.companionRobot) || {};
      const tuneCfg = (APP_CFG?.moonVoyage?.timeline?.companionRobot) || {};
      const cfg = mergeCompanionRobotCfg(baseCfg, tuneCfg);
      const robotActive = (t >= node1Time) && (t <= (node3Time + 3.0));
      mgr._companionFx?.update?.({ cfg, t, node1Time, corridorActive: robotActive, dtSec });
    } catch (_) {}

    // Update Zodiac System
  if (mgr._zodiacSys && mgr.moonMesh) {
    const showZodiac = (t >= node2Time); // Only in Orbit phase (after corridor)
    try { 
      if (mgr._zodiacSys.setVisible) mgr._zodiacSys.setVisible(showZodiac);
      mgr._zodiacSys.tick(dtSec, mgr.moonMesh, mgr.camera); 
      
      // Dim Starfield when Zodiac is visible (Orbit Phase) to pop the constellations
       if (mgr._mainStarfieldMesh && mgr._mainStarfieldMesh.material && mgr._mainStarfieldMesh.material.uniforms) {
           const u = mgr._mainStarfieldMesh.material.uniforms;
           // Dim by 20% (target ~1.76) when showing Zodiac, otherwise restore to 2.2
           const targetGain = showZodiac ? 1.76 : 2.2; 
           if (u.uBrightnessGain) {
             const cur = u.uBrightnessGain.value || 2.2;
             const lerpSpeed = dtSec * 1.5;
             u.uBrightnessGain.value = cur + (targetGain - cur) * lerpSpeed;
           }
       }
    } catch (_) {}
  }
  }

  try {
    const now = Date.now();
    if (mgr.page && now >= (mgr._moonUiNextUpdate || 0)) {
      mgr._moonUiNextUpdate = now + 250;
      const totalSec = Math.max(0, Math.floor(t || 0));
      const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
      const ss = String(totalSec % 60).padStart(2, '0');
      let phaseLabel = '出发';
      let phaseStart = 0.0;
      if (t >= node3Time) { phaseLabel = '环绕'; phaseStart = node3Time; }
      else if (t >= node2Time) { phaseLabel = '近月'; phaseStart = node2Time; }
      else if (t >= node1Time) { phaseLabel = '长廊'; phaseStart = node1Time; }
      const phaseSec = Math.max(0, Math.floor((Number(t || 0) - Number(phaseStart || 0)) || 0));
      const pmm = String(Math.floor(phaseSec / 60)).padStart(2, '0');
      const pss = String(phaseSec % 60).padStart(2, '0');
      mgr.page.setData({ moonTimerText: `${mm}:${ss}`, moonPhaseText: `${phaseLabel} ${pmm}:${pss}` });
    }
  } catch (_) {}
};
