const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const T=require('../miniprogram/node_modules/threejs-miniprogram').createScopedThreejs({width:390,height:720,createImage:()=>({})});
const load=(name,names,extra={})=>{const s=fs.readFileSync('miniprogram/pages/gl/'+name+'.js','utf8').replace(/^import .*;$/gm,'').replace(/^export /gm,'');const box={module:{exports:{}},console,Promise,setTimeout,clearTimeout,...extra};vm.runInNewContext(s+'\nmodule.exports={'+names+'};',box);return box.module.exports;};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise};};
const tick=()=>new Promise(r=>setImmediate(r));
const gpu=load('moon-gpu-warmup','withMoonRenderTarget,warmMoonTextures');
function rendererFixture(){
 let target=null,face=2,mip=1,scissorTest=true;const viewport=new T.Vector4(3,4,390,720),scissor=new T.Vector4(5,6,380,710);
 const draws=[],programs=[],gl={MAX_TEXTURE_IMAGE_UNITS:1,MAX_TEXTURE_SIZE:2,LINK_STATUS:3,getParameter:k=>k===1?16:4096,getProgramParameter:()=>true};
 return {draws,info:{programs},capabilities:{maxTextureSize:2048},autoClear:false,shadowMap:{enabled:false,type:7,autoUpdate:true,needsUpdate:false},toneMappingExposure:.9,physicallyCorrectLights:false,
  getContext:()=>gl,getActiveCubeFace:()=>face,getActiveMipmapLevel:()=>mip,getRenderTarget:()=>target,
  getViewport:v=>v.copy(viewport),setViewport:v=>viewport.copy(v),getScissor:v=>v.copy(scissor),setScissor:v=>scissor.copy(v),getScissorTest:()=>scissorTest,setScissorTest:v=>{scissorTest=v;},
  setRenderTarget(t,f,l){target=t;face=f;mip=l;},getSize:v=>v.set(390,720),getDrawingBufferSize:v=>v.set(1170,2160),clear(){},
  render(scene){assert.ok(target,'warmup must never draw to the visible canvas');draws.push({target,scene,shadow:this.shadowMap.needsUpdate});},compile(){},
  snapshot(){return JSON.stringify({target:target?.uuid||null,face,mip,scissorTest,viewport:viewport.toArray(),scissor:scissor.toArray(),clear:this.autoClear,shadow:this.shadowMap,physical:this.physicallyCorrectLights,exposure:this.toneMappingExposure});}
 };
}
(async()=>{
 // Required Moon packages/music gate launch; a permanently stalled optional model does not.
 const packages=[deferred(),deferred()],audio=deferred(),optional=deferred();let optionalCalls=0,downloads=0,moons=0;
 const assets=load('moon-voyage-assets','preloadAssets',{APP_CFG:{},ensureMoonVisualPackage:()=>packages[0].promise,ensureMoonColorPackage:()=>packages[1].promise,createMoon(){moons++;},wx:{cloud:{downloadFile(o){downloads++;audio.promise.then(()=>o.success({statusCode:200,tempFilePath:'/audio'}));}}}});
 const mgr={_lifecycleToken:1,_isLifecycleCurrent:n=>n===mgr._lifecycleToken,_companionFx:{preload(){optionalCalls++;return optional.promise;}}};
 let launched=false;const first=assets.preloadAssets(mgr,{TEXTURE:'cloud://moon',AUDIO:'cloud://audio'}).then(r=>{launched=true;return r;}),second=assets.preloadAssets(mgr,{TEXTURE:'cloud://moon',AUDIO:'cloud://audio'});
 packages.forEach(p=>p.resolve());await tick();assert.equal(launched,false,'music is required');audio.resolve();assert.equal(await first,true);await second;assert.equal(moons,1);assert.equal(downloads,1);assert.equal(optionalCalls,1);assert.equal(mgr.loaded,true);
 await assets.preloadAssets(mgr,{TEXTURE:'cloud://moon',AUDIO:'cloud://audio'});assert.equal(downloads,1,'warm replay reuses required resources');
 const stale={_lifecycleToken:2,_isLifecycleCurrent:()=>false};assert.equal(await assets.preloadAssets(stale,{}),false);
 // Voyager has a bounded budget; partial and late textures are released without touching other encounters.
 const callbacks=[],timers=new Map();let next=0,otherDisposed=0;
 class Optional{preload(){return Promise.resolve();}dispose(){otherDisposed++;}reset(){}}
 const NativeLoader=T.TextureLoader;T.TextureLoader=class{load(path,done){callbacks.push(done);}};
 const encounters=load('moon-voyage-encounters','VoyageEncounters',{require:()=>({}),VoyageGundam:Optional,VoyageEvaPursuit:Optional,VoyageRobot:Optional,VoyageStarship:Optional,disposeStarFlow(){},setTimeout:(fn,ms)=>{assert.equal(ms,30000);timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id)});
 const fx=new encounters.VoyageEncounters();fx.THREE=T;fx.readBuffer=()=>new Promise(()=>{});fx.scene=new T.Scene();
 const pending=fx.preload();await tick();assert.equal(callbacks.length,4);assert.equal(timers.size,1);let freed=0;const tex=()=>{const t=new T.Texture();t.dispose=()=>freed++;return t;};callbacks[0](tex());[...timers.values()][0]();await pending;assert.equal(freed,1);assert.equal(otherDisposed,0);assert.equal(timers.size,0);callbacks.slice(1).forEach(cb=>cb(tex()));await tick();assert.equal(freed,4);assert.equal(fx.model,undefined);await fx.preload();assert.equal(callbacks.length,4,'no repeated timeout retries during the same voyage');
 fx.dispose();assert.equal(otherDisposed,4);const again=fx.preload();await tick();fx.dispose();await again;assert.equal(timers.size,0,'exit cancels the optional budget');callbacks.slice(4).forEach(cb=>cb(tex()));await tick();assert.equal(freed,8);assert.equal(fx.model,undefined);T.TextureLoader=NativeLoader;
 // Renderer state is restored even when the GPU pass throws or the generation exits between frames.
 const r=rendererFixture(),initial=r.snapshot(),target=new T.WebGLRenderTarget(16,16);
 assert.throws(()=>gpu.withMoonRenderTarget(r,target,()=>{r.shadowMap.needsUpdate=true;r.setViewport(new T.Vector4(0,0,16,16));throw Error('GPU failed');}),/GPU failed/);assert.equal(r.snapshot(),initial);target.dispose();
 const a=new T.Texture(),b=new T.Texture();let yields=0;
 await gpu.warmMoonTextures({THREE:T,renderer:r,textures:[a,a,b],isCurrent:()=>true,yieldFrame:async()=>{yields++;assert.equal(r.snapshot(),initial);}});assert.equal(yields,2);assert.equal(r.draws.length,2);
 let alive=true;await assert.rejects(gpu.warmMoonTextures({THREE:T,renderer:r,textures:[a,b],isCurrent:()=>alive,yieldFrame:async()=>{alive=false;}}),/Cancelled/);assert.equal(r.draws.length,3);assert.equal(r.snapshot(),initial);
 // Real sequence readiness includes offscreen geometry/shadow draws and the final Moon shader variant.
 const scene=new T.Scene(),body=new T.Mesh(new T.SphereBufferGeometry(1,8,6),new T.MeshStandardMaterial()),crew=new T.Mesh(new T.BoxBufferGeometry(),new T.MeshStandardMaterial());scene.add(body,crew);
 const camera=new T.PerspectiveCamera(45,390/720,.1,2000);camera.position.z=1000;camera.updateMatrixWorld();const stars=new T.Points(new T.BufferGeometry(),new T.ShaderMaterial({uniforms:{}}));scene.add(stars);const poses=[];
 const view={scene,body,camera,stars,pose(t){poses.push(t);crew.visible=t>250;},setAnchor(){}};
 let originalHookCalled=0;const moon=new T.Mesh(new T.SphereBufferGeometry(1),new T.MeshStandardMaterial({normalMap:new T.Texture()}));moon.material.onBeforeCompile=()=>originalHookCalled++;
 const mainScene=new T.Scene();mainScene.add(new T.DirectionalLight(),new T.AmbientLight());const worldCamera=new T.PerspectiveCamera(45,390/720,.1,2000);worldCamera.position.z=10;worldCamera.updateMatrixWorld();
 const mgr2={active:true,THREE:T,moonMesh:moon,scene:mainScene,camera:worldCamera};let compiledVersion;
 r.compile=()=>{assert.equal(body.material.normalMap,moon.material.normalMap);body.material.onBeforeCompile({uniforms:{},fragmentShader:''});compiledVersion=body.material.version;};
 const seqModule=load('moon-terrain-sequence','MoonTerrainSequence',{...gpu,MoonTerrainAssets:class{constructor(){this.stats={downloads:0,cacheHits:10};}load(){return Promise.resolve({});}cancel(){}},MoonKeepsake:class{prepare(){}dispose(){}},buildTerrainScene:async opts=>{opts.onScene(scene);opts.ownedTextures.add(a);return view;},ensureSceneArtPackage:()=>Promise.resolve(),TERRAIN_CONFIG:{anchor:{rigidRotation:[0,0,0,1],moonCenter:[0,0,0]}},setTimeout:fn=>{queueMicrotask(fn);}});
 const sequence=new seqModule.MoonTerrainSequence(mgr2,r);sequence.prepare();assert.equal(sequence.status,'loading');await sequence.pending;assert.equal(sequence.status,'ready');assert.equal(originalHookCalled,1);assert.deepEqual(poses,[271.7266667,193]);assert.equal(r.draws.filter(d=>d.scene===scene).length,2);assert.ok(r.draws.filter(d=>d.scene===scene).every(d=>d.shadow));assert.equal(r.snapshot(),initial);assert.equal(crew.frustumCulled,true);sequence.enter(193);assert.equal(body.material.version,compiledVersion,'193s must reuse the already warmed material');sequence.dispose();
 console.log('Moon loading: required-only launch, optional timeout/cancel/late disposal, offscreen state recovery and fully warmed readiness PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
