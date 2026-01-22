// 全局可调配置（集中化）：灯光、着色器、旋转等都在此处调节
// 使用方法：import { APP_CFG } from './config.js'
// 单位清晰：强度为相对值（无量纲）；角速度用“度/秒”；时间为毫秒

export const APP_CFG = {
  // -------------------- 全局 --------------------
  // [UI] 通用界面配置（面板淡出与控件显隐）
  // 面板淡出、是否显示缩放条、Bloom（泛光）效果等通用 UI 设置。
  ui: {
  panelFadeMs: 500,     // 面板淡出时间（毫秒）
  // —— Bloom（泛光）效果参数：为“电影感”的关键 ——
  bloom: {
    // 普通模式：开启与强度（关闭以禁用）
    normalEnabled: false, // 普通模式是否开启 Bloom
    normalStrength: 0.45,  // 强度（0.0-2.0）
    normalThreshold: 0.8,  // 亮度阈值（0.0-1.0；越低越多像素参与）
    normalRadius: 0.18,    // 半径（0.0-1.0；越大越“糊”）
    // 禅模式：通常更强，营造柔和发光（关闭以禁用）
    zenEnabled: false, // 禅模式是否开启 Bloom
    zenStrength: 0.85, // 禅模式 Bloom 强度
    zenThreshold: 0.7, // 禅模式 Bloom 亮度阈值
    zenRadius: 0.24, // 禅模式 Bloom 半径
    // 兼容选项：若 UnrealBloomPass 不可用，使用简化回退
    fallbackEnabled: false,   // 关闭回退，整体禁用 Bloom
    fallbackBoost: 1.15       // 回退时整体亮度微提（乘法）
  },
    showZoomBar: false,     // 底部缩放条是否可见（false 则隐藏并不可用）
    transitions: {
      themeFadeOutMs: 500, // 切换主题：淡出时长（毫秒）
      themeFadeInMs: 600, // 切换主题：淡入时长（毫秒）
      zenFadeOutMs: 600, // 进入/退出禅定：淡出时长（毫秒）
      zenFadeInMs: 700, // 进入/退出禅定：淡入时长（毫秒）
      lightSmoothMs: 200 // 灯光变化平滑时长（毫秒）
    }
  },

  
  // -------------------- 普通模式 --------------------
  // [通用] 普通模式（非禅定）——整体偏自然、易读
  // 灯光、材质、星空效果与明暗等针对普通模式的观感参数。
  normal: {
    // 开关：普通模式是否采用“禅定灯光”配置（仅灯光强度，不引入禅材质）
    // 回退机制：若观感不佳，改为 false 即恢复普通灯光
    useZenLighting: true, // 普通模式是否沿用禅定灯光强度
    // 开关：普通模式是否采用“禅定材质”（昼夜混合 ShaderMaterial）
    // 若出现性能或观感问题，设为 false 回退到 Phong 材质
    useZenMaterial: false, // 普通模式是否沿用禅定着色器材质
    // 夜景按钮行为：true=纯夜视图（两侧都用夜景纹理），false=保持日夜混合
    nightThemePure: true, // 夜景按钮：纯夜视图开关
    // 纯夜视图下的微调（可选）：曝光与白天侧增益
    nightExposure: 0.95, // 纯夜视图：整体曝光
    nightDaySideGain: 1.0, // 纯夜视图：白天侧增益
    // 太阳光（方向光）强度：1.0 为基准；建议 0.8–1.6
    dirLightIntensity: 1.05, // 普通模式：方向光强度
    // 环境光强度：抬低全局最低亮度；建议 0.2–0.5
    ambientIntensity: 0.30, // 普通模式：环境光强度
    // 新增：普通模式下星空整体透明度（0~1）。设小值可保持极弱可见，0 为完全隐藏。
    // 提升普通模式星空亮度（夸张以便确认）：可在 0.2–0.5 调整
    starOpacity: 0.60, // 普通模式：星空整体透明度（0~1）
    // 新增：普通模式星点大小缩放（影响 gl_PointSize），1.0 为标准
    starSizeScale: 1.8, // 普通模式：星点大小缩放
    // 新增：普通模式星点亮度增益（乘法系数），用于更尖锐更亮的中心
    starBrightnessGain: 2.2, // 普通模式：星点亮度增益
    // 新增：普通模式——全局“呼吸式”闪烁参数（与点级 twinkle 相乘）
    // 呼吸速度（弧度/秒；越小越慢），与振幅（0~1；0 关闭）
    starBreathSpeed: 0.6, // 普通模式：星点“呼吸”速度
    starBreathStrength: 0.25, // 普通模式：星点“呼吸”强度
  },

  brightness: {
    default: 0.8, // 默认亮度倍率
    min: 0.3, // 最小亮度倍率
    max: 1.5 // 最大亮度倍率
  },

  audio: {
    zenVolume: 1.0, // 禅定音乐基础音量
    moonVolumeMul: 0.65 // 登月音效/音乐音量乘子
  },

  
  // -------------------- 禅定模式 --------------------
  // [禅定专用] 禅定模式（右侧白天、左侧夜晚）
  // 进入禅定后的地球位移、自动旋转、昼夜混合与星空参数。
  zen: {
    // 开关：是否使用 ShaderMaterial（昼夜混合）。若设备不支持或显示异常，改为 false 回退到 MeshPhongMaterial
    useShaderMaterial: true, // 禅定模式是否使用昼夜混合着色器
    // 禅定位移：向下移动的“附加偏移”（相对于地球半径 R=1 的比例）
    // 例如 -0.35 表示在现有基础位置上再向下移动 0.35R
    globeYOffsetR: -0.75, // 禅定模式地球向下偏移（相对半径R）
    // 右侧太阳光强度（方向光，仅影响非着色器材质的高光/阴影；与禅定亮度关联已弱化）
    dirLightIntensityRight: 1.60, // 禅定模式右侧方向光强度
    // 环境光强度（夜侧更暗，建议较低）；建议 0.05–0.25
    ambientIntensity: 0.06, // 禅定模式环境光强度

    // 自动旋转（进入禅定并稳定后启用）
    autoRotate: {
      enabled: true,            // 开启/关闭自动缓慢转动
      degPerSec: 3.0,           // 旋转速度（度/秒），建议 0.5–5.0
      startDelayMs: 1200,       // 稳定后延迟开启（毫秒），建议 600–2000
    },

    // 着色器参数（昼夜混合）—— 仅禅定使用
    // 终止线柔和度（过渡宽度），越大越柔和；建议 0.12–0.30
    mixSoftness: 0.20, // 昼夜终止线柔和度
    // 混合曲线幂次（形状），>1 更靠近白天侧，<1 更靠近夜侧；建议 0.8–2.0
    mixPower: 1.0, // 昼夜混合曲线幂次
    // 夜侧暗度（乘法系数），<1 变暗；建议 0.70–0.95
    nightDarkness: 0.65, // 夜侧暗度（乘法）
    // 白天对比（仅对白天纹理做伽马调整），>1 提升对比；建议 0.9–1.3
    dayContrast: 1.5, // 白天侧对比（伽马/对比调整）
    // 日夜对比度（整体拉开白天/黑夜差异；围绕 0.5 做线性拉伸），建议 0.8–2.0；1 为不改变
    dayNightContrast: 1.6, // 日夜整体对比拉开
    // 最后整体 gamma（混合后统一调整）；一般保持 1.0
    gamma: 1.0, // 最终整体 gamma

    // 新增：整体曝光（乘法系数，默认 1.0；>1 更亮）。对禅定模式亮度直观有效。
    exposure: 1.6, // 禅定整体曝光（乘法）
    // 新增：白天侧增益（仅对白天侧生效，默认 1.0；>1 更亮）。
    daySideGain: 1.50, // 禅定白天侧增益（乘法）

    // 新增：禅定模式下的星空整体透明度（0~1）。为确保可见暂时提高。
    starOpacity: 0.78, // 禅定模式星空整体透明度（0~1）
    // 新增：禅定模式星点大小缩放
    starSizeScale: 2.0, // 禅定模式星点大小缩放
    // 新增：禅定模式星点亮度增益
    starBrightnessGain: 3.0, // 禅定模式星点亮度增益
    // 新增：禅定模式——全局“呼吸式”闪烁参数（更慢、略强）
    starBreathSpeed: 0.55, // 禅定模式星点“呼吸”速度
    starBreathStrength: 0.50, // 禅定模式星点“呼吸”强度

    // 新增：高光压缩（ToneMap）系数，避免右侧“曝白”发灰；0 关闭
    // 建议范围 0.25–0.45（与 exposure/daySideGain 搭配）
    highlightsRoll: 0.32, // 高光压缩系数（避免过曝发灰）

    // 叠加线（边境/赤道/回归线）亮度调低——仅在禅定下生效
    overlays: {
      // 国家边境线颜色强度系数（乘法因子）；<1 变暗；建议 0.5–0.9
      bordersColorFactor: 0.35, // 国界线颜色强度系数（乘法）
      // 赤道透明度系数（乘法因子）；<1 变淡；建议 0.5–0.9
      equatorOpacityFactor: 0.45, // 赤道线透明度系数（乘法）
      // 回归线透明度系数（乘法因子）；<1 变淡；建议 0.5–0.9
      tropicsOpacityFactor: 0.45, // 回归线透明度系数（乘法）
    },
  },

  moonVoyage: {
    timeline: {
      earthExitSec: 38.0, // 阶段：地球离场总时长（秒）
      earthDisappearAtSec: 32.0, // 地球开始不可见/退出阈值（秒）
      earthFadeSec: 5.4, // 地球淡出时长（秒）
      corridorSec: 40.0, // 阶段：星空长廊持续时长（秒）
      moonApproachSec: 35.0, // 阶段：近月/接近持续时长（秒）
      orbitDurationSec: 130.0, // 阶段：环绕持续时长（秒）
      orbitEnterBlendSec: 0.85, // 环绕入场镜头过渡时长（秒）
      orbitEnterLightBlendSec: 3.0, // 环绕入场灯光过渡时长（秒）
      companionRobot: {
        autoPickBaseSrc: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/Moon/EVA00.png', // EVA 贴图基准文件ID（同目录下自动探测 EVA01~EVA09）
        autoPickCount: 2, // 自动挑选数量（1=只显示 1 个；2=尽量显示 2 个）
        autoPickMaxIndex: 9, // 自动探测最大序号（0~9）
        y01: 0.6, // 双机器人竖向中线（0~1，0.5 为屏中）
        pairSpacingY01: 0.10, // 双机器人上下间距（0~1；0.10≈屏高10%）
        robot1: {
          enabled: true, // 机器人1开关
          src: '', // 机器人1贴图（留空=走 autoPick 随机；填 cloud:// 则固定）
          startDelaySec: 2.0, // 机器人1：相对“长廊开始”的延迟出现时间（秒）
          enterSec: 6.5, // 机器人1：从右侧进入到中间用时（秒；线性匀速）
          cruiseSec: 0.0, // 机器人1：巡航时长（秒；0=自动等于 cruiseScript 计算出来的总时长*cruiseScriptRepeat）
          cruiseScriptRepeat: 1, // 机器人1：脚本循环次数（整数）
          exitSec: 4.5, // 机器人1：从中间离开用时（秒；线性匀速）
          cruiseScript: [ // 机器人1：巡航脚本（hold=停留；move=移动；move 时长=|distanceX01|/speedX01PerSec）
            { type: 'hold', sec: 1.2 }, // 停留几秒（秒）
            { type: 'move', distanceX01: 0.23, speedX01PerSec: 0.02 }, // 回退：向右移动距离/速度
            { type: 'hold', sec: 4.6 }, // 再停留（秒）
            { type: 'move', distanceX01: -0.35, speedX01PerSec: 0.03 }, // 前进：向左移动距离/速度
            { type: 'hold', sec: 2.2 }, // 结束前停留（秒）
          ],
          alphaInSec: 0.8, // 机器人1：淡入时长（秒）
          alphaOutSec: 1.0, // 机器人1：淡出时长（秒）
          sizeScreenH: 0.08, // 机器人1：高度占屏幕比例（0~1）
          bobAmp01: 0.001, // 机器人1：上下波动幅度（0~1）
          bobHz: 0.75, // 机器人1：上下波动频率（Hz）
        },
        robot2: {
          enabled: true, // 机器人2开关
          src: '', // 机器人2贴图（留空=走 autoPick 随机；填 cloud:// 则固定）
          startDelaySec: 8.0, // 机器人2：相对“长廊开始”的延迟出现时间（秒）
          enterSec: 8.5, // 机器人2：从右侧进入到中间用时（秒；线性匀速）
          cruiseSec: 0.0, // 机器人2：巡航时长（秒；0=自动等于 cruiseScript 计算出来的总时长*cruiseScriptRepeat）
          cruiseScriptRepeat: 1, // 机器人2：脚本循环次数（整数）
          exitSec: 3.5, // 机器人2：从中间离开用时（秒；线性匀速）
          cruiseScript: [ // 机器人2：巡航脚本（与机器人1初始一致，后续可独立改）
            { type: 'hold', sec: 2.2 }, // 停留几秒（秒）
            { type: 'move', distanceX01: 0.16, speedX01PerSec: 0.01 }, // 回退：向右移动距离/速度
            { type: 'hold', sec: 2.6 }, // 再停留（秒）
            { type: 'move', distanceX01: -0.33, speedX01PerSec: 0.03 }, // 前进：向左移动距离/速度
            { type: 'hold', sec: 1.2 }, // 结束前停留（秒）
          ],
          alphaInSec: 0.8, // 机器人2：淡入时长（秒）
          alphaOutSec: 1.0, // 机器人2：淡出时长（秒）
          sizeScreenH: 0.08, // 机器人2：高度占屏幕比例（0~1）
          bobAmp01: 0.001, // 机器人2：上下波动幅度（0~1）
          bobHz: 0.95, // 机器人2：上下波动频率（Hz）
        },
      }
    },
    lyrics: {
      preset: 999, // 登月歌词/字幕预设 ID
      offsetMs: 0, // 歌词时间轴偏移（毫秒）
      fadeMs: 350, // 歌词淡入淡出时长（毫秒）
      bottomPx: 44 // 歌词距离底部像素
    },
    earthNear: {
      enabled: true, // 是否启用“地球靠近月球锚点”的镜头/位姿策略
      sizeRatioToMoon: 0.20, // 地球相对月球大小比例
      distR: 2.6, // 地球距离（月球半径倍数）
      sideR: -0.9, // 地球横向偏移（月球半径倍数，负=左）
      upR: 0.60, // 地球竖向偏移（月球半径倍数，正=上）
      azOffsetDeg: 0, // 方位角额外偏移（度）
      transitionSec: 0.25, // 过渡平滑时长（秒）
      viewportMarginNdc: 0.08, // 视口边缘安全区（NDC 0~1）
      occludeFade: false // 是否启用被遮挡时淡出
    },
    starCorridor: {
      seed: 1337, // 星空随机种子（固定则每次一致）
      xMin: -96, // 星空长廊 X 最小值
      xMax: 10, // 星空长廊 X 最大值
      yRange: 60, // 星空长廊 Y 范围（上下跨度）
      zMin: -40, // 星空长廊 Z 最小值（近）
      zMax: -900, // 星空长廊 Z 最大值（远）
      baseLenX: 64, // 基础分段长度（影响密度曲线）
      baseCountAtLen: 3800, // 基础星点数量基准
      beltCountAtLen: 1400, // 行星带星点数量基准
      beltYHalfRange: 3, // 行星带 Y 半宽（越小越集中）
      beltZMin: -120, // 行星带 Z 起点
      beltZMax: -380, // 行星带 Z 终点
      starOpacity: 1.0, // 长廊星点透明度（0~1）
      starSizeScale: 1.6, // 长廊星点大小缩放
      starBrightnessGain: 1.9, // 长廊星点亮度增益
      starBreathSpeed: 0.55, // 长廊星点“呼吸”速度
      starBreathStrength: 0.25, // 长廊星点“呼吸”强度
      scrollSpeed: -9.0, // 长廊滚动速度（负=向前飞）
      yawOffset: 0.85, // 镜头/长廊偏航偏移（增强动感）
      effects: {
        pulse: {
          enabled: true, // 脉冲效果开关（亮度/速度/大小随时间波动）
          centers: [0.32, 0.72], // 脉冲中心位置（0~1，多个峰）
          halfWidth: 0.075, // 脉冲半宽（越大越平缓）
          speedGain: 0.35, // 脉冲对滚动速度的增益
          brightnessGain: 0.28, // 脉冲对亮度的增益
          sizeGain: 0.09, // 脉冲对星点大小的增益
          dustOpacityGain: 0.45 // 脉冲对尘埃层透明度的增益
        },
        roll: {
          enabled: true, // 轻微横滚效果开关（增强穿梭感）
          maxDeg: 0.55, // 最大横滚角度（度）
          freqHz: 0.12, // 横滚频率（Hz）
          fadeInSec: 6.0, // 横滚淡入时长（秒）
          fadeOutSec: 6.0 // 横滚淡出时长（秒）
        },
        companionRobot: {
          enabled: true, // 机器人飞过效果开关
          autoPickBaseSrc: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/Moon/EVA00.png', // EVA 贴图基准文件ID（同目录下自动探测 EVA01~EVA09）
          autoPickCount: 2, // 自动挑选数量（会被 timeline.companionRobot 覆盖）
          autoPickMaxIndex: 9, // 自动探测最大序号（0~9；会被 timeline.companionRobot 覆盖）
          y01: 0.56, // 双机器人竖向中线（0~1，0.5 为屏中；会被 timeline.companionRobot 覆盖）
          pairSpacingY01: 0.10, // 双机器人上下间距（0~1；会被 timeline.companionRobot 覆盖）
          robot1: {
            enabled: true, // 机器人1开关
            src: '', // 机器人1贴图（留空=走 autoPick 随机）
            startDelaySec: 1.0, // 机器人1：默认延迟（会被 timeline.companionRobot 覆盖）
            enterSec: 3.0, // 机器人1：进场时长（会被 timeline.companionRobot 覆盖）
            cruiseSec: 0.0, // 机器人1：巡航总时长（秒；0=自动；会被 timeline.companionRobot 覆盖）
            cruiseScriptRepeat: 1, // 机器人1：脚本循环次数（会被 timeline.companionRobot 覆盖）
            exitSec: 3.0, // 机器人1：离场时长（会被 timeline.companionRobot 覆盖）
            cruiseScript: [ // 机器人1：巡航脚本（会被 timeline.companionRobot 覆盖）
              { type: 'hold', sec: 1.2 }, // 停留几秒（秒）
              { type: 'move', distanceX01: 0.08, speedX01PerSec: 0.04 }, // 回退：向右移动距离/速度
              { type: 'hold', sec: 0.6 }, // 再停留（秒）
              { type: 'move', distanceX01: -0.08, speedX01PerSec: 0.04 }, // 前进：向左移动距离/速度
              { type: 'hold', sec: 0.2 }, // 结束前停留（秒）
            ],
            alphaInSec: 0.8, // 机器人1：淡入时长（秒）
            alphaOutSec: 1.0, // 机器人1：淡出时长（秒）
            glow: { enabled: true, color: 0x9be3ff, opacity: 0.35, scaleMul: 1.35 }, // 机器人1：光晕
            depth: 2.4, // 机器人1：距离相机深度（越大越小）
            sizeScreenH: 0.05, // 机器人1：高度占屏幕比例（0~1）
            startX01: 1.18, // 机器人1：起始 X（>1 表示屏外右侧）
            midX01: 0.52, // 机器人1：中间停留 X
            endX01: -0.18, // 机器人1：结束 X（<0 表示屏外左侧）
            bobAmp01: 0.008, // 机器人1：上下漂浮幅度（0~1）
            bobHz: 0.75 // 机器人1：上下漂浮频率（Hz）
          },
          robot2: {
            enabled: true, // 机器人2开关
            src: '', // 机器人2贴图（留空=走 autoPick 随机）
            startDelaySec: 1.0, // 机器人2：默认延迟（会被 timeline.companionRobot 覆盖）
            enterSec: 3.0, // 机器人2：进场时长（会被 timeline.companionRobot 覆盖）
            cruiseSec: 0.0, // 机器人2：巡航总时长（秒；0=自动；会被 timeline.companionRobot 覆盖）
            cruiseScriptRepeat: 1, // 机器人2：脚本循环次数（会被 timeline.companionRobot 覆盖）
            exitSec: 3.0, // 机器人2：离场时长（会被 timeline.companionRobot 覆盖）
            cruiseScript: [ // 机器人2：巡航脚本（会被 timeline.companionRobot 覆盖）
              { type: 'hold', sec: 1.2 }, // 停留几秒（秒）
              { type: 'move', distanceX01: 0.08, speedX01PerSec: 0.04 }, // 回退：向右移动距离/速度
              { type: 'hold', sec: 0.6 }, // 再停留（秒）
              { type: 'move', distanceX01: -0.08, speedX01PerSec: 0.04 }, // 前进：向左移动距离/速度
              { type: 'hold', sec: 0.2 }, // 结束前停留（秒）
            ],
            alphaInSec: 0.8, // 机器人2：淡入时长（秒）
            alphaOutSec: 1.0, // 机器人2：淡出时长（秒）
            glow: { enabled: true, color: 0x9be3ff, opacity: 0.35, scaleMul: 1.35 }, // 机器人2：光晕
            depth: 2.4, // 机器人2：距离相机深度（越大越小）
            sizeScreenH: 0.05, // 机器人2：高度占屏幕比例（0~1）
            startX01: 1.18, // 机器人2：起始 X（>1 表示屏外右侧）
            midX01: 0.52, // 机器人2：中间停留 X
            endX01: -0.18, // 机器人2：结束 X（<0 表示屏外左侧）
            bobAmp01: 0.008, // 机器人2：上下漂浮幅度（0~1）
            bobHz: 0.75 // 机器人2：上下漂浮频率（Hz）
          },
        }
      }
    },
    exit: {
      fadeInMs: 2000, // 退出登月：淡入黑屏/遮罩时长（毫秒）
      holdMs: 1500, // 退出登月：全黑停留时长（毫秒）
      fadeOutMs: 2000 // 退出登月：淡出黑屏/遮罩时长（毫秒）
    }
  },

  
  // -------------------- 全局 --------------------
  // [禅定诗句] 动画参数（集中管理，便于微调）
  // 诗句淡入淡出、显示时长、拖影/描边与运动速度等。
  poetry: {
    // 淡入/淡出时长（毫秒）
    fadeInMs: 1200, // 诗句淡入时长（毫秒）
    fadeOutMs: 1200, // 诗句淡出时长（毫秒）
    // 关闭 3D 诗句，恢复 DOM 竖版呈现（writing-mode: vertical-rl）
    use3D: false, // 是否使用 3D 诗句（false=DOM 竖排）
    // 单句停留显示时长（毫秒；若预设中有自定义 duration 则以预设为准）
    displayMs: 10000, // 单句停留显示时长（毫秒）
    // 开关：以哪边为准（true=优先使用每句的 duration；false=以上面的 displayMs 为准）
    preferLineDuration: true, // 优先使用每句自带 duration
    offsetMs: -1200, // 诗句时间偏移（毫秒）
    // 竖排诗句字号（px），用于页面样式绑定
    fontSizePx: 24, // 诗句字号（px）
    // 诗句移动速度（px/s）：值越大移动越快
    movePxPerSec: 8, // 诗句移动速度（px/s）
    // 句间交替时长（毫秒）：上一句淡出与下一句淡入的重叠时间
    // 逻辑调整：Duration 现定义为“Start-to-Start”间隔。此参数仅决定重叠的视觉效果，不影响总时长。
    crossfadeMs: 800, // 句间交替重叠时长（毫秒）
    // 屏幕安全边界（px）：与四边保持的最小距离，防止抛出屏幕
    safeMarginPx: 18, // 屏幕安全边界（px）
    // 下一句首字贴近上一句首字的最大距离（px；越小越贴近）
    nextStartMaxDistancePx: 10, // 下一句首字贴近上一句首字的最大距离（px）
    // 首句初始位置接近屏幕中心的比例（0–1），如 0.35 表示中心±35%范围内随机
    initialCenterRatio: 0.55, // 首句初始位置靠近中心的比例（0~1）
    // 调试日志（开发阶段打开以观察位置与边界修正）
    debugLog: false, // 是否输出诗句布局调试日志
    // 拖影（禅定模式）：白色渐变拖影，长度与层数可调
    trail: {
      enabled: true,       // 仅在禅定模式下启用
      layers: 4,           // 阶梯层数（越多越长越柔）
      maxBlurPx: 8,        // 最大模糊半径（px），从 0 渐增到此值
      maxAlpha: 0.35       // 最大不透明度（最靠近文字的拖影更亮）
    },
    // 可读性：给文字加轻微黑描边（使用 text-shadow 模拟）
    outline: {
      enabled: true, // 是否启用描边（text-shadow 模拟）
      thicknessPx: 0.8     // 描边粗细（通过阴影半径近似）
    }
    ,
    // Special 字符串展示（彩蛋）参数：统一配置便于后续微调
    special: {
      fontSizePx: 36,          // Special 大字号（px）
      fadeInMs: 2000,          // 1 秒淡入
      fadeOutMs: 2000,         // 2 秒淡出
      displayMs: 10000,        // 显示 10 秒
      movePxPerSec: 10,        // 缓慢移动速度（px/s）
      upperCenterYRatio: 0.65, // 移动偏向屏幕中上方的比例
      tapTolerancePx: 22       // 时间胶囊点击容忍扩展半径（px，缩小以避免遮挡按钮）
    }
  },

  
  // [通用] 地球基础材质（Phong）
  // 高光强度等基础材质参数，适用于所有模式。
  earthMaterial: {
    // 高光强度（越大高光越明显）；建议 4–16
    shininess: 8,
  },
  
  // [相机缩放] 配置最大/最小缩放（zoom 值越大越近）
  // 全局相机限制与初始视角中心。
  camera: {
    minZoom: 0.60,           // 最小缩放（最远）
    maxZoom: 3.43,           // 最大缩放（更近，比原先 +20%）
    // 初始视觉中心（普通模式）：北京（度）。如需更改，修改此处即可。
    // 说明：lat 为纬度（北纬为正），lon 为经度（东经为正）。
    initialCenterDeg: { lat: 39.9042, lon: 116.4074 } // 初始视角中心点（纬度/经度，度）
  },
  
  // [云能力] 在本地静态预览时关闭云调用，避免控制台刷屏报错
  // 纹理加载与独立云层旋转设置。
  cloud: {
    enabled: true,           // 开启纹理加载；UI 默认关闭可见性
    // 云层独立慢速转动（度/秒；0 关闭）。不依赖禅定自动转动。
    spinDegPerSec: 2.0 // 云层自转速度（度/秒）
  },
  
  // [国家高亮] 填充透明度（0~1）。提高到 0.8–1.0 可形成“不透明方式”。
  // 高亮淡出时长与“自动取消背面选中”策略。
  highlight: {
    fillOpacity: 0.75, // 国家高亮填充透明度（0~1）
    // 高亮消失淡出时长（毫秒）
    fadeOutMs: 1500, // 高亮淡出时长（毫秒）
    // 自动取消选中：当选中国家大部分进入背面时清除高亮（避免穿模）
    autoClearOnBackside: {
      enabled: true,          // 开启自动取消背面选中
      minVisibleRatio: 0.50,  // 前半球可见比例阈值（<=10% 即 90% 在背面）
      checkIntervalMs: 500,   // 检查间隔，毫秒
      requireConsecutive: 2   // 连续判定次数，避免抖动
    }
  },
  // 未来扩展：在此添加其他常用可调项（示例）
  // camera: { defaultZoom: 1.0 },
  // labels: { fontSize: 14 },
  
  // [边界校正] 形变网格（Warp）参数
  // 边界微位移与调试箭头显示。
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

import { getSystemInfo } from './sys-info.js';

export function isDevtools(){ // 是否运行在微信开发者工具环境
  try {
    const info = getSystemInfo();
    const env = String(info?.environment || '').toLowerCase();
    return env === 'devtools';
  } catch(_) { return false; }
}

export const LOG = {
  info: (...a) => { try { console.info(...a); } catch(_){} }, // 统一 info 日志封装
  warn: (...a) => { try { console.warn(...a); } catch(_){} }, // 统一 warn 日志封装
  error: (...a) => { try { console.error(...a); } catch(_){} }, // 统一 error 日志封装
};
