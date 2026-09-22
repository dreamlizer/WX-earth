const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '../miniprogram/pages/gl');
const context = {Math};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'poetry-motion.js'),'utf8').replace(/export /g,''),context);
const place = context.placePoetryAvoidingOverlap;
const overlap = (a,b) => Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const bounds = {minX:18,minY:18,maxX:372,maxY:488};
for (const [w,h] of [[28,240],[280,58],[330,115],[150,160]]) {
  const old={x:40,y:160,w,h,area:w*h};
  const proposed={tx:22,ty:-45};
  const result=place({x:40,y:160},w,h,proposed,bounds,old,.1);
  assert.ok(result.fits,'ordinary lyric frames must find room');
  for(let i=0;i<=100;i++) {
    const box={x:result.start.x+result.move.tx*i/100,y:result.start.y+result.move.ty*i/100,w,h};
    assert.ok(overlap(box,old)/Math.min(w*h,old.area)<=.10000001,'entire drift stays below 10%');
    assert.ok(box.x>=18 && box.x+w<=372.00001 && box.y>=18 && box.y+h<=488.00001);
  }
}
// Short text cannot be mostly covered by a much larger predecessor.
const large={x:18,y:100,w:340,h:180,area:340*180};
const short=place({x:100,y:160},50,30,{tx:0,ty:0},bounds,large,.1);
assert.ok(short.fits);
assert.ok(overlap({...short.start,w:50,h:30},large)/(50*30)<=.1);
const impossible=place({x:18,y:18},354,470,{tx:0,ty:0},bounds,{x:18,y:18,w:354,h:470,area:354*470},.1);
assert.equal(impossible.fits,false,'no-space fallback must be explicit');

// Exercise the real manager for all three Chinese-interface track IDs.
(async()=>{
 for (const preset of [1,102,103]) {
  let now=10000;
  const timers=[]; const updates=[];
  let measured=true;
  const c={...context, console:{info(){},log(){},warn(){},table(){}}, Date:{now:()=>now},
    setTimeout(fn,ms){if(ms===16)return Promise.resolve().then(fn);timers.push({fn,ms});return timers.length;},clearTimeout(){}};
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(root,'poetry-manager.js'),'utf8').replace(/^import.*$/gm,'').replace('export class','class')+'\nthis.PoetryManager=PoetryManager;',c);
  const mgr=new c.PoetryManager({appCfg:{poetry:{use3D:false,preferLineDuration:true,fadeOutMs:1200,crossfadeMs:800,maxOverlapRatio:.1}},
    getViewport:()=>({windowWidth:390,windowHeight:844}),getCanvasRect:()=>({top:0,height:844}),
    measure:async()=>measured?({width:preset===1?28:280,height:preset===1?240:70}):null,setData:d=>updates.push(d)});
  await mgr.start(preset,{[preset]:[{text:'one',duration:5000,'start-time':0},{text:'two',duration:5000,'start-time':5000}]});
  await mgr._showLineOn(true,'one',5000,{x:100,y:150});
  const old=mgr._placements.poetryA;
  now+=4500;
  await mgr._showLineOn(false,'two',5000,{x:100,y:150});
  const next=mgr._placements.poetryB;
  for(let elapsed=0;elapsed<=1700;elapsed+=10){
    const box=p=>{const k=Math.max(0,Math.min(1,(now+elapsed-p.motionStart)/p.duration));return {x:p.x+p.tx*k,y:p.y+p.ty*k,w:p.w,h:p.h};};
    assert.ok(overlap(box(old),box(next))/Math.min(old.w*old.h,next.w*next.h)<=.100001,`preset ${preset} transition overlap`);
  }
  assert.ok(updates.some(d=>d['poetryB.visible']===true));
  measured=false;
  await mgr._showLineOn(true,'unmeasured long lyric',5000);
  assert.ok(updates.some(d=>d['poetryB.fadeMs']===0 && d['poetryB.visible']===false),'unknown size must not overlap outgoing text');
  assert.equal(mgr._placements.poetryA.x,18);
  assert.equal(mgr._placements.poetryA.tx,0);
  mgr.resetImmediate();assert.equal(Object.keys(mgr._placements).length,0);
 }
 console.log('poetry overlap tests passed: vertical/horizontal, movement, unequal frames, no-space fallback, three tracks');
})().catch(e=>{console.error(e);process.exitCode=1;});
