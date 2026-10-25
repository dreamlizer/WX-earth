import { release } from './moon-voyage-robot.js';
import { buildExhaustSheet, writeExhaustSheet } from './moon-voyage-gundam.js';

const UNIT01 = require('../../assets/models/eva/unit01.js');
const UNIT02 = require('../../assets/models/eva/unit02.js');
const smooth = x => { x = Math.max(0, Math.min(1, x)); return x*x*(3-2*x); };
export const EVA_PURSUIT = [
  { unit: 'unit01', start: 82, entryLead: 0, end: 90.7, side: -1, data: UNIT01, root: 'eva01-assets' },
  // Compensate for the narrower red silhouette at the frame edge, so the
  // visible entry (rather than only the scheduling clock) is .5 seconds later.
  { unit: 'unit02', start: 82.5, entryLead: .05, end: 91.2, side: 1, data: UNIT02, root: 'eva02-assets' }
];
const WAKE_LIFE = .45;

// Timed positions in camera space: enter on opposite sides, then close the
// leader's depth gap without turning into a side-by-side formation.
function pursuitTrack(e, side) {
  const points = [
    [0, side*5, -.1, 3], [1, side*2.5, side*.1, -6],
    [2, side*1.25, side*.3, -18], [4, side===-1?-.8:-.4, side===-1?.1:1.5, -42],
    [6, side===-1?-4.6:-3.1, side===-1?.5:2.8, -64],
    [8, side===-1?-10.5:-9.1, side===-1?2:4, -109],
    [9.5, -18, 4.8, -168]
  ];
  let i=0;
  while(i<points.length-2&&e>points[i+1][0])i++;
  const a=points[i],b=points[i+1],before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+2)];
  const span=b[0]-a[0],q=(e-a[0])/span,position=[],velocity=[];
  for(let k=1;k<=3;k++) {
    const va=(b[k]-before[k])/(b[0]-before[0]),vb=(after[k]-a[k])/(after[0]-a[0]);
    position.push((2*q*q*q-3*q*q+1)*a[k]+(q*q*q-2*q*q+q)*span*va+(-2*q*q*q+3*q*q)*b[k]+(q*q*q-q*q)*span*vb);
    velocity.push((6*q*q-6*q)*a[k]/span+(3*q*q-4*q+1)*va+(-6*q*q+6*q)*b[k]/span+(3*q*q-2*q)*vb);
  }
  return {position,velocity};
}

function orient(frame,track,e,side) {
  const bank=smooth((e-2)/4);
  frame.rotateY(Math.atan2(-track.velocity[0],-track.velocity[2]));
  // Slightly different shoulder-leading rolls ease into the shared left turn.
  frame.rotateZ(side*.13*(1-bank)-.48*bank);
  frame.rotateX(.035*Math.sin(e*1.3)*smooth(e-1)*(1-bank));
}

export function buildEva(T,data,buffer,texture,side) {
  const material=new T.MeshStandardMaterial({map:texture,metalness:.2,roughness:.43,
    emissiveMap:texture,emissive:new T.Color(.025,.03,.04),transparent:true});
  material.userData.craftLightProfile='gundam';
  material.defines={GUNDAM_CRAFT_LIGHT:1};
  const raw=new T.Group();
  for(const d of data.meshes) {
    const geometry=new T.BufferGeometry();
    geometry.addAttribute('position',new T.BufferAttribute(Float32Array.from(new Int16Array(buffer,d.position,d.count*3),v=>v/32767*data.extent),3));
    geometry.addAttribute('normal',new T.BufferAttribute(new Int8Array(buffer,d.normal,d.count*3),3,true));
    geometry.addAttribute('uv',new T.BufferAttribute(new Uint16Array(buffer,d.uv,d.count*2),2,true));
    geometry.setIndex(new T.BufferAttribute(new Uint16Array(buffer,d.index,d.indexCount),1));
    const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;raw.add(mesh);
  }
  raw.rotation.set(-Math.PI*.47,0,0);
  const model=new T.Group();model.add(raw);model.scale.setScalar(2.7/data.height);model.visible=false;
  const plume=buildExhaustSheet(T,24,true),wisps=buildExhaustSheet(T,32,false);
  const group=new T.Group();group.add(plume.mesh,wisps.mesh);group.visible=false;
  // Lower-back outlet, slightly off centre so the prone legs do not hide
  // the entire short plume when the pursuer points straight away from us.
  const wake={group,plume,wisps,frame:new T.Group(),emitter:new T.Vector3(side*.1,-.12,-.19).applyQuaternion(raw.quaternion).multiplyScalar(model.scale.x),
    point:new T.Vector3(),direction:new T.Vector3(),tangent:new T.Vector3(),side:new T.Vector3(),view:new T.Vector3()};
  return {model,raw,materials:[material],wake};
}

function updateWake(actor,t,camera) {
  const {wake,spec}=actor,e=t-spec.start+spec.entryLead,stop=spec.end-spec.start+spec.entryLead-.1;
  wake.group.visible=e>1.1&&e<stop+WAKE_LIFE;
  if(!wake.group.visible)return;
  wake.group.position.copy(camera.position);wake.group.quaternion.copy(camera.quaternion);
  const head=Math.min(e,stop);
  for(const sheet of [wake.plume,wake.wisps]) {
    const plume=sheet===wake.plume,attrs=sheet.mesh.geometry.attributes;
    sheet.mesh.visible=!plume||e<stop+.12;
    for(let i=0;i<=sheet.segments;i++) {
      const along=i/sheet.segments,sample=plume?head:Math.max(1.1,head-WAKE_LIFE*along);
      const age=plume?along:Math.min(1,(e-sample)/WAKE_LIFE);
      sheet.birthTimes[i]=sample;
      const track=pursuitTrack(sample,spec.side),frame=wake.frame;
      frame.quaternion.set(0,0,0,1);orient(frame,track,sample,spec.side);
      wake.point.copy(wake.emitter).applyQuaternion(frame.quaternion).add(frame.position.fromArray(track.position));
      wake.direction.fromArray(track.velocity);
      const boost=smooth((wake.direction.length()-9)/18),distance=Math.max(0,-wake.point.z-3);
      wake.direction.normalize().negate();
      // Both the physical flow distance and lifetime are shorter than Gundam's.
      const limit=distance*.2,travel=(12+boost*20)*Math.max(0,e-sample);
      const length=plume?Math.min(1.5+boost*1.3,distance*.12)*along:limit*(1-Math.exp(-travel/Math.max(.01,limit)));
      wake.point.addScaledVector(wake.direction,length).toArray(sheet.centers,i*3);
      sheet.widths[i]=plume?(.06+.18*Math.sin(Math.PI*along)):(.1+(.32+boost*.15)*along);
      let strength=smooth((sample-1.1)/.3)*smooth((stop-sample)/.3)*smooth(distance/4)*Math.pow(Math.max(0,1-age),plume?1.2:1.8);
      strength*=plume?smooth((stop+.12-e)/.12):smooth(along/.12)*.8;
      for(let edge=0;edge<2;edge++) {
        attrs.uv.array[i*4+edge*2]=edge;attrs.uv.array[i*4+edge*2+1]=along;attrs.strength.array[i*2+edge]=strength;
      }
    }
    writeExhaustSheet(wake,sheet,e);
  }
}

export class VoyageEvaPursuit {
  constructor({THREE,scene,readEvaBuffer}) {
    this.THREE=THREE;this.scene=scene;this.readBuffer=readEvaBuffer;this.generation=0;this.actors=[];
  }
  preload() {
    if(this.pending)return this.pending;
    if(this.attempted)return Promise.resolve();
    this.attempted=true;
    const generation=this.generation,T=this.THREE;
    const ready=spec=>this.readBuffer?Promise.resolve():new Promise((resolve,reject)=>{
      if(spec.unit==='unit01')require('../../eva01-assets/ready.js',resolve,reject);
      else require('../../eva02-assets/ready.js',resolve,reject);
    });
    const load=async spec=>{
      await ready(spec);
      if(generation!==this.generation)return null;
      const buffer=await (this.readBuffer?this.readBuffer(spec.unit):new Promise((resolve,reject)=>wx.getFileSystemManager().readFile({filePath:spec.root+'/geometry.bin',success:r=>resolve(r.data),fail:reject})));
      if(generation!==this.generation)return null;
      const texture=await new Promise((resolve,reject)=>new T.TextureLoader().load('/'+spec.root+'/basecolor.jpg',resolve,undefined,reject));
      texture.flipY=false;texture.encoding=T.sRGBEncoding;
      if(generation!==this.generation){texture.dispose();return null;}
      try {return {spec,...buildEva(T,spec.data,buffer,texture,spec.side)};} catch(error){texture.dispose();throw error;}
    };
    // Sequential asset decoding avoids competing with the existing robot/ship.
    const actors=[];this.staged=actors;
    this.pending=(async()=>{
      try {
        for(const spec of EVA_PURSUIT){const actor=await load(spec);if(actor)actors.push(actor);}
        if(generation!==this.generation){actors.forEach(retireActor);return;}
        this.actors=actors;
        actors.forEach(a=>this.scene.add(a.model,a.wake.group));
      } catch(error) {
        actors.forEach(retireActor);
        if(generation===this.generation)console.warn('[Moon] EVA pursuit unavailable; retaining Gundam flyby',error);
      } finally {if(generation===this.generation){this.pending=null;this.staged=null;}}
    })();
    return this.pending;
  }
  update(t,camera) {
    for(const actor of this.actors) {
      const {spec,model}=actor,e=t-spec.start+spec.entryLead;
      model.visible=t>=spec.start&&t<spec.end;
      updateWake(actor,t,camera);
      if(!model.visible)continue;
      const track=pursuitTrack(e,spec.side);
      model.position.fromArray(track.position).applyQuaternion(camera.quaternion).add(camera.position);
      model.quaternion.copy(camera.quaternion);orient(model,track,e,spec.side);
      actor.materials[0].opacity=smooth((spec.end-t)/.4);
    }
  }
  reset(){this.actors.forEach(a=>{a.model.visible=false;a.wake.group.visible=false;});}
  dispose(){this.generation++;[...this.actors,...(this.staged||[])].forEach(retireActor);this.staged=null;this.actors=[];this.pending=null;this.attempted=false;}
}

function retireActor(actor) {
  if(actor.retired)return;
  actor.retired=true;release(actor.model);release(actor.wake.group);
}
