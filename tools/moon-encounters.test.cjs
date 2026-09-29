const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const T=require('../miniprogram/node_modules/threejs-miniprogram').createScopedThreejs({width:390,height:720,createImage(){return {}}});
const filename=path.resolve('miniprogram/pages/gl/moon-voyage-encounters.js');
const flowBox={module:{exports:{}}};vm.runInNewContext(fs.readFileSync('miniprogram/pages/gl/moon-voyage-star-flow.js','utf8').replace(/export /g,'')+'\nmodule.exports={createStarFlow,updateStarFlow,disposeStarFlow,flowMotion}',flowBox);
const box={...flowBox.module.exports,require:require('module').createRequire(filename),module:{exports:{}},console};
vm.runInNewContext(fs.readFileSync(filename,'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'')+'\nmodule.exports={VoyageEncounters,buildVoyager}',box);
const {VoyageEncounters,buildVoyager}=box.module.exports;
const b=fs.readFileSync('miniprogram/voyager-assets/geometry.bin');const buffer=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const camera=new T.PerspectiveCamera(45,390/720,.1,200),scene=new T.Scene();camera.position.set(0,0,5);camera.rotation.y=.85;
const fx=new VoyageEncounters();fx.setContext({THREE:T,scene,camera});Object.assign(fx,buildVoyager(T,buffer,Array.from({length:4},()=>new T.Texture())));fx.textures=[];scene.add(fx.model);fx.key=new T.DirectionalLight();fx.stars=new T.Points(new T.BufferGeometry().addAttribute('position',new T.BufferAttribute(new Float32Array(1080),3)),new T.PointsMaterial());fx.glint=new T.Sprite(new T.SpriteMaterial());
const moon=new T.Mesh(new T.SphereGeometry(1),new T.MeshBasicMaterial());scene.add(moon);moon.position.set(-5.8,-1.2,0);moon.scale.setScalar(.9);moon.visible=false;
const cp=camera.position.clone(),cq=camera.quaternion.clone();const tick=t=>fx.update({t,node1Time:38,node2Time:78,node3Time:113,moonMesh:moon,dtSec:1/60});
tick(14);assert.equal(fx.materials[0].opacity,0);tick(23);const distant=fx.model.position.distanceTo(camera.position);tick(35);assert(fx.model.position.distanceTo(camera.position)<distant);tick(47);assert.equal(fx.materials[0].opacity,0);tick(61);const p=fx.model.position.clone();tick(66);assert(fx.model.position.distanceTo(p)<.1,'alongside hold');
// First pass must be one straight, constant-speed path, exiting on the left.
const track=[];for(const t of [20,25,30,35,40]){tick(t);track.push(camera.worldToLocal(fx.model.position.clone()));}
const velocity=track[1].clone().sub(track[0]);
for(let i=2;i<track.length;i++)assert(track[i].clone().sub(track[i-1]).distanceTo(velocity)<1e-9,'No stop or kink in first pass');
assert(track[4].x<0,'First craft passes on the left');
tick(45);assert(camera.worldToLocal(fx.model.position.clone()).z>0,'First craft actually passes the viewer instead of just crossing the screen');
for(let t=0;t<113;t+=.1){if(t>86)moon.visible=true;tick(t);assert(camera.position.equals(cp));assert(camera.quaternion.equals(cq));assert(fx.model.position.toArray().every(Number.isFinite));}
assert(fx.moonStart>=86&&fx.moonStart<97,'Moon gates third departure');tick(112.65);assert(fx.glint.visible);assert(!fx.model.visible);tick(113);assert(!fx.glint.visible&&!fx.model.visible);
fx.reset();assert.equal(fx.moonStart,null);fx.dispose();fx.dispose();console.log('Voyager geometry, three phases, Moon gate, camera preservation and cleanup PASS');
// Exercise the actual WeChat loading contract, not only a constructed mesh.
(async()=>{
 const NativeLoader=T.TextureLoader;T.TextureLoader=class {load(url,done){assert(url.startsWith('/voyager-assets/'),'Canvas image paths must be absolute within the package');queueMicrotask(()=>done(new T.Texture()));}};
 let subpackage=false;
 box.require=(name,success)=>{assert.equal(name,'../../voyager-assets/ready.js');subpackage=true;success(true);};
 box.wx={getFileSystemManager(){return {readFile({filePath,success}){assert(subpackage);assert.equal(filePath,'voyager-assets/geometry.bin');success({data:buffer});}};}};
 const loaded=new VoyageEncounters();loaded.setContext({THREE:T,scene,camera});await loaded.preload();assert(loaded.model,'WeChat subpackage and binary loading');
 const timelineBox={console,module:{exports:{}}};
 const source=['config.js','moon-voyage-easing.js','moon-voyage-lighting.js','moon-voyage-timeline.js'].map(f=>fs.readFileSync('miniprogram/pages/gl/'+f,'utf8').replace(/^import[\s\S]*?;\s*$/gm,'').replace(/export /g,'')).join('\n');
 vm.runInNewContext(source+'\nmodule.exports=updateTimeline;',timelineBox);
 camera.rotation.set(0,0,0);const earth=new T.Group();scene.add(earth);
 const mgr={THREE:T,scene,camera,globeGroup:earth,moonMesh:moon,_moonTexReady:true,_voyageTargetRotY:.85,_startState:{camPos:camera.position.clone(),camRot:camera.rotation.clone(),globePos:earth.position.clone(),globeScale:earth.scale.clone(),ambInt:.6,dirInt:1.2,dirPos:new T.Vector3(2,5,8)},_refreshMainStarfieldMesh(){},_companionFx:loaded};
 let started=false,landed=false;
 for(let t=0;t<113;t+=1/60){timelineBox.module.exports(mgr,t,1/60);if(loaded.moonStart!=null)started=true;if(loaded.glint.visible)landed=true;}
 assert(started&&landed,'Real timeline must show Moon, departure and landing before orbit');
 assert(loaded.moonStart>=79&&loaded.moonStart<80);
 loaded.dispose();T.TextureLoader=NativeLoader;
 console.log('WeChat subpackage API and async asset loading PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
const flow=flowBox.module.exports.createStarFlow(T);
const motion=flowBox.module.exports.flowMotion;
assert(motion(30).speed>motion(18).speed*5,'Overtaking star motion must accelerate visibly');
flowBox.module.exports.updateStarFlow(flow,18);
const before=Array.from(flow.points.geometry.attributes.position.array);
flowBox.module.exports.updateStarFlow(flow,18.02);
const after=flow.points.geometry.attributes.position.array;
let approaching=0;for(let i=0;i<after.length;i+=3){assert.equal(after[i],before[i]);assert.equal(after[i+1],before[i+1]);if(after[i+2]>before[i+2])approaching++;}
assert(approaching>800,'Stars approach in depth rather than sliding sideways');
flowBox.module.exports.updateStarFlow(flow,30);
const trails=flow.trails.geometry.attributes.position.array;
assert(trails[2]>trails[5],'Trail recedes from the viewer');
flowBox.module.exports.updateStarFlow(flow,42);assert(!flow.group.visible);
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
