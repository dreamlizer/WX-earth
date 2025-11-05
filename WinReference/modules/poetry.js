// modules/poetry.js
// 职责：存放所有在禅定模式下显示的诗句和相关配置。

export const poetryConfig = {
  fontSize: '26px',
  lineDisplayDuration: 7000, // 默认每句显示 7 秒 (毫秒)
  position: {
    top: '40px',
    right: '50px'
  },
  poetryLines: [
    // 使用对象数组，可以为特殊长句单独设置时长
    { text: "天体運行，周而復始。" },
    { text: "星漢燦爛，若出其里。" },
    { text: "日月之行，若出其中。" },
    { text: "俯察品類之盛，仰觀宇宙之大。", duration: 8000 },
    { text: "寄蜉蝣於天地，渺滄海之一粟。", duration: 8000 },
    { text: "此中有真意，欲辨已忘言。" }
  ]
};