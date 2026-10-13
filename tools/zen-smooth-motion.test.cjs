const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const T=require('../miniprogram/node_modules/threejs-miniprogram').createScopedThreejs({width:390,height:753,createImage(){return {}}});
function load(file,names,extra={}){const box={module:{exports:{}},console,Math,Number,Object,Array,Date,...extra};vm.runInNewContext(fs.readFileSync('miniprogram/pages/gl/'+file,'utf8').replace(/^import.*$/gm,'').replace(/export (class|function|const) /g,'$1 ')+'\nmodule.exports={'+names+'};',box);return box.module.exports;}
const {ZenVisualClock}=load('zen-visual-clock.js','ZenVisualClock');
const clock=new ZenVisualClock(),audio={currentTime:1,paused:false};let before=clock.read(audio,0);
for(let now=16;now<=496;now+=16){const t=clock.read(audio,now);assert.ok(t-before>.015&&t-before<.017,'Coarse audio sample still gives render-frame increments');before=t;}
audio.currentTime=1.5;const sampled=clock.read(audio,512);assert.ok(sampled-before<.017,'New audio sample does not introduce a visible speed jump');
audio.paused=true;assert.equal(clock.read(audio,612),sampled);audio.currentTime=6;assert.equal(clock.read(audio,620),6,'Intentional seek reanchors');
(async()=>{
const {openingArtFrame,ZenOpeningArt}=load('zen-opening-art.js','openingArtFrame,ZenOpeningArt',{ZenVisualClock,ensureSceneArtPackage:()=>Promise.resolve()});
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
let disposed=0;maps.forEach(t=>t.addEventListener('dispose',()=>disposed++));art.dispose();assert.equal(disposed,5);assert.equal(art.group.parent,null);
const canceled=new ZenOpeningArt({THREE:{...T,TextureLoader:Loader},scene,camera,getViewport:()=>({windowWidth:390,windowHeight:753})});
canceled.dispose();await canceled.ready;assert.equal(maps.length,5,'Disposal during package loading must not create textures');
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
