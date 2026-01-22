import { APP_CFG } from './config.js';

export const getInitialData = () => ({
  currentTime: '--:--:--',
  hoverText: '',
  countryPanelTop: 0,
  // PC 端滚轮代理：scroll-view 的滚动位置维持为 0，避免视觉滚动
  scrollTop: 0,
  // UI 可见缩放值（与原 slider 双向同步）
  uiZoom: 1.0,
  // 由配置驱动的缩放边界，供底部 slider 使用
  uiZoomMin: (APP_CFG?.camera?.minZoom ?? 0.6),
  uiZoomMax: (APP_CFG?.camera?.maxZoom ?? 2.86),
  // PC 端判断与页面滚动锚点
  isPC: false,
  lastPageScrollTop: 0,
  pageScrollAnchor: 0,
  // 移除原有 DOM 标签数组，改为 Three.js 文本渲染
  // labels: [],
  // 语言与设置
  lang: 'zh', // zh/en
  settingsOpen: false,
  nightMode: false,
  theme: 'default', // default/day8k/night
  showCloud: false,
  labelQty: 'default', // none/few/default/many
  cityTier: 'default',
  // 设置面板运行时定位与尺寸（左对齐语言按钮、右对齐时间胶囊）
  settingsPanelLeft: 0,
  settingsPanelWidth: 320,
  // 惯性（0-100）：控制旋转阻尼与速度上限，默认 75%
  inertiaPct: 30,
  // 国家信息面板
  countryPanelOpen: false,
  countryInfo: null,
  // 面板淡出控制（禅定模式进入时 0.5s 退场）
  settingsFading: false,
  countryPanelFading: false,
  panelFadeMs: (APP_CFG?.ui?.panelFadeMs ?? 500),
  // 底部缩放条：可见性开关（不可见则不可用）
  showZoomBar: (APP_CFG?.ui?.showZoomBar ?? true),
  // 小标题多语言映射与当前标签集
  uiLabels: {
    zh: { capital: '首都', area: '面积', population: '人口', gdp: 'GDP' },
    en: { capital: 'Capital', area: 'Area', population: 'Population', gdp: 'GDP' }
  },
  labels: { capital: '首都', area: '面积', population: '人口', gdp: 'GDP' },
  // 与时间胶囊严格等宽：运行时测量得到的像素宽度
  countryPanelWidth: null,
  // 搜索面板
  searchOpen: false,
  searchQuery: '',
  suggestions: [],
  // 禅定模式开关（仅UI显隐与面板关闭，不改变渲染逻辑）
  zenMode: false,
  moonVoyageActive: false,
  moonTimeVisible: false,
  moonTimerText: '',
  moonPhaseText: '',
  moonLyricA: { text: '', visible: false },
  moonLyricB: { text: '', visible: false },
  moonLyricFadeMs: Math.max(0, Number(APP_CFG?.moonVoyage?.lyrics?.fadeMs ?? 350) || 0),
  moonLyricBottomPx: Math.max(0, Number(APP_CFG?.moonVoyage?.lyrics?.bottomPx ?? 44) || 0),
  cloudMoonButtonFileId: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/Moon/moon_buttom.png',
  moonBtnUrl: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/Moon/moon_buttom.png',
  globalBlackMask: false,
  globalBlackMaskOpacity: 0,
  globalBlackMaskFadeMs: 0,
  presetListOpen: false,
  presetList: [],
  currentPreset: 1,
  presetListRight: 8,
  presetListTop: 0,
  presetLatched: false,
  presetPinnedId: null,
  presetPinnedDy: 0,
  presetCollapsed: false,
  presetListOpacity: 1,
  // 禅定诗句当前文本（进入禅定后循环显示）
  poetryFadeMs: 600,
  // 诗句字号（来自配置）
  poetryFontSizePx: (APP_CFG && APP_CFG.poetry && Number(APP_CFG.poetry.fontSizePx)) ? Math.max(8, Number(APP_CFG.poetry.fontSizePx) - 2) : 14,
  // 英文/中文切换时用于还原的基准字号
  poetryFontSizeBasePx: (APP_CFG && APP_CFG.poetry && Number(APP_CFG.poetry.fontSizePx)) ? Math.max(8, Number(APP_CFG.poetry.fontSizePx) - 2) : 14,
  // 诗句移动与交替配置（从 config.js 读取并缓存，便于绑定与逻辑使用）
  poetryCrossfadeMs: (APP_CFG && APP_CFG.poetry && Number(APP_CFG.poetry.crossfadeMs)) ? Number(APP_CFG.poetry.crossfadeMs) : 1000,
  poetryMovePxPerSec: (APP_CFG && APP_CFG.poetry && Number(APP_CFG.poetry.movePxPerSec)) ? Number(APP_CFG.poetry.movePxPerSec) : 36,
  poetrySafeMarginPx: (APP_CFG && APP_CFG.poetry && Number(APP_CFG.poetry.safeMarginPx)) ? Number(APP_CFG.poetry.safeMarginPx) : 18,
  // 下一句首字贴近上一句首字的最大距离（px）
  poetryNextStartMaxDistancePx: (APP_CFG && APP_CFG.poetry && Number(APP_CFG.poetry.nextStartMaxDistancePx)) ? Number(APP_CFG.poetry.nextStartMaxDistancePx) : 20,
  poetryInitialCenterRatio: (APP_CFG && APP_CFG.poetry && Number(APP_CFG.poetry.initialCenterRatio)) ? Number(APP_CFG.poetry.initialCenterRatio) : 0.35,
  // 双层容器（A/B）用于句间交替与位移
  poetryA: { text: '', x: 0, y: 0, tx: 0, ty: 0, moveMs: 0, visible: false },
  poetryB: { text: '', x: 0, y: 0, tx: 0, ty: 0, moveMs: 0, visible: false },
  poetryAFirst: false,
  poetryBFirst: false,
  // 诗句残影层：由 _startPoetry 按配置生成，按偏移/透明度渲染
  // 移除拖影层：保留纯文字项以降低资源消耗
  // 云端音频 FileID（只走云端，不再回退本地）
  // 与贴图保持一致的 fileID 格式：cloud://<env>.<bucket>/path
  cloudZen1FileId: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/zen-1.aac',
  // 新上传的禅定音乐（preset2）：Zen-2.mp3 的云文件ID
  cloudZen2FileId: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/Zen-2.mp3',
  // 新增第三首禅定音乐（preset3）：Zen-3.mp3 的云文件ID（来自你的截图）
  cloudZen3FileId: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/Zen-3.mp3',
  cloudZen4FileId: '',
  // —— 彩蛋：时间胶囊感应区与 Special 文本展示 ——
  eggSensorVisible: false,
  eggSensorLeft: 0,
  eggSensorTop: 0,
  eggSensorWidth: 80,
  eggSensorHeight: 40,
  // 亮度竖条感应区（隐藏但可触控）：在普通模式下可用
  brightnessSensorVisible: false,
  brightnessSensorLeft: 0,
  brightnessSensorTop: 0,
  brightnessSensorWidth: 0,
  brightnessSensorHeight: 0,
  brightnessScale: Number(APP_CFG?.brightness?.default ?? 0.85),
  // Special 展示状态（水平排布、轻微放大、淡入/缓慢移动/淡出）
  specialVisible: false,
  specialText: '',
  specialFontSizePx: (APP_CFG && APP_CFG.poetry && APP_CFG.poetry.special && Number(APP_CFG.poetry.special.fontSizePx)) ? Math.max(8, Number(APP_CFG.poetry.special.fontSizePx) - 2) : 34,
  // 淡入默认 1 秒（进入时）；淡出默认 2 秒（离开时）
  specialFadeMs: (APP_CFG && APP_CFG.poetry && APP_CFG.poetry.special && Number(APP_CFG.poetry.special.fadeInMs)) ? Number(APP_CFG.poetry.special.fadeInMs) : 1000,
  specialMoveMs: (APP_CFG && APP_CFG.poetry && APP_CFG.poetry.special && Number(APP_CFG.poetry.special.displayMs)) ? Number(APP_CFG.poetry.special.displayMs) : 10000,
  specialScale: 1.08,
  specialX: 0,
  specialY: 0,
  specialTx: 0,
  specialTy: 0,
  // 地球加载中提示
  loading: true,
});
