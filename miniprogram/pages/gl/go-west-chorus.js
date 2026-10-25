import { GO_WEST_CUES, goWestChorusSection } from '../../assets/data/go-west-cues.js';
import { GO_WEST_TITLE_SHAPES } from '../../assets/data/go-west-title-shapes.js';
import { GO_WEST_LYRIC_CUTOFF } from './go-west-finale-timing.js';

const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const noise=i=>{const v=Math.sin(i*127.1+311.7)*43758.5453;return v-Math.floor(v);};
// Accents follow each sung lead until just before its response. The text
// remains at powered base brightness until the complete pair/section exits.
function callAccent(age,duration){
  if(age<0 || age>=duration)return 0;
  const release=Math.min(.25,duration*.25);
  return smooth(age/.055)*(1-smooth((age-duration+release)/release))*
    (.72+.28*Math.cos((age-.1)*Math.PI*2/.36));
}
export function goWestChorusFrame(time,callLeadSec=0){
  if(time>=GO_WEST_LYRIC_CUTOFF)return null;
  const source=goWestChorusSection(time,callLeadSec);if(!source)return null;
  const section={...source,end:Math.min(source.end,GO_WEST_LYRIC_CUTOFF)};
  const gatherAt=section.start-section.lead;
  const formation=smooth((time-gatherAt)/(section.lead || .5));
  // Match the native pair's fade; the last sung response owns the exit.
  const release=smooth((time-section.end+.30)/.30);
  const calls=GO_WEST_CUES.filter(c=>c.start>=section.firstSource && c.start<=section.lastSource &&
    c.callKind==='west' && !c.hidden);
  const duration=c=>Math.max(.12,c.sungResponseAt-c.sungCallAt-.05);
  const pulse=Math.max(0,...calls.map(c=>callAccent(time-c.sungCallAt,duration(c))));
  const neonAccent=Math.max(0,...calls.map((c,i)=>{
    const age=time-c.sungCallAt;
    if(section.mode==='bands'&&i===7&&age>=0)return smooth(age/.04);
    const span=duration(c),release=Math.min(.25,span*.25);
    return age>=0&&age<span?smooth(age/.04)*(1-smooth((age-span+release)/release)):0;
  }));
  const neon=.38+1.10*neonAccent;
  const callIndex=calls.reduce((last,c,i)=>time>=c.sungCallAt?i:last,-1);
  const neonStyle=Math.max(0,callIndex)%4,neonAge=callIndex<0?99:time-calls[callIndex].sungCallAt;
  const neonTube=1+([1,1.65,2.15,2.7][neonStyle]-1)*neonAccent;
  const neonHalo=1+([1,1.8,2.7,3.8][neonStyle]-1)*neonAccent;
  const neonRays=[0,0,.55,1][neonStyle]*neonAccent;
  const neonGlass=[0,.55,.8,1][neonStyle]*neonAccent;
  const cue=calls.find(c=>time>=c.callAt&&time<c.end);
  return {...section,time,formation:formation*(1-release),alpha:smooth((time-gatherAt)/.18)*(1-release),pulse,neon,neonAccent,neonStyle,neonAge,neonTube,neonHalo,neonRays,neonGlass,
    replyAge:cue?time-cue.responseAt:99};
}

function glyphShapes(T,glyph){
  const path=new T.ShapePath();
  for(const [op,...p] of glyph.path){
    if(op==='m')path.moveTo(...p);else if(op==='l')path.lineTo(...p);
    else if(op==='q')path.quadraticCurveTo(...p);else if(op==='b')path.bezierCurveTo(...p);
    else path.currentPath.closePath();
  }
  return path.toShapes();
}
// Sample actual filled glyph triangles by area. O's hole stays empty; these
// are open star formations rather than a flat glowing title texture.
// Expand outer contours and contract holes by a small glyph-space distance.
// This increases the letter's actual stroke weight, not the whole word's scale.
function weightedLoop(T,points,distance){
  const pts=points.slice();
  if(pts.length>1 && pts[0].distanceToSquared(pts[pts.length-1])<1e-12)pts.pop();
  const area=pts.reduce((sum,p,i)=>{const q=pts[(i+1)%pts.length];return sum+p.x*q.y-q.x*p.y;},0);
  const sign=area>=0?1:-1;
  return pts.map((p,i)=>{
    const a=pts[(i+pts.length-1)%pts.length],b=pts[(i+1)%pts.length];
    const edge=(u,v)=>{const dx=v.x-u.x,dy=v.y-u.y,length=Math.hypot(dx,dy)||1;return [sign*dy/length,-sign*dx/length];};
    const n=edge(a,p),m=edge(p,b),den=Math.max(.5,1+n[0]*m[0]+n[1]*m[1]);
    return new T.Vector2(p.x+distance*(n[0]+m[0])/den,p.y+distance*(n[1]+m[1])/den);
  });
}
export function createGoWestSkyGlyphs(T,count=1900){
  const tracking=.12,gap=.30,total=GO_WEST_TITLE_SHAPES.reduce((s,g)=>s+g.advance+tracking,0)-tracking+gap;
  const triangles=[],contours=[];let x=-total/2,area=0;
  GO_WEST_TITLE_SHAPES.forEach((glyph,index)=>{
    if(index===2)x+=gap;
    const shapes=glyphShapes(T,glyph);
    const weighted=shapes.map(shape=>{
      const points=shape.extractPoints(10),bold=new T.Shape(weightedLoop(T,points.shape,.024));
      bold.holes=points.holes.map(hole=>new T.Path(weightedLoop(T,hole,-.024)));return bold;
    });
    const geometry=new T.ShapeBufferGeometry(weighted,10);
    const p=geometry.attributes.position,indices=geometry.index;
    for(let i=0;i<(indices?indices.count:p.count);i+=3){
      const ids=[0,1,2].map(n=>indices?indices.getX(i+n):i+n);
      const v=ids.map(id=>[(p.getX(id)+x)/total,(p.getY(id)-.5)/total]);
      const a=Math.abs((v[1][0]-v[0][0])*(v[2][1]-v[0][1])-(v[2][0]-v[0][0])*(v[1][1]-v[0][1]))/2;
      if(a>0){area+=a;triangles.push({v,area});}
    }
    geometry.dispose();
    for(const shape of shapes){
      const points=shape.extractPoints(10);
      for(const loop of [points.shape,...points.holes])contours.push({letter:index,
        points:loop.map(p=>[(p.x+x)/total,(p.y-.5)/total])});
    }
    x+=glyph.advance+tracking;
  });
  const targets=new Float32Array(count*3);
  for(let i=0;i<count;i++){
    const value=noise(i+1)*area,t=triangles.find(t=>t.area>=value),a=Math.sqrt(noise(i+700)),b=noise(i+1700);
    for(let axis=0;axis<2;axis++)targets[i*3+axis]=(1-a)*t.v[0][axis]+a*(1-b)*t.v[1][axis]+a*b*t.v[2][axis];
  }
  return {targets,contours};
}
const pointVertex=`attribute vec3 target;attribute float seed;
 uniform float formation,time,width,aspect,center,pulse,pixelRatio,alpha;
 varying float brightness;varying vec3 tint;
 void main(){float gather=smoothstep(seed*.12,1.0,formation);
 vec2 dest=vec2(target.x*width*2.0,target.y*width*2.0*aspect+center);
 vec2 p=mix(position.xy,dest,gather);
 p+=sin(3.14159265*gather)*vec2(sin(seed*27.0)*.22,cos(seed*19.0)*.18);
 p+=vec2(sin(time*.7+seed*30.0),cos(time*.6+seed*23.0))*.0015*gather;
 gl_Position=vec4(p,.9998,1.0);
 float twinkle=.75+.25*sin(time*(1.0+seed)+seed*50.0);
 brightness=alpha*(.22+.78*gather)*twinkle*(1.0+pulse*(.60+.85*seed));
 tint=mix(vec3(.43,.72,1.0),vec3(.77,.64,1.0),seed);
 tint=mix(tint,vec3(.96,.86,.64),step(.91,seed)*.65);
 gl_PointSize=(1.8+seed*1.8+pulse*1.25)*pixelRatio;}`;
const pointFragment=`precision mediump float;varying float brightness;varying vec3 tint;
 void main(){vec2 p=gl_PointCoord-.5;float r=dot(p,p);
 float glow=exp(-r*65.0)+.20*exp(-r*12.0);
 gl_FragColor=vec4(tint,glow*brightness);}`;
const bandVertex=`attribute float travel,layer,tubeSide;attribute vec2 tubeOffset;
 uniform float width,aspect,center,pulse,time,neonStyle,neonAge,neonAccent,neonTube,neonHalo;
 varying float pathAt,bandLayer,wordAt,crossTube;
 void main(){pathAt=travel;bandLayer=layer;wordAt=position.x+.5;crossTube=tubeSide;
 float thickness=layer==0.0?neonTube:neonHalo;
 vec2 tube=position.xy+tubeOffset*(thickness-1.0);
 vec2 p=vec2(tube.x*width*2.0,tube.y*width*2.0*aspect+center);
 p.x+=layer*.0025*sin(time*.8)*(.4+pulse);p.y+=layer*.002*aspect*pulse;
 if(neonStyle>2.5){p.x+=layer*.004*neonAccent*sin(neonAge*4.0);p.y+=layer*.003*aspect*neonAccent;}
 gl_Position=vec4(p,.9997,1.0);}`;
const bandFragment=`precision highp float;varying float pathAt,bandLayer,wordAt,crossTube;
 uniform float formation,time,pulse,alpha,neon,neonAccent,neonStyle,neonAge,neonGlass;
 void main(){float reveal=1.0-smoothstep(formation-.035,formation+.035,pathAt);
 float age=max(neonAge,0.0),gain=1.0;
 vec3 electric=mix(vec3(.20,.54,1.0),vec3(.65,.29,1.0),wordAt);
 vec3 effect=electric;
 if(neonStyle<.5){
   float front=-.12+1.24*clamp(age/1.20,0.0,1.0);
   float head=exp(-pow((wordAt-front)/.16,2.0));
   float wake=1.0-smoothstep(front-.10,front+.10,wordAt);
   gain=.32+.62*wake+1.15*head;
   effect=mix(vec3(.10,.72,1.0),vec3(.85,.97,1.0),head);
 }else if(neonStyle<1.5){
   float distanceOut=abs(wordAt-.5)*2.0,front=clamp(age/1.15,0.0,1.0);
   float head=exp(-pow((distanceOut-front)/.18,2.0));
   float wake=1.0-smoothstep(front-.10,front+.10,distanceOut);
   gain=.30+.65*wake+1.15*head;
   effect=mix(vec3(1.0,.20,.63),vec3(1.0,.85,.40),clamp(head+.25*distanceOut,0.0,1.0));
 }else if(neonStyle<2.5){
   float parity=mod(min(5.0,floor(pathAt*6.0)),2.0);
   float wave=.5+.5*cos(age*7.39198-parity*3.14159265);
   gain=.28+1.30*wave*wave;
   effect=mix(vec3(.10,.88,1.0),vec3(1.0,.24,.78),parity);
   effect=mix(effect,vec3(.82,.95,1.0),pow(wave,8.0)*.45);
 }else{
   float around=fract(pathAt*6.0),front=fract(age*.85);
   float d=abs(around-front);d=min(d,1.0-d);
   float opposite=abs(around-fract(front+.5));opposite=min(opposite,1.0-opposite);
   float head=exp(-pow(d/.12,2.0)),echo=exp(-pow(opposite/.18,2.0));
   gain=.38+1.35*head+.65*echo;
   effect=.55+.45*cos(6.2831853*(around-age*.45)+vec3(0.0,2.0944,4.1888));
   effect=mix(effect,vec3(.84,.98,1.0),head*.65);
 }
 vec3 colour=mix(electric,effect,neonAccent);
 float roundness=sqrt(max(0.0,1.0-crossTube*crossTube));
 float filament=exp(-pow((crossTube-.18*sin(pathAt*160.0-age*16.0))/.20,2.0));
 float glassShine=exp(-pow((crossTube+.45)/.16,2.0));
 if(bandLayer==0.0){
   colour*=mix(1.0,.48+.52*roundness,neonGlass);
   colour+=vec3(.56,.76,1.0)*glassShine*neonGlass;
   colour+=vec3(.74,.88,1.0)*filament*neonGlass*(.35+.25*neonStyle);
 }
 float strength=bandLayer==0.0?.95:(.10+.24*neonAccent)*exp(-crossTube*crossTube*3.2);
 float crescendo=1.0+.16*neonStyle*neonAccent;
 gl_FragColor=vec4(colour,alpha*reveal*strength*neon*mix(1.0,gain,neonAccent)*crescendo);}`;
const rayVertex=`attribute vec2 direction;attribute float seed;uniform float width,aspect,center,neonAge,neonRays;
 varying vec2 rayUv;varying float raySeed;
 void main(){rayUv=uv;raySeed=seed;
 float launch=smoothstep(0.0,.28,neonAge);
 float length=(.045+.160*seed)*neonRays*(.25+.75*launch);
 vec2 base=vec2(position.x*width*2.0,position.y*width*2.0*aspect+center);
 vec2 dir=vec2(direction.x*width*2.0,direction.y*width*2.0*aspect);
 float room=max(0.0,.977-abs(base.x));
 length=min(length,room/max(.001,abs(dir.x)));
 float side=(uv.x-.5)*(.0020+.0045*seed)*(1.0-.86*uv.y)*neonRays;
 vec2 p=base+dir*length*uv.y+vec2(-direction.y,direction.x*aspect)*side;
 gl_Position=vec4(p,.99965,1.0);}`;
const rayFragment=`precision highp float;uniform float alpha,neonRays,neonAge;
 varying vec2 rayUv;varying float raySeed;
 void main(){float edge=exp(-pow((rayUv.x-.5)*4.0,2.0));
 float tail=pow(1.0-rayUv.y,1.4),energy=.70+.30*cos(neonAge*8.0+raySeed*24.0);
 vec3 colour=mix(vec3(.28,.52,1.0),vec3(.87,.96,1.0),tail);
 gl_FragColor=vec4(colour,alpha*neonRays*edge*tail*energy*1.10);}`;
const sparkVertex=`attribute float seed;uniform float age,aspect,pixelRatio;
 varying float gain;
 void main(){float p=clamp(age/.85,0.0,1.0);
 vec2 at=position.xy+vec2(sin(seed*33.0)*.03,cos(seed*17.0)*.025)*p;
 gl_Position=vec4(at.x,at.y,.9996,1.0);
 gl_PointSize=(2.0+seed*3.0)*pixelRatio;
 gain=age>=0.0&&age<.85?sin(3.14159265*p)*(1.0-p):0.0;}`;
const sparkFragment=`precision mediump float;varying float gain;
 void main(){vec2 p=gl_PointCoord-.5;gl_FragColor=vec4(.61,.74,1.0,exp(-dot(p,p)*40.0)*gain);}`;

export class GoWestChorusSky{
  constructor({THREE:T,scene,camera,getViewport,getStars}){
    Object.assign(this,{T,camera,getViewport,getStars});this.root=new T.Group();this.root.name='GO_WEST_CHORUS_SKY';
    scene.add(this.root);this.root.visible=false;this.geometries=[];this.materials=[];this.borrowed=[];
  }
  material(vertexShader,fragmentShader,uniforms){
    const m=new this.T.ShaderMaterial({vertexShader,fragmentShader,uniforms,transparent:true,
      blending:this.T.AdditiveBlending,depthTest:true,depthWrite:false});this.materials.push(m);return m;
  }
  build(){
    const T=this.T,{targets,contours}=createGoWestSkyGlyphs(T);
    const g=new T.BufferGeometry(),homes=new Float32Array(targets.length),seeds=new Float32Array(targets.length/3);
    for(let i=0;i<seeds.length;i++){homes[i*3]=noise(i+200)*2-1;homes[i*3+1]=noise(i+500)*2-1;seeds[i]=noise(i+800);}
    g.addAttribute('position',new T.Float32BufferAttribute(homes,3));g.addAttribute('target',new T.Float32BufferAttribute(targets,3));
    g.addAttribute('seed',new T.Float32BufferAttribute(seeds,1));this.geometries.push(g);
    const uniforms={formation:{value:0},time:{value:0},width:{value:.93},aspect:{value:.5},center:{value:.46},
      pulse:{value:0},neon:{value:0},neonAccent:{value:0},neonStyle:{value:0},neonAge:{value:99},
      neonTube:{value:1},neonHalo:{value:1},neonRays:{value:0},neonGlass:{value:0},pixelRatio:{value:2},alpha:{value:0}};
    this.points=new T.Points(g,this.material(pointVertex,pointFragment,uniforms));this.points.frustumCulled=false;
    this.root.add(this.points);
    const positions=[],travel=[],layers=[],tubeOffsets=[],tubeSides=[];
    for(const contour of contours){const pts=contour.points,lengths=[0];let length=0;
      for(let i=1;i<pts.length;i++){length+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);lengths.push(length);}
      for(const layer of [-1,0,1])for(let i=1;i<pts.length;i++){
        const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
        const half=layer===0?.0025:.0044,ox=-dy/len*half,oy=dx/len*half;
        for(const [p,side,at] of [[a,-1,i-1],[a,1,i-1],[b,1,i],[a,-1,i-1],[b,1,i],[b,-1,i]]){
          positions.push(p[0]+side*ox+layer*.002,p[1]+side*oy+layer*.001,0);
          tubeOffsets.push(side*ox+layer*.002,side*oy+layer*.001);tubeSides.push(side);
          travel.push((contour.letter+lengths[at]/Math.max(.0001,length))/6);layers.push(layer);
        }
      }
    }
    const bg=new T.BufferGeometry();bg.addAttribute('position',new T.Float32BufferAttribute(positions,3));
    bg.addAttribute('travel',new T.Float32BufferAttribute(travel,1));bg.addAttribute('layer',new T.Float32BufferAttribute(layers,1));
    bg.addAttribute('tubeOffset',new T.Float32BufferAttribute(tubeOffsets,2));bg.addAttribute('tubeSide',new T.Float32BufferAttribute(tubeSides,1));
    this.geometries.push(bg);this.bands=new T.Mesh(bg,this.material(bandVertex,bandFragment,{...uniforms}));
    this.bands.material.side=T.DoubleSide;this.bands.frustumCulled=false;this.root.add(this.bands);
    // Rays originate on the six actual outer glyph contours. They do not fill
    // O's hole, change the word's scale, or allocate new buffers every call.
    const rp=[],rd=[],ru=[],rs=[],corners=[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]];
    const area=pts=>Math.abs(pts.reduce((n,p,i)=>{const q=pts[(i+1)%pts.length];return n+p[0]*q[1]-q[0]*p[1];},0));
    for(let letter=0;letter<6;letter++){
      const outline=contours.filter(c=>c.letter===letter).sort((a,b)=>area(b.points)-area(a.points))[0].points;
      const mid=outline.reduce((n,p)=>[n[0]+p[0]/outline.length,n[1]+p[1]/outline.length],[0,0]);
      for(let i=0;i<20;i++){
        const at=outline[Math.floor(i*(outline.length-1)/20)],dx=at[0]-mid[0],dy=at[1]-mid[1],len=Math.hypot(dx,dy)||1;
        for(const uv of corners){rp.push(...at,0);rd.push(dx/len,dy/len);ru.push(...uv);rs.push(noise(letter*20+i+2400));}
      }
    }
    const rg=new T.BufferGeometry();rg.addAttribute('position',new T.Float32BufferAttribute(rp,3));
    rg.addAttribute('direction',new T.Float32BufferAttribute(rd,2));rg.addAttribute('uv',new T.Float32BufferAttribute(ru,2));rg.addAttribute('seed',new T.Float32BufferAttribute(rs,1));
    this.geometries.push(rg);this.rays=new T.Mesh(rg,this.material(rayVertex,rayFragment,{...uniforms}));
    this.rays.material.side=T.DoubleSide;this.rays.frustumCulled=false;this.rays.visible=false;this.root.add(this.rays);
    const sg=new T.BufferGeometry(),sp=new Float32Array(64*3),ss=new Float32Array(64);
    for(let i=0;i<64;i++){sp[i*3]=(noise(i+900)-.5)*1.65;sp[i*3+1]=.34+(noise(i+1000)-.5)*.07;ss[i]=noise(i+1200);}
    sg.addAttribute('position',new T.Float32BufferAttribute(sp,3));sg.addAttribute('seed',new T.Float32BufferAttribute(ss,1));
    this.geometries.push(sg);this.sparks=new T.Points(sg,this.material(sparkVertex,sparkFragment,
      {age:{value:99},aspect:{value:.5},pixelRatio:{value:2}}));this.sparks.frustumCulled=false;this.root.add(this.sparks);
  }
  releaseStars(){
    for(const item of this.borrowed)item.attribute.setX(item.index,item.size);
    if(this.borrowed.length)this.borrowed[0].attribute.needsUpdate=true;
    this.borrowed=[];this.starMesh=null;this.borrowMix=null;
  }
  captureStars(){
    this.releaseStars();const mesh=this.getStars?.(),attribute=mesh?.geometry?.attributes?.size;
    const p=mesh?.geometry?.attributes?.position;if(!p || !attribute)return;
    mesh.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);
    const T=this.T,point=new T.Vector3(),sources=[];
    for(let i=0;i<p.count && sources.length<220;i++){
      point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).project(this.camera);
      if(point.z>-1&&point.z<1&&Math.abs(point.x)<1.05&&Math.abs(point.y)<1.05){
        sources.push([point.x,point.y]);this.borrowed.push({attribute,index:i,size:attribute.getX(i)});
      }
    }
    const homes=this.points.geometry.attributes.position;
    for(let i=0;i<homes.count;i++){
      const source=sources[i%sources.length];
      homes.setXYZ(i,source?source[0]:noise(i+200)*2-1,source?source[1]:noise(i+500)*2-1,0);
    }
    homes.needsUpdate=true;this.starMesh=mesh;
  }
  update(time,callLeadSec=0){
    if(this.disposed)return;
    const f=time==null?null:goWestChorusFrame(time,callLeadSec);
    if(!f){this.root.visible=false;this.section=null;this.releaseStars();return;}
    if(!this.points)this.build();
    if(this.section!==f.id || (f.mode==='stars' && this.starMesh!==(this.getStars?.() || null))){
      this.section=f.id;if(f.mode==='stars')this.captureStars();else this.releaseStars();
    }
    this.root.visible=true;this.points.visible=f.mode==='stars';this.bands.visible=f.mode==='bands';
    const vp=this.getViewport(),aspect=vp.windowWidth/vp.windowHeight;
    const u=this.points.material.uniforms;
    u.time.value=time;u.formation.value=f.formation;u.alpha.value=f.alpha;
    u.width.value=f.small ? .43 : .93;u.center.value=f.small ? .49 : .46;
    u.aspect.value=aspect;u.neon.value=f.neon;u.neonAccent.value=f.neonAccent;
    u.neonStyle.value=f.neonStyle;u.neonAge.value=f.neonAge;
    for(const key of ['neonTube','neonHalo','neonRays','neonGlass'])u[key].value=f[key];
    this.rays.visible=f.mode==='bands'&&f.neonRays>0;
    u.pulse.value=f.pulse*(f.id==='a2'?1.12:1);
    u.pixelRatio.value=Math.min(3,vp.pixelRatio || 2);
    const borrowMix=f.formation*f.alpha;
    if(borrowMix!==this.borrowMix){
      for(const item of this.borrowed)item.attribute.setX(item.index,item.size*(1-borrowMix));
      if(this.borrowed.length)this.borrowed[0].attribute.needsUpdate=true;
      this.borrowMix=borrowMix;
    }
    this.sparks.visible=f.mode==='stars'&&f.replyAge>=0&&f.replyAge<.85;
    this.sparks.material.uniforms.age.value=f.replyAge;
    this.sparks.material.uniforms.pixelRatio.value=u.pixelRatio.value;
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.releaseStars();this.root.parent?.remove(this.root);
    this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());
  }
}
