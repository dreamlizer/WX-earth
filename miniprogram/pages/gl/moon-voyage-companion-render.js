
export class CompanionRender {
  constructor() {
    this.THREE = null;
    this.scene = null;
    this.camera = null;
    this.isDevtools = false;
  }

  setContext({ THREE, scene, camera, isDevtools }) {
    this.THREE = THREE || null;
    this.scene = scene || null;
    this.camera = camera || null;
    this.isDevtools = !!isDevtools;
  }

  ensureRobot(robots, i) {
    const idx = Math.max(0, Math.floor(Number(i || 0) || 0));
    while (robots.length <= idx) robots.push(null);
    let r = robots[idx];
    if (!r) {
      r = {
        sprite: null,
        glowSprite: null,
        texToken: 0,
        texLoading: false,
        texReady: false,
        imgAspect: 1.0,
        startT: null,
        runCfg: null,
        y01Base: null,
        done: false,
        doneLogged: false,
        warned: false,
        diagNextAt: 0,
        src: ''
      };
      robots[idx] = r;
    }

    if (r.sprite) return r;
    const THREE = this.THREE;
    if (!THREE || !this.camera) return null;

    const mat = new THREE.SpriteMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      depthTest: false,
      depthWrite: false
    });
    const sp = new THREE.Sprite(mat);
    sp.visible = false;
    sp.frustumCulled = false;
    sp.renderOrder = 9999;
    try { this.scene?.add?.(sp); } catch (_) { try { this.camera.add(sp); } catch(__) {} }
    r.sprite = sp;

    try {
      const glowMat = new THREE.SpriteMaterial({
        color: 0x9be3ff,
        transparent: true,
        opacity: 0.0,
        depthTest: false,
        depthWrite: false
      });
      try { if (THREE.AdditiveBlending != null) glowMat.blending = THREE.AdditiveBlending; } catch (_) {}
      const glow = new THREE.Sprite(glowMat);
      glow.visible = false;
      glow.frustumCulled = false;
      glow.renderOrder = 9998;
      try { this.scene?.add?.(glow); } catch (_) { try { this.camera.add(glow); } catch(__) {} }
      r.glowSprite = glow;
    } catch (_) {}
    return r;
  }

  disposeRobot(r) {
    if (!r) return;
    const sp = r.sprite;
    const glow = r.glowSprite;
    
    // Reset state
    r.sprite = null;
    r.glowSprite = null;
    r.startT = null;
    r.runCfg = null;
    r.y01Base = null;
    r.done = false;
    r.doneLogged = false;
    r.texReady = false;
    r.texLoading = false;
    r.imgAspect = 1.0;
    r.texToken = (Number(r.texToken || 0) || 0) + 1;

    // Cleanup THREE objects
    try { if (sp && this.scene) this.scene.remove(sp); } catch (_) {}
    try { if (sp && this.camera) this.camera.remove(sp); } catch (_) {}
    try { if (glow && this.scene) this.scene.remove(glow); } catch (_) {}
    try { if (glow && this.camera) this.camera.remove(glow); } catch (_) {}
    
    try {
      const mat = sp?.material;
      if (mat) {
        try { if (mat.map) mat.map.dispose?.(); } catch (_) {}
        try { mat.dispose?.(); } catch (_) {}
      }
    } catch (_) {}
    
    try {
      const mat = glow?.material;
      if (mat) {
        try { if (mat.map) mat.map.dispose?.(); } catch (_) {}
        try { mat.dispose?.(); } catch (_) {}
      }
    } catch (_) {}
    
    try { sp?.geometry?.dispose?.(); } catch (_) {}
    try { glow?.geometry?.dispose?.(); } catch (_) {}
  }

  loadTextureForRobot(robot, src, assetsMgr) {
    const THREE = this.THREE;
    if (!THREE) return Promise.reject(new Error('THREE not ready'));
    const r = robot || {};
    const token = (r.texToken = (Number(r.texToken || 0) || 0) + 1);
    r.texLoading = true;
    r.texReady = false;
    r.src = String(src || '');

    const loadWith = (u) => new Promise((resolve, reject) => {
      try {
        const loader = new THREE.TextureLoader();
        loader.load(
          u,
          (tex) => resolve(tex),
          undefined,
          (err) => reject(err || new Error('Texture load failed'))
        );
      } catch (e) { reject(e); }
    });

    const canGetInfo = (typeof wx !== 'undefined') && typeof wx.getImageInfo === 'function';
    const normalized = assetsMgr.normalizeSrc(src);
    const candidates = (() => {
      const raw = String(src || '');
      const arr = [normalized, raw];
      if (raw && !raw.startsWith('/')) arr.push(`/${raw}`);
      if (normalized && normalized.startsWith('/')) arr.push(normalized.slice(1));
      const uniq = [];
      for (let i = 0; i < arr.length; i++) {
        const it = String(arr[i] || '').trim();
        if (!it) continue;
        if (uniq.indexOf(it) >= 0) continue;
        uniq.push(it);
      }
      return uniq;
    })();

    const finishOk = (tex) => {
      if (token !== r.texToken) {
        try { tex?.dispose?.(); } catch (_) {}
        return;
      }
      try {
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        try { tex.colorSpace = THREE.SRGBColorSpace; } catch (_) { try { tex.encoding = THREE.sRGBEncoding; } catch(__){} }
        tex.needsUpdate = true;
      } catch (_) {}

      try {
        const img = tex.image;
        const w = Number(img?.width || 0);
        const h = Number(img?.height || 0);
        if (w > 0 && h > 0) r.imgAspect = w / h;
      } catch (_) {}

      try {
        const mat = r?.sprite?.material;
        if (mat) {
          mat.map = tex;
          mat.needsUpdate = true;
        }
      } catch (_) {}
      try {
        const mat = r?.glowSprite?.material;
        if (mat) {
          mat.map = tex;
          mat.needsUpdate = true;
        }
      } catch (_) {}

      r.texReady = true;
      r.texLoading = false;
      r.warned = false;
    };

    const finishFail = () => {
      if (token !== r.texToken) return;
      r.texReady = false;
      r.texLoading = false;
      if (this.isDevtools && !r.warned) {
        r.warned = true;
        try { console.warn('[Moon][Companion] texture load failed', { src, candidates }); } catch (_) {}
      }
    };

    if (!canGetInfo) {
      return (async () => {
        try {
          const u = String(src || '');
          if (u.startsWith('cloud://')) {
            const p = await assetsMgr.resolveCloudToLocal(u);
            const tex = await loadWith(p);
            finishOk(tex);
            return tex;
          }
          const tex = await loadWith(normalized || src);
          finishOk(tex);
          return tex;
        } catch (e) {
          finishFail();
          throw e;
        }
      })();
    }

    const getInfo = (u) => new Promise((resolve, reject) => {
      try {
        wx.getImageInfo({
          src: u,
          success: (res) => resolve({ res, u }),
          fail: (e) => reject(e)
        });
      } catch (e) { reject(e); }
    });

    return (async () => {
      try {
        const u0 = String(src || '');
        if (u0.startsWith('cloud://')) {
          const p = await assetsMgr.resolveCloudToLocal(u0);
          if (token !== r.texToken) throw new Error('stale token');
          const tex = await loadWith(p);
          finishOk(tex);
          return tex;
        }
        for (let i = 0; i < candidates.length; i++) {
          const u = candidates[i];
          try {
            const r = await getInfo(u);
            if (token !== robot?.texToken) throw new Error('stale token');
            const p = r?.res?.path || r?.res?.tempFilePath || u;
            try {
              const tex = await loadWith(p);
              finishOk(tex);
              return tex;
            } catch (_) {}
          } catch (_) {}
        }
        const tex = await loadWith(normalized || src);
        finishOk(tex);
        return tex;
      } catch (e) {
        finishFail();
        throw e;
      }
    })();
  }
}
