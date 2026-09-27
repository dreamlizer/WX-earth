// 构图检查：运行原 MV 的真实绕月模块；不冒充完整 MV/微信渲染。
export function createMoonTrialScene(THREE) {
 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(45,390/720,.1,1000);
 camera.position.set(0,0,5);camera.rotation.y=.85;
 scene.add(new THREE.AmbientLight(0xffffff,.1));
 const light=new THREE.DirectionalLight(0xffffff,1.1);light.position.set(5,4,8);scene.add(light);
 const moon=new THREE.Mesh(new THREE.SphereGeometry(1,64,64),new THREE.MeshStandardMaterial({color:0xdddddd,roughness:.9,metalness:0}));
 moon.scale.setScalar(.9);moon.position.set(-5.8,-1.2,0);scene.add(moon);
 const sequence=new MoonOrbitSequence();sequence.init(THREE,scene);
 const tick=t=>sequence.tick({t,node3Time:113,camera,moonWorld:moon.position,globeGroup:null,orbitDurationSec:130,orbitEndDeg:630,moonRadius:.9,cameraMinY:5.4,cameraLiftEndDeg:70,lookBlendDeg:55,enableSun:false,farEarth:true,sunGlare:true,maxAmbient:.07,minDir:1.1,sunLightDist:28});
 tick(113);
 // 暂存原模块发出的图片加载回调完成状态，与月面一起等待。
 const ready=new Promise((resolve,reject)=>{
  const started=Date.now();
  new THREE.TextureLoader().load('/assets/textures/refined-moon.jpg',texture=>{
   texture.encoding=THREE.sRGBEncoding;moon.material.map=texture;moon.material.needsUpdate=true;
   const check=()=>{if(sequence._farEarth.visible)resolve();else if(Date.now()-started>8000)reject(new Error('Earth texture timeout'));else setTimeout(check,20);};check();
  },undefined,reject);
 });
 return {ready,isMoonVisible(){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);return new THREE.Frustum().setFromMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)).intersectsObject(moon);},update(t,aspect){camera.aspect=aspect;camera.updateProjectionMatrix();tick(t);},render(renderer){renderer.gammaOutput=true;renderer.gammaFactor=2.2;renderer.render(scene,camera);}};
}
