import {registerGLTFLoader} from './vendor/gltf-loader.js';
import {fixTexture} from './asset-manager.js';
import {createStarfield,applyNormalStarUniforms} from './starfield.glsl.js';
import {createGroundingFactory} from './moon-terrain-grounding.js';
import {createTerrainCameraFactory} from './moon-terrain-camera.js';
import {installTerrainDetail} from './moon-terrain-detail.js';
import {TERRAIN_CONFIG} from './moon-terrain-config.js';
const readBuffer=path=>new Promise((resolve,reject)=>wx.getFileSystemManager().readFile({filePath:path,success:r=>resolve(r.data),fail:reject}));
async function loadGLB(T,path){if(!T.GLTFLoader)registerGLTFLoader(T);const b=await readBuffer(path);return new Promise((resolve,reject)=>new T.GLTFLoader().parse(b,'',resolve,reject));}
export async function buildTerrainScene({THREE,renderer,paths,isPCClient,isCurrent,ownedTextures,yieldFrame,onScene,starSource}){
 const config=TERRAIN_CONFIG.shot,anchor=JSON.parse(JSON.stringify(TERRAIN_CONFIG.anchor));
 const {createGroundedCrew,installContactOcclusion}=createGroundingFactory(THREE);
 const {createCameraPath}=createTerrainCameraFactory(THREE);
 const loadTexture=url=>new Promise((resolve,reject)=>new THREE.TextureLoader().load(url,resolve,undefined,reject));
 const scene=new THREE.Scene();onScene(scene);scene.background=new THREE.Color(0);
 // Reuse the actual mini-program star shader, density, colors and slow twinkle.
 const stars=starSource?new THREE.Points(starSource.geometry.clone(),starSource.material.clone()):createStarfield(THREE),starScale=300;stars.scale.setScalar(starScale);stars.quaternion.fromArray(anchor.rigidRotation);stars.frustumCulled=false;stars.material.toneMapped=false;const sizes=stars.geometry.attributes.size;for(let i=0;i<sizes.count;i++)sizes.setX(i,sizes.getX(i)*starScale);sizes.needsUpdate=true;applyNormalStarUniforms(stars,{starSizeScale:1.7,starBrightnessGain:2,starBreathSpeed:.6,starBreathStrength:.25});stars.material.uniforms.uOpacity.value=.54;scene.add(stars);
 const camera=new THREE.PerspectiveCamera(45,config.width/config.height,.005,60000),center=new THREE.Vector3(...anchor.moonCenter),R=anchor.moonRadius;
 const calibration=TERRAIN_CONFIG.calibration;
 const sun=new THREE.DirectionalLight(new THREE.Color(0xfff5e9).convertSRGBToLinear(),3.3);sun.position.fromArray(calibration.sunDirection).multiplyScalar(130);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-160,right:160,top:160,bottom:-160,near:1,far:550});sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;scene.add(sun,new THREE.AmbientLight(new THREE.Color(0xadb5c8).convertSRGBToLinear(),.09));
 const loader=new THREE.TextureLoader();async function tex(url,color=false,flipY=false){const t=await loadTexture(url);t.flipY=flipY;t.encoding=color?THREE.sRGBEncoding:THREE.LinearEncoding;t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());fixTexture(t,isPCClient);ownedTextures.add(t);return t;}
 const gltf=await loadGLB(THREE,paths['terrain.glb']);
 const textures={};
 for(const [key,file,color,flip] of [['map','base-color.jpg',true,false],['normalMap','base-normal.jpg',false,false],['roughnessMap','base-rough.jpg',false,false],['aoMap','base-ao.jpg',false,false],['moonMap','/moon-color-assets/2k_moon.jpg',true,true],['earthMap','/scene-art-assets/textures/preview-day.jpg',true,true],['cloudMap','/scene-art-assets/textures/preview-cloud.png',false,true],['nearColor','near-color.jpg',true,false],['nearNormal','near-normal.jpg',false,false],['nearRough','near-rough.jpg',false,false],['nearAO','near-ao.jpg',false,false],['grain','grain.jpg',true,false]]){
  if(!isCurrent())throw Error('Cancelled terrain build');textures[key]=await tex(paths[file]||file,color,flip);await yieldFrame();
 }
 const {map,normalMap,roughnessMap,aoMap,moonMap,earthMap,cloudMap}=textures;
 for(const key of ['roughnessMap','aoMap','nearRough','nearAO','grain'])textures[key].format=THREE.LuminanceFormat;
 if(!isCurrent())throw Error('Cancelled terrain build');
 const bodyMat=new THREE.MeshStandardMaterial({map:moonMap,roughness:1,metalness:0});
 // The existing finite terrain is one fixed cap of the same spherical Moon.
 // No shot dissolve: a static edge transition joins the cap to the global body.
 bodyMat.onBeforeCompile=s=>{s.vertexShader='varying vec3 vLunarWorld;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <project_vertex>','vLunarWorld=(modelMatrix*vec4(transformed,1.)).xyz;\n#include <project_vertex>');s.fragmentShader='varying vec3 vLunarWorld;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n');};
 const body=new THREE.Mesh(new THREE.SphereBufferGeometry(R,128,64),bodyMat);body.position.copy(center);body.receiveShadow=false;scene.add(body);
 const terrain=gltf.scene;const meshes=[];
 const material=new THREE.MeshStandardMaterial({map,normalMap,normalMapType:THREE.ObjectSpaceNormalMap,roughnessMap,aoMap,aoMapIntensity:.6,roughness:1,metalness:0});
 material.onBeforeCompile=s=>{
  s.uniforms.globalMoon={value:moonMap};s.vertexShader=s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
float geometryLOD=1.-smoothstep(300.,1600.,length(cameraPosition));
float geometryEdge=smoothstep(0.,25.,100.-max(abs(sourcePosition.x),abs(sourcePosition.z)));
transformed.y=-650.+sqrt(max(1.,650.*650.-dot(sourcePosition.xz,sourcePosition.xz)))+sourcePosition.y*geometryEdge*geometryLOD+mix(-1.,.08,geometryLOD);`);s.vertexShader='attribute vec3 sourcePosition; varying vec3 vSourcePosition; varying vec3 vLunarWorld;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <project_vertex>','vSourcePosition=sourcePosition;vLunarWorld=(modelMatrix*vec4(transformed,1.)).xyz;\n#include <project_vertex>');
  s.fragmentShader='uniform sampler2D globalMoon;varying vec3 vSourcePosition;varying vec3 vLunarWorld;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   
   float capWeight=smoothstep(0.,25.,100.-max(abs(vSourcePosition.x),abs(vSourcePosition.z)))*(1.-smoothstep(300.,1600.,length(cameraPosition)));
   if(capWeight<=0.)discard;
   vec3 radial=normalize(vLunarWorld-vec3(0.,-650.,0.));
   vec2 globalUV=vec2(fract(atan(radial.z,-radial.x)/6.28318530718+1.),asin(clamp(radial.y,-1.,1.))/3.14159265359+.5);
   vec3 baseColor=mapTexelToLinear(texture2D(globalMoon,globalUV)).rgb;
   diffuseColor.rgb=mix(baseColor,diffuseColor.rgb,capWeight);`);
  // The shadow map stores the full relief; reveal self-shadow only once geometry LOD is complete.
  s.fragmentShader=s.fragmentShader.replace('#include <lights_fragment_begin>',THREE.ShaderChunk.lights_fragment_begin.replace(/getShadow\( directionalShadowMap[^)]*\)/g,match=>'mix(1.,'+match+',smoothstep(.97,1.,1.-smoothstep(300.,1600.,length(cameraPosition))))'));
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec3 localNormal=texture2D(normalMap,vUv).xyz*2.-1.;
   float rootY=sqrt(max(1.,650.*650.-dot(vSourcePosition.xz,vSourcePosition.xz)));
   vec3 tx=normalize(vec3(1.,-vSourcePosition.x/rootY,0.));
   vec3 tz=normalize(vec3(0.,-vSourcePosition.z/rootY,1.));
   vec3 capNormal=normalize(tx*localNormal.x+radial*localNormal.y+tz*localNormal.z);
   normal=normalize(normalMatrix*mix(radial,capNormal,capWeight));`);
 };
 terrain.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,pos=g.attributes.position,source=new Float32Array(pos.count*3);for(let i=0;i<pos.count;i++){const x=pos.getX(i)*100,y=pos.getY(i)*100,z=pos.getZ(i)*100;source.set([x,y,z],i*3);const edge=THREE.Math.smoothstep(100-Math.max(Math.abs(x),Math.abs(z)),0,25);const sphereY=-R+Math.sqrt(Math.max(1,R*R-x*x-z*z));pos.setXYZ(i,x,sphereY+y*edge+.08,z);}g.addAttribute('sourcePosition',new THREE.BufferAttribute(source,3));g.addAttribute('uv2',g.attributes.uv);pos.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();g.computeBoundingBox();o.material=material;o.castShadow=true;o.receiveShadow=true;meshes.push(o);});scene.add(terrain);
 material.extensions={derivatives:true};
 const detail=installTerrainDetail(material,{textures,THREE,meta:TERRAIN_CONFIG.crop});
 const refinedCrew=createGroundedCrew(terrain,config.crewLayout);scene.add(refinedCrew);const contactAO=installContactOcclusion(material,refinedCrew.userData.contacts);
 // A second, zero-radiance shadow camera resolves normal-sized people; sunlight still comes from the single global sun.
 const localShadowSun=new THREE.DirectionalLight(0xffffff,0);const localTarget=new THREE.Object3D();localTarget.position.fromArray(config.crewLayout.center);scene.add(localTarget);localShadowSun.target=localTarget;localShadowSun.position.copy(localTarget.position).addScaledVector(new THREE.Vector3(...calibration.sunDirection),5);localShadowSun.castShadow=true;localShadowSun.shadow.mapSize.set(2048,2048);Object.assign(localShadowSun.shadow.camera,{left:-.28,right:.28,top:.28,bottom:-.28,near:.001,far:10});localShadowSun.shadow.bias=-.000005;localShadowSun.shadow.normalBias=.00007;scene.add(localShadowSun);
 const localContactShadow=`
#if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 1
 {float crewShadow=getShadow(directionalShadowMap[1],directionalLights[1].shadowMapSize,directionalLights[1].shadowBias,directionalLights[1].shadowRadius,vDirectionalShadowCoord[1]);reflectedLight.directDiffuse*=crewShadow;reflectedLight.directSpecular*=crewShadow;}
#endif
 `;
 function attachContactShadow(mat){const original=mat.onBeforeCompile;mat.onBeforeCompile=function(shader,...args){original.call(this,shader,...args);shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>'+localContactShadow);};}
 attachContactShadow(material);const crewMaterials=new Set();refinedCrew.traverse(o=>{if(o.isMesh)crewMaterials.add(o.material)});crewMaterials.forEach(attachContactShadow);

 const earth=new THREE.Mesh(new THREE.SphereBufferGeometry(anchor.earthRadius,80,64),new THREE.MeshLambertMaterial({map:earthMap}));earth.position.fromArray(anchor.earthPosition);scene.add(earth);
 const clouds=new THREE.Mesh(new THREE.SphereBufferGeometry(anchor.earthRadius*1.008,64,48),new THREE.MeshLambertMaterial({color:0xffffff,alphaMap:cloudMap,transparent:true,opacity:calibration.cloudOpacity,depthWrite:false}));earth.add(clouds);
 let path=createCameraPath(anchor,config.crewLayout);let t=config.start;
 function pose(time){t=time;const p=path.at(time);camera.position.copy(p.position);camera.up.copy(p.up);camera.fov=p.fov;camera.quaternion.copy(p.quaternion);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);const crewVisible=camera.position.length()<900;if(refinedCrew.visible!==crewVisible){refinedCrew.visible=crewVisible;renderer.shadowMap.needsUpdate=true;}stars.position.copy(camera.position);stars.material.uniforms.time.value=time;earth.quaternion.fromArray(calibration.earthQuaternionAtReference);earth.rotateY((time-calibration.referenceTime)*calibration.earthAngularSpeed);clouds.rotation.y=(time-261)*calibration.cloudAngularSpeed;scene.updateMatrixWorld(true);}
 function render(time){pose(time);renderer.render(scene,camera);}
 pose(config.start);

 return {scene,camera,terrain,body,earth,refinedCrew,stars,sun,ambient:scene.children.find(o=>o.isAmbientLight),anchor,
  pose,render,time:()=>t,contacts:refinedCrew.userData.contacts,
  setAnchor(next){Object.assign(anchor,next);path=createCameraPath(anchor,config.crewLayout);},
  rebuildPath(){return createCameraPath(anchor,config.crewLayout);}
 };
}
