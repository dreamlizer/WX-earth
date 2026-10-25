const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function load(file,names,extra={}){
  const box={module:{exports:{}},console,Math,Float32Array,...extra};
  vm.runInNewContext(fs.readFileSync(file,'utf8').replace(/^import .*$/gm,'').replace(/export /g,'')+
    '\nmodule.exports={'+names+'};',box,{filename:file});return box.module.exports;
}
const timing=load('miniprogram/pages/gl/go-west-finale-timing.js','GO_WEST_FINALE,GO_WEST_LYRIC_CUTOFF,goWestFinaleFrame');
const {goWestFinaleFrame}=timing;
for(const t of [0,32,67,130,211,243.99,NaN])assert.equal(goWestFinaleFrame(t),null);
assert.deepEqual(Array.from(goWestFinaleFrame(244).hits).map(t=>t+244),[248.1,248.85,249.6]);
for(let t=244;t<260;t+=.025){
  const f=goWestFinaleFrame(t);assert.ok(f.lampGain>=1&&f.lampGain<3);
  assert.ok(f.flash>=0&&f.flash<.7);assert.ok(f.title>=0&&f.title<=1);
}
assert.equal(goWestFinaleFrame(timing.GO_WEST_LYRIC_CUTOFF).title,0,'Lyrics clear before foil and the metal title');
assert.equal(goWestFinaleFrame(259).title,1);assert.equal(goWestFinaleFrame(270).t,15,'Ended audio holds a deterministic lit finale');
const T=require('../miniprogram/node_modules/threejs-miniprogram').createScopedThreejs({width:390,height:753,createImage(){return {};}});
const shapes=load('miniprogram/assets/data/go-west-title-shapes.js','GO_WEST_TITLE_SHAPES');
const geometry=load('miniprogram/pages/gl/go-west-opening.js','createGoWestLetterGeometry',shapes);
const {GoWestFinale}=load('miniprogram/pages/gl/go-west-finale.js','GoWestFinale',{...shapes,...geometry,...timing});
const scene=new T.Scene(),camera=new T.PerspectiveCamera(50,390/753,.1,100),globeGroup=new T.Group();
camera.position.set(.1,.15,5);camera.updateMatrixWorld(true);globeGroup.position.set(0,-.55,-.5);scene.add(globeGroup);
const cameraStart=camera.matrixWorld.clone(),globeStart=globeGroup.matrix.clone();
const finale=new GoWestFinale({THREE:T,scene,camera,globeGroup});
finale.update(null);finale.update({time:100});assert.equal(finale.updateEffects,undefined,'Other songs/stages allocate no finale geometry');
for(const t of [244,247.1,248.2,248.95,249.68,250.25,258.9,259]){
  finale.update({time:t});scene.updateMatrixWorld(true);assert.equal(finale.root.visible,true);
  finale.root.traverse(o=>{for(const a of Object.values(o.geometry?.attributes||{}))assert.ok(Array.from(a.array).every(Number.isFinite),'No invalid positions, colours or normals');});
  assert.deepEqual(camera.matrixWorld.elements,cameraStart.elements,'Finale never changes the live camera');
}
assert.equal(finale.overlay.getObjectByName('GO_WEST_FINALE_FLASH').material.depthTest,false);
const foil=finale.root.children.find(o=>o.geometry?.attributes.foilAlpha);
assert.ok(foil,'Real metallic foil geometry is part of the scene');
assert.equal(timing.GO_WEST_LYRIC_CUTOFF,247.1);
finale.update({time:248.1});assert.ok(Array.from(foil.geometry.attributes.foilAlpha.array).every(v=>v===0));
finale.update({time:248.4});assert.ok(Array.from(foil.geometry.attributes.foilAlpha.array).some(v=>v>0),'Foil starts five seconds earlier');
finale.update({time:250.25});const atPeak=Array.from(foil.geometry.attributes.position.array),resource=foil.geometry;
finale.update({time:258.9});finale.update({time:250.25});assert.equal(foil.geometry,resource,'Frames reuse buffers');
assert.deepEqual(Array.from(foil.geometry.attributes.position.array),atPeak,'Seeking reproduces the same foil trajectories');
assert.ok(Array.from(foil.geometry.attributes.foilAlpha.array).some(v=>v>0));
for(const width of [320,375,430])for(const fov of [45,50]){
  camera.aspect=width/753;camera.fov=fov;camera.updateProjectionMatrix();
  finale.update({time:258});scene.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(finale.titleRoot);
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y]){
    const p=new T.Vector3(x,y,box.max.z).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,'Metal title stays inside mobile viewport');
  }
}
globeGroup.scale.setScalar(1.4);finale.update({time:255});assert.equal(finale.root.scale.x,1.4,'Effects follow the actual globe scale');
finale.update(null);assert.equal(finale.root.visible,false);assert.equal(finale.overlay.visible,false,'Pause, moon and song-exit gates clear the foreground too');
finale.update({time:255});finale.update({time:0});assert.equal(finale.root.visible,false,'Replay/seek clears a prior finale');
finale.update({time:255});const resources=new Set();for(const root of [finale.root,finale.overlay])root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of [].concat(o.material||[]))resources.add(m);});
let disposed=0;resources.forEach(r=>r.addEventListener('dispose',()=>disposed++));
finale.dispose();finale.dispose();assert.equal(disposed,resources.size,'Owned GPU resources release exactly once');assert.equal(finale.root.parent,null);assert.equal(finale.overlay.parent,null);
finale.update({time:255});assert.equal(finale.root.visible,false,'Disposed finale cannot reappear');
const engine=fs.readFileSync('miniprogram/pages/gl/app-engine.js','utf8');
assert.match(engine,/goWestFinale\?\.update\(page\.__goWestSong\?\.frame\)/,'Finale follows the same current frame after live transforms');
assert.match(engine,/goWestFinale\?\.dispose\(\)/);
console.log('Go West finale: timed impacts, lit ending, live globe, mobile title, deterministic foil, exits and GPU disposal PASS');
