// 诗句预设：从 index.js 提取为独立模块，便于维护与云同步
export const POETRY_PRESETS = {
  // poetry-1：先准备好（与 zen-1 搭配）。可按需调整显示顺序和时长。
  1: [
    // 原有六句：去除尾部句号
    { text: '天体运行，周而复始', duration: 7000 },
    { text: '星汉灿烂，若出其里', duration: 7000 },
    { text: '日月之行，若出其中', duration: 7000 },
    { text: '俯察品类之盛，仰观宇宙之大', duration: 8000 },
    { text: '寄蜉蝣于天地，渺沧海之一粟', duration: 8000 },
    { text: '此中有真意，欲辨已忘言', duration: 7000 },
    // 新增诗句（zen-1 对应），已移除尾部句号（保留问号）
    { text: '天地玄黄，宇宙洪荒', duration: 7000 },
    { text: '日月盈昃，辰宿列张', duration: 7000 },
    { text: '北辰高悬，众星共之', duration: 7000 },
    { text: '列星随旋，日月递炤', duration: 7000 },
    { text: '天高地迥，觉宇宙之无穷', duration: 7000 },
    { text: '日月安属，列星安陈？', duration: 7000 },
    { text: '星垂平野阔，月涌大江流', duration: 7000 },
    { text: '银汉迢迢，星河欲转', duration: 7000 },
    { text: '寥廓苍天，斗转星移', duration: 7000 },
    { text: '上下未形，何由考之？', duration: 7000 },
    { text: '冥昭瞢暗，谁能极之？', duration: 7000 },
    { text: '角宿未旦，曜灵安藏？', duration: 7000 },
    { text: '乾坤浩荡，日月昭昭', duration: 7000 },
    { text: '天旋地转，万物萧然', duration: 7000 },
    { text: '云汉昭回，日月光华', duration: 7000 },
    { text: '巡天遥看，一千河', duration: 7000 },
    { text: '浩浩乎，如冯虚御风', duration: 8000 },
    { text: '茫茫宇宙，渺渺太虚', duration: 7000 },
    { text: '周流六虚，无有止息', duration: 7000 },
    { text: '四方上下，谓之宇也', duration: 7000 }
  ],
  // poetry-2：占位（后续你上传 zen-2 后可替换具体诗句）
  2: [
    { text: '风起于青萍之末。', duration: 7000 },
    { text: '水落而石出。', duration: 7000 },
    { text: '山高月小，水落石出。', duration: 7000 }
  ]
};