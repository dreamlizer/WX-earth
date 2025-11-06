// 将 GeoJSON 转为可在小程序中 require 的 .json.js 模块
// 用法（Windows PowerShell）：
//   node tools/convert_geojson_to_js_module.js <input.geojson> <output.json.js>
// 示例：
//   node tools/convert_geojson_to_js_module.js WinReference/assets/boundaries_highres/ne_50m_admin_0_countries.geojson miniprogram/assets/data/countries_50m.json.js

const fs = require('fs');
const path = require('path');

function main(){
  const [,, inFile, outFile] = process.argv;
  if (!inFile || !outFile){
    console.error('Usage: node tools/convert_geojson_to_js_module.js <input.geojson> <output.json.js>');
    process.exit(1);
  }
  const geojson = fs.readFileSync(path.resolve(inFile), 'utf8');
  // 粗略校验 JSON
  let obj = null;
  try { obj = JSON.parse(geojson); }
  catch(e){ console.error('Invalid GeoJSON:', e.message); process.exit(2); }
  // 简单压缩：去除多余空格（JSON.stringify）
  const min = JSON.stringify(obj);
  const content = `module.exports = ${min}`;
  fs.writeFileSync(path.resolve(outFile), content, 'utf8');
  console.log('[convert] done:', outFile);
}

main();