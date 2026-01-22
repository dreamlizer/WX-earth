import { createStarfieldMaterial, applyZenStarUniforms } from './starfield.glsl.js';
import { mulberry32 } from './moon-voyage-rand.js';

export function createMilkyWay(THREE, appCfg, opts) {
  const cfg = appCfg?.moonVoyage?.starCorridor || {};
  const zen = appCfg?.zen || {};
  const tunnelYaw = (typeof opts?.tunnelYaw === 'number') ? opts.tunnelYaw : 0.85;

  const X_MIN = (typeof cfg.xMin === 'number') ? cfg.xMin : -56;
  const X_MAX = (typeof cfg.xMax === 'number') ? cfg.xMax : 6;
  const Y_RANGE = (typeof cfg.yRange === 'number') ? cfg.yRange : 80;
  const Z_MIN = (typeof cfg.zMin === 'number') ? cfg.zMin : -60;
  const Z_MAX = (typeof cfg.zMax === 'number') ? cfg.zMax : -260;
  const BELT_Y_HALF_RANGE = (typeof cfg.beltYHalfRange === 'number') ? cfg.beltYHalfRange : 5;
  const BELT_Z_MIN = (typeof cfg.beltZMin === 'number') ? cfg.beltZMin : -110;
  const BELT_Z_MAX = (typeof cfg.beltZMax === 'number') ? cfg.beltZMax : -190;

  const baseLenX = (typeof cfg.baseLenX === 'number') ? cfg.baseLenX : 32;
  const baseCountAtLen = (typeof cfg.baseCountAtLen === 'number') ? cfg.baseCountAtLen : 5000;
  const beltCountAtLen = (typeof cfg.beltCountAtLen === 'number') ? cfg.beltCountAtLen : 2200;

  const xLen = Math.max(1e-6, X_MAX - X_MIN);
  const baseCount = Math.max(0, Math.floor(baseCountAtLen * (xLen / Math.max(1e-6, baseLenX))));
  const beltCount = Math.max(0, Math.floor(beltCountAtLen * (xLen / Math.max(1e-6, baseLenX))));
  const count = baseCount + beltCount;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const speeds = new Float32Array(count);
  const offsets = new Float32Array(count);
  const groupIds = new Float32Array(count);

  const seed = (typeof cfg.seed === 'number') ? cfg.seed : 1337;
  const rand = mulberry32((seed >>> 0) || 1);
  const color = new THREE.Color();

  for (let i = 0; i < baseCount; i++) {
    const i3 = i * 3;
    const x = X_MIN + rand() * (X_MAX - X_MIN);
    const y = (rand() - 0.5) * Y_RANGE;
    const z = Z_MIN + Math.pow(rand(), 0.42) * (Z_MAX - Z_MIN);
    positions[i3 + 0] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;

    const mix = rand();
    if (mix > 0.94) color.setHex(0xffffff);
    else if (mix > 0.78) color.setHex(0xaaddff);
    else if (mix > 0.62) color.setHex(0xffaaff);
    else color.setHex(0x8866ff);
    const b = 0.45 + rand() * 0.35;
    colors[i3 + 0] = color.r * b;
    colors[i3 + 1] = color.g * b;
    colors[i3 + 2] = color.b * b;

    sizes[i] = 0.16 + rand() * 0.24;
    speeds[i] = 0.30 + rand() * 1.05;
    offsets[i] = rand() * Math.PI * 2;
    groupIds[i] = 0.0;
  }

  for (let j = 0; j < beltCount; j++) {
    const i = baseCount + j;
    const i3 = i * 3;
    const x = X_MIN + rand() * (X_MAX - X_MIN);
    const y = (rand() + rand() + rand() + rand() - 2) * BELT_Y_HALF_RANGE;
    const z = BELT_Z_MIN + Math.pow(rand(), 0.38) * (BELT_Z_MAX - BELT_Z_MIN);
    positions[i3 + 0] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;

    const mix = rand();
    if (mix > 0.88) color.setHex(0xffffff);
    else if (mix > 0.70) color.setHex(0xcfe8ff);
    else if (mix > 0.54) color.setHex(0xffd6f2);
    else color.setHex(0x9a86ff);
    const b = 0.75 + rand() * 0.55;
    colors[i3 + 0] = color.r * b;
    colors[i3 + 1] = color.g * b;
    colors[i3 + 2] = color.b * b;

    sizes[i] = 0.36 + rand() * 0.55;
    speeds[i] = 0.35 + rand() * 1.25;
    offsets[i] = rand() * Math.PI * 2;
    groupIds[i] = 1.0;
  }

  const BufAttr = THREE.Float32BufferAttribute || THREE.BufferAttribute;
  const geometry = new THREE.BufferGeometry();
  if (typeof geometry.setAttribute === 'function') {
    geometry.setAttribute('position', new BufAttr(positions, 3));
    geometry.setAttribute('color', new BufAttr(colors, 3));
    geometry.setAttribute('size', new BufAttr(sizes, 1));
    geometry.setAttribute('twinkleSpeed', new BufAttr(speeds, 1));
    geometry.setAttribute('twinkleOffset', new BufAttr(offsets, 1));
    geometry.setAttribute('groupId', new BufAttr(groupIds, 1));
  } else if (typeof geometry.addAttribute === 'function') {
    geometry.addAttribute('position', new BufAttr(positions, 3));
    geometry.addAttribute('color', new BufAttr(colors, 3));
    geometry.addAttribute('size', new BufAttr(sizes, 1));
    geometry.addAttribute('twinkleSpeed', new BufAttr(speeds, 1));
    geometry.addAttribute('twinkleOffset', new BufAttr(offsets, 1));
    geometry.addAttribute('groupId', new BufAttr(groupIds, 1));
  }

  const material = createStarfieldMaterial(THREE, {
    starOpacity: (typeof cfg.starOpacity === 'number') ? cfg.starOpacity : 1.0,
    starSizeScale: (typeof cfg.starSizeScale === 'number') ? cfg.starSizeScale : zen.starSizeScale,
    starBrightnessGain: (typeof cfg.starBrightnessGain === 'number') ? cfg.starBrightnessGain : zen.starBrightnessGain,
    starBreathSpeed: (typeof cfg.starBreathSpeed === 'number') ? cfg.starBreathSpeed : zen.starBreathSpeed,
    starBreathStrength: (typeof cfg.starBreathStrength === 'number') ? cfg.starBreathStrength : zen.starBreathStrength,
    starCorePower: (typeof cfg.starCorePower === 'number') ? cfg.starCorePower : zen.starCorePower,
    starGlowFactor: (typeof cfg.starGlowFactor === 'number') ? cfg.starGlowFactor : zen.starGlowFactor,
    opacityAffectsColor: true,
    scrollEnabled: true,
    scrollSpeed: (typeof cfg.scrollSpeed === 'number') ? cfg.scrollSpeed : -9.0,
    zMin: Z_MIN,
    zMax: Z_MAX,
    beltZMin: BELT_Z_MIN,
    beltZMax: BELT_Z_MAX,
  });
  applyZenStarUniforms({ material }, { ...zen, ...cfg });

  const mesh = new THREE.Points(geometry, material);
  mesh.renderOrder = -1;
  mesh.visible = true;
  mesh.frustumCulled = false;
  mesh.rotation.y = tunnelYaw;
  return mesh;
}

export function createStarDustLayer(THREE, appCfg, opts) {
  const cfg = appCfg?.moonVoyage?.starCorridor || {};
  const seedBase = (typeof cfg.seed === 'number') ? cfg.seed : 1337;
  const kind = String(opts?.kind || 'slow');
  const isFast = kind === 'fast';
  const isBg = kind === 'bg';
  const rand = mulberry32(((seedBase + (isBg ? 203 : (isFast ? 101 : 37))) >>> 0) || 1);

  const count = isBg ? 2600 : (isFast ? 2200 : 1400);
  const xHalf = isBg ? 42.0 : 18.0;
  const yHalf = isBg ? 26.0 : (isFast ? 10.0 : 8.0);
  const zMin = isBg ? -140.0 : -70.0;
  const zMax = isBg ? 140.0 : 70.0;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const speeds = new Float32Array(count);
  const offsets = new Float32Array(count);
  const groupIds = new Float32Array(count);

  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const x = (rand() * 2 - 1) * xHalf;
    const y = (rand() + rand() + rand() + rand() - 2) * yHalf;
    const z = zMin + rand() * (zMax - zMin);
    positions[i3 + 0] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;

    const mix = rand();
    if (mix > 0.93) color.setHex(0xffffff);
    else if (mix > 0.80) color.setHex(0xcfe8ff);
    else if (mix > 0.66) color.setHex(0xffe0c6);
    else color.setHex(0xcfe0ff);
    const b = isBg ? (0.18 + rand() * 0.22) : ((isFast ? 0.80 : 0.55) + rand() * (isFast ? 0.65 : 0.35));
    colors[i3 + 0] = color.r * b;
    colors[i3 + 1] = color.g * b;
    colors[i3 + 2] = color.b * b;

    sizes[i] = isBg ? (0.18 + rand() * 0.26) : ((isFast ? 0.34 : 0.22) + rand() * (isFast ? 0.62 : 0.42));
    speeds[i] = isBg ? (0.10 + rand() * 0.30) : ((isFast ? 0.10 : 0.20) + rand() * (isFast ? 0.60 : 0.85));
    offsets[i] = rand() * Math.PI * 2;
    groupIds[i] = 0.0;
  }

  const BufAttr = THREE.Float32BufferAttribute || THREE.BufferAttribute;
  const geometry = new THREE.BufferGeometry();
  if (typeof geometry.setAttribute === 'function') {
    geometry.setAttribute('position', new BufAttr(positions, 3));
    geometry.setAttribute('color', new BufAttr(colors, 3));
    geometry.setAttribute('size', new BufAttr(sizes, 1));
    geometry.setAttribute('twinkleSpeed', new BufAttr(speeds, 1));
    geometry.setAttribute('twinkleOffset', new BufAttr(offsets, 1));
    geometry.setAttribute('groupId', new BufAttr(groupIds, 1));
  } else if (typeof geometry.addAttribute === 'function') {
    geometry.addAttribute('position', new BufAttr(positions, 3));
    geometry.addAttribute('color', new BufAttr(colors, 3));
    geometry.addAttribute('size', new BufAttr(sizes, 1));
    geometry.addAttribute('twinkleSpeed', new BufAttr(speeds, 1));
    geometry.addAttribute('twinkleOffset', new BufAttr(offsets, 1));
    geometry.addAttribute('groupId', new BufAttr(groupIds, 1));
  }

  const material = createStarfieldMaterial(THREE, {
    starOpacity: 1.0,
    starSizeScale: isBg ? 1.25 : (isFast ? 2.0 : 1.6),
    starBrightnessGain: isBg ? 1.25 : (isFast ? 3.2 : 2.2),
    starBreathSpeed: 0.35,
    starBreathStrength: isBg ? 0.05 : (isFast ? 0.12 : 0.08),
    starCorePower: 3.6,
    starGlowFactor: isBg ? 0.12 : 0.18,
    opacityAffectsColor: true,
    scrollEnabled: true,
    scrollSpeed: isBg ? 0.55 : (isFast ? 10.0 : 1.8),
    zMin,
    zMax,
    beltZMin: zMin,
    beltZMax: zMax,
  });

  const mesh = new THREE.Points(geometry, material);
  mesh.visible = true;
  mesh.frustumCulled = false;
  return mesh;
}

