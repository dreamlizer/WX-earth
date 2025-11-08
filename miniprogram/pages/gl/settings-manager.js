// 职责：统一管理页面的小型设置开关（夜间模式/云层显示等）
// 说明：页面仅负责事件转发，具体状态更新与渲染层调用在此集中处理

export class SettingsManager {
  constructor({
    setData = () => {},
    updateTopOffsets = () => {},
    setNightMode = () => {},
    setCloudVisible = () => {},
    setInertia = () => {},
  } = {}){
    this.setData = setData;
    this.updateTopOffsets = updateTopOffsets;
    this.setNightMode = setNightMode;
    this.setCloudVisible = setCloudVisible;
    this.setInertiaCb = setInertia;
  }

  // 统一入口：处理 data-key/data-val 的开关
  toggleOption({ key, on }){
    const next = !!on;
    if (key === 'nightMode') {
      this.setData({ nightMode: next });
      this.setNightMode(next);
    } else if (key === 'showCloud') {
      this.setData({ showCloud: next });
      this.setCloudVisible(next);
    }
    // 开关类通常不影响顶栏布局；如后续有影响可在此调用
    try { this.updateTopOffsets?.(); } catch(_){}
  }

  // 单独入口：云层开关
  toggleCloud(on){
    const next = !!on;
    this.setData({ showCloud: next });
    this.setCloudVisible(next);
    try { this.updateTopOffsets?.(); } catch(_){}
  }

  // 滑条入口：惯性（0-100），映射到渲染层
  setInertia(pct){
    const v = Math.max(0, Math.min(100, Number(pct) || 0));
    this.setData({ inertiaPct: v });
    try { this.setInertiaCb?.(v); } catch(_){}
  }
}