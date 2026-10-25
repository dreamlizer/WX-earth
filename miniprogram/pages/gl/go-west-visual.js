// Track four owns a clear, faceted coat over the unchanged all-night Earth.
// Every coloured term comes from a lamp behind the observer, never a tile tint.
const LAMP_COUNT=12, MIRRORS_PER_LAMP=9;
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
// Reproducible smooth random keyframes: independent headings and dwell times,
// never frame-by-frame jitter or a shared rotating ring.
export function lightNoise(time,seed){
  const step=Math.floor(time),f=time-step,t=f*f*(3-2*f);
  return (hash(step+seed*71.3)*(1-t)+hash(step+1+seed*71.3)*t)*2-1;
}
const sphereVertex = `
  varying vec2 texCoord;
  void main(){texCoord=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;
const nightFragment = `
  precision highp float; varying vec2 texCoord;
  uniform sampler2D nightMap; uniform mat3 nightUv;uniform float nightMix;
  void main(){vec3 city=texture2D(nightMap,(nightUv*vec3(texCoord,1.0)).xy).rgb;
    float lit=smoothstep(.16,.62,max(city.r,max(city.g,city.b)));
    vec3 colour=city*mix(.38,1.10,lit)+vec3(.001,.004,.012);
    gl_FragColor=vec4(colour,nightMix);}
`;
const glassVertex = `
  attribute vec3 tangent;
  varying vec3 worldPosition,worldNormal,worldTangent;varying vec2 panelUv;
  void main(){vec4 p=modelMatrix*vec4(position,1.0);worldPosition=p.xyz;panelUv=uv;
    worldNormal=normalize(mat3(modelMatrix)*normal);worldTangent=normalize(mat3(modelMatrix)*tangent);
    gl_Position=projectionMatrix*viewMatrix*p;}
`;
const glassFragment = `
  precision highp float;
  varying vec3 worldPosition,worldNormal,worldTangent;varying vec2 panelUv;
  uniform float gain;
  uniform vec3 lampPosition[12],lampDirection[12],lampColour[12];uniform float lampPower[12];uniform vec2 lampCone[12];
  vec3 lampImage(vec3 N,vec3 V,vec3 source,vec3 direction,vec3 colour,float power,float bevel,vec2 aperture){
    vec3 delta=source-worldPosition;float distance2=dot(delta,delta);vec3 L=normalize(delta);
    float cone=smoothstep(aperture.x,aperture.y,dot(-L,direction));
    float incident=max(0.0,dot(N,L));float angle=max(0.0,dot(reflect(-L,N),V));
    // Compute the lamp image at EACH point on the flat glass, not one colour
    // for the entire tile. The sharp core travels over and between panels.
    float image=.018*pow(angle,80.0)+.18*pow(angle,350.0)+5.0*pow(angle,8000.0)
      +bevel*.10*pow(angle,4.0);
    return colour*image*cone*incident*power*100.0/max(distance2,1.0);
  }
  void main(){vec3 N=normalize(worldNormal),V=normalize(cameraPosition-worldPosition);
    vec3 U=normalize(worldTangent),B=normalize(cross(N,U));
    vec2 edge=min(panelUv,1.0-panelUv);
    float bevel=1.0-smoothstep(.015,.075,min(edge.x,edge.y));
    vec2 slope=(1.0-smoothstep(vec2(0.0),vec2(.065),panelUv))
      -(1.0-smoothstep(vec2(0.0),vec2(.065),1.0-panelUv));
    N=normalize(N+(U*slope.x+B*slope.y)*.13);
    vec3 light=lampImage(N,V,lampPosition[0],lampDirection[0],lampColour[0],lampPower[0],bevel,lampCone[0])
      +lampImage(N,V,lampPosition[1],lampDirection[1],lampColour[1],lampPower[1],bevel,lampCone[1])
      +lampImage(N,V,lampPosition[2],lampDirection[2],lampColour[2],lampPower[2],bevel,lampCone[2])
      +lampImage(N,V,lampPosition[3],lampDirection[3],lampColour[3],lampPower[3],bevel,lampCone[3])
      +lampImage(N,V,lampPosition[4],lampDirection[4],lampColour[4],lampPower[4],bevel,lampCone[4])
      +lampImage(N,V,lampPosition[5],lampDirection[5],lampColour[5],lampPower[5],bevel,lampCone[5])
      +lampImage(N,V,lampPosition[6],lampDirection[6],lampColour[6],lampPower[6],bevel,lampCone[6])
      +lampImage(N,V,lampPosition[7],lampDirection[7],lampColour[7],lampPower[7],bevel,lampCone[7])
      +lampImage(N,V,lampPosition[8],lampDirection[8],lampColour[8],lampPower[8],bevel,lampCone[8])
      +lampImage(N,V,lampPosition[9],lampDirection[9],lampColour[9],lampPower[9],bevel,lampCone[9])
      +lampImage(N,V,lampPosition[10],lampDirection[10],lampColour[10],lampPower[10],bevel,lampCone[10])
      +lampImage(N,V,lampPosition[11],lampDirection[11],lampColour[11],lampPower[11],bevel,lampCone[11]);
    // Premultiplied clear glass: a little absorption, with additive reflection.
    // With lamps off this only transmits the night texture; it emits no light.
    float absorption=.025+bevel*.13;
    gl_FragColor=vec4(light*gain,absorption*gain);
  }
`;
const beamVertex = `
  varying vec2 beamUv;
  void main(){beamUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;
const beamFragment = `
  precision mediump float;varying vec2 beamUv;uniform vec3 tint;uniform float opacity;
  void main(){float edge=pow(max(0.0,1.0-abs(beamUv.x-.5)*2.0),2.0);
    float shaft=(.28+.72*beamUv.y)*(1.0-smoothstep(.96,1.0,beamUv.y));
    gl_FragColor=vec4(tint,edge*shaft*opacity);}
`;
const glintVertex = `
  attribute vec3 tint;attribute float strength;uniform float pixelRatio;
  varying vec3 colour;varying float brightness;
  void main(){colour=tint;brightness=strength;
    vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;
    gl_PointSize=(24.0+102.0*sqrt(max(0.0,strength)))*pixelRatio;}
`;
const glintFragment = `
  precision mediump float;varying vec3 colour;varying float brightness;
  void main(){vec2 p=gl_PointCoord-.5;
    float core=exp(-dot(p,p)*650.0),halo=exp(-dot(p,p)*35.0)*.18;
    float rays=exp(-abs(p.x)*65.0-abs(p.y)*7.0)+exp(-abs(p.y)*65.0-abs(p.x)*7.0);
    gl_FragColor=vec4(colour*(core*4.0+halo+rays*1.15),brightness);}
`;

const scatterVertex = `
  attribute vec3 tint;attribute float strength;
  varying vec2 beamUv;varying vec3 colour;varying float brightness;
  void main(){beamUv=uv;colour=tint;brightness=strength;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;
const scatterFragment = `
  precision mediump float;varying vec2 beamUv;varying vec3 colour;varying float brightness;
  void main(){float crossSection=pow(max(0.0,1.0-abs(beamUv.x-.5)*2.0),2.6);
    float distanceFade=pow(1.0-beamUv.y,1.35)*smoothstep(0.0,.035,beamUv.y);
    gl_FragColor=vec4(colour,brightness*crossSection*distanceFade);}
`;

export function mirrorLampStrength(N,L,V,direction,distance2,power,coneOuter=.995,coneInner=.999) {
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const incident=Math.max(0,dot(N,L));
  const x=Math.max(0,Math.min(1,(-dot(L,direction)-coneOuter)/(coneInner-coneOuter)));
  const cone=x*x*(3-2*x);
  const alignment=Math.max(0,Math.min(1,2*dot(N,L)*dot(N,V)-dot(L,V)));
  return Math.pow(alignment,1400)*incident*cone*power*100/Math.max(distance2,1);
}
const ROWS=34,RADIUS=1.009;
function attribute(T,geometry,name,values,size){
  (geometry.setAttribute || geometry.addAttribute).call(geometry,name,new T.Float32BufferAttribute(values,size));
}
export function createGlassPanels(T){
  const geometry=new T.BufferGeometry(),rows=[],positions=[],normals=[],uvs=[],tangents=[];
  const N=new T.Vector3(),U=new T.Vector3(),B=new T.Vector3(),P=new T.Vector3();
  for(let row=0;row<ROWS;row++){
    const theta=(row+.5)*Math.PI/ROWS,count=Math.max(4,Math.round(2*ROWS*Math.sin(theta)));
    const panels=[];rows.push(panels);
    const halfHeight=Math.PI/ROWS*.477;
    const halfWidth=Math.sin(theta)*Math.PI*2/count*.477;
    for(let col=0;col<count;col++){
      const phi=(col+.5)/count*Math.PI*2;
      N.set(-Math.cos(phi)*Math.sin(theta),Math.cos(theta),Math.sin(phi)*Math.sin(theta));
      U.set(Math.sin(phi),0,Math.cos(phi));B.crossVectors(N,U).normalize();
      panels.push({normal:N.clone(),center:N.clone().multiplyScalar(RADIUS),
        tangent:U.clone(),bitangent:B.clone(),halfWidth,halfHeight});
      for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]){
        P.copy(N).multiplyScalar(RADIUS).addScaledVector(U,x*halfWidth).addScaledVector(B,y*halfHeight);
        positions.push(P.x,P.y,P.z);normals.push(N.x,N.y,N.z);tangents.push(U.x,U.y,U.z);
        uvs.push((x+1)/2,(y+1)/2);
      }
    }
  }
  attribute(T,geometry,'position',positions,3);attribute(T,geometry,'normal',normals,3);
  attribute(T,geometry,'tangent',tangents,3);attribute(T,geometry,'uv',uvs,2);
  return {geometry,rows};
}

export class GoWestVisual {
  constructor({THREE,scene,camera,globeGroup,renderer,getEarth,getNightTexture,getCloud,getStars}){
    Object.assign(this,{THREE,scene,camera,globeGroup,renderer,getEarth,getNightTexture,getCloud,getStars});
    this.disposed=false;this.surface=null;this.background=null;
  }
  build(){
    const T=this.THREE,common={transparent:true,depthWrite:false,blending:T.AdditiveBlending};
    this.lamps=Array.from({length:LAMP_COUNT},(_,i)=>{
      const angle=i*2.39996+hash(i+20)*.6,radius=4.4+hash(i+30)*6.5;
      const halfAngle=(1.8+hash(i+40)*2.8)*Math.PI/180;
      return {position:new T.Vector3(),direction:new T.Vector3(),target:new T.Vector3(),hit:new T.Vector3(),
        mount:new T.Vector3(Math.cos(angle)*radius,Math.sin(angle)*radius,.8+hash(i+50)*2.6),
        cone:new T.Vector2(Math.cos(halfAngle),Math.cos(halfAngle*.60)),halfAngle,
        aperture:.012+hash(i+60)*.026,scanRate:1.3+hash(i+70)*2.1,
        colour:new T.Color([0x4bbfff,0xff50a6,0xffc265,0x9a78ff,0x63ffd6,0xff7658][i%6]),power:0};
    });
    this.uniforms={gain:{value:0},lampPosition:{value:this.lamps.map(l=>l.position)},
      lampDirection:{value:this.lamps.map(l=>l.direction)},lampColour:{value:this.lamps.map(l=>l.colour)},
      lampPower:{value:this.lamps.map(()=>0)},lampCone:{value:this.lamps.map(l=>l.cone)}};
    const panels=createGlassPanels(T);this.panelRows=panels.rows;
    this.surface=new T.Mesh(panels.geometry,new T.ShaderMaterial({transparent:true,depthWrite:false,
      blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:T.OneMinusSrcAlphaFactor,
      blendEquation:T.AddEquation,premultipliedAlpha:true,uniforms:this.uniforms,
      vertexShader:glassVertex,fragmentShader:glassFragment}));
    this.surface.name='GO_WEST_REFLECTIONS';this.surface.renderOrder=16;this.globeGroup.add(this.surface);
    // These shafts are actual foreground source-to-surface paths, not rays
    // positioned behind the globe. Ordinary universe stars remain untouched.
    this.background=new T.Group();this.background.name='GO_WEST_STAGE_LIGHTS';this.scene.add(this.background);
    this.beams=this.lamps.map(lamp=>{
      const geometry=new T.BufferGeometry();attribute(T,geometry,'position',new Float32Array(18),3);
      attribute(T,geometry,'uv',[0,0,1,0,1,1,0,0,1,1,0,1],2);
      const beam=new T.Mesh(geometry,new T.ShaderMaterial({...common,side:T.DoubleSide,
        uniforms:{tint:{value:lamp.colour},opacity:{value:0}},vertexShader:beamVertex,fragmentShader:beamFragment}));
      beam.renderOrder=17;beam.frustumCulled=false;this.background.add(beam);return beam;
    });
    const scatterGeometry=new T.BufferGeometry(),scatterCount=LAMP_COUNT*MIRRORS_PER_LAMP*6;
    for(const [name,size] of [['position',3],['uv',2],['tint',3],['strength',1]])
      attribute(T,scatterGeometry,name,new Float32Array(scatterCount*size),size);
    this.scattered=new T.Mesh(scatterGeometry,new T.ShaderMaterial({...common,side:T.DoubleSide,
      vertexShader:scatterVertex,fragmentShader:scatterFragment}));
    this.scattered.name='GO_WEST_OUTGOING_REFLECTIONS';this.scattered.renderOrder=17;
    this.scattered.frustumCulled=false;this.background.add(this.scattered);
    this.scatterWork=Array.from({length:9},()=>new T.Vector3());
    this.center=new T.Vector3();this.inverseWorld=new T.Matrix4();
    this.work=Array.from({length:13},()=>new T.Vector3());
    const geometry=new T.BufferGeometry();
    for(const [name,size] of [['position',3],['tint',3],['strength',1]])attribute(T,geometry,name,new Float32Array(LAMP_COUNT*MIRRORS_PER_LAMP*size),size);
    this.glints=new T.Points(geometry,new T.ShaderMaterial({...common,depthTest:false,
      uniforms:{pixelRatio:{value:this.renderer.getPixelRatio?.() || 1}},vertexShader:glintVertex,fragmentShader:glintFragment}));
    this.glints.name='GO_WEST_LAMP_GLINTS';this.glints.renderOrder=18;this.glints.frustumCulled=false;this.scene.add(this.glints);
  }
  update(frame,keepNight=0){
    if(this.disposed)return;
    if(!frame || frame.gain<=0){this.reset();if(keepNight)this.applyNight(Number(keepNight));return;}
    if(!this.surface)this.build();
    this.applyNight(frame.nightMix ?? 1);this.frame=frame;this.uniforms.gain.value=frame.gain;
    this.surface.visible=this.background.visible=this.glints.visible=true;this.updateLights();
  }
  updateLights(){
    if(!this.frame || this.disposed)return;
    this.updateStars(this.frame.starShimmer || 0);
    const {time,gain,chorus}=this.frame;
    this.globeGroup.getWorldPosition(this.center);this.inverseWorld.getInverse(this.globeGroup.matrixWorld);
    const [point,N,L,V,half,local,source,target,right,ray,virtual,eye,offset]=this.work;
    const attributes=this.glints.geometry.attributes;
    this.lamps.forEach((lamp,i)=>{
      const pace=time*lamp.scanRate;
      // Uneven positions behind the audience, with independent short travels.
      // The rig never advances around a common orbit.
      source.copy(lamp.mount);
      source.x+=3.0*lightNoise(pace,i+1);
      source.y+=2.7*lightNoise(pace*.79,i+19);
      source.z+=.12*lightNoise(pace*.43,i+37);
      source.applyQuaternion(this.camera.quaternion).add(this.camera.position);
      lamp.position.copy(source);
      // Aim around the mirror-return region so the visible incident shaft
      // actually lands near the glass that flashes back toward the observer.
      point.copy(this.center);
      for(let step=0;step<5;step++){
        L.copy(source).sub(point).normalize();V.copy(this.camera.position).sub(point).normalize();
        half.copy(L).add(V).normalize();point.copy(half).multiplyScalar(RADIUS).add(this.center);
      }
      const pan=lightNoise(pace*.87,i+53),tilt=lightNoise(pace*.63,i+79);
      if(i%3!==2){
        // Tight spots keep grazing the mirror-return region, independently.
        target.set(pan*.26,tilt*.23,0);
        target.applyQuaternion(this.camera.quaternion).add(point);
      }else{
        // Other fixtures sweep the outer hemisphere and illuminate side facets.
        const angle=i*2.39996+pan*.7,radius=.63+.20*tilt;
        target.set(Math.cos(angle)*radius,Math.sin(angle)*radius,Math.sqrt(RADIUS*RADIUS-radius*radius));
        target.applyQuaternion(this.camera.quaternion).add(this.center);
      }
      lamp.target.copy(target);lamp.direction.copy(target).sub(source).normalize();
      // Power stays steady during the song; only the ending dims the sources.
      // Mirror flashes and scattering still follow those same real lamps.
      const dim=Math.max(0,Math.min(1,((this.frame.outro || 0)-hash(i+143)*.18)/.82));
      lamp.power=(.55+hash(i+93)*.28)*(1+.32*chorus)*(1-dim*dim*(3-2*dim));
      this.uniforms.lampPower.value[i]=lamp.power;
      // End the haze shaft exactly where this incoming ray meets the coat.
      ray.copy(source).sub(this.center);
      const b=ray.dot(lamp.direction),c=ray.lengthSq()-RADIUS*RADIUS;
      const travel=-b-Math.sqrt(Math.max(0,b*b-c));
      lamp.hit.copy(lamp.direction).multiplyScalar(travel).add(source);
      V.copy(this.camera.position).sub(source).normalize();
      right.crossVectors(lamp.direction,V).normalize();
      const beam=this.beams[i],pos=beam.geometry.attributes.position;
      const corners=[[-1,0],[1,0],[1,1],[-1,0],[1,1],[-1,1]];
      corners.forEach(([side,end],j)=>{
        point.copy(end?lamp.hit:source).addScaledVector(right,side*(end?travel*Math.tan(lamp.halfAngle):lamp.aperture));
        pos.setXYZ(j,point.x,point.y,point.z);
      });
      pos.needsUpdate=true;beam.material.uniforms.opacity.value=gain*lamp.power*(.13+hash(i+101)*.08);
      this.updateScatteredLamp(lamp,i,gain);
      // Choose an actual planar glass piece near the ideal mirror half-angle.
      point.copy(this.center);
      for(let step=0;step<5;step++){
        L.copy(source).sub(point).normalize();V.copy(this.camera.position).sub(point).normalize();
        half.copy(L).add(V).normalize();point.copy(half).multiplyScalar(RADIUS).add(this.center);
      }
      local.copy(half).transformDirection(this.inverseWorld);
      const theta=Math.acos(Math.max(-1,Math.min(1,local.y)));
      const rowIndex=Math.min(ROWS-1,Math.floor(theta/Math.PI*ROWS));
      const u=(Math.atan2(local.z,-local.x)/(2*Math.PI)+1)%1;
      // Test the neighbouring facets too: the nearest sphere normal alone can
      // miss a valid lamp image on a flat tile. Each candidate still must pass
      // the exact eye -> reflected source intersection inside its real edges.
      for(let candidate=0;candidate<MIRRORS_PER_LAMP;candidate++){
        const row=this.panelRows[Math.max(0,Math.min(ROWS-1,rowIndex+Math.floor(candidate/3)-1))];
        const col=(Math.floor(u*row.length)+candidate%3-1+row.length)%row.length;
        const panel=row[col],index=i*MIRRORS_PER_LAMP+candidate;
        eye.copy(this.camera.position).applyMatrix4(this.inverseWorld);
        virtual.copy(source).applyMatrix4(this.inverseWorld);
        offset.copy(virtual).sub(panel.center);
        virtual.addScaledVector(panel.normal,-2*offset.dot(panel.normal));
        ray.copy(virtual).sub(eye);
        const denominator=ray.dot(panel.normal);
        offset.copy(panel.center).sub(eye);
        const t=Math.abs(denominator)>1e-6?offset.dot(panel.normal)/denominator:-1;
        local.copy(ray).multiplyScalar(t).add(eye);offset.copy(local).sub(panel.center);
        const edge=Math.min(1-Math.abs(offset.dot(panel.tangent))/panel.halfWidth,
          1-Math.abs(offset.dot(panel.bitangent))/panel.halfHeight);
        const edgeFade=Math.max(0,Math.min(1,edge/.18));
        point.copy(local).applyMatrix4(this.globeGroup.matrixWorld);
        N.copy(panel.normal).transformDirection(this.globeGroup.matrixWorld);
        L.copy(source).sub(point);const distance2=L.lengthSq();L.normalize();
        V.copy(this.camera.position).sub(point).normalize();
        const strength=t>0 && edge>0 && N.dot(V)>.15?
          mirrorLampStrength(N,L,V,lamp.direction,distance2,lamp.power,lamp.cone.x,lamp.cone.y)*edgeFade:0;
        attributes.position.setXYZ(index,point.x,point.y,point.z);
        attributes.tint.setXYZ(index,lamp.colour.r,lamp.colour.g,lamp.colour.b);
        attributes.strength.setX(index,Math.min(1,strength)*gain);
      }
    });
    for(const a of Object.values(attributes))a.needsUpdate=true;
    for(const a of Object.values(this.scattered.geometry.attributes))a.needsUpdate=true;
  }
  updateStars(amount){
    if(amount<=0){this.restoreStars();return;}
    const material=this.getStars?.()?.material,u=material?.uniforms;if(!u)return;
    if(this.starMaterial!==material){
      this.restoreStars();this.starMaterial=material;this.savedStars={};
      for(const key of ['uBrightnessGain','uGlowFactor','uSizeScale'])if(u[key])this.savedStars[key]=u[key].value;
    }
    const saved=this.savedStars;
    // Existing star colours, independent twinkle phases and black sky remain.
    // Only their light and soft halos swell; Earth/lyrics/exposure never flash.
    if(u.uBrightnessGain)u.uBrightnessGain.value=saved.uBrightnessGain*(1+.85*amount);
    if(u.uGlowFactor)u.uGlowFactor.value=saved.uGlowFactor+.35*amount;
    if(u.uSizeScale)u.uSizeScale.value=saved.uSizeScale*(1+.12*amount);
  }
  restoreStars(){
    const u=this.starMaterial?.uniforms;
    if(u)for(const [key,value] of Object.entries(this.savedStars || {}))if(u[key])u[key].value=value;
    this.starMaterial=null;this.savedStars=null;
  }
  updateScatteredLamp(lamp,lampIndex,gain){
    const [local,P,N,L,R,V,right,end,vertex]=this.scatterWork;
    // Nearby illuminated mirror tiles send rays in different directions. Their
    // visibility in haze does not require the outgoing ray to hit the eye.
    local.copy(lamp.hit).sub(this.center).normalize().transformDirection(this.inverseWorld);
    const theta=Math.acos(Math.max(-1,Math.min(1,local.y)));
    const rowIndex=Math.min(ROWS-1,Math.floor(theta/Math.PI*ROWS));
    const u=(Math.atan2(local.z,-local.x)/(2*Math.PI)+1)%1;
    const attributes=this.scattered.geometry.attributes;
    const corners=[[-1,0],[1,0],[1,1],[-1,0],[1,1],[-1,1]];
    for(let sample=0;sample<MIRRORS_PER_LAMP;sample++){
      const row=this.panelRows[Math.max(0,Math.min(ROWS-1,rowIndex+(Math.floor(sample/3)-1)*2))];
      const panel=row[(Math.floor(u*row.length)+(sample%3-1)*2+row.length)%row.length];
      P.copy(panel.center).applyMatrix4(this.globeGroup.matrixWorld);
      N.copy(panel.normal).transformDirection(this.globeGroup.matrixWorld);
      L.copy(lamp.position).sub(P);const distance2=L.lengthSq();L.normalize();
      const incident=Math.max(0,N.dot(L));
      const x=Math.max(0,Math.min(1,(-L.dot(lamp.direction)-lamp.cone.x)/(lamp.cone.y-lamp.cone.x)));
      const irradiance=incident*x*x*(3-2*x)*lamp.power*100/Math.max(1,distance2);
      R.copy(N).multiplyScalar(2*N.dot(L)).sub(L).normalize();
      const seed=lampIndex*13+sample;
      const length=1.1+hash(seed+120)*2.2;
      end.copy(P).addScaledVector(R,length);
      V.copy(this.camera.position).sub(P).normalize();right.crossVectors(R,V).normalize();
      // Forward-biased haze scattering; even a side-on return remains visible.
      const scatter=.30+.70*Math.pow(Math.max(0,R.dot(V)),2);
      const strength=Math.min(.30,irradiance*.46)*scatter*gain;
      const width=.009+hash(seed+140)*.015;
      corners.forEach(([side,far],j)=>{
        vertex.copy(far?end:P).addScaledVector(R,.012).addScaledVector(right,side*width*(far?1.7:1));
        const index=(lampIndex*MIRRORS_PER_LAMP+sample)*6+j;
        attributes.position.setXYZ(index,vertex.x,vertex.y,vertex.z);
        attributes.uv.setXY(index,(side+1)/2,far);
        attributes.tint.setXYZ(index,lamp.colour.r,lamp.colour.g,lamp.colour.b);
        attributes.strength.setX(index,strength);
      });
    }
  }
  applyNight(mix=1){
    if(mix<=0){this.restoreNight();return;}
    const earth=this.getEarth?.(),texture=this.getNightTexture?.();if(!earth || !texture)return;
    const T=this.THREE;
    if(!this.nightMaterial)this.nightMaterial=new T.ShaderMaterial({
      polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
      uniforms:{nightMap:{value:texture},nightUv:{value:new T.Matrix3()},nightMix:{value:mix}},vertexShader:sphereVertex,fragmentShader:nightFragment});
    if(this.nightEarth!==earth || (earth.material!==this.nightMaterial && earth.material!==this.savedEarthMaterial)){
      this.restoreNight();this.nightEarth=earth;this.savedEarthMaterial=earth.material;
    }
    this.nightMaterial.uniforms.nightMix.value=mix;
    const transitioning=mix<1;
    this.nightMaterial.transparent=transitioning;this.nightMaterial.depthWrite=!transitioning;
    if(transitioning){
      earth.material=this.savedEarthMaterial;
      if(!this.nightOverlay){this.nightOverlay=new T.Mesh(earth.geometry,this.nightMaterial);this.nightOverlay.renderOrder=15;}
      this.nightOverlay.geometry=earth.geometry;
      if(this.nightOverlay.parent!==earth.parent)earth.parent?.add(this.nightOverlay);
      this.nightOverlay.position.copy(earth.position);this.nightOverlay.quaternion.copy(earth.quaternion);
      this.nightOverlay.scale.copy(earth.scale);this.nightOverlay.visible=true;
    }else{earth.material=this.nightMaterial;if(this.nightOverlay)this.nightOverlay.visible=false;}
    this.nightMaterial.uniforms.nightMap.value=texture;
    if(texture.matrixAutoUpdate)texture.updateMatrix();
    if(texture.matrix)this.nightMaterial.uniforms.nightUv.value.copy(texture.matrix);
    const cloud=this.getCloud?.();
    if(cloud?.material && !this.savedCloud)this.savedCloud={material:cloud.material,opacity:cloud.material.opacity};
    if(this.savedCloud){
      this.appliedCloudOpacity=this.savedCloud.opacity*(1-mix);
      this.savedCloud.material.opacity=this.appliedCloudOpacity;
    }
  }
  restoreNight(){
    if(this.nightEarth && this.nightEarth.material===this.nightMaterial)this.nightEarth.material=this.savedEarthMaterial;
    if(this.savedCloud && this.savedCloud.material.opacity===this.appliedCloudOpacity)this.savedCloud.material.opacity=this.savedCloud.opacity;
    if(this.nightOverlay)this.nightOverlay.visible=false;
    this.nightEarth=null;this.savedEarthMaterial=null;this.savedCloud=null;
  }
  reset(){
    this.restoreStars();
    this.frame=null;if(this.surface)this.surface.visible=false;if(this.background)this.background.visible=false;
    if(this.glints)this.glints.visible=false;this.restoreNight();
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.frame=null;this.restoreStars();this.restoreNight();this.nightMaterial?.dispose();
    // Overlay borrows Earth's geometry; only detach it, never dispose that geometry.
    this.nightOverlay?.parent?.remove(this.nightOverlay);
    const release=o=>{o.geometry?.dispose();o.material?.dispose();};
    for(const o of [this.surface,this.background,this.glints])if(o){o.parent?.remove(o);o.traverse(release);}
  }
}
