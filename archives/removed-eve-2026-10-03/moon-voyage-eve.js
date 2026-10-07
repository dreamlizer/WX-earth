import { registerGLTFLoader } from './vendor/gltf-loader.js';
import { release } from './moon-voyage-robot.js';

export class VoyageEve {
  constructor({THREE,scene,readBuffer}) {this.THREE=THREE;this.scene=scene;this.readBuffer=readBuffer;this.generation=0;}
  preload() {
    if(this.model||this.attempted)return this.pending||Promise.resolve();
    this.attempted=true;const T=this.THREE,generation=this.generation;
    const ready=this.readBuffer?Promise.resolve():new Promise((resolve,reject)=>require('../../eve-assets/ready.js',resolve,reject));
    const read=this.readBuffer||(()=>new Promise((resolve,reject)=>wx.getFileSystemManager().readFile({filePath:'eve-assets/eve.glb',success:r=>resolve(r.data),fail:reject})));
    if(!T.GLTFLoader)registerGLTFLoader(T);
    this.pending=ready.then(read).then(buffer=>new Promise((resolve,reject)=>new T.GLTFLoader().parse(buffer,'/eve-assets/',resolve,reject))).then(gltf=>{
      if(generation!==this.generation){release(gltf.scene);return;}
      const raw=gltf.scene;raw.updateMatrixWorld(true);
      const bounds=new T.Box3().setFromObject(raw),size=bounds.getSize(new T.Vector3());
      raw.position.sub(bounds.getCenter(new T.Vector3()));
      const facing=new T.Group();facing.add(raw);raw.updateMatrixWorld(true);const eyes=raw.getObjectByName("Object_7");
      if(eyes){const eyeCenter=new T.Box3().setFromObject(eyes).getCenter(new T.Vector3());facing.rotation.y=-Math.atan2(eyeCenter.x,eyeCenter.z);}
      this.model=new T.Group();this.model.add(facing);this.model.scale.setScalar(.34/size.y);this.baseScale=this.model.scale.x;this.model.visible=false;
      const materials=new Set();raw.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;for(const m of [].concat(o.material)){m.transparent=true;materials.add(m);}});
      this.materials=Array.from(materials);this.scene.add(this.model);
    }).catch(e=>{if(generation===this.generation)console.warn('[Moon] EVE unavailable; skipping optional orbit encounter',e);}).then(()=>{if(generation===this.generation)this.pending=null;});
    return this.pending;
  }
  update(t,camera) {
    if(!this.model)return;
    this.model.visible=false;
    // Only after 18 seconds of uninterrupted lunar orbit; done before the first glare pass.
    const e=t-18;if(e<0||e>=15)return;
    const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
    const arrive=smooth(e/4),leave=smooth((e-9)/6);
    const nx=1.45-.9*arrive-2.15*leave,ny=.48+.045*Math.sin(e*.45)+.12*leave;
    const d=2.8+.45*leave,half=Math.tan(camera.fov*Math.PI/360)*d;
    this.model.position.set(nx*half*camera.aspect,ny*half,-d).applyQuaternion(camera.quaternion).add(camera.position);
    this.model.quaternion.copy(camera.quaternion);
    this.model.rotateY(-.65*(1-smooth((e-3)/3))-1.15*leave);
    this.model.rotateZ(.07*Math.sin(e*.4));this.model.rotateX(.06);
    this.model.visible=true;
  }
  reset(){if(this.model)this.model.visible=false;}
  dispose(){this.generation++;release(this.model);this.model=null;this.materials=[];this.pending=null;this.attempted=false;}
}
