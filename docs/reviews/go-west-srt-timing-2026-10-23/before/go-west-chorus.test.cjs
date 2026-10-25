const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const T=require('../miniprogram/node_modules/threejs-miniprogram').createScopedThreejs({width:390,height:753,createImage(){return{}}});
const timingBox={};vm.runInNewContext(fs.readFileSync('miniprogram/pages/gl/go-west-finale-timing.js','utf8').replace(/export /g,'')+'\nglobalThis.cutoff=GO_WEST_LYRIC_CUTOFF;',timingBox);
const box={console,GO_WEST_LYRIC_CUTOFF:timingBox.cutoff};vm.createContext(box);
for(const file of ['miniprogram/assets/data/go-west-text.js','miniprogram/assets/data/go-west-cues.js',
 'miniprogram/assets/data/go-west-title-shapes.js','miniprogram/pages/gl/go-west-chorus.js'])
 vm.runInContext(fs.readFileSync(file,'utf8').replace(/^import .*$/gm,'').replace(/export /g,''),box,{filename:file});
vm.runInContext('globalThis.api={goWestChorusFrame,createGoWestSkyGlyphs,GoWestChorusSky};',box);
const {goWestChorusFrame,createGoWestSkyGlyphs,GoWestChorusSky}=box.api;
for(const at of [0,36,65,87.49,99.59,163.55,210.14,228.74,247.1,248.1,251.3,259])assert.equal(goWestChorusFrame(at),null);
for(const [at,id,mode] of [[66.5,'a1','stars'],[67.4,'a1','stars'],[131,'b','bands'],[212,'a2','stars'],[232,'reprise','stars']]){
 const f=goWestChorusFrame(at);assert.equal(f.id,id);assert.equal(f.mode,mode);
 assert.ok(f.alpha>=0&&f.alpha<=1&&f.formation>=0&&f.formation<=1);
}
assert.equal(goWestChorusFrame(66.37).formation,0);
assert.equal(goWestChorusFrame(67.27).formation,1,'Word forms by the first sung Go West');
assert.equal(goWestChorusFrame(73).formation,1,'No repeated gather cycle for each chorus line');
assert.ok(goWestChorusFrame(67.37).pulse>goWestChorusFrame(68).pulse);
assert.ok(goWestChorusFrame(68.17).pulse>.2,'A call still shimmers after 0.9 seconds');
assert.equal(goWestChorusFrame(68.68).pulse,0,'The accent releases before the next phrase');
for(const start of [130.72,134.42,138.35,142.30,146.47,150.33,154.28,158.18]){
 assert.ok(goWestChorusFrame(start+.1).pulse>.9,'Every repeated Go West receives its own strong accent');
}
assert.equal(goWestChorusFrame(133).pulse,0);
for(const start of [130.72,134.42,138.35,142.30,146.47,150.33,154.28]){
 const on=goWestChorusFrame(start+.1),held=goWestChorusFrame(start+.95),fading=goWestChorusFrame(start+1.55),idle=goWestChorusFrame(start+2.25);
 assert.ok(on.neon>1&&held.neon>1,'Each sung call powers the neon for about a second');
 assert.ok(fading.neon<held.neon&&fading.neon>idle.neon,'Afterglow gradually subsides after the call');
 assert.ok(idle.neon>on.neon*.24&&idle.neon<on.neon*.28,'Dim powered outline stays clearly visible between calls');
 assert.equal(idle.neonAccent,0);
}
assert.equal(goWestChorusFrame(158.18).neonAccent,0,'Eighth call retains its quick ignition');
for(let at=158.23;at<161.83;at+=.05){
 const f=goWestChorusFrame(at);
 assert.equal(f.neonAccent,1,'Eighth call stays powered until the word exits');
 assert.equal(f.neon,1.48);assert.equal(f.neonStyle,3);
 assert.equal(f.neonTube,2.7);assert.equal(f.neonHalo,3.8);
 assert.equal(f.neonRays,1);assert.equal(f.neonGlass,1);
 assert.ok(Math.abs(f.neonAge-(at-158.18))<1e-9,'Held chase keeps advancing');
}
assert.ok(goWestChorusFrame(161.6).alpha>0&&goWestChorusFrame(161.6).alpha<1,'Whole-word exit remains intact');
assert.equal(goWestChorusFrame(161.83),null);
assert.equal(goWestChorusFrame(157).neonAccent,0,'Seeking before the eighth call does not retain its light');
assert.equal(goWestChorusFrame(133).neon,goWestChorusFrame(133.3).neon,'No unrelated bright flashes between vocal accents');
assert.ok(Math.abs(goWestChorusFrame(67.9).replyAge-.13)<1e-8);
assert.ok(Math.abs(goWestChorusFrame(232.5).replyAge-.1)<1e-8,'Reversed vocal retains its one-second response delay');
assert.equal(goWestChorusFrame(232).small,true);
const levels=[130.72,134.42,138.35,142.30].map(t=>goWestChorusFrame(t+.5));
for(let i=1;i<4;i++)for(const key of ['neonTube','neonHalo','neonGlass'])assert.ok(levels[i][key]>levels[i-1][key],'Physical neon properties increase through the four calls');
assert.equal(levels[0].neonTube,1);assert.equal(levels[3].neonTube,2.7);
assert.equal(levels[0].neonRays,0);assert.equal(levels[1].neonRays,0);
assert.ok(levels[3].neonRays>levels[2].neonRays&&levels[2].neonRays>0);
for(const key of ['neonTube','neonHalo','neonRays','neonGlass'])assert.equal(goWestChorusFrame(146.97)[key],levels[0][key],'Fifth call restarts the full physical progression');
assert.equal(goWestChorusFrame(246.9).end,247.1);
assert.ok(goWestChorusFrame(246.9).alpha<1,'Sky lyric releases before confetti');
const neonCalls=[130.72,134.42,138.35,142.30,146.47,150.33,154.28,158.18];
assert.deepEqual(neonCalls.map(t=>goWestChorusFrame(t+.3).neonStyle),[0,1,2,3,0,1,2,3]);
for(const start of neonCalls){
 assert.ok(Math.abs(goWestChorusFrame(start+.3).neonAge-.3)<1e-9,'Each effect restarts on its sung call');
}

const glyphs=createGoWestSkyGlyphs(T);
assert.equal(glyphs.targets.length,5700);
assert.ok(Array.from(glyphs.targets).every(Number.isFinite));
assert.ok(glyphs.contours.length>=7,'At least one hollow glyph contour');
const o=glyphs.contours.filter(c=>c.letter===1);
const area=pts=>Math.abs(pts.reduce((n,p,i)=>{const q=pts[(i+1)%pts.length];return n+p[0]*q[1]-q[0]*p[1];},0));
const hole=o.slice().sort((a,b)=>area(a.points)-area(b.points))[0].points;
const holeCentre=hole.reduce((a,p)=>[a[0]+p[0]/hole.length,a[1]+p[1]/hole.length],[0,0]);
const innerHole=hole.map(p=>[holeCentre[0]+(p[0]-holeCentre[0])*.70,holeCentre[1]+(p[1]-holeCentre[1])*.70]);
function inside(x,y,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
for(let i=0;i<glyphs.targets.length;i+=3){
 assert.ok(Math.abs(glyphs.targets[i])<.51&&Math.abs(glyphs.targets[i+1])<.1);
 assert.equal(inside(glyphs.targets[i],glyphs.targets[i+1],innerHole),false,'Stars preserve O’s transparent centre');
}
assert.ok(Array.from({length:glyphs.targets.length/3},(_,i)=>[glyphs.targets[i*3],glyphs.targets[i*3+1]])
 .some(p=>!glyphs.contours.some(c=>inside(p[0],p[1],c.points))), 'Star letter strokes extend beyond the original thin outlines');
const scene=new T.Scene(),camera=new T.PerspectiveCamera(50,390/753,.1,1000);
const geometry=new T.BufferGeometry(),positions=[],sizes=[];
for(let i=0;i<500;i++){positions.push((i%20-9.5)*2,(Math.floor(i/20)-12)*2,-100);sizes.push(.5+i/1000);}
geometry.addAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.addAttribute('size',new T.Float32BufferAttribute(sizes,1));
const stars=new T.Points(geometry,new T.ShaderMaterial({uniforms:{uBrightnessGain:{value:1.4},uOpacity:{value:.18}}}));scene.add(stars);
const original=Array.from(geometry.attributes.size.array);let viewport={windowWidth:390,windowHeight:753,pixelRatio:3};
const sky=new GoWestChorusSky({THREE:T,scene,camera,getViewport:()=>viewport,getStars:()=>stars});
sky.update(12);assert.equal(sky.points,undefined,'Other song stages do not allocate chorus geometry');
sky.update(67.4);assert.equal(sky.points.visible,true);assert.equal(sky.bands.visible,false);
assert.equal(sky.borrowed.length,220,'Only a subset of the original sky joins the word');
assert.ok(Array.from(geometry.attributes.size.array).some((v,i)=>v<original[i]));
assert.equal(stars.material.uniforms.uBrightnessGain.value,1.4,'Chorus letters do not add sky-flash events');
const resource=sky.points.geometry,origins=Array.from(resource.attributes.position.array);
sky.update(70);assert.equal(sky.points.geometry,resource);assert.deepEqual(Array.from(resource.attributes.position.array),origins);
for(const width of [320,375,430]){
 viewport={...viewport,windowWidth:width};sky.update(70);
 const u=sky.points.material.uniforms;
 for(let i=0;i<glyphs.targets.length;i+=3){
  assert.ok(Math.abs(glyphs.targets[i]*u.width.value*2)<1);
  assert.ok(Math.abs(glyphs.targets[i+1]*u.width.value*2*u.aspect.value+u.center.value)<1);
 }
}
sky.update(131);assert.equal(sky.bands.visible,true);assert.equal(sky.points.visible,false);
assert.deepEqual(Array.from(geometry.attributes.size.array),original,'B uses light contours and restores the borrowed sky');
assert.equal(sky.bands.material.uniforms.formation.value,1);
assert.equal(sky.bands.material.side,T.DoubleSide,'Contour strips show both triangle winding directions');
const tube=sky.bands.geometry.attributes.position;
assert.ok(Math.hypot(tube.getX(0)-tube.getX(1),tube.getY(0)-tube.getY(1))>.0087,'Neon halo strips have twice the former thickness');

assert.ok(sky.bands.geometry.attributes.position.count>5000,'Light ribbons are real contour strips');
for(let i=0;i<neonCalls.length;i++){
 sky.update(neonCalls[i]+.3);const u=sky.bands.material.uniforms;
 assert.equal(u.neonStyle.value,i%4);
 assert.equal(sky.rays.visible,i%4>=2,'Only the two strongest calls emit contour rays');
 assert.ok(Math.abs(u.neonAge.value-.3)<1e-9);
 const style=u.neonStyle.value;sky.update(140);sky.update(neonCalls[i]+.3);
 assert.equal(u.neonStyle.value,style,'Seeking reproduces the same chase, without accumulated state');
}
assert.equal(sky.rays.geometry.attributes.position.count,720,'120 rays are real tapered triangle strips');
sky.update(161.5);assert.equal(sky.rays.visible,true);
assert.equal(sky.bands.material.uniforms.neonAccent.value,1,'Held light reaches the rendering layer');
assert.ok(sky.bands.material.uniforms.neonAge.value>3,'Chase clock continues beyond the former release');
sky.update(162);assert.equal(sky.root.visible,false,'Held neon leaves with the whole word');
for(const attribute of Object.values(sky.rays.geometry.attributes))assert.ok(Array.from(attribute.array).every(Number.isFinite));
const offset=sky.bands.geometry.attributes.tubeOffset,baseTube=sky.bands.geometry.attributes.position;
assert.equal(offset.count,baseTube.count);assert.ok(Array.from(offset.array).some(v=>Math.abs(v)>.004),'Tube width expands real edges instead of scaling the complete word');
sky.update(247.1);assert.equal(sky.root.visible,false);
assert.deepEqual(Array.from(geometry.attributes.size.array),original,'Confetti cleanup restores all borrowed stars');
sky.update(212);assert.equal(sky.points.visible,true);assert.equal(sky.bands.visible,false);
sky.update(232);assert.equal(sky.points.material.uniforms.width.value,.43,'Reverse vocal lead stays smaller');
sky.update(null);assert.equal(sky.root.visible,false);assert.deepEqual(Array.from(geometry.attributes.size.array),original);
sky.update(70);let disposed=0,borrowedDisposed=0;
for(const r of [...sky.geometries,...sky.materials])r.addEventListener('dispose',()=>disposed++);
geometry.addEventListener('dispose',()=>borrowedDisposed++);stars.material.addEventListener('dispose',()=>borrowedDisposed++);
sky.dispose();sky.dispose();assert.equal(disposed,8);assert.equal(borrowedDisposed,0);
assert.equal(sky.root.parent,null);assert.deepEqual(Array.from(geometry.attributes.size.array),original);
console.log('Go West chorus: A/B/A, original-star gathering/restore, hollow glyphs, light ribbons, reverse vocals, mobile bounds and disposal PASS');
