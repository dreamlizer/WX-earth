const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,p),'utf8'));
const d=read('output/full-playback.json');
assert.equal(d.errors.length,0);assert.equal(d.webglError,0);assert.equal(d.playback.nativeEnded,true);assert.equal(d.playback.startTime,193);assert.equal(d.playback.completed,1);assert.equal(d.playback.stalls,0);assert.ok(d.playback.frames>4500);assert.ok(Math.abs(d.audio.duration-78.726667)<1e-5);
assert.ok(d.cameraTravel255ToEnd>2.9);assert.ok(d.minLateSpeed>.1);assert.ok(d.minTerrainClearance>10);assert.ok(d.startPositionError<1e-7);assert.ok(d.startQuaternionError<1e-7);assert.ok(d.minRadiusClearance>0);assert.ok(d.minNearHeightAboveOriginalPeak>0);assert.ok(d.earthPoseErrorDegrees<.001);assert.ok(d.finalSunInEarthView[0]>.9);assert.ok(d.finalSunInEarthView[1]>.3);assert.equal(d.earthPositionUnchanged,true);assert.equal(d.starfield.count,16000);
assert.equal(d.crew.events.length,1);assert.equal(d.crew.events[0].readable,true);assert.ok(d.earthVisibilityEvents[0].time-d.crew.events[0].time>4);assert.ok(d.samples.filter(s=>s.time>=224).every(s=>s.crewReadable));assert.equal(d.earthVisibilityEvents.length,1);
const late=d.samples.filter(s=>s.time>=226);for(let i=1;i<late.length;i++)assert.ok(late[i].position[2]<late[i-1].position[2],'camera must keep advancing');
const prior=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../crew-before-earth/output/full-playback.json')));d.crew.seats.forEach((seat,i)=>assert.ok(seat.scale/prior.crew.seats[i].scale<.19));assert.ok((d.crew.seats[1].x-d.crew.seats[0].x)/d.crew.seats[0].scale<(prior.crew.seats[1].x-prior.crew.seats[0].x)/prior.crew.seats[0].scale*.8);
for(const kind of ['rei','shinji'])assert.ok(fs.readFileSync(path.join(__dirname,'assets',kind+'-seated.glb')).equals(fs.readFileSync(path.resolve(__dirname,'../crew-before-earth/assets',kind+'-seated.glb'))));assert.ok(!fs.readFileSync(path.join(__dirname,'assets/asuka-seated.glb')).equals(fs.readFileSync(path.resolve(__dirname,'../crew-before-earth/assets/asuka-seated.glb'))));
for(const kind of ['rei','shinji','asuka']){
 const b=fs.readFileSync(path.join(__dirname,'assets',kind+'-seated.glb'));assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);
 const n=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+n).toString()),bin=b.subarray(28+n);assert.equal(g.images,undefined);assert.equal(g.skins,undefined);assert.ok(g.meshes.length>=6);
 for(const m of g.meshes)for(const p of m.primitives){
  const pos=g.accessors[p.attributes.POSITION],nor=g.accessors[p.attributes.NORMAL],ind=g.accessors[p.indices];assert.ok(pos.count>100);assert.equal(pos.count,nor.count);assert.equal(ind.count%3,0);assert.ok(pos.max.every((v,i)=>v-pos.min[i]>.001));
  for(const a of [pos,nor]){const v=g.bufferViews[a.bufferView],offset=v.byteOffset||0;for(let i=0;i<a.count*3;i++)assert.ok(Number.isFinite(bin.readFloatLE(offset+i*4)));}
  const v=g.bufferViews[ind.bufferView],offset=v.byteOffset||0;for(let i=0;i<ind.count;i++)assert.ok(bin.readUInt32LE(offset+i*4)<pos.count);
 }
}
const root=path.resolve(__dirname,'../../..');for(const [p,sha]of Object.entries(read('preserved-crew-v1.json'))){assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex'),sha,p+' modified');}
console.log('PASS: full playback, crew before Earth, continuous moving end, smaller and closer crew, distinct Asuka, right sunlight, safe airborne camera, three real GLBs, prior crew preview unchanged');
