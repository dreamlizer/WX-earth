import {fixTexture} from './asset-manager.js';
import {keepsakeAt,keepsakeGeometry,PHOTO_END,PHOTO_SHUTTER} from './moon-keepsake-motion.js';
import {moonPlaybackTime} from './moon-playback-clock.js';
import {traceMoon} from './moon-voyage-trace.js';

export const PHOTO_PATH='/moon-photo-assets/keepsake.jpg';
let packagePromise=null;
function ensurePhotoPackage(){
  if(!packagePromise)packagePromise=new Promise((resolve,reject)=>{
    require('../../moon-photo-assets/ready.js',resolve,reject);
  }).catch(error=>{packagePromise=null;throw error;});
  return packagePromise;
}
const fragment=`
uniform sampler2D worldMap,photoMap;
uniform mat3 photoUV;
uniform vec2 viewport,frameSize,imageSize,offset;
uniform float angle,border,bottom,shutter,photoVisible,backgroundDim,blur,fit;
varying vec2 vUv;
void main(){
  vec2 d=vec2(blur*fit)/viewport;
  vec3 bg=texture2D(worldMap,vUv).rgb*.25;
  bg+=(texture2D(worldMap,vUv+vec2(d.x,0.)).rgb+texture2D(worldMap,vUv-vec2(d.x,0.)).rgb+texture2D(worldMap,vUv+vec2(0.,d.y)).rgb+texture2D(worldMap,vUv-vec2(0.,d.y)).rgb)*.125;
  bg+=(texture2D(worldMap,vUv+d).rgb+texture2D(worldMap,vUv-d).rgb+texture2D(worldMap,vUv+vec2(d.x,-d.y)).rgb+texture2D(worldMap,vUv+vec2(-d.x,d.y)).rgb)*.0625;
  vec3 color=bg*(1.-backgroundDim);
  if(photoVisible>.5){
    vec2 p=(vUv-.5)*viewport-offset;
    float c=cos(angle),s=sin(angle);
    vec2 local=mat2(c,s,-s,c)*p;
    vec2 outside=max(abs(local-vec2(0.,-12.*fit))-frameSize*.5,vec2(0.));
    color*=1.-.80*exp(-dot(outside,outside)/(2.*pow(16.*fit,2.)));
    float edge=max(abs(local.x)-frameSize.x*.5,abs(local.y)-frameSize.y*.5);
    float paper=1.-smoothstep(-.65*fit,.65*fit,edge);
    vec3 ink=vec3(232.,229.,220.)/255.;
    vec2 uv=vec2((local.x+imageSize.x*.5)/imageSize.x,(local.y+frameSize.y*.5-bottom)/imageSize.y);
    if(uv.x>=0.&&uv.x<=1.&&uv.y>=0.&&uv.y<=1.)ink=texture2D(photoMap,(photoUV*vec3(uv,1.)).xy).rgb;
    color=mix(color,ink,paper);
  }
  gl_FragColor=vec4(color*(1.-shutter),1.);
}`;

// One local image and one screen pass; no second audio player or canvas layer.
export class MoonKeepsake {
  constructor(mgr,renderer){this.mgr=mgr;this.renderer=renderer;this.status='idle';this.disposed=false;this.shown=false;this.suspended=false;}
  async prepare(){
    this.status='loading';const current=()=>!this.disposed&&this.mgr.active;
    try{
      await ensurePhotoPackage();if(!current())return;
      const T=this.mgr.THREE;
      const texture=await new Promise((resolve,reject)=>new T.TextureLoader().load(PHOTO_PATH,resolve,undefined,reject));
      if(!current()){texture.dispose();return;}
      this.texture=texture;texture.encoding=T.LinearEncoding;texture.flipY=true;texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.updateMatrix();fixTexture(texture,this.mgr._isPCClient);
      this.target=new T.WebGLRenderTarget(2,2,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true,stencilBuffer:false});
      this.scene=new T.Scene();this.camera=new T.OrthographicCamera(-1,1,1,-1,0,2);this.camera.position.z=1;
      const value=x=>({value:x});
      this.uniforms={worldMap:value(this.target.texture),photoMap:value(texture),photoUV:value(texture.matrix),viewport:value(new T.Vector2()),frameSize:value(new T.Vector2()),imageSize:value(new T.Vector2()),offset:value(new T.Vector2()),angle:value(0),border:value(0),bottom:value(0),shutter:value(0),photoVisible:value(0),backgroundDim:value(0),blur:value(0),fit:value(1)};
      this.material=new T.ShaderMaterial({uniforms:this.uniforms,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:fragment,depthTest:false,depthWrite:false});
      this.material.toneMapped=false;this.quad=new T.Mesh(new T.PlaneBufferGeometry(2,2),this.material);this.quad.frustumCulled=false;this.scene.add(this.quad);
      this.renderer.compile(this.scene,this.camera);this.renderer.initTexture?.(texture);
      this.status='ready';traceMoon(this.mgr,'photo-ready');
    }catch(error){if(current()){this.status='failed';console.warn('[Moon photo] Keeping previous ending:',error?.message||error);traceMoon(this.mgr,'photo-failed');}this.release();}
  }
  render(time,renderWorld){
    if(this.status!=='ready'||this.disposed||time<PHOTO_SHUTTER)return false;
    const r=this.renderer,T=this.mgr.THREE,size=r.getSize(new T.Vector2()),pixels=r.getDrawingBufferSize(new T.Vector2());
    const cap=Math.min(2048,r.capabilities.maxTextureSize),scale=Math.min(1,cap/Math.max(pixels.x,pixels.y));
    const tw=Math.max(1,Math.round(pixels.x*scale)),th=Math.max(1,Math.round(pixels.y*scale));
    if(this.target.width!==tw||this.target.height!==th)this.target.setSize(tw,th);
    const state=keepsakeAt(time),g=keepsakeGeometry(state,size.x,size.y),u=this.uniforms;
    u.viewport.value.copy(size);u.frameSize.value.set(g.w,g.h);u.imageSize.value.set(g.iw,g.ih);u.offset.value.set(g.x,-g.y);
    for(const key of ['shutter','backgroundDim','blur'])u[key].value=state[key];
    u.photoVisible.value=state.opacity;u.angle.value=g.angle;u.border.value=g.border;u.bottom.value=g.bottom;u.fit.value=g.fit;
    const target=r.getRenderTarget(),autoClear=r.autoClear;
    try{r.autoClear=true;r.setRenderTarget(this.target);renderWorld();r.setRenderTarget(target);r.render(this.scene,this.camera);}
    finally{r.setRenderTarget(target);r.autoClear=autoClear;}
    if(!this.shown&&state.opacity){
      this.shown=true;this.mgr.phase='KEEPSAKE';
      this.mgr.page?.setData?.({moonKeepsakeVisible:true,moonKeepsakeControls:false,moonKeepsakeSaving:false});
      traceMoon(this.mgr,'photo-shown');
    }
    return true;
  }
  holdAtEnd(){
    if(!this.shown||this.status!=='ready'||this.disposed||!this.mgr._terrain?.active)return false;
    this.mgr._moonPhotoHold={time:Math.max(PHOTO_END,this.mgr._accumTime||0),at:Date.now(),paused:this.suspended};
    this.mgr.phase='KEEPSAKE';traceMoon(this.mgr,'photo-hold');return true;
  }
  setSuspended(paused){
    this.suspended=paused;const hold=this.mgr._moonPhotoHold;
    if(!hold||hold.paused===paused)return;
    if(paused)hold.time=moonPlaybackTime(this.mgr);
    hold.at=Date.now();hold.paused=paused;
  }
  hideControls(){clearTimeout(this.controlsTimer);this.mgr.page?.setData?.({moonKeepsakeControls:false});}
  toggleControls(){
    if(!this.shown||this.disposed||this.mgr._exiting)return;
    const visible=!this.mgr.page?.data?.moonKeepsakeControls;
    clearTimeout(this.controlsTimer);this.mgr.page?.setData?.({moonKeepsakeControls:visible});
    traceMoon(this.mgr,'photo-controls',{visible});
    if(visible)this.controlsTimer=setTimeout(()=>{if(!this.disposed&&!this.saving)this.hideControls();},4000);
  }
  async save(){
    if(this.saving||!this.shown||this.disposed||this.mgr._exiting)return;
    this.saving=true;clearTimeout(this.controlsTimer);this.mgr.page?.setData?.({moonKeepsakeSaving:true});
    try{
      const info=await new Promise((resolve,reject)=>wx.getImageInfo({src:PHOTO_PATH,success:resolve,fail:reject}));
      if(this.disposed||this.mgr._exiting)return;
      await new Promise((resolve,reject)=>wx.saveImageToPhotosAlbum({filePath:info.path,success:resolve,fail:reject}));
      if(!this.disposed){wx.showToast({title:'照片已保存',icon:'success'});traceMoon(this.mgr,'photo-saved');}
    }catch(error){
      if(!this.disposed){const message=String(error?.errMsg||error?.message||'');wx.showToast({title:/auth|deny|denied/i.test(message)?'需要允许保存到相册':/cancel/i.test(message)?'已取消保存':'暂时无法保存照片',icon:'none'});traceMoon(this.mgr,'photo-save-failed');}
    }finally{this.saving=false;if(!this.disposed)this.mgr.page?.setData?.({moonKeepsakeSaving:false});}
  }
  release(){this.quad?.geometry.dispose();this.material?.dispose();this.target?.dispose();this.texture?.dispose();this.quad=null;this.material=null;this.target=null;this.texture=null;}
  dispose(){
    this.disposed=true;clearTimeout(this.controlsTimer);this.release();this.status='disposed';this.mgr._moonPhotoHold=null;
    this.mgr.page?.setData?.({moonKeepsakeVisible:false,moonKeepsakeControls:false,moonKeepsakeSaving:false});
  }
}
