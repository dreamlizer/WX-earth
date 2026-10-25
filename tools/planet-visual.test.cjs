const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const T = require('../miniprogram/node_modules/threejs-miniprogram').createScopedThreejs({ width: 390, height: 720, createImage() { return {}; } });
const root = 'miniprogram/pages/gl/';
const materialBox = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(root + 'planet-materials.js', 'utf8').replace(/export /g, '') + '\nmodule.exports={createEarthLook,PLANET_PARAMS};', materialBox);
const { createEarthLook, PLANET_PARAMS } = materialBox.module.exports;
const texture = () => { const t = new T.Texture({width:2048,height:1024}); return t; };
const textures = Object.fromEntries(['day','night','cloud','mask','terrainNormal'].map(k => [k, texture()]));
const earth = new T.Mesh(new T.SphereGeometry(1,48,48), new T.MeshPhongMaterial());
const cloud = new T.Mesh(new T.SphereGeometry(1.012,64,64), new T.MeshPhongMaterial());
const globe = new T.Group(); globe.add(earth,cloud);
const geometry = earth.geometry;
const look = createEarthLook(T,textures,{earthMesh:earth,cloudMesh:cloud}); globe.add(look.group);
assert.equal(look.earth,earth,'Preserve the object used by picking and voyage backups');
assert.equal(earth.geometry,geometry);
assert.equal(earth.parent,globe);
assert.equal(cloud.parent,globe);
assert.equal(earth.material.transparent,false,'Earth surface remains opaque');
assert.equal(earth.material.depthWrite,true,'Surface occludes rear borders and stars');
assert(Math.abs(cloud.scale.x*1.012-PLANET_PARAMS.cloudRadius)<1e-12);
cloud.visible=false;look.sync(new T.Vector3(1,0,0),.5);
assert.equal(earth.material.uniforms.uCloudEnabled.value,0);
cloud.visible=true;look.sync(new T.Vector3(0,0,1),.75);
assert.equal(earth.material.uniforms.uCloudEnabled.value,1);
assert.equal(earth.material.uniforms.uCloudRotation.value,-.75/(2*Math.PI));
look.setTheme('night');assert.equal(earth.material.uniforms.uPureNight.value,1);
look.setTheme('default');assert.equal(earth.material.uniforms.uPureNight.value,0);
look.setBrightness(1.5);assert.equal(earth.material.uniforms.uBrightness.value,1.5);
// The production Earth keeps original color maps, with terrain relief only.
const normalBox={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(root+'earth-land-normal.js','utf8').replace(/export /g,'')+'\nmodule.exports={applyLandNormal};',normalBox);
const applyLandNormal=normalBox.module.exports.applyLandNormal;
const terrain={normal:texture(),mask:texture(),strength:2};
const originalMap=texture(),pureMap=texture(),nightMap=texture();
const native=new T.MeshPhongMaterial({map:originalMap,shininess:8});
applyLandNormal(T,native,terrain);
assert.equal(native.map,originalMap);assert.equal(native.shininess,8);
assert.equal(native.normalMap,terrain.normal);
const phongShader={uniforms:{},fragmentShader:'#include <normal_fragment_maps>'};
native.onBeforeCompile(phongShader);assert.equal(phongShader.uniforms.uLandMask.value,terrain.mask);
assert(phongShader.fragmentShader.includes('mix(smoothNormal, normal, land)'));
const themeBox={module:{exports:{}},applyLandNormal};
vm.runInNewContext(fs.readFileSync(root+'theme-manager.js','utf8').replace(/^import .*;$/gm,'').replace(/export /g,'')+'\nmodule.exports={applyTheme};',themeBox);
const prodEarth=new T.Mesh(geometry,native);prodEarth.userData.landNormal=terrain;
for(const [kind,expected] of [['default',originalMap],['day8k',pureMap],['night',nightMap],['default',originalMap]]){
 themeBox.module.exports.applyTheme({THREE:T,earthMesh:prodEarth,earthDayTex:originalMap,earthPureDayTex:pureMap,earthNightTex:nightMap,kind});
 assert.equal(prodEarth.material.map,expected,'Preserve distinct default/day/night maps');
 assert.equal(prodEarth.material.normalMap,kind==='night'?null:terrain.normal);
}
const zenBox={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(root+'shaders/dayNightMix.glsl.js','utf8').replace(/export /g,'')+'\nmodule.exports={createDayNightMaterial};',zenBox);
for(const simple of [false,true]){
 const zen=zenBox.module.exports.createDayNightMaterial(T,originalMap,nightMap,.18,1,.85,1,1,1,simple);
 applyLandNormal(T,zen,terrain);assert.equal(zen.uniforms.uDayTex.value,originalMap);
 assert(zen.fragmentShader.includes('float d = dot(N, L)'),'Keep the geometric terminator');
 assert(!zen.fragmentShader.includes('uLandNormal'),'Zen shaders contain no terrain normal map');
 const before=zen.fragmentShader;applyLandNormal(T,zen,terrain);assert.equal(zen.fragmentShader,before,'Do not append the patch repeatedly');
}
themeBox.module.exports.applyTheme({THREE:T,earthMesh:prodEarth,earthDayTex:originalMap,kind:'default',zenActive:true});
assert.equal(native.normalMap,null,'Zen Phong fallback also disables land normal');
themeBox.module.exports.applyTheme({THREE:T,earthMesh:prodEarth,earthDayTex:originalMap,kind:'default',zenActive:false});
assert.equal(native.normalMap,terrain.normal,'Ordinary daytime restores terrain relief');
// The runtime Moon must wait for both local maps and ignore late completion.
let callbacks=[];
class Loader { load(path,ok,progress,error) { const t=texture();callbacks.push({t,ok,error});return t; } }
const moonBox={ module:{exports:{}},APP_CFG:{},fixTexture(){},PLANET_PARAMS,console };
vm.runInNewContext(fs.readFileSync(root+'moon-voyage-scene-setup.js','utf8').replace(/^import .*;$/gm,'').replace(/export /g,'')+'\nmodule.exports={createMoon};',moonBox);
const TT=Object.assign({},T,{TextureLoader:Loader}),scene=new T.Scene();
const mgr={texPath:'color',normPath:'normal',_lifecycleToken:1,_isLifecycleCurrent:t=>t===mgr._lifecycleToken};
moonBox.module.exports.createMoon(TT,scene,mgr);
callbacks[0].ok(callbacks[0].t);assert.equal(mgr._moonTexReady,false);
callbacks[1].ok(callbacks[1].t);assert.equal(mgr._moonTexReady,true);
const moonMaterial=mgr.moonMesh.material;
assert.equal(moonMaterial.normalMap,callbacks[1].t,'Only add the terrain normal map to the original Moon');
assert.equal(moonMaterial.normalScale.x,1,'Preserve crater relief strength');
assert.equal(moonMaterial.map.encoding,T.sRGBEncoding,'Keep the original color texture decoding');
assert.equal(moonMaterial.normalMap.encoding,T.LinearEncoding,'Keep normals as linear data');
assert.equal(moonMaterial.roughness,.9,'Restore the pre-integration Moon roughness');
assert.equal(moonMaterial.color.getHex(),0xdddddd,'Restore the pre-integration Moon color');
const shader={uniforms:{},fragmentShader:T.ShaderChunk.meshphysical_frag};
moonMaterial.onBeforeCompile(shader);
assert(shader.fragmentShader.includes('dot(geometryNormal, directionalLights[0].direction)'),
  'Use the sphere normal saved before terrain normal perturbation for the terminator');
assert(shader.fragmentShader.includes('reflectedLight.directDiffuse *= moonDaylight'),
  'Crater normals must not illuminate the geometric night side');
assert(shader.fragmentShader.includes('#include <encodings_fragment>'),
  'Keep native output encoding');
assert(!shader.fragmentShader.includes('LinearTosRGB( gl_FragColor )'),
  'Do not reintroduce the old Moon-only output brightening');
assert.deepEqual(shader.uniforms,{});
const preloadSource=fs.readFileSync(root+'moon-voyage-assets.js','utf8');
assert(preloadSource.includes("'/moon-color-assets/2k_moon.jpg'"),'Use the original color map, not the NASA replacement');
assert(fs.readFileSync('miniprogram/moon-color-assets/2k_moon.jpg').equals(fs.readFileSync('2k_moon.jpg')),'Packaged original color map must match the preserved source exactly');
const appConfig=JSON.parse(fs.readFileSync('miniprogram/app.json','utf8'));
const packageBytes=dir=>fs.readdirSync(dir,{withFileTypes:true}).reduce((sum,entry)=>sum+(entry.isDirectory()?packageBytes(dir+'/'+entry.name):fs.statSync(dir+'/'+entry.name).size),0);
for(const name of ['moon-look-assets','moon-color-assets']){
  assert(appConfig.subpackages.some(p=>p.root===name&&p.name===name),'Register each Moon texture package');
  assert(packageBytes('miniprogram/'+name)<2048*1024,name+' must remain below the upload limit');
}
callbacks=[];
const late={texPath:'color',normPath:'normal',_lifecycleToken:1,_isLifecycleCurrent:t=>t===late._lifecycleToken};
moonBox.module.exports.createMoon(TT,scene,late);late._lifecycleToken++;
let disposed=0;callbacks.forEach(c=>{c.t.addEventListener('dispose',()=>disposed++);c.ok(c.t);});
assert.equal(disposed,2);assert.equal(late._moonTexReady,false);
console.log('Planet visual: retained Earth object, opaque depth, themes/clouds/brightness, original Moon appearance with terrain normals only PASS');
