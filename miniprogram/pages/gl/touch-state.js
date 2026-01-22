
import { 
  INERTIA_NONLINEAR, 
  INERTIA_POWER, 
  INERTIA_DAMP_MIN, 
  INERTIA_DAMP_MAX, 
  INERTIA_SPEED_MIN, 
  INERTIA_SPEED_MAX, 
  INERTIA_GAIN_BASE, 
  INERTIA_GAIN_SCALE,
  INTERACTION_DEBUG_LOG 
} from './label-constants.js';

export function createTouchState(sys) {
  const isPC = ['windows','mac','devtools'].includes(sys.platform);
  return {
    isPC,
    rotX: 0,
    rotY: 0,
    // 惯性旋转
    velX: 0,
    velY: 0,
    damping: 0.92, // 阻尼系数
    maxSpeed: 0.06, // 单帧最大角速度
    inertiaGain: 0, // 惯性增益
    // 诊断辅助
    releaseVelX: 0,
    releaseVelY: 0,
    releaseAt: 0,
    __lastDragLogAt: 0,
    isDragging: false,
    lastX: 0,
    lastY: 0,
    downX: 0,
    downY: 0,
    downTime: 0,
    pinch: false,
    pinchStartDist: 0,
    pinchStartZoom: 1.0, // 将在外部被重置为实际 zoom
  };
}

export function updateInertiaParams(touch, pct) {
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  // 修复：用户反馈“无”选项依然有惯性。
  // 修正：当 pct 为 0 时，强制 damping 为 0，使惯性立即停止。
  if (v === 0) {
      touch.damping = 0.0;
      touch.inertiaGain = 0.0;
      try { if (INTERACTION_DEBUG_LOG) console.log('[inertia:set] zero inertia enforced'); } catch(_){}
      return;
  }
  const norm = v / 100; // 0..1
  // 非线性映射：增强中高档位差异（可在 label-constants.js 关闭回滚为线性）
  const useNL = !!INERTIA_NONLINEAR;
  const t = useNL ? Math.pow(norm, Math.max(1.0, Number(INERTIA_POWER) || 2.2)) : norm;
  const minD = Number(INERTIA_DAMP_MIN ?? 0.60);
  const maxD = Number(INERTIA_DAMP_MAX ?? 0.998);
  touch.damping = minD + (maxD - minD) * t;
  const minS = Number(INERTIA_SPEED_MIN ?? 0.05);
  const maxS = Number(INERTIA_SPEED_MAX ?? 0.22);
  touch.maxSpeed = minS + (maxS - minS) * t;
  const baseG = Number(INERTIA_GAIN_BASE ?? 0.30);
  const scaleG = Number(INERTIA_GAIN_SCALE ?? 2.4);
  touch.inertiaGain = baseG + scaleG * t; // 增益更陡，使 70-90 档更有感
  // 诊断日志：观察滑条映射是否生效（含非线性 t）
  try { if (INTERACTION_DEBUG_LOG) console.log('[inertia:set]', { pct: v, norm: Number(norm.toFixed(3)), t: Number(t.toFixed(3)), damping: Number(touch.damping.toFixed(3)), maxSpeed: Number(touch.maxSpeed.toFixed(3)), gain: Number(touch.inertiaGain.toFixed(2)), nonlinear: useNL }); } catch(_){}
}
