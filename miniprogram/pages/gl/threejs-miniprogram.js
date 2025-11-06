// 兼容别名适配（CommonJS 版本）：
// 背景：当 DevTools 的包名解析异常，将 `threejs-miniprogram` 指回到本文件时，会形成“别名→包名→别名”的循环，触发无限递归。
// 方案：显式指向构建产物（miniprogram_npm）并用 CommonJS 导出，切断循环链条。
// 注意：当包名解析恢复正常后，可回退为标准 ESM 导入。

let mod;
try {
  mod = require('../../miniprogram_npm/threejs-miniprogram/index.js');
} catch (e) {
  try {
    // 回退：当构建产物未生成或路径差异时，尝试直接使用包名解析
    mod = require('threejs-miniprogram');
    console.warn('[threejs alias] 使用包名解析回退 threejs-miniprogram');
  } catch (e2) {
    console.error('[threejs alias] 未找到 threejs-miniprogram 构建产物或包名，建议在工具中执行“构建 NPM”。');
    throw e2;
  }
}
const { createScopedThreejs, registerCanvas } = mod;

module.exports = { createScopedThreejs, registerCanvas };