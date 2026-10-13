import { AmbientEncounterManager, AMBIENT_CRAFT, ZEN_CRAFT } from './ambient-encounter-manager.js';
import { ZenVisualClock } from './zen-visual-clock.js';

const MOODS = {
  1: {craft:['eve','astronaut','eve','chandra'], routes:['sky','sky','rise','sky'], size:[.65,.90]},
  2: {craft:['eve','astronaut','eve','magellan'], routes:['sky','sky','sky','front'], size:[.78,1.05]},
  3: {craft:['astronaut','eve','astronaut','juno'], routes:['rise','sky','sky','front'], size:[.72,.98]}
};
export function makeZenEncounterPlan(track, duration = 180, random = Math.random) {
  const mood = MOODS[track] || MOODS[1];
  const range = (a,b) => a+(b-a)*random();
  const pick = list => list[Math.min(list.length-1,Math.floor(random()*list.length))];
  const windows = [[12,20],[50,65],[90,110],[140,158]];
  if (duration > 235) windows.push([205,218]);
  let last;
  return windows.map(([a,b],index) => {
    const choices = mood.craft.filter(key => key !== last);
    const key = last = track===2 && (index===0 || index===2) ? 'eve' : pick(choices);
    return {key,start:range(a,b),duration:range(12,19), route:pick(mood.routes),
      side:random()<.5?-1:1,size:range(...mood.size),height:range(-.1,.15),roll:range(-.06,.06),
      spin:range(.02,.035)*(random()<.5?-1:1)};
  });
}

// Coordinates follow the camera frustum; the small zen Earth remains below.
export function zenOrbitPoint(out, p, q, camera, center) {
  const depth = center.distanceTo(camera.position);
  const z = p.route === 'front' ? -.8 + 2.1*Math.sin(Math.PI*q) : -.8;
  const halfH = Math.tan(camera.fov*Math.PI/360)*(depth-z);
  const halfW = halfH*camera.aspect;
  let x, y;
  if (p.route === 'rise') {
    x = p.side * halfW * 1.08 * (2*q-1);
    y = halfH * (-.12+.82*Math.sin(Math.PI*q));
  } else if (p.route === 'front') {
    x = p.side * halfW * 1.08 * (2*q-1);
    y = halfH * (.10 + .22 * Math.sin(Math.PI*q));
  } else {
    x = p.side*(2*q-1)*halfW*1.18;
    y = halfH*(.48+.22*Math.sin(Math.PI*q)+p.height*.3);
  }
  return out.set(x,y,z);
}

// Arc length in the projected screen plane avoids a rush through curve bends.
export function zenArcTable(p,camera,center) {
  const lengths=[0], point={set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}};
  const depth=center.distanceTo(camera.position);let previous=null,total=0;
  for(let i=0;i<=256;i++) {
    zenOrbitPoint(point,p,i/256,camera,center);
    const next={x:point.x/(depth-point.z),y:point.y/(depth-point.z)};
    if(previous){total+=Math.hypot(next.x-previous.x,next.y-previous.y);lengths.push(total);}
    previous=next;
  }
  return lengths.map(n=>n/total);
}
export function zenArcProgress(table,progress) {
  const p=Math.max(0,Math.min(1,progress));let low=0,high=table.length-1;
  while(high-low>1){const mid=(low+high)>>1;if(table[mid]<p)low=mid;else high=mid;}
  return (low+(p-table[low])/Math.max(1e-9,table[high]-table[low]))/(table.length-1);
}

// A local key light in view space: the shared Earth/Moon scene lights stay untouched.
export function applyZenSunlight(model) {
  model.traverse(object => {
    for (const material of [].concat(object.material || [])) {
      if (material.userData.zenSunlight) continue;
      material.userData.zenSunlight = true;
      const original = material.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        original?.call(material, shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>',
          `#include <lights_fragment_end>
          float zenSun = max(dot(geometry.normal, normalize(vec3(0.82, 0.42, 0.65))), 0.0);
          reflectedLight.directDiffuse += diffuseColor.rgb * vec3(1.0, 0.96, 0.88) * (zenSun * 1.1);
          reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.045;`);
      };
      material.needsUpdate = true;
    }
  });
}

export class ZenEncounterManager extends AmbientEncounterManager {
  constructor(opts) { super(opts); this.root.name='ZEN_ENCOUNTER'; this.session=null;this.clock=new ZenVisualClock(); }
  activateModel(key) {
    super.activateModel(key);
    applyZenSunlight(this.model);
    const materials=new Set();
    this.model.traverse(o=>[].concat(o.material||[]).forEach(m=>materials.add(m)));
    this.passMaterials=Array.from(materials);
    this.passMaterials.forEach(m=>{if(m.userData.zenOpacity==null)m.userData.zenOpacity=m.opacity;m.transparent=true;m.needsUpdate=true;});
  }
  updateSong({enabled,audio,track}) {
    if (!enabled || !audio) { this.finish(); this.session=null;this.clock.reset(); return; }
    const time = this.clock.read(audio);
    if (this.session !== audio || time < (this.songTime || 0)-1) {
      this.finish(); this.session=audio;
      this.plan=makeZenEncounterPlan(track,Number(audio.duration || (track===2?250:190)),this.random);
    }
    this.songTime=time;
    if (audio.paused) return;
    const event=this.plan.find(p=>time>=p.start&&time<p.start+p.duration);
    const upcoming=event || this.plan.find(p=>p.start>=time);
    if (upcoming) { this.nextKey=upcoming.key; this.preload(); }
    if (!event || this.loadedKey!==event.key) { this.finish(); return; }
    this.pass={...event,elapsed:time-event.start};
    if(this.event!==event){this.event=event;this.globeGroup.getWorldPosition(this.center);this.arc=zenArcTable(event,this.camera,this.center);}
    this.root.visible=true;
    this.place();
  }
  clearCaption() { /* Zen names stay quiet; the normal caption has its own owner. */ }
  place() {
    const p=this.pass, progress=p.elapsed/p.duration, q=zenArcProgress(this.arc,progress);
    this.camera.updateMatrixWorld(true);
    this.globeGroup.getWorldPosition(this.center);
    zenOrbitPoint(this.local,p,q,this.camera,this.center);
    this.root.position.copy(this.local.applyQuaternion(this.camera.quaternion).add(this.center));
    this.root.quaternion.copy(this.camera.quaternion);
    const craft=ZEN_CRAFT[p.key] || AMBIENT_CRAFT[p.key], pose=craft.pose;
    this.root.rotateZ(pose[2]+p.roll);this.root.rotateY(pose[1]);this.root.rotateX(pose[0]);
    // Fixed size and continuous screen speed; only opacity eases at the edges.
    const edge=Math.max(0,Math.min(1,p.elapsed/.8,(p.duration-p.elapsed)/.8));
    const alpha=edge*edge*(3-2*edge);
    this.root.scale.setScalar(p.size);
    this.passMaterials?.forEach(m=>{m.opacity=m.userData.zenOpacity*alpha;});
    this.model?.rotation.set(0,craft.humanoid ? .08*Math.sin(p.elapsed*.15) : p.elapsed*p.spin,
      craft.humanoid ? .02*Math.sin(p.elapsed*.12) : .025*Math.sin(p.elapsed*.16));
  }
}
