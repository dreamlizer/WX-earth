import { createStarFlow, updateStarFlow, disposeStarFlow } from './moon-voyage-star-flow.js';
const DATA = require('../../assets/models/voyager/model.js');
const smooth = x => { x=Math.max(0,Math.min(1,x)); return x*x*(3-2*x); };
function screenTrack(out,a,b,q){
 const d=1/((1-q)/a.d+q/b.d);
 return out.set(((1-q)*a.x+q*b.x)*d,((1-q)*a.y+q*b.y)*d,-d);
}
const ROOT='voyager-assets/';

// Preserve the NASA mesh and UVs; the build step only repacks buffers and resizes maps.
export function buildVoyager(T, buffer, textures) {
  const attr=i=>{const a=DATA.accessors[i];return new T.BufferAttribute(new (a.type===5126?Float32Array:Uint16Array)(buffer,a.offset,a.count*a.size),a.size);};
  const materials=DATA.materials.map(d=>{const p=d.pbrMetallicRoughness||{},c=p.baseColorFactor||[1,1,1,1];return new T.MeshStandardMaterial({color:new T.Color().fromArray(c),map:p.baseColorTexture?textures[p.baseColorTexture.index]:null,metalness:p.metallicFactor,roughness:p.roughnessFactor,transparent:true,opacity:c[3],side:d.doubleSided?T.DoubleSide:T.FrontSide});});
  const nodes=DATA.nodes.map(d=>{const g=new T.Group();if(d.translation)g.position.fromArray(d.translation);if(d.rotation)g.quaternion.fromArray(d.rotation);if(d.scale)g.scale.fromArray(d.scale);if(d.mesh!==undefined)DATA.meshes[d.mesh].primitives.forEach(p=>{const geo=new T.BufferGeometry();for(const [key,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']])if(p.attributes[key]!==undefined)geo.addAttribute(name,attr(p.attributes[key]));geo.setIndex(attr(p.indices));const m=new T.Mesh(geo,materials[p.material]);g.add(m);});return g;});
  DATA.nodes.forEach((d,i)=>(d.children||[]).forEach(j=>nodes[i].add(nodes[j])));
  const raw=new T.Group();nodes.forEach(n=>{if(!n.parent)raw.add(n);});raw.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(raw),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());raw.position.sub(center);
  const model=new T.Group();model.add(raw);model.scale.setScalar(1.6/Math.max(size.x,size.y,size.z));
  return {model,materials,baseScale:model.scale.x};
}

export class VoyageEncounters {
  setContext({THREE,scene,camera,readBuffer}) {this.dispose();this.THREE=THREE;this.scene=scene;this.camera=camera;this.readBuffer=readBuffer;}
  preload() {
    if(this.model)return Promise.resolve();if(this.pending)return this.pending;
    const generation=this.generation||0,T=this.THREE,textures=[];
    const read=this.readBuffer||(()=>new Promise((resolve,reject)=>wx.getFileSystemManager().readFile({filePath:ROOT+'geometry.bin',success:r=>resolve(r.data),fail:reject})));
    const ready=this.readBuffer?Promise.resolve():new Promise((resolve,reject)=>require('../../voyager-assets/ready.js',resolve,reject));
    this.pending=ready.then(()=>Promise.all([read(),...Array.from({length:4},(_,i)=>new Promise((resolve,reject)=>new T.TextureLoader().load('/'+ROOT+'texture-'+i+'.png',tex=>{tex.flipY=false;tex.encoding=T.sRGBEncoding;textures.push(tex);resolve(tex);},undefined,reject)))])).then(([buffer,...maps])=>{
      if(generation!==(this.generation||0)){maps.forEach(t=>t.dispose());return;}
      Object.assign(this,buildVoyager(T,buffer,maps));this.textures=maps;this.model.visible=false;this.scene.add(this.model);
      this.flow=createStarFlow(T);this.scene.add(this.flow.group);
      const pixels=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const dx=Math.abs(x-31.5)/31.5,dy=Math.abs(y-31.5)/31.5,v=Math.exp(-Math.min(dx*dx*180+dy*dy*5,dy*dy*180+dx*dx*5));const k=(y*64+x)*4;pixels[k]=pixels[k+1]=pixels[k+2]=255;pixels[k+3]=255*v;}
      const map=new T.DataTexture(pixels,64,64,T.RGBAFormat);map.needsUpdate=true;this.glint=new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthWrite:false}));this.glint.visible=false;this.scene.add(this.glint);
    }).catch(e=>{textures.forEach(t=>t.dispose());console.warn('[Moon] Voyager unavailable',e);}).then(()=>{if(generation===(this.generation||0))this.pending=null;});return this.pending;
  }
  update({t,node1Time,node2Time,node3Time,moonMesh,globeGroup,dtSec=0}) {
    if(!this.model){if(!this.pending&&!this.attempted){this.attempted=true;this.preload();}return;}
    const T=this.THREE,cam=this.camera;this.model.visible=false;this.model.scale.setScalar(this.baseScale);this.glint.visible=false;
    const e1=t-(node1Time-24),e2=t-(node1Time+9);let x=0,y=0,z=0,alpha=1,rot=[.28,.4,-.22],active=false;
    cam.updateMatrixWorld(true);
    if(e1>=0&&e1<32&&!this.earthRay&&globeGroup){
      const source=cam.worldToLocal(globeGroup.getWorldPosition(new T.Vector3()));
      this.earthRay={x:source.x/Math.max(.1,-source.z),y:source.y/Math.max(.1,-source.z)};
    }
    if(e1>=0&&e1<32){
      // A single straight track at constant world speed, with no midpoint stop or turn.
      const u=e1/32,ray=this.earthRay||{x:.1,y:-.18};
      x=ray.x*12*(1-u)-.9*u;y=ray.y*12*(1-u)+.08*u;z=-12+13.2*u;
      alpha=smooth(e1/3);active=true;
    }
    else if(e2>=0&&e2<32){
      const e=e2*36/32,near=smooth(e/14),pass=smooth((e-24)/12);
      const f=smooth((e-12)/2)*(1-smooth((e-24)/3)),local=new T.Vector3();
      if(e<24)screenTrack(local,{x:-.015,y:.015,d:64},{x:-.105,y:.025,d:3.6},near);
      else screenTrack(local,{x:-.105,y:.025,d:3.6},{x:-.85,y:.035,d:1.12},pass);
      x=local.x;y=local.y+.018*Math.sin(e*.65)*f;z=local.z;
      alpha=smooth(e/3);rot=[.08,-.48,.22];active=true;
    }
    cam.updateMatrixWorld(true);
    const thirdStart=node2Time+1,thirdDuration=node3Time-thirdStart-.65;
    if(moonMesh&&moonMesh.visible&&t>=thirdStart&&t<node3Time&&this.moonStart==null){
      const p=moonMesh.getWorldPosition(new T.Vector3()).project(cam);
      if(p.x>-1&&p.x<1&&Math.abs(p.y)<1&&p.z<1){
        this.moonStart=t;
        // The final Moon position is already fixed by the existing approach timeline.
        this.landing=new T.Vector3(-5.8,-1.2,0);
        this.landing.add(cam.position.clone().sub(this.landing).normalize().multiplyScalar(.9));
      }
    }
    const e3=this.moonStart==null?-1:t-this.moonStart;
    const duration=this.moonStart==null?thirdDuration:node3Time-this.moonStart-.65;
    if(e3>=0&&e3<duration+.6&&t<node3Time){
      if(e3<duration){
        const target=cam.worldToLocal(this.landing.clone()),d=-target.z;
        const local=new T.Vector3(),q=Math.pow(Math.max(0,Math.min(1,e3/duration)),1.3);
        // Small real body close to the lens: perspective shrinks it naturally at the Moon.
        screenTrack(local,{x:.19,y:-.6,d:.265},{x:target.x/d,y:target.y/d,d},q);
        this.model.position.copy(local.applyQuaternion(cam.quaternion).add(cam.position));
        this.model.scale.setScalar(this.baseScale*.3);
        this.model.quaternion.copy(cam.quaternion);this.model.rotateX(.45);this.model.rotateY(.7);this.model.rotateZ(-.25);
        alpha=1-smooth((e3-duration+1.4)/1.4);this.model.visible=true;
      }else{
        this.glint.position.copy(this.landing);this.glint.scale.setScalar(.11);
        this.glint.material.opacity=Math.sin(Math.PI*(e3-duration)/.6)*.7;this.glint.visible=true;
      }
    }else if(active){this.model.position.set(x,y,z).applyQuaternion(cam.quaternion).add(cam.position);this.model.quaternion.copy(cam.quaternion);this.model.rotateX(rot[0]);this.model.rotateY(rot[1]);this.model.rotateZ(rot[2]);this.model.visible=true;}
    this.materials.forEach(m=>m.opacity=alpha);
    if(this.flow){
      updateStarFlow(this.flow,e2*36/32,t);
      this.flow.group.position.copy(cam.position);
      this.flow.group.quaternion.copy(cam.quaternion);
    }
  }
  reset(){this.landing=null;this.earthRay=null;this.moonStart=null;this.travel=0;if(this.model)this.model.visible=false;if(this.flow)this.flow.group.visible=false;if(this.glint)this.glint.visible=false;}
  dispose(){this.generation=(this.generation||0)+1;this.pending=null;this.attempted=false;this.reset();disposeStarFlow(this.flow);this.flow=null;if(this.model){this.model.traverse(o=>{if(o.geometry)o.geometry.dispose();});this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());}for(const key of ['model','stars','glint']){const o=this[key];if(o){if(key==='key')this.scene.remove(o.target);if(o.geometry)o.geometry.dispose();if(o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();}if(o.parent)o.parent.remove(o);this[key]=null;}}}
}
