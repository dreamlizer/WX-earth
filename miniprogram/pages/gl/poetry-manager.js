// 职责：管理禅定诗句的显示与切换（DOM层或3D层），与页面事件/状态解耦。
// 依赖通过构造函数注入，以便在页面外部独立测试与复用。

import { computeStartNearCenter, computeMove, nearbyFrom } from './poetry-motion.js';

export class PoetryManager {
  constructor({
    appCfg = {},
    getViewport = () => ({ windowWidth: 0, windowHeight: 0 }),
    getCanvasRect = () => null,
    measure = async () => ({ width: 0, height: 0 }),
    setData = () => {},
    startPoetry3D = () => {},
    stopPoetry3D = () => {},
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
    // 允许外部覆盖纯函数实现，默认使用模块内实现
    this.computeStartNearCenter = computeStartNearCenterImpl || computeStartNearCenter;
    this.computeMove = computeMoveImpl || computeMove;
    this.nearbyFrom = nearbyFromImpl || nearbyFrom;
    // 管理内部计时器
    this._timer = null;
    this._timer2 = null;
    this._idx = 0;
  }

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

  async start(preset = 1, presetsMap = {}){
    try {
      clearTimeout(this._timer); clearTimeout(this._timer2);
      this._timer = null; this._timer2 = null; this._idx = 0;
      const cfg = this.appCfg?.poetry || {};
      const fadeInMs = Number(cfg.fadeInMs || 600);
      const crossMs = Number(cfg.crossfadeMs || 1000);
      const moveSpeed = Number(cfg.movePxPerSec || 36);
      const margin = Number(cfg.safeMarginPx || 18);
      // 页面数据中的过渡时长需要同步
      this.setData({ poetryFadeMs: fadeInMs });

      const lines = presetsMap[preset] || presetsMap[1] || [];
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
        const start = startPosOpt || this.computeStartNearCenter(vp.windowWidth, vp.windowHeight, itemW, itemH, bounds, centerRatio);
        const showDuration = Number(cfg.displayMs || showMs || 7000);
        const move = this.computeMove(start, itemW, itemH, moveSpeed, showDuration, bounds);

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
        const phase2 = {}; phase2[useA ? 'poetryA.moveMs' : 'poetryB.moveMs'] = showDuration; this.setData(phase2);
        await new Promise(r => setTimeout(r, 16)); // 再等一帧，确保过渡时长生效
        // Phase3：设置目标位移，开始移动动画
        const phase3 = {}; phase3[useA ? 'poetryA.tx' : 'poetryB.tx'] = move.tx; phase3[useA ? 'poetryA.ty' : 'poetryB.ty'] = move.ty; this.setData(phase3);

        const nearEnd = Math.max(0, showDuration - crossMs);
        const endPos = { x: move.endX, y: move.endY };
        this._timer = setTimeout(async () => {
          const nextItem = lines[(++this._idx) % lines.length];
          // 通过配置限制“下一句贴近上一句首字”的最大距离，避免飘到边缘
          const limit = (typeof cfg.nextStartMaxDistancePx === 'number') ? cfg.nextStartMaxDistancePx : 20;
          let nextStart = this.nearbyFrom(endPos, itemW, itemH, bounds, limit);
          // 保护：如果发生异常（例如 NaN），回退到中心附近
          if (!nextStart || isNaN(nextStart.x) || isNaN(nextStart.y)) {
            nextStart = this.computeStartNearCenter(vp.windowWidth, vp.windowHeight, itemW, itemH, bounds, centerRatio);
          }
          await showLineOn(!useA, nextItem.text, Number(cfg.displayMs || 7000), nextStart);
          const hide = {}; hide[useA ? 'poetryA.visible' : 'poetryB.visible'] = false; this.setData(hide);
        }, nearEnd);
      };

      const item0 = lines[0];
      // 首句延迟 1 秒再出现，避免过早出现
      setTimeout(() => { showLineOn(true, item0.text, Number(cfg.displayMs || 7000)); }, 1000);
    } catch(_){ }
  }
}