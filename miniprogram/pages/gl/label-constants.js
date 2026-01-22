// 标签系统规则手册：集中配置所有可调参数
// 该文件为纯常量导出，避免在运行时产生副作用。

// 屏幕碰撞网格大小（像素）
export const GRID_SIZE = 64;               // 52 -> 64 (降低密度)
export const MAX_LABELS_BUDGET = 18;       // 22 -> 18 (减少数量)
export const LABEL_FADEIN = 0.16;          // 每帧淡入速度
export const FONT_COUNTRY_BASE = 16;  // 18->16
export const FONT_CITY_BASE = 10;     // 12->10

// 基础世界高度：调和方案 (0.08)，既不微小也不巨大
export const CITY_WORLD_HEIGHT = 0.04;       // 0.05 -> 0.04 (配合近距缩放)
export const DEFAULT_WORLD_HEIGHT = 0.10;    // 0.12 -> 0.10 (国家标签同步微调)

export const AREA_WEIGHT = 1.0;            // 面积权重（国家）
export const SCORE_THRESHOLD = 0.22;       // 入选最低分阈值
export const TEXT_LENGTH_DECAY = 0.012;    // 文本长度对字体大小的衰减因子
export const ENABLE_CITY_LABELS = true;    // 是否启用城市标签（默认打开，可按需关闭）

// 可根据不同机型/分辨率进行适配的开关
export const DYNAMIC_FONT_BY_DISTANCE = true; // 根据相机距离动态缩放字体

// 新增：透明度平滑跟随系数（与 labels.js 逻辑对齐）
export const OPACITY_FOLLOW = 0.25;          // 0~1，越大跟随越快

// 新增：统一调试日志开关（收敛控制台输出）
export const LABELS_DEBUG_LOG = false;       // 标签系统日志开关
export const INTERACTION_DEBUG_LOG = false;  // 交互与搜索相关日志开关（默认为 false）
// 新增：像素级边缘淡出边距（四边最小像素距离）
export const EDGE_FADE_PX = 28;              // 与 labels.js 使用保持一致

// 新增：优先展示国家标签的预算保底
export const COUNTRY_MIN_WINNERS = 4;        // 12 -> 4 (减少强制显示的个数)

// 新增：城市/国家标签的颜色配置（城市偏淡）
export const COUNTRY_TEXT_COLOR = '#ffffff';  // 国家标签文本颜色
export const CITY_TEXT_COLOR = '#0b2d52';     // 深蓝文字 (配合白底)
export const CITY_BG_COLOR = 'rgba(255,255,255,0.85)'; // 白底半透明 (胶囊背景)

export const CITY_USE_CAPSULE = true;         // 恢复胶囊背景 (用户要求保留)
export const CITY_STROKE_WIDTH = 0;           // 胶囊模式下无需描边，保持清爽
export const CITY_FONT_WEIGHT = '600';        // bold -> 600 (减轻视觉重量)
export const CITY_FONT_FAMILY = 'sans-serif';
export const CITY_PADDING_PX = 4;             // 6->4 (更紧凑)

// 纹理分辨率倍率：从 3.0 降回 1.5。配合 Mipmap 使用，1.5倍足够清晰且不浪费
// 之前 3.0 导致纹理过大，缩小时反而出现严重的锯齿（aliasing）
export const RES_SCALE = 1.3;

// 城市显示的绝对距离门槛：严格控制
// 只有当相机距离小于此值时，城市才允许显示（无论是否选中）
export const LOD_CITIES_START_APPEAR = 3.5;
export const LOD_CITIES_ALL_APPEAR   = 5.5;   // 更近时显示更多级别城市
// 新增：当屏幕上的城市候选数量不超过该阈值时，全部显示（忽略优先级）
export const CITY_SHOW_ALL_THRESHOLD = 12;

// 新增：远距行为配置
export const FAR_FONT_STABLE_DIST      = 8.0;  // 超过该距离字体不再继续变小（稳定为 1.0）

// —— 新增：性能模式开关（拖动时临时降级，静止后恢复），均为安全默认值
export const PERF_DRAG_LABEL_BUDGET_SCALE = 0.7; // 拖动中标签预算缩放比例（0.7 约降至 16）
export const PERF_DRAG_RESTORE_IDLE_MS = 500;    // 触摸结束后等待多少毫秒再恢复
export const PERF_HIDE_MARKERS_ON_DRAG = true;   // 拖动时隐藏城市光点
export const PERF_HIDE_STAR_ON_DRAG = false;     // 拖动时不隐藏星空背景（保持呼吸独立于交互）
// 兼容旧名（避免 main.js 现有导入报错）
export const PERF_HIDE_STAR_ON_ON_DRAG = PERF_HIDE_STAR_ON_DRAG;

// —— 新增：惯性映射配置（便于快速回滚/调参）
// 惯性映射与日志配置（集中常量，便于调参）
export const INERTIA_NONLINEAR = true;        // 非线性映射：增强中高档位差异
export const INERTIA_POWER = 3.0;             // 指数（>1 更陡，3.0：低档位明显更“刹”）
export const INERTIA_DAMP_MIN = 0.90;         // 阻尼下限（低档位更易停）
export const INERTIA_DAMP_MAX = 0.9997;       // 阻尼上限（高档位更“滑”）
export const INERTIA_SPEED_MIN = 0.06;        // 单帧最大角速度下限
export const INERTIA_SPEED_MAX = 0.40;        // 单帧最大角速度上限（提高 100 档上限）
export const INERTIA_GAIN_BASE = 0.20;        // 拖动速度增益基数
export const INERTIA_GAIN_SCALE = 3.0;        // 拖动速度增益缩放

// 诊断日志节流：避免刷屏
export const INERTIA_LOG_DETAIL = true;       // 开启详细日志
export const INERTIA_LOG_THROTTLE_MS = 120;   // 拖动日志节流间隔
export const INERTIA_APPLY_LOG_THROTTLE_MS = 250; // 惯性渲染日志节流间隔
export const FAR_COUNTRY_ONLY_DIST     = 7.8;  // 超过该距离仅显示中心国家标签
export const FAR_CENTER_WEIGHT_MIN     = 0.70; // 远距时中心权重最低要求（越靠屏幕中心越容易显示）
// 补充：以初始相机距离为参考的远距比例阈值（适配不同屏幕纵横比）
export const FAR_DISTANCE_RATIO        = 1.25; // camDist / initCamDist >= 该比例时进入远距模式

// 新增：近距字体缩放的最小比例（0.35：显著缩小，确保贴脸时不到原来的一半）
export const NEAR_FONT_SCALE_MIN       = 0.25; // 0.40 -> 0.25 (贴脸时缩得更小)
export const NEAR_FONT_DIST            = 4.5;

// 新增：屏幕像素级字号上下限（回归理性区间）
// 注意：此处单位为逻辑像素（CSS像素）。
export const FONT_MAX_SCREEN_PX_COUNTRY = 48;  // 64 -> 48 (限制国家不过大)
export const FONT_MAX_SCREEN_PX_CITY    = 14;  // 16 -> 14 (进一步压低最大字号)
export const FONT_MIN_SCREEN_PX_COUNTRY = 16;  // 24 -> 16
export const FONT_MIN_SCREEN_PX_CITY    = 8;   // 12 -> 8 (解锁下限，允许变得更小)

// —— 新增：中心保底与前半球点击阈值（用于强制居中城市显示与避免穿模）
// 当城市属于被选中国家且中心权重≥该值时，硬保底显示（即使预算/网格紧张）。
export const MUST_CENTER_WEIGHT_CITY = 0.94;
// 点击命中前半球最小点积阈值：要求 ≥0 表示严格前半球；如需宽容边缘可改为 0.02。
export const FRONT_DOT_MIN_EDGE = 0.02;
// 点击候选中心距离上限（度）：过滤明显远离点击点的国家，防止跨经线误命中
export const HIT_CENTER_MAX_DEG = 60;

export const TAP_MAX_MOVE_PX = 6;
export const TAP_MAX_DURATION_MS = 250;
export const DRAG_BASE_STEP = 0.005;
export const DRAG_ZOOM_MIN = 0.6;
export const DRAG_SPEED_EXP = -0.9;
export const DRAG_SPEED_SCALE = 1.08;
export const DEBUG_SELECT = false;
export const PERF_DIAG_LOG = false;