// Isolated look-development shot. World-space terrain occludes a stationary Earth.
export const DURATION = 28;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
function hash(x,y){const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);}
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),u=smooth(x-ix),v=smooth(y-iy);return mix(mix(hash(ix,iy),hash(ix+1,iy),u),mix(hash(ix,iy+1),hash(ix+1,iy+1),u),v);}
const craters=[];
for(let i=0;i<110;i++)craters.push({x:(hash(i,4)-.5)*1800,z:-hash(i,8)*1450+130,r:7+hash(i,13)**2*88,d:.18+hash(i,15)*.13});
for(let i=0;i<55;i++)craters.push({x:(hash(i,91)-.5)*620,z:220-hash(i,92)*900,r:4+hash(i,93)**2*25,d:.2});
// Foreground impact structures are large enough to read in a moving portrait shot.
craters.push({x:30,z:-470,r:125,d:.25},{x:-38,z:30,r:39,d:.25},{x:62,z:-190,r:65,d:.23},{x:-105,z:-330,r:100,d:.22});
export function heightAt(x,z){
 let h=-(x*x+z*z)/(2*2400);
 h+=1.2*(noise(x/5,z/5)-.5)+4*(noise(x/120,z/120)-.5)+2.3*(noise(x/32,z/32)-.5)+.8*(noise(x/8,z/8)-.5);
 const crest=-105+18*Math.sin(x*.018)+7*Math.sin(x*.051);
 h+=(52+19*noise(x/32,2)+9*noise(x/11,3))*Math.exp(-(((z-crest)/48)**2));
 h+=22*Math.exp(-(((z+420+35*Math.sin(x/100))/100)**2));
 for(const c of craters){const q=Math.hypot(x-c.x,z-c.z)/c.r;if(q>1.6)continue;
   h+=c.r*(-c.d*Math.max(0,1-q*q)**2+.11*Math.exp(-(((q-1)/.13)**2)));
 }
 return h;
}
export function cameraPose(t){
 const p=smooth(t/23);
 return {x:mix(-24,18,p),y:mix(26,82,smooth(t/17)),z:mix(100,-184,p),lookX:mix(-15,72,p),lookY:mix(35,0,p),lookZ:mix(-280,-620,p)};
}
export function createRidgeScene(THREE){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x000000);
 const camera=new THREE.PerspectiveCamera(43,9/16,.5,12000);
 scene.add(new THREE.AmbientLight(0xabb4c5,.055));
 const sun=new THREE.DirectionalLight(0xfff5e7,1.15);sun.position.set(-650,230,-300);sun.target.position.set(0,0,-150);scene.add(sun,sun.target);
 sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-420,right:420,top:380,bottom:-380,near:1,far:1500});sun.shadow.bias=-.00025;
 const geo=new THREE.PlaneBufferGeometry(2200,1800,440,360);geo.rotateX(-Math.PI/2);geo.translate(0,0,-650);
 const pos=geo.attributes.position,cols=new Float32Array(pos.count*3);
 for(let i=0;i<pos.count;i++){
  const rawX=pos.getX(i),rawZ=pos.getZ(i)+650;const x=Math.sign(rawX)*Math.pow(Math.abs(rawX)/1100,1.55)*1100,z=250-Math.pow((900-rawZ)/1800,1.55)*1800;pos.setXYZ(i,x,heightAt(x,z),z);
  const v=.39+.09*noise(x/42,z/42)+.05*noise(x/7,z/7);
  cols.set([v,v*.99,v*.975],i*3);
 }
 geo.addAttribute('color',new THREE.BufferAttribute(cols,3));geo.computeVertexNormals();
 const grain=document.createElement('canvas');grain.width=grain.height=512;const ctx=grain.getContext('2d'),im=ctx.createImageData(512,512);
 for(let i=0;i<512*512;i++){const v=Math.round(105+hash(i%512,Math.floor(i/512))*95);im.data.set([v,v,v,255],i*4);}ctx.putImageData(im,0,0);
 const bump=new THREE.CanvasTexture(grain);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;bump.repeat.set(280,240);
 const mat=new THREE.MeshStandardMaterial({color:0x999692,vertexColors:THREE.VertexColors,roughness:1,metalness:0,bumpMap:bump,bumpScale:.055});
 // World-space regolith grain, independent of UV stretch on steep crater walls.
 mat.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 lunarPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlunarPosition=position;');
  shader.fragmentShader=`varying vec3 lunarPosition;
   float lunarHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
   float lunarNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(lunarHash(i),lunarHash(i+vec3(1,0,0)),f.x),mix(lunarHash(i+vec3(0,1,0)),lunarHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(lunarHash(i+vec3(0,0,1)),lunarHash(i+vec3(1,0,1)),f.x),mix(lunarHash(i+vec3(0,1,1)),lunarHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
   `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float regolith=.45+.22*lunarNoise(lunarPosition*.08)+.16*lunarNoise(lunarPosition*.42)+.1*lunarNoise(lunarPosition*1.8)+.07*lunarNoise(lunarPosition*8.);
   diffuseColor.rgb*=regolith;`);
 };
 const terrain=new THREE.Mesh(geo,mat);terrain.receiveShadow=true;terrain.castShadow=true;scene.add(terrain);
 // A few angular rocks give near-field scale; fixed seed, no drifting particles.
 const rockMat=new THREE.MeshStandardMaterial({color:0x656462,roughness:1,flatShading:true});
 for(let i=0;i<92;i++){
  const x=(hash(i,22)-.5)*420,z=140-hash(i,23)*650;
  const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),rockMat),s=.35+hash(i,25)**3*4;
  rock.position.set(x,heightAt(x,z)+s*.35,z);rock.scale.set(s,s*.6,s*.78);rock.rotation.set(hash(i,26)*2,hash(i,27)*6,hash(i,28));rock.castShadow=true;rock.receiveShadow=true;scene.add(rock);
 }
 // A fixed Earth behind the ridge. Visibility changes only through geometry/camera.
 const earth=new THREE.Group();earth.position.set(118,20,-1690);scene.add(earth);
 const earthMat=new THREE.MeshPhongMaterial({color:0xffffff,shininess:9,specular:0x162333});
 const globe=new THREE.Mesh(new THREE.SphereGeometry(105,80,64),earthMat);globe.rotation.set(.18,2.4,-.17);earth.add(globe);
 const earthLight=new THREE.DirectionalLight(0xffffff,0);earthLight.position.set(-400,450,600);earthLight.target=earth;scene.add(earthLight);
 const cloudMat=new THREE.MeshPhongMaterial({color:0xffffff,transparent:true,opacity:.48,depthWrite:false});
 const clouds=new THREE.Mesh(new THREE.SphereGeometry(105.6,64,48),cloudMat);clouds.rotation.copy(globe.rotation);earth.add(clouds);
 const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(107.3,64,48),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,uniforms:{},vertexShader:'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 n; varying vec3 v; void main(){float a=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(.12,.38,.75,a*.3);}'}));earth.add(atmosphere);
 const starsGeo=new THREE.BufferGeometry(),starPos=[];
 for(let i=0;i<190;i++){const x=(hash(i,61)-.5)*10500,y=600+hash(i,62)*4800,z=-4500-hash(i,63)*3000;starPos.push(x,y,z);}
 starsGeo.addAttribute('position',new THREE.Float32BufferAttribute(starPos,3));scene.add(new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0xa2b2c6,size:3,sizeAttenuation:true,transparent:true,opacity:.35,depthWrite:false})));
 const loader=new THREE.TextureLoader();const ready=Promise.all([
  new Promise((res,rej)=>loader.load('/assets/earth.jpg',tex=>{tex.encoding=THREE.sRGBEncoding;earthMat.map=tex;earthMat.needsUpdate=true;res();},undefined,rej)),
  new Promise((res,rej)=>loader.load('/assets/clouds.png',tex=>{cloudMat.alphaMap=tex;cloudMat.needsUpdate=true;res();},undefined,rej))
 ]);
 return {ready,update(t,aspect){const p=cameraPose(t);camera.position.set(p.x,p.y,p.z);camera.lookAt(new THREE.Vector3(p.lookX,p.lookY,p.lookZ));camera.aspect=aspect;camera.updateProjectionMatrix();},render(renderer){renderer.gammaOutput=true;renderer.gammaFactor=2.2;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.render(scene,camera);},camera,scene,terrain,earth};
}
