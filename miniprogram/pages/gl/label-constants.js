// 标签系统规则手册：集中配置所有可调参数
// 该文件为纯常量导出，避免在运行时产生副作用。

// 屏幕碰撞网格大小（像素）
export const GRID_SIZE = 52;               // 屏幕碰撞网格大小（像素）
export const MAX_LABELS_BUDGET = 22;       // 每帧最多显示的标签数量
export const LABEL_FADEIN = 0.16;          // 每帧淡入速度
export const FONT_COUNTRY_BASE = 16;       // 国家标签基准字体（px）较小
export const FONT_CITY_BASE = 14;          // 城市标签基准字体（px）较小
export const CITY_WORLD_HEIGHT = 0.08;     // 城市标签在球面上的世界高度（相对半径）略降
export const LABEL_ALTITUDE = 0.02;        // 标签在球面上的提起高度（相对半径）
export const CENTER_PRIORITY = 1.2;        // 中心优先权重
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
export const INTERACTION_DEBUG_LOG = true;   // 交互与搜索相关日志开关（临时开启用于惯性诊断）
// 新增：像素级边缘淡出边距（四边最小像素距离）
export const EDGE_FADE_PX = 28;              // 与 labels.js 使用保持一致

// 新增：优先展示国家标签的预算保底
export const COUNTRY_MIN_WINNERS = 12;        // 每帧至少选出的国家标签数量（若候选不足则让位）

// 新增：城市/国家标签的颜色配置（城市偏淡）
export const COUNTRY_TEXT_COLOR = '#ffffff';  // 国家标签文本颜色
export const CITY_TEXT_COLOR = '#d7e1ea';     // 城市标签文本颜色（更淡）
export const CITY_STROKE_WIDTH = 2;           // 城市标签描边略薄
// 新增：城市标签字体可配置项（权重/字体族）
export const CITY_FONT_WEIGHT = 400;          // 100~900
export const CITY_FONT_FAMILY = 'sans-serif';

// 新增：城市标签的 LOD（相机距离阈值），与 WinReference 对齐
export const LOD_CITIES_START_APPEAR = 8.0;   // 相机距离小于该值开始显示城市
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

// 新增：近距字体缩放的最小比例（默认 0.75，调大会让靠近时更醒目）
export const NEAR_FONT_SCALE_MIN       = 0.75; // 近距最小缩放系数（0.75~1.0），例如想更大可设 0.9
export const NEAR_FONT_DIST            = 4.0;  // 近距判定阈值（相机距离）

// 新增：屏幕像素级字号上下限（避免靠近时过大/远离时过小）
export const FONT_MAX_SCREEN_PX_COUNTRY = 40;  // 国家标签最大像素高度（+2px）
export const FONT_MAX_SCREEN_PX_CITY    = 26;  // 城市标签最大像素高度（+2px）
export const FONT_MIN_SCREEN_PX_COUNTRY = 26;  // 国家标签最小像素高度（+2px）
export const FONT_MIN_SCREEN_PX_CITY    = 20;  // 城市标签最小像素高度（+2px）

// 新增：调试日志总开关（降低控制台噪音）
// deprecated: 使用统一的 LABELS_DEBUG_LOG / INTERACTION_DEBUG_LOG；避免重复导出产生冲突
// export const LABEL_DEBUG_LOG = false;
// export const INTERACTION_DEBUG_LOG = false;

// —— 新增：中心保底与前半球点击阈值（用于强制居中城市显示与避免穿模）
// 当城市属于被选中国家且中心权重≥该值时，硬保底显示（即使预算/网格紧张）。
export const MUST_CENTER_WEIGHT_CITY = 0.94;
// 点击命中前半球最小点积阈值：要求 ≥0 表示严格前半球；如需宽容边缘可改为 0.02。
export const FRONT_DOT_MIN_EDGE = 0.02;
// 点击候选中心距离上限（度）：过滤明显远离点击点的国家，防止跨经线误命中
export const HIT_CENTER_MAX_DEG = 60;