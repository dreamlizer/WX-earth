import * as THREE from 'three';
import {GLTFLoader} from '/mech-encounter-candidates/preview/vendor/loaders/GLTFLoader.js';
import {OrbitControls} from '/mech-encounter-candidates/preview/vendor/controls/OrbitControls.js';

const $=s=>document.querySelector(s), canvas=$('#canvas');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x000000);
const camera=new THREE.PerspectiveCamera(48,1,.1,2000);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.maxDistance=350;controls.minDistance=2;
const sun=new THREE.DirectionalLight(0xfff5e7,3.1);sun.position.set(-110,65,30);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-145,right:145,top:145,bottom:-145,near:1,far:350});
sun.shadow.bias=-.0002;sun.shadow.normalBias=.03;scene.add(sun);scene.add(new THREE.AmbientLight(0x9aa8bf,.07));
const loadStart=performance.now(), loader=new THREE.TextureLoader();
function texture(name,color=false){return loader.loadAsync('./assets/'+name).then(t=>{t.flipY=false;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;});}
const [gltf,albedo,normal,roughness,ao]=await Promise.all([new GLTFLoader().loadAsync('./assets/terrain.glb'),texture('albedo.jpg',true),texture('normal.jpg'),texture('roughness.jpg'),texture('ao.jpg')]);
const terrain=gltf.scene;terrain.scale.setScalar(100);scene.add(terrain);
const material=new THREE.MeshStandardMaterial({map:albedo,normalMap:normal,roughnessMap:roughness,aoMap:ao,aoMapIntensity:.65,roughness:1,metalness:0});
terrain.traverse(o=>{if(o.isMesh){o.material=material;o.castShadow=true;o.receiveShadow=true;if(!o.geometry.attributes.uv1)o.geometry.setAttribute('uv1',o.geometry.attributes.uv);}});
terrain.updateMatrixWorld(true);
const earthMap=await loader.loadAsync('/earth.jpg');earthMap.colorSpace=THREE.SRGBColorSpace;
const earth=new THREE.Mesh(new THREE.SphereGeometry(10,48,32),new THREE.MeshStandardMaterial({map:earthMap,roughness:1}));earth.position.set(32,32,-360);earth.rotation.y=2;scene.add(earth);
const ray=new THREE.Raycaster();const down=new THREE.Vector3(0,-1,0);
function height(x,z){ray.set(new THREE.Vector3(x,100,z),down);return ray.intersectObject(terrain,true)[0]?.point.y ?? 0;}
// Precompute clearance against the imported mesh; no synthetic terrain is added.
const route=[];let highest=0;
for(let i=0;i<=100;i++){const z=48-i*.62;const h=height(32,z);highest=Math.max(highest,h);route.push(h);}
let playing=false,free=false,time=0,last=performance.now(),frames=0,frameTime=0;
const loadMs=Math.round(performance.now()-loadStart);
function pose(t){const u=Math.min(1,Math.max(0,t/18)),s=u*u*(3-2*u);const h0=route[0];camera.position.set(32,h0+3+(highest+8-h0-3)*s,48-62*s);camera.lookAt(32,18+9*s,-160);controls.target.set(32,18+9*s,-160);}
function reset(){free=false;controls.enabled=false;time=0;$('#time').value=0;pose(0);}
$('#play').onclick=()=>{if(free||time>=18)reset();playing=!playing;$('#play').textContent=playing?'暂停':'播放越岭';};
$('#near').onclick=()=>{playing=false;$('#play').textContent='播放越岭';reset();};
$('#overview').onclick=()=>{playing=false;free=true;controls.enabled=true;camera.position.set(130,120,140);controls.target.set(0,8,0);controls.update();$('#play').textContent='播放越岭';};
$('#time').oninput=e=>{playing=false;free=false;controls.enabled=false;time=Number(e.target.value);pose(time);$('#play').textContent='播放越岭';};
$('#capture').onclick=async()=>{renderer.render(scene,camera);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));const response=await fetch('/capture',{method:'POST',body:blob});$('#capture').textContent=response.ok?'画面已保存':'保存失败';};
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();reset();
function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(playing){time=Math.min(18,time+dt);$('#time').value=time;pose(time);if(time>=18){playing=false;$('#play').textContent='重新播放';}}if(free)controls.update();renderer.render(scene,camera);frames++;frameTime+=dt;if(frameTime>=1){$('#status').textContent=`80,000 三角面 · 2K 主贴图\n本地加载 ${loadMs} ms · ${Math.round(frames/frameTime)} fps\n${free?'自由观察':time.toFixed(1)+' / 18 秒'}`;frames=0;frameTime=0;}requestAnimationFrame(frame);}requestAnimationFrame(frame);
