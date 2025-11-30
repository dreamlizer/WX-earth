import { DRAG_BASE_STEP, DRAG_ZOOM_MIN, DRAG_SPEED_EXP, DRAG_SPEED_SCALE } from './label-constants.js'

export function createGestureManager(ctx){
  const {
    THREE,
    touch,
    zoomRef,
    setZoom,
    clampZoom,
    updateCamDist,
    camera,
    baseDist,
    zenActiveRef,
    debugLog,
    debugDetail,
    logThrottleMs,
  } = ctx

  const onTouchStart = (e) => {
    const ts = e.touches || []
    if (ts.length >= 2) {
      if (zenActiveRef()) { touch.pinch = false; return }
      const d = Math.hypot(ts[0].x - ts[1].x, ts[0].y - ts[1].y)
      touch.pinch = true; touch.pinchStartDist = d; touch.pinchStartZoom = zoomRef()
      touch.isDragging = false; touch.velX = 0; touch.velY = 0
      return
    }
    const t = ts[0]
    if (!t || typeof t.x !== 'number' || typeof t.y !== 'number' || !isFinite(t.x) || !isFinite(t.y)) return
    try {
      const moving = (Math.abs(touch.velX) > 0.0002) || (Math.abs(touch.velY) > 0.0002)
      if (moving && !touch.pinch) { touch.velX = 0; touch.velY = 0; if (debugLog) console.log('[inertia:stop-by-touch]') }
    } catch(_){}
    touch.isDragging = true; touch.lastX = t.x; touch.lastY = t.y; touch.downX = t.x; touch.downY = t.y; touch.downTime = Date.now()
  }

  const onTouchMove = (e) => {
    const ts = e.touches || []
    if (ts.length >= 2 && touch.pinch && typeof touch.pinchStartDist === 'number') {
      if (zenActiveRef()) return
      const d = Math.hypot(ts[0].x - ts[1].x, ts[0].y - ts[1].y)
      if (d > 0) {
        const ratio = d / touch.pinchStartDist
        const nextZoom = clampZoom(touch.pinchStartZoom * ratio)
        setZoom(nextZoom)
        updateCamDist(camera, baseDist, nextZoom)
      }
      return
    }
    const t = ts[0]; if (!t || !touch.isDragging) return
    if (typeof t.x !== 'number' || typeof t.y !== 'number' || !isFinite(t.x) || !isFinite(t.y)) return
    const dx = t.x - touch.lastX, dy = t.y - touch.lastY; touch.lastX = t.x; touch.lastY = t.y
    const MAP = touch.isPC ? { dx: -1, dy: 1 } : { dx: -1, dy: 1 }
    const baseStep = DRAG_BASE_STEP
    const speedScale = Math.pow(Math.max(DRAG_ZOOM_MIN, zoomRef()), DRAG_SPEED_EXP) * DRAG_SPEED_SCALE
    const stepY = -MAP.dx * dx * baseStep * speedScale
    const stepX =  MAP.dy * dy * baseStep * speedScale
    touch.rotY += stepY
    if (!zenActiveRef()) touch.rotX += stepX
    const gain = 1 + (touch.inertiaGain || 0)
    touch.velY = Math.max(-touch.maxSpeed, Math.min(touch.maxSpeed, touch.velY * 0.8 + stepY * 0.2 * gain))
    touch.velX = Math.max(-touch.maxSpeed, Math.min(touch.maxSpeed, zenActiveRef() ? 0 : (touch.velX * 0.8 + stepX * 0.2 * gain)))
    touch.rotX = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, zenActiveRef() ? 0 : touch.rotX))
    try {
      if (debugLog && debugDetail) {
        const now = Date.now()
        if (!touch.__lastDragLogAt || (now - touch.__lastDragLogAt) > (logThrottleMs || 120)) {
          console.log('[inertia:drag]', {
            dx: Number(dx.toFixed(2)), dy: Number(dy.toFixed(2)),
            stepX: Number(stepX.toFixed(5)), stepY: Number(stepY.toFixed(5)),
            velX: Number(touch.velX.toFixed(5)), velY: Number(touch.velY.toFixed(5)),
            gain: Number(gain.toFixed(3)), maxSpeed: Number(touch.maxSpeed.toFixed(3)),
            damping: Number(touch.damping.toFixed(5)), zoom: Number(zoomRef().toFixed(3))
          })
          touch.__lastDragLogAt = now
        }
      }
    } catch(_){}
  }

  const onTouchEndRelease = () => {
    if (touch.pinch) { touch.pinch = false; return }
    try {
      if (debugLog && debugDetail) {
        touch.releaseVelX = touch.velX; touch.releaseVelY = touch.velY; touch.releaseAt = Date.now()
        console.log('[inertia:release]', {
          velX: Number(touch.releaseVelX.toFixed(5)), velY: Number(touch.releaseVelY.toFixed(5)),
          speed: Number(Math.hypot(touch.releaseVelX, touch.releaseVelY).toFixed(5)),
          damping: Number(touch.damping.toFixed(5)), maxSpeed: Number(touch.maxSpeed.toFixed(3)),
          gain: Number((1 + (touch.inertiaGain || 0)).toFixed(3)), zoom: Number(zoomRef().toFixed(3))
        })
      }
    } catch(_){}
  }

  return { onTouchStart, onTouchMove, onTouchEndRelease }
}