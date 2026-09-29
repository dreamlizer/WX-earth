const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const cp = require('node:child_process');
const {createScopedThreejs} = require('../miniprogram/node_modules/threejs-miniprogram');
function load(source) {
 const box={module:{exports:{}},console,fixTexture(){}};
 vm.runInNewContext(source.replace(/^import .*;$/gm,'').replace('export class','class')+'\nmodule.exports=MoonOrbitSequence',box);
 return box.module.exports;
}
const oldSource=cp.execFileSync('git',['show','7fcb72c:miniprogram/pages/gl/moon-orbit-sequence.js'],{encoding:'utf8'});
const Old=load(oldSource), New=load(fs.readFileSync('miniprogram/pages/gl/moon-orbit-sequence.js','utf8'));
const images=[];
const THREE=createScopedThreejs({width:390,height:720,createImage(){const i={};images.push(i);return i;}});
function setup(Type,aspect){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,aspect,.1,1000);
 camera.position.set(0,0,5);camera.rotation.y=.85;
 scene.add(new THREE.AmbientLight(0xffffff,.1));const light=new THREE.DirectionalLight(0xffffff,1.1);light.position.set(5,4,8);scene.add(light);
 const seq=new Type();seq.init(THREE,scene);
 const moon=new THREE.Mesh(new THREE.SphereGeometry(.9,48,32),new THREE.MeshStandardMaterial());moon.position.set(-5.8,-1.2,0);scene.add(moon);
 return {scene,camera,seq,moon,light};
}
function tick(s,t,enabled){return s.seq.tick({t,node3Time:113,camera:s.camera,moonWorld:s.moon.position,globeGroup:null,orbitDurationSec:130,orbitEndDeg:630,moonRadius:.9,cameraMinY:5.4,cameraLiftEndDeg:70,lookBlendDeg:55,enableSun:false,farEarth:enabled,sunGlare:enabled,maxAmbient:.07,minDir:1.1,sunLightDist:28});}
for(const aspect of [.45,.5625,1.78]){
 const a=setup(Old,aspect),b=setup(New,aspect);let firstVisible=0; const sightings=[];
 let fixed,previous;
 for(let t=113;t<=265;t+=.1){
  tick(a,t,false);tick(b,t,true);
  if(t<113.2){images.splice(0).forEach(i=>i.dispatchEvent({type:'load'}));}
  if(t<=243){assert.ok(a.camera.position.distanceTo(b.camera.position)<1e-10,'original orbit position must remain exact');assert.ok(1-Math.abs(a.camera.quaternion.dot(b.camera.quaternion))<1e-10,'original orientation stays exact throughout orbit');}
  assert.ok(1-Math.abs(a.camera.quaternion.dot(b.camera.quaternion))<1e-10, 'push-in must not rotate the camera either');
  assert.ok(a.light.position.equals(b.light.position),'restore exact original solar position every frame');
  assert.ok(a.light.target.position.equals(b.light.target.position),'restore original solar direction');
  assert.equal(a.light.intensity,b.light.intensity,'preserve original direct brightness');
  assert.equal(a.scene.children.find(c=>c.type==='AmbientLight').intensity,b.scene.children.find(c=>c.type==='AmbientLight').intensity,'preserve original ambient brightness');
  if(b.seq._glare.visible)assert.ok(b.seq._glare.children[0].material.uniforms.root.value.y>1,'ray origin stays above frame');
  const earth=b.seq._farEarth;if(!fixed)fixed=earth.position.clone();assert.ok(fixed.equals(earth.position),'Earth must be fixed');
  b.scene.updateMatrixWorld(true);b.camera.updateMatrixWorld(true);
  const center=earth.position.clone().project(b.camera);
  const blocked=new THREE.Raycaster(b.camera.position,earth.position.clone().sub(b.camera.position).normalize()).intersectObject(b.moon).length;
  if(t<243&&Math.abs(center.x)<.85&&Math.abs(center.y)<.85&&center.z<1&&!blocked){firstVisible++;sightings.push(t);}
  const moonScreen=b.moon.position.clone().project(b.camera);
  const frustum=new THREE.Frustum().setFromMatrix(new THREE.Matrix4().multiplyMatrices(b.camera.projectionMatrix,b.camera.matrixWorldInverse));
  assert.ok(frustum.intersectsObject(b.moon), `Moon frame t=${t} aspect=${aspect} xy=${moonScreen.x},${moonScreen.y}`);
  if(t>=238) {
    assert.ok(Math.abs(center.x)<.85 && Math.abs(center.y)<.85 && center.z<1 && !blocked, 'Earth is already visible before push and stays visible');
  }
  assert.ok(b.camera.position.distanceTo(b.moon.position)>1,'camera stays above lunar surface');
  if(previous)assert.ok(previous.distanceTo(b.camera.position)<.22,'no positional cut at approach');previous=b.camera.position.clone();
 }
 if(aspect===.5625) console.log('visible orbit samples', sightings.filter((_,i)=>i%80===0).map(t=>Number(t.toFixed(1))));

 assert.ok(firstVisible>10,'existing orbit must show Earth before final approach');
 b.camera.updateMatrixWorld(true);const earth=b.seq._farEarth,center=earth.position.clone().project(b.camera);
 assert.ok(Math.abs(center.x)<.85&&Math.abs(center.y)<.85,'ending frames Earth');
 assert.equal(new THREE.Raycaster(b.camera.position,earth.position.clone().sub(b.camera.position).normalize()).intersectObject(b.moon).length,0,'ending Earth is unoccluded');
 tick(b,261,true);
 const lon=105*Math.PI/180,lat=35*Math.PI/180;
 const china=new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),-Math.cos(lat)*Math.sin(lon)).applyQuaternion(earth.quaternion);
 assert.ok(china.dot(b.camera.position.clone().sub(earth.position).normalize())>0.90, 'China remains near the final disk center');
 const sun=b.light.position.clone().sub(b.light.target.position).normalize();
 assert.ok(china.dot(sun)>.58 && china.dot(sun)<.60,'central China receives grazing daylight instead of lying in darkness');
 const north=new THREE.Vector3(-Math.sin(lat)*Math.cos(lon),Math.cos(lat),Math.sin(lat)*Math.sin(lon)).applyQuaternion(earth.quaternion);
 assert.ok(north.y>0,'north remains above China');
 const heldCamera=b.camera.position.clone(), heldEarth=earth.position.clone();
 tick(b,261,true);const rotationAt261=earth.quaternion.clone();
 tick(b,281,true);assert.ok(Math.abs(2*Math.acos(Math.min(1,Math.abs(earth.quaternion.dot(rotationAt261))))-.18)<1e-10, 'ending retains subtle continuous rotation');
 tick(b,261,true);assert.ok(1-Math.abs(earth.quaternion.dot(rotationAt261))<1e-10, 'rotation is deterministic on replay or seek');
 assert.ok(earth.position.equals(heldEarth) && b.camera.position.equals(heldCamera), 'spin must not move Earth or the held camera');
 const cloud=b.seq._farEarthCloud;
 assert.equal(cloud.parent,earth,'clouds inherit Earth orientation');
 assert.ok(cloud.visible && cloud.material.alphaMap,'cloud mask is loaded');
 assert.equal(cloud.material.depthWrite,false,'transparent clouds do not hide the globe with depth writes');
 let cloudDisposed=0;cloud.material.alphaMap.addEventListener('dispose',()=>cloudDisposed++);
 let disposed=0;earth.material.map.addEventListener('dispose',()=>disposed++);b.seq.dispose();b.seq.dispose();assert.equal(disposed,1);assert.equal(cloudDisposed,1);assert.equal(b.scene.getObjectByName('MOON_VOYAGE_FAR_EARTH'),undefined);assert.equal(b.scene.getObjectByName('MOON_VOYAGE_SUN_GLARE'),undefined);
}
const pending=setup(New,.5);tick(pending,113,true);const pendingMesh=pending.seq._farEarth;const pendingCloud=pending.seq._farEarthCloud;pending.seq.reset();images.splice(0).forEach(i=>i.dispatchEvent({type:'load'}));assert.equal(pendingMesh.visible,false,'late image cannot revive disposed Earth');assert.equal(pendingCloud.visible,false,'late cloud load cannot revive disposed clouds');
console.log('original Earth integration: exact original orbit and lighting restored, early visibility, fixed Earth, final framing, disposal PASS');

const blockedGlare=setup(New,.5625);tick(blockedGlare,113,true);
const sunDir=blockedGlare.seq._dirLightPos0.clone().sub(blockedGlare.moon.position).normalize();
blockedGlare.camera.position.copy(blockedGlare.moon.position).addScaledVector(sunDir,-5);
blockedGlare.camera.lookAt(blockedGlare.moon.position);
blockedGlare.seq._tickGlare(blockedGlare.camera,blockedGlare.moon.position,.9,180,.4);
assert.equal(blockedGlare.seq._glare.visible,false,'Moon blocks glare along the solar ray');
blockedGlare.seq.dispose();


const fadeScene=setup(New,.5625);tick(fadeScene,113,true);
for(const degrees of [180,540]){
 const p=degrees/630,u=p<.5?Math.cbrt(p/4):1-Math.cbrt((1-p)/4),center=113+u*130;
 for(const offset of [-5,-2.75,-.5,0,.5,2.75,5]){
  tick(fadeScene,center+offset,true);
  const expected=Math.max(0,Math.min(1,(5-Math.abs(offset))/4.5));
  assert.ok(Math.abs(fadeScene.seq._glare.children[0].material.uniforms.strength.value-expected)<1e-8,'both passages fade evenly over ten seconds');
 }
}
fadeScene.seq.dispose();
