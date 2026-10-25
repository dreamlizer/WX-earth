import { GO_WEST_TITLE_SHAPES } from '../../assets/data/go-west-title-shapes.js';
import { GO_WEST_ARTIST_SHAPES } from '../../assets/data/go-west-artist-shapes.js';
import { goWestOpeningFragment } from './go-west-opening-motion.js';

const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};

export function goWestTitleFrame(time,firstLyricMs){
  const gone=firstLyricMs/1000-4.8;
  const approach=smooth((time-5.5)/7.7),exit=smooth((time-gone+2.2)/2.2);
  const cruise=smooth((time-13.2)/Math.max(1,gone-2.2-13.2));
  const creditCruise=smooth((time-15.9)/Math.max(1,gone-2.6-15.9));
  const alpha=smooth((time-5.5)/1.5)*(1-smooth((exit-.78)/.22));
  const artistIn=smooth((time-10.2)/5.7),artistExit=smooth((time-gone+2.6)/2.6);
  return {alpha,approach,exit,artistExit,exitAt:gone-2.2,artistExitAt:gone-2.6,gone,
    depth:5.6-3.3*approach-.28*cruise+3*exit,
    x:-.025+.065*cruise+.005*Math.sin(time*.55),
    y:.045*(1-approach)-.02*cruise,
    yaw:(-58*(1-approach)+(-7+16*cruise)*approach)*Math.PI/180+1.2*exit,
    pitch:(15*(1-approach)+(-3+9*cruise)*approach)*Math.PI/180-.25*exit,
    roll:(-6*(1-approach)+(-1.8+3.6*cruise)*approach)*Math.PI/180+.12*exit,
    // The title is nearly front-facing before the credit begins to grow from
    // the Earth's upper surface, on its own path toward the title.
    artistAlpha:smooth((time-10.2)/3.2)*(1-smooth((artistExit-.78)/.22)),artistRise:artistIn,
    artistX:.10*(1-artistIn)-.055*creditCruise-.18*artistExit,
    artistY:-.065*(1-artistIn)-.015*creditCruise-.055*artistExit,
    artistDepth:2.4-.18*creditCruise+.5*artistExit,
    artistPitch:-.12*(1-artistIn)+.06*creditCruise,
    artistRoll:(-15*(1-artistIn)-2*artistIn+5*creditCruise)*Math.PI/180,
    artistScale:.70+.30*artistIn+.12*creditCruise};
}

// Opposite curved paths around the live globe, ending beyond its back surface.
// The depth buffer, rather than a screen-space mask, hides the retreating text.
export function goWestRetreatPoint(start,earth,radius,progress,side){
  const t=smooth(progress),a=(1-t)*(1-t),b=2*t*(1-t),c=t*t;
  return {x:a*start.x+b*(earth.x+side*.45*radius)+c*(earth.x+side*.12*radius),
    y:a*start.y+b*(earth.y+1.10*radius)+c*(earth.y+.12*radius),
    z:a*start.z+b*(earth.z+.25*radius)+c*(earth.z-1.35*radius)};
}

const vertex=`varying vec2 texCoord;varying vec3 viewNormal,viewPosition;
 void main(){texCoord=uv;viewNormal=normalize(normalMatrix*normal);
 vec4 p=modelViewMatrix*vec4(position,1.0);viewPosition=-p.xyz;
 gl_Position=projectionMatrix*p;}`;
// Polished metal reflects an analytic studio environment. Bevel and side-wall
// normals catch different softboxes; no rectangular sign or raster title face.
const metal=`precision mediump float;varying vec3 viewNormal,viewPosition;
 uniform float alpha,time;
 void main(){vec3 N=normalize(viewNormal),V=normalize(viewPosition);
 vec3 R=reflect(-V,N);
 float key=pow(max(dot(R,normalize(vec3(-.35,.55,1.0))),0.0),24.0);
 float ribbon=exp(-pow((R.y+.13+.04*sin(time*.19))/.16,2.0));
 float cool=pow(max(dot(R,normalize(vec3(.85,.05,.5))),0.0),14.0);
 float warm=pow(max(dot(R,normalize(vec3(-.65,-.45,.55))),0.0),18.0);
 float fresnel=.82+.18*pow(1.0-max(dot(N,V),0.0),5.0);
 vec3 environment=vec3(.16,.20,.25)+vec3(.64,.72,.78)*ribbon+
   vec3(.95,.93,.85)*key+vec3(.16,.43,.62)*cool+vec3(.52,.34,.16)*warm;
 gl_FragColor=vec4(environment*fresnel,alpha);}`;
const ink=`precision mediump float;varying vec3 viewNormal,viewPosition;
 uniform vec3 tint;uniform float alpha,time;
 void main(){vec3 N=normalize(viewNormal),V=normalize(viewPosition),R=reflect(-V,N);
 float silk=.90+.10*sin(time*.8+viewPosition.x*3.0);
 float bevel=.84+.16*abs(N.z);
 gl_FragColor=vec4(tint*silk*bevel+vec3(.06,.045,.05)*pow(max(R.y,0.0),8.0),alpha);}`;

export function splitGoWestLetter(T,geometry,letterIndex){
  const source=geometry.index?geometry.toNonIndexed():geometry,position=source.attributes.position;
  const angle=letterIndex%2?-.48:.40,ax=Math.sin(angle),ay=Math.cos(angle);
  let low=Infinity,high=-Infinity;
  for(let v=0;v<position.count;v++){const d=position.getX(v)*ax+position.getY(v)*ay;low=Math.min(low,d);high=Math.max(high,d);}
  const bins=Array.from({length:3},()=>({position:[],normal:[],uv:[]}));
  for(let v=0;v<position.count;v+=3){
    let middle=0;for(let j=0;j<3;j++)middle+=(position.getX(v+j)*ax+position.getY(v+j)*ay)/3;
    const bin=bins[Math.min(2,Math.floor(3*(middle-low)/(high-low)))];
    for(const [name,a]of Object.entries(source.attributes))if(bin[name]){
      for(let j=0;j<3;j++)for(let k=0;k<a.itemSize;k++)bin[name].push(a.array[(v+j)*a.itemSize+k]);
    }
  }
  const parts=bins.filter(b=>b.position.length).map(data=>{
    const part=new T.BufferGeometry();for(const [name,a]of Object.entries(data))part.addAttribute(name,new T.Float32BufferAttribute(a,name==='uv'?2:3));
    part.computeBoundingBox();const center=part.boundingBox.getCenter(new T.Vector3());part.translate(-center.x,-center.y,-center.z);
    return {geometry:part,center};
  });
  if(source!==geometry)source.dispose();return parts;
}

export function createGoWestLetterGeometry(T,glyph){
  const path=new T.ShapePath();
  for(const [op,...p] of glyph.path){
    if(op==='m')path.moveTo(...p);
    else if(op==='l')path.lineTo(...p);
    else if(op==='q')path.quadraticCurveTo(...p);
    else if(op==='b')path.bezierCurveTo(...p);
    else path.currentPath.closePath();
  }
  const geometry=new T.ExtrudeBufferGeometry(path.toShapes(),{depth:.20,steps:1,curveSegments:10,
    bevelEnabled:true,bevelThickness:.028,bevelSize:.018,bevelSegments:3});
  geometry.translate(0,-.5,-.10);return geometry;
}

export class GoWestOpening3D {
  constructor({THREE:T,parent,maps}){
    this.T=T;this.root=new T.Group();this.root.name='GO_WEST_FLOATING_LETTERS';parent.add(this.root);
    this.title=new T.Group();this.title.name='GO_WEST_METAL_TITLE';this.root.add(this.title);
    this.geometries=new Set();this.materials=new Set();this.letters=[];
    this.chinese=new T.Group();this.chinese.name='GO_WEST_TRANSITION_CHINESE';this.root.add(this.chinese);
    this.chineseSprites=new Map();this.chineseTextures=new Set();
    const material=new T.ShaderMaterial({uniforms:{alpha:{value:0},time:{value:0}},
      vertexShader:vertex,fragmentShader:metal,transparent:true,depthTest:true,depthWrite:true});
    this.materials.add(material);this.metal=material;
    const tracking=.12,wordGap=.30;
    const total=GO_WEST_TITLE_SHAPES.reduce((n,g)=>n+g.advance+tracking,0)-tracking+wordGap;
    let x=-total/2;
    GO_WEST_TITLE_SHAPES.forEach((glyph,i)=>{
      if(i===2)x+=wordGap;
      const geometry=createGoWestLetterGeometry(T,glyph);
      const mesh=new T.Group();mesh.name='GO_WEST_LETTER_'+glyph.char;mesh.position.x=x;this.title.add(mesh);
      const parts=splitGoWestLetter(T,geometry,i).map(({geometry,center})=>{
        this.geometries.add(geometry);const m=material.clone();m.side=T.DoubleSide;this.materials.add(m);
        const part=new T.Mesh(geometry,m);part.renderOrder=9980;mesh.add(part);return {mesh:part,center};
      });geometry.dispose();
      this.letters.push({mesh,x,parts});x+=glyph.advance+tracking;
    });
    this.titleUnit=total;
    this.artist=new T.Group();this.artist.name='PET_SHOP_BOYS_INDEPENDENT';this.artistMaterials=[];
    this.root.add(this.artist);const credit='Pet Shop Boys',space=.14;
    this.artistUnit=Array.from(credit).reduce((n,c)=>n+GO_WEST_ARTIST_SHAPES[c].advance+space,0)-space;
    let left=-this.artistUnit/2;
    Array.from(credit).forEach((char,i)=>{
      const glyph=GO_WEST_ARTIST_SHAPES[char];
      if(glyph.path.length){
        const path=new T.ShapePath();for(const [op,...p]of glyph.path){
          if(op==='m')path.moveTo(...p);else if(op==='l')path.lineTo(...p);else if(op==='q')path.quadraticCurveTo(...p);else if(op==='b')path.bezierCurveTo(...p);else path.currentPath.closePath();
        }
        const geometry=new T.ExtrudeBufferGeometry(path.toShapes(),{depth:.025,steps:1,curveSegments:8,
          bevelEnabled:true,bevelThickness:.003,bevelSize:.002,bevelSegments:2});geometry.translate(left,-.26,-.0125);this.geometries.add(geometry);
        const p=i/(credit.length-1),tint=new T.Vector3(1-.27*p,.59,.48+.52*p);
        const m=new T.ShaderMaterial({uniforms:{alpha:{value:0},time:{value:0},tint:{value:tint}},
          vertexShader:vertex,fragmentShader:ink,transparent:true,depthTest:true,depthWrite:true,side:T.DoubleSide});
        this.materials.add(m);this.artistMaterials.push(m);const mesh=new T.Mesh(geometry,m);mesh.renderOrder=9981;this.artist.add(mesh);
      }left+=glyph.advance+space;
    });this.root.visible=false;
  }
  update(time,firstLyricMs,topPx,viewport,camera,rows=[],bottom=10,earthAnchor=null,earthBody=null,lyricTime=time){
    const f=goWestTitleFrame(time,firstLyricMs);
    this.updateChinese(lyricTime,rows,bottom,viewport,camera);
    this.root.visible=f.alpha>0||f.artistAlpha>0||this.chinese.visible;
    this.title.visible=f.alpha>0;this.artist.visible=f.artistAlpha>0;
    if(!this.root.visible)return;
    const titleFrame=f.exit>0?goWestTitleFrame(f.exitAt,firstLyricMs):f;
    const creditFrame=f.artistExit>0?goWestTitleFrame(f.artistExitAt,firstLyricMs):f;
    const titleH=2*titleFrame.depth*Math.tan(camera.fov*Math.PI/360),titleW=titleH*camera.aspect;
    this.title.position.set(titleW*titleFrame.x,titleH*(.5-.39-titleFrame.y),-titleFrame.depth);
    this.title.rotation.set(titleFrame.pitch,titleFrame.yaw,titleFrame.roll);this.title.scale.setScalar(titleW*.80/this.titleUnit);
    this.letters.forEach(({mesh,x,parts},i)=>{
      mesh.position.set(x,0,0);mesh.rotation.set(0,0,0);
      parts.forEach(({mesh:part,center},j)=>{
        const p=goWestOpeningFragment(time,i,j);
        part.position.set(center.x+p.x,center.y+p.y,center.z+p.z);part.rotation.set(p.rx,p.ry,p.rz);part.scale.setScalar(p.scale);
        part.material.uniforms.alpha.value=f.alpha*p.alpha;part.material.uniforms.time.value=time;
      });
    });
    this.metal.uniforms.alpha.value=f.alpha;this.metal.uniforms.time.value=time;
    // Use its own depth and screen conversion, independent from the title's
    // scale, position and rotations throughout entrance and retreat.
    const artistH=2*creditFrame.artistDepth*Math.tan(camera.fov*Math.PI/360),artistW=artistH*camera.aspect;
    this.artist.position.set(artistW*creditFrame.artistX,
      artistH*(.5-.51+creditFrame.artistY),-creditFrame.artistDepth);
    const origin=earthAnchor || new this.T.Vector3(0,-10*Math.tan(camera.fov*Math.PI/360)*.12,-5);
    this.artist.position.lerpVectors(origin,this.artist.position,f.artistRise);
    this.artist.rotation.set(creditFrame.artistPitch,0,creditFrame.artistRoll);
    this.artist.scale.setScalar(artistW*.56*creditFrame.artistScale/this.artistUnit);
    const body=earthBody || {center:{x:origin.x,y:origin.y-.8,z:origin.z-.63},radius:1};
    if(f.exit>0){
      const p=goWestRetreatPoint(this.title.position,body.center,body.radius,(time-f.exitAt)/(f.gone-f.exitAt),1);
      this.title.position.set(p.x,p.y,p.z);this.title.scale.multiplyScalar(1-.30*clamp((time-f.exitAt)/(f.gone-f.exitAt)));this.title.rotation.y+=f.exit*.7;this.title.rotation.x+=f.exit*.25;
    }
    if(f.artistExit>0){
      const p=goWestRetreatPoint(this.artist.position,body.center,body.radius,(time-f.artistExitAt)/(f.gone-f.artistExitAt),-1);
      this.artist.position.set(p.x,p.y,p.z);this.artist.scale.multiplyScalar(1-.20*clamp((time-f.artistExitAt)/(f.gone-f.artistExitAt)));this.artist.rotation.x+=f.artistExit*Math.PI*2;
      this.artist.rotation.z-=f.artistExit*.15;
    }
    this.artistMaterials.forEach(m=>{m.uniforms.alpha.value=f.artistAlpha;m.uniforms.time.value=time;});
  }
  updateChinese(time,rows,bottom,viewport,camera){
    const T=this.T,active=rows.filter(row=>['tableau','choir'].includes(row.style) && time>=row.callAt && time<row.end);
    this.chinese.visible=active.length>0;
    this.chineseSprites.forEach(sprite=>sprite.visible=false);
    if(!this.chinese.visible)return;
    const depth=1.8,screenH=2*depth*Math.tan(camera.fov*Math.PI/360),pixel=screenH/viewport.windowHeight;
    for(const row of active)for(const role of ['call','response']){
      const choir=row.style==='choir';
      if(choir && role!=='call')continue;
      const text=row[role],at=row[role+'At'],size=row[role+'Size'];
      if(!text || time<at)continue;
      const key=[row.style,row.row,role,text,size].join(':');let sprite=this.chineseSprites.get(key);
      if(!sprite){
        // Same offscreen-canvas texture path as project text-sprite labels.
        // These short labels own their textures and never enter the global cache.
        const canvas=typeof wx!=='undefined' && wx.createOffscreenCanvas?.({type:'2d',width:1,height:1});
        if(!canvas)continue;
        let ctx=canvas.getContext('2d');const ratio=3;
        ctx.font=`400 ${size*ratio}px sans-serif`;
        const w=Math.ceil(ctx.measureText(text).width+12*ratio),h=Math.ceil(size*ratio*1.8);
        canvas.width=w;canvas.height=h;ctx=canvas.getContext('2d');
        ctx.clearRect(0,0,w,h);ctx.font=`400 ${size*ratio}px sans-serif`;
        ctx.textBaseline='middle';ctx.fillStyle='#ffffff';ctx.fillText(text,6*ratio,h/2);
        const map=new T.CanvasTexture(canvas);map.minFilter=map.magFilter=T.LinearFilter;
        map.generateMipmaps=false;this.chineseTextures.add(map);
        const colour=choir?0x9dbbcc:role==='response'?0xb9b1d0:row.row===2?0xd6ccb7:0xa8c0d1;
        const material=new T.SpriteMaterial({map,color:colour,transparent:true,depthTest:false,depthWrite:false});
        this.materials.add(material);sprite=new T.Sprite(material);sprite.renderOrder=20000;
        sprite.userData.width=w/ratio;sprite.userData.height=h/ratio;this.chinese.add(sprite);this.chineseSprites.set(key,sprite);
      }
      const age=Math.max(0,time-at),flow=clamp(age/Math.max(.1,row.end-at));
      const width=sprite.userData.width,height=sprite.userData.height;
      const x=choir?0:row.row===0?-viewport.windowWidth*.38+width/2:row.row===2?viewport.windowWidth*.38-width/2:0;
      const y=choir?viewport.windowHeight-bottom-65+11.5:
        viewport.windowHeight-bottom-row.bottomOffset-58+(role==='call'?12:38);
      const enter=smooth(age/(choir?.35:1.1)),fade=smooth((row.end-time)/Math.min(.33,(row.end-at)*.24));
      sprite.visible=true;sprite.material.opacity=enter*fade*(choir?1:.87);
      if(choir){
        // Foreground text avoids the native overlay's cropped top edge when
        // the large choir response occupies the adjacent compositor surface.
        const canvasHeight=viewport.windowWidth/camera.aspect,canvasPixel=screenH/canvasHeight;
        sprite.position.set(0,(canvasHeight/2-y-4*(1-enter))*canvasPixel,-depth);
        sprite.scale.set(width*canvasPixel,height*canvasPixel,1);continue;
      }
      sprite.position.set((x+5*flow+(row.row===0?-18:18)*(1-enter))*pixel,
        (viewport.windowHeight/2-y+4*flow-7*(1-enter))*pixel,-depth);
      sprite.scale.set(width*pixel,height*pixel,1);
    }
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.root.parent?.remove(this.root);
    this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());
    this.chineseTextures.forEach(map=>map.dispose());this.chineseSprites.clear();
  }
}
