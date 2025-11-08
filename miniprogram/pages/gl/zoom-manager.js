import { APP_CFG } from './config.js';
import { computeIncrement } from './zoom-utils.js';
import { setZoom } from './main.js';

export class ZoomManager {
  constructor(page){
    this.page = page;
  }
  // 已移除：PC 端滚轮缩放与处理标记（不再支持）

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