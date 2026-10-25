import * as THREE from 'three';
import {GLTFLoader} from '/mech-encounter-candidates/preview/vendor/loaders/GLTFLoader.js';
const $=s=>document.querySelector(s);
let playing=false,time=0,anchorTime=0,anchorWall=0,raf=0;
const playback={completed:0,samples:[],gaps:[]};
window.addEventListener('error',e=>{$('#status').textContent='运行错误：'+e.message});
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#render'),antialias:true,preserveDrawingBuffer:true});
renderer.setSize(540,960,false);renderer.setPixelRatio(1);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0);
const sun=new THREE.DirectionalLight(0xfff5e9,3.3);sun.position.set(-110,48,35);sun.castShadow=true;
sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-145,right:145,top:145,bottom:-145,near:1,far:350});sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;
scene.add(sun,new THREE.AmbientLight(0xadb5c8,.09));
const loader=new THREE.TextureLoader();
async function texture(url,color=false){const t=await loader.loadAsync(url);t.flipY=false;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
try{
 const config=await fetch('./shot-config.json').then(r=>{if(!r.ok)throw Error('配置加载失败');return r.json()});
 const base='../preview/assets/';
 const [gltf,map,normalMap,roughnessMap,aoMap,earthMap]=await Promise.all([new GLTFLoader().loadAsync(base+'terrain.glb'),texture(base+'albedo.jpg',true),texture('../airborne-comparison/assets/normal-object.jpg'),texture(base+'roughness.jpg'),texture(base+'ao.jpg'),loader.loadAsync('/earth.jpg')]);
 const terrain=gltf.scene;terrain.scale.setScalar(100);scene.add(terrain);
 const material=new THREE.MeshStandardMaterial({map,normalMap,normalMapType:THREE.ObjectSpaceNormalMap,roughnessMap,aoMap,aoMapIntensity:.6,roughness:1,metalness:0});
 terrain.traverse(o=>{if(o.isMesh){o.material=material;o.castShadow=true;o.receiveShadow=true;o.geometry.setAttribute('uv1',o.geometry.attributes.uv);}});
 earthMap.colorSpace=THREE.SRGBColorSpace;
 const earth=new THREE.Mesh(new THREE.SphereGeometry(16,64,48),new THREE.MeshStandardMaterial({map:earthMap,roughness:1,metalness:0}));earth.position.set(0,95,-520);earth.rotation.y=2;scene.add(earth);

 const camera=new THREE.PerspectiveCamera(config.fov,config.width/config.height,.1,2000);
 const position=new THREE.Vector3(),target=new THREE.Vector3();
 // One global quintic time remap and cubic Bezier: continuous position, heading,
 // speed and acceleration, with no per-segment lookAt or accumulated state.
 const smooth=u=>u*u*u*(u*(u*6-15)+10);
 function bezier(points,u,out){out.set(0,0,0);const v=1-u;const w=[v*v*v,3*v*v*u,3*v*u*u,u*u*u];points.forEach((p,i)=>{out.x+=p[0]*w[i];out.y+=p[1]*w[i];out.z+=p[2]*w[i]});return out;}
 function pose(t){const u=smooth(THREE.MathUtils.clamp(t/config.settleTime,0,1));bezier(config.cameraBezier,u,position);bezier(config.targetBezier,u,target);camera.position.copy(position);camera.lookAt(target);camera.updateMatrixWorld();return camera;}
 function render(t){time=THREE.MathUtils.clamp(t,0,config.duration);pose(time);renderer.render(scene,camera);$('#time').value=time;$('#clock').textContent=time.toFixed(2).padStart(5,'0')+' / 20.00';$('#phase').textContent=time<5?'悬空接近坑缘':time<12?'缓慢展开环形山':time<17?'进入已确认 B 构图':'B 构图 · 安静停留';}
 function pause(){playing=false;cancelAnimationFrame(raf);$('#play').textContent='播放';$('#status').textContent='已暂停 · 可从当前时间播放';}
 function tick(now){if(!playing)return;const next=Math.min(config.duration,anchorTime+(now-anchorWall)/1000);if(playback.samples.length){const prev=playback.samples.at(-1);playback.gaps.push(now-prev.wall);}playback.samples.push({wall:now,time:next});render(next);if(next>=config.duration){pause();playback.completed++;$('#status').textContent='完整播放结束 · 可重播或拖动时间查看';return;}raf=requestAnimationFrame(tick);}
 function play(){if(time>=config.duration)render(0);playing=true;anchorTime=time;anchorWall=performance.now();playback.samples=[];playback.gaps=[];$('#play').textContent='暂停';$('#status').textContent='正常速度播放中';raf=requestAnimationFrame(tick);}
 $('#play').onclick=()=>playing?pause():play();$('#replay').onclick=()=>{pause();render(0);play()};
 $('#baseline').onclick=()=>{pause();render(config.settleTime);$('#status').textContent='已定位 B 基准机位（17.00 秒）'};
 $('#time').oninput=e=>{pause();render(Number(e.target.value));$('#status').textContent='已暂停 · 可从当前时间播放'};
 // Static scene / sun / Earth. Reuse one exact shadow map throughout the camera move.
 render(0);renderer.shadowMap.autoUpdate=false;
 const meshes=[];terrain.traverse(o=>{if(o.isMesh)meshes.push(o)});scene.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 const terrainBounds=new THREE.Box3().setFromObject(terrain);
 function inspect(){let minClearance=Infinity,minAbovePeak=Infinity,maxStep=0,maxTurn=0;let prev=null,prevQ=null;const checks=[];
  for(let i=0;i<=1200;i++){const t=i/60;pose(t);minAbovePeak=Math.min(minAbovePeak,camera.position.y-terrainBounds.max.y);ray.set(camera.position,down);const hit=ray.intersectObjects(meshes,false)[0];const clearance=hit?hit.distance:null;if(clearance!==null)minClearance=Math.min(minClearance,clearance);if(prev)maxStep=Math.max(maxStep,prev.distanceTo(camera.position));if(prevQ)maxTurn=Math.max(maxTurn,prevQ.angleTo(camera.quaternion));prev=camera.position.clone();prevQ=camera.quaternion.clone();if(i%60===0)checks.push({time:t,position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),clearance});}
  pose(17);const baselineError=camera.position.distanceTo(new THREE.Vector3(...config.baseline.position));return {sampleRate:60,samples:1201,minVerticalClearanceSceneUnits:Number.isFinite(minClearance)?minClearance:null,clearanceNote:"Vertical ray can miss finite tile; minHeightAboveTerrainPeak is a conservative collision bound for all positions.",minHeightAboveTerrainPeak:minAbovePeak,terrainBounds:{min:terrainBounds.min.toArray(),max:terrainBounds.max.toArray()},maxPositionStepPer60Hz:maxStep,maxHeadingStepDegrees:maxTurn*180/Math.PI,baselinePositionError:baselineError,shadowMapFrozen:true,webglError:renderer.getContext().getError(),checks,playback:{completed:playback.completed,frames:playback.samples.length,firstTime:playback.samples[0]?.time,lastTime:playback.samples.at(-1)?.time,maxFrameGapMs:Math.max(0,...playback.gaps)}};
 }
 async function save(name,blob){const r=await fetch('/capture/'+name,{method:'POST',body:blob});if(!r.ok)throw Error('保存失败 '+name);}
 $('#capture').onclick=async()=>{pause();const old=time;$('#capture').disabled=true;try{
  const sheet=document.createElement('canvas');sheet.width=1656;sheet.height=2064;const ctx=sheet.getContext('2d');ctx.fillStyle='#080b11';ctx.fillRect(0,0,sheet.width,sheet.height);
  for(let i=0;i<config.keyframes.length;i++){const t=config.keyframes[i];render(t);const blob=await new Promise(r=>renderer.domElement.toBlob(r,'image/png'));await save('frame-'+String(t).padStart(2,'0')+'.png',blob);const x=(i%3)*558,y=Math.floor(i/3)*1032;ctx.drawImage(renderer.domElement,x,y);ctx.fillStyle='#c2d6ee';ctx.font='500 23px system-ui';ctx.fillText(t.toFixed(0).padStart(2,'0')+' 秒 · '+$('#phase').textContent,x+14,y+996);}
  await save('contact-sheet.png',await new Promise(r=>sheet.toBlob(r,'image/png')));const report=inspect();await save('validation.json',new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));$('#report').textContent='已保存 6 帧、联系图与 validation.json';$('#status').textContent='输出已保存到 airborne-b-motion/output/';
 }catch(e){$('#status').textContent=e.message;console.error(e)}finally{render(old);$('#capture').disabled=false;}};
 document.querySelectorAll('button,input').forEach(e=>e.disabled=false);$('#status').textContent='已有地形与材质加载完成 · 点击播放';
}catch(e){$('#status').textContent='渲染失败：'+e.message;console.error(e);}
