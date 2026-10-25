const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const load=(file,exports,extra={})=>{const box={module:{exports:{}},console,Promise,Map,Set,setTimeout,clearTimeout,...extra};const s=fs.readFileSync('miniprogram/pages/gl/'+file+'.js','utf8').replace(/^import .*;$/gm,'').replace(/^export /gm,'');vm.runInNewContext(s+'\nmodule.exports={'+exports+'};',box);return box.module.exports;};
const {moonPlaybackTime}=load('moon-playback-clock','moonPlaybackTime');
const mgr={audioContext:{currentTime:0},_speedMult:1,_moonAudioWaiting:false};
let previous=0,maxError=0;
for(let now=0;now<=272000;now+=16){mgr.audioContext.currentTime=Math.floor(now/200)*.2;const value=moonPlaybackTime(mgr,now);assert.ok(value>=previous-1e-8,'camera must advance between native samples');maxError=Math.max(maxError,Math.abs(value-now/1000));previous=value;}
assert.ok(maxError<.22);
mgr._moonAudioWaiting=true;const stopped=moonPlaybackTime(mgr,272016);assert.equal(moonPlaybackTime(mgr,282016),stopped,'waiting must not accumulate timeline time');
mgr._moonAudioWaiting=false;mgr.audioContext.currentTime=290;assert.ok(Math.abs(moonPlaybackTime(mgr,290000)-290)<.01,'foreground catches up to the actual song');
mgr._speedMult=10;assert.equal(moonPlaybackTime(mgr,290016),null,'debug speed remains separate from native audio');

const {MoonTerrainSequence}=load('moon-terrain-sequence','MoonTerrainSequence');
const shared={shadowMap:{enabled:false,type:7,autoUpdate:true},toneMappingExposure:.9,physicallyCorrectLights:false};
const tail=new MoonTerrainSequence({THREE:{PCFSoftShadowMap:2}},shared);
assert.throws(()=>tail.withRenderer(()=>{assert.equal(shared.physicallyCorrectLights,true);assert.equal(shared.shadowMap.enabled,true);throw Error('render failure');}),/render failure/);
assert.equal(shared.physicallyCorrectLights,false,'normal/zen rendering must recover even if the tail render fails');assert.equal(shared.toneMappingExposure,.9);assert.equal(shared.shadowMap.enabled,false);assert.equal(shared.shadowMap.type,7);assert.equal(shared.shadowMap.autoUpdate,true);
tail.status='loading';assert.equal(tail.select(179),undefined);assert.equal(tail.select(180),false);tail.status='ready';assert.equal(tail.select(193),false,'late resources must never swap the chosen original tail');
const ready=new MoonTerrainSequence({},{});ready.status='ready';assert.equal(ready.select(180),false);assert.equal(ready.select(193),true);

const manifest={version:'0000000000000001',cloudRoot:'cloud://fixture/',files:[{name:'terrain.glb',bytes:3,md5:'valid'},{name:'color.jpg',bytes:2,md5:'valid'}]};
const store=new Map();let network=0,cancelled=0;
const fsMock={mkdir:o=>o.success({}),accessSync(){},getFileInfo:o=>{const b=store.get(o.filePath);b?o.success({size:b.size,digest:b.digest}):o.fail(Error('missing'));},copyFile:o=>{store.set(o.destPath,store.get(o.srcPath));o.success({});},rename:o=>{store.set(o.newPath,store.get(o.oldPath));store.delete(o.oldPath);o.success({});},writeFile:o=>o.success({}),readdirSync:()=>[],unlinkSync:p=>store.delete(p)};
const wx={env:{USER_DATA_PATH:'/fixture'},getFileSystemManager:()=>fsMock,cloud:{getTempFileURL:async({fileList})=>({fileList:fileList.map(fileID=>({fileID,status:0,tempFileURL:fileID}))})},downloadFile:o=>{network++;const row=manifest.files.find(x=>o.url.endsWith(x.name));const p='/temporary/'+row.name;store.set(p,{size:row.bytes,digest:'valid'});queueMicrotask(()=>o.success({statusCode:200,tempFilePath:p}));return{abort(){cancelled++;o.fail(Error('cancelled'));}};}};
const {MoonTerrainAssets}=load('moon-terrain-assets','MoonTerrainAssets',{wx,TERRAIN_MANIFEST:manifest});
(async()=>{
 const cold=new MoonTerrainAssets();const paths=await cold.load();assert.equal(network,2);assert.equal(cold.stats.downloads,2);assert.equal(cold.tasks.size,0);
 const warm=new MoonTerrainAssets();await warm.load();assert.equal(network,2,'valid cache must not redownload');assert.equal(warm.stats.cacheHits,2);
 store.set(paths['color.jpg'],{size:2,digest:'bad'});const broken=new MoonTerrainAssets();await broken.load();assert.equal(network,3,'a checksum mismatch refetches only the bad file');
 store.clear();let nativeDownloads=0;wx.downloadFile=o=>{queueMicrotask(()=>o.fail({errMsg:'url not in domain list'}));return{abort(){}};};wx.cloud.downloadFile=o=>{nativeDownloads++;const row=manifest.files.find(x=>o.fileID.endsWith(x.name)),p='/native/'+row.name;store.set(p,{size:row.bytes,digest:'valid'});queueMicrotask(()=>o.success({statusCode:200,tempFilePath:p}));return{abort(){o.fail(Error('aborted'));}};};
 await new MoonTerrainAssets().load();assert.equal(nativeDownloads,2,'native CloudBase download handles a rejected temporary CDN domain');
 store.clear();let started;wx.downloadFile=o=>{started?.();return{abort(){cancelled++;o.fail(Error('aborted'));}};};const pending=new MoonTerrainAssets();const launched=new Promise(resolve=>{started=resolve;});const promise=pending.load();await launched;pending.cancel();await assert.rejects(promise);assert.ok(cancelled>=1);assert.equal(pending.tasks.size,0);
 console.log('Moon tail: native music clock, foreground/waiting, cold/warm cache, checksum repair, and real task cancellation PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
