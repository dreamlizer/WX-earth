// 将 miniprogram/assets/data/cities_data.js 转换为可导入云数据库的 JSON
// 运行：node tools/convert_cities_to_json.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'miniprogram', 'assets', 'data', 'cities_data.js');
const OUT_ARRAY = path.join(__dirname, '..', 'cities_array.json');
const OUT_SINGLE = path.join(__dirname, '..', 'cities_single_doc.json');
const OUT_ARRAY_JSONL = path.join(__dirname, '..', 'cities_array.jsonl');
const OUT_SINGLE_JSONL = path.join(__dirname, '..', 'cities_single_doc.jsonl');

function extractArrayLiteral(code) {
  // 找到 "export const cities = [" 起点，做括号配对提取到对应的 "]" 结束
  const marker = 'export const cities';
  const idx = code.indexOf(marker);
  if (idx < 0) throw new Error('未找到导出 cities 的位置');
  const lb = code.indexOf('[', idx);
  if (lb < 0) throw new Error('未找到数组起始 "["');
  // 简单括号计数器（适配对象与数组的嵌套）
  let depth = 0;
  let end = -1;
  for (let i = lb; i < code.length; i++) {
    const ch = code[i];
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error('未找到数组结束 "]"');
  return code.slice(lb, end + 1);
}

function parseArray(arrayLiteral) {
  // 使用 VM 执行 JS 数组字面量，避免 JSON 对注释/单引号/尾逗号不兼容
  const script = new vm.Script('(' + arrayLiteral + ')');
  const result = script.runInNewContext({}, { timeout: 2000 });
  if (!Array.isArray(result)) throw new Error('解析失败：不是数组');
  return result;
}

function normalizeCity(x) {
  return {
    name_en: String(x?.name_en || x?.en || x?.name || ''),
    name_zh: String(x?.name_zh || x?.zh || ''),
    lat: Number(x?.lat),
    lon: Number(x?.lon),
    country_code: String(x?.country_code || x?.cc || '').toUpperCase(),
    importance: typeof x?.importance === 'number' ? x.importance : (typeof x?.score === 'number' ? x.score : 1),
  };
}

function main() {
  const code = fs.readFileSync(SRC, 'utf8');
  const arrText = extractArrayLiteral(code);
  const raw = parseArray(arrText);
  const cities = raw.map(normalizeCity).filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lon));

  // 导出两种形态：数组文件 & 单文档数组
  fs.writeFileSync(OUT_ARRAY, JSON.stringify(cities, null, 2), 'utf8');
  fs.writeFileSync(OUT_SINGLE, JSON.stringify({ _id: 'cities-all', list: cities }, null, 2), 'utf8');
  // 额外导出 JSON Lines（NDJSON），适用于云数据库“导入”
  fs.writeFileSync(OUT_ARRAY_JSONL, cities.map(c => JSON.stringify(c)).join('\n') + '\n', 'utf8');
  fs.writeFileSync(OUT_SINGLE_JSONL, JSON.stringify({ _id: 'cities-all', list: cities }) + '\n', 'utf8');
  console.log(`[convert] 完成：${cities.length} 条城市记录`);
  console.log(`[convert] 输出：\n - ${OUT_ARRAY}\n - ${OUT_SINGLE}\n - ${OUT_ARRAY_JSONL}\n - ${OUT_SINGLE_JSONL}`);
}

main();