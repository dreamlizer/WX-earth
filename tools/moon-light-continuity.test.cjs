const fs = require('fs'), vm = require('vm'), assert = require('assert');
const T = require('../miniprogram/node_modules/threejs-miniprogram').createScopedThreejs({width:390,height:720,createImage(){return {};}});
const box = {console, module:{exports:{}}, fixTexture(){}};
const source = ['moon-voyage-lighting.js','moon-orbit-sequence.js'].map(f=>fs.readFileSync('miniprogram/pages/gl/'+f,'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'')).join('\n');
vm.runInNewContext(source+'\nmodule.exports={updateLighting,MoonOrbitSequence};',box);
const {updateLighting,MoonOrbitSequence} = box.module.exports;
const scene = new T.Scene(), camera = new T.PerspectiveCamera(45,390/720,.1,1000);
camera.position.set(0,0,5); camera.rotation.y=.85;
const amb = new T.AmbientLight(0xffffff,.6), dir = new T.DirectionalLight(0xffffff,1.5);
dir.position.set(2,5,8); scene.add(amb,dir);
const moon = new T.Vector3(-5.8,-1.2,0), seq = new MoonOrbitSequence(); seq.init(T,scene);
const mgr = {THREE:T,scene,_tmpMoonStart:moon,_startState:{ambInt:.6,dirInt:1.5,dirPos:dir.position.clone(),dirTarget:dir.target.position.clone()}};
let previous, maxStep=0;
for(let i=0;i<=800;i++) {
  const t=101+i*.02, u=Math.max(0,Math.min(1,(t-103)/10)), p=u*u*(3-2*u);
  updateLighting(mgr,1,p);
  if(t>=113)seq.tick({t,node3Time:113,camera,moonWorld:moon,orbitDurationSec:130,enterBlendSec:.85,enterLightBlendSec:3,moonRadius:.9,cameraMinY:5.4,cameraLiftEndDeg:70,lookBlendDeg:55,enableSun:false,farEarth:false,sunGlare:false,maxAmbient:.07,minDir:1.1,sunLightDist:28});
  const direction=dir.position.clone().sub(dir.target.position).normalize();
  if(previous) {
    maxStep=Math.max(maxStep,Math.abs(amb.intensity-previous.ambient));
    assert(direction.angleTo(previous.direction)<.003,'No directional-light cut across first stable Moon / orbit handoff');
  }
  previous={ambient:amb.intensity,direction};
  if(t>=113)assert(Math.abs(amb.intensity-.07)<1e-10,'First stable Moon already has final orbit illumination');
  if(t===101)assert.equal(amb.intensity,.6,'Earlier voyage illumination remains unchanged');
}
assert(maxStep<.002,'Spread brightness change through approach rather than a short change after stabilization');
seq.dispose();
console.log('Moon approach-to-orbit brightness and light-direction continuity PASS');
