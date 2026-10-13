const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const T=require('../miniprogram/node_modules/threejs-miniprogram').createScopedThreejs({width:390,height:753,createImage(){return {}}});
function load(file,names,extra={}) {
  const box={module:{exports:{}},console,Math,Number,Object,Array,Date,Map,...extra};
  vm.runInNewContext(fs.readFileSync('miniprogram/pages/gl/'+file,'utf8').replace(/^import.*$/gm,'')
    .replace(/export (class|function|const) /g,'$1 ')+'\nmodule.exports={'+names+'};',box);
  return box.module.exports;
}
const {ZenVisualClock}=load('zen-visual-clock.js','ZenVisualClock');
const {buildDarknessTimeline,darknessVisualFrame,DarknessVisual}=load('zen-opening-art.js','buildDarknessTimeline,darknessVisualFrame,DarknessVisual',{ZenVisualClock});
const lines=[{}, {}, {'start-time':34000,duration:5000,text:'Listen to my voice'},
  {'start-time':42000,duration:6000,text:'Pulling you, out of darkness'},
  {'start-time':71000,duration:9000,text:'Still I dream of your spirit, leading you back home'},
  {'start-time':105000,duration:7000,text:'The light in your eyes, is an angel up high'},
  {'start-time':149000,duration:5000,text:'Pulling you, out of darkness'}];
const timeline=buildDarknessTimeline(lines,1200),cues=new Map();
assert.equal(timeline.events[0].at,32.8);
assert.equal(timeline.events[1].at,40.8);
assert.equal(buildDarknessTimeline(lines.map(l=>({...l,'start-time':Number(l['start-time'])+3000})),1200).events[1].at,43.8,'Loaded cue changes propagate, no fixed timing');
assert.equal(darknessVisualFrame(1,timeline,cues).surface,0,'Brief content black opening');
assert.equal(darknessVisualFrame(43,timeline,cues).arc,0,'Main light waits for actual English visibility, even when its timer is late');
cues.set(2,33.1);cues.set(3,41.2);
assert.equal(darknessVisualFrame(41.2,timeline,cues).arc,0);
assert.ok(darknessVisualFrame(45,timeline,cues).arc>0);
const pre=darknessVisualFrame(40,timeline,cues).surface;
assert.ok(darknessVisualFrame(51,timeline,cues).surface>pre);
cues.set(4,69.8);cues.set(5,103.8);
assert.ok(darknessVisualFrame(114,timeline,cues).surface>darknessVisualFrame(80,timeline,cues).surface);
const beforeRepeat=darknessVisualFrame(150,timeline,cues).arc;
cues.set(6,149.1);assert.ok(darknessVisualFrame(156,timeline,cues).arc>beforeRepeat,'Repeated lyric has its own light response');
assert.ok(darknessVisualFrame(90,timeline,new Map(),90).surface>.4,'Resume reconstructs earlier song phases');
const scene=new T.Scene(),camera=new T.PerspectiveCamera(45,390/753,.1,100),globeGroup=new T.Group();scene.add(globeGroup);camera.position.z=6;
const starUniforms={uOpacity:{value:.78},uBreathSpeed:{value:.55},uBreathStrength:{value:.5},time:{value:2}};
const starCtl={mesh:{material:{uniforms:starUniforms},visible:true}},renderer={getPixelRatio:()=>2};
const visual=new DarknessVisual({THREE:T,scene,camera,globeGroup,starCtl,renderer});
const label=new T.Sprite(new T.SpriteMaterial({opacity:.8}));label.renderOrder=999;label.userData.baseScaleX=1;
const tropic=new T.Mesh(new T.SphereBufferGeometry(1,8,6),new T.MeshBasicMaterial({opacity:.225,transparent:true}));tropic.material.userData.ro=28;
globeGroup.add(label);globeGroup.add(tropic);
const {createDayNightMaterial}=load('shaders/dayNightMix.glsl.js','createDayNightMaterial');
for(const simple of [false,true]){
  const mat=createDayNightMaterial(T,new T.Texture(),new T.Texture(),.2,1,.65,1.5,1,1.6,simple);
  assert.equal(mat.uniforms.uSongSurfaceGain.value,1);
  visual.prepare(null,true,false,0);visual.apply(mat);
  assert.equal(mat.uniforms.uSongSurfaceGain.value,0,'Audio/subtitle loading holds black');
  assert.equal(starUniforms.uOpacity.value,0);
  assert.equal(label.material.opacity,0);
  const cloud={material:{opacity:.2}};
  const audio={currentTime:45,paused:false};
  const opening={preset:103,visualLines:lines,visualLeadInMs:1200,visualCueTimes:cues,visualResumeAt:0,getAudio:()=>audio};
  visual.prepare(opening,true,false,0);visual.apply(mat,cloud);
  assert.ok(mat.uniforms.uSongSurfaceGain.value<.5);
  assert.ok(cloud.material.opacity<.2);
  assert.ok(tropic.material.opacity<.03);
  const frozen=visual.frame.time;audio.paused=true;
  assert.equal(visual.prepare(opening,true,true,10000).time,frozen);
  assert.equal(visual.prepare(opening,true,true,10000).rotationSpeed,0);
  assert.equal(visual.prepare(opening,false,false,10010),null,'Moon lock/exit disables immediately');
  assert.equal(mat.uniforms.uSongSurfaceGain.value,1);assert.equal(mat.uniforms.uSongRim.value,0);
  assert.equal(cloud.material.opacity,.2);assert.equal(starUniforms.uOpacity.value,.78);
  assert.equal(label.material.opacity,.8);assert.equal(tropic.material.opacity,.225);
  assert.equal(starCtl.mesh.visible,true);
  assert.equal(visual.group.visible,false);assert.equal(visual.meteor.visible,false);
  assert.equal(visual.prepare({...opening,preset:102},false,false,10020),null,'Other song never receives darkness profile');
  mat.dispose();
}
let disposed=0;for(const obj of [visual.halo,visual.arc,visual.meteor])obj.geometry.addEventListener('dispose',()=>disposed++);
visual.dispose();assert.equal(disposed,3);assert.equal(visual.group.parent,null);assert.equal(visual.meteor.parent,null);
console.log('Out of Darkness: cue-driven light, delayed visibility, repeats, pause/resume, other-mode restoration and disposal PASS');
