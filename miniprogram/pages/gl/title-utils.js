// 标题与时区工具：从 index.js 拆分出来，纯函数实现便于复用与测试

// 计算指定 IANA 时区的 GMT 偏移字符串（如 'GMT+4'）
export function computeGmtOffsetStr(tzName){
  try {
    if (!tzName) return '';
    // 优先使用 Intl 的 shortOffset
    try {
      const parts = Intl.DateTimeFormat('en-US', { timeZone: tzName, timeZoneName: 'shortOffset' }).formatToParts(new Date());
      const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || '';
      const m = tzPart.match(/GMT[+-]\d{1,2}(?::\d{2})?/i);
      if (m) return m[0].replace(':00','');
    } catch(_) { /* fallthrough */ }

    // 兜底：Etc/GMT±N（Etc 的符号与常规相反）
    const mm = String(tzName).match(/^Etc\/GMT([+-])(\d{1,2})$/);
    if (mm) {
      const sign = mm[1] === '+' ? '-' : '+'; // Etc/GMT+8 -> GMT-8 表示 UTC-8；我们期望 "GMT+8" 显示当地时间相对 UTC 的正偏移
      const hours = Number(mm[2]) || 0;
      return `GMT${sign}${hours}`;
    }
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