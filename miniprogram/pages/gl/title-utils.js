// 标题与时区工具：从 index.js 拆分出来，纯函数实现便于复用与测试

// 计算指定 IANA 时区的 GMT 偏移字符串（如 'GMT+4'）
export function computeGmtOffsetStr(tzName){
  try {
    if (!tzName) return '';
    const parts = Intl.DateTimeFormat('en-US', { timeZone: tzName, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || '';
    const m = tzPart.match(/GMT[+-]\d{1,2}(?::\d{2})?/i);
    if (m) return m[0].replace(':00','');
    // 兜底：常见 IANA 名称固定偏移（不考虑夏令时）
    const MAP = {
      'Asia/Shanghai': 'GMT+8',
      'Asia/Beijing': 'GMT+8',
      'Asia/Taipei': 'GMT+8',
      'Asia/Hong_Kong': 'GMT+8',
      'Asia/Macau': 'GMT+8',
    };
    return MAP[tzName] || '';
  } catch(_) { return ''; }
}

// 根据语言与偏移字符串，生成国家标题后缀（如 '（GMT+8）' 或 ' (GMT+8)'）
export function buildCountryTitleSuffix(lang, offset){
  try {
    const o = offset || '';
    if (!o) return '';
    return (lang === 'zh') ? `（${o}）` : ` (${o})`;
  } catch(_) { return ''; }
}