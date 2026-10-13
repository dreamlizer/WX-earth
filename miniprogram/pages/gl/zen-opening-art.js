import { ZenVisualClock } from './zen-visual-clock.js';
import { ensureSceneArtPackage } from './scene-art-loader.js';
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { const t=clamp(x); return t*t*(3-2*t); };
const SONG_ART = {
  102:{title:'how-deep-title',artist:'bee-gees',artistWidth:.26,titleGrowth:.10},
  103:{title:'out-of-darkness-title',artist:'aubrey-ashburn',artistWidth:.455,titleGrowth:.50,
    artistGrowth:.70,entranceDelay:2,titleStart:-.08,titleDrift:.18,artistDrift:-.05,artistDrop:18}
};
export function openingArtFrame(time, firstLyricMs, titleGrowth=.10, options={}) {
  const end=Math.max(8,firstLyricMs/1000-2.5), gone=end+2.2;
  const fade=1-smooth((time-end)/2.2);
  const titleAt=4+(options.entranceDelay || 0),artistAt=8+(options.entranceDelay || 0);
  const titleProgress=clamp((time-titleAt)/(gone-titleAt));
  const artistProgress=clamp((time-artistAt)/(gone-artistAt));
  return {
    titleAlpha:smooth((time-titleAt)/1.8)*fade,starAlpha:smooth((time-titleAt)/1.8)*fade,
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
