import * as THREE from 'three';
import {GLTFLoader} from '/mech-encounter-candidates/preview/vendor/loaders/GLTFLoader.js';
const output=document.querySelector('#comparison'),ctx=output.getContext('2d');
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
 const base='../preview/assets/';
 const [gltf,map,normalMap,roughnessMap,aoMap,earthMap]=await Promise.all([new GLTFLoader().loadAsync(base+'terrain.glb'),texture(base+'albedo.jpg',true),texture('./assets/normal-object.jpg'),texture(base+'roughness.jpg'),texture(base+'ao.jpg'),loader.loadAsync('/earth.jpg')]);
 const terrain=gltf.scene;terrain.scale.setScalar(100);scene.add(terrain);
 const material=new THREE.MeshStandardMaterial({map,normalMap,normalMapType:THREE.ObjectSpaceNormalMap,roughnessMap,aoMap,aoMapIntensity:.6,roughness:1,metalness:0});
 terrain.traverse(o=>{if(o.isMesh){o.material=material;o.castShadow=true;o.receiveShadow=true;o.geometry.setAttribute('uv1',o.geometry.attributes.uv);}});
 earthMap.colorSpace=THREE.SRGBColorSpace;
 const earth=new THREE.Mesh(new THREE.SphereGeometry(16,64,48),new THREE.MeshStandardMaterial({map:earthMap,roughness:1,metalness:0}));earth.position.set(0,95,-520);earth.rotation.y=2;scene.add(earth);
 const camera=new THREE.PerspectiveCamera(55,540/960,.1,2000);
 const shots=[
  {title:'A  低空掠过',sub:'更接近坑缘，保留前进感',y:40,targetY:8,targetZ:-70},
  {title:'B  环形山中景',sub:'坑壁、坑底与地球共同入画',y:60,targetY:8,targetZ:-60},
  {title:'C  高空俯瞰',sub:'完整地貌，强调尺度与寂静',y:90,targetY:0,targetZ:-100}
 ];
 ctx.fillStyle='#080b11';ctx.fillRect(0,0,1656,1120);
 shots.forEach((s,i)=>{
  camera.position.set(55,s.y,140);camera.lookAt(25,s.targetY,s.targetZ);renderer.render(scene,camera);
  const x=i*558;ctx.drawImage(renderer.domElement,x,0,540,960);
  ctx.fillStyle=i===1?'#c2d6ee':'#e5e8ef';ctx.font='500 26px system-ui';ctx.fillText(s.title,x+18,1003);
  ctx.fillStyle='#8f9aad';ctx.font='18px system-ui';ctx.fillText(s.sub,x+18,1039);
 });
 ctx.fillStyle='#6f7e92';ctx.font='16px system-ui';ctx.fillText('悬空中景构图试验 · 高度为相对视觉尺度，非测绘米制 · 原有样段保留',18,1093);
 document.querySelector('#status').textContent='已完成三档实渲染。先比较环形山的完整度与画面气氛；素材没有真实地理尺寸标定，因此不标注精确米数。此页不代表微信真机效果。';
 const save=document.querySelector('#save');save.disabled=false;save.onclick=async()=>{const blob=await new Promise(r=>output.toBlob(r,'image/png'));const res=await fetch('/capture',{method:'POST',body:blob});save.textContent=res.ok?'对比图已保存':'保存失败';};
}catch(e){document.querySelector('#status').textContent='渲染失败：'+e.message;console.error(e);}
