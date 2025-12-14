export function createLightingManager(ctx){
  const { THREE, globeGroup, camera, dirLight, ambientLight, LIGHT_CFG, tweener } = ctx
  const __center = new THREE.Vector3()
  const __lightDir = new THREE.Vector3()
  let __shaderDiagNext = 0
  function updateDirLight(zenActive){
    if (zenActive) {
      const d = camera.position.length()
      globeGroup.getWorldPosition(__center)
      dirLight.position.set(__center.x + Math.max(1, d), __center.y, __center.z)
    } else {
      dirLight.position.copy(camera.position)
    }
  }
  function syncDayNightShader(mat){
    if (!mat) return
    globeGroup.getWorldPosition(__center)
    if (dirLight) { __lightDir.copy(dirLight.position).sub(__center).normalize() } else { __lightDir.set(1,0,0) }
    mat.uniforms.uLightDirWorld.value.copy(__lightDir)
    mat.uniforms.uGlobeCenterWorld.value.copy(__center)
    try { mat.uniforms.uCameraPosWorld.value.copy(camera.position) } catch(_){ }
    try { if (mat.uniforms.uTime) mat.uniforms.uTime.value = Date.now() * 0.001 } catch(_){ }
    try {
      const cfg = LIGHT_CFG.zen || {}
      if (mat.uniforms.uExposure && typeof cfg.exposure === 'number') mat.uniforms.uExposure.value = Math.min(2.5, Math.max(0.7, cfg.exposure))
      if (mat.uniforms.uDaySideGain && typeof cfg.daySideGain === 'number') mat.uniforms.uDaySideGain.value = Math.min(3.0, Math.max(0.7, cfg.daySideGain))
      if (mat.uniforms.uHighlightsRoll && typeof cfg.highlightsRoll === 'number') mat.uniforms.uHighlightsRoll.value = Math.max(0.0, Math.min(1.0, cfg.highlightsRoll))
    } catch(_){ }
    try {
      const now = Date.now()
      if (now >= __shaderDiagNext) {
        // const d = mat.uniforms?.uDayTex?.value?.uuid
        // const n = mat.uniforms?.uNightTex?.value?.uuid
        // console.log('[shader:sync]', { dayUUID: d, nightUUID: n, exp: mat.uniforms?.uExposure?.value, gain: mat.uniforms?.uDaySideGain?.value })
        __shaderDiagNext = now + 5000
      }
    } catch(_){ }
  }
  function transitionIntensity(toAmbient, toDir, dur = 600){
    if (!tweener) {
      try { if (ambientLight && typeof toAmbient === 'number') ambientLight.intensity = toAmbient } catch(_){}
      try { if (dirLight && typeof toDir === 'number') dirLight.intensity = toDir } catch(_){}
      return
    }
    const ease = t => (t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t)
    try { if (ambientLight && typeof toAmbient === 'number') tweener.to(ambientLight, { intensity: toAmbient }, dur, ease) } catch(_){}
    try { if (dirLight && typeof toDir === 'number') tweener.to(dirLight, { intensity: toDir }, dur, ease) } catch(_){}
  }
  function applyZenIntensity(){
    const a = LIGHT_CFG.zen?.ambientIntensity
    const d = LIGHT_CFG.zen?.dirLightIntensityRight
    transitionIntensity(a, d, 600)
  }
  function applyNormalIntensity(ambientBase, dirBase){
    transitionIntensity(ambientBase, dirBase, 700)
  }
  function applyZenIntensitySmooth(dur){
    const a = LIGHT_CFG.zen?.ambientIntensity
    const d = LIGHT_CFG.zen?.dirLightIntensityRight
    transitionIntensity(a, d, dur || 600)
  }
  function applyNormalIntensitySmooth(ambientBase, dirBase, dur){
    transitionIntensity(ambientBase, dirBase, dur || 700)
  }
  return { updateDirLight, syncDayNightShader, applyZenIntensity, applyNormalIntensity, applyZenIntensitySmooth, applyNormalIntensitySmooth }
}
