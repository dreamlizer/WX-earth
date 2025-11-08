// 全局可调配置（集中化）：灯光、着色器、旋转等都在此处调节
// 使用方法：import { APP_CFG } from './config.js'
// 单位清晰：强度为相对值（无量纲）；角速度用“度/秒”；时间为毫秒

export const APP_CFG = {
  // [UI] 通用界面配置（面板淡出与控件显隐）
  ui: {
    panelFadeMs: 500,     // 面板淡出时间（毫秒）
    showZoomBar: true     // 底部缩放条是否可见（false 则隐藏并不可用）
  },
  // [通用] 普通模式（非禅定）——整体偏自然、易读
  normal: {
    // 开关：普通模式是否采用“禅定灯光”配置（仅灯光强度，不引入禅材质）
    // 回退机制：若观感不佳，改为 false 即恢复普通灯光
    useZenLighting: true,
    // 开关：普通模式是否采用“禅定材质”（昼夜混合 ShaderMaterial）
    // 若出现性能或观感问题，设为 false 回退到 Phong 材质
    useZenMaterial: true,
    // 夜景按钮行为：true=纯夜视图（两侧都用夜景纹理），false=保持日夜混合
    nightThemePure: true,
    // 纯夜视图下的微调（可选）：曝光与白天侧增益
    nightExposure: 0.95,
    nightDaySideGain: 1.0,
    // 太阳光（方向光）强度：1.0 为基准；建议 0.8–1.6
    dirLightIntensity: 1.05,
    // 环境光强度：抬低全局最低亮度；建议 0.2–0.5
    ambientIntensity: 0.30,
    // 新增：普通模式下星空整体透明度（0~1）。设小值可保持极弱可见，0 为完全隐藏。
    // 提升普通模式星空亮度（夸张以便确认）：可在 0.2–0.5 调整
    starOpacity: 0.30,
    // 新增：普通模式星点大小缩放（影响 gl_PointSize），1.0 为标准
    starSizeScale: 1.8,
    // 新增：普通模式星点亮度增益（乘法系数），用于更尖锐更亮的中心
    starBrightnessGain: 2.2,
    // 新增：普通模式——全局“呼吸式”闪烁参数（与点级 twinkle 相乘）
    // 呼吸速度（弧度/秒；越小越慢），与振幅（0~1；0 关闭）
    starBreathSpeed: 0.6,
    starBreathStrength: 0.25,
  },

  // [禅定专用] 禅定模式（右侧白天、左侧夜晚）
  zen: {
    // 禅定位移：向下移动的“附加偏移”（相对于地球半径 R=1 的比例）
    // 例如 -0.35 表示在现有基础位置上再向下移动 0.35R
    globeYOffsetR: -0.75,
    // 右侧太阳光强度（方向光，仅影响非着色器材质的高光/阴影；与禅定亮度关联已弱化）
    dirLightIntensityRight: 1.60,
    // 环境光强度（夜侧更暗，建议较低）；建议 0.05–0.25
    ambientIntensity: 0.06,

    // 自动旋转（进入禅定并稳定后启用）
    autoRotate: {
      enabled: true,            // 开启/关闭自动缓慢转动
      degPerSec: 3.0,           // 旋转速度（度/秒），建议 0.5–5.0
      startDelayMs: 1200,       // 稳定后延迟开启（毫秒），建议 600–2000
    },

    // 着色器参数（昼夜混合）—— 仅禅定使用
    // 终止线柔和度（过渡宽度），越大越柔和；建议 0.12–0.30
    mixSoftness: 0.20,
    // 混合曲线幂次（形状），>1 更靠近白天侧，<1 更靠近夜侧；建议 0.8–2.0
    mixPower: 1.0,
    // 夜侧暗度（乘法系数），<1 变暗；建议 0.70–0.95
    nightDarkness: 0.65,
    // 白天对比（仅对白天纹理做伽马调整），>1 提升对比；建议 0.9–1.3
    dayContrast: 1.5,
    // 日夜对比度（整体拉开白天/黑夜差异；围绕 0.5 做线性拉伸），建议 0.8–2.0；1 为不改变
    dayNightContrast: 1.6,
    // 最后整体 gamma（混合后统一调整）；一般保持 1.0
    gamma: 1.0,

    // 新增：整体曝光（乘法系数，默认 1.0；>1 更亮）。对禅定模式亮度直观有效。
    exposure: 1.6,
    // 新增：白天侧增益（仅对白天侧生效，默认 1.0；>1 更亮）。
    daySideGain: 1.50,

    // 新增：禅定模式下的星空整体透明度（0~1）。为确保可见暂时提高。
    starOpacity: 0.60,
    // 新增：禅定模式星点大小缩放
    starSizeScale: 2.0,
    // 新增：禅定模式星点亮度增益
    starBrightnessGain: 2.8,
    // 新增：禅定模式——全局“呼吸式”闪烁参数（更慢、略强）
    starBreathSpeed: 0.42,
    starBreathStrength: 0.35,

    // 新增：高光压缩（ToneMap）系数，避免右侧“曝白”发灰；0 关闭
    // 建议范围 0.25–0.45（与 exposure/daySideGain 搭配）
    highlightsRoll: 0.32,

    // 叠加线（边境/赤道/回归线）亮度调低——仅在禅定下生效
    overlays: {
      // 国家边境线颜色强度系数（乘法因子）；<1 变暗；建议 0.5–0.9
      bordersColorFactor: 0.65,
      // 赤道透明度系数（乘法因子）；<1 变淡；建议 0.5–0.9
      equatorOpacityFactor: 0.65,
      // 回归线透明度系数（乘法因子）；<1 变淡；建议 0.5–0.9
      tropicsOpacityFactor: 0.65,
    },
  },

  // [禅定诗句] 动画参数（集中管理，便于微调）
  poetry: {
    // 淡入/淡出时长（毫秒）
    fadeInMs: 1200,
    fadeOutMs: 1200,
    // 关闭 3D 诗句，恢复 DOM 竖版呈现（writing-mode: vertical-rl）
    use3D: false,
    // 单句停留显示时长（毫秒；若预设中有自定义 duration 则以预设为准）
    displayMs: 10000,
    // 竖排诗句字号（px），用于页面样式绑定
    fontSizePx: 24,
    // 诗句移动速度（px/s）：值越大移动越快
    movePxPerSec: 12,
    // 句间交替时长（毫秒）：上一句淡出与下一句淡入的重叠时间
    crossfadeMs: 800,
    // 屏幕安全边界（px）：与四边保持的最小距离，防止抛出屏幕
    safeMarginPx: 18,
    // 下一句首字贴近上一句首字的最大距离（px；越小越贴近）
    nextStartMaxDistancePx: 10,
    // 首句初始位置接近屏幕中心的比例（0–1），如 0.35 表示中心±35%范围内随机
    initialCenterRatio: 0.55,
    // 调试日志（开发阶段打开以观察位置与边界修正）
    debugLog: false,
    // 拖影（禅定模式）：白色渐变拖影，长度与层数可调
    trail: {
      enabled: true,       // 仅在禅定模式下启用
      layers: 4,           // 阶梯层数（越多越长越柔）
      maxBlurPx: 8,        // 最大模糊半径（px），从 0 渐增到此值
      maxAlpha: 0.35       // 最大不透明度（最靠近文字的拖影更亮）
    },
    // 可读性：给文字加轻微黑描边（使用 text-shadow 模拟）
    outline: {
      enabled: true,
      thicknessPx: 0.8     // 描边粗细（通过阴影半径近似）
    }
  },

  // [通用] 地球基础材质（Phong）
  earthMaterial: {
    // 高光强度（越大高光越明显）；建议 4–16
    shininess: 8,
  },
  // [相机缩放] 配置最大/最小缩放（zoom 值越大越近）
  camera: {
    minZoom: 0.60,           // 最小缩放（最远）
    maxZoom: 3.43,           // 最大缩放（更近，比原先 +20%）
    // 初始视觉中心（普通模式）：北京（度）。如需更改，修改此处即可。
    // 说明：lat 为纬度（北纬为正），lon 为经度（东经为正）。
    initialCenterDeg: { lat: 39.9042, lon: 116.4074 }
  },
  // [云能力] 在本地静态预览时关闭云调用，避免控制台刷屏报错
  cloud: {
    enabled: true,           // 开启纹理加载；UI 默认关闭可见性
    // 云层独立慢速转动（度/秒；0 关闭）。不依赖禅定自动转动。
    spinDegPerSec: 2.0
  },
  // [国家高亮] 填充透明度（0~1）。提高到 0.8–1.0 可形成“不透明方式”。
  highlight: {
    fillOpacity: 0.75,
    // 高亮消失淡出时长（毫秒）
    fadeOutMs: 1500,
    // 自动取消选中：当选中国家大部分进入背面时清除高亮（避免穿模）
    autoClearOnBackside: {
      enabled: true,          // 开启自动取消背面选中
      minVisibleRatio: 0.60,  // 前半球可见比例阈值（<=10% 即 90% 在背面）
      checkIntervalMs: 500,   // 检查间隔，毫秒
      requireConsecutive: 2   // 连续判定次数，避免抖动
    }
  },
  // 未来扩展：在此添加其他常用可调项（示例）
  // camera: { defaultZoom: 1.0 },
  // labels: { fontSize: 14 },
  // [边界校正] 形变网格（Warp）参数
  warp: {
    enabled: false,     // 默认关闭；开启后对边界顶点做微位移
    strength: 1.0,      // 位移强度（乘法系数）
    sigmaDeg: 2.5,      // 影响半径（度；作为默认 σ）
    debug: {
      showArrows: false // 在锚点处显示位移箭头，便于校准
    }
  },
  // [边界数据] 分辨率 LOD（Natural Earth 系列）：110m/50m/10m
  bordersLod: '110m'
};