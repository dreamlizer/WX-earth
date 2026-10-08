import { VoyageGundam } from './moon-voyage-gundam.js';
import { createStarFlow, updateStarFlow, disposeStarFlow } from './moon-voyage-star-flow.js';
import { VoyageRobot } from './moon-voyage-robot.js';
import { VoyageStarship } from './moon-voyage-starship.js';
import { shadeCraft } from './moon-voyage-craft-light.js';
const DATA = require('../../assets/models/voyager/model.js');
const smooth = x => { x=Math.max(0,Math.min(1,x)); return x*x*(3-2*x); };
function screenTrack(out,a,b,q){
 const d=1/((1-q)/a.d+q/b.d);
 return out.set(((1-q)*a.x+q*b.x)*d,((1-q)*a.y+q*b.y)*d,-d);
}
// Frame-relative waypoints keep the upper arc consistent on a portrait phone.
// Monotone Hermite slopes join each leg without a snap or depth overshoot.
function voyagerTrack(out,cam,ray,e){
 const approach=t=>{
  const u=t/32-6*Math.pow(Math.max(0,1-t/24),3);
  return out.set(ray.x*12*(1-u)-.3*u,ray.y*12*(1-u)+.08*u,-12+13.2*u);
 };
 if(e<=12)return approach(e);
 const half=Math.tan(cam.fov*Math.PI/360),wide=half*cam.aspect;
 // Keep the original distant entry through 22s, including its departure tangent.
 approach(12);const depth=-out.z,du=.21875,dd=-13.2*du;
 const startSlopes=[0,(((-12*ray.x-.3)*du)*depth-out.x*dd)/(depth*depth*wide),(((-12*ray.y+.08)*du)*depth-out.y*dd)/(depth*depth*half),dd];
 const points=[[12,out.x/depth/wide,out.y/depth/half,depth],[22,-.6,.55,4.2],[26,-.35,.75,1.9],[32,1.6,.95,1.05]];
 let i=0;while(i<points.length-2&&e>points[i+1][0])i++;
 const a=points[i],b=points[i+1],span=b[0]-a[0],q=(e-a[0])/span;
 const slope=(n,k)=>{
  if(n===0)return startSlopes[k];
  const p=points[n],before=points[Math.max(0,n-1)],after=points[Math.min(points.length-1,n+1)];
  const left=n?(p[k]-before[k])/(p[0]-before[0]):(after[k]-p[k])/(after[0]-p[0]);
  const right=n<points.length-1?(after[k]-p[k])/(after[0]-p[0]):left;
  return left*right>0?2*left*right/(left+right):0;
 };
 const value=k=>(2*q*q*q-3*q*q+1)*a[k]+(q*q*q-2*q*q+q)*span*slope(i,k)+(-2*q*q*q+3*q*q)*b[k]+(q*q*q-q*q)*span*slope(i+1,k);
 const d=value(3),overhead=smooth((e-28)/4);
 // Continue above the lens at close range; let the large hull clear the edges
 // instead of shrinking into a distant point or hiding while still in frame.
 return out.set((value(1)+2.2*overhead)*wide*d,(value(2)+1.4*overhead)*half*d,-d);
}
// Find an entry pose wholly below the viewport, including the hull's rotated extents.
function shipEntry(T,actor,cam,landing){
 const depth=.68,half=Math.tan(cam.fov*Math.PI/360),point=new T.Vector3();
 const topAt=y=>{
  actor.position.set(.12*depth,y*depth,-depth).applyQuaternion(cam.quaternion).add(cam.position);
  actor.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),landing.clone().sub(actor.position).normalize());
  actor.updateMatrixWorld(true);let top=-Infinity;
  actor.traverse(o=>{if(!o.isMesh)return;if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;
   for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])top=Math.max(top,point.set(x,y,z).applyMatrix4(o.matrixWorld).project(cam).y);
  });return top;
 };
 let lo=-4*half,hi=0;
 for(let i=0;i<18;i++){const y=(lo+hi)/2;if(topAt(y)>-1.04)hi=y;else lo=y;}
 return {x:.12,y:lo,d:depth};
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
  setContext({THREE,scene,camera,readBuffer,readRobotBuffer,readStarshipBuffer,readGundamBuffer}) {this.dispose();this.THREE=THREE;this.scene=scene;this.camera=camera;this.readBuffer=readBuffer;this.readGundamBuffer=readGundamBuffer;this.readRobotBuffer=readRobotBuffer;this.readStarshipBuffer=readStarshipBuffer;this.robot=new VoyageRobot({THREE,scene,readBuffer:readRobotBuffer});this.starship=new VoyageStarship({THREE,scene,readBuffer:readStarshipBuffer});}
  preload() {
    if(!this.gundam)this.gundam=new VoyageGundam({THREE:this.THREE,scene:this.scene,readBuffer:this.readGundamBuffer});
    this.gundam.preload();
    if(!this.robot)this.robot=new VoyageRobot({THREE:this.THREE,scene:this.scene,readBuffer:this.readRobotBuffer});
    if(!this.starship)this.starship=new VoyageStarship({THREE:this.THREE,scene:this.scene,readBuffer:this.readStarshipBuffer});
    if(this.robot)this.robot.preload();if(this.starship)this.starship.preload();
    if(this.model)return Promise.resolve();if(this.pending)return this.pending;
    const generation=this.generation||0,T=this.THREE,textures=[];
    const read=this.readBuffer||(()=>new Promise((resolve,reject)=>wx.getFileSystemManager().readFile({filePath:ROOT+'geometry.bin',success:r=>resolve(r.data),fail:reject})));
    const ready=this.readBuffer?Promise.resolve():new Promise((resolve,reject)=>require('../../voyager-assets/ready.js',resolve,reject));
    this.pending=ready.then(()=>Promise.all([read(),...Array.from({length:4},(_,i)=>new Promise((resolve,reject)=>new T.TextureLoader().load('/'+ROOT+'texture-'+i+'.png',tex=>{tex.flipY=false;tex.encoding=T.sRGBEncoding;textures.push(tex);resolve(tex);},undefined,reject)))])).then(([buffer,...maps])=>{
      if(generation!==(this.generation||0)){maps.forEach(t=>t.dispose());return;}
      Object.assign(this,buildVoyager(T,buffer,maps));this.textures=maps;this.model.visible=false;this.scene.add(this.model);
      this.flow=createStarFlow(T);this.scene.add(this.flow.group);
      const pixels=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const dx=Math.abs(x-31.5)/31.5,dy=Math.abs(y-31.5)/31.5,v=Math.exp(-Math.min(dx*dx*180+dy*dy*5,dy*dy*180+dx*dx*5));const k=(y*64+x)*4;pixels[k]=pixels[k+1]=pixels[k+2]=255;pixels[k+3]=255*v;}
      const map=new T.DataTexture(pixels,64,64,T.RGBAFormat);map.needsUpdate=true;this.glint=new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthWrite:false,depthTest:false}));this.glint.renderOrder=20;this.glint.visible=false;this.scene.add(this.glint);
    }).catch(e=>{textures.forEach(t=>t.dispose());console.warn('[Moon] Voyager unavailable',e);}).then(()=>{if(generation===(this.generation||0))this.pending=null;});return this.pending;
  }
  update({t,node1Time,node2Time,node3Time,moonMesh,globeGroup,dtSec=0}) {
    if(!this.model){if(!this.pending&&!this.attempted){this.attempted=true;this.preload();}return;}
    const T=this.THREE,cam=this.camera;this.model.visible=false;this.model.scale.setScalar(this.baseScale);this.glint.visible=false;if(this.robot)this.robot.reset();if(this.starship)this.starship.reset();
    const e1=t-(node1Time-28),e2=t-(node1Time+9);
    // Shorten the robot encounter by 2.5 seconds; its action clock is independent
    // of star travel and the original Moon / starship timing.
    const robotTime=e2*44/41.5;
    const companionTime=robotTime<=13?robotTime:robotTime<37?13+(robotTime-13)*12/24:robotTime-12;
    let x=0,y=0,z=0,alpha=1,rot=[.28,.4,.45],active=false,second=false;
    cam.updateMatrixWorld(true);
    shadeCraft(T,this.materials,cam);if(this.robot)shadeCraft(T,this.robot.materials,cam);if(this.starship)shadeCraft(T,this.starship.materials,cam);
    if(this.gundam){shadeCraft(T,this.gundam.materials,cam);this.gundam.update(t,cam);}
    if(e1>=0&&e1<32&&!this.earthRay&&globeGroup){
      const source=cam.worldToLocal(globeGroup.getWorldPosition(new T.Vector3()));
      this.earthRay={x:source.x/Math.max(.1,-source.z),y:source.y/Math.max(.1,-source.z)};
    }
    if(e1>=0&&e1<32){
      // Approach the upper left, round the bend, then pass close overhead to the right.
      const local=voyagerTrack(new T.Vector3(),cam,this.earthRay||{x:.1,y:-.18},e1);
      x=local.x;y=local.y;z=local.z;
      const spinTime=Math.max(0,e1-12);
      alpha=smooth(e1/3);rot[2]+=(e1-26)*.035+.025*spinTime*smooth(spinTime/5);active=true;
    }
    else if(e2>=0&&e2<41.5){
      const e=companionTime*36/32,near=Math.pow(smooth(e/14),1.25),pass=Math.pow(Math.max(0,Math.min(1,(e-24)/8.5)),1.7);
      const f=smooth((e-12)/2)*(1-smooth((e-24)/3)),local=new T.Vector3();
      if(e<24)screenTrack(local,{x:-.015,y:.015,d:64},{x:-.105,y:.025,d:3.6},near);
      else screenTrack(local,{x:-.105,y:.025,d:3.6},{x:-.85,y:.035,d:1.12},pass);
      x=local.x;y=local.y+.018*Math.sin(e*.65)*f;z=local.z;
      alpha=smooth(e/3);rot=[.08,-.48,.22];active=true;second=true;
    }
    cam.updateMatrixWorld(true);
    const thirdStart=node2Time+14,thirdDuration=node3Time-thirdStart-.65;
    if(moonMesh&&moonMesh.visible&&t>=thirdStart&&t<node3Time&&this.moonStart==null){
      const p=moonMesh.getWorldPosition(new T.Vector3()).project(cam);
      // Begin the foreground reveal before the original Moon crosses the left edge.
      // Do not move the Moon to satisfy a craft visibility gate.
      if(p.z<1){
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
        const actor=this.starship&&this.starship.model?this.starship.model:this.model;
        actor.scale.setScalar(actor===this.model?this.baseScale*.3:this.starship.baseScale);
        if(!this.shipEntry)this.shipEntry=shipEntry(T,actor,cam,this.landing);
        screenTrack(local,this.shipEntry,{x:target.x/d,y:target.y/d,d},q);
        // Reveal the hull before receding: keep the projected line, advance its screen position.
        const reveal=1-Math.pow(1-q,3),depth=-local.z;
        local.x=((1-reveal)*this.shipEntry.x+reveal*target.x/d)*depth;
        local.y=((1-reveal)*this.shipEntry.y+reveal*target.y/d)*depth;
        actor.position.copy(local.applyQuaternion(cam.quaternion).add(cam.position));
        if(actor===this.model){actor.scale.setScalar(this.baseScale*.3);actor.quaternion.copy(cam.quaternion);actor.rotateX(.45);actor.rotateY(.7);actor.rotateZ(-.25);}
        else {actor.scale.setScalar(this.starship.baseScale);const heading=this.landing.clone().sub(actor.position).normalize();actor.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),heading);}
        // Resolve the vessel to a small landing point; never dissolve a readable hull.
        const landingSize=1-.995*smooth((e3-7)/Math.max(.1,duration-7));
        actor.scale.multiplyScalar(landingSize);alpha=1;actor.visible=true;
        if(actor!==this.model)this.starship.materials.forEach(m=>m.opacity=alpha);
      }else{
        this.glint.position.copy(this.landing);this.glint.scale.setScalar(.18);
        this.glint.material.opacity=Math.sin(Math.PI*(e3-duration)/.6)*.95;this.glint.visible=true;
      }
    }else if(active){
      const actor=second&&this.robot&&this.robot.model?this.robot.model:this.model;
      actor.position.set(x,y,z).applyQuaternion(cam.quaternion).add(cam.position);
      actor.quaternion.copy(cam.quaternion);
      if(actor!==this.model){
        // Arrive -> look back -> acknowledge -> face forward, before the extended overtaking phase.
        const glance=smooth((companionTime-13)/3)*(1-smooth((companionTime-18)/2.7));
        actor.rotateY(-2.85*glance);actor.rotateX(-Math.PI/4+glance*.55);actor.rotateZ(.06*glance);
        this.robot.update(robotTime,alpha);
      }
      else{actor.rotateX(rot[0]);actor.rotateY(rot[1]);actor.rotateZ(rot[2]);}
      actor.visible=true;
    }
    this.materials.forEach(m=>m.opacity=alpha);
    if(this.flow){
      // Star travel uses elapsed voyage time, never the slowed character action clock.
      updateStarFlow(this.flow,e2*36/32,t);
      this.flow.group.position.copy(cam.position);
      this.flow.group.quaternion.copy(cam.quaternion);
    }
  }
  reset(){if(this.gundam)this.gundam.reset();if(this.starship)this.starship.reset();if(this.robot)this.robot.reset();this.landing=null;this.shipEntry=null;this.earthRay=null;this.moonStart=null;this.travel=0;if(this.model)this.model.visible=false;if(this.flow)this.flow.group.visible=false;if(this.glint)this.glint.visible=false;}
  dispose(){if(this.gundam){this.gundam.dispose();this.gundam=null;}if(this.starship){this.starship.dispose();this.starship=null;}if(this.robot){this.robot.dispose();this.robot=null;}this.generation=(this.generation||0)+1;this.pending=null;this.attempted=false;this.reset();disposeStarFlow(this.flow);this.flow=null;if(this.model){this.model.traverse(o=>{if(o.geometry)o.geometry.dispose();});this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());}for(const key of ['model','stars','glint']){const o=this[key];if(o){if(key==='key')this.scene.remove(o.target);if(o.geometry)o.geometry.dispose();if(o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();}if(o.parent)o.parent.remove(o);this[key]=null;}}}
}
