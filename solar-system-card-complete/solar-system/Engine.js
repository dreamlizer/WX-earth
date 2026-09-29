// Engine.js: 核心模拟与渲染引擎
console.log("Engine.js file has started running.");

window.addEventListener('DOMContentLoaded', ()=>{
    // 初始化背景模块
    if (window.galaxyDrawer && typeof window.galaxyDrawer.init === 'function') {
        window.galaxyDrawer.init();
    }

    // =============================================
    // === 核心状态变量 ===
    // =============================================
    // 新增：localStorage 命名空间与容错封装（仅 Engine.js 使用）
    const LS_PREFIX = 'solar.'; // 统一命名空间前缀
    const safeLocal = {
      get(k){ try { return localStorage.getItem(LS_PREFIX + k); } catch(e){ return null; } },
      set(k,v){ try { localStorage.setItem(LS_PREFIX + k, v); } catch(e){ /* 静默失败 */ } },
      hasOld(k){ try { return localStorage.getItem(k) !== null; } catch(e){ return false; } }, // 兼容旧键读
      getOld(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
    };
    let running=true;
    let selectedObject = null;
    let cinemaMode = false;
    const DEFAULT_CAMERA_ZOOM = 0.7;
    const DEFAULT_SPEED_MULTIPLIER = 1;
    let cameraZoom = DEFAULT_CAMERA_ZOOM;
    safeLocal.set('m.zoom', String(DEFAULT_CAMERA_ZOOM));
    let cameraOffset={x:0,y:0};
    let vOffset = { x: 0, y: 0 };

    let ludicrousMode = false;
    window.isSnapshotVisible = false;
    const errorBox=document.getElementById('err');
    const showError=(m)=>{ errorBox.textContent=m; errorBox.style.display='block'; console.error(m); };
    function formatDistanceKm(distKm){
      if (!Number.isFinite(distKm) || distKm <= 0) return '未知';
      if (distKm >= 100000000) return `${(distKm / 100000000).toFixed(2)} 亿公里`;
      if (distKm >= 10000) return `${(distKm / 10000).toFixed(0)} 万公里`;
      return `${Math.round(distKm)} 公里`;
    }
    function formatLightTime(distKm){
      if (!Number.isFinite(distKm) || distKm <= 0) return '未知';
      const seconds = distKm / 299792.458;
      if (seconds < 60) return `${seconds.toFixed(1)} 秒`;
      const minutes = seconds / 60;
      if (minutes < 60) return `${minutes.toFixed(1)} 分钟`;
      const hours = minutes / 60;
      if (hours < 24) return `${hours.toFixed(1)} 小时`;
      const days = hours / 24;
      return `${days.toFixed(1)} 天`;
    }

    // ===== Canvas & DPR =====
    const canvas=document.getElementById('stage');
    const ctx=canvas.getContext('2d');
    let W=0,H=0,cx=0,cy=0,dpr=1;
    function fitCanvas(){
        dpr=Math.min(1.35, window.devicePixelRatio||1);
        const w=Math.floor(window.innerWidth), h=Math.floor(window.innerHeight);
        canvas.style.width=w+'px'; canvas.style.height=h+'px';
        canvas.width=Math.floor(w*dpr); canvas.height=Math.floor(h*dpr);
        ctx.setTransform(dpr,0,0,dpr,0,0);
        ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
        W=w; H=h; cx=W/2; cy=H/2;
    }
    fitCanvas(); window.addEventListener('resize', fitCanvas);

    const toolbar=document.getElementById('toolbar');
    const speedbar=document.getElementById('speedbar');
    const btnPlayPause = document.getElementById('btnPlayPause');
    const speedRange = document.getElementById('speedRange');
    const speedVal = document.getElementById('speedVal');
    const tiltVal = document.getElementById('tiltVal');
    const SAFE_BOTTOM=()=> (toolbar.getBoundingClientRect().height + speedbar.getBoundingClientRect().height + 8);
    function syncRangeFill(rangeEl, value){
      if (!rangeEl || !Number.isFinite(value)) return;
      if (window.solarControls && typeof window.solarControls.setRangeVisual === 'function') {
        window.solarControls.setRangeVisual(rangeEl, value);
      }
    }

    // --- 性能预设：?perf=low|mid|high（不带参数则不干预） ---
    function getPerfPreset(){
      try{
        const p = new URLSearchParams(location.search||'').get('perf');
        return (p==='low'||p==='mid'||p==='high') ? p : null;
      }catch(e){ return null; }
    }
    const PERF_PRESET = getPerfPreset(); // null 表示不干预

    // 特效开关（默认沿用现状；有预设时按档位覆盖）
    let FX_GALAXY = true;   // 银河背景
    let FX_RINGS  = true;   // 行星环/复杂光晕
    let FX_LABELS = true;   // 标签渲染
    let LABEL_DENSITY = 1.0;  // 标签密度：1.0 全量

    if (PERF_PRESET === 'mid'){
      LABEL_DENSITY = 0.6;
    } else if (PERF_PRESET === 'low'){
      FX_GALAXY = false;
      FX_RINGS  = false;
      LABEL_DENSITY = 0.35;
    }

    // 若未显式 ?perf= 且小屏，则默认轻度：保留完整标签，避免“行星名缺失”的体验
    (function(){
      if (!PERF_PRESET) {
        try{
          var small = window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
          var tiny  = window.matchMedia && window.matchMedia('(max-width: 380px)').matches;
          if (tiny){ FX_RINGS=false; LABEL_DENSITY=1.0; }
          else if (small){ LABEL_DENSITY = 1.0; }
        }catch(e){}
      }
    })();

    // 贴图明暗与边缘提亮（需在首次绘制前可用）
    const TEX_SHADING  = 0.45; // 明暗强度（0~1）
    const TEX_RIM      = 0.20; // 边缘提亮（0~1）

    // —— 可调参数（中文注释）——
    const INNER_PLANET_SCALE = 0.75;   // 四颗内行星的可视半径缩放（统一 -25%）
    const MAX_PX_TINY  = 24;           // 极小屏（≤380px）行星像素半径上限
    const MAX_PX_SMALL = 32;           // 小屏（≤600px）行星像素半径上限

    // —— 屏幕自适应上限：仅对“小屏横版”生效；PC 和更大屏幕不限制 ——
    function capPlanetRadiusPx(px){
      try{
        if (window.matchMedia && window.matchMedia('(max-width: 380px)').matches) return Math.min(px, MAX_PX_TINY);
        if (window.matchMedia && window.matchMedia('(max-width: 600px)').matches) return Math.min(px, MAX_PX_SMALL);
      }catch(e){}
      return px; // 其他情况不限制
    }

    // —— 内行星判断（按名称/ID 二选一；按你的数据结构调整键名）——
    function isInnerRocky(planet){
      const name = (planet && (planet.name || planet.id || planet.label || '')).toString().toLowerCase();
      return name==='mercury' || name==='venus' || name==='earth' || name==='mars';
    }

    // --- Texture caps (safe default) ---
    // 纹理/离屏尺寸上限：优先读取 WebGL MAX_TEXTURE_SIZE；失败则兜底 4096
    let TEX_MAX_SIZE = 4096;
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (gl) TEX_MAX_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE) || TEX_MAX_SIZE;
    } catch(e) { /* keep default 4096 */ }



    // === 贴图：太阳 & 地球（其余行星不动你现有逻辑） ===
const SUN_IMG   = new Image(); SUN_IMG.src   = 'tex/sun.jpg';
const EARTH_IMG = new Image(); EARTH_IMG.src = 'tex/earth.jpg';

/**
 * 在圆形内绘制“水平滚动”的贴图（做地球用）
 * phase: 0..1，控制水平位移；lightX/lightY 用来做昼夜/边缘明暗
 */
function drawDiskImageScroll(ctx, img, cx, cy, r, phase, lightX, lightY){
  if (!img || !img.naturalWidth) return;

  const srcW = img.naturalWidth, srcH = img.naturalHeight;
  const sq   = Math.min(srcW, srcH);                // 源图裁成正方形
  const sy   = Math.floor((srcH - sq)/2);
  const S    = Math.min(TEX_MAX_SIZE, sq);          // 采样分辨率上限（统一 clamp）
  const k    = S / sq;

  // —— 做水平无缝滚动（相当于经度改变），画两片拼接
  const off  = document.createElement('canvas'); off.width = off.height = S;
  const octx = off.getContext('2d');
  let u = ((phase % 1) + 1) % 1;                    // wrap 到 [0,1)
  const cut = Math.floor(u * srcW);                 // 从这个 x 开始切
  const w1  = srcW - cut;

  octx.drawImage(img, cut, sy, w1, sq, 0,     0,     w1*k, S);
  octx.drawImage(img, 0,   sy, cut, sq, w1*k, 0,     cut*k, S);

  // —— 边缘与背光面做点明暗（保持球感）
  octx.globalCompositeOperation = 'multiply';
  // 1) 边缘（圆碟边缘略暗）
  let rg = octx.createRadialGradient(S/2, S/2, S*0.55, S/2, S/2, S*0.98);
  rg.addColorStop(0, 'rgba(255,255,255,0)');
  rg.addColorStop(1, 'rgba(0,0,0,0.35)');
  octx.fillStyle = rg; octx.beginPath(); octx.arc(S/2,S/2,S/2,0,Math.PI*2); octx.fill();
  // 2) 昼夜（沿着光照方向做线性过渡）
  if (Number.isFinite(lightX) && Number.isFinite(lightY)){
    const len = Math.hypot(lightX, lightY) || 1, nx = lightX/len, ny = lightY/len;
    const lg  = octx.createLinearGradient(S/2*(1+nx), S/2*(1+ny), S/2*(1-nx), S/2*(1-ny));
    lg.addColorStop(0.00, 'rgba(255,255,255,0.25)');
    lg.addColorStop(0.50, 'rgba(0,0,0,0.00)');
    lg.addColorStop(1.00, 'rgba(0,0,0,0.35)');
    octx.fillStyle = lg; octx.fillRect(0,0,S,S);
  }
  octx.globalCompositeOperation = 'source-over';

  // —— 贴回主画布（圆形裁剪）
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
  ctx.drawImage(off, cx-r, cy-r, r*2, r*2); ctx.restore();
}

/**
 * 程序生成“土星环”——不用贴图；先在离屏做空心环，再带倾角/扁平贴回
 */
function drawSaturnRingProcedural(ctx, cx, cy, R, tiltRad){
  // 椭圆压扁：按倾角 cos，设下限避免太薄
  const squash = Math.max(0.32, Math.cos(tiltRad));
  // 环宽度（可按观感微调：Rout 小一点或 Rin 大一点 = 更窄）
  const Rout   = R * 1.75;
  const Rin    = R * 1.18;

  // —— 离屏：先画“有渐变的外圆”，再挖内圆 → 空心环
  const S = Math.min(Math.ceil(Rout*2), TEX_MAX_SIZE);
  const off = document.createElement('canvas'); off.width = off.height = S; // S 已在上方按 TEX_MAX_SIZE clamp
  const octx = off.getContext('2d');

  // 渐变（模拟环的亮度/色带基色）
  let grad = octx.createRadialGradient(S/2,S/2,Rin, S/2,S/2,Rout);
  grad.addColorStop(0.00, 'rgba(0,0,0,0)');
  grad.addColorStop(0.05, 'rgba(212,198,168,0.55)');
  grad.addColorStop(0.35, 'rgba(225,210,180,0.85)');
  grad.addColorStop(0.60, 'rgba(200,185,160,0.70)');
  grad.addColorStop(0.90, 'rgba(180,165,145,0.25)');
  grad.addColorStop(1.00, 'rgba(0,0,0,0)');
  octx.fillStyle = grad;
  octx.beginPath(); octx.arc(S/2,S/2,Rout,0,Math.PI*2); octx.fill();

  // 反相挖空内圆
  octx.globalCompositeOperation = 'destination-out';
  octx.beginPath(); octx.arc(S/2,S/2,Rin,0,Math.PI*2); octx.fill();
  octx.globalCompositeOperation = 'source-over';

  // 细条纹（可选，轻微增强“颗粒/带”）
  octx.globalAlpha = 0.15;
  octx.strokeStyle='rgba(255,255,255,0.35)';
  for(let i=0;i<12;i++){
    const rr = Rin + (Rout-Rin)*(i+0.5)/12;
    octx.lineWidth = Math.max(1, (Rout-Rin)/24);
    octx.beginPath(); octx.arc(S/2,S/2,rr,0,Math.PI*2); octx.stroke();
  }
  octx.globalAlpha = 1;

  // —— 贴回主画布：旋转到环平面，再按 Y 轴压扁成椭圆
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tiltRad);
  ctx.scale(1, squash);
  ctx.drawImage(off, -Rout, -Rout, Rout*2, Rout*2);
  ctx.restore();
}

    // ===== 状态 =====
    let tStr = safeLocal.get('m.t');
    if (tStr === null && safeLocal.hasOld('m.t')) tStr = safeLocal.getOld('m.t');
    let simTimeDays = parseFloat(tStr);
    if(!Number.isFinite(simTimeDays)){ simTimeDays=0; safeLocal.set('m.t','0'); }
    const DAYS_PER_YEAR=365.25, BASE_DAYS_PER_SEC=36.525;
    let speedMul = DEFAULT_SPEED_MULTIPLIER;
    safeLocal.set('m.speed', String(DEFAULT_SPEED_MULTIPLIER));
    let tiltStr = safeLocal.get('m.tiltDeg'); if (tiltStr === null && safeLocal.hasOld('m.tiltDeg')) tiltStr = safeLocal.getOld('m.tiltDeg');
    let tiltDeg = parseFloat(tiltStr ?? '65'); if(!Number.isFinite(tiltDeg)) tiltDeg = 65;
    let tilt=tiltDeg*Math.PI/180;
    // === 贴图资源（直接用你 /tex 目录的文件） ===
const TEXTURES = {
  Mercury: 'tex/mercury.jpg',
  Venus:   'tex/venus_surface.jpg', // 你给的文件名
  Earth:   'tex/earth.jpg',
  Mars:    'tex/mars.jpg',
  Jupiter: 'tex/jupiter.jpg',
  Saturn:  'tex/saturn.jpg',
  Uranus:  'tex/uranus.jpg',
  Neptune: 'tex/neptune.jpg',
  Sun:     'tex/sun.jpg',           // 可选：太阳
  ring:    'tex/saturn_ring.png'    // 土星环（透明）
};
const TEX = {};                 // 名称 -> Image
let texturesReady = false;
let readyPosted = false;
function postSolarProgress(percent, phase){
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: "dream-lab:solar-system-progress", percent: Math.max(0, Math.min(100, Math.round(percent))), phase: phase || "loading" },
        "*"
      );
    }
  } catch (e) {}
}

function notifySolarReadyOnce(){
  if (readyPosted) return;
  readyPosted = true;
  postSolarProgress(100, "ready");
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "dream-lab:solar-system-ready" }, "*");
    }
  } catch (e) {}
}

// 兼容中英名称
function normalizePlanetName(p){
  const n = (p.name || p.label || p.title || p.n || '').toString().trim();
  const mapCN = { '水星':'Mercury','金星':'Venus','地球':'Earth','火星':'Mars','木星':'Jupiter','土星':'Saturn','天王星':'Uranus','海王星':'Neptune','太阳':'Sun' };
  return mapCN[n] || (n[0]?.toUpperCase() + n.slice(1).toLowerCase());
}

// 预加载图片（有就用，没有也不报错）
(function preloadTextures(){
  const entries = Object.entries(TEXTURES);
  postSolarProgress(12, "scene");
  if (entries.length === 0){ texturesReady = true; notifySolarReadyOnce(); return; }
  let loaded = 0, total = entries.length;
  for (const [name, url] of entries){
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = url;
    img.onload  = () => {
      loaded++;
      postSolarProgress(12 + (loaded / total) * 88, "textures");
      if (loaded === total) {
        texturesReady = true;
        notifySolarReadyOnce();
      }
    };
    img.onerror = () => {
      loaded++;
      postSolarProgress(12 + (loaded / total) * 88, "textures");
      if (loaded === total) {
        texturesReady = true;
        notifySolarReadyOnce();
      }
    };
    TEX[name] = img;
  }
})();

    const DEPTH_SCALE = 0.15; // 近大远小的强度，0.10~0.25 比较自然


    const D2R=Math.PI/180, R2D=180/Math.PI;
    const normDeg = (d)=>{ let x=d%360; if(x<0) x+=360; return x; };
    const norm180 = (d)=>{ let x=((d+180)%360); if(x<0) x+=360; return x-180; };

    let sciStr = safeLocal.get('m.sci'); if (sciStr === null && safeLocal.hasOld('m.sci')) sciStr = safeLocal.getOld('m.sci');
    let scientific = (sciStr || '0')==='1';
    function daysSinceJ2000(d){ const J2000 = Date.UTC(2000,0,1,12,0,0); return (d.getTime() - J2000)/86400000; }
    let jdStr = safeLocal.get('m.jd'); if (jdStr === null && safeLocal.hasOld('m.jd')) jdStr = safeLocal.getOld('m.jd');
    let tDaysJ2000 = parseFloat(jdStr);
    if(!Number.isFinite(tDaysJ2000)) tDaysJ2000 = daysSinceJ2000(new Date());

    // ===== 行星自转：全局统一控制 =====
// 全局倍速（整体快慢）：越大转得越快
const ROT_SPEED_SCALE = 2.0;

// 单星基础速度（单位：相位/毫秒；可为负表示逆向）
// 这里按你的要求：除了土星、冥王星外都启用自转
const ROTATION_MS = {
  Sun:     0,          // 太阳单独走 drawSunWithTexture
  Mercury: 0.000040,   // 水星
  Venus:  -0.000043,   // 金星（逆转）
  Earth:   0.000055,   // 地球
  Mars:    0.000040,   // 火星
  Jupiter: 0.000160,   // 木星（快）
  Saturn:  0.000050,        // 土星：保持 0（我们不改它，仍走土星专用渲染）
  Uranus: -0.000080,   // 天王星（逆转）
  Neptune: 0.000090,   // 海王星
  Pluto:   0.0         // 冥王星：不转
};

    // ===== 天体数据 =====
    const planets=[ {name:'水星', type:'planet', au:0.39, period:0.241, ecc:0.206, r:3, color:'#b7bcc8', diameter: 4879, mass: '0.055 地球', gravity: '0.38 g', moons: '0'}, {name:'金星', type:'planet', au:0.72, period:0.615, ecc:0.007, r:5.5, color:'#f5d28a', diameter: 12104, mass: '0.815 地球', gravity: '0.90 g', moons: '0'}, {name:'地球', type:'planet', au:1.00, period:1.000, ecc:0.017, r:6.2, color:'#69c3ff', diameter: 12742, mass: '1 地球', gravity: '1.00 g', moons: '1 (月球)'}, {name:'火星', type:'planet', au:1.52, period:1.881, ecc:0.093, r:5, color:'#ff7b5a', diameter: 6779, mass: '0.107 地球', gravity: '0.38 g', moons: '2'}, {name:'谷神星', type:'asteroid', au:2.77, period:4.61, ecc:0.076, r:3.2, color:'#cfc9c2', diameter:939, mass:'0.00015 地球', gravity:'0.03 g', moons:'0'}, {name:'木星', type:'planet', au:5.20, period:11.86, ecc:0.048, r:11, color:'#f7e3c3', diameter: 139820, mass: '317.8 地球', gravity: '2.53 g', moons: '95 (含伽利略卫星)'}, {name:'土星', type:'planet', au:9.58, period:29.46, ecc:0.056, r:9.5, color:'#ffd27a', ring:true, diameter: 116460, mass: '95.2 地球', gravity: '1.07 g', moons: '146 (含土卫六)'}, {name:'天王星', type:'planet', au:19.20, period:84.01, ecc:0.046, r:8.5, color:'#aee7f2', diameter: 50724, mass: '14.5 地球', gravity: '0.89 g', moons: '27'}, {name:'海王星', type:'planet', au:30.05, period:164.8, ecc:0.010, r:8.2, color:'#79a8ff', diameter: 49244, mass: '17.1 地球', gravity: '1.14 g', moons: '14'}, {name:'冥王星', type:'planet', au:39.50, period:248.0, ecc:0.249, r:4.5, color:'#cdb7a0', diameter: 2376, mass: '0.0022 地球', gravity: '0.06 g', moons: '5'}, {name:'哈雷彗星', type:'comet', period: 75.3, r:2.5, color:'#a0e0ff'}, ].map((p,i)=>({ ...p, theta0: Math.random()*Math.PI*2, seed:i*97+11 }));
    const belt={ minAU:2.1, maxAU:3.3, count:1400, items:[] };
    const lastPos = Object.create(null);
    function seedBelt(){
  belt.items = [];
  for (let i = 0; i < belt.count; i++){
    const au = belt.minAU + Math.random() * (belt.maxAU - belt.minAU);
    const th = Math.random() * Math.PI * 2;
    belt.items.push({ au, th });




  }
}
    seedBelt();
    const kuiper={ minAU:30, maxAU:50, count:1600, items:[] };
    function seedKuiper(){ kuiper.items=[]; const counts = { resonant: kuiper.count * 0.20, classical: kuiper.count * 0.70, scattered: kuiper.count * 0.10 }; for(let i=0; i<counts.resonant; i++){ const au = 39 + Math.random() * 1.5; const th = Math.random()*Math.PI*2; const inc = (Math.random()**1.5) * 20; const O = Math.random()*360; kuiper.items.push({au, th, inc, O}); } for(let i=0; i<counts.classical; i++){ const r1 = Math.random(); const r2 = Math.random(); const au = 42 + 6 * (r1 + r2) / 2; const th = Math.random()*Math.PI*2; const inc = (Math.random()**2) * 10; const O = Math.random()*360; kuiper.items.push({au, th, inc, O}); } for(let i=0; i<counts.scattered; i++){ const au = 50 + Math.random() * 25; const th = Math.random()*Math.PI*2; const inc = Math.random() * 35; const O = Math.random()*360; kuiper.items.push({au, th, inc, O}); } }
    seedKuiper();

    const ELEMS={ '谷神星':{a:2.767,e:0.0760,i:10.586, O:80.305, wBar:73.597, L0:95.989, n:360/(4.61*365.25)}, '水星':{a:0.387098,e:0.205630,i:7.00487, O:48.33167, wBar:77.45645, L0:252.25084, n:360/(0.2408467*365.25)}, '金星':{a:0.723332,e:0.006773,i:3.39471, O:76.68069, wBar:131.53298, L0:181.97973, n:360/(0.61519726*365.25)}, '地球':{a:1.00000011,e:0.01671022,i:0.00005, O:-11.26064, wBar:102.94719, L0:100.46435, n:360/(1.000000*365.25)}, '火星':{a:1.52366231,e:0.09341233,i:1.85061, O:49.57854, wBar:336.04084, L0:355.45332, n:360/(1.8808476*365.25)}, '木星':{a:5.20336301,e:0.04839266,i:1.30530, O:100.55615, wBar:14.75385, L0:34.40438, n:360/(11.862615*365.25)}, '土星':{a:9.53707032,e:0.05415060,i:2.48446, O:113.71504, wBar:92.43194, L0:49.94432, n:360/(29.447498*365.25)}, '天王星':{a:19.19126393,e:0.04716771,i:0.76986, O:74.22988, wBar:170.96424, L0:313.23218, n:360/(84.016846*365.25)}, '海王星':{a:30.06896348,e:0.00858587,i:1.76917, O:131.72169, wBar:44.97135, L0:304.88003, n:360/(164.79132*365.25)}, '冥王星':{a:39.48168677,e:0.24880766,i:17.14175, O:110.30347, wBar:224.06676, L0:238.92881, n:360/(248.00*365.25)}, '哈雷彗星':{a:17.834, e:0.96714, i:162.26, O:58.42, wBar:170.19, L0:38.41, n:360/(75.3*365.25), T: -5088}, };

    // ===== 核心数学与物理函数 =====
    function solveKepler(e, M){ let E=M, i=0; for(; i<6; i++){ const dE=(E - e*Math.sin(E) - M)/(1 - e*Math.cos(E)); E-=dE; if(Math.abs(dE)<1e-6) break; } return E; }
    function eclipticHeliocentric(name, tDays){ const el=ELEMS[name]; if(!el) return {x:0,y:0,z:0,r:el?.a||1}; const a=el.a, e=el.e, i=el.i*D2R, O=el.O*D2R, wBar=el.wBar*D2R; const n=el.n; const L=(el.L0 + n*tDays)*D2R; const M = L - wBar; const E = solveKepler(e, M); const nu=2*Math.atan2(Math.sqrt(1+e)*Math.sin(E/2), Math.sqrt(1-e)*Math.cos(E/2)); const r = a*(1 - e*Math.cos(E)); const u = nu + (wBar - O); const x = r*(Math.cos(O)*Math.cos(u) - Math.sin(O)*Math.sin(u)*Math.cos(i)); const y = r*(Math.sin(O)*Math.cos(u) + Math.cos(O)*Math.sin(u)*Math.cos(i)); const z = r*(Math.sin(u)*Math.sin(i)); return {x,y,z,r,a,e}; }
    function getDistance(planet1, planet2, tDays) {
    const AU_KM = 149597870.7; // 1天文单位对应的公里数
    const p1 = eclipticHeliocentric(planet1, tDays);
    const p2 = eclipticHeliocentric(planet2, tDays);
    const dx = (p1.x - p2.x) * AU_KM;
    const dy = (p1.y - p2.y) * AU_KM;
    const dz = (p1.z - p2.z) * AU_KM;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
}
    const clamp=(v,lo,hi)=> Math.min(hi, Math.max(lo,v));
    const smoothstep=(edge0,edge1,x)=>{ const t=clamp((x-edge0)/(edge1-edge0),0,1); return t*t*(3-2*t); };
    const pos=(v,min=1)=> Math.max(min,v);
    const isMobileLayout = () => window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
    function getSceneCenterY(){
      // Keep the original desktop/tablet baseline and only add extra offset on mobile portrait.
      const base = (cy - SAFE_BOTTOM()/2 - (isMobileLayout() ? 18 : 0));
      const mobilePortrait = isMobileLayout() && H >= W;
      return base + (mobilePortrait ? 84 : 0);
    }
    function createScaleFn(){ const maxAU=39.5; return (au)=>{ const shorter=Math.min(W,H); const base=shorter*0.43; const k=0.06; const AU=Math.max(1e-6,au); const sqrtPart=Math.sqrt(AU/maxAU)*base*cameraZoom; const logPart=Math.log(1+k*AU)/Math.log(1+k*maxAU)*base*cameraZoom; return pos(sqrtPart*0.70 + logPart*0.30, 2); }; }
    let scaleFn=createScaleFn();
    function getSpin(name){ const tYears = (scientific? tDaysJ2000 : simTimeDays)/DAYS_PER_YEAR; const k={ '水星':0.2,'金星':0.05,'地球':0.6,'火星':0.4,'木星':1.6,'土星':1.0,'天王星':0.5,'海王星':0.5,'冥王星':0.2 }; const v=k[name]||0.3; return (tYears*v*2*Math.PI) % (Math.PI*2); }

    // 把常量改成函数：当缩放不大时锁中心，放大到一定倍数自动解锁
const PAN_UNLOCK_ZOOM = 1.8;          // 超过这个缩放就允许平移
function isCenterLocked(){ return cameraZoom <= PAN_UNLOCK_ZOOM; }


// ===== 交互处理 =====
const MIN_ZOOM = 0.2, MAX_ZOOM = 10;

let pointers = new Map();        // pointerId -> {x,y,t}
let dragging = false;
let tiltGestureActive = false;
let dragStart = {x:0,y:0,t:0};
let savedOffset = {x:0,y:0};
let tiltGestureStartY = 0;
let tiltGestureStartValue = 0;

let pinchStartDist = 0;
let pinchStartZoom = cameraZoom; // 你的缩放变量名若不同，请替换
const _dist = (a,b)=> Math.hypot(a.x-b.x, a.y-b.y);

canvas.addEventListener('pointerdown',(e)=>{
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const localX = e.clientX - rect.left;
  const p = { x: e.clientX, y: e.clientY, lx: localX, t: performance.now() };
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, p);

  // 进入双指：记录初始距离与缩放
  if (pointers.size === 2){
    const [a, b] = Array.from(pointers.values());
    pinchStartDist = _dist(a,b);
    pinchStartZoom = cameraZoom;
    tiltGestureActive = false;
  }

  const useTiltGesture = isMobileLayout() && pointers.size === 1 && p.lx >= W * 0.58;
  if (useTiltGesture){
    tiltGestureActive = true;
    tiltGestureStartY = p.y;
    tiltGestureStartValue = tiltDeg;
    return;
  }

  // 单指且锁中心：不允许拖动（但双指仍可继续 pinch）
  if (isCenterLocked() && pointers.size < 2) return;

  dragging = true;
  dragStart = { ...p };
  savedOffset = { ...cameraOffset };
  vOffset = { x:0, y:0 }; // 只赋值，不再二次 let
}, {passive:false});

canvas.addEventListener('pointermove',(e)=>{
  e.preventDefault();

  // 更新该指位置
  if (pointers.has(e.pointerId)){
    const p = pointers.get(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    p.x = e.clientX; p.y = e.clientY; p.lx = e.clientX - rect.left; p.t = performance.now();
  }

  // 双指：捏合缩放（并直接返回，不进入拖动分支）
  if (pointers.size === 2){
    const vals = Array.from(pointers.values());
    const curr = _dist(vals[0], vals[1]);
    if (pinchStartDist > 0){
      const scale = curr / pinchStartDist; // >1 放大，<1 缩小
      cameraZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartZoom * scale));
      const zoomRange = document.getElementById('zoomRange');
      const zoomVal = document.getElementById('zoomVal');
      if (zoomRange) zoomRange.value = String(cameraZoom);
      if (zoomRange) syncRangeFill(zoomRange, cameraZoom);
      if (zoomVal) zoomVal.textContent = `${cameraZoom.toFixed(2)}x`;
    }
    return;
  }

  if (tiltGestureActive){
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const deltaY = tiltGestureStartY - p.y;
    const nextTilt = clamp(tiltGestureStartValue + deltaY * 0.18, 0, 90);
    setTilt(nextTilt);
    return;
  }

  // 单指：若锁中心则禁止平移
  if (isCenterLocked()) return;

  // 否则允许拖动
  if (dragging){
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = p.x - dragStart.x, dy = p.y - dragStart.y;
    cameraOffset = { x: savedOffset.x + dx, y: savedOffset.y + dy };
  }
}, {passive:false});

['pointerup','pointercancel','pointerleave'].forEach(ev => {
  canvas.addEventListener(ev,(e)=>{
    try { canvas.releasePointerCapture(e.pointerId); } catch(_){}
    pointers.delete(e.pointerId);
    if (pointers.size < 2) { pinchStartDist = 0; }   // 退出捏合状态
    if (pointers.size === 0) {
      tiltGestureActive = false;
      tiltGestureStartY = 0;
    }
    dragging = false;
  });
});

// PC 滚轮缩放
canvas.addEventListener('wheel',(e)=>{
  e.preventDefault();
  const delta = Math.max(-60, Math.min(60, e.deltaY));
  const factor = Math.exp(-delta * 0.0015);
  cameraZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cameraZoom * factor));
  const zoomRange = document.getElementById('zoomRange');
  const zoomVal = document.getElementById('zoomVal');
  if (zoomRange) zoomRange.value = String(cameraZoom);
  if (zoomRange) syncRangeFill(zoomRange, cameraZoom);
  if (zoomVal) zoomVal.textContent = `${cameraZoom.toFixed(2)}x`;
}, {passive:false});

// 保底：锁中心时把偏移清零（防止历史残留）
(function keepCenter(){
  if (isCenterLocked() && (cameraOffset.x || cameraOffset.y)) {
    cameraOffset = { x:0, y:0 };
  }
  requestAnimationFrame(keepCenter);
})();


    // ===== UI 更新函数 =====
    function updateInfoPanel(){ if(!selectedObject){ infoPanel.style.display = 'none'; return; } const p = selectedObject.p || {}; const el = ELEMS[p.name]; const name = p.name || (p.type==='sun' ? '太阳' : '对象'); infoName.textContent = name; const push = (k,v)=> (v!=null && v!=='') ? `<b>${k}</b>${v}<br/>` : ''; let html = ''; if (p.type === 'sun'){ html += push('类型','恒星（G2V）'); html += push('直径','1392700 km'); html += push('质量','约 33.3 万地球'); html += push('表面温度','约 5778 K'); } else if (p.type === 'planet'){ html += push('类型','行星'); html += push('直径', (p.diameter!=null? p.diameter+' km':'')); html += push('质量', p.mass); html += push('重力', p.gravity); html += push('卫星', p.moons); if (p.au!=null) html += push('轨道半径', p.au.toFixed(2)+' AU'); if (p.period!=null) html += push('公转周期', p.period+' 地球年'); } else if (p.type === 'asteroid'){ html += push('类型','小行星'); html += push('直径', (p.diameter!=null? p.diameter+' km':'')); html += push('质量', p.mass); html += push('重力', p.gravity); if (p.au!=null) html += push('轨道半径', p.au.toFixed(2)+' AU'); if (p.period!=null) html += push('公转周期', p.period+' 地球年'); } else if (p.type === 'comet' && el){ const perihelion = el.a * (1 - el.e); const aphelion   = el.a * (1 + el.e); html += push('类型','彗星'); html += push('公转周期','约 '+ p.period+' 年'); html += push('近日点', perihelion.toFixed(2)+' AU'); html += push('远日点', aphelion.toFixed(2)+' AU'); html += push('轨道偏心率', el.e.toFixed(4)); html += push('轨道倾角', el.i.toFixed(2)+'°'); } else { html += push('类型', p.type||'未知'); } if (selectedObject.distKm != null){ html += push('距地距离', formatDistanceKm(selectedObject.distKm)); html += push('光行时', formatLightTime(selectedObject.distKm)); } infoBody.innerHTML = html || '<i>暂无数据</i>'; infoPanel.style.display = 'flex'; }

    // ===== 亮度控制 =====
    const BRIGHTNESS = (function(){ try{ const s = safeLocal.get('m.brightness_new'); return JSON.parse(s||'{}') }catch(e){} return {}; })();
    if (typeof BRIGHTNESS.belt  !== 'number') BRIGHTNESS.belt  = 1.0;
    if (typeof BRIGHTNESS.kuiper!== 'number') BRIGHTNESS.kuiper= 1.0;
    if (typeof BRIGHTNESS.labels!== 'number') BRIGHTNESS.labels= 0.7;
    if (typeof BRIGHTNESS.galaxy!== 'number') BRIGHTNESS.galaxy= 0.7;
    function saveBrightness(){ try{ safeLocal.set('m.brightness_new', JSON.stringify(BRIGHTNESS)); }catch(e){} }

    let brightnessSyncUI;
    (function(){
      const slBelt = document.getElementById('slBelt');
      const slKuiper = document.getElementById('slKuiper');
      const slLabels = document.getElementById('slLabels');
      const lblBelt = document.getElementById('lblBelt');
      const lblKuiper = document.getElementById('lblKuiper');
      const lblLabels = document.getElementById('lblLabels');
      const slGalaxy = document.getElementById('slGalaxy');
      const lblGalaxy = document.getElementById('lblGalaxy');

      function syncUI(){
        if(slBelt) { slBelt.value = BRIGHTNESS.belt; lblBelt.textContent = Number(BRIGHTNESS.belt).toFixed(2); }
        if(slKuiper) { slKuiper.value = BRIGHTNESS.kuiper; lblKuiper.textContent = Number(BRIGHTNESS.kuiper).toFixed(2); }
        if(slLabels) { slLabels.value = BRIGHTNESS.labels; lblLabels.textContent = Number(BRIGHTNESS.labels).toFixed(2); }
        if(slGalaxy) { slGalaxy.value = BRIGHTNESS.galaxy; lblGalaxy.textContent = Number(BRIGHTNESS.galaxy).toFixed(2); }

      }
      brightnessSyncUI = syncUI;
      syncUI();
    })();

    // ===== 核心控制函数 =====
    function setRunning(v){
        running=!!v;
        if (btnPlayPause) {
          btnPlayPause.textContent = running ? '\u6682\u505c / \u6b64\u523b' : '\u7ee7\u7eed';
          btnPlayPause.setAttribute('aria-pressed', String(running));
        }
    }
    function setToNow(){ if(scientific){ tDaysJ2000 = daysSinceJ2000(new Date()); } else { const now = new Date(); const y = now.getUTCFullYear(); const start = new Date(Date.UTC(y,0,1)); const d = Math.floor((now - start)/86400000); simTimeDays = y * DAYS_PER_YEAR + d; } draw(); }
    function setScientific(v){
    scientific = !!v;
    safeLocal.set('m.sci', scientific ? '1' : '0');

    const btn = document.getElementById('btnToggleMode');
    if (btn) {
        if (scientific) {
            btn.innerHTML = `<span>\ud83e\ude90</span> \u79d1\u5b66`;
            btn.dataset.mode = 'scientific';
        } else {
            btn.innerHTML = `<span>\ud83d\udc41\ufe0f</span> \u89c2\u8d4f`;
            btn.dataset.mode = 'ornamental';
        }
    }
}
    function setSpeed(v){
    v = clamp(v, 0.2, 100);
    speedMul = v * (ludicrousMode ? 50 : 1);

    if (speedRange) {
      speedRange.value = String(v);
      syncRangeFill(speedRange, v);
    }
    safeLocal.set('m.speed', String(v));

    const yearsPerSecond = 0.1 * speedMul;
    if (yearsPerSecond < 1) {
        const secondsPerYear = 1 / yearsPerSecond;
        if (speedVal) speedVal.textContent = `${secondsPerYear.toFixed(1)} \u79d2 / \u5e74`;
    } else {
        if (speedVal) speedVal.textContent = `${yearsPerSecond.toFixed(1)} \u5e74 / \u79d2`;
    }
}
    function setZoom(v){
    v = clamp(v, 0.2, 10);
    cameraZoom = v;
    safeLocal.set('m.zoom', String(v));
    const zoomRange = document.getElementById('zoomRange');
    const zoomVal = document.getElementById('zoomVal');
    if (zoomRange) {
      zoomRange.value = String(v);
      syncRangeFill(zoomRange, v);
    }
    if (zoomVal) zoomVal.textContent = `${v.toFixed(2)}x`;
    draw();
}
    function setTilt(v){
        v = clamp(v, 0, 90);
        tiltDeg = v;
        tilt = v * Math.PI / 180;
        if (tiltVal) tiltVal.textContent = Math.round(v) + '\u00b0';
        if (typeof window.setTiltUiValue === 'function') window.setTiltUiValue(v);
        draw();
        safeLocal.set('m.tiltDeg', String(v));
    }

    // 初始化
    setScientific(scientific);
    setSpeed(speedMul);
    setZoom(cameraZoom);
    setTilt(tiltDeg);
    setToNow();
    setRunning(true);

    // 在圆形内绘制旋转贴图 + 明暗 + 轮廓提亮
// 使用上方初始化的 TEX_MAX_SIZE（动态来自 WebGL caps，兜底 4096）

function drawTexturedDisk(ctx, img, cx, cy, r, rotationRad, lx, ly){
  // 没图就画个柔和渐变圆，兜底
  if (!img || !img.naturalWidth){
    const g = ctx.createRadialGradient(cx - r*0.25, cy - r*0.25, r*0.1, cx, cy, r);
    g.addColorStop(0, '#d8e7ff'); g.addColorStop(1, '#0a1230');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill(); return;
  }

  // 1) 把贴图旋转后画到离屏（方形采样，省字节也省算力）
  const S = Math.min(TEX_MAX_SIZE, img.naturalWidth, img.naturalHeight);
  const off = document.createElement('canvas'); off.width = off.height = S;
  const octx = off.getContext('2d');
  octx.save(); octx.translate(S/2,S/2); octx.rotate(rotationRad||0);
  const sMin = Math.min(img.naturalWidth, img.naturalHeight);
  octx.drawImage(img, (img.naturalWidth-sMin)/2, (img.naturalHeight-sMin)/2, sMin, sMin, -S/2, -S/2, S, S);
  octx.restore();

  // 2) 明暗（按光照方向）+ 轮廓提亮
  const len = Math.hypot(lx||0, ly||0) || 1, nx=(lx||0)/len, ny=(ly||0)/len;
  const lg = octx.createLinearGradient(S/2*(1+nx), S/2*(1+ny), S/2*(1-nx), S/2*(1-ny));
  lg.addColorStop(0.0, `rgba(255,255,255,${TEX_SHADING*0.8})`);
  lg.addColorStop(0.5, `rgba(0,0,0,0)`);
  lg.addColorStop(1.0, `rgba(0,0,0,${TEX_SHADING})`);
  octx.globalCompositeOperation = 'overlay'; octx.fillStyle = lg; octx.fillRect(0,0,S,S);

  const rg = octx.createRadialGradient(S/2,S/2,S*0.55, S/2,S/2,S*0.95);
  rg.addColorStop(0, 'rgba(255,255,255,0)');
  rg.addColorStop(1, `rgba(160,190,255,${TEX_RIM})`);
  octx.globalCompositeOperation = 'screen'; octx.fillStyle = rg; octx.beginPath(); octx.arc(S/2,S/2,S/2,0,Math.PI*2); octx.fill();

  // 3) 主画布里裁成圆贴上
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
  ctx.drawImage(off, cx-r, cy-r, r*2, r*2); ctx.restore();

  // 4) 轻微内阴影
  const ig = ctx.createRadialGradient(cx,cy,r*0.9, cx,cy,r);
  ig.addColorStop(0, 'rgba(0,0,0,0)'); ig.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = ig;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  // 覆盖一层太阳贴图（在核心圆内），保持发光不变

  ctx.globalCompositeOperation = 'source-over';
  // === 程序化的土星行星环（不用贴图） ===


}
// === 太阳（贴图 + 发光层），不参与受光计算，自己发光 ===
// === 太阳（贴图 + 发光），支持纹理自转 ===
// === 太阳（贴图 + 发光）：在圆形内做“水平滚动”，清晰可见的自转效果 ===
function drawSunWithTexture(ctx, x, y, R, tex, opts){
  const o = Object.assign({
    rotationRad: 0,   // 由外部传入：随时间线性增长
    innerGlow: 1.0,
    outerGlow: 1.0,
    haloScale: 1.6,
    coronaScale: 2.2,
    dir: 1            // 1 = 从右→左；-1 = 从左→右
  }, opts || {});

  // —— 1) 把 rotationRad 映射成 [0,1) 的水平滚动相位 —— //
  // 说明：不用旋转整图，而是在圆形里“水平卷动”贴图，视觉更明显
  let phase = ((o.rotationRad || 0) / (2*Math.PI)) % 1;
  if (phase < 0) phase += 1;
  phase = (o.dir >= 0) ? phase : (1 - phase);  // dir=-1 时反向

  // —— 2) 在离屏里拼接出水平平移后的方形贴图 —— //
  // 贴图为方形最好；若不是方形，按最小边裁成方形
  const S = Math.min(TEX_MAX_SIZE, tex && tex.naturalWidth ? Math.min(tex.naturalWidth, tex.naturalHeight) : Math.ceil(R*2));
  const off  = document.createElement('canvas'); off.width = off.height = S;
  const octx = off.getContext('2d');

  if (tex && tex.naturalWidth){
    const srcW = tex.naturalWidth, srcH = tex.naturalHeight;
    const sq   = Math.min(srcW, srcH);
    const sx0  = Math.floor((srcW - sq) / 2);   // 居中裁方
    const sy0  = Math.floor((srcH - sq) / 2);

    // 水平无缝拼接：从 cut 开始到末尾，再从头补齐
    const cut = Math.floor(phase * sq);         // 相位→像素偏移
    const w1  = sq - cut;

    // 把源图裁成方形后按相位拼接到离屏 S×S
    const k   = S / sq;
    // 右段
    octx.drawImage(tex, sx0 + cut, sy0, w1, sq, 0,     0,     Math.ceil(w1*k), S);
    // 左段
    octx.drawImage(tex, sx0,       sy0, cut, sq, Math.ceil(w1*k), 0, Math.ceil(cut*k), S);

    // 加一点“边缘暗化”（太阳也有边缘变暗），避免太平
    octx.globalCompositeOperation = 'multiply';
    const rg = octx.createRadialGradient(S/2, S/2, S*0.55, S/2, S/2, S*0.99);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(1, 'rgba(0,0,0,0.28)');
    octx.fillStyle = rg;
    octx.beginPath(); octx.arc(S/2, S/2, S/2, 0, Math.PI*2); octx.fill();
    octx.globalCompositeOperation = 'source-over';
  }else{
    // 兜底：没有贴图就画个暖色渐变
    const g = octx.createRadialGradient(S/2, S/2, S*0.1, S/2, S/2, S*0.5);
    g.addColorStop(0, '#FFF3B0'); g.addColorStop(1, '#F3B220');
    octx.fillStyle = g;
    octx.fillRect(0,0,S,S);
  }

  // —— 3) 把离屏贴回主画布（圆形裁剪） —— //
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI*2); ctx.clip();
  ctx.drawImage(off, x - R, y - R, 2*R, 2*R);
  ctx.restore();

  // —— 4) 内圈光晕（屏幕叠加） —— //
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const r1 = R * o.haloScale;
  const g1 = ctx.createRadialGradient(x, y, R*0.2, x, y, r1);
  g1.addColorStop(0.00, `rgba(255,255,230,${0.40*o.innerGlow})`);
  g1.addColorStop(0.45, `rgba(255,210, 80,${0.25*o.innerGlow})`);
  g1.addColorStop(1.00, 'rgba(255,190, 50,0)');
  ctx.fillStyle = g1;
  ctx.beginPath(); ctx.arc(x, y, r1, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // —— 5) 外圈光晕（屏幕叠加） —— //
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const r2 = R * o.coronaScale;
  const g2 = ctx.createRadialGradient(x, y, R*0.8, x, y, r2);
  g2.addColorStop(0.00, `rgba(255,200, 80,${0.12*o.outerGlow})`);
  g2.addColorStop(1.00, 'rgba(255,160, 40,0)');
  ctx.fillStyle = g2;
  ctx.beginPath(); ctx.arc(x, y, r2, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // —— 6) 边缘微亮带 —— //
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineWidth = Math.max(1, R*0.08);
  ctx.strokeStyle = 'rgba(255,230,120,0.25)';
  ctx.beginPath(); ctx.arc(x, y, R*1.02, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
}



// === 土星：离屏整球 + 主画布按半平面裁剪（左下前/右上后，前半球绝对不透明）===
function drawSaturnWithSplitRing(ctx, x, y, R, planetTex, sunX, sunY, tiltRad){
  // —— 参数（随手感调）——
  const Rout   = R * 1.85;                           // 环外半径（小=更窄）
  const Rin    = R * 1.15;                           // 环内半径（大=更窄）
  const squash = Math.max(0.25, Math.cos(tiltRad));  // 倾角压扁（0.25~1）
  const FRONT_IS_LOWER = true;                       // 下半(屏幕方向左下)为前景；false=上半前景

  // —— 1) 离屏：把“整颗行星”画到位图里（避免与主画布裁剪/变换冲突）——
  const S = Math.min(Math.ceil(R * 2) + 4, TEX_MAX_SIZE); // 离屏尺寸（统一 clamp）
  const offPlanet = document.createElement('canvas');
  offPlanet.width = offPlanet.height = S;
  const pctx = offPlanet.getContext('2d');

  // 把世界坐标平移到离屏中心，再调用你现有的贴图渲染（光照向量仍用世界向量）
  const lx = x - sunX, ly = y - sunY;
  pctx.save();
  pctx.translate((S>>1) - x, (S>>1) - y);            // 让 (x,y) 落在离屏中心
  drawTexturedDisk(pctx, planetTex, x, y, R, 0, lx, ly);
  pctx.restore();

  // —— 工具：在主画布按“上/下半平面”裁剪后贴回离屏整球 —— //



  function drawHalfPlanet(isFront){
    ctx.save();
    // 建立在“行星局部”的半平面裁剪
    ctx.translate(x, y);
    ctx.rotate(tiltRad);
    const rect = (isFront ? FRONT_IS_LOWER : !FRONT_IS_LOWER)
      ? {x:-R*4, y:0,    w:R*8, h:R*4}   // 下半
      : {x:-R*4, y:-R*4, w:R*8, h:R*4};  // 上半
    ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
    // 回到世界坐标，但保持 clip 仍有效
    ctx.rotate(-tiltRad);
    ctx.translate(-x, -y);

    // 贴回离屏整球（这样行星的所有内部变换和光照都不会干扰裁剪）
    if (isFront){
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;              // 前半球绝对不透明
    }
    ctx.drawImage(offPlanet, x - (S>>1), y - (S>>1), S, S);
    ctx.restore();
  }

  // —— 2) 先画“后半球”（右上）——
  drawHalfPlanet(false);

  // —— 3) 中间画“整圈环”（与两半球夹层，环本身半透明）——
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tiltRad);
  ctx.scale(1, squash);

  // 空心椭圆：偶奇规则，避免内外沿亚像素漏底
  ctx.beginPath();
  ctx.ellipse(0, 0, Rout, Rout, 0, 0, Math.PI*2);   // 外椭圆
  ctx.ellipse(0, 0, Rin,  Rin,  0, 0, Math.PI*2);   // 内椭圆
  const base = ctx.createRadialGradient(0,0,Rin, 0,0,Rout);
  base.addColorStop(0.00,'rgba(210,200,170,0.10)');
  base.addColorStop(0.40,'rgba(215,205,180,0.20)');
  base.addColorStop(1.00,'rgba(200,190,170,0.30)');
  ctx.fillStyle = base;
  ctx.fill('evenodd');

  // 远侧轻微压暗（拉开远近）
  ctx.globalCompositeOperation = 'multiply';
  const shade = ctx.createRadialGradient(0,0,Rin*0.9, 0,0,Rout*1.05);
  shade.addColorStop(0,'rgba(0,0,0,0.25)');
  shade.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = shade;
  ctx.beginPath(); ctx.ellipse(0,0,Rout,Rout,0,0,Math.PI*2); ctx.fill();

  ctx.restore();

  // —— 4) 最后画“前半球”（左下），保证把环压住 —— //
  drawHalfPlanet(true);

  // —— 5) 接触阴影（可按需加深/变浅）——
  ctx.save();
  ctx.translate(x, y); ctx.rotate(tiltRad); ctx.scale(1, squash);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.beginPath();
  ctx.ellipse(0, 0, R*1.05, R*0.70, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}








    // ===== 渲染函数 =====
    function project(a,b,theta){ const x=a*Math.cos(theta); const y0=b*Math.sin(theta); const y=y0*Math.cos(tilt); const z=y0*Math.sin(tilt); return {x,y,z,y0}; }
    function tiltProjectXYZ(x,y,z){ const yp = y*Math.cos(tilt); const zp = y*Math.sin(tilt); return {x, y: yp, z: zp}; }
    function updateAngles(){ if(!scientific){ const years=simTimeDays/DAYS_PER_YEAR; planets.forEach(p=> p.theta=p.theta0 + 2*Math.PI*(years/p.period)); } }
    function drawOrbit(a,b){ const ry = b * Math.cos(tilt); const x0 = cx + cameraOffset.x; const y0 = getSceneCenterY() + cameraOffset.y; const steps = 256; ctx.save(); ctx.lineWidth = 1.2; const maxZ = b * Math.sin(tilt); for(let k=0; k<steps; k++){ const th0 = (k/steps) * Math.PI * 2; const th1 = ((k+1)/steps) * Math.PI * 2; const p0 = project(a, b, th0); const p1 = project(a, b, th1); const z_norm = (p0.z / maxZ + 1) / 2; const alpha = 0.15 + 0.45 * Math.pow(z_norm, 2); ctx.beginPath(); ctx.moveTo(x0 + p0.x, y0 + p0.y); ctx.lineTo(x0 + p1.x, y0 + p1.y); ctx.strokeStyle = `rgba(140, 160, 210, ${alpha})`; ctx.stroke(); } ctx.restore(); }
    function drawOrbitSci(name, type){ const el=ELEMS[name]; if(!el) return; const steps=256; const auPix=scaleFn(1); const orbitPoints = []; let maxZ = 0; for(let k=0; k<=steps; k++){ const nu = (k/steps) * Math.PI * 2; const p = orbitPoint(el, nu, auPix); orbitPoints.push(p); if (Math.abs(p.z) > maxZ) maxZ = Math.abs(p.z); } maxZ = Math.max(maxZ, 1); ctx.save(); const isComet = type === 'comet'; ctx.lineWidth = isComet ? 1.0 : 1.2; const baseColor = isComet ? '140, 160, 180' : '140, 160, 210'; const minAlpha = isComet ? 0.1 : 0.15; const maxAlphaBoost = isComet ? 0.3 : 0.45; for(let k=0; k<steps; k++){ const p0 = orbitPoints[k]; const p1 = orbitPoints[k+1]; const z_norm = (p0.z / maxZ + 1) / 2; const alpha = minAlpha + maxAlphaBoost * Math.pow(z_norm, 2); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.strokeStyle = `rgba(${baseColor}, ${alpha})`; ctx.stroke(); } ctx.restore(); }
    function orbitPoint(el,nu,auPix){ const a=el.a, e=el.e, i=el.i*D2R, O=el.O*D2R, wBar=el.wBar*D2R; const r=a*(1-e*e)/(1+e*Math.cos(nu)); const u = nu + (wBar - O); const x = r*(Math.cos(O)*Math.cos(u) - Math.sin(O)*Math.sin(u)*Math.cos(i)); const y = r*(Math.sin(O)*Math.cos(u) + Math.cos(O)*Math.sin(u)*Math.cos(i)); const z = r*(Math.sin(u)*Math.sin(i)); const P=tiltProjectXYZ(x,y,z); const cx0=cx+cameraOffset.x; const cy0=getSceneCenterY()+cameraOffset.y; return { x: cx0 + P.x*auPix, y: cy0 + P.y*auPix, z: P.z*auPix }; }
    // === 统一的绘制入口（精确替换你现有的 paintPlanet） ===

// === 统一绘制入口（最小改动版）=======================================
// - Sun：保持你现有的太阳渲染（drawSunWithTexture）
// - Saturn：保持土星专用的“半球+整圈环”渲染，不改变
// - Pluto：不自转（相位为 0）
// - 其它行星：统一用“水平卷动”贴图模拟自转（视觉最清楚）
//   自转速度来自 ROTATION_MS，并乘以 ROT_SPEED_SCALE 做总控
// === 统一绘制入口：Sun(保留你的太阳逻辑)/Saturn(专用分半球+光环)/其余行星(贴图水平自转) ===
function paintPlanet(p, x, y, R, sunX, sunY, spin) {
  // —— 名称归一，兼容中英文 —— //
  function keyName(obj){
    const s = (obj.eng || obj.name || obj.type || '').toString();
    if (/^sun|太阳/i.test(s))       return 'Sun';
    if (/^(mercury|水星)/i.test(s)) return 'Mercury';
    if (/^(venus|金星)/i.test(s))   return 'Venus';
    if (/^(earth|地球)/i.test(s))   return 'Earth';
    if (/^(mars|火星)/i.test(s))    return 'Mars';
    if (/^(jupiter|木星)/i.test(s)) return 'Jupiter';
    if (/^(saturn|土星)/i.test(s))  return 'Saturn';
    if (/^(uranus|天王星)/i.test(s))return 'Uranus';
    if (/^(neptune|海王星)/i.test(s))return 'Neptune';
    if (/^(pluto|冥王星)/i.test(s))  return 'Pluto';
    return s || 'Unknown';
  }
  const nameKey = keyName(p);
  const tex = (typeof TEX !== 'undefined' && TEX) ? (TEX[nameKey] || null) : null;

  // —— 可视半径（像素）预处理 ——
  let rPX = R;
  if (isInnerRocky(p)) {
    rPX *= INNER_PLANET_SCALE;           // 四颗内行星统一缩小 25%
  }
  rPX = capPlanetRadiusPx(rPX);          // 小屏像素上限

  // —— 公用状态 —— //
  const lx = (x - sunX), ly = (y - sunY);   // 光照方向（用于明暗）
  const now = performance.now();

  // —— 分支：土星专用（不做水平自转，维持你的“分半球 + 光环”写法） —— //
  if (nameKey === 'Saturn') {
    if (FX_RINGS) {
      drawSaturnWithSplitRing(ctx, x, y, rPX, tex, sunX, sunY, /*使用全局倾角*/ (typeof tilt!=='undefined'?tilt:0));
    } else {
      // 关闭环时：降级为普通贴图圆盘
      const lx = (x - sunX), ly = (y - sunY);
      if (typeof drawTexturedDisk === 'function') {
        drawTexturedDisk(ctx, tex, x, y, rPX, 0, lx, ly);
      }
    }
    return;
  }

  // —— 分支：太阳如果你有专用贴图渲染（带光晕等），仍然走你的太阳函数 —— //
  if (nameKey === 'Sun' && typeof drawSunWithTexture === 'function' && tex && tex.naturalWidth) {
    drawSunWithTexture(ctx, x, y, rPX, tex, {
      innerGlow: 1.0, outerGlow: 1.0, haloScale: 1.4, coronaScale: 2.0
    });
    return;
  }

  // —— 其余行星：做“水平贴图卷动”的自转（看起来像从右往左的水平转动） —— //
  // 速度：全局 ROT_SPEED_SCALE × 单星 ROTATION_MS[nameKey]
  const w = (ROTATION_MS && ROTATION_MS[nameKey]) ? ROTATION_MS[nameKey] : 0.0;
  if (w !== 0 && typeof drawDiskImageScroll === 'function' && tex && tex.naturalWidth) {
    const phase = (now * w * ROT_SPEED_SCALE) % 1;   // 0..1
    drawDiskImageScroll(ctx, tex, x, y, rPX, phase, lx, ly);
    return;
  }

  // —— 兜底：没有贴图或不自转，就用已有的贴图圆盘渲染 —— //
  if (typeof drawTexturedDisk === 'function') {
    const spinRad = (spin || 0); // 你原先传入的旋转角度参数
    drawTexturedDisk(ctx, tex, x, y, rPX, spinRad, lx, ly);
  } else {
    // 再兜底：实心圆
    ctx.save();
    const g = ctx.createRadialGradient(x - rPX*0.25, y - rPX*0.25, rPX*0.1, x, y, rPX);
    g.addColorStop(0, '#d8e7ff'); g.addColorStop(1, '#0a1230');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rPX, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// =====================================================================






    function paintComet(obj, sunX, sunY) { const {p, sx, sy, size, S} = obj; let R = pos(size * (0.65 + 0.35*cameraZoom), 1); R = Math.max(R, 2.5); ctx.save(); ctx.translate(sx, sy); const dx = sx - sunX, dy = sy - sunY; const angle = Math.atan2(dy, dx); const rAU = S ? S.r : 1000; const intensity = clamp(1 / (rAU * rAU * 0.2), 0, 1); if (intensity > 0.005) { ctx.rotate(angle); const ionTailLength = clamp(scaleFn(1) * 3.5 * intensity, 0, W * 0.6); const ionGrad = ctx.createLinearGradient(0, 0, -ionTailLength, 0); ionGrad.addColorStop(0, `rgba(120, 180, 255, ${0.5 * intensity})`); ionGrad.addColorStop(1, 'rgba(120, 180, 255, 0)'); ctx.fillStyle = ionGrad; ctx.beginPath(); ctx.moveTo(R*0.5, 0); ctx.lineTo(-ionTailLength, -R*0.8); ctx.lineTo(-ionTailLength, R*0.8); ctx.closePath(); ctx.fill(); ctx.rotate(0.08 * intensity); const dustTailLength = clamp(scaleFn(1) * 3.0 * intensity, 0, W * 0.5); const dustGrad = ctx.createLinearGradient(0, 0, -dustTailLength, 0); dustGrad.addColorStop(0, `rgba(255, 255, 240, ${0.7 * intensity})`); dustGrad.addColorStop(0.3, `rgba(255, 255, 240, ${0.4 * intensity})`); dustGrad.addColorStop(1, 'rgba(255, 255, 240, 0)'); ctx.fillStyle = dustGrad; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-dustTailLength*0.3, -R*2, -dustTailLength*0.7, -R*3, -dustTailLength, -R*2.5); ctx.bezierCurveTo(-dustTailLength*0.7, R*3, -dustTailLength*0.3, R*2, 0, 0); ctx.closePath(); ctx.fill(); ctx.rotate(-0.08 * intensity); } const comaRadius = R * (1.2 + 5 * intensity); const comaGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, comaRadius); comaGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); comaGrad.addColorStop(0.2, `rgba(220, 240, 255, ${0.8 * intensity})`); comaGrad.addColorStop(1, 'rgba(180, 220, 255, 0)'); ctx.fillStyle = comaGrad; ctx.beginPath(); ctx.arc(0, 0, comaRadius, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }

    // ===== 主渲染循环 =====
    function draw(){
        updateAngles();
        if (isCenterLocked() && (cameraOffset.x||cameraOffset.y)) cameraOffset={x:0,y:0};


        // 规范化：edge0 < edge1，取反保持原视觉趋势
        const galaxyAmount = 1 - smoothstep(0.10, 0.26, cameraZoom);
        const solarSystemAlpha = 1 - smoothstep(0.3, 0.5, galaxyAmount);

        // 1. 绘制背景 (将计算好的 galaxyAmount 传递过去)
        if (FX_GALAXY && window.galaxyDrawer) {
            window.galaxyDrawer.draw(ctx, galaxyAmount, cameraOffset, W, H, BRIGHTNESS.galaxy);
        } else {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0,0,W,H);
        }

        // 如果太阳系可见，则进行绘制
        if (solarSystemAlpha > 0.01) {
            ctx.save();
            ctx.globalAlpha = solarSystemAlpha;

            const cx0 = cx + cameraOffset.x;
            const cy0 = getSceneCenterY() + cameraOffset.y;


            // 2. 绘制太阳（贴图 + 发光）
const mercuryA = scaleFn(0.39);
const sunR = pos(Math.max(mercuryA * 0.28, 10), 8);

// 先画一层非常淡的远距离光晕，增强环境光感
ctx.save();
let sunBG = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, sunR * 3.2);
sunBG.addColorStop(0.00, 'rgba(255,242,200,0.20)');
sunBG.addColorStop(1.00, 'rgba(255,180, 80,0.00)');
ctx.fillStyle = sunBG;
ctx.beginPath(); ctx.arc(cx0, cy0, sunR * 2.6, 0, Math.PI*2); ctx.fill();
ctx.restore();

// 贴图 + 内外光晕（不会被后来元素覆盖）
if (typeof drawSunWithTexture === 'function' && TEX && TEX.Sun) {
  drawSunWithTexture(ctx, cx0, cy0, sunR, TEX.Sun, {
    innerGlow : 1.00,
    outerGlow : 1.00,
    haloScale : 1.55,
    coronaScale: 2.15
  });
} else {
  // 兜底：用简易渐变画太阳，避免因贴图缺失导致崩溃
  ctx.save();
  const g = ctx.createRadialGradient(cx0, cy0, sunR*0.2, cx0, cy0, sunR*1.8);
  g.addColorStop(0.00, 'rgba(255,240,200,0.95)');
  g.addColorStop(0.45, 'rgba(255,200,90,0.85)');
  g.addColorStop(1.00, 'rgba(255,160,60,0.00)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx0, cy0, sunR*1.6, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}


            // 3. 绘制轨道
            if(scientific){
                planets.forEach(p=> { if(ELEMS[p.name]) drawOrbitSci(p.name, p.type); });
            } else {
                planets.forEach(p=>{ if (p.type === 'planet') { const a=scaleFn(p.au); const b=a*(1 - p.ecc*0.6); drawOrbit(a,b); } });
            }

            // 4. 绘制小行星带和柯伊伯带
            (function(){ const t=tDaysJ2000; const years=t/365.25; if(scientific){ const J=eclipticHeliocentric('木星', t); const jAng=Math.atan2(J.y,J.x); const inc=10*Math.PI/180, O=80*Math.PI/180; const range=belt.maxAU-belt.minAU; const auPix=scaleFn(1); for(let i=0;i<belt.items.length;i++){ const it=belt.items[i]; const aAU=it.au; const th = it.th + years*(1/Math.sqrt(aAU))*2*Math.PI*0.3 + jAng*0.2; const cu=Math.cos(th), su=Math.sin(th); const cO=Math.cos(O), sO=Math.sin(O), ci=Math.cos(inc), si=Math.sin(inc); const x = aAU*(cO*cu - sO*su*ci); const y = aAU*(sO*cu + cO*su*ci); const z = aAU*(su*si); const P=tiltProjectXYZ(x,y,z); const sx=cx0 + P.x*auPix, sy=cy0 + P.y*auPix; const tpos=(aAU-belt.minAU)/range; const base = 0.12 + 0.22*(1-tpos); const alpha = clamp(base + 0.18*(P.z/(aAU*auPix)), 0.06, 0.5); ctx.fillStyle=`rgba(205,220,255,${alpha*BRIGHTNESS.belt})`; ctx.fillRect(sx, sy, 1, 1); } } else { const range=belt.maxAU-belt.minAU; belt.items.forEach((it,i)=>{ const a=scaleFn(it.au), b=a*0.96; const th=it.th + years*(1/Math.sqrt(it.au))*2*Math.PI*0.3; const P=project(a,b,th); const sx=cx0+P.x, sy=cy0+P.y; const t=(it.au-belt.minAU)/range; const n = Math.sin((it.th*12.9898 + it.au*78.233 + i*0.125))*43758.5453; const noise = (n - Math.floor(n)); const base = 0.22 + 0.30*(1-t); const alpha = clamp(base + 0.28*(noise-0.5) + 0.22*(P.z/pos(a,1)), 0.10, 0.75); ctx.fillStyle=`rgba(205,220,255,${alpha*BRIGHTNESS.belt})`; ctx.fillRect(sx, sy, 1, 1); }); } })();
            (function(){ const t=tDaysJ2000; const years=t/365.25; if(scientific){ const Nep=eclipticHeliocentric('海王星', t); const nAng=Math.atan2(Nep.y,Nep.x); const auPix=scaleFn(1); const range = kuiper.maxAU - kuiper.minAU; for(let i=0;i<kuiper.items.length;i++){ const it=kuiper.items[i]; const aAU=it.au; const th = it.th + years*(1/Math.sqrt(aAU*aAU*aAU))*Math.PI*2*0.6 + nAng*0.15; const cu=Math.cos(th), su=Math.sin(th); const iK = (it.inc||5)*D2R, OK=(it.O||0)*D2R; const cO=Math.cos(OK), sO=Math.sin(OK), ci=Math.cos(iK), si=Math.sin(iK); const x = aAU*(cO*cu - sO*su*ci); const y = aAU*(sO*cu + cO*su*ci); const z = aAU*(su*si); const P=tiltProjectXYZ(x,y,z); const sx=cx0 + P.x*auPix, sy=cy0 + P.y*auPix; const tpos=(aAU-kuiper.minAU)/range; const base = 0.08 + 0.18*(1-tpos); const alpha = clamp(base + 0.35*(P.z/(aAU*auPix)), 0.25, 0.85); ctx.fillStyle=`rgba(185,210,255,${alpha*BRIGHTNESS.kuiper})`; ctx.fillRect(sx, sy, 2, 2); } } else { kuiper.items.forEach((it,i)=>{ const a=scaleFn(it.au), b=a*0.985; const th=it.th + years*(1/Math.sqrt(it.au*it.au*it.au))*Math.PI*2*0.6; const P=project(a,b,th); const sx=cx0+P.x, sy=cy0+P.y; const n = Math.sin((it.th*19.9898 + it.au*33.233 + i*0.251))*13758.5453; const noise = (n - Math.floor(n)); const base=0.22 + 0.28*(1- (it.au-kuiper.minAU)/(kuiper.maxAU-kuiper.minAU)); const alpha = clamp(base + 0.24*(noise-0.5) + 0.20*(P.z/pos(a,1)), 0.08, 0.80); ctx.fillStyle=`rgba(185,210,255,${alpha*BRIGHTNESS.kuiper})`; ctx.fillRect(sx, sy, 1, 1); }); } })();

            // 5. 准备行星列表并排序
            let plist;
            if(scientific){ const t=tDaysJ2000; const auPix=scaleFn(1); plist = planets.map(p=>{ const el = ELEMS[p.name]; if(!el) return null; const S=eclipticHeliocentric(p.name, t); const P=tiltProjectXYZ(S.x, S.y, S.z); const a=scaleFn(S.a); const sx=cx0 + P.x*auPix; const sy=cy0 + P.y*auPix; const z=P.z*auPix; const depthK=DEPTH_SCALE; const depthFactor=clamp(1 + (z/pos(a,1))*depthK, 0.70, 1.30); const size=pos(p.r*depthFactor,1);const spin=getSpin(p.name); return {p,a,sx,sy,z,size,spin, S}; }).filter(Boolean).sort((A,B)=>A.z-B.z);
            } else { plist=planets.map(p=>{ if(p.type === 'comet') return null; const a=scaleFn(p.au); const b=a*(1 - p.ecc*0.6); const P=project(a,b,p.theta); const sx=cx0+P.x, sy=cy0+P.y, z=P.z; const depthK=DEPTH_SCALE; const depthFactor=clamp(1 + (z/pos(a,1))*depthK, 0.70, 1.30); const size=pos(p.r*depthFactor,1);const spin=getSpin(p.name); return {p,a,sx,sy,z,size,spin}; }).filter(Boolean).sort((A,B)=>A.z-B.z); }
            window._lastRenderedList = plist;
            (function(){ try{ const sunR = 12; window._lastRenderedList.push({p:{name:'太阳',type:'sun'}, sx:cx0, sy:cy0, size:sunR}); }catch(e){} })();

            // 6. 绘制行星和标签
            ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.font='12px system-ui, -apple-system, Segoe UI, Roboto, Noto Sans SC, sans-serif';
            const labels=[];
            plist.forEach((obj)=>{ const {p,a,sx,sy,z,size,spin} = obj; const sizeZoom=size*(0.65 + 0.35*cameraZoom); const zNorm=clamp(z/pos(a,1),-1,1); const alpha=clamp(0.18 + 0.28*zNorm, 0.10, 0.65); if (selectedObject && selectedObject.p.name === p.name) { ctx.beginPath(); ctx.arc(sx, sy, sizeZoom + 10, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(110, 217, 239, 0.8)'; ctx.lineWidth = 2.5; ctx.stroke(); } ctx.strokeStyle = `rgba(90,110,200,${alpha})`;
ctx.lineWidth = 1;
const dx = sx - cx0, dy = sy - cy0;
const dist = Math.hypot(dx, dy) || 1;
const startK = (sunR + 2) / dist;           // 让起点在太阳外沿（+2 像素余量）
const x0 = cx0 + dx * startK;
const y0 = cy0 + dy * startK;
ctx.beginPath();
ctx.moveTo(x0, y0);
ctx.lineTo(sx, sy);
ctx.stroke();
const key=p.name; if(lastPos[key]){ const lp=lastPos[key]; const dx=sx-lp.x, dy=sy-lp.y; const speedSq=dx*dx+dy*dy; if(speedSq>4){ ctx.save(); ctx.globalAlpha=0.20; ctx.strokeStyle=`rgba(200,220,255,0.35)`; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(lp.x,lp.y); ctx.lineTo(sx,sy); ctx.stroke(); ctx.restore(); } } lastPos[key]={x:sx,y:sy}; if (p.type === 'planet') { paintPlanet(p,sx,sy,pos(sizeZoom,1),cx0,cy0,spin); } else if (p.type === 'comet') { paintComet(obj, cx0, cy0); } const baseSize = clamp(10 + 6*(cameraZoom*0.6) + 3*(1-Math.abs(zNorm)), 10, 18); const label=p.name; ctx.font=Math.round(baseSize)+'px system-ui, -apple-system, Segoe UI, Roboto, Noto Sans SC, sans-serif'; const w=ctx.measureText(label).width+10, h=baseSize+6; const box={x:sx+sizeZoom+8, y:sy-sizeZoom-h-4, w, h}; labels.push({label, box, baseSize, p}); });

            // 7. 绘制标签的背景和文字
            ctx.save();
            ctx.globalAlpha = BRIGHTNESS.labels;
            window._labelHits = labels.map(it=>({p:it.p, box:it.box}));
            for(let i=0;i<labels.length;i++){ const it=labels[i]; const {label,box,baseSize}=it; if(!FX_LABELS) continue; const mobileNow = isMobileLayout(); if(!mobileNow && LABEL_DENSITY < 0.999){ let h=0; for(let k=0;k<label.length;k++){ h=((h<<5)-h+label.charCodeAt(k)+i)|0; } const ratio=(Math.abs(h)%1000)/1000; if(ratio>LABEL_DENSITY) continue; } ctx.fillStyle='rgba(20,26,56,0.55)'; ctx.strokeStyle='rgba(42,58,115,0.85)'; ctx.lineWidth=1; ctx.beginPath(); if(ctx.roundRect){ ctx.roundRect(box.x,box.y,box.w,box.h,8); } else { ctx.rect(box.x,box.y,box.w,box.h); } ctx.fill(); ctx.stroke(); ctx.fillStyle='#e6eeff'; ctx.font=Math.round(baseSize)+'px system-ui, -apple-system, Segoe UI, Roboto, Noto Sans SC, sans-serif'; ctx.textBaseline='middle'; ctx.textAlign='center'; ctx.fillText(label, box.x+box.w/2, box.y+box.h/2); }
            ctx.restore();

            ctx.restore(); // Corresponds to ctx.save() for solarSystemAlpha
        }
    }

    // ===== 动画循环 =====
    let last=performance.now();
    function tick(now){
        const dt=Math.min(64, now-last);
        last=now;
        if(running){ const ddays = (dt/1000) * BASE_DAYS_PER_SEC * speedMul; if(scientific){ tDaysJ2000 += ddays; safeLocal.set('m.jd', String(tDaysJ2000)); } else { simTimeDays += ddays; safeLocal.set('m.t', String(simTimeDays)); } }
        if(!dragging){ cameraOffset.x += vOffset.x; cameraOffset.y += vOffset.y; vOffset.x *= 0.92; vOffset.y *= 0.92; if(Math.abs(vOffset.x)<0.01) vOffset.x=0; if(Math.abs(vOffset.y)<0.01) vOffset.y=0; }
        draw();
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // =============================================
    // === 通讯接口 ===
    // =============================================
    /**
     * 全局命令网关：engine.command(name, payload?) —— 仅文档化，不改实现。
     *
     * 支持的命令（CommandName）：
     * 'resetView' | 'play' | 'pause' | 'togglePlayPause' | 'setToNow' |
     * 'setSpeed' | 'setTilt' | 'setScientificMode' | 'toggleBrightnessPanel' |
     * 'setBrightness' | 'handleCanvasClick' | 'closeInfoPanel' |
     * 'showSnapshot' | 'hideSnapshot' | 'toggleLudicrousSpeed'
     *
     * 统一约定的返回值：{ ok: boolean, message?: string }。
     * 注：当前多数分支未显式 return；调用方应将 undefined 视为 { ok: true }（兼容旧行为）。
     *
     * 重要说明：亮度命令使用白名单 BR_KEYS，仅接受 'galaxy','belt','kuiper','labels','orbits','rings' 作为 target。
     *
     * 各命令的 payload 形状与边界：
     * - resetView: undefined；副作用：重置缩放/偏移/亮度，持久化 m.zoom，恢复运行并重绘。
     * - play | pause | togglePlayPause: undefined；副作用：running 状态切换。
     * - setToNow: undefined；副作用：根据模式设置当前时间并重绘。
     * - setSpeed: number v，范围 [0.2, 100]，默认取持久化值；副作用：更新基础速度并持久化 m.speed；若极速模式开启会在内部放大仿真速度。
     * - setTilt: number deg，范围 [0, 90]，默认取持久化值；副作用：更新视角并持久化 m.tiltDeg。
     * - setScientificMode: boolean；true=科学，false=观赏；副作用：更新模式并持久化 m.sci，刷新按钮文案。
     * - toggleBrightnessPanel: undefined；副作用：显示/隐藏亮度面板。
     * - setBrightness: { target:string, value:number }；target 必须在 BR_KEYS 中，value 为有限数值（建议 0~1）；
     *   副作用：更新 BRIGHTNESS.*、同步 UI、持久化；当 payload 非法时仅告警且返回 { ok: true }（受控告警）。
     * - handleCanvasClick: { x:number, y:number }；副作用：命中测试并更新信息面板。
     * - closeInfoPanel: undefined；副作用：关闭信息面板。
     * - showSnapshot | hideSnapshot: undefined；副作用：打开/关闭快照面板。
     * - toggleLudicrousSpeed: undefined；副作用：切换极速模式，并按当前滑块值重新应用速度。
     *
     * @param {('resetView'|'play'|'pause'|'togglePlayPause'|'setToNow'|'setSpeed'|'setTilt'|'setScientificMode'|'toggleBrightnessPanel'|'setBrightness'|'handleCanvasClick'|'closeInfoPanel'|'showSnapshot'|'hideSnapshot'|'toggleLudicrousSpeed')} name 命令名
     * @param {*} [payload] 见上方各命令说明
     * @returns {{ ok:boolean, message?:string }|undefined} 未显式返回时请视为 { ok:true }
     */
    window.solarSystemEngine = {
        command: function(cmd, value) {
            if (cmd === 'resetView') {
                cameraZoom = 1; cameraOffset = { x: 0, y: 0 };
                safeLocal.set('m.zoom', String(DEFAULT_CAMERA_ZOOM));
                const zoomRange = document.getElementById('zoomRange');
                const zoomVal = document.getElementById('zoomVal');
                if (zoomRange) zoomRange.value = String(DEFAULT_CAMERA_ZOOM);
                if (zoomVal) zoomVal.textContent = `${DEFAULT_CAMERA_ZOOM.toFixed(2)}x`;
                window.scaleFn = createScaleFn();
                setToNow();
                setRunning(true);
                BRIGHTNESS.belt  = 1; BRIGHTNESS.kuiper= 1; BRIGHTNESS.labels= 0.7; BRIGHTNESS.galaxy = 0.7;
                if(typeof brightnessSyncUI === 'function') brightnessSyncUI();
                if(typeof saveBrightness === 'function') saveBrightness();
                draw();
            }
            if (cmd === 'play') { setRunning(true); }
            if (cmd === 'pause') { setRunning(false); }
            if (cmd === 'togglePlayPause') { setRunning(!running); }
            if (cmd === 'setToNow') { setToNow(); }
            if (cmd === 'setSpeed') { setSpeed(value); }
            if (cmd === 'setTilt') { setTilt(value); }
            if (cmd === 'setScientificMode') { setScientific(value); }
            if (cmd === 'toggleBrightnessPanel') { const panel = document.getElementById('brightnessPanel'); if(panel) panel.style.display = (panel.style.display==='none'?'block':'none'); }
            if (cmd === 'setBrightness') { const BR_KEYS = new Set(['galaxy','belt','kuiper','labels','orbits','rings']); if (BRIGHTNESS && value && BR_KEYS.has(value.target) && typeof value.value === 'number') { BRIGHTNESS[value.target] = value.value; if(typeof brightnessSyncUI === 'function') brightnessSyncUI(); if(typeof saveBrightness === 'function') saveBrightness(); } else { console.warn('[setBrightness] invalid:', value); return { ok: true }; } }
            if (cmd === 'handleCanvasClick') {
                if(dragging) return;
                const clickX = value.x;
                const clickY = value.y;
                let clickedOn = null;
                const lhits = window._labelHits || [];
                for(let i = lhits.length - 1; i >= 0; i--){
                    const L = lhits[i];
                    const b = L.box;
                    if(clickX >= b.x && clickX <= b.x + b.w && clickY >= b.y && clickY <= b.y + b.h){
                        clickedOn = { p: L.p, sx: b.x + b.w / 2, sy: b.y + b.h / 2, size: 10 };
                        break;
                    }
                }
                if (!clickedOn) {
                    const list = window._lastRenderedList || [];
                    for(let i = list.length - 1; i >= 0; i--){
                        const obj = list[i];
                        const dx = clickX - obj.sx;
                        const dy = clickY - obj.sy;
                        const dist = Math.hypot(dx, dy);
                        const clickRadius = (obj.p.type === 'comet' || obj.p.type === 'sun') ? 24 : (obj.size * 1.5 + 8);
                        if(dist < clickRadius){ clickedOn = obj; break; }
                    }
                }
                selectedObject = clickedOn;
                if (selectedObject && selectedObject.p && selectedObject.p.name && selectedObject.p.name !== '地球') {
                    const distKm = getDistance('地球', selectedObject.p.name, scientific ? tDaysJ2000 : daysSinceJ2000(new Date()));
                    if (Number.isFinite(distKm)) selectedObject.distKm = distKm;
                } else if (selectedObject && selectedObject.p && selectedObject.p.name === '地球') {
                    selectedObject.distKm = 0;
                }
                if (selectedObject && !isCenterLocked()) {
                    cameraOffset.x += (cx - selectedObject.sx) * 0.65;
                    cameraOffset.y += (cy - selectedObject.sy) * 0.65;
                }
                updateInfoPanel();
            }
            if (cmd === 'closeInfoPanel') { selectedObject = null; cameraOffset = { x: 0, y: 0 }; updateInfoPanel(); }
            if (cmd === 'showSnapshot') {
    const panel = document.getElementById('snapshotPanel');
    if (!panel) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    const targetPlanets = ['火星', '木星', '土星', '海王星'];
    const target = selectedObject?.p?.name && selectedObject.p.name !== '太阳' ? selectedObject.p.name : targetPlanets[Math.floor(Math.random() * targetPlanets.length)];
    const t = daysSinceJ2000(now);
    const distKm = target === '地球' ? 0 : getDistance('地球', target, t);
    const distFormatted = formatDistanceKm(distKm);
    const lightFormatted = formatLightTime(distKm);

    const templates = [
        '\u6b64\u523b\uff0c\u4f60\u4e0e {planet} \u76f8\u9694 {distance}\u3002',
        '\u6b64\u523b\uff0c\u4ece\u5730\u7403\u671b\u5411 {planet}\uff0c\u8ddd\u79bb\u7ea6\u4e3a {distance}\u3002',
        '\u5982\u679c\u628a\u89c6\u7ebf\u6295\u5411 {planet}\uff0c\u4f60\u6b63\u5728\u8de8\u8d8a {distance} \u7684\u6df1\u7a7a\u3002'
    ];
    const quoteTemplates = [
        '\u5149\u5728\u5b87\u5b99\u91cc\u5954\u8dd1\uff0c\u4e5f\u9700\u8981\u65f6\u95f4\u3002',
        '\u62ac\u5934\u65f6\uff0c\u6211\u4eec\u770b\u5230\u7684\u662f\u65f6\u95f4\u7559\u4e0b\u6765\u7684\u5149\u3002',
        '\u6bcf\u4e00\u6b21\u4ef0\u671b\uff0c\u90fd\u662f\u4e00\u6b21\u8de8\u8d8a\u5c3a\u5ea6\u7684\u76f8\u9047\u3002'
    ];

    document.getElementById('snapshotTime').textContent = `${year}\u5e74 ${month}\u6708 ${day}\u65e5 ${hours}:${minutes}`;
    document.getElementById('snapshotData').textContent = templates[Math.floor(Math.random() * templates.length)]
        .replace('{planet}', target)
        .replace('{distance}', distFormatted);
    const snapshotLight = document.getElementById('snapshotLight');
    if (snapshotLight) snapshotLight.textContent = `\u5149\u884c\u65f6\uff1a${lightFormatted}`;
    document.getElementById('snapshotQuote').textContent = `\u201c${quoteTemplates[Math.floor(Math.random() * quoteTemplates.length)]}\u201d`;

    panel.classList.add('visible');
    window.isSnapshotVisible = true;
}

            if (cmd === 'hideSnapshot') {
    const panel = document.getElementById('snapshotPanel');
    if (panel) {
        panel.classList.remove('visible');
    }
    window.isSnapshotVisible = false;
}
            if (cmd === 'setZoom') { setZoom(parseFloat(value)); }
            if (cmd === 'setCinemaMode') { cinemaMode = !!value; document.body.classList.toggle('cinema-mode', cinemaMode); }
            if (cmd === 'toggleLudicrousSpeed') {
    ludicrousMode = !ludicrousMode; // 切换模式状态
    const btn = document.getElementById('btnLudicrous');
    if(btn) btn.setAttribute('aria-pressed', ludicrousMode); // 更新按钮的视觉状态

    // 重新计算并应用当前滑块的速度
    const currentRangeValue = speedRange ? parseFloat(speedRange.value) : DEFAULT_SPEED_MULTIPLIER;
    setSpeed(Number.isFinite(currentRangeValue) ? currentRangeValue : DEFAULT_SPEED_MULTIPLIER);
}
        }
    };
});

// === 让“重置”在前、“亮度”在最右（不改 HTML，仅在 DOM 上重排一次） ===
window.addEventListener('DOMContentLoaded', () => {
  // 底部操作栏的容器：三选一匹配（你的项目里命中其一即可）
  const bar = document.querySelector('.bottom-actions, .hud-bottom, .controls-bottom');
  if (!bar) return;

  const btns = [...bar.querySelectorAll('button, .btn, [role="button"]')];
  const btnBrightness = btns.find(b => /亮度/.test((b.textContent || '').trim()));
  const btnReset      = btns.find(b => /重置/.test((b.textContent || '').trim()));

  if (btnBrightness && btnReset) {
    // 顺序：…（其他）— 重置 — 亮度（最右）
    bar.insertBefore(btnReset, btnBrightness);
    bar.appendChild(btnBrightness);
  }
});

// 按需加载诊断叠层：仅当 URL 参数 diag=1 时插入脚本（默认不加载，不影响性能）
(function(){
  try{
    var params = new URLSearchParams(window.location.search || '');
    if (params.get('diag') === '1') {
      var s = document.createElement('script');
      s.src = './tools/diag_overlay.js'; // 相对 solar_system_new.html
      (document.head || document.documentElement).appendChild(s);
    }
  }catch(e){ /* 静默失败，不影响主逻辑 */ }
})();
