import {MoonTerrainAssets} from './moon-terrain-assets.js';
import {buildTerrainScene} from './moon-terrain-scene.js';
import {ensureSceneArtPackage} from './scene-art-loader.js';
import {TERRAIN_CONFIG} from './moon-terrain-config.js';
import {moonPlaybackTime} from './moon-playback-clock.js';
import {MoonKeepsake} from './moon-keepsake.js';

const smooth=(a,b,t)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u);};
// Match the accepted r160 ACES fit locally; r108 uses a different scalar approximation.
const lunarToneMapping=`
vec3 lunarACES(vec3 color,float exposure){
 const mat3 inputMat=mat3(vec3(.59719,.07600,.02840),vec3(.35458,.90834,.13383),vec3(.04823,.01566,.83777));
 const mat3 outputMat=mat3(vec3(1.60475,-.10208,-.00327),vec3(-.53108,1.10813,-.07276),vec3(-.07367,-.00605,1.07602));
 color=inputMat*(color*exposure/.6);
 color=(color*(color+.0245786)-.000090537)/(color*(.983729*color+.4329510)+.238081);
 return clamp(outputMat*color,0.,1.);
}
`;

// A separate scene shares the existing renderer. Main Earth objects/materials stay owned by the app.
export class MoonTerrainSequence {
  constructor(mgr,renderer) { this.mgr=mgr;this.renderer=renderer;this.generation=0;this.status='idle'; }
  prepare() {
    if(this.pending||this.status==='ready')return;
    this.dispose();const generation=this.generation,mgr=this.mgr,renderer=this.renderer;
    if(!renderer){this.status='unavailable';return;}
    const gl=renderer.getContext();this.capabilities={samplers:gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE)};
    if(this.capabilities.samplers<12||this.capabilities.maxTextureSize<2048){this.status='unsupported';return;}
    this.status='loading';this.startedAt=Date.now();this.assets=new MoonTerrainAssets();
    this.keepsake=new MoonKeepsake(mgr,renderer);this.keepsake.prepare();
    const build={textures:new Set(),scene:null};this.build=build;
    const current=()=>generation===this.generation&&mgr.active;
    this.pending=Promise.all([this.assets.load(),ensureSceneArtPackage()]).then(async([paths])=>{
      if(!current())return;
      const view=await buildTerrainScene({THREE:mgr.THREE,renderer,paths,isPCClient:mgr._isPCClient,isCurrent:current,ownedTextures:build.textures,starSource:mgr._mainStarfieldMesh,
        onScene:scene=>{build.scene=scene;},yieldFrame:()=>new Promise(resolve=>setTimeout(resolve,16))});
      if(!current())return;
      this.view=view;
      // r108's shared renderer is linear. Match the reviewed sRGB output within this scene only.
      this.outputMix={value:1};const materials=new Set();view.scene.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))materials.add(m);});
      for(const mat of materials){const previous=mat.onBeforeCompile;if(renderer.outputEncoding===mgr.THREE.sRGBEncoding)mat.defines={...mat.defines,TAIL_NATIVE_SRGB:1};mat.onBeforeCompile=(shader,...args)=>{previous.call(mat,shader,...args);shader.uniforms.tailOutputMix=this.outputMix;shader.fragmentShader='uniform float tailOutputMix;\n'+lunarToneMapping+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>','#if defined(TONE_MAPPING)\n gl_FragColor.rgb=mix(toneMapping(gl_FragColor.rgb),lunarACES(gl_FragColor.rgb,toneMappingExposure),tailOutputMix);\n#endif');shader.fragmentShader=shader.fragmentShader.replace('#include <encodings_fragment>','#include <encodings_fragment>\n#ifndef TAIL_NATIVE_SRGB\n gl_FragColor.rgb=mix(gl_FragColor.rgb,LinearTosRGB(gl_FragColor).rgb,tailOutputMix);\n#endif');};mat.needsUpdate=true;}
      const existingPrograms=new Set(renderer.info.programs);
      this.withRenderer(()=>{renderer.compile(view.scene,view.camera);});
      if(renderer.info.programs.some(program=>!existingPrograms.has(program)&&program.program&&!gl.getProgramParameter(program.program,gl.LINK_STATUS)))throw Error('Terrain shader failed to link');
      this.status='ready';this.readyMs=Date.now()-this.startedAt;
      console.log('[Moon terrain] Ready', {milliseconds:this.readyMs,downloads:this.assets.stats.downloads,cacheHits:this.assets.stats.cacheHits});
    }).catch(error=>{if(current()){this.status='failed';this.error=String(error?.message||error);this.releaseScene(build);console.warn('[Moon terrain] Keeping original tail:',this.error);}}).finally(()=>{if(generation===this.generation)this.pending=null;else this.releaseScene(build);});
  }
  select(time) {
    if(time>=180&&this.selected===undefined){this.selected=this.status==='ready';if(!this.selected)console.log('[Moon terrain] Original tail selected',this.status);}
    return this.selected&&time>=193;
  }
  enter(time) {
    if(this.active||!this.view)return;const mgr=this.mgr,T=mgr.THREE,v=this.view;
    this.active=true;this.entryTime=time;this.before={fov:mgr.camera.fov,near:mgr.camera.near,far:mgr.camera.far};
    const rigid=new T.Quaternion().fromArray(TERRAIN_CONFIG.anchor.rigidRotation),center=new T.Vector3().fromArray(TERRAIN_CONFIG.anchor.moonCenter);
    const moonWorld=mgr.moonMesh.getWorldPosition(new T.Vector3()),radius=mgr.moonMesh.getWorldScale(new T.Vector3()).x;
    const position=mgr.camera.position.clone().sub(moonWorld).multiplyScalar(650/radius).applyQuaternion(rigid).add(center);
    const quaternion=rigid.clone().multiply(mgr.camera.quaternion);
    v.setAnchor({position:position.toArray(),quaternion:quaternion.toArray()});
    this.entryPosition=position;this.entryQuaternion=quaternion;
    const source=mgr._mainStarfieldMesh;
    this.starEntry={};
    if(source){this.starEntryOffset=source.getWorldPosition(new T.Vector3()).sub(mgr.camera.position).multiplyScalar(300).applyQuaternion(rigid);v.stars.quaternion.copy(rigid).multiply(source.getWorldQuaternion(new T.Quaternion()));for(const [name,u] of Object.entries(source.material.uniforms))if(typeof u.value==='number'&&v.stars.material.uniforms[name])this.starEntry[name]=u.value;}
    v.camera.aspect=mgr.camera.aspect;v.pose(193);
    const originalNDC=moonWorld.clone().project(mgr.camera),tailNDC=center.clone().project(v.camera);
    this.handoff={time,moonCenterNDCError:Math.hypot(originalNDC.x-tailNDC.x,originalNDC.y-tailNDC.y),originalNDC:originalNDC.toArray(),tailNDC:tailNDC.toArray()};
    const oldLight=mgr.scene.children.find(o=>o.isDirectionalLight),oldAmbient=mgr.scene.children.find(o=>o.isAmbientLight);
    this.initialSun=oldLight.position.clone().sub(oldLight.target.position).normalize().applyQuaternion(rigid);
    const legacyGain=this.renderer.physicallyCorrectLights?1:Math.PI;
    this.initialSunIntensity=oldLight.intensity*legacyGain;this.initialAmbient=(oldAmbient?.intensity||.07)*legacyGain;this.initialSunColor=oldLight.color.clone();this.initialAmbientColor=oldAmbient?.color.clone()||new T.Color(1,1,1);
    this.initialMoonRotation=rigid.clone().multiply(mgr.moonMesh.quaternion);
    v.body.material.color.copy(mgr.moonMesh.material.color);v.body.material.normalMap=mgr.moonMesh.material.normalMap;
    v.body.material.normalScale.copy(mgr.moonMesh.material.normalScale);
    const compiled=v.body.material.onBeforeCompile,originalMoon=mgr.moonMesh.material.onBeforeCompile;
    v.body.material.onBeforeCompile=(shader,...args)=>{compiled.call(v.body.material,shader,...args);originalMoon.call(mgr.moonMesh.material,shader,...args);};
    v.body.material.needsUpdate=true;
    console.log('[Moon terrain] Handoff',this.handoff);
  }
  pose(time) {
    const v=this.view,T=this.mgr.THREE;v.camera.aspect=this.mgr.camera.aspect;v.pose(time);
    const k=smooth(193,205,time);
    v.sun.position.copy(this.initialSun.clone().lerp(new T.Vector3().fromArray(TERRAIN_CONFIG.calibration.sunDirection),k).normalize()).multiplyScalar(130);
    v.sun.color.copy(this.initialSunColor).lerp(new T.Color(0xfff5e9).convertSRGBToLinear(),k);
    v.ambient.color.copy(this.initialAmbientColor).lerp(new T.Color(0xadb5c8).convertSRGBToLinear(),k);
    if(this.starEntryOffset)v.stars.position.addScaledVector(this.starEntryOffset,1-k);
    v.sun.intensity=this.initialSunIntensity+(3.3-this.initialSunIntensity)*k;
    v.ambient.intensity=this.initialAmbient+(.09-this.initialAmbient)*k;
    v.body.quaternion.copy(this.initialMoonRotation).slerp(new T.Quaternion(),k);
    v.body.material.normalScale.copy(this.mgr.moonMesh.material.normalScale).multiplyScalar(1-k);
    for(const [name,target] of Object.entries({uOpacity:.54,uSizeScale:1.7,uBrightnessGain:2,uBreathSpeed:.6,uBreathStrength:.25})){
      const u=v.stars.material.uniforms[name];if(u)u.value=(this.starEntry[name]??target)+(target-(this.starEntry[name]??target))*k;
    }
    if(this.starEntry.time!==undefined)v.stars.material.uniforms.time.value=this.starEntry.time+(time-193);
    this.outputMix.value=k;
    this.time=time;
  }
  withRenderer(fn) {
    const r=this.renderer,T=this.mgr.THREE;
    const before={enabled:r.shadowMap.enabled,type:r.shadowMap.type,auto:r.shadowMap.autoUpdate,exposure:r.toneMappingExposure,physical:r.physicallyCorrectLights};
    try{r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;r.shadowMap.autoUpdate=false;r.physicallyCorrectLights=true;r.toneMappingExposure=before.exposure+(1.35-before.exposure)*smooth(193,205,this.time||193);return fn();}
    finally{r.shadowMap.enabled=before.enabled;r.shadowMap.type=before.type;r.shadowMap.autoUpdate=before.auto;r.toneMappingExposure=before.exposure;r.physicallyCorrectLights=before.physical;}
  }
  render(time) {
    if(!this.active||!this.view)return false;
    time=moonPlaybackTime(this.mgr)??time;
    this.pose(time);this.withRenderer(()=>{
      const world=()=>this.renderer.render(this.view.scene,this.view.camera);
      if(!this.keepsake?.render(time,world))world();
    });return true;
  }
  releaseScene(build=this.build) {
    if(!build)return;const geometries=new Set(),materials=new Set();build.scene?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [].concat(o.material))materials.add(m);if(o.shadow?.map)o.shadow.map.dispose();});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());build.textures.forEach(t=>t.dispose());build.textures.clear();build.scene=null;
    if(this.build===build){this.build=null;this.view=null;}
  }
  dispose() {
    this.keepsake?.dispose();this.keepsake=null;
    ++this.generation;this.assets?.cancel();this.active=false;this.selected=undefined;this.status='idle';
    // A still-building generation owns its scene until its promise settles.
    if(!this.pending)this.releaseScene();this.pending=null;
  }
}
