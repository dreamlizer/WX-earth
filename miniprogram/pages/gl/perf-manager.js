import { setPerfMode as setLabelsPerfMode } from './labels.js'
import { setPerfMode as setGlPerfMode } from './main.js'
import { setCityMarkersVisible } from './city-markers.js'
import { PERF_HIDE_MARKERS_ON_DRAG, PERF_DRAG_RESTORE_IDLE_MS } from './label-constants.js'

export class PerfManager {
  constructor(page){
    this.page = page
    this._timer = null
  }

  dragStart(){
    try { this.page.__perfDrag = true } catch(_){}
    try { clearTimeout(this._timer) } catch(_){}
    try { setLabelsPerfMode(true) } catch(_){}
    try { setGlPerfMode('drag') } catch(_){}
    try { if (PERF_HIDE_MARKERS_ON_DRAG) setCityMarkersVisible(false) } catch(_){}
  }

  dragEnd(){
    const delay = Math.max(100, Number(PERF_DRAG_RESTORE_IDLE_MS || 500))
    try { clearTimeout(this._timer) } catch(_){}
    this._timer = setTimeout(() => {
      try { this.page.__perfDrag = false } catch(_){}
      try { setLabelsPerfMode(false) } catch(_){}
      try { setGlPerfMode('normal') } catch(_){}
      try { if (PERF_HIDE_MARKERS_ON_DRAG) setCityMarkersVisible(true) } catch(_){}
    }, delay)
  }
}