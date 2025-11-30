import { APP_CFG } from './config.js';
import { computeIncrement } from './zoom-utils.js';
import { setZoom } from './main.js';

export class ZoomManager {
  constructor(page){
    this.page = page;
    this._zoomDragging = false;
  }
  // 已移除：PC 端滚轮缩放与处理标记（不再支持）

  // 拖动预览（slider）
  changing(e){
    const val = Number(e?.detail?.value);
    if (!isNaN(val)) {
      if (!this._zoomDragging) {
        this._zoomDragging = true;
        try { this.page.__getPerfMgr?.().dragStart?.(); } catch(_){}
      }
      this.page.setData({ uiZoom: val }); setZoom(val);
    }
  }

  // 释放确认（slider）
  change(e){
    const val = Number(e?.detail?.value);
    if (!isNaN(val)) { this.page.setData({ uiZoom: val }); setZoom(val); }
    if (this._zoomDragging) {
      this._zoomDragging = false;
      try { this.page.__getPerfMgr?.().dragEnd?.(); } catch(_){}
    }
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
  pageScroll(e){
    if (!this.page?.data?.isPC) return;
    const dy = e.scrollTop - (this.page?.data?.lastPageScrollTop || 0);
    if (!dy) return;
    const k = -0.002;
    const next = (this.page?.data?.uiZoom || 1) + dy * k;
    setZoom(next);
    this.page.setData({ uiZoom: next, lastPageScrollTop: e.scrollTop });
    try { wx.pageScrollTo({ scrollTop: this.page?.data?.pageScrollAnchor || 0, duration: 0 }); } catch(_){ }
  }
}