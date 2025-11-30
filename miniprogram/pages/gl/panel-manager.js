import { onTouchStart, onTouchMove } from './main.js';

export class PanelManager {
  constructor(page){ this.page = page; }

  // 顶部“设定”按钮：关闭国家面板，打开设定面板
  toggleSettings(){
    const alreadyOpen = !!(this.page?.data?.settingsOpen);
    if (alreadyOpen) {
      this.closeSettings();
      return;
    }
    try { this.page.onCloseCountryPanel?.(); }
    catch(_){ try { this.page.setData({ countryPanelOpen: false, hoverText: '' }); } catch(__){} }
    this.page.setData({ settingsOpen: true });
    try { setTimeout(() => { try { this.page.updateSettingsPanelFrame && this.page.updateSettingsPanelFrame(); } catch(_){ } }, 16); } catch(_){ }
  }
  // 关闭设定面板
  closeSettings(){
    try {
      if (this.page?.data?.settingsOpen) {
        const ms = Number(this.page?.data?.panelFadeMs || 500);
        this.page.setData({ settingsFading: true });
        setTimeout(() => { try { this.page.setData({ settingsOpen: false, settingsFading: false }); this.page.updateTopOffsets && this.page.updateTopOffsets(); } catch(_){ } }, ms);
      }
    } catch(_){ }
  }

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
  closePendingPanels(){
    try {
      if (this.page.__pendingPanelsClose) {
        const ms = Number(this.page?.data?.panelFadeMs || 500);
        const needSettings = !!(this.page?.data?.settingsOpen);
        const needCountry = !!(this.page?.data?.countryPanelOpen);
        const updates = { hoverText: '' };
        if (needSettings) updates.settingsFading = true;
        if (needCountry) updates.countryPanelFading = true;
        this.page.setData(updates);
        setTimeout(() => {
          try {
            const next = { hoverText: '' };
            if (needSettings) { next.settingsOpen = false; next.settingsFading = false; }
            if (needCountry) { next.countryPanelOpen = false; next.countryPanelFading = false; }
            next.searchOpen = false;
            this.page.setData(next);
            this.page.updateTopOffsets && this.page.updateTopOffsets();
          } catch(_){ }
        }, ms);
        this.page.__pendingPanelsClose = false;
      }
    } catch(_){}
  }

  fadeOutOpenPanels(){
    try {
      const hasOpen = !!(this.page?.data?.settingsOpen || this.page?.data?.countryPanelOpen);
      if (!hasOpen) return;
      const ms = Number(this.page?.data?.panelFadeMs || 500);
      const updates = { hoverText: '' };
      if (this.page?.data?.settingsOpen) updates.settingsFading = true;
      if (this.page?.data?.countryPanelOpen) updates.countryPanelFading = true;
      this.page.setData(updates);
      setTimeout(() => {
        try {
          this.page.setData({ settingsOpen: false, countryPanelOpen: false, settingsFading: false, countryPanelFading: false });
          this.page.updateTopOffsets && this.page.updateTopOffsets();
        } catch(_){ }
      }, ms);
    } catch(_){ }
  }
}
