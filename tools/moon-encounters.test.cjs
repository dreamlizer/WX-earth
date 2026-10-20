const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const T=require('../miniprogram/node_modules/threejs-miniprogram').createScopedThreejs({width:390,height:720,createImage(){return {}}});
const filename=path.resolve('miniprogram/pages/gl/moon-voyage-encounters.js');
const flowBox={module:{exports:{}}};vm.runInNewContext(fs.readFileSync('miniprogram/pages/gl/moon-voyage-star-flow.js','utf8').replace(/export /g,'')+'\nmodule.exports={createStarFlow,updateStarFlow,disposeStarFlow,flowMotion}',flowBox);
const gundamFile=path.resolve('miniprogram/pages/gl/moon-voyage-gundam.js');
const gundamBox={module:{exports:{}},console,require:require('module').createRequire(gundamFile),release:require('../miniprogram/pages/gl/moon-voyage-robot.js').release};
vm.runInNewContext(fs.readFileSync(gundamFile,'utf8').replace(/^import .*;$/m,'').replace(/export /g,'')+'\nmodule.exports={VoyageGundam}',gundamBox);
const box={VoyageGundam:gundamBox.module.exports.VoyageGundam,VoyageStarship:require('../miniprogram/pages/gl/moon-voyage-starship.js').VoyageStarship,shadeCraft:require('../miniprogram/pages/gl/moon-voyage-craft-light.js').shadeCraft,VoyageRobot:require('../miniprogram/pages/gl/moon-voyage-robot.js').VoyageRobot,...flowBox.module.exports,require:require('module').createRequire(filename),module:{exports:{}},console};
vm.runInNewContext(fs.readFileSync(filename,'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'')+'\nmodule.exports={VoyageEncounters,buildVoyager}',box);
const {VoyageEncounters,buildVoyager}=box.module.exports;
const b=fs.readFileSync('miniprogram/voyager-assets/geometry.bin');const buffer=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const camera=new T.PerspectiveCamera(45,390/720,.1,200),scene=new T.Scene();camera.position.set(0,0,5);camera.rotation.y=.85;
const fx=new VoyageEncounters();fx.setContext({THREE:T,scene,camera});Object.assign(fx,buildVoyager(T,buffer,Array.from({length:4},()=>new T.Texture())));fx.textures=[];scene.add(fx.model);fx.key=new T.DirectionalLight();fx.stars=new T.Points(new T.BufferGeometry().addAttribute('position',new T.BufferAttribute(new Float32Array(1080),3)),new T.PointsMaterial());fx.glint=new T.Sprite(new T.SpriteMaterial());
const moon=new T.Mesh(new T.SphereGeometry(1),new T.MeshBasicMaterial());scene.add(moon);moon.position.set(-5.8,-1.2,0);moon.scale.setScalar(.9);moon.visible=false;
const cp=camera.position.clone(),cq=camera.quaternion.clone();const tick=t=>fx.update({t,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon,dtSec:1/60});
tick(10);assert.equal(fx.materials[0].opacity,0);tick(23);const distant=fx.model.position.distanceTo(camera.position);tick(35);assert(fx.model.position.distanceTo(camera.position)<distant);tick(47);assert.equal(fx.materials[0].opacity,0);tick(61);const p=fx.model.position.clone();tick(66);assert(fx.model.position.distanceTo(p)<.1,'alongside hold');
// Check the actual portrait-camera projection, including the rotated NASA hull.
const voyagerScreen=t=>{tick(t);return fx.model.position.clone().project(camera);};
for(const t of [10,14,18,22]){
 tick(t);const e=t-10,u=e/32-6*Math.pow(Math.max(0,1-e/24),3),ray=fx.earthRay||{x:.1,y:-.18};
 const original=new T.Vector3(ray.x*12*(1-u)-.3*u,ray.y*12*(1-u)+.08*u,-12+13.2*u);
 assert(camera.worldToLocal(fx.model.position.clone()).distanceTo(original)<1e-8,'Original entry position and early approach remain unchanged');
}
const approach=voyagerScreen(30),bend=voyagerScreen(32),turn=voyagerScreen(36),exit=voyagerScreen(41.8);
assert(approach.x<-.35&&approach.y>.25,'Voyager approaches the upper left');
assert(Math.abs(bend.x+.6)<1e-8&&Math.abs(bend.y-.55)<1e-8,'Upper-left bend is visible in the phone frame');
assert(turn.x>bend.x&&turn.x<0&&turn.y>bend.y,'Voyager rounds the bend upward and toward the right');
assert(exit.x>1.4&&exit.y>.9,'Departure goes out through the upper right');
for(const t of [22,32,36]){
 const h=.001,a=voyagerScreen(t-h),b=voyagerScreen(t),c=voyagerScreen(t+h);
 assert(b.clone().sub(a).divideScalar(h).distanceTo(c.clone().sub(b).divideScalar(h))<.001,'Screen velocity is continuous across trajectory joins');
}
function voyagerBounds(t){
 tick(t);fx.model.updateMatrixWorld(true);const bounds=new T.Box3();bounds.nearestDepth=Infinity;
 fx.model.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;
  for(let i=0;i<a.count;i++){
   const v=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);
   bounds.nearestDepth=Math.min(bounds.nearestDepth,-camera.worldToLocal(v.clone()).z);
   bounds.expandByPoint(v.project(camera));
  }
 });return bounds;
}
const readable=voyagerBounds(32);
assert(readable.min.x>-1&&readable.max.x<1&&readable.min.y>-1&&readable.max.y<1,'Whole Voyager remains visible at the upper-left bend');
assert(readable.max.x-readable.min.x>.25,'Voyager has a readable body before its turn');
const close=voyagerBounds(36),overhead=voyagerBounds(39);
assert(close.max.x-close.min.x>1.25,'Closer pass grows beyond sixty percent of the phone width');
tick(36);assert(-camera.worldToLocal(fx.model.position.clone()).z<2,'Readable upper arc is closer than the previous 2.5-unit pass');
tick(39);
const projectedSize=b=>Math.hypot(b.max.x-b.min.x,b.max.y-b.min.y);
assert(projectedSize(overhead)>projectedSize(close)*1.5,'Rotating hull keeps growing toward the upper-right exit rather than receding');
assert(fx.model.scale.x===fx.baseScale&&fx.materials.every(m=>m.opacity===1),'Size comes from proximity, with no scale trick or departure dissolve');
let previousDepth=Infinity;
for(const t of [32,34,36,38,39,40,41,41.999]){
 const hull=voyagerBounds(t),depth=-camera.worldToLocal(fx.model.position.clone()).z;
 assert(depth<previousDepth,'Upper arc continues toward the observer');previousDepth=depth;
 assert(hull.nearestDepth>camera.near,'Close overhead hull avoids near-plane slicing');
}
assert(voyagerBounds(41.8).min.x>1,'Entire Voyager clears the upper-right edge before the encounter ends');
tick(10);assert(camera.worldToLocal(fx.model.position.clone()).z<-80,'Voyager begins far behind the Earth instead of already large');
tick(41);assert(-camera.worldToLocal(fx.model.position.clone()).z<1.5,'Upper-right departure passes close overhead');
tick(23);const spinA=fx.model.quaternion.clone();tick(33);const spinAngle=spinA.angleTo(fx.model.quaternion);
assert(spinAngle>.55&&spinAngle<.7,'More visible self rotation remains gentle over ten seconds');
tick(36);const spinB=fx.model.quaternion.clone();tick(36.1);assert(spinB.angleTo(fx.model.quaternion)<.01,'Close-pass self rotation has no sudden spin');
tick(30);tick(36);assert(spinB.angleTo(fx.model.quaternion)<1e-7,'Self rotation is deterministic when replaying');
tick(43);assert(!fx.model.visible,'Breathing space after first pass');
tick(46);assert(!fx.model.visible,'Second encounter does not appear during the gap');
for(let t=0;t<113;t+=.1){if(t>86)moon.visible=true;tick(t);assert(camera.position.equals(cp));assert(camera.quaternion.equals(cq));assert(fx.model.position.toArray().every(Number.isFinite));}
assert(fx.moonStart>=86&&fx.moonStart<97,'Moon gates third departure');tick(112.65);assert(fx.glint.visible);assert(!fx.model.visible);tick(113);assert(!fx.glint.visible&&!fx.model.visible);
fx.reset();assert.equal(fx.moonStart,null);fx.dispose();fx.dispose();console.log('Voyager geometry, three phases, Moon gate, camera preservation and cleanup PASS');
// Exercise the actual WeChat loading contract, not only a constructed mesh.
(async()=>{
 const NativeLoader=T.TextureLoader;T.TextureLoader=class {setCrossOrigin(){return this;} load(url,done){assert(/^\/(voyager|robot|starship|gundam)-assets\//.test(url),'Canvas image paths must be absolute within the package');queueMicrotask(()=>done(new T.Texture()));}};
 let subpackage=false;
 box.require=(name,success)=>{assert.equal(name,'../../voyager-assets/ready.js');subpackage=true;success(true);};
 box.wx={getFileSystemManager(){return {readFile({filePath,success}){assert(subpackage);assert.equal(filePath,'voyager-assets/geometry.bin');success({data:buffer});}};}};
 const loaded=new VoyageEncounters();loaded.setContext({THREE:T,scene,camera,readGundamBuffer:()=>{const b=fs.readFileSync("miniprogram/gundam-assets/geometry.bin");return Promise.resolve(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));},readStarshipBuffer:()=>{const b=fs.readFileSync('miniprogram/starship-assets/starship.glb');return Promise.resolve(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));},readRobotBuffer:()=>{const b=fs.readFileSync('miniprogram/robot-assets/robot.glb');return Promise.resolve(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}});await loaded.preload();await loaded.robot.preload();await loaded.starship.preload();await loaded.gundam.preload();assert(loaded.starship.model);assert(loaded.robot.model,'Robot model loaded');assert(loaded.model,'WeChat subpackage and binary loading');
 const timelineBox={console,module:{exports:{}}};
 const source=['config.js','moon-voyage-easing.js','moon-voyage-lighting.js','moon-voyage-timeline.js'].map(f=>fs.readFileSync('miniprogram/pages/gl/'+f,'utf8').replace(/^import[\s\S]*?;\s*$/gm,'').replace(/export /g,'')).join('\n');
 vm.runInNewContext(source+'\nmodule.exports=updateTimeline;',timelineBox);
 camera.rotation.set(0,0,0);const earth=new T.Group();scene.add(earth);
 const mgr={THREE:T,scene,camera,globeGroup:earth,moonMesh:moon,_moonTexReady:true,_voyageTargetRotY:.85,_startState:{camPos:camera.position.clone(),camRot:camera.rotation.clone(),globePos:earth.position.clone(),globeScale:earth.scale.clone(),ambInt:.6,dirInt:1.2,dirPos:new T.Vector3(2,5,8)},_refreshMainStarfieldMesh(){},_companionFx:loaded};
 let started=false,landed=false,shipSeen=false;const moonSamples={};
 loaded.update({t:58,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});
 assert(loaded.robot.model.visible&&!loaded.model.visible,'Only robot visible in second encounter');
 const robotQ=camera.quaternion.clone().inverse().multiply(loaded.robot.model.quaternion);
 assert(robotQ.angleTo(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/4))<1e-6,'Rear view pitched forward 45 degrees');
 const forwardQ=loaded.robot.model.quaternion.clone();
 loaded.update({t:68,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});
 assert(forwardQ.angleTo(loaded.robot.model.quaternion)>2.5,'Robot looks back at the viewer during hold');
 loaded.update({t:63,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});
 const acknowledged=loaded.robot.model.quaternion.clone();
 loaded.update({t:66.9,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});
 assert(acknowledged.angleTo(loaded.robot.model.quaternion)<1e-6,'Companion holds a recognizable response for nearly four seconds');
 let lastGlance;
 for(let t=59;t<74;t+=1/60){
  loaded.update({t,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});
  const q=loaded.robot.model.quaternion.clone();
  if(lastGlance)assert(q.angleTo(lastGlance)<.025,'Glance and return have no abrupt turns');
  lastGlance=q;
 }
 loaded.update({t:77,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});
 assert(forwardQ.angleTo(loaded.robot.model.quaternion)<1e-6,'Faces forward before overtaking starts');
 const sunUniform=loaded.materials[0].userData.craftSun;
 assert(sunUniform.value.x>0,'Key light arrives from screen right');
 const shader={uniforms:{},fragmentShader:'#include <lights_fragment_begin>'};
 loaded.materials[0].onBeforeCompile(shader);
 assert(shader.uniforms.craftSun===sunUniform&&shader.fragmentShader.includes('RE_Direct'),'Directional material shading installed');
 loaded.update({t:43,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});
 assert(!loaded.robot.model.visible&&!loaded.model.visible,'Both models hidden during breathing space');
 loaded.update({t:35,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});
 assert(!loaded.robot.model.visible&&loaded.model.visible,'First encounter remains Voyager');

 for(let t=0;t<113;t+=1/60){timelineBox.module.exports(mgr,t,1/60); if(Math.abs(t-Math.round(t))<.002 && [78,94,98,100,112].includes(Math.round(t))) moonSamples[Math.round(t)]={x:moon.position.clone().project(camera).x,scale:moon.scale.x};if(loaded.moonStart!=null)started=true;if(loaded.glint.visible)landed=true;if(loaded.starship.model.visible){shipSeen=true;assert(!loaded.model.visible&&!loaded.robot.model.visible,'Single ship only in third encounter');}}
 assert(moonSamples[94].x<-2.6&&Math.abs(moonSamples[98].x+1.52)<.03&&Math.abs(moonSamples[100].x+1.03)<.03,'Original a7ca266 left-side Moon timing preserved');
 assert(shipSeen);assert(started&&landed,'Real timeline must show Moon, departure and landing before orbit');
 assert(loaded.moonStart>=92&&loaded.moonStart<92.1,'Foreground reveal at 92s without moving Moon');
 loaded.update({t:loaded.moonStart,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});loaded.starship.model.updateMatrixWorld(true);
 let top=-Infinity,nearest=Infinity;loaded.starship.model.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){const v=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);top=Math.max(top,v.clone().project(camera).y);nearest=Math.min(nearest,-camera.worldToLocal(v).z);}});
 assert(top<-1,'Entire hull starts below the frame, not suddenly visible');assert(nearest>camera.near,'Entry hull avoids near-plane clipping');
 const startPosition=loaded.starship.model.position.clone();loaded.update({t:loaded.moonStart+.01,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});assert(startPosition.distanceTo(loaded.starship.model.position)<.005,'Initial reveal is continuous');
 loaded.update({t:112.3,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});
 assert(loaded.starship.materials.every(m=>m.opacity===1),'Hull stays opaque through landing');
 assert(loaded.starship.model.scale.x<loaded.starship.baseScale*.006,'Vessel resolves to a tiny point before disappearing');
 loaded.update({t:112.65,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});
 assert(loaded.glint.visible&&loaded.glint.material.opacity>.9,'A distinct landing flash follows the tiny vessel');
 assert.equal(loaded.glint.material.depthTest,false,'Landing flash cannot be buried inside lunar surface');
 const actualFlowSpeed=t=>{const args={node1Time:38,node2Time:78,node3Time:113,moonMesh:moon};loaded.update({...args,t});const a=Array.from(loaded.flow.points.geometry.attributes.position.array);loaded.update({...args,t:t+.01});const b=loaded.flow.points.geometry.attributes.position.array;const d=[];for(let i=2;i<b.length;i+=3){const v=(b[i]-a[i])/.01;if(v>0&&v<30)d.push(v);}return d.reduce((a,b)=>a+b,0)/d.length;};
 for(const t of [59,61,68,74])assert(Math.abs(actualFlowSpeed(t)-9)<.01,'Actual particle motion stays fast across the slowed robot action clock');
 assert(Math.abs(actualFlowSpeed(85)/actualFlowSpeed(68)-1.3)<.01,'Actual overtake motion increases gently');
 const camP=camera.position.clone(),camQ=camera.quaternion.clone();
 // The optional Gundam replaces EVE: only the robot's departure tail is shared.
 assert(loaded.gundam.model, 'Actual packaged Gundam geometry loads');
 for(const t of [77,91.8,92.61,112.65,120,130,132,137,142,146,167,243]) {
   loaded.update({t,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});
   assert(!loaded.gundam.model.visible, 'Gundam is absent before its pass and during orbit');
   if(t>=91.8)assert(!loaded.gundam.wake.group.visible,'Short wake also clears before the subsequent voyage');
   assert(camera.position.equals(camP)&&camera.quaternion.equals(camQ), 'Flyby cannot alter original camera');
 }
 const flyby=[];
 for(const t of [77.8,78.8,79.8,81.8,84.8,87.8,89.8,91.6]) {
   loaded.update({t,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});
   assert(loaded.gundam.model.visible);
   flyby.push(camera.worldToLocal(loaded.gundam.model.position.clone()));
 }
 assert(flyby[0].z>0&&flyby[3].z<0,'Begins behind and actually overtakes the observer');
 assert(flyby[0].x>0&&flyby.at(-1).x<0,'Arc begins on the right and departs to the front left');
 assert(flyby[4].clone().sub(flyby[0]).cross(flyby[2].clone().sub(flyby[0])).length()>.5,'Departure follows an arc rather than the old straight line');
 assert(flyby.every((p,i)=>!i||p.z<flyby[i-1].z),'Continues forward with no reversal');
 assert(flyby.at(-1).z < -95, 'Recedes into the distant night instead of hovering');
 assert(loaded.gundam.raw.rotation.x < -.7,'Leans forward with feet trailing, not an upright standing slide');
 loaded.update({t:80,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});
 assert(loaded.robot.model.visible&&loaded.gundam.model.visible,'Brief overlap with yellow robot departure');
 assert(camera.worldToLocal(loaded.robot.model.position.clone()).x<0,'Yellow robot stays on left');
 // Bind-pose bounds exaggerate this animated robot. Check skinned vertices
 // before arranging the new pass relative to its actual disappearance.
 function posedRobotPixels(t) {
   loaded.update({t,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});
   loaded.robot.model.updateMatrixWorld(true);let inside=0;
   loaded.robot.raw.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();const a=o.geometry.attributes;
     for(let i=0;i<a.position.count;i++) {
       const v=new T.Vector3().fromBufferAttribute(a.position,i).applyMatrix4(o.bindMatrix),p=new T.Vector3();
       for(let j=0;j<4;j++) {
         const matrix=new T.Matrix4().fromArray(o.skeleton.boneMatrices,a.skinIndex.array[i*4+j]*16);
         p.addScaledVector(v.clone().applyMatrix4(matrix),a.skinWeight.array[i*4+j]);
       }
       p.applyMatrix4(o.bindMatrixInverse).applyMatrix4(o.matrixWorld).project(camera);
       if(p.z>=-1&&p.z<=1&&Math.abs(p.x)<1&&Math.abs(p.y)<1)inside++;
     }
   });return inside;
 }
 assert(posedRobotPixels(80)>2000,'Yellow robot is still visibly present when Gundam enters');
 assert(posedRobotPixels(82)>0&&posedRobotPixels(83)===0,'Actual yellow silhouette now exits around 82–83s, about 2–3 seconds earlier');
 loaded.update({t:88.5,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});assert(!loaded.robot.model.visible,'Robot schedule shortened by 2.5 seconds');
 const robotScreen=t=>{loaded.update({t,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});return loaded.robot.model.position.clone().project(camera).x;};
 assert(Math.abs(robotScreen(55)-robotScreen(54))>Math.abs(robotScreen(50)-robotScreen(49))*2,'Arrival accelerates into the encounter');
 assert(Math.abs(robotScreen(82)-robotScreen(80))>Math.abs(robotScreen(78)-robotScreen(76))*1.5,'Departure accelerates toward the left rear');

 assert(!loaded.eve,'EVE remains absent from Moon encounters; its new package belongs to zen only');
 loaded.update({t:102,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon});assert(loaded.starship.model.scale.x<loaded.starship.baseScale*.9,'Visible retreat starts earlier and lasts longer');
 loaded.dispose();await loaded.preload();await loaded.robot.preload();await loaded.starship.preload();await loaded.gundam.preload();assert(loaded.robot.model&&loaded.starship.model&&loaded.gundam.model,'All replacement crafts reload after exit and re-entry');loaded.dispose();T.TextureLoader=NativeLoader;
 console.log('WeChat subpackage API and async asset loading PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
const flow=flowBox.module.exports.createStarFlow(T);
const motion=flowBox.module.exports.flowMotion;
for(let e=8;e<=33;e+=.25)assert(Math.abs(motion(e).speed-8)<1e-8,'Cruise never slows during companionship or look-back');
assert(Math.abs(motion(41).speed/motion(18).speed-1.3)<1e-8,'Overtaking is a modest 30 percent speed increase');
for(let e=9;e<49;e+=.25){const h=.0001;assert(Math.abs((motion(e+h).distance-motion(e-h).distance)/(2*h)-motion(e).speed)<1e-5,'Position advances at the declared speed');}
flowBox.module.exports.updateStarFlow(flow,18);
const before=Array.from(flow.points.geometry.attributes.position.array);
flowBox.module.exports.updateStarFlow(flow,18.02);
const after=flow.points.geometry.attributes.position.array;
let approaching=0;for(let i=0;i<after.length;i+=3){assert.equal(after[i],before[i]);assert.equal(after[i+1],before[i+1]);if(after[i+2]>before[i+2])approaching++;}
assert(approaching>800,'Stars approach in depth rather than sliding sideways');
flowBox.module.exports.updateStarFlow(flow,30);
const trails=flow.trails.geometry.attributes.position.array;
assert(trails[2]>trails[5],'Trail recedes from the viewer');
flowBox.module.exports.updateStarFlow(flow,55);assert(!flow.group.visible);
flowBox.module.exports.disposeStarFlow(flow);
console.log('Forward star flow, acceleration, trails and fade PASS');
// Direction changes on a continuous path, rather than replacing the star layer.
assert.equal(motion(-12).speed,0);
assert(motion(-11.98).lateral>motion(-12).lateral,'Departure stars drift right');
assert(motion(0).speed>0&&motion(0).speed<motion(8).speed,'Turn into depth is gradual');
assert.equal(motion(18).lateral,motion(18.02).lateral);
const transition=flowBox.module.exports.createStarFlow(T);
flowBox.module.exports.updateStarFlow(transition,-13);
assert(transition.group.visible,'Flow stars already exist before the second encounter');
const colors0=Array.from(transition.points.geometry.attributes.color.array);
flowBox.module.exports.updateStarFlow(transition,-12.99);
const colors1=transition.points.geometry.attributes.color.array;
assert(colors0.every((c,i)=>Math.abs(c-colors1[i])<.01),'No density pop at transition');
flowBox.module.exports.disposeStarFlow(transition);
console.log('Persistent stars and gradual direction/density transition PASS');
