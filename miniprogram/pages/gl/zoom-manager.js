import { APP_CFG } from './config.js';
import { computeWheelZoom, computeIncrement } from './zoom-utils.js';
import { setZoom } from './main.js';

export class ZoomManager {
  constructor(page){
    this.page = page;
    this._lastWheelHandled = 0;
  }

  // 标记渲染层已处理滚轮，避免页面层重复触发
  markWheelHandled(){ this._lastWheelHandled = Date.now(); }

  // PC 端滚轮缩放
  wheel(e){
    const now = Date.now();
    if (now - (this._lastWheelHandled || 0) < 80) return;
    try {
      const dy = (e && e.detail) ? (e.detail.deltaY ?? 0) : 0;
      if (dy !== 0) {
        const minZ = (APP_CFG?.camera?.minZoom ?? 0.6);
        const maxZ = (APP_CFG?.camera?.maxZoom ?? 2.86);
        const next = computeWheelZoom(this.page.data.uiZoom, dy, minZ, maxZ, 0.08);
        if (next !== this.page.data.uiZoom) { this.page.setData({ uiZoom: next }); setZoom(next); }
      }
    } catch(_){}
    if (this.page.data.scrollTop !== 0) this.page.setData({ scrollTop: 0 });
  }

  // 拖动预览（slider）
  changing(e){
    const val = Number(e?.detail?.value);
    if (!isNaN(val)) { this.page.setData({ uiZoom: val }); setZoom(val); }
  }

  // 释放确认（slider）
  change(e){
    const val = Number(e?.detail?.value);
    if (!isNaN(val)) { this.page.setData({ uiZoom: val }); setZoom(val); }
  }

  // + 按钮
  plus(){
    const maxZ = (APP_CFG?.camera?.maxZoom ?? 2.2);
    const next = computeIncrement(this.page.data.uiZoom, +0.08, Number.NEGATIVE_INFINITY, maxZ);
    this.page.setData({ uiZoom: next }); setZoom(next);
  }

  // - 按钮
  minus(){
    const minZ = (APP_CFG?.camera?.minZoom ?? 0.6);
    const next = computeIncrement(this.page.data.uiZoom, -0.08, minZ, Number.POSITIVE_INFINITY);
    this.page.setData({ uiZoom: next }); setZoom(next);
  }
}