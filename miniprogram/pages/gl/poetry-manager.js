// 职责：管理禅定诗句的显示与切换（DOM层或3D层），与页面事件/状态解耦。
// 依赖通过构造函数注入，以便在页面外部独立测试与复用。

import { computeStartNearCenter, computeMove, nearbyFrom } from './poetry-motion.js';
const __computeStartCenterEn = (vpW, vpH, w, h, margin) => {
  let x = (vpW - w) / 2;
  if (w > vpW * 0.8) x = Math.max(margin, Math.min(x, vpW - w - margin));
  const yCenter = vpH * 0.25 + Math.random() * vpH * 0.15;
  const y = Math.max(margin, Math.min(yCenter, vpH - h - margin));
  return { x, y };
};

export class PoetryManager {
  constructor({
    appCfg = {},
    getViewport = () => ({ windowWidth: 0, windowHeight: 0 }),
    getCanvasRect = () => null,
    measure = async () => ({ width: 0, height: 0 }),
    setData = () => {},
    startPoetry3D = () => {},
    stopPoetry3D = () => {},
    getLang = () => 'zh',
    computeStartNearCenterImpl,
    computeMoveImpl,
    nearbyFromImpl
  } = {}){
    this.appCfg = appCfg;
    this.getViewport = getViewport;
    this.getCanvasRect = getCanvasRect;
    this.measure = measure;
    this.setData = setData;
    this.startPoetry3D = startPoetry3D;
    this.stopPoetry3D = stopPoetry3D;
    this.getLang = getLang;
    // 允许外部覆盖纯函数实现，默认使用模块内实现
    this.computeStartNearCenter = computeStartNearCenterImpl || computeStartNearCenter;
    this.computeMove = computeMoveImpl || computeMove;
    this.nearbyFrom = nearbyFromImpl || nearbyFrom;
    // 管理内部计时器
    this._timer = null;
    this._timer2 = null;
    this._idx = 0;
  }

  // 暴露当前正在播放的诗句索引（用于外部“暂停后接续播放”）
  getIndex(){ return Number(this._idx || 0); }

  stop(){
    try {
      // 若启用 3D 模式，先停止 three 层
      try { if (this.appCfg?.poetry?.use3D) { this.stopPoetry3D(); } } catch(_){ }
      clearTimeout(this._timer); clearTimeout(this._timer2);
      this._timer = null; this._timer2 = null;
      this.setData({ 'poetryA.visible': false, 'poetryB.visible': false });
      const fadeMs = Number(this.appCfg?.poetry?.fadeInMs || 600);
      setTimeout(() => {
        this.setData({
          poetryA: { text: '', x: 0, y: 0, tx: 0, ty: 0, moveMs: 0, visible: false },
          poetryB: { text: '', x: 0, y: 0, tx: 0, ty: 0, moveMs: 0, visible: false }
        });
      }, Math.max(0, Math.min(2000, fadeMs)));
    } catch(_){ }
  }

  resetImmediate(){
    try {
      // 立即清空当前状态：不等待淡出
      try { if (this.appCfg?.poetry?.use3D) { this.stopPoetry3D(); } } catch(_){ }
      clearTimeout(this._timer); clearTimeout(this._timer2);
      this._timer = null; this._timer2 = null; this._idx = 0;
      this.setData({
        poetryFadeMs: 0,
        poetryA: { text: '', x: 0, y: 0, tx: 0, ty: 0, moveMs: 0, visible: false },
        poetryB: { text: '', x: 0, y: 0, tx: 0, ty: 0, moveMs: 0, visible: false }
      });
    } catch(_){ }
  }

  async start(preset = 1, presetsMap = {}, startIdx = 0, opts = {}){
    try {
      clearTimeout(this._timer); clearTimeout(this._timer2);
      this._timer = null; this._timer2 = null; this._idx = Math.max(0, Number(startIdx || 0));
      const cfg = this.appCfg?.poetry || {};
      const fadeInMs = Number(cfg.fadeInMs || 600);
      const crossMs = Number(cfg.crossfadeMs || 2000); // 默认交叉 2 秒，匹配“旧诗句淡出 2 秒”的需求
      const moveSpeed = Number(cfg.movePxPerSec || 36);
      const margin = Number(cfg.safeMarginPx || 18);
      // 页面数据中的过渡时长需要同步
      // 统一使用 2 秒淡出；如需单独控制淡入，可在模板中区分 class（此处先满足需求）
      this.setData({ poetryFadeMs: Math.max(fadeInMs, 2000) });

      // 诊断与正确性：不再在目标预设缺失时回退到 1，避免造成“切到第三首仍显示第一套”错觉。
      const lines = Array.isArray(presetsMap[preset]) ? presetsMap[preset] : [];
      try { console.info('[poetry] 开始播放', { preset, lines: (Array.isArray(lines)? lines.length : 0) }); } catch(_){}
      if (!Array.isArray(lines) || !lines.length) return;
      // 3D 模式：交由 three.js 层渲染（被地球遮挡），关闭 DOM 叠加层
      if (cfg.use3D) {
        try { this.startPoetry3D(lines, cfg); } catch(_){}
        try { this.setData({ 'poetryA.visible': false, 'poetryB.visible': false }); } catch(_){}
        return;
      }

      const vp = this.getViewport();
      // 下边界：以地球画布上半区为基准，再额外向下扩展 10% 屏幕高度
      const gl = this.getCanvasRect();
      const halfCanvasBottom = (gl && typeof gl.top === 'number' && typeof gl.height === 'number')
        ? (gl.top + gl.height * 0.5)
        : (vp.windowHeight * 0.5);
      const extra = Math.max(0, vp.windowHeight * 0.10);
      const targetBottom = halfCanvasBottom + extra;
      const maxY = Math.max(margin, Math.min(vp.windowHeight - margin, targetBottom - margin));
      const bounds = { minX: margin, minY: margin, maxX: vp.windowWidth - margin, maxY };

      const showLineOn = async (useA, text, showMs, startPosOpt) => {
        const id = useA ? 'poetryA' : 'poetryB';
        const setText = {}; setText[useA ? 'poetryA.text' : 'poetryB.text'] = text;
        setText[useA ? 'poetryA.visible' : 'poetryB.visible'] = false;
        // 先将移动时长置为 0，避免把上一次残留的 transform 动画到初始位
        setText[useA ? 'poetryA.moveMs' : 'poetryB.moveMs'] = 0;
        this.setData(setText);
        const rect = await this.measure(id);
      const itemW = Math.max(1, rect?.width || 80);
      const itemH = Math.max(1, rect?.height || 160);
      // 允许通过配置控制“初始靠近中心”的范围比例（默认 0.35）
      const centerRatio = (typeof cfg.initialCenterRatio === 'number') ? cfg.initialCenterRatio : 0.35;
      const isEn = String(this.getLang?.() || 'zh') === 'en';
      let start = startPosOpt || (isEn
        ? __computeStartCenterEn(vp.windowWidth, vp.windowHeight, itemW, itemH, margin)
        : this.computeStartNearCenter(vp.windowWidth, vp.windowHeight, itemW, itemH, bounds, centerRatio));
        // 优先级开关：preferLineDuration=true 时以当前句的 showMs 为主，否则以配置 displayMs 为主
        const preferLine = !!cfg.preferLineDuration;
        const showDuration = Number(preferLine ? (showMs || cfg.displayMs || 7000) : (cfg.displayMs || showMs || 7000));
        const totalDuration = Math.max(0, showDuration + crossMs);
        const move = this.computeMove(start, itemW, itemH, moveSpeed, totalDuration, bounds);

        // 三阶段设置：
        // Phase1：无过渡地把 transform 重置为 0，并淡入显示
        const phase1 = {};
        phase1[useA ? 'poetryA.x' : 'poetryB.x'] = start.x;
        phase1[useA ? 'poetryA.y' : 'poetryB.y'] = start.y;
        phase1[useA ? 'poetryA.tx' : 'poetryB.tx'] = 0;
        phase1[useA ? 'poetryA.ty' : 'poetryB.ty'] = 0;
        phase1[useA ? 'poetryA.moveMs' : 'poetryB.moveMs'] = 0;
        phase1[useA ? 'poetryA.visible' : 'poetryB.visible'] = true;
        this.setData(phase1);
        await new Promise(r => setTimeout(r, 16)); // 等一帧确保初始样式应用
        // Phase2：启用位移过渡时长
        const phase2 = {}; phase2[useA ? 'poetryA.moveMs' : 'poetryB.moveMs'] = totalDuration; this.setData(phase2);
        await new Promise(r => setTimeout(r, 16)); // 再等一帧，确保过渡时长生效
        // Phase3：设置目标位移，开始移动动画
        const phase3 = {}; phase3[useA ? 'poetryA.tx' : 'poetryB.tx'] = move.tx; phase3[useA ? 'poetryA.ty' : 'poetryB.ty'] = move.ty; this.setData(phase3);

        const nearEnd = Math.max(0, showDuration - crossMs);
        const endPos = { x: move.endX, y: move.endY };
        // 独立定时：到达 nearEnd 时触发下一句的出现（不依赖旧句淡出是否完成）
        this._timer2 = setTimeout(async () => {
          const nextItem = lines[(this._idx + 1) % lines.length];
          // 通过配置限制“下一句贴近上一句首字”的最大距离，避免飘到边缘
          const limit = (typeof cfg.nextStartMaxDistancePx === 'number') ? cfg.nextStartMaxDistancePx : 20;
          let nextStart = this.nearbyFrom(endPos, itemW, itemH, bounds, limit);
          // 保护：如果发生异常（例如 NaN），回退到中心附近
          if (!nextStart || isNaN(nextStart.x) || isNaN(nextStart.y)) {
            nextStart = this.computeStartNearCenter(vp.windowWidth, vp.windowHeight, itemW, itemH, bounds, centerRatio);
          }
          if (isEn) {
            const cx = Math.max(bounds.minX, Math.min(bounds.maxX - itemW, (vp.windowWidth - itemW) / 2));
            const cy = Math.max(bounds.minY, Math.min(bounds.maxY - itemH, vp.windowHeight * 0.25 + Math.random() * vp.windowHeight * 0.15));
            nextStart.x = Math.max(bounds.minX, Math.min(bounds.maxX - itemW, (nextStart.x + cx) * 0.5));
            nextStart.y = Math.max(bounds.minY, Math.min(bounds.maxY - itemH, (nextStart.y + cy) * 0.5));
          }
          const ms = Number(preferLine ? (nextItem?.duration || cfg.displayMs || 7000) : (cfg.displayMs || 7000));
          this._idx = (this._idx + 1) % lines.length;
          await showLineOn(!useA, nextItem.text, ms, nextStart);
        }, nearEnd);
        // 独立定时：在本句完整显示时长到达后，开始旧句淡出
        this._timer = setTimeout(() => {
          const hide = {}; hide[useA ? 'poetryA.visible' : 'poetryB.visible'] = false; this.setData(hide);
        }, showDuration);
      };

      const item0 = lines[this._idx % lines.length];
      const firstDelayMs = Math.max(0, Number((opts && opts.firstDelayMs !== undefined) ? opts.firstDelayMs : 1000));
      setTimeout(() => {
        const preferLine = !!cfg.preferLineDuration;
        const ms0 = Number(preferLine ? (item0?.duration || cfg.displayMs || 7000) : (cfg.displayMs || 7000));
        showLineOn(true, item0.text, ms0);
      }, firstDelayMs);
    } catch(_){ }
  }
}
