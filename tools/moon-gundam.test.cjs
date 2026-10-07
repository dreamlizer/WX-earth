const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const T=require('../miniprogram/node_modules/threejs-miniprogram').createScopedThreejs({width:390,height:720,createImage(){return {}}});
const file=path.resolve('miniprogram/pages/gl/moon-voyage-gundam.js');
const b=fs.readFileSync('miniprogram/gundam-assets/geometry.bin'),buffer=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
let installed=false,texture,releaseCount=0;
T.TextureLoader=class {load(url,done){assert(installed);assert.equal(url,'/gundam-assets/basecolor.jpg');texture=new T.Texture();texture.addEventListener('dispose',()=>releaseCount++);queueMicrotask(()=>done(texture));return texture;}};
const box={module:{exports:{}},console,Float32Array,Int16Array,Int8Array,Uint16Array,release:require('../miniprogram/pages/gl/moon-voyage-robot.js').release,require(name,resolve){if(name==='../../gundam-assets/ready.js'){installed=true;resolve(true);return;}return require('module').createRequire(file)(name);},wx:{getFileSystemManager(){return {readFile({filePath,success}){assert(installed);assert.equal(filePath,'gundam-assets/geometry.bin');success({data:buffer});}};}}};
vm.runInNewContext(fs.readFileSync(file,'utf8').replace(/^import .*;$/m,'').replace(/export /g,'')+'\nmodule.exports={VoyageGundam}',box);
const {VoyageGundam}=box.module.exports;
const lightBox={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync('miniprogram/pages/gl/moon-voyage-craft-light.js','utf8').replace(/export /g,'')+'\nmodule.exports=shadeCraft;',lightBox);
(async()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(45,390/720,.1,200),g=new VoyageGundam({THREE:T,scene});
 await g.preload();assert(g.model);assert.equal(g.raw.children.length,2,'Two draw calls instead of eighteen');
 const ordinary=new T.MeshStandardMaterial(),armour=g.materials[0];
 let originalHook=false;armour.onBeforeCompile=()=>{originalHook=true;};
 lightBox.module.exports(T,[ordinary,armour],camera);
 const lightingShader=m=>{const s={uniforms:{},fragmentShader:T.ShaderLib.standard.fragmentShader};m.onBeforeCompile(s);return s;};
 const oldShader=lightingShader(ordinary),armourShader=lightingShader(armour);
 assert(originalHook,'Existing compile hook is preserved');
 assert.equal((oldShader.fragmentShader.match(/RE_Direct\(/g)||[]).length,1,'Other crafts retain their single sunlight');
 assert.equal((armourShader.fragmentShader.match(/RE_Direct\(/g)||[]).length,2,'Armour has independent key and grazing light');
 assert(armourShader.fragmentShader.includes('outgoingLight +=')&&armourShader.fragmentShader.includes('#include <tonemapping_fragment>'),'Rim participates in normal output and tone mapping');
 assert(armour.defines.GUNDAM_CRAFT_LIGHT===1&&!ordinary.defines?.GUNDAM_CRAFT_LIGHT,'Shader program cache distinguishes Gundam from earlier crafts');
 const hook=armour.onBeforeCompile,uniform=armour.userData.craftSun;
 lightBox.module.exports(T,[armour],camera);
 assert(armour.onBeforeCompile===hook&&armour.userData.craftSun===uniform,'Repeated updates do not stack shader hooks or uniforms');
 const bodyAxis=new T.Vector3(0,1,0).applyQuaternion(g.raw.quaternion);
 assert(bodyAxis.z<-.97&&Math.abs(bodyAxis.y)<.12,'Almost horizontal flight: head leads and soles trail toward observer');
 const triangles=g.raw.children.reduce((n,m)=>n+m.geometry.index.count/3,0);assert.equal(triangles,77407);
 g.raw.traverse(o=>{if(o.isMesh)assert([...o.geometry.attributes.position.array].every(Number.isFinite));});
 const bytes=fs.readdirSync('miniprogram/gundam-assets').reduce((n,f)=>n+fs.statSync('miniprogram/gundam-assets/'+f).size,0);
 assert(bytes<2*1024*1024,'Independent package below 2MB');
 // Measure actual projected vertices: scheduling a model is not proof it is
 // visible, and an oversized clipped fragment is not a readable whole body.
 function frame(t) {
   g.update(t,camera);g.model.updateMatrixWorld(true);
   let inside=0,total=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
   g.raw.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;
     for(let i=0;i<a.count;i++) {
       total++;const p=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).project(camera);
       if(p.z< -1||p.z>1)continue;
       minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
       if(Math.abs(p.x)<=1&&Math.abs(p.y)<=1)inside++;
     }
   });return {inside,total,minX,maxX,minY,maxY};
 }
 const entry=frame(80);assert(entry.inside>1000&&g.model.position.x>0,'Enters from the right before the yellow robot exits');
 const near=frame(80.8);assert.equal(near.inside,near.total);assert(near.maxX-near.minX>.5&&near.maxX-near.minX<.75,'Readable passing body occupies less than forty percent of screen width');
 let previousWidth=Infinity;
 for(const t of [81,82,83,84,85,86,87,88,89]) {
   const f=frame(t);assert.equal(f.inside,f.total,'Whole body and equipment remain visible while moving away');
   const width=f.maxX-f.minX;assert(width<previousWidth,'Body steadily recedes instead of approaching the viewer');previousWidth=width;
 }
 g.update(81.8,camera);const forward=g.model.position.clone();g.update(82.8,camera);
 assert(forward.z-g.model.position.z>4,'Forward overtake continues during the readable near pass');
 const speeds=[];for(const t of [81,83,85,87,89]){g.update(t,camera);const a=g.model.position.clone();g.update(t+.01,camera);speeds.push(a.distanceTo(g.model.position)/.01);}
 assert(speeds.every((v,i)=>!i||v>speeds[i-1]),'Visible flight progressively accelerates: '+speeds);
 assert(speeds[0]<5&&speeds[4]>13,'Readable entry speeds up to a decisive departure');
 g.update(83.8,camera);assert(g.model.position.x>0&&g.model.position.z<=-31,'Reaches distance ahead before sweeping to the left');
 g.update(85.8,camera);assert(g.model.position.x<0&&g.model.position.z<=-48,'Left turn occurs in the distance');
 const chest=new T.Vector3(0,0,-1).applyQuaternion(g.raw.quaternion).applyQuaternion(g.model.quaternion);
 assert(chest.dot(camera.position.clone().sub(g.model.position).normalize())>.6,'Distant bank still presents the chest');
 const distant=frame(89);assert(distant.maxX-distant.minX<.15&&g.model.position.z<-70,'Departs as a small distant craft');
 const away=frame(90);assert.equal(away.inside,0);assert(away.maxX< -1&&g.model.position.z<-80,'Leaves in the far front-left, not beside the observer');
 g.update(91.7,camera);assert(g.model.visible);g.update(91.8,camera);assert(!g.model.visible,'Departure ends before the next starship');
 const wake=g.wake,plume=wake.plume,wisps=wake.wisps,attrs=wisps.mesh.geometry.attributes;
 assert.equal(wake.group.parent,scene,'Exhaust is attached to the actual scene');
 assert.equal(wake.group.children.length,2,'Short attached plume and detached wisps use two bounded draws');
 assert.equal(plume.mesh.geometry.index.count/3+wisps.mesh.geometry.index.count/3,160);
 for(const sheet of [plume,wisps]) {
   assert.equal(sheet.mesh.material.blending,T.AdditiveBlending);
   assert(!sheet.mesh.material.depthWrite&&sheet.mesh.material.depthTest,'Exhaust respects body occlusion without hiding stars');
 }
 g.update(79,camera);assert(!wake.group.visible,'No exhaust flash appears behind the camera');
 const cameraState=camera.matrixWorld.clone();
 g.update(85.8,camera);g.model.updateMatrixWorld(true);wake.group.updateMatrixWorld(true);
 const nozzle=new T.Vector3(-1.12,4.3,1.9).applyMatrix4(g.raw.matrixWorld);
 const head=new T.Vector3().fromArray(plume.centers).applyMatrix4(wake.group.matrixWorld);
 assert(head.distanceTo(nozzle)<1e-5,'Attached plume follows the backpack through the bank');
 const pHead=new T.Vector3().fromArray(plume.centers),pTail=new T.Vector3().fromArray(plume.centers,32*3);
 assert(pTail.distanceTo(pHead)<10,'Only the short attached plume has a luminous core');
 assert(wisps.birthTimes.every(t=>t>=8-.85001&&t<=8.00001),'Wisps contain less than one second of births, not a six-second flight line');
 const positions=Array.from(attrs.position.array),midIndex=24;
 const birth=wisps.birthTimes[midIndex],oldPoint=new T.Vector3().fromArray(wisps.centers,midIndex*3),oldStrength=attrs.strength.array[midIndex*2];
 g.update(85.8+.85/48,camera);
 assert(Math.abs(wisps.birthTimes[midIndex+1]-birth)<1e-5,'Track the same emitted patch at two instants');
 const moved=new T.Vector3().fromArray(wisps.centers,(midIndex+1)*3);
 assert(moved.distanceTo(oldPoint)>.15&&moved.z>oldPoint.z,'Emitted light flows backward, instead of sitting on the old path');
 assert(attrs.strength.array[(midIndex+1)*2]<oldStrength,'Each emitted patch dims as it moves');
 assert(wisps.mesh.material.uniforms.exhaustTime.value>8,'Noise animation advances with flight time');
 g.update(85.8+.86,camera);
 assert(wisps.birthTimes.every(t=>t>birth),'A patch cannot remain on the curve after its own lifetime');
 g.update(87.5,camera);g.update(85.8,camera);
 assert.deepEqual(Array.from(attrs.position.array),positions,'Seeking and re-entry reconstruct the same effect without ghost history');
 assert.deepEqual(camera.matrixWorld.elements,cameraState.elements,'Exhaust leaves the voyage camera unchanged');
 assert(attrs.strength.array[96]<1e-6,'Oldest wisps have completely faded');
 function glow(t) {
   g.update(t,camera);assert(wake.group.visible);
   assert.equal(frame(t).inside,0,'Retirement begins after the body leaves the view');
   return Array.from(attrs.strength.array).reduce((sum,v)=>sum+v,0);
 }
 const remaining=[89.75,90,90.3,90.5].map(glow);
 assert(remaining.every((v,i)=>v>0&&(!i||v<remaining[i-1])),'Old light dies progressively after emission stops');
 for(let t=79.5;t<90.55;t+=.3){g.update(t,camera);for(const sheet of [plume,wisps])assert(Array.from(sheet.mesh.geometry.attributes.position.array).every(Number.isFinite),'Exhaust geometry stays finite');}
 g.update(90.56,camera);assert(!wake.group.visible,'No exhaust remains beyond its 0.85-second lifetime');
 let wakeGeometryDisposals=0,wakeMaterialDisposals=0;
 for(const sheet of [plume,wisps]){sheet.mesh.geometry.addEventListener('dispose',()=>wakeGeometryDisposals++);sheet.mesh.material.addEventListener('dispose',()=>wakeMaterialDisposals++);}
 g.update(85,camera);assert(g.model.visible&&wake.group.visible);g.reset();assert(!g.model.visible&&!wake.group.visible);
 g.dispose();g.dispose();assert.equal(scene.children.length,0);assert.equal(releaseCount,1,'Shared atlas disposed once');
 assert.equal(wakeGeometryDisposals,2);assert.equal(wakeMaterialDisposals,2,'Both exhaust layers are released exactly once');
 let finish;const retired=new VoyageGundam({THREE:T,scene,readBuffer:()=>new Promise(r=>finish=r)});
 const loading=retired.preload();await Promise.resolve();retired.dispose();finish(buffer);await loading;
 assert(!retired.model&&scene.children.length===0,'Late load cannot resurrect removed craft');
 console.log('Gundam accelerating full-body flight, flowing short-lived exhaust, package and async cleanup PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
