// 职责：统一管理页面的小型设置开关（夜间模式/云层显示等）
// 说明：页面仅负责事件转发，具体状态更新与渲染层调用在此集中处理

import { setNightMode, setCloudVisible, setInertia, setBrightnessScale, refreshTextures } from './main.js';
import { APP_CFG } from './config.js';
import { clearZenAudioSaved } from './zen-audio.js';

export class SettingsManager {
  constructor(page){
    this.page = page;
    this._pillTapCount = 0;
    this._pillTapTimer = null;
  }

  // —— 时间胶囊点击：关闭面板 + 5连击刷新资源 ——
  onTimePillTap(){
    try {
      // 尝试关闭面板
      try { this.page.__getPanelMgr()?.fadeOutOpenPanels?.(); } catch(_){ }
      try { this.page.setData({ hoverText: '' }); } catch(_){ }
      
      // 5连击彩蛋：刷新资源
      if (!this.page.data.zenMode) {
        this._pillTapCount = (this._pillTapCount || 0) + 1;
        clearTimeout(this._pillTapTimer);
        this._pillTapTimer = setTimeout(() => { this._pillTapCount = 0; }, 2000);
        
        if (this._pillTapCount >= 5) {
          this._pillTapCount = 0;
          clearTimeout(this._pillTapTimer);
          this.refreshAssets();
        }
      }
    } catch(e){ console.warn('[Settings] pill tap error:', e); }
  }

  // 5连击彩蛋逻辑：清除缓存并刷新纹理
  refreshAssets(){
    try {
      wx.showToast({ title: 'Refreshing...', icon: 'none' });
      try { clearZenAudioSaved(); } catch(_){}
      setTimeout(() => {
        try { refreshTextures(); } catch(_){}
      }, 200);
    } catch(_){ }
  }

  // 统一入口：处理 data-key/data-val 的开关
  toggleOption({ key, on }){
    const next = !!on;
    if (key === 'nightMode') {
      this.page.setData({ nightMode: next });
      setNightMode(next);
    } else if (key === 'showCloud') {
      this.page.setData({ showCloud: next });
      setCloudVisible(next);
    }
    // 开关类通常不影响顶栏布局；如后续有影响可在此调用
    try { this.page.updateTopOffsets?.(); } catch(_){}
  }

  // 单独入口：云层开关
  toggleCloud(on){
    const next = !!on;
    this.page.setData({ showCloud: next });
    setCloudVisible(next);
    try { this.page.updateTopOffsets?.(); } catch(_){}
  }

  // 滑条入口：惯性（0-100），映射到渲染层
  setInertia(pct){
    const v = Math.max(0, Math.min(100, Number(pct) || 0));
    this.page.setData({ inertiaPct: v });
    try { setInertia(v); } catch(_){}
  }

  // —— 亮度竖条触控 ——
  onBrightnessTouchStart(e){
    if (this.page.data.zenMode) return;
    try { this.page.__getPanelMgr()?.fadeOutOpenPanels?.(); } catch(_){ }
    this.page.__brightnessActive = true;
    try {
      const t = (e?.touches && e.touches[0]) || (e?.changedTouches && e.changedTouches[0]);
      if (!t) return;
      const y = Number(t.clientY || t.pageY || t.y || 0);
      this.page.__brightStartY = y;
      this.page.__brightStartScale = Number(this.page.data.brightnessScale || 1);
      this.page.__brightMoved = false;
    } catch(_){ }
  }

  onBrightnessTouchMove(e){
    if (!this.page.__brightnessActive || this.page.data.zenMode) return;
    try {
      const t = (e?.touches && e.touches[0]) || (e?.changedTouches && e.changedTouches[0]);
      if (!t) return;
      const y = Number(t.clientY || t.pageY || t.y || 0);
      const h = Math.max(1, Number(this.page.data.brightnessSensorHeight || 1));
      const dy = Number(this.page.__brightStartY || y) - y; // 上为正
      if (Math.abs(dy) < 4) return; // 点击无效（需拖动）
      this.page.__brightMoved = true;
      const minV = Number(APP_CFG?.brightness?.min ?? 0.5);
      const maxV = Number(APP_CFG?.brightness?.max ?? 1.4);
      const range = Math.max(0, maxV - minV);
      const coef = range / h;
      const base = Number(this.page.__brightStartScale || APP_CFG?.brightness?.default || 1);
      const scale = Math.max(minV, Math.min(maxV, base + dy * coef));
      this.page.setData({ brightnessScale: scale });
      try { setBrightnessScale(scale); } catch(_){ }
    } catch(_){ }
  }

  onBrightnessTouchEnd(){ this.page.__brightnessActive = false; }

  // —— 资源刷新/重置 ——
  async refreshAssets(){
    try {
      try { refreshTextures(); } catch(_){}
      try { clearZenAudioSaved(); } catch(_){}
      try { await this.page.__getZenMgr().ensureOffline(); } catch(_){}
      try { console.info('[assets] refreshed by time pill'); } catch(_){}
    } catch(_){ }
  }
}