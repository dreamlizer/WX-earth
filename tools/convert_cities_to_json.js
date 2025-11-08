// 将 miniprogram/assets/data/cities_data.js 转换为可导入云数据库的 JSON
// 并支持：使用 Node 拼音库为城市/国家生成 pinyin_full / pinyin_initial 字段并写回源文件
// 运行（仅导出JSON）：node tools/convert_cities_to_json.js
// 运行（写回拼音到数据）：node tools/convert_cities_to_json.js --write-pinyin --update-countries
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// —— 尝试加载拼音库（优先 pinyin-pro；回退 tiny-pinyin）
let pinyinPro = null;
let tinyPinyin = null;
try { pinyinPro = require('pinyin-pro'); } catch(_) {}
try { tinyPinyin = require('tiny-pinyin'); } catch(_) {}

const SRC = path.join(__dirname, '..', 'miniprogram', 'assets', 'data', 'cities_data.js');
const OUT_ARRAY = path.join(__dirname, '..', 'cities_array.json');
const OUT_SINGLE = path.join(__dirname, '..', 'cities_single_doc.json');
const OUT_ARRAY_JSONL = path.join(__dirname, '..', 'cities_array.jsonl');
const OUT_SINGLE_JSONL = path.join(__dirname, '..', 'cities_single_doc.jsonl');
const COUNTRY_SRC = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'country_data.js');

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

// —— 计算拼音（全拼 / 首字母）
function computePinyinFields(nameZh) {
  const safe = String(nameZh || '');
  if (!safe) return { pinyin_full: '', pinyin_initial: '' };
  // pinyin-pro 路径
  if (pinyinPro && typeof pinyinPro.pinyin === 'function') {
    try {
      const fullArr = pinyinPro.pinyin(safe, { toneType: 'none', type: 'array' });
      const iniArr  = pinyinPro.pinyin(safe, { pattern: 'first', toneType: 'none', type: 'array' });
      const pinyin_full = Array.isArray(fullArr) ? fullArr.join('').toLowerCase() : String(fullArr || '').replace(/\s+/g, '').toLowerCase();
      const pinyin_initial = Array.isArray(iniArr) ? iniArr.join('').toLowerCase() : String(iniArr || '').replace(/\s+/g, '').toLowerCase();
      return { pinyin_full, pinyin_initial };
    } catch(_) {}
  }
  // tiny-pinyin 回退路径
  if (tinyPinyin && typeof tinyPinyin.convertToPinyin === 'function') {
    try {
      const fullStr = tinyPinyin.convertToPinyin(safe, ' ', true);
      const segs = String(fullStr || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
      const pinyin_full = segs.join('');
      const pinyin_initial = segs.map(s => s[0] || '').join('');
      return { pinyin_full, pinyin_initial };
    } catch(_) {}
  }
  // 无库回退：不生成（提示安装库）
  return { pinyin_full: '', pinyin_initial: '' };
}

// —— 写回 cities_data.js（覆盖为标准导出）
function writeCitiesWithPinyin(rawCities) {
  const next = rawCities.map(x => {
    const base = normalizeCity(x);
    const { pinyin_full, pinyin_initial } = computePinyinFields(base.name_zh);
    return { ...base, pinyin_full, pinyin_initial };
  });
  const code = `export const cities = ${JSON.stringify(next, null, 2)}\n`;
  fs.writeFileSync(SRC, code, 'utf8');
  console.log(`[pinyin] 已写回城市数据：${SRC}`);
}

// —— 解析并写回国家 country_data.js（为每个国家增加 PINYIN_FULL / PINYIN_INITIAL）
function writeCountriesWithPinyin() {
  if (!fs.existsSync(COUNTRY_SRC)) {
    console.warn('[pinyin] 跳过国家：未找到', COUNTRY_SRC);
    return;
  }
  const srcCode = fs.readFileSync(COUNTRY_SRC, 'utf8');
  const objStart = srcCode.indexOf('{');
  const objEnd = srcCode.lastIndexOf('}');
  if (objStart < 0 || objEnd < 0) throw new Error('无法解析 country_data.js 内容');
  const jsonText = srcCode.slice(objStart, objEnd + 1);
  const data = JSON.parse(jsonText);
  const next = {};
  for (const [code, meta] of Object.entries(data)) {
    const zh = String(meta?.NAME_ZH || '');
    const { pinyin_full, pinyin_initial } = computePinyinFields(zh);
    next[code] = { ...meta, PINYIN_FULL: pinyin_full, PINYIN_INITIAL: pinyin_initial };
  }
  const out = `export default ${JSON.stringify(next, null, 2)}\n`;
  fs.writeFileSync(COUNTRY_SRC, out, 'utf8');
  console.log(`[pinyin] 已写回国家数据：${COUNTRY_SRC}`);
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

  // 可选：写回拼音到源数据
  const args = process.argv.slice(2);
  const doWritePinyin = args.includes('--write-pinyin') || args.includes('--write');
  const doUpdateCountries = args.includes('--update-countries') || args.includes('--countries');
  if (doWritePinyin) {
    if (!pinyinPro && !tinyPinyin) {
      console.warn('[pinyin] 未检测到拼音库，请先安装 pinyin-pro（推荐）或 tiny-pinyin');
      console.warn('Windows 安装示例：npm i pinyin-pro');
    }
    try { writeCitiesWithPinyin(raw); } catch (e) { console.error('[pinyin] 写回城市失败：', e.message); }
  }
  if (doUpdateCountries) {
    if (!pinyinPro && !tinyPinyin) {
      console.warn('[pinyin] 未检测到拼音库，请先安装 pinyin-pro（推荐）或 tiny-pinyin');
    }
    try { writeCountriesWithPinyin(); } catch (e) { console.error('[pinyin] 写回国家失败：', e.message); }
  }
}

main();