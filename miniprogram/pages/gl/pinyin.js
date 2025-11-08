// 轻量拼音工具：优先使用 tiny-pinyin（完整覆盖），无库时回退到内置映射
// 说明：
// - 首选库：tiny-pinyin（纯 JS，体积小，适配小程序 NPM）
// - 回退实现：针对国家/城市常见汉字的映射和拼音音节切分
// - 可移除路径：如未来内置数据添加 PINYIN 字段，可删除本文件并直接使用数据字段

let Tiny = null;
try {
  // WeChat 小程序在“构建 NPM”后可直接引入
  // 若项目尚未安装 tiny-pinyin，此处捕获异常并使用回退实现
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Tiny = require('tiny-pinyin');
} catch(_) { Tiny = null; }

// 内置映射（覆盖常见国家/城市用字，兼顾“墨西哥”等）
const SPECIAL = {
  '巴黎':'bali','中国':'zhongguo','美国':'meiguo','英国':'yingguo','法国':'faguo','日本':'riben','韩国':'hanguo','德国':'deguo','加拿大':'jianada','澳大利亚':'aodaliya','新加坡':'xinjiapo','泰国':'taiguo'
};
const MAP = {
  '北':'bei','京':'jing','上':'shang','海':'hai','广':'guang','州':'zhou','深':'shen','圳':'zhen','成':'cheng','都':'du','重':'chong','庆':'qing','武':'wu','汉':'han','西':'xi','安':'an','杭':'hang','拉':'la','萨':'sa',
  '纽':'niu','约':'yue','芝':'zhi','加':'jia','哥':'ge','丹':'dan','佛':'fo','洛':'luo','杉':'shan','矶':'ji','克':'ke','雷':'lei','奇':'qi','檀':'tan','香':'xiang','山':'shan','华':'hua','盛':'sheng','顿':'dun',
  '休':'xiu','斯':'si','图':'tu','迈':'mai','阿':'a','密':'mi','莫':'mo','墨':'mo','科':'ke','圣':'sheng','彼':'bi','得':'de','堡':'bao','叶':'ye','卡':'ka','捷':'jie','琳':'lin','新':'xin','伯':'bo','利':'li','亚':'ya',
  '符':'fu','迪':'di','沃':'wo','托':'tu','巴':'ba','黎':'li','开':'kai','罗':'luo','东':'dong','京':'jing','荷':'he','兰':'lan','意':'yi','葡':'pu','萄':'tao','俄':'e','希':'xi','瑞':'rui','沙':'sha','阿':'a','联':'lian','酋':'qiu'
};

export function toPinyinFull(str){
  try {
    if (!str) return '';
    // 优先 tiny-pinyin：完整且可靠
    if (Tiny && typeof Tiny.isSupported === 'function' && Tiny.isSupported()) {
      const py = Tiny.convertToPinyin(String(str), ' ', true);
      return String(py).toLowerCase().replace(/\s+/g,'');
    }
    // 回退：特殊名直出；逐字映射其余
    if (SPECIAL[str]) return SPECIAL[str];
    let out = '';
    for (const ch of String(str)) {
      out += MAP[ch] || (/[a-z]/i.test(ch) ? ch.toLowerCase() : '');
    }
    return out.replace(/\s+/g,'');
  } catch(_) { return ''; }
}

export function pinyinInitials(pinyinFull){
  try {
    // 近似音节切分：辅音簇 + 元音簇 + 可选尾韵 ng
    const raw = String(pinyinFull||'').toLowerCase().replace(/[^a-z]/g, '');
    if (!raw) return '';
    const syllables = raw.match(/(?:[b-df-hj-np-tv-z]*[aeiou]+(?:ng)?)/g) || [];
    if (syllables.length === 0) return raw[0] || '';
    return syllables.map(syl => syl[0]).join('');
  } catch(_) { return ''; }
}