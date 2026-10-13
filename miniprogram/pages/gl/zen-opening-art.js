import { ZenVisualClock } from './zen-visual-clock.js';
import { ensureSceneArtPackage } from './scene-art-loader.js';
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { const t=clamp(x); return t*t*(3-2*t); };
const SONG_ART = {
  102:{title:'how-deep-title',artist:'bee-gees',artistWidth:.26,titleGrowth:.10},
  103:{title:'out-of-darkness-title',artist:'aubrey-ashburn',artistWidth:.455,titleGrowth:.50,
    artistGrowth:.70,artistDelay:2,titleFade:3.4,titleStart:-.08,titleDrift:.18,artistDrift:-.05,artistDrop:18}
};
export function openingArtFrame(time, firstLyricMs, titleGrowth=.10, options={}) {
  const end=Math.max(8,firstLyricMs/1000-2.5), gone=end+2.2;
  const fade=1-smooth((time-end)/2.2);
  const titleAt=4+(options.entranceDelay || 0),artistAt=8+(options.artistDelay ?? options.entranceDelay ?? 0);
  const titleProgress=clamp((time-titleAt)/(gone-titleAt));
  const artistProgress=clamp((time-artistAt)/(gone-artistAt));
  return {
    titleAlpha:smooth((time-titleAt)/(options.titleFade || 1.8))*fade,
    starAlpha:smooth((time-titleAt)/(options.titleFade || 1.8))*fade,
    artistAlpha:smooth((time-artistAt)/1.8)*fade,
    titleScale:1+titleGrowth*titleProgress,
    artistScale:1+(options.artistGrowth ?? .50)*artistProgress,
    titleShift:(options.titleStart || 0)+(options.titleDrift || 0)*titleProgress,
    artistShift:(options.artistDrift || 0)*artistProgress,
    artistDrop:(options.artistDrop ?? 12)*artistProgress
  };
}
// Camera-facing GPU planes preserve subpixel scales without relayout/setData.
export class ZenOpeningArt {
  constructor({THREE,scene,camera,getViewport}) {
    Object.assign(this,{THREE,scene,camera,getViewport});
    this.clock=new ZenVisualClock();this.group=new THREE.Group();this.group.name='ZEN_OPENING_ART';
    this.group.visible=false;scene.add(this.group);this.disposed=false;
    this.layers={};this.textures=new Set();this.maps={};
    this.ready=ensureSceneArtPackage().then(()=>{
      if(this.disposed)return;
      this.loadTextures();
    }).catch(error=>console.warn('[Zen opening] Art package unavailable:',error?.message || error));
    for(const key of ['title','star','artist']) {
      const material=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,depthTest:false});
      const plane=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
      plane.renderOrder=9999;plane.frustumCulled=false;this.layers[key]=plane;this.group.add(plane);
    }
  }
  loadTextures() {
    const {THREE}=this;
    for(const file of ['how-deep-title','bee-gees','out-of-darkness-title','aubrey-ashburn','blue-starlight']) {
      const map=new THREE.TextureLoader().load('/scene-art-assets/zen-opening/'+file+'.png',texture=>{
        if(this.disposed){texture.dispose();return;}
        texture.minFilter=texture.magFilter=THREE.LinearFilter;
        texture.generateMipmaps=false;texture.encoding=THREE.LinearEncoding;texture.needsUpdate=true;
      });
      this.textures.add(map);
      this.maps[file]=map;
    }
    this.layers.star.material.map=this.maps['blue-starlight'];
    this.layers.star.material.needsUpdate=true;
  }
  update(opening,enabled) {
    if(this.disposed)return;
    if(!enabled || !opening || opening.stopped){this.group.visible=false;this.clock.reset();return;}
    const song=SONG_ART[opening.preset || 102];
    if(!song){this.group.visible=false;this.clock.reset();return;}
    if(!this.maps[song.title] || !this.maps[song.artist]){this.group.visible=false;return;}
    for(const key of ['title','artist']) {
      const material=this.layers[key].material,map=this.maps[song[key]];
      if(material.map!==map){material.map=map;material.needsUpdate=true;}
    }
    const time=this.clock.read(opening.getAudio()), f=openingArtFrame(time,opening.firstLyricMs,song.titleGrowth,song);
    this.group.visible=f.titleAlpha>0 || f.artistAlpha>0;
    if(!this.group.visible)return;
    this.group.position.copy(this.camera.position);this.group.quaternion.copy(this.camera.quaternion);
    const vp=this.getViewport(), depth=2;
    const screenH=2*depth*Math.tan(this.camera.fov*Math.PI/360), screenW=screenH*this.camera.aspect;
    const place=(key,width,height,top,alpha,shift=0)=>{
      const plane=this.layers[key];
      plane.position.set(screenW*shift,screenH*(.5-(top+height*.5)/vp.windowHeight),-depth);
      plane.scale.set(screenW*width,screenH*height/vp.windowHeight,1);plane.material.opacity=alpha;
    };
    const titleH=44*f.titleScale;
    place('title',.84*f.titleScale,titleH,opening.topPx-(titleH-44)*.5,f.titleAlpha,f.titleShift);
    place('star',.84,33,opening.topPx+40,f.starAlpha,f.titleShift);
    place('artist',song.artistWidth*f.artistScale,20*f.artistScale,opening.topPx+65+f.artistDrop,f.artistAlpha,f.artistShift);
  }
  dispose() {
    if(this.disposed)return;this.disposed=true;
    this.group.parent?.remove(this.group);
    Object.values(this.layers).forEach(p=>{p.geometry.dispose();p.material.dispose();});
    this.textures.forEach(t=>t.dispose());this.textures.clear();
  }
}

// Out of Darkness environment; shares the continuous audio clock above.

const darknessClamp = v => Math.max(0, Math.min(1, v));
const darknessEase = v => { v = darknessClamp(v); return v*v*(3-2*v); };
const darknessLyricKey = text => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const MOTIFS = {
  listentomyvoice: 'call', pullingyououtofdarkness: 'darkness',
  stillidreamofyourspiritleadingyoubackhome: 'home',
  thelightinyoureyesisanangeluphigh: 'light', withthewindyougo: 'wind'
};

// Derived from the loaded song, never another song's fixed seconds.
export function buildDarknessTimeline(lines, leadInMs = 1200) {
  const body = (lines || []).map((line,index) => ({ index, motif:MOTIFS[darknessLyricKey(line.text)],
    at:Math.max(0,(Number(line['start-time'])-leadInMs)/1000),
    end:(Number(line['start-time'])+Number(line.duration || 0))/1000
  })).filter(line => line.index >= 2 && Number.isFinite(line.at));
  const events = body.filter(line => line.motif);
  return { events, end:Math.max(0,...body.map(line => line.end)),
    valid:events.some(e => e.motif === 'call') && events.some(e => e.motif === 'darkness') };
}

export function darknessVisualFrame(time, timeline, cueTimes, resumeAt = 0) {
  // Future lyric events stay dormant until PoetryManager makes the English visible.
  const events = timeline.events.map(e => ({...e, at:cueTimes?.has(e.index)
    ? cueTimes.get(e.index) : (!cueTimes || e.at < resumeAt ? e.at : Infinity)}));
  const first = motif => events.find(e => e.motif === motif)?.at ?? Infinity;
  const call = darknessEase((time-first('call'))/5);
  const release = darknessEase((time-first('darkness'))/9);
  const home = darknessEase((time-first('home'))/10);
  const light = darknessEase((time-first('light'))/10);
  const lightAge=time-first('light');
  // One soft passage of sunlight, followed by sustained brighter geography.
  const sunPeak=darknessEase(lightAge/4.5)*(1-darknessEase((lightAge-6)/6));
  const intro = darknessEase((time-1.2)/6);
  const tail = darknessEase((time-(timeline.end+1))/10);
  let pulse = 0;
  for (const e of events) {
    if (e.motif !== 'darkness' && e.motif !== 'light') continue;
    const age = time-e.at;
    if (age >= 0 && age <= 14) pulse = Math.max(pulse,Math.sin(Math.PI*age/14));
  }
  const settle = 1-tail*.15;
  const drifters=[10,23,48,59,82,94].map((at,index)=>({index:100+index,
    progress:(time-at)/6.5,ambient:true})).filter(e=>e.progress>=0&&e.progress<=1);
  return {
    time, surface:(.075*intro+.075*call+.25*release+.16*home+.52*light+.06*sunPeak)*settle,
    dayGain:.32+.80*light, nightGain:.75+.25*home,
    rim:(.016*intro+.045*call+.13*release+.12*home+.22*light+.10*pulse)*settle,
    warmth:.08*home+.48*light, stars:(.12+.020*intro+.055*call+.11*release+.08*home+.10*light)*settle,
    arc:(.60*release+.24*pulse)*(1-tail*.75),
    ambientArcs:intro*(.34+.08*call)*(1-.45*light),
    sunPeak,sunTravel:darknessEase(lightAge/12),sunlight:(1.20*sunPeak+.10*light)*settle,
    rotationSpeed:2.1+.3*light,
    meteors:events.filter(e => ['call','wind','light'].includes(e.motif)).slice(0,3)
      .map(e => ({index:e.index,progress:(time-e.at)/3.6})).filter(e => e.progress >= 0 && e.progress <= 1),
    drifters
  };
}

const sparkVertex = `
  attribute float strength; attribute float pointSize;
  uniform float pixelRatio; uniform float gain;
  varying float vStrength;
  void main(){ vStrength=strength*gain;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    gl_PointSize=pointSize*pixelRatio; }
`;
const sparkFragment = `
  precision mediump float; varying float vStrength; uniform vec3 tint;
  void main(){vec2 p=gl_PointCoord-.5;float r=length(p);
    float core=exp(-r*r*90.0), glow=exp(-r*r*19.0)*.28;
    float rays=exp(-abs(p.x)*90.0-abs(p.y)*9.0)+exp(-abs(p.y)*90.0-abs(p.x)*9.0);
    float a=(core+glow+rays*.13)*vStrength*(1.0-smoothstep(.32,.5,r));
    gl_FragColor=vec4(tint,a); }
`;

export class DarknessVisual {
  constructor({THREE,scene,camera,globeGroup,starCtl,renderer}) {
    Object.assign(this,{THREE,scene,camera,globeGroup,starCtl,renderer});
    this.clock = new ZenVisualClock();
    this.group = new THREE.Group(); this.group.name = 'ZEN_DARKNESS_LIGHT';
    this.group.visible = false; scene.add(this.group);
    this.center = new THREE.Vector3(); this.saved = new Map(); this.frame = null;
    this.build();
  }
  build() {
    const T=this.THREE;
    this.halo = new T.Mesh(new T.SphereBufferGeometry(1.022,64,40),new T.ShaderMaterial({
      uniforms:{gain:{value:0},warmth:{value:0}},
      vertexShader:`varying vec3 vNormal; varying vec3 vEye;
        void main(){vec4 p=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);
        vEye=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
      fragmentShader:`precision mediump float; varying vec3 vNormal; varying vec3 vEye;
        uniform float gain;uniform float warmth;
        void main(){float edge=pow(1.0-abs(dot(normalize(vNormal),normalize(vEye))),4.5);
        float side=smoothstep(-.7,.75,vNormal.x);
        vec3 c=mix(vec3(.18,.48,.85),vec3(.85,.72,.53),warmth);
        gl_FragColor=vec4(c,edge*gain*(.22+.78*side));}`,
      transparent:true,depthTest:true,depthWrite:false,blending:T.AdditiveBlending
    }));
    this.group.add(this.halo);
    const particles = count => {
      const g=new T.BufferGeometry();
      g.addAttribute('position',new T.Float32BufferAttribute(new Float32Array(count*3),3));
      g.addAttribute('strength',new T.Float32BufferAttribute(new Float32Array(count),1));
      g.addAttribute('pointSize',new T.Float32BufferAttribute(new Float32Array(count),1));
      const m=new T.ShaderMaterial({vertexShader:sparkVertex,fragmentShader:sparkFragment,
        uniforms:{gain:{value:0},pixelRatio:{value:this.renderer.getPixelRatio()},tint:{value:new T.Color(.56,.78,1)}},
        transparent:true,depthTest:true,depthWrite:false,blending:T.AdditiveBlending});
      const p=new T.Points(g,m);p.frustumCulled=false;return p;
    };
    this.arc=particles(84);this.group.add(this.arc);
    this.ambientArcs=[0,1,2].map(i=>{
      const arc=particles(36);arc.name='ZEN_DARKNESS_ORBIT_'+i;
      arc.material.uniforms.tint.value.setRGB(...[[.57,.79,1],[.74,.70,1],[.78,.89,1]][i]);
      this.group.add(arc);return arc;
    });
    this.meteor=particles(28);this.meteor.name='ZEN_DARKNESS_METEOR';
    this.meteor.visible=false;this.scene.add(this.meteor);
    this.drifter=particles(24);this.drifter.name='ZEN_DARKNESS_DRIFTER';
    this.drifter.visible=false;this.scene.add(this.drifter);
    // Adapted from MoonOrbitSequence._tickGlare: wide main ray, soft scattered
    // shoulders and a halo. Root follows the Earth limb, never a sweeping bar.
    this.sunlight=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({
      uniforms:{strength:{value:0},aspect:{value:1},root:{value:new T.Vector2()}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`precision mediump float;varying vec2 vUv;
        uniform float strength,aspect;uniform vec2 root;
        float ray(vec2 p,float slope,float width,float reach){
          float d=root.y-p.y,lateral=p.x-root.x-slope*d;
          float w=width*(.85+.55*max(0.0,d));
          return exp(-lateral*lateral/(w*w))*exp(-max(0.0,d)/reach)*smoothstep(0.0,.12,d);
        }
        void main(){vec2 p=(vUv*2.0-1.0)*vec2(aspect,1.0);
          float d=max(0.0,root.y-p.y);
          float grain=.76+.13*sin(p.x*13.0+d*5.0)+.08*sin(p.x*23.0-d*8.0);
          float rays=ray(p,-.38,.23,.68)*.62+ray(p,-.40,.48,.58)*grain*.24;
          float halo=exp(-length(p-root)*5.0)*.45;
          float a=1.0-exp(-strength*(halo+rays));
          gl_FragColor=vec4(vec3(1.0,.97,.89),a);
        }`,
      transparent:true,depthWrite:false,depthTest:false,blending:T.NormalBlending
    }));
    this.sunlight.name='ZEN_DARKNESS_SUNLIGHT';this.sunlight.renderOrder=30;
    this.sunlight.frustumCulled=false;this.sunlight.visible=false;this.scene.add(this.sunlight);
    this.projectedCenter=new T.Vector3();this.cameraCenter=new T.Vector3();
  }
  prepare(opening, enabled, paused, now) {
    if (!enabled) { this.reset();return null; }
    if (paused && this.frame) return {...this.frame,rotationSpeed:0};
    // Keep a little starlight while audio/subtitles load; Earth remains dark.
    if (!opening || opening.preset !== 103) {
      this.frame=darknessVisualFrame(0,{events:[],end:Infinity},new Map());
      return this.frame;
    }
    if (opening.stopped) {this.reset();return null;}
    if (this.opening !== opening) {
      this.opening=opening;this.timeline=buildDarknessTimeline(opening.visualLines,opening.visualLeadInMs);
      this.clock.reset();
    }
    if (!this.timeline.valid) {this.reset();return null;}
    const audio=opening.getAudio();
    const time=this.clock.read(audio,now);
    this.frame=darknessVisualFrame(time,this.timeline,opening.visualCueTimes,opening.visualResumeAt);
    if (audio?.paused) return {...this.frame,rotationSpeed:0};
    return this.frame;
  }
  save(object,property) {
    if (!object) return;
    let properties=this.saved.get(object);
    if (!properties) {properties={};this.saved.set(object,properties);}
    if (!(property in properties)) properties[property]=object[property];
  }
  apply(material,cloudMesh) {
    const f=this.frame;if (!f) return;
    const u=material?.uniforms;
    if (u?.uSongSurfaceGain) {
      u.uSongSurfaceGain.value=f.surface;u.uSongDayGain.value=f.dayGain;
      u.uSongNightGain.value=f.nightGain;u.uSongRim.value=f.rim;u.uSongWarmth.value=f.warmth;
    } else if (material?.color) {
      // Shader fallback still supports the dark-to-light curve without touching other themes.
      this.save(material,'opacity');this.save(material,'transparent');
      material.transparent=true;material.opacity=f.surface;
    }
    if (cloudMesh?.material) {
      this.save(cloudMesh.material,'opacity');
      cloudMesh.material.opacity=this.saved.get(cloudMesh.material).opacity*f.surface;
    }
    // Keep map outlines from floating brightly over an almost invisible globe.
    this.globeGroup.traverse(o=>{
      if (!o.material) return;
      // Country/city text sprites would remain bright against the dark opening.
      if (o.renderOrder === 999 && typeof o.userData?.baseScaleX === 'number') {
        this.save(o.material,'opacity');o.material.opacity=0;return;
      }
      const ro=o.material.userData?.ro;
      if (![20,28,40].includes(ro)) return;
      this.save(o.material,'opacity');this.save(o.material,'transparent');
      o.material.transparent=true;
      o.material.opacity=this.saved.get(o.material).opacity*f.surface*(ro===28?.16:.55);
    });
    const su=this.starCtl?.mesh?.material?.uniforms;
    for (const name of ['uOpacity','uBreathSpeed','uBreathStrength','time']) if (su?.[name]) this.save(su[name],'value');
    if (su?.uOpacity) {
      this.save(this.starCtl.mesh,'visible');
      su.uOpacity.value=f.stars;this.starCtl.mesh.visible=f.stars>0;
    }
    if (su?.uBreathSpeed) su.uBreathSpeed.value=.22;
    if (su?.uBreathStrength) su.uBreathStrength.value=.18;
    if (su?.time) su.time.value=f.time;
    this.material=material;
    this.globeGroup.getWorldPosition(this.center);
    this.group.position.copy(this.center);this.group.quaternion.copy(this.camera.quaternion);
    this.group.visible=true;
    this.halo.material.uniforms.gain.value=f.rim;
    this.halo.material.uniforms.warmth.value=f.warmth;
    const g=this.arc.geometry,p=g.attributes.position,s=g.attributes.strength,z=g.attributes.pointSize;
    const angle=-f.time*.095+1.2;
    for(let i=0;i<p.count;i++) {
      const age=i/(p.count-1),a=angle+age*1.13,r=1.09;
      p.setXYZ(i,Math.cos(a)*r,Math.sin(a)*r*.64,Math.sin(a)*r*.77);
      s.setX(i,Math.pow(1-age,1.5));z.setX(i,i===0?13:3.8*(1-age)+1.2);
    }
    p.needsUpdate=s.needsUpdate=z.needsUpdate=true;
    this.arc.material.uniforms.gain.value=f.arc*.7;
    this.arc.material.uniforms.pixelRatio.value=this.renderer.getPixelRatio();
    this.updateAmbientArcs(f);
    this.updateMeteor(f);
    this.updateSunlight(f);
  }
  updateAmbientArcs(f) {
    const routes=[{r:1.12,incl:1.00,tilt:-.25,speed:.19,phase:2.5},
      {r:1.17,incl:-.93,tilt:.42,speed:.14,phase:2.7},
      {r:1.09,incl:.60,tilt:-.55,speed:.11,phase:3.6}];
    this.ambientArcs.forEach((arc,j)=>{
      const route=routes[j],g=arc.geometry,p=g.attributes.position,s=g.attributes.strength,z=g.attributes.pointSize;
      for(let i=0;i<p.count;i++){
        const age=i/(p.count-1),a=route.phase-f.time*route.speed+age*(.30+j*.06);
        const x=Math.cos(a)*route.r,y=Math.sin(a)*route.r*Math.cos(route.incl);
        p.setXYZ(i,x*Math.cos(route.tilt)-y*Math.sin(route.tilt),
          x*Math.sin(route.tilt)+y*Math.cos(route.tilt),Math.sin(a)*route.r*Math.sin(route.incl));
        s.setX(i,Math.pow(1-age,2.2));z.setX(i,i===0?9-j:2.6*(1-age)+1);
      }
      p.needsUpdate=s.needsUpdate=z.needsUpdate=true;
      arc.material.uniforms.gain.value=f.ambientArcs;
      arc.material.uniforms.pixelRatio.value=this.renderer.getPixelRatio();
    });
  }
  updateMeteor(f) {
    this.updateFlyingStar(this.meteor,f.meteors[0]);
    this.updateFlyingStar(this.drifter,f.drifters[0]);
  }
  updateFlyingStar(mesh,e) {
    mesh.visible=!!e;if(!e)return;
    const g=mesh.geometry,p=g.attributes.position,s=g.attributes.strength,z=g.attributes.pointSize;
    const depth=12,h=2*depth*Math.tan(this.camera.fov*Math.PI/360),w=h*this.camera.aspect;
    const side=e.index%2?1:-1,progress=e.progress;
    mesh.quaternion.copy(this.camera.quaternion);
    mesh.position.set(0,0,-depth).applyQuaternion(this.camera.quaternion).add(this.camera.position);
    for(let i=0;i<p.count;i++) {
      const age=i/(p.count-1),q=progress-age*.10;
      p.setXYZ(i,side*(-.48+q*.72)*w,
        (e.ambient ? .32-q*.08+Math.sin(q*Math.PI)*.035 : .42-q*.13)*h,0);
      s.setX(i,Math.pow(1-age,1.8));z.setX(i,i===0?11:3*(1-age)+1);
    }
    p.needsUpdate=s.needsUpdate=z.needsUpdate=true;
    mesh.material.uniforms.gain.value=(e.ambient ? .32 : .6)*Math.sin(Math.PI*progress);
    mesh.material.uniforms.pixelRatio.value=this.renderer.getPixelRatio();
  }
  updateSunlight(f) {
    const mesh=this.sunlight;mesh.visible=f.sunlight>.0001;if(!mesh.visible)return;
    this.projectedCenter.copy(this.center).project(this.camera);
    this.cameraCenter.copy(this.center).applyMatrix4(this.camera.matrixWorldInverse);
    const h=2*Math.tan(this.camera.fov*Math.PI/360);
    const radiusY=2/(Math.max(1,Math.abs(this.cameraCenter.z))*h);
    mesh.position.set(0,0,-2).applyQuaternion(this.camera.quaternion).add(this.camera.position);
    mesh.quaternion.copy(this.camera.quaternion);mesh.scale.set(h*this.camera.aspect,h,1);
    const u=mesh.material.uniforms;
    u.strength.value=f.sunlight;u.aspect.value=this.camera.aspect;
    const angle=.42+.48*f.sunTravel;
    u.root.value.set(this.projectedCenter.x*this.camera.aspect+radiusY*1.08*Math.cos(angle),
      this.projectedCenter.y+radiusY*1.08*Math.sin(angle));
  }
  reset() {
    if (this.material?.uniforms?.uSongSurfaceGain) {
      const u=this.material.uniforms;
      u.uSongSurfaceGain.value=u.uSongDayGain.value=u.uSongNightGain.value=1;
      u.uSongRim.value=u.uSongWarmth.value=0;
    }
    for(const [object,properties] of this.saved) Object.assign(object,properties);
    this.saved.clear();this.group.visible=this.meteor.visible=this.drifter.visible=this.sunlight.visible=false;
    this.frame=null;this.opening=null;this.material=null;this.clock.reset();
  }
  dispose() {
    this.reset();
    for(const o of [this.halo,this.arc,...this.ambientArcs,this.meteor,this.drifter,this.sunlight]) {o.geometry.dispose();o.material.dispose();}
    this.scene.remove(this.group);this.scene.remove(this.meteor);this.scene.remove(this.drifter);this.scene.remove(this.sunlight);
  }
}
