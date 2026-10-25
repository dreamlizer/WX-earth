const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const T=require('../miniprogram/node_modules/threejs-miniprogram').createScopedThreejs({width:390,height:753,createImage(){return {}}});
function load(file,names,extra={}){const box={module:{exports:{}},console,Math,Number,Object,Array,Date,...extra};vm.runInNewContext(fs.readFileSync('miniprogram/pages/gl/'+file,'utf8').replace(/^import.*$/gm,'').replace(/export (class|function|const) /g,'$1 ')+'\nmodule.exports={'+names+'};',box);return box.module.exports;}
const {ZenVisualClock}=load('zen-visual-clock.js','ZenVisualClock');
const clock=new ZenVisualClock(),audio={currentTime:1,paused:false};let before=clock.read(audio,0);
for(let now=16;now<=496;now+=16){const t=clock.read(audio,now);assert.ok(t-before>.015&&t-before<.017,'Coarse audio sample still gives render-frame increments');before=t;}
audio.currentTime=1.5;const sampled=clock.read(audio,512);assert.ok(sampled-before<.017,'New audio sample does not introduce a visible speed jump');
audio.paused=true;assert.equal(clock.read(audio,612),sampled);audio.currentTime=6;assert.equal(clock.read(audio,620),6,'Intentional seek reanchors');
(async()=>{
const glyphData={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync('miniprogram/assets/data/go-west-title-shapes.js','utf8').replace(/export /g,'')+'\nmodule.exports={GO_WEST_TITLE_SHAPES};',glyphData);
const artistData={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync('miniprogram/assets/data/go-west-artist-shapes.js','utf8').replace(/export /g,'')+'\nmodule.exports={GO_WEST_ARTIST_SHAPES};',artistData);
const motion=load('go-west-opening-motion.js','goWestOpeningSpin,goWestOpeningFragment');
const billboard=load('go-west-opening.js','GoWestOpening3D,goWestTitleFrame,goWestRetreatPoint,createGoWestLetterGeometry,splitGoWestLetter',{...glyphData.module.exports,...artistData.module.exports,...motion,
 wx:{createOffscreenCanvas(){const context={font:'',measureText(text){return {width:text.length*parseFloat(this.font.split(' ')[1])};},clearRect(){},fillText(){}};
  return {width:1,height:1,getContext:()=>context};}}});
const {openingArtFrame,goWestOpeningFrame,ZenOpeningArt}=load('zen-opening-art.js','openingArtFrame,goWestOpeningFrame,ZenOpeningArt',{...billboard,ZenVisualClock,ensureSceneArtPackage:()=>Promise.resolve()});
const a=openingArtFrame(6,16800),b=openingArtFrame(6.016,16800),c=openingArtFrame(6.032,16800);
assert.ok(b.titleScale>a.titleScale&&b.titleScale-a.titleScale<.0002);
assert.ok(Math.abs((b.titleScale-a.titleScale)-(c.titleScale-b.titleScale))<1e-12,'Subpixel scale increments remain linear');
assert.equal(openingArtFrame(7.9,16800).artistAlpha,0);assert.equal(openingArtFrame(16.5,16800).titleAlpha,0);
assert.ok(openingArtFrame(13,16800).artistDrop>openingArtFrame(10,16800).artistDrop);
assert.equal(openingArtFrame(16.5,16800).titleScale,1.10);
assert.equal(openingArtFrame(16.5,16800).artistScale,1.50);
const scene=new T.Scene(),camera=new T.PerspectiveCamera(50,390/753,.1,100),maps=[],callbacks=[];
class Loader{load(path,fn){const t=new T.Texture();maps.push(t);callbacks.push(()=>fn(t));return t;}}
const art=new ZenOpeningArt({THREE:{...T,TextureLoader:Loader},scene,camera,getViewport:()=>({windowWidth:390,windowHeight:753})});
assert.equal(maps.length,0,'Image reads wait for the art subpackage');
await art.ready;
callbacks.forEach(fn=>fn());art.clock={read:()=>6,reset(){}};
art.update({getAudio:()=>audio,firstLyricMs:16800,topPx:173},true);const scale=art.layers.title.scale.x;
art.clock.read=()=>6.016;art.update({getAudio:()=>audio,firstLyricMs:16800,topPx:173},true);assert.ok(art.layers.title.scale.x>scale);
assert.equal(art.layers.title.material.depthTest,false,'Title stays in front of spacecraft');
art.clock.read=()=>12;
art.update({preset:103,getAudio:()=>audio,firstLyricMs:32800,topPx:173},true);
assert.equal(art.layers.title.material.map,art.maps['out-of-darkness-title']);
assert.equal(art.layers.artist.material.map,art.maps['aubrey-ashburn']);
assert.ok(art.layers.artist.scale.x<2*2*Math.tan(camera.fov*Math.PI/360)*camera.aspect*.69,'Artist remains a single line within the viewport');
assert.ok(openingArtFrame(30,32800).titleAlpha>0);
assert.equal(openingArtFrame(32.5,32800).titleAlpha,0,'Out of Darkness opening ends before its first lyric');
const outOptions={artistDelay:2,titleFade:3.4,artistGrowth:.70,titleStart:-.08,titleDrift:.18,artistDrift:-.05,artistDrop:18};
const outFrame=time=>openingArtFrame(time,32800,.50,outOptions);
assert.equal(outFrame(3.99).titleAlpha,0);assert.ok(outFrame(4.01).titleAlpha>0);
assert.ok(outFrame(5.8).titleAlpha<.6,'Earlier title is still softly fading, rather than fully bright at 1.8 seconds');
assert.equal(outFrame(7.4).titleAlpha,1);
assert.equal(outFrame(9.99).artistAlpha,0);assert.ok(outFrame(10.01).artistAlpha>0);
assert.equal(outFrame(32.5).titleScale,1.50);
assert.equal(outFrame(32.5).artistScale,1.70);
assert.equal(outFrame(32.5).titleAlpha,0);assert.equal(outFrame(32.5).artistAlpha,0);
assert.ok(outFrame(20).titleShift>outFrame(12).titleShift);
assert.ok(outFrame(20).artistShift<outFrame(12).artistShift);
assert.ok(outFrame(20).artistDrop>outFrame(12).artistDrop);
assert.ok(Math.abs(outFrame(20.032).titleShift-2*outFrame(20.016).titleShift+outFrame(20).titleShift)<1e-12,'Drift stays continuous per render frame');
const outScreenWidth=4*Math.tan(camera.fov*Math.PI/360)*camera.aspect;
assert.ok(Math.abs(art.layers.title.scale.x-outScreenWidth*.84*outFrame(12).titleScale)<1e-12,'Out of Darkness uses its own 50% title growth');
assert.ok(art.layers.title.position.x<0,'Title begins left of center');
art.clock.read=()=>30;
art.update({preset:103,getAudio:()=>audio,firstLyricMs:32800,topPx:173},true);
assert.ok(art.layers.title.position.x>0&&art.layers.artist.position.x<0,'Title and artist move in opposite directions');
art.update(null,false);assert.equal(art.group.visible,false);
art.clock.read=()=>20;
art.update({preset:104,getAudio:()=>audio,firstLyricMs:36020,topPx:173},true);
assert.equal(art.layers.title.visible,false,'Fourth track uses actual metal glyphs');
const frameAt=t=>goWestOpeningFrame(t,36020);
assert.equal(frameAt(31.22).alpha,0);assert.equal(frameAt(31.22).artistAlpha,0);
assert.equal(frameAt(30).alpha,1,'Retreat stays visible behind the globe');
assert.equal(frameAt(5.49).alpha,0);assert.equal(frameAt(10.2).artistAlpha,0);
assert.ok(frameAt(11).artistAlpha>0&&frameAt(11).artistAlpha<.3,'Credit enters later, independently');
assert.equal(frameAt(15.9).artistRise,1);assert.equal(frameAt(15.9).artistAlpha,1);
assert.equal(art.billboard.letters.length,6);
assert.equal(art.billboard.letters.reduce((n,l)=>n+l.parts.length,0),18,'Six real glyphs arrive in eighteen pieces');
assert.equal(art.billboard.artist.parent,art.billboard.root,'Credit does not inherit the title tumble');
assert.equal(art.billboard.artist.children.length,11,'Pet Shop Boys uses the approved serif outlines, without a texture');
for(const {parts}of art.billboard.letters)for(const {mesh}of parts){
 assert.equal(mesh.material.depthTest,true);assert.ok(mesh.geometry.attributes.normal.count>0);
}
const originalO=billboard.createGoWestLetterGeometry(T,glyphData.module.exports.GO_WEST_TITLE_SHAPES[1]);
assert.equal(originalO.parameters.shapes[0].holes.length,1,'O retains its true hole');
const split=billboard.splitGoWestLetter(T,originalO,1);
assert.equal(split.reduce((n,p)=>n+p.geometry.attributes.position.count,0),originalO.attributes.position.count,'Partition preserves every original triangle');
split.forEach(p=>p.geometry.dispose());originalO.dispose();
const f0=motion.goWestOpeningFragment(6.5,0,0),f1=motion.goWestOpeningFragment(6.5,0,1);
assert.notEqual(f0.x,f1.x);assert.notEqual(f0.ry,f1.ry,'Pieces have different paths and multiple turns');
assert.ok(Math.abs(motion.goWestOpeningFragment(5.5,0,0).rx)>Math.PI*2);
for(let t=5.5;t<14;t+=.025)for(let i=0;i<6;i++)for(let j=0;j<3;j++){
 const f=motion.goWestOpeningFragment(t,i,j);assert.ok(Object.values(f).every(Number.isFinite));
}
for(let i=0;i<6;i++)for(let j=0;j<3;j++){
 const f=motion.goWestOpeningFragment(14,i,j);assert.equal(f.alpha,1);assert.equal(f.scale,1);
 assert.ok(Math.abs(f.x)+Math.abs(f.y)+Math.abs(f.z)+Math.abs(f.rx)+Math.abs(f.ry)+Math.abs(f.rz)<1e-12,'Shards reunite exactly');
}
assert.ok(frameAt(28).x>frameAt(20).x,'Readable title keeps moving');
assert.ok(frameAt(28).artistX<frameAt(20).artistX,'Independent credit glides the other way');
assert.ok(frameAt(28).artistScale>frameAt(20).artistScale);
for(let t=15;t<28;t+=.1){
 const f=frameAt(t),n=frameAt(t+.016);assert.ok(Math.abs(f.x-n.x)<.0003&&Math.abs(f.artistX-n.artistX)<.0003,'Continuous readable motion');
}
const prop=art.billboard,anchor=new T.Vector3(.18,-.42,-5.4),body={center:new T.Vector3(0,-.45,-5.4),radius:1.15};
prop.update(10.2,36020,173,{windowWidth:390,windowHeight:753},camera,[],10,anchor);
assert.ok(prop.artist.position.distanceTo(anchor)<1e-12,'The later credit rises from the live globe');
prop.update(11.2,36020,173,{windowWidth:390,windowHeight:753},camera,[],10,anchor);
const earlyCredit=prop.artist.position.clone(),earlySize=prop.artist.scale.x;
prop.update(15.9,36020,173,{windowWidth:390,windowHeight:753},camera,[],10,anchor);
assert.ok(prop.artist.position.y>earlyCredit.y&&prop.artist.position.z>earlyCredit.z&&prop.artist.scale.x>earlySize);
for(const width of [320,375,430])for(const fov of [45,50]){
 const nativeCamera=new T.PerspectiveCamera(fov,width/703,.1,100);
 for(let time=14;time<33.2;time+=.25){
  prop.update(time,36020,173,{windowWidth:width,windowHeight:753},nativeCamera,[],10,anchor,body);
  prop.root.updateMatrixWorld(true);nativeCamera.updateMatrixWorld(true);
  prop.root.traverse(mesh=>{
   if(!mesh.geometry)return;mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;
   for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const point=new T.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld).project(nativeCamera);
    assert.ok(Math.abs(point.x)<1&&Math.abs(point.y)<1,'Readable metal and serif credit fit mobile viewports '+JSON.stringify({time,width,fov,name:mesh.name,point}));
   }
  });
 }
}
for(const time of [29.02,29.6,30.8,31.12]){
 prop.update(time,36020,173,{windowWidth:390,windowHeight:753},camera,[],10,anchor,body);
 if(time>=30.8)for(const object of [prop.title,prop.artist]){
  assert.ok(object.position.z<body.center.z,'Existing physical retreat remains behind the globe');
  const ray=new T.Ray(new T.Vector3(),object.position.clone().normalize());
  const hit=ray.intersectSphere(new T.Sphere(body.center,body.radius),new T.Vector3());
  assert.ok(hit&&hit.length()<object.position.length());
 }
}
for(const side of [-1,1]){
 const start={x:0,y:.5,z:-2},a=billboard.goWestRetreatPoint(start,body.center,body.radius,0,side);
 assert.deepEqual([a.x,a.y,a.z],[0,.5,-2]);
 assert.ok(billboard.goWestRetreatPoint(start,body.center,body.radius,1,side).z<body.center.z-body.radius);
}
const rows=[{row:0,call:'去西部',response:'我们就去开拓未来',callAt:87.49,responseAt:87.99,bottomOffset:68},
 {row:1,call:'去西部',response:'',callAt:93.29,responseAt:93.29,bottomOffset:0}]
 .map(row=>({...row,style:'tableau',end:99.59,callSize:15,responseSize:14.5}));
art.clock.read=()=>86.39;
art.update({preset:104,getAudio:()=>audio,firstLyricMs:36020,topPx:173,lyricTime:87.59},true,rows,10);
assert.equal(art.billboard.chinese.visible,true,'GPU Chinese appears 1.2 seconds before the source cue');
assert.ok(Array.from(art.billboard.chineseSprites.values()).some(sprite=>sprite.visible&&sprite.material.opacity>0),
 'Chinese entrance progress follows the advanced lyric time');
assert.equal(art.billboard.title.visible,false,'The opening still follows the unshifted audio time');
art.clock.read=()=>98;
art.update({preset:104,getAudio:()=>audio,firstLyricMs:36020,topPx:173},true,rows,10);
assert.equal(art.group.visible,true,'The Chinese passage survives the title retreat');
assert.equal(art.billboard.title.visible,false);
assert.equal(art.billboard.chineseSprites.size,3);
const pixels=Array.from(art.billboard.chineseSprites.values());
for(const sprite of pixels){
 assert.equal(sprite.material.depthTest,false,'Chinese draws over the globe, never behind its depth buffer');
 assert.equal(sprite.material.depthWrite,false);assert.equal(sprite.renderOrder,20000);
 assert.ok(sprite.material.opacity>.8);assert.ok(sprite.visible);
}
const yBefore=pixels.map(sprite=>sprite.position.y);
art.update({preset:104,getAudio:()=>audio,firstLyricMs:36020,topPx:173},true,rows,10);
assert.deepEqual(pixels.map(sprite=>sprite.position.y),yBefore,'Paused Chinese motion holds its audio phase');
assert.equal(art.billboard.chineseTextures.size,3,'Labels are cached rather than redrawn each frame');
// The same three foreground textures now support per-character transition
// reveals. Texture cropping keeps layout and avoids the previous native crop.
const sequentialRows=rows.map(row=>({...row,sequential:true}));
art.clock.read=()=>87.74;
art.update({preset:104,getAudio:()=>audio,firstLyricMs:36020,topPx:173},true,sequentialRows,10);
const typedLead=Array.from(art.billboard.chineseSprites.values()).find(sprite=>sprite.visible);
assert.ok(typedLead.material.map.repeat.x>0&&typedLead.material.map.repeat.x<1,'Only the first complete Chinese character is revealed initially');
const partialRepeat=typedLead.material.map.repeat.x,partialWidth=typedLead.scale.x;
art.clock.read=()=>88.2;
art.update({preset:104,getAudio:()=>audio,firstLyricMs:36020,topPx:173},true,sequentialRows,10);
assert.equal(typedLead.material.map.repeat.x,1,'The complete short call appears after its character sequence');
assert.ok(Math.abs(partialWidth/typedLead.scale.x-partialRepeat)<1e-10,'Cropping reveals glyphs without horizontally squeezing text');
assert.equal(art.billboard.chineseTextures.size,3,'Typing does not redraw textures every frame');
art.clock.read=()=>98;
art.update({preset:104,getAudio:()=>audio,firstLyricMs:36020,topPx:173},true,rows,10);
assert.equal(typedLead.material.map.repeat.x,1,'A normal row does not retain an old partial reveal');
art.clock.read=()=>99.59;art.update({preset:104,getAudio:()=>audio,firstLyricMs:36020,topPx:173},true,rows,10);
assert.equal(art.billboard.chinese.visible,false,'Both Chinese transition rows clear before number 15');
const choirRow={style:'choir',call:'去西部',response:'天地辽阔任我们闯',callAt:231.4,responseAt:232.4,end:235.03,callSize:14,responseSize:19};
art.clock.read=()=>232.6;art.update({preset:104,getAudio:()=>audio,firstLyricMs:36020,topPx:173},true,[choirRow],10);
const lead=Array.from(art.billboard.chineseSprites.values()).find(sprite=>sprite.visible);
assert.ok(lead,'The reverse-vocal Chinese lead uses a complete foreground label');
assert.equal(art.billboard.chineseSprites.size,4,'Only the short lead adds one texture; the response remains native');
assert.equal(lead.material.depthTest,false);assert.equal(lead.renderOrder,20000);assert.equal(lead.material.opacity,1);
const leadY=lead.position.y;
const oldAspect=camera.aspect;camera.aspect=390/703.08;camera.updateProjectionMatrix();
art.update({preset:104,getAudio:()=>audio,firstLyricMs:36020,topPx:173},true,[choirRow],10);
const canvasH=390/camera.aspect,span=3.6*Math.tan(camera.fov*Math.PI/360);
const projectedY=canvasH/2-lead.position.y/span*canvasH;
assert.ok(Math.abs(projectedY-(753-10-65+11.5))<1e-8,'GPU lead matches the native lower-lyric position on the shorter canvas');
camera.aspect=oldAspect;camera.updateProjectionMatrix();
for(const start of [235.03,239.2,244.07]){
 art.clock.read=()=>start+1.2;art.update({preset:104,getAudio:()=>audio,firstLyricMs:36020,topPx:173},true,
  [{...choirRow,callAt:start,responseAt:start+1,end:start+3.5}],10);
 assert.equal(lead.position.y,leadY,'All four calls keep the same uncropped screen position');
 assert.equal(art.billboard.chineseTextures.size,4,'The repeated lead reuses its texture');
}
art.clock.read=()=>247.63;art.update({preset:104,getAudio:()=>audio,firstLyricMs:36020,topPx:173},true,
 [{...choirRow,style:'stars',callAt:247.63,end:251.28}],10);
assert.equal(art.billboard.chinese.visible,false,'The final normal lyric retains its original native path');
let chineseDisposed=0;art.billboard.chineseTextures.forEach(map=>map.addEventListener('dispose',()=>chineseDisposed++));
art.update({preset:103,getAudio:()=>audio,firstLyricMs:32800,topPx:173},true);
assert.equal(art.billboard.root.visible,false);
assert.equal(art.layers.title.visible,true);
assert.equal(art.layers.title.material,art.standardMaterials.title,'Other tracks keep their approved materials');
assert.equal(art.layers.title.rotation.y,0);
let propDisposed=0;const resources=[...art.billboard.geometries,...art.billboard.materials];
resources.forEach(r=>r.addEventListener('dispose',()=>propDisposed++));
let disposed=0;maps.forEach(t=>t.addEventListener('dispose',()=>disposed++));
art.dispose();art.dispose();assert.equal(disposed,6);assert.equal(propDisposed,resources.length);assert.equal(art.group.parent,null);
assert.equal(chineseDisposed,4,'The transition and choir release all of their own text textures');
const canceled=new ZenOpeningArt({THREE:{...T,TextureLoader:Loader},scene,camera,getViewport:()=>({windowWidth:390,windowHeight:753})});
canceled.dispose();await canceled.ready;assert.equal(maps.length,6,'Disposal during package loading must not create textures');
const {zenOrbitPoint,zenArcTable,zenArcProgress}=load('zen-encounter-manager.js','zenOrbitPoint,zenArcTable,zenArcProgress',{AmbientEncounterManager:class {},ZenVisualClock});
camera.position.z=5;const center=new T.Vector3();
for(const route of ['sky','rise','front']){
 const pass={route,side:1,height:.05},table=zenArcTable(pass,camera,center),distances=[];let previous;
 for(let i=0;i<=100;i++){const point=zenOrbitPoint(new T.Vector3(),pass,zenArcProgress(table,i/100),camera,center);const projected=new T.Vector2(point.x/(5-point.z),point.y/(5-point.z));if(previous)distances.push(projected.distanceTo(previous));previous=projected;}
 assert.ok(Math.max(...distances)/Math.min(...distances)<1.01,route+' maintains projected constant speed');
}
const {buildChandra}=load('ambient-chandra-model.js','buildChandra');
for(const key of ['eve','astronaut']){
 const data=require('../miniprogram/'+key+'-assets/model.js'),bin=fs.readFileSync('miniprogram/'+key+'-assets/geometry.bin');
 const buffer=bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength),model=buildChandra(T,data,buffer,data.images.map(()=>new T.Texture()));
 const box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3());assert.ok(Math.abs(Math.max(size.x,size.y,size.z)-1)<1e-6);
 if(key==='eve'){let glowingEyes=false;model.traverse(o=>{if(o.material?.name==='Eye_Glow'&&o.material.emissive.b>0)glowingEyes=true});assert.ok(glowingEyes,'EVE eye emissive material is retained');}
}
console.log('GPU title: continuous subpixel scale, smooth clock, foreground/disposal; zen arcs: constant speed; EVE/astronaut source geometry PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
