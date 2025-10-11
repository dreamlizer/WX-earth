// 标签系统规则手册：集中配置所有可调参数
// 该文件为纯常量导出，避免在运行时产生副作用。

// 屏幕碰撞网格大小（像素）
export const GRID_SIZE = 52;               // 屏幕碰撞网格大小（像素）
export const MAX_LABELS_BUDGET = 22;       // 每帧最多显示的标签数量
export const LABEL_FADEIN = 0.16;          // 每帧淡入速度
export const LABEL_FADEOUT = 0.14;         // 每帧淡出速度
export const EDGE_FADE_START = 0.68;       // 视野边缘开始淡出（规范化 0~1）
export const EDGE_FADE_END = 0.95;         // 视野边缘完全淡出（规范化 0~1）
export const FONT_COUNTRY_BASE = 20;       // 国家标签基准字体（px）
export const FONT_CITY_BASE = 15;          // 城市标签基准字体（px）
export const LABEL_ALTITUDE = 0.02;        // 标签在球面上的提起高度（相对半径）
export const CENTER_PRIORITY = 1.2;        // 中心优先权重
export const AREA_WEIGHT = 1.0;            // 面积权重（国家）
export const SCORE_THRESHOLD = 0.22;       // 入选最低分阈值
export const TEXT_LENGTH_DECAY = 0.012;    // 文本长度对字体大小的衰减因子
export const ENABLE_CITY_LABELS = false;   // 是否启用城市标签（可按需打开）

// 可根据不同机型/分辨率进行适配的开关
export const DYNAMIC_FONT_BY_DISTANCE = true; // 根据相机距离动态缩放字体
export const CLAMP_TO_VIEWPORT = true;        // 超出屏幕的标签进行裁剪