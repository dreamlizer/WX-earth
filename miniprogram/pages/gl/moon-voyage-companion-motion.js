
// Moon Voyage Companion Motion
// Handles motion path calculations, easing, and cruise plan logic for companion robots

export class CompanionMotion {
  constructor() {
    this.clamp01 = (v) => Math.max(0.0, Math.min(1.0, v));
    this.lerp = (a, b, k) => a + (b - a) * k;
  }

  // --- Easing Functions ---

  easeBrake01(p) {
    const t = this.clamp01(p);
    return this.clamp01(t + t * t - t * t * t);
  }

  easeIn01(p) {
    const t = this.clamp01(p);
    return t * t * t;
  }

  easeInOut01(p) {
    const t = this.clamp01(p);
    return t * t * (3.0 - 2.0 * t);
  }

  easeMove01(ease, p) {
    const e = String(ease || '').toLowerCase();
    if (!e || e === 'brake' || e === 'easeout') return this.easeBrake01(p);
    if (e === 'linear') return this.clamp01(p);
    if (e === 'easein') return this.easeIn01(p);
    if (e === 'easeinout' || e === 'smoothstep') return this.easeInOut01(p);
    return this.easeBrake01(p);
  }

  // --- Cruise Plan Logic ---

  parseCruisePlan(rawScript) {
    const script = Array.isArray(rawScript) ? rawScript : [];
    const segs = [];
    let totalSec = 0.0;

    for (let i = 0; i < script.length; i++) {
      const s = script[i] || {};
      const type = String(s?.type || '').toLowerCase();

      if (type === 'hold') {
        const sec = Math.max(0.0, Number(s?.sec ?? 0.0) || 0.0);
        if (sec > 0) {
          segs.push({ kind: 'hold', sec });
          totalSec += sec;
        }
        continue;
      }

      if (type === 'move') {
        const distanceX01 = Number(s?.distanceX01 ?? 0.0) || 0.0;
        const secByCfg = Number(s?.sec);
        let sec = (isFinite(secByCfg) && secByCfg > 0) ? secByCfg : 0.0;

        if (!(sec > 0)) {
          const speed = Math.max(0.0, Number(s?.speedX01PerSec ?? 0.0) || 0.0);
          if (speed > 1e-6) sec = Math.abs(distanceX01) / speed;
        }

        const ease = String(s?.ease || '').toLowerCase();
        if (sec > 0 && Math.abs(distanceX01) > 1e-9) {
          segs.push({ kind: 'move', sec, dx01: distanceX01, ease });
          totalSec += sec;
        }
      }
    }
    return { segments: segs, totalSec };
  }

  computeCruiseX01(secInCruise, cruiseSec, cruisePlan, midX01, cruiseMotionSec) {
    const tt0 = Math.max(0.0, Math.min(cruiseSec, Number(secInCruise || 0) || 0.0));
    if (!cruisePlan?.segments?.length || cruiseSec <= 1e-6 || cruisePlan.totalSec <= 1e-6) return midX01;

    const ttMotion = Math.min(tt0, cruiseMotionSec);

    // If past the motion loop, stay at the end
    if (ttMotion >= cruiseMotionSec - 1e-9) {
      let xEnd = midX01;
      const segsEnd = cruisePlan.segments;
      for (let i = 0; i < segsEnd.length; i++) {
        const seg = segsEnd[i];
        if (seg?.kind === 'move') xEnd += Number(seg?.dx01 || 0.0) || 0.0;
      }
      return xEnd;
    }

    // Calculate position within loop
    const loopT = cruisePlan.totalSec > 1e-6 ? (ttMotion % cruisePlan.totalSec) : ttMotion;
    let x = midX01;
    let tt = loopT;

    const segs = cruisePlan.segments;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (!seg || !(seg.sec > 0)) continue;

      if (seg.kind === 'hold') {
        if (tt <= seg.sec) return x;
        tt -= seg.sec;
        continue;
      }

      if (seg.kind === 'move') {
        const dx01 = Number(seg.dx01 || 0.0) || 0.0;
        if (!(Math.abs(dx01) > 1e-9)) continue;

        if (tt <= seg.sec) {
          return x + dx01 * this.easeMove01(seg?.ease, tt / seg.sec);
        }
        x += dx01;
        tt -= seg.sec;
        continue;
      }
    }
    return x;
  }

  // --- Robot State Calculation ---

  calculateRobotState(local, cfgOne) {
    const enterSec = Math.max(0.05, Number(cfgOne?.enterSec ?? 1.1) || 1.1);
    const exitSec = Math.max(0.05, Number(cfgOne?.exitSec ?? 0.85) || 0.85);

    const startX01 = Number(cfgOne?.startX01 ?? 1.18) || 1.18;
    const midX01 = Number(cfgOne?.midX01 ?? 0.52) || 0.52;
    const endX01 = Number(cfgOne?.endX01 ?? -0.18) || -0.18;

    // Cruise Planning
    const cruisePlan = this.parseCruisePlan(cfgOne?.cruiseScript);
    const cruiseScriptRepeat = Math.max(1, Math.min(999, Math.floor(Number(cfgOne?.cruiseScriptRepeat ?? 1) || 1)));
    const cruiseMotionSec = Math.max(0.0, Number(cruisePlan?.totalSec ?? 0.0) || 0.0) * cruiseScriptRepeat;
    const cruiseSecCfg = Number(cfgOne?.cruiseSec);
    const cruiseSec = (isFinite(cruiseSecCfg) && cruiseSecCfg > 0) ? cruiseSecCfg : cruiseMotionSec;

    const total = enterSec + cruiseSec + exitSec;

    // Check done
    if (local >= total) {
      return { done: true, total };
    }

    // Calculate X
    let x01 = midX01;
    if (local < enterSec) {
      x01 = this.lerp(startX01, midX01, this.easeBrake01(local / enterSec));
    } else if (local < (enterSec + cruiseSec)) {
      x01 = this.computeCruiseX01(local - enterSec, cruiseSec, cruisePlan, midX01, cruiseMotionSec);
    } else {
      const cruiseEndX01 = this.computeCruiseX01(cruiseSec, cruiseSec, cruisePlan, midX01, cruiseMotionSec);
      x01 = this.lerp(cruiseEndX01, endX01, this.easeIn01((local - (enterSec + cruiseSec)) / exitSec));
    }

    // Calculate Alpha
    const alphaInSec = Math.max(0.0, Number(cfgOne?.alphaInSec ?? 0.8) || 0.0);
    const alphaOutSec = Math.max(0.0, Number(cfgOne?.alphaOutSec ?? 0.8) || 0.0);
    let alpha = 1.0;

    if (alphaInSec > 1e-6) alpha = Math.min(alpha, this.clamp01(local / alphaInSec));
    if (alphaOutSec > 1e-6) alpha = Math.min(alpha, this.clamp01((total - local) / alphaOutSec));

    // Calculate Bobbing
    const bobAmp01 = Math.max(0.0, Number(cfgOne?.bobAmp01 ?? 0.008) || 0.0);
    const bobHz = Math.max(0.0, Number(cfgOne?.bobHz ?? 0.75) || 0.0);
    const bobOffset = (bobAmp01 > 0 ? (bobAmp01 * Math.sin(local * (2.0 * Math.PI) * bobHz)) : 0.0);

    return {
      done: false,
      total,
      x01,
      alpha,
      bobOffset
    };
  }

  // --- Y-Position Logic ---

  resolveYTargets(slots, spacing, baseY01) {
    const count = Math.max(0, Math.min(2, slots.length));
    if (count <= 0) return [];
    
    const clamp01Y = (v) => this.clamp01(Number(v) || 0.0);
    
    if (count === 1) {
      const yExp0 = Number(slots[0]?.cfgPart?.y01);
      return [isFinite(yExp0) ? clamp01Y(yExp0) : clamp01Y(baseY01)];
    }

    const yExp0 = Number(slots[0]?.cfgPart?.y01);
    const yExp1 = Number(slots[1]?.cfgPart?.y01);
    const has0 = isFinite(yExp0);
    const has1 = isFinite(yExp1);
    const y0 = has0 ? clamp01Y(yExp0) : null;
    const y1 = has1 ? clamp01Y(yExp1) : null;

    const minSep = Math.max(0.02, spacing * 0.6);
    if (has0 && has1 && Math.abs(y0 - y1) >= minSep) return [y0, y1];

    const half = spacing * 0.5;
    const clampYWithHalf = (y) => {
      if (!(half > 1e-6)) return clamp01Y(y);
      return Math.max(half, Math.min(1.0 - half, clamp01Y(y)));
    };

    if (has0 && !has1) {
      let yOther = (y0 <= 0.5) ? (y0 + spacing) : (y0 - spacing);
      if (yOther < 0.0 || yOther > 1.0) yOther = (y0 <= 0.5) ? (y0 - spacing) : (y0 + spacing);
      yOther = clamp01Y(yOther);
      if (Math.abs(y0 - yOther) < minSep) {
        const center = clampYWithHalf(y0);
        return [center - half, center + half];
      }
      return [y0, yOther];
    }

    if (!has0 && has1) {
      let yOther = (y1 <= 0.5) ? (y1 + spacing) : (y1 - spacing);
      if (yOther < 0.0 || yOther > 1.0) yOther = (y1 <= 0.5) ? (y1 - spacing) : (y1 + spacing);
      yOther = clamp01Y(yOther);
      if (Math.abs(yOther - y1) < minSep) {
        const center = clampYWithHalf(y1);
        return [center - half, center + half];
      }
      return [yOther, y1];
    }

    const center = clampYWithHalf(baseY01);
    return [center - half, center + half];
  }
}
