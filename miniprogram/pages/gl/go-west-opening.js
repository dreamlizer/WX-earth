import { GO_WEST_TITLE_SHAPES } from '../../assets/data/go-west-title-shapes.js';
import { goWestOpeningFragment, pixelArtistLayout, pixelArtistCell, pixelArtistColour, pixelArtistScatter } from './go-west-opening-motion.js';

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
const pixelVertex=`attribute vec3 pixelColour;attribute float pixelAlpha;
 varying vec3 vColour;varying float vAlpha;
 void main(){vColour=pixelColour;vAlpha=pixelAlpha;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const pixelInk=`precision mediump float;varying vec3 vColour;varying float vAlpha;
 uniform float alpha;void main(){if(vAlpha<.001)discard;gl_FragColor=vec4(vColour,vAlpha*alpha);}`;
const pixelCorners=[[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]];

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
    this.artist=new T.Group();this.artist.name='PET_SHOP_BOYS_INDEPENDENT';this.root.add(this.artist);
    this.artistPixels=pixelArtistLayout('Pet Shop Boys',50,7);this.artistUnit=this.artistPixels.width;
    const count=this.artistPixels.cells.length*6,geometry=new T.BufferGeometry();
    for(const [name,size]of [['position',3],['pixelColour',3],['pixelAlpha',1]]){
      geometry.addAttribute(name,new T.Float32BufferAttribute(new Float32Array(count*size),size));
    }
    this.artistPixels.cells.forEach((cell,i)=>{
      const colour=pixelArtistColour(cell,this.artistPixels).map(v=>v/255);
      for(let j=0;j<6;j++)geometry.attributes.pixelColour.setXYZ(i*6+j,...colour);
    });
    this.pixelMaterial=new T.ShaderMaterial({uniforms:{alpha:{value:0}},vertexShader:pixelVertex,fragmentShader:pixelInk,
      transparent:true,depthTest:true,depthWrite:false,side:T.DoubleSide});
    this.pixelMesh=new T.Mesh(geometry,this.pixelMaterial);this.pixelMesh.renderOrder=9981;this.pixelMesh.frustumCulled=false;
    this.artist.add(this.pixelMesh);this.geometries.add(geometry);this.materials.add(this.pixelMaterial);
    this.pixelInverse=new T.Matrix4();this.pixelPoint=new T.Vector3();this.root.visible=false;
  }
  update(time,firstLyricMs,topPx,viewport,camera,rows=[],bottom=10,earthAnchor=null,earthBody=null,lyricTime=time){
    const f=goWestTitleFrame(time,firstLyricMs);
    this.updateChinese(lyricTime,rows,bottom,viewport,camera);
    const pixelExit=time>=f.artistExitAt&&time<f.gone;
    this.artist.visible=f.artistAlpha>0||pixelExit;
    this.root.visible=f.alpha>0||this.artist.visible||this.chinese.visible;
    this.title.visible=f.alpha>0;
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
    if(this.artist.visible)this.updateArtistPixels(time,f,body,pixelExit);
  }
  updateArtistPixels(time,frame,body,exiting){
    this.artist.updateMatrix();this.pixelInverse.getInverse(this.artist.matrix);
    const geometry=this.pixelMesh.geometry,positions=geometry.attributes.position,alphas=geometry.attributes.pixelAlpha;
    const phase=(time-frame.artistExitAt)/(frame.gone-frame.artistExitAt);
    for(const cell of this.artistPixels.cells){
      let p=pixelArtistCell(cell,time-10.2,this.artistPixels),x=p.x,y=-p.y,z=0;
      if(exiting){
        const start=this.pixelPoint.set(cell.x,-cell.y,0).applyMatrix4(this.artist.matrix);
        p=pixelArtistScatter(cell.index,start,body.center,body.radius,phase);
        this.pixelPoint.set(p.x,p.y,p.z).applyMatrix4(this.pixelInverse);
        x=this.pixelPoint.x;y=this.pixelPoint.y;z=this.pixelPoint.z;
      }
      const half=cell.size*p.scale*.5,angle=p.rotation,cos=Math.cos(angle),sin=Math.sin(angle);
      for(let j=0;j<6;j++){
        const [cx,cy]=pixelCorners[j],i=cell.index*6+j;
        positions.setXYZ(i,x+(cx*cos-cy*sin)*half,y+(cx*sin+cy*cos)*half,z);
        alphas.setX(i,p.alpha);
      }
    }
    positions.needsUpdate=true;alphas.needsUpdate=true;
    this.pixelMaterial.uniforms.alpha.value=exiting?1:frame.artistAlpha;
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
        const prefixes=Array.from(text).map((_,i)=>ctx.measureText(Array.from(text).slice(0,i+1).join('')).width/ratio);
        const w=Math.ceil(ctx.measureText(text).width+12*ratio),h=Math.ceil(size*ratio*1.8);
        canvas.width=w;canvas.height=h;ctx=canvas.getContext('2d');
        ctx.clearRect(0,0,w,h);ctx.font=`400 ${size*ratio}px sans-serif`;
        ctx.textBaseline='middle';ctx.fillStyle='#ffffff';ctx.fillText(text,6*ratio,h/2);
        const map=new T.CanvasTexture(canvas);map.minFilter=map.magFilter=T.LinearFilter;
        map.generateMipmaps=false;this.chineseTextures.add(map);
        const colour=choir?0x9dbbcc:role==='response'?0xb9b1d0:row.row===2?0xd6ccb7:0xa8c0d1;
        const material=new T.SpriteMaterial({map,color:colour,transparent:true,depthTest:false,depthWrite:false});
        this.materials.add(material);sprite=new T.Sprite(material);sprite.renderOrder=20000;
        sprite.userData.width=w/ratio;sprite.userData.height=h/ratio;sprite.userData.prefixes=prefixes;
        this.chinese.add(sprite);this.chineseSprites.set(key,sprite);
      }
      const age=Math.max(0,time-at),flow=clamp(age/Math.max(.1,row.end-at));
      const width=sprite.userData.width,height=sprite.userData.height;
      const x=choir?0:row.row===0?-viewport.windowWidth*.38+width/2:row.row===2?viewport.windowWidth*.38-width/2:0;
      const y=choir?viewport.windowHeight-bottom-65+11.5:
        viewport.windowHeight-bottom-row.bottomOffset-58+(role==='call'?12:38);
      const enter=row.sequential?1:smooth(age/(choir?.35:1.1)),fade=smooth((row.end-time)/Math.min(row.sequential?.30:.33,(row.end-at)*.24));
      let reveal=1;
      if(row.sequential){
        // Reveal complete character cells on the existing foreground texture.
        // Keep the left edge fixed; do not scale a complete sentence into view.
        const revealSec=(row[role+'RevealMs'] ?? 608.4)/1000;
        const prefixes=sprite.userData.prefixes,count=Math.min(prefixes.length,Math.floor(age/revealSec*prefixes.length));
        reveal=count===prefixes.length?1:count>0?(6+prefixes[count-1])/width:0;
      }
      sprite.material.map.repeat.x=reveal;
      sprite.visible=reveal>0;sprite.material.opacity=enter*fade*(choir?1:.87);
      if(choir){
        // Foreground text avoids the native overlay's cropped top edge when
        // the large choir response occupies the adjacent compositor surface.
        const canvasHeight=viewport.windowWidth/camera.aspect,canvasPixel=screenH/canvasHeight;
        sprite.position.set(0,(canvasHeight/2-y-4*(1-enter))*canvasPixel,-depth);
        sprite.scale.set(width*canvasPixel,height*canvasPixel,1);continue;
      }
      sprite.position.set((x+5*flow+(row.row===0?-18:18)*(1-enter)-width*(1-reveal)/2)*pixel,
        (viewport.windowHeight/2-y+4*flow-7*(1-enter))*pixel,-depth);
      sprite.scale.set(width*reveal*pixel,height*pixel,1);
    }
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.root.parent?.remove(this.root);
    this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());
    this.chineseTextures.forEach(map=>map.dispose());this.chineseSprites.clear();
  }
}
