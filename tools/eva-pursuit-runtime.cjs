// Actual mini-program modules under the scoped r108 runtime, with local I/O.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const T=require('../miniprogram/node_modules/threejs-miniprogram').createScopedThreejs({width:390,height:720,createImage(){return {};}});
const release=require('../miniprogram/pages/gl/moon-voyage-robot.js').release;
function load(name,imports,exported) {
  const file=path.resolve('miniprogram/pages/gl/'+name);
  const box={...imports,console,Float32Array,Int16Array,Int8Array,Uint16Array,module:{exports:{}},require:require('node:module').createRequire(file)};
  vm.runInNewContext(fs.readFileSync(file,'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'')+'\nmodule.exports={'+exported+'};',box);
  return box.module.exports;
}
const gundam=load('moon-voyage-gundam.js',{release},'VoyageGundam,buildExhaustSheet,writeExhaustSheet');
const eva=load('moon-voyage-eva.js',{release,...gundam},'VoyageEvaPursuit,EVA_PURSUIT');
const buffer=name=>{const b=fs.readFileSync('miniprogram/'+name+'/geometry.bin');return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
module.exports={T,...gundam,...eva,buffer};
