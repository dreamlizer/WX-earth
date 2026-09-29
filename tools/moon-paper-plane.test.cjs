const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {createScopedThreejs}=require('../miniprogram/node_modules/threejs-miniprogram');
const T=createScopedThreejs({width:390,height:720,createImage(){return {}}});
const path=require('path');
const effectPath=path.resolve(__dirname,'../miniprogram/pages/gl/moon-voyage-paper-plane.js');
const localRequire=require('module').createRequire(effectPath);
const box={require:id=>{assert.ok(id.endsWith('.js'),'WeChat runtime geometry must be a JS module, not a JSON require');return localRequire(id);},module:{exports:{}}};
assert.deepStrictEqual(localRequire('../../assets/models/paper-airplane.js'),JSON.parse(fs.readFileSync(path.resolve(__dirname,'../miniprogram/assets/models/paper-airplane.json'))),'runtime geometry matches source');
vm.runInNewContext(fs.readFileSync('miniprogram/pages/gl/moon-voyage-paper-plane.js','utf8').replace('export class','class')+'\nmodule.exports=PaperPlaneEffect',box);
const Fx=box.module.exports,fx=new Fx(),scene=new T.Scene(),camera=new T.PerspectiveCamera(45,390/720,.1,100);camera.position.set(0,0,5);camera.rotation.y=.85;fx.setContext({THREE:T,scene,camera});
const cp=camera.position.clone(),cq=camera.quaternion.clone();
fx.update({t:39,node1Time:38});assert(!fx.mesh);
for(let t=40;t<76;t+=.1){fx.update({t,node1Time:38});assert(camera.position.equals(cp));assert(camera.quaternion.equals(cq));assert(fx.mesh.position.toArray().every(Number.isFinite));}
fx.update({t:58,node1Time:38});const pos=fx.mesh.position.clone();fx.update({t:45,node1Time:38});fx.update({t:58,node1Time:38});assert(fx.mesh.position.equals(pos),'seek deterministic');
fx.update({t:78,node1Time:38});assert(!fx.mesh.visible,'gone before Moon');
let released=0;fx.mesh.geometry.addEventListener('dispose',()=>released++);fx.reset();fx.dispose();assert.equal(released,1);assert.equal(scene.children.length,0);fx.update({t:58,node1Time:38});assert(fx.mesh.visible);fx.dispose();console.log('paper plane lifecycle and timing PASS');
