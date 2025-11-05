// modules/label-constants.js
// 职责：集中管理所有与标签系统相关的常量，方便统一调整。

// --- 基础显示与淡入淡出 ---
export const LABEL_CUTOFF = 0.0;          // 标签背对相机角度的截止点
export const LABEL_FADEIN = 0.35;         // 标签完全显示的角度阈值
export const EDGE_FADE_PX = 28;           // 标签靠近屏幕边缘时的淡出像素距离

// --- 性能与网格 ---
export const GRID_SIZE = 82;              // 用于碰撞检测的网格大小（像素）
export const LABEL_SELECT_INTERVAL_MS = 10; // 重新选择标签的间隔时间（毫秒）

// --- 粘滞效果 ---
export const STICKY_SWITCH_GAIN = 0.40;   // 新标签需要比旧标签高多少分才能替换它
export const STICKY_LABEL_BONUS = 0.25;   // 之前显示过的标签获得的分数加成

// --- 动画平滑 ---
export const POS_SMOOTH = 0.50;           // 位置移动的平滑系数
export const ALPHA_SMOOTH = 0.32;         // 透明度变化的平滑系数

// --- 动态字体大小 ---
export const FONT_SCALE_MIN_DIST = 3.5;   // 开始缩放字体的相机最近距离
export const FONT_SCALE_MAX_DIST = 6.0;   // 停止缩放字体的相机最远距离

// --- LOD (Level of Detail) 国家 ---
export const LOD_NEAR_DIST_COUNTRY = 4.0; // 国家的“近”层级距离
export const LOD_FAR_DIST_COUNTRY = 10.0; // 国家的“远”层级距离
export const AREA_MIN_FAR = 200000;       // 远距离时隐藏的最小面积
export const AREA_MIN_MID = 60000;        // 中距离时隐藏的最小面积
export const POP_MIN_FAR = 10000000;      // 远距离时隐藏的最小人口
export const POP_MIN_MID = 3000000;       // 中距离时隐藏的最小人口

// --- LOD (Level of Detail) 城市 ---
export const LOD_CITIES_START_APPEAR = 8.0; // 城市标签开始出现的相机距离
export const LOD_CITIES_ALL_APPEAR = 5.5;   // 所有重要城市都出现的相机距离

// --- 评分权重 ---
export const SCORE_BONUS_COUNTRY = 2.0;   // 国家标签的基础分数加成
export const SCORE_BONUS_CITY = 1.2;      // 城市标签的基础分数加成
export const IMPORTANCE_BONUS_FACTOR = 0.3; // “重要性”属性对分数的加成系数

// --- 中心强制显示 ---
export const FORCE_DISPLAY_MAX_DIST = 4.0;        // 强制显示生效的相机最大距离
export const FORCE_DISPLAY_RADIUS_PX = 50;        // 屏幕中心的强制显示半径（像素）
export const FORCE_DISPLAY_SCORE_MULTIPLIER = 1000; // 对中心区域标签的分数乘数