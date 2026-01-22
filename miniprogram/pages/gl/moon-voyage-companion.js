
import { CompanionAssets } from './moon-voyage-companion-assets.js';
import { CompanionRender } from './moon-voyage-companion-render.js';
import { CompanionMotion } from './moon-voyage-companion-motion.js';
import { CompanionLayout } from './moon-voyage-companion-layout.js';

export class CompanionRobotEffect {
  constructor() {
    this._robots = [];
    this.assetsMgr = new CompanionAssets();
    this.renderMgr = new CompanionRender();
    this.motionMgr = new CompanionMotion();
    this.layoutMgr = new CompanionLayout();
  }

  setContext(ctx) {
    this.renderMgr.setContext(ctx);
  }

  get THREE() { return this.renderMgr.THREE; }
  get scene() { return this.renderMgr.scene; }
  get camera() { return this.renderMgr.camera; }
  get isDevtools() { return this.renderMgr.isDevtools; }

  reset() {
    this.assetsMgr.reset();
    for (let i = 0; i < this._robots.length; i++) {
      const r = this._robots[i];
      if (!r) continue;
      r.startT = null;
      r.runCfg = null;
      r.y01Base = null;
      r.doneLogged = false;
      r.done = false;
      try {
        if (r.sprite) {
          r.sprite.visible = false;
          const mat = r.sprite.material;
          if (mat) mat.opacity = 0.0;
        }
      } catch (_) {}
      try {
        if (r.glowSprite) {
          r.glowSprite.visible = false;
          const mat = r.glowSprite.material;
          if (mat) mat.opacity = 0.0;
        }
      } catch (_) {}
    }
  }

  dispose() {
    const robots = this._robots || [];
    this._robots = [];
    this.assetsMgr.reset();

    for (let i = 0; i < robots.length; i++) {
      this.renderMgr.disposeRobot(robots[i]);
    }
  }

  _ensureRobot(i) {
    return this.renderMgr.ensureRobot(this._robots, i);
  }

  preload(cfg) {
    const c = cfg || {};
    if (!c?.enabled) return Promise.resolve();
    const baseSrc = String(c?.autoPickBaseSrc ?? c?.src ?? '');
    const r1 = c?.robot1 || {};
    const r2 = c?.robot2 || {};
    const needPick = (!!baseSrc) && (String(r1?.src || '') === '' || String(r2?.src || '') === '');
    if (needPick) this.assetsMgr.ensurePickedSources(c);

    const runWithSources = (picked) => {
      const p = Array.isArray(picked) ? picked.filter(Boolean) : [];
      const src1 = String(r1?.src || '') || String(p[0] || '') || String(baseSrc || '');
      const src2 = String(r2?.src || '') || String(p[1] || '');
      const list = [];
      if (src1) list.push(src1);
      if (src2) list.push(src2);

      const jobs = [];
      for (let i = 0; i < list.length; i++) {
        const rr = this._ensureRobot(i);
        if (!rr?.sprite) continue;
        jobs.push(this.renderMgr.loadTextureForRobot(rr, String(list[i] || ''), this.assetsMgr).catch(() => null));
      }
      return Promise.all(jobs);
    };

    const p = this.assetsMgr.getPickPromise();
    if (needPick && p && typeof p.then === 'function') return p.then(runWithSources);
    return runWithSources(this.assetsMgr.getPickedSrcs());
  }

  _ensureAssetsForRobot(robot, cfg) {
    const c = cfg || {};
    if (!c?.enabled) return;
    if (!this.THREE || !this.camera) return;
    if (!robot?.sprite) return;
    if (robot.texReady || robot.texLoading) return;
    const src = String(c?.src || '');
    if (!src) return;
    this.renderMgr.loadTextureForRobot(robot, src, this.assetsMgr).catch(() => {});
  }

  update({ cfg, t, node1Time, corridorActive, dtSec = 0.0 }) {
    const c = cfg || {};
    if (!this.camera) return;

    const hasLive = Array.isArray(this._robots) && this._robots.some((r) => (r && r.startT != null && !r.done));
    if (!c?.enabled && !hasLive) return;

    // --- State and Config Resolution ---
    const baseSrc = String(c?.autoPickBaseSrc ?? c?.src ?? '');
    const r1 = c?.robot1 || {};
    const r2 = c?.robot2 || {};
    const r1Enabled = (r1?.enabled == null) ? true : !!r1.enabled;
    const r2Enabled = (r2?.enabled == null) ? true : !!r2.enabled;

    this.assetsMgr.ensurePickedSources(c);
    const pickedArr = Array.isArray(this.assetsMgr.getPickedSrcs()) ? this.assetsMgr.getPickedSrcs().filter(Boolean) : [];
    const pickCount = Math.max(1, Math.min(2, Math.floor(Number(c?.autoPickCount ?? 2) || 2)));
    const needPick = (!!baseSrc) && pickCount > 1 && (
      (r1Enabled && String(r1?.src || '') === '') ||
      (r2Enabled && String(r2?.src || '') === '')
    );
    const pickInFlight = needPick && !!this.assetsMgr.getPickPromise() && pickedArr.length === 0;
    if (pickInFlight) return;

    const desiredSrc1 = String(r1?.src || '') || String(pickedArr[0] || '') || String(baseSrc || '');
    const desiredSrc2 = String(r2?.src || '') || String(pickedArr[1] || '');

    const rr0 = this._ensureRobot(0);
    const rr1 = this._ensureRobot(1);
    const src1 = (rr0?.startT != null && rr0?.src) ? String(rr0.src || '') : desiredSrc1;
    const src2 = (rr1?.startT != null && rr1?.src) ? String(rr1.src || '') : desiredSrc2;

    const activeIdx = [];
    if (rr0?.startT != null && !rr0?.done) activeIdx.push(0);
    if (rr1?.startT != null && !rr1?.done) activeIdx.push(1);
    if (activeIdx.indexOf(0) < 0 && r1Enabled && src1) activeIdx.push(0);
    if (activeIdx.indexOf(1) < 0 && r2Enabled && src2) activeIdx.push(1);

    if (activeIdx.length <= 0) {
      this._hideAllRobots();
      return;
    }

    // --- Sync Slots ---
    const slots = activeIdx.map((idx) => {
      const r = (idx === 0) ? rr0 : rr1;
      const cfgPart = (idx === 0) ? r1 : r2;
      const desired = (idx === 0) ? desiredSrc1 : desiredSrc2;
      const locked = (r?.startT != null && r?.src) ? String(r.src || '') : String(desired || '');
      const src = locked || String(desired || '');
      const runCfg = (r?.startT != null && r?.runCfg) ? r.runCfg : null;
      return { idx, r, cfgPart, desired, src, runCfg };
    });

    // --- Activation & Asset Loading ---
    if (corridorActive) {
      for (let k = 0; k < slots.length; k++) {
        const slot = slots[k];
        const r = slot?.r;
        if (!r) continue;
        if (r.startT != null) continue;
        
        const src = String(slot?.src || '');
        const cfgPart = slot?.cfgPart || {};
        if (r.startT == null && r.src !== src) {
          r.texReady = false;
          r.texLoading = false;
          r.texToken = (Number(r.texToken || 0) || 0) + 1;
          r.src = src;
          r.startT = null;
          r.done = false;
        }
        try { this._ensureAssetsForRobot(r, { ...c, ...cfgPart, enabled: true, src: (r.startT != null && r.src) ? r.src : src }); } catch (_) {}
      }
    }

    // --- Check Done State ---
    let allDone = true;
    for (let k = 0; k < slots.length; k++) {
      const r = slots[k]?.r;
      if (r && !r.done) allDone = false;
    }
    if (allDone) {
      this._hideAllRobots(slots);
      return;
    }

    // --- Y-Position Smoothing ---
    const baseY01 = Number(c?.y01 ?? 0.56) || 0.56;
    const spacing = Math.max(0.0, Math.min(0.5, Number(c?.pairSpacingY01 ?? 0.10) || 0.10));
    const yTargets = this.motionMgr.resolveYTargets(slots, spacing, baseY01);
    
    // --- Update Each Robot ---
    for (let k = 0; k < slots.length; k++) {
      const slot = slots[k];
      const r = slot?.r;
      if (!r || r.done) continue;

      const oneCfg = slot?.cfgPart || {};
      const y01Target = (yTargets && yTargets.length > k) ? this.motionMgr.clamp01(yTargets[k]) : this.motionMgr.clamp01(baseY01);
      
      // Update damped Y
      if (!isFinite(Number(r.y01Base))) r.y01Base = y01Target;
      const dt = Math.max(0.0, Number(dtSec || 0.0) || 0.0);
      if (dt > 1e-6) {
        const tau = 0.35;
        const a = 1.0 - Math.exp(-dt / Math.max(1e-6, tau));
        r.y01Base = Number(r.y01Base) + (y01Target - Number(r.y01Base)) * a;
      } else {
        r.y01Base = y01Target;
      }

      const srcUse = (r.startT != null && r.src) ? String(r.src || '') : String(slot?.src || '');
      const cfgOne = slot?.runCfg || { ...c, ...oneCfg, enabled: true, y01: Number(r.y01Base), src: srcUse };

      // Handle delayed start
      if (r.startT == null) {
        const startDelaySec = Math.max(0.0, Number(cfgOne?.startDelaySec ?? 2.0) || 0.0);
        const startT = Number(node1Time || 0) + startDelaySec;
        if (!corridorActive || t < startT) {
          this._hideRobot(r);
          continue;
        }
      }

      // Check texture readiness
      if (!r.sprite || !r.texReady) {
        this._hideRobot(r);
        this._logDiag(r, slot, t, corridorActive, cfgOne);
        continue;
      }

      // Initialize run state
      if (r.startT == null) {
        r.startT = Number(t || 0);
        r.runCfg = { ...cfgOne };
        r.doneLogged = false;
      }

      // Calculate Motion State
      const local = Math.max(0.0, Number(t - r.startT) || 0.0);
      const state = this.motionMgr.calculateRobotState(local, cfgOne);

      if (state.done) {
        r.done = true;
        this._hideRobot(r);
        this._logDone(r, slot, t, local, state.total);
        continue;
      }

      // Calculate Layout & Projection
      const y01Bob = this.motionMgr.clamp01(r.y01Base) + state.bobOffset;
      const layout = this.layoutMgr.projectToWorld(this.camera, this.THREE, state.x01, y01Bob, cfgOne);

      if (!layout) continue;

      // Apply to Sprite
      try {
        r.sprite.position.copy(layout.position);
        r.sprite.scale.set(layout.spriteH * Math.max(0.1, Number(r.imgAspect || 1.0) || 1.0), layout.spriteH, 1.0);
        r.sprite.visible = state.alpha > 0.01;
        
        const mat = r.sprite.material;
        if (mat) mat.opacity = this.motionMgr.clamp01(state.alpha);

        // Apply Glow
        const glowCfg = cfgOne?.glow || {};
        if (!!glowCfg?.enabled && r.glowSprite) {
          r.glowSprite.position.copy(layout.position);
          const glowScaleMul = Math.max(1.0, Number(glowCfg?.scaleMul ?? 1.35) || 1.0);
          r.glowSprite.scale.set(r.sprite.scale.x * glowScaleMul, r.sprite.scale.y * glowScaleMul, 1.0);
          
          const gmat = r.glowSprite.material;
          if (gmat) {
            const glowOpacityMul = Math.max(0.0, Number(glowCfg?.opacity ?? 0.35) || 0.0);
            gmat.opacity = this.motionMgr.clamp01(state.alpha * glowOpacityMul);
            const glowColor = glowCfg?.color;
            if (typeof glowColor === 'number' && gmat.color && typeof gmat.color.setHex === 'function') gmat.color.setHex(glowColor);
          }
          r.glowSprite.visible = (r.glowSprite.material?.opacity || 0) > 0.01;
        } else {
          if (r.glowSprite) r.glowSprite.visible = false;
        }
      } catch (_) {}

      this._logDiag(r, slot, t, corridorActive, cfgOne);
    }
  }

  _hideRobot(r) {
    try { if (r?.sprite) r.sprite.visible = false; } catch (_) {}
    try { if (r?.glowSprite) r.glowSprite.visible = false; } catch (_) {}
  }

  _hideAllRobots(slots) {
    if (slots) {
      for (let k = 0; k < slots.length; k++) {
        this._hideRobot(slots[k]?.r);
      }
    } else {
      try { if (this._robots[0]) this._hideRobot(this._robots[0]); } catch (_) {}
      try { if (this._robots[1]) this._hideRobot(this._robots[1]); } catch (_) {}
    }
  }

  _logDiag(r, slot, t, corridorActive, cfgOne) {
    if (!this.isDevtools) return;
    const now = Date.now();
    if (now >= (r.diagNextAt || 0)) {
      r.diagNextAt = now + 1200;
      try {
        console.log('[Moon][CompanionDiag]', {
          idx: Number(slot?.idx ?? 0),
          corridorActive: !!corridorActive,
          t: Number((t || 0).toFixed?.(2) ?? t),
          waitingTexture: !r.texReady,
          texReady: !!r.texReady,
          texLoading: !!r.texLoading,
          hasSprite: !!r.sprite,
          src: String(cfgOne?.src || ''),
        });
      } catch (_) {}
    }
  }

  _logDone(r, slot, t, local, total) {
    if (!this.isDevtools || r.doneLogged) return;
    r.doneLogged = true;
    try {
      console.log('[Moon][CompanionDone]', {
        idx: Number(slot?.idx ?? 0),
        t: Number((t || 0).toFixed?.(2) ?? t),
        local: Number((local || 0).toFixed?.(2) ?? local),
        total: Number((total || 0).toFixed?.(2) ?? total),
      });
    } catch (_) {}
  }
}
