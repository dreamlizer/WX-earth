const assert=require('node:assert/strict'),fs=require('node:fs');
const {T,VoyageGundam,VoyageEvaPursuit,EVA_PURSUIT,buffer}=require('./eva-pursuit-runtime.cjs');
const nativeLoader=T.TextureLoader;let disposed=0;
T.TextureLoader=class{load(url,done){assert(/^\/eva0[12]-assets\/basecolor.jpg$/.test(url));const texture=new T.Texture();texture.addEventListener('dispose',()=>disposed++);queueMicrotask(()=>done(texture));}};
function projection(model,camera){
  model.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  let inside=0,total=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  model.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;
    for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).project(camera);total++;
      if(v.z< -1||v.z>1)continue;minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);if(Math.abs(v.x)<=1&&Math.abs(v.y)<=1)inside++;
    }
  });return {inside,total,minX,maxX,minY,maxY};
}
(async()=>{
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(45,390/720,.1,1000);camera.position.z=5;camera.updateMatrixWorld(true);
  const readEvaBuffer=unit=>Promise.resolve(buffer(unit==='unit01'?'eva01-assets':'eva02-assets'));
  const fx=new VoyageEvaPursuit({THREE:T,scene,readEvaBuffer});await fx.preload();assert.equal(fx.actors.length,2);
  const g=new VoyageGundam({THREE:T,scene,readBuffer:()=>Promise.resolve(buffer('gundam-assets'))});
  T.TextureLoader=class{load(url,done){queueMicrotask(()=>done(new T.Texture()));}};await g.preload();
  assert.equal(EVA_PURSUIT[1].start-EVA_PURSUIT[0].start,.5);
  const [purple,red]=fx.actors,entry=[];
  for(const actor of fx.actors){
    const bodyAxis=new T.Vector3(0,1,0).applyQuaternion(actor.raw.quaternion);assert(bodyAxis.z<-.97,'Head leads in a prone flight pose');
    const bytes=fs.readdirSync('miniprogram/'+actor.spec.root).reduce((sum,name)=>sum+fs.statSync('miniprogram/'+actor.spec.root+'/'+name).size,0);assert(bytes<2*1024*1024,'Each independently loaded EVA package stays below 2MiB');
    let first=null;for(let e=.4;e<2;e+=.01){fx.update(actor.spec.start+e,camera);if(projection(actor.model,camera).inside>0){first=actor.spec.start+e;break;}}
    entry.push(first);
  }
  console.log('Measured first visible silhouette',entry);
  assert(Math.abs(entry[1]-entry[0]-.5)<.015,'Actual projected entry is staggered by half a second');
  fx.update(83.3,camera);assert(purple.model.position.x<0&&red.model.position.x>0,'Purple overtakes on left, red on right');
  const cameraState=camera.matrixWorld.clone();
  let previousGap=Infinity;
  for(const t of [84,85,86,87,88,89]){
    fx.update(t,camera);g.update(t,camera);
    for(const a of [g,purple,red]){assert(a.model.visible);const p=projection(a.model,camera);assert.equal(p.inside,p.total,'Three complete silhouettes remain visible during the chase at '+t);}
    assert(g.model.position.z<purple.model.position.z&&purple.model.position.z<red.model.position.z,'Gundam leads, purple follows, red is last');
    const gap=purple.model.position.z-g.model.position.z;
    if(t<=86)assert(gap<previousGap,'Initial fast pursuit closes the leader gap');previousGap=gap;
    const centers=[g,purple,red].map(a=>a.model.position.clone().project(camera));
    assert(centers[0].distanceTo(centers[1])>.05&&centers[1].distanceTo(centers[2])>.05,'Pursuers remain spatially staggered');
    for(const actor of fx.actors){
      for(const sheet of [actor.wake.plume,actor.wake.wisps])assert(Array.from(sheet.mesh.geometry.attributes.position.array).every(Number.isFinite));
      const plume=actor.wake.plume,tail=new T.Vector3().fromArray(plume.centers,plume.segments*3),head=new T.Vector3().fromArray(plume.centers);
      const gp=g.wake.plume,gt=new T.Vector3().fromArray(gp.centers,gp.segments*3),gh=new T.Vector3().fromArray(gp.centers);
      assert(tail.distanceTo(head)<gt.distanceTo(gh)*.7,'EVA attached plume is physically shorter than Gundam');
      assert(actor.wake.wisps.birthTimes.every(b=>b>=t-actor.spec.start-.4501),'EVA wisps die within .45 seconds');
    }
  }
  fx.update(86,camera);const same=Array.from(purple.wake.wisps.mesh.geometry.attributes.position.array);fx.update(89,camera);fx.update(86,camera);assert.deepEqual(Array.from(purple.wake.wisps.mesh.geometry.attributes.position.array),same,'Seeking reconstructs wake without stale particles');
  g.update(90,camera);assert(g.model.visible&&projection(g.model,camera).inside>0,'Leader is still in view at 90 seconds');
  for(const [t,gVisible,pVisible,rVisible] of [[90.55,false,true,true],[90.75,false,false,true],[91.25,false,false,false]]){
    g.update(t,camera);fx.update(t,camera);assert.equal(g.model.visible,gVisible);assert.equal(purple.model.visible,pVisible);assert.equal(red.model.visible,rVisible);
  }
  fx.update(91.6,camera);assert(fx.actors.every(a=>!a.wake.group.visible),'All EVA light clears before 92-second starship');
  assert.deepEqual(camera.matrixWorld.elements,cameraState.elements);
  fx.reset();assert(fx.actors.every(a=>!a.model.visible&&!a.wake.group.visible));
  fx.dispose();fx.dispose();g.dispose();assert.equal(scene.children.length,0);assert.equal(disposed,2,'Both shared atlases released once');
  T.TextureLoader=class{load(url,done){queueMicrotask(()=>done(new T.Texture()));}};
  await fx.preload();assert.equal(fx.actors.length,2,'Exit/re-entry reloads both pursuers');fx.dispose();
  let finish;const late=new VoyageEvaPursuit({THREE:T,scene,readEvaBuffer:()=>new Promise(resolve=>finish=resolve)});const loading=late.preload();await Promise.resolve();await Promise.resolve();late.dispose();finish(buffer('eva01-assets'));await loading;assert.equal(scene.children.length,0,'Late I/O cannot resurrect a pursuit');
  let finishSecond;const staged=new VoyageEvaPursuit({THREE:T,scene,readEvaBuffer:unit=>unit==='unit01'?readEvaBuffer(unit):new Promise(resolve=>finishSecond=resolve)});
  const preparing=staged.preload();await new Promise(setImmediate);assert.equal(staged.staged.length,1);
  const partial=staged.staged[0];let partialDisposals=0;partial.model.traverse(o=>{if(o.geometry)o.geometry.addEventListener('dispose',()=>partialDisposals++);});
  staged.dispose();assert.equal(partialDisposals,partial.raw.children.length,'Exit immediately releases a prepared first actor while the second is pending');
  finishSecond(buffer('eva02-assets'));await preparing;assert.equal(scene.children.length,0);assert.equal(partialDisposals,partial.raw.children.length,'Stale pair completion never double-disposes');
  const failed=new VoyageEvaPursuit({THREE:T,scene,readEvaBuffer:unit=>unit==='unit01'?readEvaBuffer(unit):Promise.reject(Error('expected missing second asset'))});
  await failed.preload();assert.equal(failed.actors.length,0,'An incomplete pair cannot appear as a half-built chase');assert.equal(scene.children.length,0);failed.dispose();
  T.TextureLoader=nativeLoader;
  console.log('EVA half-second stagger, actual silhouettes, chase depth, short exhaust and lifecycle PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
