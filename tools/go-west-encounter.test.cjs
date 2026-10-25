const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function load(file,names,extra={}){
 const box={module:{exports:{}},console,Math,Date,setTimeout,clearTimeout,...extra};
 vm.runInNewContext(fs.readFileSync('miniprogram/pages/gl/'+file,'utf8')
  .replace(/^import .*$/gm,'').replace(/export /g,'')+'\nmodule.exports={'+names+'};',box);
 return box.module.exports;
}
const T=require('../miniprogram/node_modules/threejs-miniprogram').createScopedThreejs({width:390,height:753,createImage(){return {};}});
const {ZenVisualClock}=load('zen-visual-clock.js','ZenVisualClock');
const builders=load('ambient-chandra-model.js','buildChandra,releaseChandra');
const data=require('../miniprogram/eve-assets/model.js');
const bytes=fs.readFileSync('miniprogram/eve-assets/geometry.bin');
const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
let requests=0;
const ambient=load('ambient-encounter-manager.js','AmbientEncounterManager,AMBIENT_CRAFT,ZEN_CRAFT',{
 ...builders,require(path,resolve){assert.equal(path,'../../eve-assets/ready.js');requests++;resolve(data);},
 wx:{getFileSystemManager:()=>({readFile({filePath,success}){assert.equal(filePath,'eve-assets/geometry.bin');success({data:buffer});}})}
});
const zen=load('zen-encounter-manager.js','ZenEncounterManager,applyZenSunlight',{...ambient,ZenVisualClock});
const {GoWestEncounterManager,makeGoWestEncounterPlan,goWestEncounterPoint}=load('go-west-encounter.js',
 'GoWestEncounterManager,makeGoWestEncounterPlan,goWestEncounterPoint',zen);
for(let seed=1;seed<=100;seed++){
 let n=seed;const random=()=>{n=(n*16807)%2147483647;return(n-1)/2147483646;};
 const plan=makeGoWestEncounterPlan(random);
 assert.equal(plan.length,2);
 assert.ok(plan[0].start>=82&&plan[0].start<=84);
 assert.ok(plan[1].start>=224&&plan[1].start<=226,'Only the first and final visits remain');
 for(let i=0;i<plan.length;i++){
  const p=plan[i];assert.equal(p.key,'eve');assert.ok(p.duration>=8.2&&p.duration<=10);
  assert.ok(p.start>36.02&&p.start+p.duration<252,'No model during opening or final fade');
  if(i)assert.ok(p.start>plan[i-1].start+plan[i-1].duration);
  for(const radius of [.8,1.35,1.8])for(let q=0;q<=1;q+=.01){
   const point=goWestEncounterPoint(new T.Vector3(),p,q,
    new T.PerspectiveCamera(45,390/703,.1,100),new T.Vector3(0,-1.4,-5),radius);
   assert.ok(point.length()-Math.sqrt(3)*p.size/2>=radius+.249,
    'The whole rotating model clears the live globe with a space gap on both visits');
  }
 }
}
assert.notEqual(JSON.stringify(makeGoWestEncounterPlan(()=>.1)),JSON.stringify(makeGoWestEncounterPlan(()=>.9)),
 'Separate playbacks vary timing, direction and flight shape');
const scene=new T.Scene(),globeGroup=new T.Group();globeGroup.position.y=-1.4;scene.add(globeGroup);
const camera=new T.PerspectiveCamera(50,390/753,.1,100);camera.position.z=5;camera.updateMatrixWorld(true);
const manager=new GoWestEncounterManager({THREE:T,scene,camera,globeGroup,
 renderer:{capabilities:{getMaxAnisotropy:()=>4}},page:{data:{},setData(){}},random:()=>.5});
const audio={currentTime:0,duration:259,paused:false};
const update=time=>{audio.currentTime=time;manager.clock.reset();manager.updateSong({enabled:true,audio});};
(async()=>{
 manager.updateSong({enabled:false,audio});assert.equal(requests,0);
 update(60);assert.equal(requests,0,'The model waits until a visit approaches');
 update(75);await manager.pending;assert.equal(requests,1);assert.equal(manager.loadedKey,'eve');
 const event=manager.plan[0],at=q=>update(event.start+event.duration*q);
 at(0);assert.equal(manager.root.visible,true);
 assert.ok(manager.passMaterials.every(m=>m.opacity===0),'No pop into view on the first frame');
 at(.15);const startTurn=manager.model.rotation.y;
 at(.5);assert.ok(manager.passMaterials.some(m=>m.opacity>.9));
 const center=manager.root.position.clone().project(camera);
 assert.ok(center.y<0&&center.y>-.8,'The visible center of the flight is below the English lyrics');
 const middlePosition=manager.root.position.clone();
 // Exercise the real source mesh, not only its centre, across all turn angles.
 for(const radius of [1,1.35,1.8]){
  globeGroup.scale.setScalar(radius);
  for(const q of [.12,.25,.37,.5,.63,.75,.88]){
   at(q);scene.updateMatrixWorld(true);
   const earth=globeGroup.getWorldPosition(new T.Vector3());
   manager.model.traverse(mesh=>{
    const pos=mesh.geometry?.attributes.position;if(!pos)return;
    for(let i=0;i<pos.count;i++){
     const world=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
     assert.ok(world.distanceTo(earth)>radius+.24,'Body, arms and head stay outside Earth while spinning');
    }
   });
  }
 }
 globeGroup.scale.setScalar(1);at(.5);
 audio.paused=true;manager.updateSong({enabled:true,audio});
 assert.equal(manager.root.position.distanceTo(middlePosition),0,'Audio pause holds the craft');audio.paused=false;
 at(.85);assert.ok(Math.abs(Math.abs(manager.model.rotation.y-startTurn)-4*Math.PI)<1e-10,'Two complete body turns');
 const point=new T.Vector3(),earthCenter=globeGroup.getWorldPosition(new T.Vector3());
 for(const q of [0,1]){
  goWestEncounterPoint(point,event,q,camera,earthCenter);point.add(earthCenter).project(camera);
  assert.ok(Math.abs(point.x)>1.4,'The path enters and exits beyond the screen edge');
 }
 update(event.start+event.duration+.01);assert.equal(manager.root.visible,false,'A completed flight leaves no visible model');
 at(.5);audio.paused=true;update(0);assert.equal(manager.root.visible,false,'Seeking back while paused clears the old craft');audio.paused=false;
 at(.5);manager.updateSong({enabled:false,audio});assert.equal(manager.root.visible,false,'Moon, other songs and normal mode clear the pass');
 assert.equal(manager.session,null);update(0);assert.equal(manager.root.visible,false,'Replay starts with an empty opening');
 update(manager.plan[1].start+2);assert.equal(requests,1,'Repeated visits reuse the local model');
 const resources=new Set();manager.model.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of [].concat(o.material||[]))resources.add(m);});
 let disposed=0;resources.forEach(r=>r.addEventListener('dispose',()=>disposed++));
 manager.dispose();manager.dispose();assert.equal(disposed,resources.size);assert.equal(manager.root.parent,null);
 const late=new GoWestEncounterManager({THREE:T,scene,camera,globeGroup,
  renderer:{capabilities:{getMaxAnisotropy:()=>4}},page:{data:{},setData(){}},random:()=>.5});
 late.updateSong({enabled:true,audio:{currentTime:75,duration:259,paused:false}});
 const pending=late.pending;late.dispose();await pending;
 assert.equal(late.model,null,'Late local loads cannot resurrect a disposed flight');
 console.log('Go West EVE: local load, random plans, two turns, lower flight, audio/exit gates and disposal PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
