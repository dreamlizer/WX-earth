import { ZenEncounterManager } from './zen-encounter-manager.js';

const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};

// Brief visits between the larger chorus accents. Randomness is sampled once
// per playback, never per frame, so each flight remains smooth and seekable.
export function makeGoWestEncounterPlan(random=Math.random){
  const range=(a,b)=>a+(b-a)*clamp(random());
  return [[82,84],[224,226]].map(([a,b])=>({
    key:'eve',start:range(a,b),duration:range(8.2,10),side:random()<.5?-1:1,
    size:range(.46,.56),height:range(-.12,.12),roll:range(-.08,.08),
    turn:random()<.5?-1:1
  }));
}

// A low camera-relative sweep leaves the title/English lyric area clear.
// Depth changes give a real approach and retreat; the model exits the frustum.
export function goWestEncounterPoint(out,p,q,camera,center,earthRadius=1){
  // The source model fits a centred unit box. Its enclosing sphere still
  // clears the globe while the body, arms and root bank through any angle.
  const bodyRadius=Math.sqrt(3)*p.size/2;
  const z=earthRadius+bodyRadius+.25+.25*Math.sin(Math.PI*q);
  const halfH=Math.tan(camera.fov*Math.PI/360)*(center.distanceTo(camera.position)-z);
  const halfW=halfH*camera.aspect;
  return out.set(p.side*(2*q-1)*halfW*1.5,
    halfH*(.08+.22*Math.sin(Math.PI*q)+p.height*.18),z);
}

export class GoWestEncounterManager extends ZenEncounterManager {
  constructor(opts){super(opts);this.root.name='GO_WEST_EVE';this.earthScale=new this.THREE.Vector3();}
  updateSong({enabled,audio}){
    if(this.disposed)return;
    if(!enabled || !audio){this.finish();this.session=null;this.clock.reset();return;}
    const time=this.clock.read(audio);
    if(this.session!==audio || time<(this.songTime || 0)-1){
      this.finish();this.session=audio;this.wait=0;this.plan=makeGoWestEncounterPlan(this.random);
    }
    this.songTime=time;
    const event=this.plan.find(p=>time>=p.start&&time<p.start+p.duration);
    const upcoming=event || this.plan.find(p=>p.start>=time);
    // Reuse the parent's load-failure backoff rather than retrying every frame.
    if(upcoming && upcoming.start-time<10 && this.loadedKey!==upcoming.key && !this.pending && this.wait<20){
      this.nextKey=upcoming.key;this.preload();
    }
    if(!event || this.loadedKey!==event.key){this.finish();return;}
    this.pass={...event,elapsed:time-event.start};this.root.visible=true;this.place();
  }
  place(){
    const p=this.pass,q=clamp(p.elapsed/p.duration);
    this.camera.updateMatrixWorld(true);this.globeGroup.getWorldPosition(this.center);
    this.globeGroup.getWorldScale(this.earthScale);
    goWestEncounterPoint(this.local,p,q,this.camera,this.center,
      Math.max(this.earthScale.x,this.earthScale.y,this.earthScale.z));
    this.root.position.copy(this.local.applyQuaternion(this.camera.quaternion).add(this.center));
    this.root.quaternion.copy(this.camera.quaternion);
    this.root.rotateZ(p.roll+.12*Math.sin(2*Math.PI*q));
    this.root.rotateX(.08*Math.sin(Math.PI*q));
    this.root.scale.setScalar(p.size);
    const alpha=smooth(Math.min(p.elapsed/.55,(p.duration-p.elapsed)/.65));
    this.passMaterials?.forEach(m=>{m.opacity=m.userData.zenOpacity*alpha;});
    // Two complete turns in the middle of the pass, with a gentle bank.
    this.model?.rotation.set(0,p.turn*4*Math.PI*smooth((q-.15)/.7),.06*Math.sin(4*Math.PI*q));
  }
}
