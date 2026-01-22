export function renderWithBloom(opts) {
  try {
    const {
      THREE,
      renderer,
      scene,
      camera,
      width,
      height,
      composer,
      bloomPass,
      zenActive,
      APP_CFG
    } = opts || {};
    const cfg = (APP_CFG && APP_CFG.ui && APP_CFG.ui.bloom) ? APP_CFG.ui.bloom : {};
    const allDisabled = (cfg.normalEnabled === false) && (cfg.zenEnabled === false);
    let _composer = composer || null;
    let _bloomPass = bloomPass || null;
    if (!_composer && !allDisabled) {
      try {
        const hasExamples = !!(THREE && (THREE.EffectComposer || THREE.UnrealBloomPass || THREE.RenderPass));
        if (hasExamples && THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass) {
          const comp = new THREE.EffectComposer(renderer);
          const renderPass = new THREE.RenderPass(scene, camera);
          const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(width, height), 0.6, 0.2, 0.85);
          comp.addPass(renderPass);
          comp.addPass(bloom);
          _composer = comp; _bloomPass = bloom;
        } else {
          const rt = new THREE.WebGLRenderTarget(width, height, { samples: 0 });
          
          // 优化：预创建复用对象，避免每帧 new
          const quadScene = new THREE.Scene();
          const quadCam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
          const mat = new THREE.MeshBasicMaterial({
            map: rt.texture,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false
          });
          const geo = new THREE.PlaneGeometry(2,2);
          const mesh = new THREE.Mesh(geo, mat);
          quadScene.add(mesh);

          _bloomPass = {
            setParams({ strength, threshold, radius }) { this.strength=strength; this.threshold=threshold; this.radius=radius; },
            strength: 0.6, threshold: 0.8, radius: 0.2,
            dispose() { try { rt.dispose(); geo.dispose(); mat.dispose(); } catch(_){} },
            render() {
              const oldExposure = (renderer.toneMappingExposure ?? 1.0);
              try { renderer.toneMappingExposure = oldExposure * (APP_CFG?.bloom?.fallbackBoost ?? 1.15); } catch(_){}
              renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, camera);
              renderer.setRenderTarget(null);
              try {
                mat.opacity = Math.min(1.0, this.strength);
                renderer.render(quadScene, quadCam);
              } catch(e){ console.warn('[bloom-fallback] render error', e); }
              try { renderer.toneMappingExposure = oldExposure; } catch(_){}
            }
          };
          _composer = { render(){ renderer.render(scene, camera); _bloomPass?.render?.(); } };
        }
      } catch(_){ }
    }
    if (_composer) {
      const zen = !!zenActive;
      const enabled = zen ? (cfg.zenEnabled !== false) : (cfg.normalEnabled !== false);
      if (_bloomPass && enabled) {
        const strength  = zen ? (cfg.zenStrength  ?? 0.85) : (cfg.normalStrength  ?? 0.45);
        const threshold = zen ? (cfg.zenThreshold ?? 0.7 ) : (cfg.normalThreshold ?? 0.8 );
        const radius    = zen ? (cfg.zenRadius    ?? 0.24) : (cfg.normalRadius    ?? 0.18);
        if (typeof _bloomPass.strength === 'number') { _bloomPass.strength = strength; }
        if (typeof _bloomPass.threshold === 'number') { _bloomPass.threshold = threshold; }
        if (typeof _bloomPass.radius === 'number') { _bloomPass.radius = radius; }
        if (typeof _bloomPass.setParams === 'function') { _bloomPass.setParams({ strength, threshold, radius }); }
      }
      if (enabled) _composer.render(); else renderer.render(scene, camera);
    } else {
      renderer.render(scene, camera);
    }
    return { composer: _composer, bloomPass: _bloomPass };
  } catch(e){ try { console.warn('[bloom] render failed', e); } catch(_){} return { composer: opts?.composer || null, bloomPass: opts?.bloomPass || null }; }
}