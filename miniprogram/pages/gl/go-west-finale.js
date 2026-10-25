import { GO_WEST_TITLE_SHAPES } from '../../assets/data/go-west-title-shapes.js';
import { createGoWestLetterGeometry } from './go-west-opening.js';
import { goWestFinaleFrame } from './go-west-finale-timing.js';

// Port of the approved independent finale: existing Earth, glass, lamps,
// stars, camera and song clock remain owned by their original managers.
const DEG=Math.PI/180;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,p)=>a+(b-a)*p;
const ease=x=>{const p=clamp(x);return p*p*p*(p*(p*6-15)+10);};
const progress=(t,a,b)=>ease((t-a)/Math.max(.01,b-a));
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const pulse=(t,at,decay)=>t<at?0:(1-Math.exp(-(t-at)*85))*Math.exp(-(t-at)/decay);
const PALETTE=[[.26,.68,1],[1,.20,.54],[1,.66,.23],[.63,.38,1],[.25,1,.78],[1,.40,.23]];
const SILVER=[.91,.96,1];
const FOIL_CORNERS=[[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]];

const foilVertex=`attribute vec3 foilColor;attribute float foilAlpha;
varying vec3 vN,vColor,vPosition;varying float vAlpha;
void main(){vN=normalize(normalMatrix*normal);vColor=foilColor;vAlpha=foilAlpha;
vec4 p=modelViewMatrix*vec4(position,1.0);vPosition=p.xyz;gl_Position=projectionMatrix*p;}`;
const foilFragment=`precision highp float;varying vec3 vN,vColor,vPosition;varying float vAlpha;
void main(){vec3 N=normalize(vN),V=normalize(-vPosition),R=reflect(-V,N);
float strip=exp(-pow((R.y+.12)/.25,2.0));float glint=pow(max(dot(R,normalize(vec3(-.3,.55,1))),0.0),25.0);
vec3 colour=vColor*(.32+.82*strip+1.45*glint)+vec3(.08,.14,.22)*pow(1.0-abs(N.z),2.0);
gl_FragColor=vec4(colour,vAlpha);}`;
const beamVertex=`attribute vec3 tint;attribute float strength;varying vec2 vUv;varying vec3 vColor;varying float vStrength;
void main(){vUv=uv;vColor=tint;vStrength=strength;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const beamFragment=`precision highp float;varying vec2 vUv;varying vec3 vColor;varying float vStrength;
void main(){float edge=pow(max(0.0,1.0-abs(vUv.x-.5)*2.0),2.3);float taper=pow(1.0-vUv.y,.55);
gl_FragColor=vec4(vColor,edge*taper*vStrength);}`;
const titleVertex=`varying vec3 vN,vP;void main(){vN=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.0);vP=p.xyz;gl_Position=projectionMatrix*p;}`;
const titleFragment=`precision highp float;varying vec3 vN,vP;uniform float alpha,time,shine,impact;
void main(){vec3 N=normalize(vN),V=normalize(-vP),R=reflect(-V,N);
float stripe=exp(-pow((R.y+.1+.14*sin(time*.9)-vP.x*.15)/.17,2.0));
float key=pow(max(dot(R,normalize(vec3(-.35,.5,1))),0.0),25.0);
vec3 c=vec3(.22,.27,.34)+shine*(vec3(.65,.70,.77)*stripe+vec3(.8,.76,.64)*key);
c+=vec3(.07,.19,.26)*pow(max(R.x,0.0),8.0)+vec3(.19,.04,.11)*pow(max(-R.x,0.0),8.0);
c+=vec3(.24,.20,.12)*impact;gl_FragColor=vec4(c,alpha);}`;

function buildFinaleEffects(T,fxRoot,titleRoot){
  const config={hit:{power:1},fx:{beams:1,trails:1,confetti:1},title:{width:.90,y:.275,shine:1.15}};
  function dynamicGeometry(count,attributes){
    const g=new T.BufferGeometry();for(const [name,size]of Object.entries(attributes))g.addAttribute(name,new T.Float32BufferAttribute(new Float32Array(count*size),size));return g;
  }
  const beamCount=42,beamGeometry=dynamicGeometry(beamCount*6,{position:3,uv:2,tint:3,strength:1});
  const beams=new T.Mesh(beamGeometry,new T.ShaderMaterial({vertexShader:beamVertex,fragmentShader:beamFragment,transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,blending:T.AdditiveBlending}));
  beams.renderOrder=14;beams.frustumCulled=false;fxRoot.add(beams);
  const streakCount=270,streakGeometry=dynamicGeometry(streakCount*2,{position:3,color:3});
  const streaks=new T.LineSegments(streakGeometry,new T.LineBasicMaterial({vertexColors:T.VertexColors,transparent:true,opacity:.82,blending:T.AdditiveBlending,depthWrite:false}));
  streaks.frustumCulled=false;streaks.renderOrder=2;fxRoot.add(streaks);
  const confettiCount=1080,confettiGeometry=dynamicGeometry(confettiCount*6,{position:3,normal:3,foilColor:3,foilAlpha:1});
  const confetti=new T.Mesh(confettiGeometry,new T.ShaderMaterial({vertexShader:foilVertex,fragmentShader:foilFragment,transparent:true,depthWrite:false,side:T.DoubleSide}));
  confetti.frustumCulled=false;confetti.renderOrder=21;fxRoot.add(confetti);
  const shocks=[0,1,2].map(i=>{
    const g=new T.RingBufferGeometry(.995,1.005,256),m=new T.MeshBasicMaterial({color:new T.Color(...PALETTE[i]),side:T.DoubleSide,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending});
    const mesh=new T.Mesh(g,m);mesh.renderOrder=19;fxRoot.add(mesh);return mesh;
  });

  const titleLetters=[],tracking=.15,gap=.26;
  const titleAdvance=GO_WEST_TITLE_SHAPES.reduce((n,g)=>n+g.advance+tracking,0)-tracking+gap;
  let left=-titleAdvance/2;
  GO_WEST_TITLE_SHAPES.forEach((glyph,i)=>{
    if(i===2)left+=gap;
    const geo=createGoWestLetterGeometry(T,glyph);
    const material=new T.ShaderMaterial({vertexShader:titleVertex,fragmentShader:titleFragment,uniforms:{alpha:{value:0},time:{value:0},shine:{value:1},impact:{value:0}},transparent:true});
    const mesh=new T.Mesh(geo,material);mesh.position.x=left;mesh.renderOrder=9990;titleRoot.add(mesh);titleLetters.push({mesh,x:left});left+=glyph.advance+tracking;
  });

  function updateBeams(t,f,centerY){
    const a=beamGeometry.attributes,corners=[[-1,0],[1,0],[1,1],[-1,0],[1,1],[-1,1]];
    for(let i=0;i<beamCount;i++){
      const angle=i*2.39996+.16*Math.sin(t*(.35+hash(i)*.4)+i),dx=Math.cos(angle),dy=Math.sin(angle);
      const stage=(i%3),age=t-f.hits[stage],expansion=clamp(age/1.2);
      const burst=pulse(t,f.hits[stage],.48)*config.hit.power;
      const colour=PALETTE[i%6],startR=.65+.35*hash(i+34),length=2+4*hash(i+72)+expansion*2;
      const startX=dx*startR,startY=centerY+dy*startR;
      const endX=dx*length,endY=centerY+dy*length*1.4;
      const width=.05+.20*hash(i+105),intensity=(.015+.10*f.charge+.46*burst)*config.fx.beams;
      corners.forEach(([side,end],j)=>{
        const k=i*6+j,w=(end?width:.004)*side;
        a.position.setXYZ(k,(end?endX:startX)-dy*w,(end?endY:startY)+dx*w,end?-.4:.10);
        a.uv.setXY(k,(side+1)/2,end);a.tint.setXYZ(k,...colour);a.strength.setX(k,intensity);
      });
    }for(const at of Object.values(a))at.needsUpdate=true;
  }
  function updateStreaks(t,f,centerY){
    const a=streakGeometry.attributes;
    for(let i=0;i<streakCount;i++){
      const batch=i%3,age=t-f.hits[batch]-.04*hash(i+120),q=clamp(age/1.65);
      const live=age>0&&age<1.65,angle=i*2.39996+.1*hash(i+14),dx=Math.cos(angle),dy=Math.sin(angle);
      const start=.85+q*(2+hash(i)*4),length=(.04+.9*q*q)*config.fx.trails;
      const alpha=live?(1-q)*(.28+.55*hash(i+19))*config.hit.power:0;
      const colour=PALETTE[i%6];
      for(let j=0;j<2;j++){
        const k=i*2+j,r=start+j*length;a.position.setXYZ(k,dx*r,centerY+dy*r*1.6,-.25);
        a.color.setXYZ(k,colour[0]*alpha,colour[1]*alpha,colour[2]*alpha);
      }
    }for(const at of Object.values(a))at.needsUpdate=true;
  }

  function updateConfetti(t,f,centerY){
    const a=confettiGeometry.attributes;
    for(let i=0;i<confettiCount;i++){
      const batch=i%10===0?0:i%10<3?1:2;
      const age=t-f.hits[batch]-.24*hash(i+12);
      const live=age>0&&hash(i+99)<Math.min(1,config.fx.confetti*.76);
      const s=Math.max(0,age),angle=i*2.39996,radial=.45+.48*hash(i+19);
      const nx=Math.cos(angle)*radial,ny=Math.sin(angle)*radial,nz=Math.sqrt(1-radial*radial);
      const slow=hash(i+107)<.37? .35:1;
      const speed=(.85+hash(i+41)*2.6)*slow*config.hit.power;
      const x=nx*(1.03+s*speed),y=centerY+ny*(1.03+s*speed)+.7*s*slow-.22*s*s;
      const z=nz*1.03+s*(.35+hash(i+63)*1.7)*slow;
      const size=(.013+.044*hash(i+77))*(hash(i+191)>.9?1.9:1);
      const rx=i+s*(2+hash(i+93)*6),ry=i*.77+s*(2+hash(i+112)*5),rz=i*.33+s*(hash(i+12)-.5)*5;
      const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
      // Orthonormal axes give each foil rectangle a real changing orientation.
      const ux=cz*cy,uy=sz*cy,uz=-sy;
      const vx=cz*sy*sx-sz*cx,vy=sz*sy*sx+cz*cx,vz=cy*sx;
      const normalX=uy*vz-uz*vy,normalY=uz*vx-ux*vz,normalZ=ux*vy-uy*vx;
      const tint=i%7===0?PALETTE[i%6]:SILVER;
      const alpha=live?progress(s,0,.08)*(1-progress(s,4.4,6.2)):0;
      FOIL_CORNERS.forEach(([dx,dy],j)=>{
        const k=i*6+j,px=dx*size,py=dy*size*(.4+hash(i+5)*1.3);
        a.position.setXYZ(k,x+px*ux+py*vx,y+px*uy+py*vy,z+px*uz+py*vz);
        a.normal.setXYZ(k,normalX,normalY,normalZ);a.foilColor.setXYZ(k,tint[0],tint[1],tint[2]);a.foilAlpha.setX(k,alpha);
      });
    }for(const at of Object.values(a))at.needsUpdate=true;
  }
  function updateTitle(t,f,aspect,fov){
    const p=f.title,depth=mix(5,2.6,p),halfH=Math.tan(fov*DEG/2)*depth,halfW=halfH*aspect;
    const pop=1+.10*Math.sin(Math.PI*p);
    titleRoot.visible=p>0;titleRoot.position.set(.025*Math.sin(t*.55)*p,
      (.5-mix(.55,config.title.y,p))*2*halfH,-depth);
    titleRoot.scale.setScalar(2*halfW*config.title.width/titleAdvance*mix(.13,1,p)*pop);
    titleRoot.rotation.set((1-p)*.22,(-.42*(1-p)+.015*Math.sin(t)),-.06*(1-p));
    for(let i=0;i<titleLetters.length;i++){
      const {mesh,x}=titleLetters[i],u=progress(t,f.final+.06+i*.025,f.final+.65+i*.025);
      mesh.position.set(x,(1-u)*.16*Math.sin(i*2),-(1-u)*.5);
      mesh.rotation.y=(1-u)*(i%2?.5:-.5);const m=mesh.material.uniforms;
      m.alpha.value=u;m.time.value=t;m.shine.value=config.title.shine;m.impact.value=f.shock;
    }
  }
  return (f,aspect,fov)=>{
    const t=f.t;
    updateBeams(t,f,0);updateStreaks(t,f,0);updateConfetti(t,f,0);updateTitle(t,f,aspect,fov);
    shocks.forEach((ring,i)=>{
      const age=t-f.hits[i],q=clamp(age/1.25);ring.visible=age>0&&age<1.25;
      ring.position.set(0,0,.15+q*1.2);ring.scale.setScalar(1+q*q*5);
      ring.rotation.set(.10*(1-q),0,.1);ring.material.opacity=(1-q)*.85;
    });
  };
}

export class GoWestFinale {
  constructor({THREE,scene,camera,globeGroup}){
    Object.assign(this,{T:THREE,scene,camera,globeGroup});
    this.root=new THREE.Group();this.root.name='GO_WEST_FINALE';this.root.visible=false;scene.add(this.root);
    this.overlay=new THREE.Group();this.overlay.name='GO_WEST_FINALE_FOREGROUND';this.overlay.visible=false;scene.add(this.overlay);
    this.center=new THREE.Vector3();this.scale=new THREE.Vector3();this.disposed=false;
  }
  build(){
    const T=this.T;this.titleRoot=new T.Group();this.titleRoot.name='GO_WEST_FINALE_TITLE';this.overlay.add(this.titleRoot);
    this.updateEffects=buildFinaleEffects(T,this.root,this.titleRoot);
    this.flash=new T.Mesh(new T.PlaneBufferGeometry(2,2),new T.ShaderMaterial({
      vertexShader:'void main(){gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader:'precision mediump float;uniform float alpha;void main(){gl_FragColor=vec4(1.0,.957,.886,alpha);}',
      uniforms:{alpha:{value:0}},transparent:true,depthTest:false,depthWrite:false}));
    this.flash.name='GO_WEST_FINALE_FLASH';this.flash.renderOrder=10010;this.flash.frustumCulled=false;this.overlay.add(this.flash);
  }
  update(songFrame){
    if(this.disposed)return;
    const f=songFrame?goWestFinaleFrame(songFrame.time):null;
    if(!f){this.reset();return;}
    if(!this.updateEffects)this.build();
    this.frame=f;this.root.visible=this.overlay.visible=true;
    this.globeGroup.getWorldPosition(this.center);this.globeGroup.getWorldScale(this.scale);
    this.root.position.copy(this.center);this.root.quaternion.copy(this.camera.quaternion);
    this.root.scale.setScalar(Math.max(.001,this.scale.x));
    // The kick stays local to the effect rig. The live camera/rotation and
    // normal, moon and other song managers never inherit a camera offset.
    this.root.position.x+=.008*Math.sin(f.t*73)*f.kick*this.scale.x;
    this.root.position.y+=.006*Math.sin(f.t*91)*f.kick*this.scale.x;
    this.overlay.position.copy(this.camera.position);this.overlay.quaternion.copy(this.camera.quaternion);
    this.updateEffects(f,this.camera.aspect,this.camera.fov);
    this.flash.material.uniforms.alpha.value=f.flash;
    this.flash.visible=f.flash>.001;
  }
  reset(){this.frame=null;this.root.visible=this.overlay.visible=false;}
  dispose(){
    if(this.disposed)return;this.disposed=true;this.reset();
    const geometries=new Set(),materials=new Set();
    for(const root of [this.root,this.overlay]){
      root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of [].concat(o.material||[]))materials.add(m);});
      root.parent?.remove(root);
    }
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
    this.updateEffects=null;
  }
}
