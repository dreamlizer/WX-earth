import { convertLatLonToVec3, convertVec3ToLatLon } from './geography.js'

export function createFlyManager(ctx){
  const { THREE, globeGroup, camera, RADIUS, touch, DEBUG } = ctx
  let __fly = null
  let __pathFx = null
  let __flyProbeUntil = 0
  let __flyProbeLast = 0

  const wrap = (a) => {
    let x = a
    while (x > Math.PI) x -= Math.PI * 2
    while (x < -Math.PI) x += Math.PI * 2
    return x
  }

  const flyTo = (lat, lon, duration = 800) => {
    try {
      if (typeof lat !== 'number' || typeof lon !== 'number') return
      const tLat = DEBUG?.invertLat ? -lat : lat
      const tLon = DEBUG?.invertLon ? -lon : lon
      const deg2rad = (d) => (d||0) * Math.PI / 180
      const rawTx = tLat
      const tx = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, tLat - deg2rad(DEBUG?.calibLatDeg || 0)))
      const rawLonRotTarget = (-(tLon) - Math.PI/2)
      const lonRotTarget = (rawLonRotTarget - ((DEBUG?.calibLonDeg||0) * Math.PI/180))
      const dy = wrap(lonRotTarget - touch.rotY)
      const ty = touch.rotY + dy
      __fly = { sx: touch.rotX, sy: touch.rotY, tx, ty, t0: Date.now(), dur: Math.max(200, Math.min(3000, duration)) }
      try {
        const v0 = new THREE.Vector3(0, 0, RADIUS)
        v0.applyEuler(new THREE.Euler(touch.rotX, touch.rotY, 0, 'XYZ'))
        const [curLon, curLat] = convertVec3ToLatLon(v0.x, v0.y, v0.z)
        const s0 = convertLatLonToVec3(curLon, curLat, 1)
        const e0 = convertLatLonToVec3(tLon, tLat, 1)
        const s = new THREE.Vector3(s0.x, s0.y, s0.z).normalize()
        const e = new THREE.Vector3(e0.x, e0.y, e0.z).normalize()
        const dot = Math.max(-1, Math.min(1, s.dot(e)))
        const omega = Math.acos(dot)
        const segs = Math.max(48, Math.min(160, Math.round(96 * (1 + Math.abs(omega) / (Math.PI/2)))))
        const pos = new Float32Array((segs + 1) * 3)
        const radius = RADIUS * 1.015
        for (let i = 0; i <= segs; i++) {
          const t = i / segs
          const a = Math.sin((1 - t) * omega) / Math.sin(Math.max(1e-6, omega))
          const b = Math.sin(t * omega) / Math.sin(Math.max(1e-6, omega))
          const p = new THREE.Vector3(
            s.x * a + e.x * b,
            s.y * a + e.y * b,
            s.z * a + e.z * b
          ).multiplyScalar(radius)
          pos[i*3+0] = p.x; pos[i*3+1] = p.y; pos[i*3+2] = p.z
        }
        const pts = []
        for (let i = 0; i <= segs; i++) {
          const idx = i * 3
          pts.push(new THREE.Vector3(pos[idx+0], pos[idx+1], pos[idx+2]))
        }
        const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.6)
        const tubularSegments = Math.max(80, Math.min(360, segs * 2))
        const tubeRadius = 0.006
        const radialSegments = 8
        const geo = new THREE.TubeGeometry(curve, tubularSegments, tubeRadius, radialSegments, false)
        const mat = new THREE.MeshBasicMaterial({ color: 0x99ddff, transparent: true, opacity: 0.0 })
        mat.depthTest = false; mat.depthWrite = false
        const mesh = new THREE.Mesh(geo, mat)
        mesh.renderOrder = 998
        try { if (__pathFx && __pathFx.mesh) { globeGroup.remove(__pathFx.mesh); __pathFx.mesh.geometry?.dispose?.(); __pathFx.mesh.material?.dispose?.(); } } catch(_){ }
        globeGroup.add(mesh)
        __pathFx = { mesh, t0: Date.now(), dur: Math.max(duration + 1000, 2400) }
        try {
          if (DEBUG?.logFly) {
            const v = new THREE.Vector3(0, 0, RADIUS)
            v.applyEuler(new THREE.Euler(tx, ty, 0, 'XYZ'))
            const [expLon, expLat] = convertVec3ToLatLon(v.x, v.y, v.z)
            const dTxDeg = (tx - rawTx) * 180 / Math.PI
            const dTyDeg = (lonRotTarget - rawLonRotTarget) * 180 / Math.PI
            console.log('[flyTo]', 'in(rad) lat=', lat.toFixed(4), 'lon=', lon.toFixed(4), 'tLat=', tLat.toFixed(4), 'tLon=', tLon.toFixed(4), 'tx=', tx.toFixed(4), 'ty=', ty.toFixed(4), 'calibLonDeg=', DEBUG?.calibLonDeg, 'calibLatDeg=', DEBUG?.calibLatDeg, 'dTx(deg)=', dTxDeg.toFixed(3), 'dTy(deg)=', dTyDeg.toFixed(3), 'expCenter lon=', expLon.toFixed(4), 'lat=', expLat.toFixed(4), 'from rotX=', __fly.sx.toFixed(4), 'rotY=', __fly.sy.toFixed(4))
          }
          __flyProbeUntil = Date.now() + Math.max(800, Math.min(2000, duration + 400))
          __flyProbeLast = 0
        } catch(_){ }
      } catch(_){ }
    } catch(_){ }
  }

  const advanceFlight = (now) => {
    if (!__fly) return false
    const { sx, sy, tx, ty, t0, dur } = __fly
    const t = Math.max(0, Math.min(1, (now - t0) / Math.max(1, dur)))
    const ease = (x) => x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3)/2
    const k = ease(t)
    const nx = sx + (tx - sx) * k
    const ny = sy + (ty - sy) * k
    touch.rotX = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, nx))
    touch.rotY = ny
    touch.velX = 0; touch.velY = 0
    if (t >= 1) { __fly = null }
    return true
  }

  const updateFx = (now) => {
    try {
      if (__pathFx && __pathFx.mesh && __pathFx.mesh.material) {
        const age = now - (__pathFx.t0 || 0)
        const dur = Math.max(400, __pathFx.dur || 1000)
        const fadeStart = Math.min(dur * 0.6, dur - 220)
        let alpha = 0.6
        if (age < 220) {
          const k = Math.max(0, Math.min(1, age / 220))
          alpha = 0.12 + 0.48 * k
        }
        if (age >= fadeStart) {
          const t = Math.max(0, Math.min(1, (age - fadeStart) / Math.max(1, (dur - fadeStart + 300))))
          alpha = 0.6 * (1 - t)
        }
        __pathFx.mesh.material.opacity = Math.max(0, Math.min(0.75, alpha))
        __pathFx.mesh.visible = alpha > 0.02
        if (age > dur + 800) {
          try { globeGroup.remove(__pathFx.mesh); __pathFx.mesh.geometry?.dispose?.(); __pathFx.mesh.material?.dispose?.(); } catch(_){ }
          __pathFx = null
        }
      }
    } catch(_){ }
  }

  const cancel = () => { __fly = null }

  const isFlying = () => !!__fly

  const dispose = () => {
    cancel()
    try { if (__pathFx && __pathFx.mesh) { globeGroup.remove(__pathFx.mesh); __pathFx.mesh.geometry?.dispose?.(); __pathFx.mesh.material?.dispose?.(); } } catch(_){ }
    __pathFx = null
  }

  return { flyTo, advanceFlight, updateFx, cancel, isFlying, dispose }
}