// 3D 诗句层：以 Sprite 方式在地球“后方”渲染，确保被地球遮挡
// 依赖：THREE、earthMesh（用于射线求交）、camera、scene
import { makeTextSprite } from './text-sprite.js';

export function createPoetry3D(THREE, scene, camera, earthMesh, viewW, viewH, cfg = {}){
  const group = new THREE.Group();
  group.name = 'POETRY_3D_LAYER';
  scene.add(group);

  let enabled = false;
  let a = null, b = null; // 两句交替
  let cur = null; // 当前显示项（a/b）
  let nextLines = [];
  let idx = 0;
  let tSwitch = 0;
  let fadeInMs = Number(cfg.fadeInMs || 800);
  let crossMs = Number(cfg.crossfadeMs || 800);
  let displayMs = Number(cfg.displayMs || 7000);
  let movePxPerSec = Number(cfg.movePxPerSec || 36);
  let safeMarginPx = Number(cfg.safeMarginPx || 18);
  let behindOffset = Number(cfg.behindOffset || 0.08); // 距离地球交点之后的偏移（世界单位，球半径=1）

  const raycaster = new THREE.Raycaster();
  const tmpVec = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();
  const cameraPos = new THREE.Vector3();

  function toWorldBehind(xPx, yPx){
    const ndcX = (xPx / viewW) * 2 - 1;
    const ndcY = -((yPx / viewH) * 2 - 1);
    // 通过屏幕点构造射线
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const hit = earthMesh ? raycaster.intersectObject(earthMesh, true)[0] : null;
    camera.getWorldPosition(cameraPos);
    const origin = raycaster.ray.origin;
    const dir = raycaster.ray.direction;
    // 路径：若射中地球，把点放在交点之后；否则放在离相机一定远处
    const dist = hit ? (hit.distance + behindOffset) : camera.position.length() * 1.2;
    tmpVec.copy(origin).add(tmpDir.copy(dir).multiplyScalar(Math.max(0.1, dist)));
    return tmpVec.clone();
  }

  function makeSprite(text){
    const worldH = Number(cfg.worldHeight || 0.18);
    const sprite = makeTextSprite(THREE, text, {
      worldHeight: worldH,
      // 关键：启用深度测试，renderOrder 设低，确保被地球遮挡
      depthTest: true,
      depthWrite: false,
      renderOrder: 0
    });
    // 初始完全透明
    sprite.material.opacity = 0.0;
    return sprite;
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

  // 屏幕安全边界：上左右 margin，底部取地球画布下半区+额外 10% 高度的下沿
  function getBounds(){
    const margin = Math.max(0, safeMarginPx);
    return { x: margin, y: margin, w: viewW - margin * 2, h: viewH - margin * 2 };
  }

  function showNext(useA){
    if (!nextLines.length) return;
    const item = nextLines[idx % nextLines.length];
    idx++;
    const bounds = getBounds();
    const start = randomStart(bounds);
    const end = computeMove(start, displayMs, bounds);
    const s = (useA ? (a = makeSprite(item.text), a) : (b = makeSprite(item.text), b));
    group.add(s);
    s.userData.screen = { x: start.x, y: start.y, endX: end.endX, endY: end.endY, t0: performance.now(), dur: displayMs };
    // 进入时淡入
    s.material.opacity = 0.0;
    cur = s;
    tSwitch = performance.now() + Math.max(0, displayMs - crossMs);
  }

  function disposeSprite(s){
    if (!s) return;
    try { group.remove(s); s.material?.map?.dispose?.(); s.material?.dispose?.(); s.geometry?.dispose?.(); } catch(_){}
  }

  return {
    setEnabled(on){ enabled = !!on; if (!enabled) { disposeSprite(a); disposeSprite(b); a = b = cur = null; } },
    start(lines, conf){
      nextLines = Array.isArray(lines) ? lines.map(l => ({ text: String(l.text||''), duration: Number(l.duration||displayMs) })).filter(x => x.text.length>0) : [];
      if (conf) {
        fadeInMs = Number(conf.fadeInMs || fadeInMs);
        crossMs = Number(conf.crossfadeMs || crossMs);
        displayMs = Number(conf.displayMs || displayMs);
        movePxPerSec = Number(conf.movePxPerSec || movePxPerSec);
        safeMarginPx = Number(conf.safeMarginPx || safeMarginPx);
        behindOffset = Number(conf.behindOffset || behindOffset);
      }
      idx = 0; disposeSprite(a); disposeSprite(b); a = b = cur = null;
      if (!nextLines.length) return; showNext(true);
    },
    stop(){ disposeSprite(a); disposeSprite(b); a = b = cur = null; },
    update(now){
      if (!enabled) return;
      // 交替切换
      if (tSwitch && now >= tSwitch){
        // 旧句淡出、新句淡入
        if (cur) { cur.userData.fadeOutUntil = now + Math.max(300, crossMs); }
        showNext(cur === a ? false : true);
        tSwitch = 0;
      }
      // 逐帧更新位置与透明度
      [a, b].forEach(s => {
        if (!s || !s.userData.screen) return;
        const u = s.userData.screen;
        const t = Math.max(0, Math.min(1, (now - u.t0) / Math.max(1, u.dur)));
        const x = u.x + (u.endX - u.x) * t;
        const y = u.y + (u.endY - u.y) * t;
        const world = toWorldBehind(x, y);
        s.position.copy(world);
        // 淡入/淡出
        if (!s.userData.fadeOutUntil) {
          const k = Math.max(0, Math.min(1, (now - u.t0) / Math.max(1, fadeInMs)));
          s.material.opacity = Math.min(1.0, 0.05 + 0.95 * k);
        } else {
          const rem = Math.max(0, s.userData.fadeOutUntil - now);
          const k = Math.max(0, Math.min(1, rem / Math.max(1, crossMs)));
          s.material.opacity = Math.max(0, Math.min(1, 1.0 * k));
          if (rem <= 0) { disposeSprite(s === a ? a : b); if (s === a) a = null; else b = null; s.userData.fadeOutUntil = 0; }
        }
      });
    }
  };
}