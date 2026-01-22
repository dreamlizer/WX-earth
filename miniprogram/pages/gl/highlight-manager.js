import { convertLatLonToVec3 } from './geography.js'

export function createHighlightManager(ctx){
  const { THREE, globeGroup, camera, APP_CFG, highlightLayer, RADIUS, onAutoCleared } = ctx
  let group = null
  let fading = null
  let fadeEnd = 0
  let feature = null
  let lastCheck = 0
  let belowCount = 0

  const dispose = (grp) => {
    if (!grp) return
    grp.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); })
  }

  const estimateFrontRatio = (f) => {
    if (!f || !globeGroup || !camera) return 1.0
    try {
      const center = new THREE.Vector3(); globeGroup.getWorldPosition(center)
      const camPos = camera.position.clone()
      let total = 0, front = 0
      const addPoint = (lon, lat) => {
        const v = convertLatLonToVec3(lon, lat, RADIUS + 0.001)
        const p = new THREE.Vector3(v.x, v.y, v.z)
        try { p.applyQuaternion(globeGroup.quaternion) } catch(_){}
        const worldP = p.add(center)
        const normal = worldP.clone().sub(center).normalize()
        const viewDir = camPos.clone().sub(worldP).normalize()
        const dot = normal.dot(viewDir)
        if (dot > 0) front++
        total++
      }
      const cs = f.coords || []
      if (f.type === 'Polygon') {
        for (let i = 0; i < cs.length; i++) {
          const ring = cs[i] || []
          for (let j = 0; j < ring.length; j++) {
            const p = ring[j]; if (!p || p.length < 2) continue
            addPoint(p[0], p[1])
          }
        }
      } else if (f.type === 'MultiPolygon') {
        for (let k = 0; k < cs.length; k++) {
          const poly = cs[k] || []
          for (let i = 0; i < poly.length; i++) {
            const ring = poly[i] || []
            for (let j = 0; j < ring.length; j++) {
              const p = ring[j]; if (!p || p.length < 2) continue
              addPoint(p[0], p[1])
            }
          }
        }
      }
      return (total > 0) ? (front / total) : 1.0
    } catch(_){ return 1.0 }
  }

  const setHighlight = (f) => {
    if (group && !f) {
      try {
        const fadeMs = Math.max(0, Number(APP_CFG?.highlight?.fadeOutMs || 500))
        fading = group
        fadeEnd = Date.now() + fadeMs
        fading.traverse(obj => {
          const m = obj?.material; if (!m) return
          try { m.transparent = true; m.opacity = (typeof m.opacity === 'number') ? m.opacity : 1.0; m.needsUpdate = true } catch(_){}
        })
      } catch(_){}
      group = null
    } else if (group) {
      dispose(group); globeGroup.remove(group); group = null
    }
    feature = f || null
    belowCount = 0
    if (!f) return
    const container = new THREE.Group()
    const addOne = (feat) => {
      if (!feat) return
      try { const grp = highlightLayer(THREE, globeGroup, feat); if (grp) container.add(grp) } catch(_){}
    }
    if (Array.isArray(f)) { for (const feat of f) addOne(feat) } else { addOne(f) }
    globeGroup.add(container)
    group = container
  }

  const updatePerFrame = (now) => {
    try {
      if (fading) {
        const fadeMs = Math.max(0, Number(APP_CFG?.highlight?.fadeOutMs || 500))
        const rest = Math.max(0, fadeEnd - now)
        const t = fadeMs > 0 ? (rest / fadeMs) : 0
        fading.traverse(obj => {
          const m = obj?.material; if (!m) return
          try { m.transparent = true; const base = (typeof m.opacity === 'number') ? m.opacity : 1.0; m.opacity = Math.max(0, Math.min(1, t * base)); m.needsUpdate = true } catch(_){}
        })
        if (rest <= 0) { try { globeGroup.remove(fading); dispose(fading) } catch(_){} fading = null; fadeEnd = 0 }
      }
    } catch(_){}
    try {
      const ac = (APP_CFG?.highlight?.autoClearOnBackside || {})
      const enabled = !!ac.enabled
      const interval = Math.max(200, Number(ac.checkIntervalMs || 500))
      const minVisible = Math.max(0.0, Math.min(1.0, Number(ac.minVisibleRatio || 0.10)))
      if (enabled && feature) {
        if ((now - lastCheck) >= interval) {
          lastCheck = now
          const ratio = estimateFrontRatio(feature)
          if (ratio <= minVisible) { belowCount++ } else { belowCount = 0 }
          const requireStreak = Math.max(1, Number(ac.requireConsecutive || 2))
          if (belowCount >= requireStreak) { setHighlight(null); try { onAutoCleared && onAutoCleared() } catch(_){} }
        }
      }
    } catch(_){}
  }

  return { setHighlight, updatePerFrame }
}