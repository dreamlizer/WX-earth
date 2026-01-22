
import { loadTextureWithRetry, fixTexture, dumpTextureInfo } from './asset-manager.js';
import { getTextureUrl } from './texture-source.js';
import { makeEquatorAndTropics } from './layers.js';
import { applyThemeWithState } from './theme-manager.js';

/**
 * 按顺序加载纹理并在场景中构建地球和云层
 * @param {Object} ctx - 上下文对象
 * @param {Object} ctx.THREE - THREE 实例
 * @param {Object} ctx.globeGroup - 地球容器组
 * @param {Object} ctx.config - 配置项 (APP_CFG, LIGHT_CFG, RADIUS, TEX_FLIP_Y, isPCClient)
 * @param {Function} ctx.checkState - 检查当前模块状态是否有效 (返回 boolean)
 * @param {Object} ctx.refs - 引用对象 (getters)
 * @param {Object} ctx.setters - 设置器对象
 */
export const loadTexturesSequentially = async (ctx) => {
  const { THREE, globeGroup, config, checkState, refs, setters } = ctx;
  const { APP_CFG, LIGHT_CFG, RADIUS, TEX_FLIP_Y, isPCClient } = config;
  const loader = new THREE.TextureLoader();

  try {
    // 1. 加载地球日间纹理 (基础)
    const dayLoaded = await loadTextureWithRetry(loader, 'earth', (force) => getTextureUrl('earth', !!force), (tex) => {
      if (!checkState()) return;
      
      tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 1;
      try { tex.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { tex.encoding = THREE.sRGBEncoding; } catch(__){} }
      try { tex.flipY = TEX_FLIP_Y; tex.needsUpdate = true; } catch(_){}
      fixTexture(tex, isPCClient);
      
      setters.setEarthDayTex(tex);
      dumpTextureInfo('earth', tex);

      let earthMesh = refs.earthMesh();
      if (!earthMesh) {
        const mat = new THREE.MeshPhongMaterial({ map: tex, shininess: (LIGHT_CFG.earthMaterial?.shininess ?? 8), transparent: true, opacity: 0 });
        earthMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 48), mat);
        try { earthMesh.renderOrder = 10; } catch(_){}
        earthMesh.name = 'EARTH';
        earthMesh.visible = false;
        globeGroup.add(earthMesh);
        setters.setEarthMesh(earthMesh);
      } else if (refs.currentTheme() === 'default') {
        earthMesh.material.map = tex;
        earthMesh.material.needsUpdate = true;
      }

      try {
        applyThemeWithState({ 
          THREE, 
          earthMesh, 
          earthDayTex: tex, 
          earthPureDayTex: refs.earthPureDayTex(), 
          earthNightTex: refs.earthNightTex(), 
          APP_CFG, 
          zenActive: refs.zenActive(), 
          kind: refs.currentTheme(), 
          themeState: refs.themeState() 
        });
      } catch(_){}

      try { 
        if (!refs.tropicGroup()) { 
          const g = makeEquatorAndTropics(THREE, globeGroup); 
          g.visible = false; 
          setters.setTropicGroup(g);
        } 
      } catch(_){}

      if (earthMesh) {
        earthMesh.visible = true;
        const tweener = refs.tweener();
        if (tweener) {
          tweener.to(earthMesh.material, { opacity: 1 }, 1200, t => t * (2 - t), null, () => {
            setters.setEarthReady(true);
            setTimeout(() => { 
              try { const tg = refs.tropicGroup(); if (tg) tg.visible = true; } catch(_){} 
              try { const bg = refs.borderGroup(); if (bg) bg.visible = true; } catch(_){} 
            }, 1000);
          });
        }
        try { refs.page()?.setData({ loading: false }); } catch(_){}
      }
    }, { maxAttempts: 3, baseDelayMs: 800 });

    // 如果基础纹理加载失败，创建默认球体
    if (!dayLoaded) {
      if (!refs.earthMesh()) {
        const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 48), new THREE.MeshPhongMaterial({ color: 0x888888, shininess: (LIGHT_CFG.earthMaterial?.shininess ?? 8) }));
        earthMesh.name = 'EARTH';
        globeGroup.add(earthMesh);
        setters.setEarthMesh(earthMesh);
      }
      try { 
        if (!refs.tropicGroup()) { 
          const g = makeEquatorAndTropics(THREE, globeGroup); 
          g.visible = false; 
          setters.setTropicGroup(g);
        } 
      } catch(_){}
    }

    // 2. 加载纯白昼纹理 (Day 8K)
    try {
      await loadTextureWithRetry(loader, 'earth_day', (force) => getTextureUrl('earth_day', !!force), (tex) => {
        tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 1;
        try { tex.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { tex.encoding = THREE.sRGBEncoding; } catch(__){} }
        try { tex.flipY = TEX_FLIP_Y; tex.needsUpdate = true; } catch(_){}
        fixTexture(tex, isPCClient);
        
        setters.setEarthPureDayTex(tex);
        dumpTextureInfo('earth_day (纯白昼)', tex);
        
        try { 
          applyThemeWithState({ 
            THREE, 
            earthMesh: refs.earthMesh(), 
            earthDayTex: refs.earthDayTex(), 
            earthPureDayTex: tex, 
            earthNightTex: refs.earthNightTex(), 
            APP_CFG, 
            zenActive: refs.zenActive(), 
            kind: refs.currentTheme(), 
            themeState: refs.themeState() 
          }); 
        } catch(_){}
      }, { maxAttempts: 2, baseDelayMs: 800 });
    } catch(_){}

    // 3. 立即创建云层 Mesh (占位)，避免 setCloudVisible 找不到对象
    try {
      let cloudMesh = refs.cloudMesh();
      if (!cloudMesh) {
        // 初始材质：无纹理，白色，透明，使用加法混合避免黑边
          const cloudMat = new THREE.MeshPhongMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.28, 
            depthWrite: false, 
            depthTest: true,
            blending: THREE.AdditiveBlending
          });
        cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS + 0.012, 64, 64), cloudMat);
        cloudMesh.name = 'CLOUD';
        
        // 确保云层在地球(10)之后渲染
        try { cloudMesh.renderOrder = 20; } catch(_){}
        
        // 初始可见性
        try { 
          cloudMesh.visible = !!(refs.page() && refs.page().data && refs.page().data.showCloud); 
        } catch(_){ cloudMesh.visible = false; }
        
        globeGroup.add(cloudMesh);
        setters.setCloudMesh(cloudMesh);
      }
    } catch(e) { console.error('[scene] cloud init error', e); }

    // 延迟加载夜景和云层纹理
    setTimeout(async () => {
      // 夜景
      try {
        await loadTextureWithRetry(loader, 'earth_night', (force) => getTextureUrl('earth_night', !!force), (tex) => {
          tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; try { tex.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { tex.encoding = THREE.sRGBEncoding; } catch(__){} }
          try { tex.flipY = TEX_FLIP_Y; tex.needsUpdate = true; } catch(_){}
          fixTexture(tex, isPCClient);
          
          setters.setEarthNightTex(tex);
          dumpTextureInfo('earth_night', tex);
          
          try { 
            applyThemeWithState({ 
              THREE, 
              earthMesh: refs.earthMesh(), 
              earthDayTex: refs.earthDayTex(), 
              earthPureDayTex: refs.earthPureDayTex(), 
              earthNightTex: tex, 
              APP_CFG, 
              zenActive: refs.zenActive(), 
              kind: refs.currentTheme(), 
              themeState: refs.themeState() 
            }); 
          } catch(_){}
        }, { maxAttempts: 2, baseDelayMs: 800 });
      } catch(_){}
      
      // 云层纹理加载
      try {
        await loadTextureWithRetry(loader, 'cloud', (force) => getTextureUrl('cloud', !!force), (tex) => {
          tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; try { tex.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { tex.encoding = THREE.sRGBEncoding; } catch(__){} }
          try { tex.flipY = false; tex.needsUpdate = true; } catch(_){}
          fixTexture(tex, isPCClient);
          
          const cloudMesh = refs.cloudMesh();
          if (cloudMesh) {
            cloudMesh.material.map = tex;
            cloudMesh.material.needsUpdate = true;
            console.log('[scene] cloud texture applied');
          }
          dumpTextureInfo('cloud', tex);
        }, { maxAttempts: 2, baseDelayMs: 800 });
      } catch(_){}
    }, 200); // 缩短延迟，尽快加载

  } catch(e) {
    console.error('[texture] 序列加载失败', e);
  }
};
