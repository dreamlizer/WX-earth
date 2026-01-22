
import { PERF_DIAG_LOG } from './label-constants.js';

export class PerfMonitor {
  constructor() {
    this.prevRenderTime = 0;
    this.fpsWindow = [];
    this.fpsLogNext = 0;
  }

  /**
   * 更新性能监控
   * @param {number} now 当前时间戳
   * @returns {number} 距离上一帧的秒数 (dtSec)
   */
  update(now) {
    const dtSec = this.prevRenderTime ? Math.max(0, Math.min(0.12, (now - this.prevRenderTime) / 1000)) : 0;
    
    if (this.prevRenderTime) {
      const fps = dtSec > 0 ? (1 / dtSec) : 0;
      const dtMs = now - this.prevRenderTime;
      this.fpsWindow.push({ fps, dtMs });
      if (this.fpsWindow.length > 240) this.fpsWindow.shift();
    }

    if (PERF_DIAG_LOG && now >= this.fpsLogNext) {
      this.fpsLogNext = now + 3000;
      this.log();
    }

    this.prevRenderTime = now;
    return dtSec;
  }

  log() {
    const arr = this.fpsWindow.slice();
    if (arr.length >= 10) {
      const fpsVals = arr.map(x => x.fps).filter(x => isFinite(x) && x > 0).sort((a,b)=>a-b);
      // const dtVals = arr.map(x => x.dtMs).filter(x => isFinite(x) && x > 0).sort((a,b)=>a-b);
      const avg = fpsVals.reduce((s,v)=>s+v,0)/fpsVals.length;
      const p95 = fpsVals[Math.min(fpsVals.length-1, Math.floor(fpsVals.length*0.95))];
      const min = fpsVals[0];
      const max = fpsVals[fpsVals.length-1];
      const slow33 = arr.filter(x => x.dtMs > 33).length;
      const slow50 = arr.filter(x => x.dtMs > 50).length;
      try { 
        console.info('[perf] fps', { 
          avg: Number(avg.toFixed(1)), 
          p95: Number(p95.toFixed(1)), 
          min: Number(min.toFixed(1)), 
          max: Number(max.toFixed(1)), 
          frames: arr.length, 
          slow33, 
          slow50 
        });
      } catch(_){ }
    }
    this.fpsWindow = [];
  }

  reset() {
    this.prevRenderTime = 0;
    this.fpsWindow = [];
  }
}

export function createPerfMonitor() {
  return new PerfMonitor();
}
