import { onTouchStart, onTouchMove } from './main.js';

export class PanelManager {
  constructor(page){ this.page = page; }

  // 顶部“设定”按钮：关闭国家面板，打开设定面板
  toggleSettings(){
    this.page.setData({ countryPanelOpen: false, settingsOpen: true });
    try { setTimeout(() => { try { this.page.updateSettingsPanelFrame && this.page.updateSettingsPanelFrame(); } catch(_){ } }, 16); } catch(_){ }
  }
  // 关闭设定面板
  closeSettings(){ if (this.page.data.settingsOpen) this.page.setData({ settingsOpen: false }); }

  // 国家面板触摸：不立即关闭，转交事件，设置待关闭标记
  panelTouchStart(e){
    try { const en = this.page.__normalizeToCanvasTouches(e); onTouchStart(en); } catch(_){}
    this.page.__panelClosing = true;
    this.page.__pendingPanelsClose = true;
  }
  panelTouchMove(e){
    this.page.__panelClosing = false;
    try { const en = this.page.__normalizeToCanvasTouches(e); onTouchMove(en); } catch(_){}
  }

  // 遮罩层触摸：不立即关闭，转交事件，设置待关闭标记
  maskTouchStart(e){
    try { const en = this.page.__normalizeToCanvasTouches(e); onTouchStart(en); } catch(_){}
    this.page.__maskClosing = true;
    this.page.__pendingPanelsClose = true;
  }
  maskTouchMove(e){
    this.page.__maskClosing = false;
    try { const en = this.page.__normalizeToCanvasTouches(e); onTouchMove(en); } catch(_){}
  }
}