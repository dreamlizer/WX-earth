import * as THREE from 'three';
import {GLTFLoader} from '/mech-encounter-candidates/preview/vendor/loaders/GLTFLoader.js';
const $=s=>document.querySelector(s),canvas=$('#canvas');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0);
const camera=new THREE.PerspectiveCamera(48,9/16,.1,2000);
const sun=new THREE.DirectionalLight(0xfff5e7,3.1);sun.position.set(-110,65,30);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-145,right:145,top:145,bottom:-145,near:1,far:350});
sun.shadow.bias=-.0002;sun.shadow.normalBias=.03;scene.add(sun,new THREE.AmbientLight(0x9aa8bf,.07));
const loader=new THREE.TextureLoader();
async function texture(base,name,color=false){const t=await loader.loadAsync(base+name);t.flipY=false;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
async function load(base,patch=false){
 const [gltf,map,normalMap,roughnessMap,aoMap]=await Promise.all([new GLTFLoader().loadAsync(base+'terrain.glb'),texture(base,'albedo.jpg',true),texture(base,patch?'normal-object.jpg':'normal.jpg'),texture(base,'roughness.jpg'),texture(base,'ao.jpg')]);
 const object=gltf.scene;object.scale.setScalar(100);
 const material=new THREE.MeshStandardMaterial({map,normalMap,normalMapType:patch?THREE.ObjectSpaceNormalMap:THREE.TangentSpaceNormalMap,roughnessMap,aoMap,aoMapIntensity:.65,roughness:1,metalness:0});
 object.traverse(o=>{if(o.isMesh){o.material=material;o.castShadow=true;o.receiveShadow=true;o.geometry.setAttribute('uv1',o.geometry.attributes.uv);}});object.visible=false;scene.add(object);object.updateMatrixWorld(true);return object;
}
try{
 const [patch,baseline]=await Promise.all([load('./assets/',true),load('../preview/assets/')]);
 patch.visible=true;
 const ray=new THREE.Raycaster(new THREE.Vector3(32,100,48),new THREE.Vector3(0,-1,0));
 const startY=ray.intersectObject(baseline,true)[0].point.y+3;
 let old=false,playing=false,time=0,last=performance.now(),frames=0,elapsed=0;
 function pose(t){const u=t/8,s=u*u*(3-2*u);camera.position.set(32,startY+1.8*s,48-6*s);camera.lookAt(32,18,-160);}
 function label(){ $('#mode').textContent=old?'对照 · 整片压缩版':'局部裁切 · 原始精度';$('#compare').textContent=old?'返回：局部原精度':'对比：整片压缩版';}
 $('#compare').disabled=false;$('#play').disabled=false;
 $('#compare').onclick=()=>{old=!old;patch.visible=!old;baseline.visible=old;label();};
 $('#play').onclick=()=>{if(time>=8)time=0;playing=!playing;$('#play').textContent=playing?'暂停':'播放近景运动';};
 $('#reset').onclick=()=>{playing=false;time=0;$('#time').value=0;pose(0);$('#play').textContent='播放近景运动';};
 $('#time').oninput=e=>{playing=false;time=Number(e.target.value);pose(time);$('#play').textContent='播放近景运动';};
 $('#capture').onclick=async()=>{renderer.render(scene,camera);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));const res=await fetch('/capture',{method:'POST',body:blob});$('#capture').textContent=res.ok?'已保存':'保存失败';};
 function resize(){const h=innerHeight,w=Math.min(innerWidth,h*9/16);canvas.style.width=w+'px';canvas.style.height=h+'px';renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();pose(0);
 function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(playing){time=Math.min(8,time+dt);$('#time').value=time;pose(time);if(time===8){playing=false;$('#play').textContent='重新播放';}}renderer.render(scene,camera);frames++;elapsed+=dt;if(elapsed>=1){$('#status').textContent=(old?'8 万面 · 全图 2K':'原网格 · 局部 3072 × 4096')+`\n本机 ${Math.round(frames/elapsed)} fps · ${time.toFixed(1)} / 8 秒\n仅桌面画质验证`;frames=0;elapsed=0;}requestAnimationFrame(frame);}requestAnimationFrame(frame);
}catch(e){$('#status').textContent='加载失败：'+e.message;console.error(e);}
