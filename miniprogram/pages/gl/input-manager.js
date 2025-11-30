import { createGestureManager } from './gesture-manager.js'
import { SelectionManager } from './selection-manager.js'
import { TAP_MAX_MOVE_PX, TAP_MAX_DURATION_MS } from './label-constants.js'

export function createInputManager(ctx){
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
    raycaster,
    width,
    height,
    globeGroup,
    earthMeshRef,
    colliderGroupRef,
    RADIUS,
    countryFeaturesRef,
    searchRef,
    highlight,
    page,
    tzMgr,
    debugLog,
    debugDetail,
    logThrottleMs,
    debugSelect,
    lonSameSign,
  } = ctx

  const gesture = createGestureManager({
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
  })

  const selMgr = new SelectionManager({
    THREE,
    raycaster,
    camera,
    globeGroup,
    RADIUS,
    earthMeshRef,
    colliderGroupRef,
    countryFeaturesRef,
    searchRef,
    debugSelect,
    debugLog,
    lonSameSign,
    zoomRef,
  })

  const onTouchStart = (e) => { gesture.onTouchStart(e) }

  const onTouchMove = (e) => { gesture.onTouchMove(e) }

  const onTouchEnd = () => {
    gesture.onTouchEndRelease()
    const isTap = (Date.now()-touch.downTime) <= TAP_MAX_DURATION_MS && Math.hypot(touch.lastX-touch.downX, touch.lastY-touch.downY) <= TAP_MAX_MOVE_PX
    touch.isDragging = false; if (!isTap) return
    const res = selMgr.tap({ downX: touch.downX, downY: touch.downY, width, height })
    const hit = res && res.hit ? res.hit : null
    const lon = res ? res.lon : undefined
    const lat = res ? res.lat : undefined
    if (!res || !hit) {
      try { highlight && highlight.setHighlight && highlight.setHighlight(null) } catch(_){}
      try { page && (page.selectedTimezone = null) } catch(_){}
      try { page && page.setData && page.setData({ hoverText: '' }) } catch(_){}
      try { page && page.updateTopOffsets && page.updateTopOffsets() } catch(_){}
      try { page && (page.lastTimeUpdate = 0) } catch(_){}
      try { page && page.onCountryPicked && page.onCountryPicked(null) } catch(_){}
      return
    }
    try { highlight && highlight.setHighlight && highlight.setHighlight(res.highlightTargets) } catch(_){}
    try { page && page.onCountryPicked && page.onCountryPicked(hit) } catch(_){}
    if (debugLog) {
      try {
        const name = (hit && hit.props) ? (hit.props.NAME || hit.props.ADMIN || '(unknown)') : '(unknown)'
        console.log('[select] country:', name, 'at', Number(lon).toFixed(4), Number(lat).toFixed(4))
      } catch(_){}
    }
    try { tzMgr && tzMgr.updateAfterSelection && tzMgr.updateAfterSelection(hit, lat, lon) } catch(_){ }
  }

  return { onTouchStart, onTouchMove, onTouchEnd }
}