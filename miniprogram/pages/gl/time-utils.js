// 职责：提供时间格式化的纯函数，避免内嵌在页面逻辑中。
// 输入：Date 对象、IANA 时区名称、语言标识（'zh'/'en'）。
// 输出：统一格式 YYYY/MM/DD HH:mm:ss；解析失败时返回 "--:--:--"。

export function formatTime(date, timeZone, lang = 'zh') {
  try {
    if (typeof timeZone === 'string' && timeZone) {
      const locale = lang === 'zh' ? 'zh-CN' : 'en-CA';
      // 1) 优先使用 formatToParts（最稳定，跨端差异最小）
      try {
        if (globalThis.Intl && typeof Intl.DateTimeFormat === 'function') {
          const fmt = new Intl.DateTimeFormat(locale, {
            timeZone,
            hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          });
          if (typeof fmt.formatToParts === 'function') {
            const parts = fmt.formatToParts(date);
            const get = (t) => {
              const v = parts.find(p => p.type === t)?.value;
              return (typeof v === 'string') ? v.padStart(2, '0') : '00';
            };
            const y = parts.find(p => p.type === 'year')?.value || '0000';
            const m = get('month');
            const d = get('day');
            const hh = get('hour');
            const mm = get('minute');
            const ss = get('second');
            return `${y}/${m}/${d} ${hh}:${mm}:${ss}`;
          }
        }
      } catch(_){ /* fall through */ }

      // 2) 退回 toLocaleString（用正则清洗差异）
      try {
        const s0 = date.toLocaleString(locale, {
          timeZone,
          hour12: false,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        let s = String(s0 || '').trim();
        // 统一为 YYYY/MM/DD HH:mm:ss（去掉逗号与中文“年/月/日”）
        s = s.replace(/[年\-]/g, '/').replace(/月/g, '/').replace(/日/g, '').replace(/,/g, '').trim();
        // 可能出现 "YYYY/MM/DD, HH:mm:ss" 或 "YYYY/ MM/ DD HH:mm:ss"
        s = s.replace(/\s{2,}/g, ' ');
        if (/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}/.test(s)) return s;
      } catch(_){ /* fall through */ }

      // 3) 兜底 A：常见 IANA 名称固定偏移（不处理夏令时）
      const FALLBACK_OFFSETS_MIN = {
        'Asia/Shanghai': 480,
        'Asia/Beijing': 480,
        'Asia/Taipei': 480,
        'Asia/Hong_Kong': 480,
        'Asia/Macau': 480,
      };
      if (FALLBACK_OFFSETS_MIN[timeZone] != null) {
        const minutes = FALLBACK_OFFSETS_MIN[timeZone];
        const dt = new Date(date.getTime() + minutes * 60 * 1000);
        const pad = (n) => String(n).padStart(2, '0');
        const y = dt.getUTCFullYear();
        const mo = pad(dt.getUTCMonth() + 1);
        const d = pad(dt.getUTCDate());
        const hh = pad(dt.getUTCHours());
        const mm = pad(dt.getUTCMinutes());
        const ss = pad(dt.getUTCSeconds());
        return `${y}/${mo}/${d} ${hh}:${mm}:${ss}`;
      }

      // 4) 兜底 B：支持 Etc/GMT±N，以小时偏移粗略换算
      const m = String(timeZone).match(/^Etc\/GMT([+-])(\d{1,2})$/);
      if (m) {
        const sign = m[1] === '+' ? 1 : -1; // 注意 Etc/GMT 符号与常规相反
        const hours = Number(m[2]) || 0;
        const dt = new Date(date.getTime() - sign * hours * 3600 * 1000);
        const pad = (n) => String(n).padStart(2, '0');
        const y = dt.getUTCFullYear();
        const mo = pad(dt.getUTCMonth() + 1);
        const d = pad(dt.getUTCDate());
        const hh = pad(dt.getUTCHours());
        const mm = pad(dt.getUTCMinutes());
        const ss = pad(dt.getUTCSeconds());
        return `${y}/${mo}/${d} ${hh}:${mm}:${ss}`;
      }
      return '--:--:--';
    }
  } catch (e) {
    try { console.warn('[time-utils/formatTime] failed:', e); } catch(_){}
  }
  return '--:--:--';
}