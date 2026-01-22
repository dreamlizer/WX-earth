// 3D 诗句层：以 Sprite 方式在地球“后方”渲染，确保被地球遮挡
// 依赖：THREE、earthMesh（用于射线求交）、camera、scene
import { makeTextSprite } from './text-sprite.js';

export function createPoetry3D(THREE, scene, camera, earthMesh, viewW, viewH, cfg = {}){
  const group = new THREE.Group();
  group.name = 'POETRY_3D_LAYER';
  scene.add(group);

  let timeline = []; // 预计算的时间表
  let activeSprites = new Map(); // 当前活动的 Sprites: index -> Sprite
  let baseTime = 0; // 播放开始的绝对时间戳
  let enabled = false; // 模块开关状态
  let resumeMinStart = 0; // 恢复播放时：不补显示该时间之前 start 的句子

  // 配置项
  let fadeInMs = Number(cfg.fadeInMs || 800);
  let fadeOutMs = Number(cfg.fadeOutMs || 800); 
  let crossMs = Number(cfg.crossfadeMs || 800); 
  let displayMs = Number(cfg.displayMs || 7000);
  let preferLineDuration = !!cfg.preferLineDuration;
  let movePxPerSec = Number(cfg.movePxPerSec || 36);
  let safeMarginPx = Number(cfg.safeMarginPx || 18);
  let behindOffset = Number(cfg.behindOffset || 0.08);

  const raycaster = new THREE.Raycaster();
  const tmpVec = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();
  const cameraPos = new THREE.Vector3();

  function toWorldBehind(xPx, yPx){
    const ndcX = (xPx / viewW) * 2 - 1;
    const ndcY = -((yPx / viewH) * 2 - 1);
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const hit = earthMesh ? raycaster.intersectObject(earthMesh, true)[0] : null;
    camera.getWorldPosition(cameraPos);
    const origin = raycaster.ray.origin;
    const dir = raycaster.ray.direction;
    const dist = hit ? (hit.distance + behindOffset) : camera.position.length() * 1.2;
    tmpVec.copy(origin).add(tmpDir.copy(dir).multiplyScalar(Math.max(0.1, dist)));
    return tmpVec.clone();
  }

  function makeSprite(text){
    const worldH = Number(cfg.worldHeight || 0.18);
    const sprite = makeTextSprite(THREE, text, {
      worldHeight: worldH,
      depthTest: true,
      depthWrite: false,
      renderOrder: 0
    });
    sprite.material.opacity = 0.0;
    return sprite;
  }

  function getBounds(){
    const margin = Math.max(0, safeMarginPx);
    return { x: margin, y: margin, w: viewW - margin * 2, h: viewH - margin * 2 };
  }

  function randomStart(bounds){
    const rx = bounds.w * (Number(cfg.initialCenterRatio || 0.35) * 0.5);
    const ry = bounds.h * (Number(cfg.initialCenterRatio || 0.35) * 0.5);
    const cx = bounds.x + bounds.w * 0.5;
    const cy = bounds.y + bounds.h * 0.5;
    const x = Math.max(bounds.x, Math.min(bounds.x + bounds.w, cx + (Math.random()*2-1)*rx));
    const y = Math.max(bounds.y, Math.min(bounds.y + bounds.h, cy + (Math.random()*2-1)*ry));
    return { x, y };
  }

  function computeMove(start, durationMs, bounds){
    const dist = Math.max(0, movePxPerSec) * Math.max(0, durationMs) / 1000;
    const theta = Math.random() * Math.PI * 2;
    let endX = start.x + dist * Math.cos(theta);
    let endY = start.y + dist * Math.sin(theta);
    endX = Math.max(bounds.x, Math.min(bounds.x + bounds.w, endX));
    endY = Math.max(bounds.y, Math.min(bounds.y + bounds.h, endY));
    return { endX, endY };
  }

  function disposeSprite(s){
    if (!s) return;
    try { group.remove(s); s.material?.map?.dispose?.(); s.material?.dispose?.(); s.geometry?.dispose?.(); } catch(_){}
  }

  return {
    setEnabled(on){ 
      enabled = !!on; 
      if (!enabled) { 
        // 清空所有
        activeSprites.forEach(s => disposeSprite(s));
        activeSprites.clear();
        baseTime = 0; 
      } 
    },
    
    start(lines, conf){
      // 更新配置
      if (conf) {
        fadeInMs = Number(conf.fadeInMs || fadeInMs);
        fadeOutMs = Number(conf.fadeOutMs || fadeOutMs);
        crossMs = Number(conf.crossfadeMs || crossMs);
        displayMs = Number(conf.displayMs || displayMs);
        preferLineDuration = !!conf.preferLineDuration;
        movePxPerSec = Number(conf.movePxPerSec || movePxPerSec);
        safeMarginPx = Number(conf.safeMarginPx || safeMarginPx);
        behindOffset = Number(conf.behindOffset || behindOffset);
      }

      // 1. 清理旧状态
      activeSprites.forEach(s => disposeSprite(s));
      activeSprites.clear();
      baseTime = 0;
      timeline = [];
      resumeMinStart = 0;

      if (!Array.isArray(lines) || lines.length === 0) {
        console.warn('[Poetry] Start called with empty lines!');
        return;
      }

      // 2. 预计算时间轴 (Timeline)
      const hasAbsStart = Array.isArray(lines) && lines.some(l => Number.isFinite(Number(l?.['start-time'])));
      const firstDelayMs = Number(conf?.firstDelayMs || 0);
      const offsetMs = Number(conf?.offsetMs || 0);
      const scheduleShiftMs = Math.max(0, firstDelayMs + offsetMs);
      let accum = scheduleShiftMs;
      lines.forEach((l, i) => {
        if (!l.text) return;
        const dur = preferLineDuration ? Number(l.duration || displayMs) : displayMs;

        const bounds = getBounds();
        const startPos = randomStart(bounds);
        const endPos = computeMove(startPos, dur, bounds);

        const baseStart = Math.max(0, Number(l?.['start-time'] || 0));
        const tStart = hasAbsStart ? Math.max(0, scheduleShiftMs + baseStart) : accum;
        const tEnd = tStart + dur;
        const tVisibleEnd = tEnd + crossMs;

        timeline.push({
          index: i,
          text: String(l.text),
          tStart,
          tEnd,
          tVisibleEnd,
          screen: {
            x: startPos.x, y: startPos.y,
            endX: endPos.endX, endY: endPos.endY,
            dur: dur
          }
        });

        if (!hasAbsStart) { accum += dur; }
      });

      // 标记开始：允许外部传入基准时间以便 Special 结束后继续按原时间轴
      const overrideBase = (conf && typeof conf.baseTime === 'number' && conf.baseTime > 0) ? conf.baseTime : null;
      baseTime = overrideBase || Date.now();
      // 记录“恢复时刻”的已流逝时间，用于跳过过期句子
      resumeMinStart = Math.max(0, Date.now() - baseTime);
      enabled = true;

      // [Debug] 输出完整时间表
      const totalDur = timeline[timeline.length-1]?.tEnd || 0;
      console.log(`[Poetry] Timeline Ready. Total lines: ${timeline.length}, Total duration: ${(totalDur/1000).toFixed(2)}s`);
      console.table(timeline.map(t => ({
        text: t.text.length > 10 ? t.text.slice(0,10)+'...' : t.text,
        start: (t.tStart/1000).toFixed(2)+'s',
        dur: (t.screen.dur/1000).toFixed(2)+'s',
        end: (t.tEnd/1000).toFixed(2)+'s'
      })));
    },

    stop(){ 
      activeSprites.forEach(s => disposeSprite(s));
      activeSprites.clear();
      baseTime = 0; 
      timeline = [];
    },

    update(now){
      if (!enabled || !baseTime || timeline.length === 0) return;

      // 计算当前播放进度 (ms)
      // 如果希望支持循环播放，可以对 totalDuration 取模
      const totalDuration = timeline[timeline.length - 1].tEnd;
      // 这里暂不循环，或者由外部控制循环。假设外部会重新调 start。
      // 为了安全，如果 now 远超 totalDuration + crossMs，可以视为结束。
      
      const elapsed = now - baseTime;

      // 1. 找出当前应该显示的句子
      // 条件：elapsed >= tStart && elapsed < tVisibleEnd
      const visibleIndices = new Set();
      
      for (let i = 0; i < timeline.length; i++) {
        const item = timeline[i];
        // 优化：如果 item.tVisibleEnd 早就过了，跳过
        if (elapsed > item.tVisibleEnd) continue;
        // 优化：如果 item.tStart 还没到，后面的肯定也没到（因为是排序的），break
        if (elapsed < item.tStart) break;

        // 命中
        visibleIndices.add(i);

        // 如果还没有 Sprite，创建它
        if (!activeSprites.has(i)) {
          // 跳过补显示：若该句的 tStart 早于恢复时刻，则不创建
          if (item.tStart < resumeMinStart) { continue; }
          // [Debug] 实时播放日志
          console.log(`[Poetry] Play #${i+1} @ ${(elapsed/1000).toFixed(2)}s: "${item.text}" (Duration: ${(item.screen.dur/1000).toFixed(2)}s)`);
          
          const s = makeSprite(item.text);
          // 存入元数据，方便后续更新
          s.userData.timelineItem = item;
          group.add(s);
          activeSprites.set(i, s);
        }
      }

      // 2. 清理不再显示的句子
      for (const [i, sprite] of activeSprites) {
        if (!visibleIndices.has(i)) {
          disposeSprite(sprite);
          activeSprites.delete(i);
        }
      }

      // 3. 更新所有活动句子的状态
      for (const [i, sprite] of activeSprites) {
        const item = sprite.userData.timelineItem;
        // 句子内部的流逝时间
        const localT = elapsed - item.tStart;
        
        // A. 运动 (只在 dur 期间运动，crossMs 期间保持在终点? 或者继续运动?)
        // 原逻辑是：运动覆盖 duration。
        // 我们可以让它继续匀速运动，保持动量。
        // 速度 = dist / dur。 总运动时间 = dur + crossMs
        // 还是保持简单：只在 dur 内运动，crossMs 停留在终点。
        const moveProgress = Math.max(0, Math.min(1, localT / Math.max(1, item.screen.dur)));
        const x = item.screen.x + (item.screen.endX - item.screen.x) * moveProgress;
        const y = item.screen.y + (item.screen.endY - item.screen.y) * moveProgress;
        
        const world = toWorldBehind(x, y);
        sprite.position.copy(world);

        // B. 透明度 (Fade In / Fade Out)
        // 阶段1: Fade In (0 -> fadeInMs)
        // 阶段2: Hold
        // 阶段3: Fade Out (tEnd -> tVisibleEnd) 注意：这里是用 tEnd 开始淡出
        
        let alpha = 1.0;

        // 淡入
        if (localT < fadeInMs) {
           alpha = localT / Math.max(1, fadeInMs);
        }
        
        // 淡出 (检查是否进入了 Cross 区域)
        // Cross 区域开始于 item.tEnd
        if (elapsed >= item.tEnd) {
           const fadeOutElapsed = elapsed - item.tEnd;
           const fadeOutDur = item.tVisibleEnd - item.tEnd; // 应该等于 crossMs
           const k = Math.max(0, Math.min(1, fadeOutElapsed / Math.max(1, fadeOutDur)));
           alpha = 1.0 - k; // 1 -> 0
        }
        
        // 基础透明度限制 (0.05 ~ 1.0)
        sprite.material.opacity = Math.max(0, Math.min(1, alpha));
        sprite.visible = true;
      }
    }
  };
}
