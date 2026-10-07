import { registerGLTFLoader } from './vendor/gltf-loader.js';
import { release } from './moon-voyage-robot.js';

export class VoyageStarship {
  constructor({THREE,scene,readBuffer}) {this.THREE=THREE;this.scene=scene;this.readBuffer=readBuffer;this.generation=0;}
  preload() {
    if(this.model||this.attempted)return this.pending||Promise.resolve();
    this.attempted=true;const T=this.THREE,generation=this.generation;
    const ready=this.readBuffer?Promise.resolve():new Promise((resolve,reject)=>require('../../starship-assets/ready.js',resolve,reject));
    const read=this.readBuffer||(()=>new Promise((resolve,reject)=>wx.getFileSystemManager().readFile({filePath:'starship-assets/starship.glb',success:r=>resolve(r.data),fail:reject})));
    if(!T.GLTFLoader)registerGLTFLoader(T);
    this.pending=ready.then(read).then(buffer=>new Promise((resolve,reject)=>new T.GLTFLoader().parse(buffer,'/starship-assets/',resolve,reject))).then(gltf=>{
      if(generation!==this.generation){release(gltf.scene);return;}
      const raw=gltf.scene;raw.updateMatrixWorld(true);
      const bounds=new T.Box3().setFromObject(raw),size=bounds.getSize(new T.Vector3());
      raw.position.sub(bounds.getCenter(new T.Vector3()));
      const facing=new T.Group();facing.add(raw);facing.rotation.y=Math.PI;
      this.model=new T.Group();this.model.add(facing);this.model.scale.setScalar(.95/Math.max(size.x,size.y,size.z));this.baseScale=this.model.scale.x;this.model.visible=false;
      const materials=new Set();raw.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;for(const m of [].concat(o.material)){m.transparent=true;materials.add(m);}});
      this.materials=Array.from(materials);this.scene.add(this.model);
    }).catch(e=>{if(generation===this.generation)console.warn('[Moon] Starship unavailable; retaining Voyager fallback',e);}).then(()=>{if(generation===this.generation)this.pending=null;});
    return this.pending;
  }
  reset(){if(this.model)this.model.visible=false;}
  dispose(){this.generation++;release(this.model);this.model=null;this.materials=[];this.pending=null;this.attempted=false;}
}
