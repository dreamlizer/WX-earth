export function getCountryOverride(f) {
  const p = f?.props || {}
  const code = (p.ISO_A2 || p.ISO || p.ISO2 || p.CC || '').toString().toUpperCase()
  const name = (p.ADMIN || p.NAME || p.NAME_LONG || '').toString()
  const rules = [
    { codes: ['CN'], names: [/China|中国/i], tz: 'Asia/Shanghai' },
    { codes: ['IN'], names: [/India|印度/i], tz: 'Asia/Kolkata' },
    { codes: ['LK'], names: [/Sri\s*Lanka|斯里兰卡/i], tz: 'Asia/Colombo' },
    { codes: ['MM'], names: [/Myanmar|缅甸/i], tz: 'Asia/Yangon' },
    { codes: ['NP'], names: [/Nepal|尼泊尔/i], tz: 'Asia/Kathmandu' },
    { codes: ['IR'], names: [/Iran|伊朗/i], tz: 'Asia/Tehran' },
    { codes: ['AF'], names: [/Afghanistan|阿富汗/i], tz: 'Asia/Kabul' },
  ]
  for (const r of rules) {
    if ((r.codes && r.codes.includes(code)) || (r.names && r.names.some(re => re.test(name)))) {
      return r.tz
    }
  }
  return null
}