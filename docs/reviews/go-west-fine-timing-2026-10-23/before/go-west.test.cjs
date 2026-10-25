const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
function load(file,names,extra={}){
  const src=fs.readFileSync(file,'utf8').replace(/^import .*$/gm,'').replace(/export /g,'');
  const context={module:{exports:{}},console,Math,Date,...extra};
  vm.runInNewContext(src+'\nmodule.exports={'+names.join(',')+'};',context,{filename:file});
  return context.module.exports;
}
const text=load('miniprogram/assets/data/go-west-text.js',['GO_WEST_LINES','GO_WEST_CALLS','GO_WEST_TEXT']);
const data=load('miniprogram/assets/data/go-west-cues.js',['GO_WEST_CUES','GO_WEST_TIMING','goWestChorusSection'],text);
const {ZenVisualClock}=load('miniprogram/pages/gl/zen-visual-clock.js',['ZenVisualClock']);
const {ZenSongOpening}=load('miniprogram/pages/gl/zen-song-opening.js',['ZenSongOpening']);
const {goWestFinaleFrame,GO_WEST_LYRIC_CUTOFF}=load('miniprogram/pages/gl/go-west-finale-timing.js',['goWestFinaleFrame','GO_WEST_LYRIC_CUTOFF']);
const {goWestLyricState,goWestFrame,GoWestSong,GoWestPreviewClock,goWestTextFit,GO_WEST_STAR_CUES,goWestStarShimmer}=load(
  'miniprogram/pages/gl/go-west-song.js',['goWestLyricState','goWestFrame','GoWestSong','GoWestPreviewClock','goWestTextFit','GO_WEST_STAR_CUES','goWestStarShimmer'],
  {...data,...text,ZenVisualClock,ZenSongOpening,goWestFinaleFrame,GO_WEST_LYRIC_CUTOFF});
const lrc=fs.readFileSync('source-lyrics/go_west_psb_1993.lrc','utf8').trim().split(/\r?\n/);
assert.equal(text.GO_WEST_LINES.length,66);assert.equal(lrc.length,66);
for(let i=0;i<lrc.length;i++){
  const m=lrc[i].match(/^\[(\d+):(\d+\.\d+)\](.*)$/);
  const line=text.GO_WEST_LINES[i];
  assert.equal(line.original,m[3],'Original supplied words are preserved');
  assert.equal(Math.round(data.GO_WEST_CUES[i].start*100),Number(m[1])*6000+Math.round(Number(m[2])*100));
  const words=s=>s.toLowerCase().replace(/[^a-z]/g,'');
  const mainVoice=line.original.replace(/\((?:We'll be|We'll find|Aah[^)]*)\)/gi,'');
  assert.equal(words(line.call+line.response),words(mainVoice),'Voice split preserves main lyrics while omitting backing echoes');
  assert.ok(!/[（(]啊[）)]/.test(line.zhCall+line.zhResponse),'Chinese vocal filler is removed');
}
const zhSource=fs.readFileSync('source-lyrics/go-west-zh-user-20261019.txt','utf8');
const zhPairs=[...zhSource.matchAll(/\[\d+:\d+\.\d+\] [^\n]+\n\s*([^\n]+)/g)];
assert.equal(zhPairs.length,66);
for(let i=0;i<66;i++){
  const clean=value=>value.replace(/[（）\s]/g,'').replace(/啊/g,'');
  assert.equal(clean(text.GO_WEST_LINES[i].zhCall+text.GO_WEST_LINES[i].zhResponse),clean(zhPairs[i][1]),
    'Every Chinese phrase comes from the user-provided version');
}
// Independently parse the delivered SRT: no ASR text may replace approved words.
const seconds=value=>value.split(':').reduce((sum,v)=>sum*60+Number(v.replace(',','.')),0);
const recognized=new Map(fs.readFileSync('source-lyrics/go-west-jianying-20261023.srt','utf8').trim().split(/\n\s*\n/).map(block=>{
 const [number,times,...words]=block.split('\n'),[start,end]=times.split(' --> ');
 return [Number(number),{start:seconds(start),end:seconds(end),text:words.join(' ')}];
}));
assert.equal(recognized.size,60);
const cueAt=start=>data.GO_WEST_CUES.find(c=>c.start===start);
const pairAt=(cue,time,width=390)=>goWestLyricState(time,undefined,false,{width}).groups.find(g=>g.id.startsWith(cue.id+':'));
for(const cue of data.GO_WEST_CUES.filter(c=>c.srtRow)){
 assert.ok(cue.sungEnd>cue.sungCallAt);
 assert.ok(cue.end>Math.max(cue.callAt,cue.responseAt),'Each shortened pair retains both voice entrances');
 assert.ok(cue.responseAt<cue.sungEnd,'A reply can be read before its sung phrase ends');
 assert.ok(cue.timingMethod,'Estimates and fallbacks retain their provenance');
 if(!/retain|estimate$|word-span|source lead|source start/.test(cue.timingMethod) || cue.timingMethod==='merged-cadence-estimate'){
  assert.ok(Math.abs(cue.sungCallAt-recognized.get(cue.srtRow).start)<.0011,'Whole phrase begins at the supplied SRT anchor');
 }
}
for(const [start,call,reply] of [[186.33,186.3,187.566],[211.78,211.6,213.5],
 [231.4,231.266,233.366],[235.03,235.2,237.4],[244.07,243.466,245.166]]){
 const c=cueAt(start);assert.equal(c.sungCallAt,call);assert.equal(c.sungResponseAt,reply);
 assert.ok(c.callAt<call&&c.responseAt<reply,'Per-voice entrance headroom is explicit');
 assert.equal(pairAt(c,c.responseAt-.001).responseVisible,false);
 assert.equal(pairAt(c,c.responseAt+.001).responseVisible,true);
 assert.equal(pairAt(c,c.responseAt+.1).callVisible,true,'Lead remains when the response appears');
}
const first=cueAt(36.02);
assert.equal(first.callAt,34.8,'First Together keeps half a second of headroom before the SRT 35.3 anchor');
assert.equal(goWestLyricState(34.799).groups.length,0);
assert.equal(goWestLyricState(34.801).groups[0].call,'TOGETHER');
assert.equal(goWestLyricState(34.801).groups[0].responseVisible,false);
assert.equal(data.GO_WEST_TIMING.firstLyricSec,36.02,'Earth/intro scene clock stays unchanged');
const combinedStarts=[51.44,55.42,59.37,63.39];
for(const cue of data.GO_WEST_CUES.filter(c=>c.callKind==='together')){
 const g=pairAt(cue,cue.callAt+.1),selected=combinedStarts.includes(cue.start);
 assert.equal(!!g.combined,selected,'Only approved Together 05–08 use the combined effect');
 if(selected){
  assert.equal(g.callEchoLayers.length,3);
  assert.ok(g.callEchoLayers.every(layer=>layer.style.includes('animation-delay: -100ms')));
  assert.equal(g.responseLetters.map(letter=>letter.text).join('').replace(/\u00a0/g,' '),g.response);
  const reply=pairAt(cue,cue.responseAt+.1);
  assert.equal(reply.responseLetters[0].style.match(/animation-delay: (-?\d+)ms/)[1],'-100');
 }
}
// This change moves only exits. Every aligned voice entry remains exactly as
// before, and the blank before the next pair matches the pre-SRT experience.
const priorAlignment=load('docs/reviews/go-west-gaps-type-in-2026-10-23/before/go-west-cues.js',
 ['GO_WEST_CUES'],text).GO_WEST_CUES;
const originalSpacing=load('docs/reviews/go-west-srt-timing-2026-10-23/before/go-west-cues.js',
 ['GO_WEST_CUES'],text).GO_WEST_CUES.filter(c=>!c.adlib&&!c.hidden&&c.start<259);
for(const c of data.GO_WEST_CUES){
 const before=priorAlignment.find(p=>p.id===c.id);
 for(const key of ['callAt','responseAt','sungCallAt','sungResponseAt','sungEnd'])assert.equal(c[key],before[key],key+' is unchanged');
}
for(let i=0;i<originalSpacing.length-1;i++){
 const old=originalSpacing[i],nextOld=originalSpacing[i+1];if(old.style==='tableau')continue;
 const c=cueAt(old.start),next=cueAt(nextOld.start);
 const gap=Math.max(0,nextOld.callAt-old.end);
 assert.ok(Math.abs(Math.min(next.callAt,next.responseAt)-c.end-gap)<.0011,'Restore every original blank, with no pair overlap');
 assert.ok(c.end<=Math.min(next.callAt,next.responseAt));
}
const outgoing=cueAt(47.65),incoming=cueAt(51.44);
assert.equal(outgoing.end,50.91);assert.equal(incoming.callAt,51.05);
assert.equal(goWestLyricState(50.98).groups.length,0,'The original 140ms fourth/fifth Together blank is restored');
assert.equal(goWestLyricState(51.051).groups.length,1,'The previous Together is gone before the fifth appears');
for(const width of [320,375,430])for(let time=34.75;time<247.1;time+=.11){
 const state=goWestLyricState(time,undefined,false,{width,measure:(value,size)=>value.length*size});
 assert.equal(state.groups.length,state.chinese.length);
 if(time<86.316||time>=97.85)assert.ok(state.groups.length<=1,'Ordinary phrases never overlap');
 for(let i=0;i<state.groups.length;i++){
  const en=state.groups[i],zh=state.chinese[i];
  assert.equal(en.id,zh.id);assert.equal(en.pairFadeStyle,zh.pairFadeStyle);
  for(const g of [en,zh])for(const role of ['call','response']){
   assert.equal(g[role+'FadeStyle'],g.pairFadeStyle,'Both voices share the pair exit');
   assert.ok(g[role+'Size']>=14);assert.ok(!/[\r\n]/.test(g[role]));
   const region=width*(g===en?.90:.76),scale=role==='call'?g.callMaxScale:g.maxScale;
   assert.ok((g[role].length*g[role+'Size']+.15*g[role].length)*scale<=region,'Animated text remains single-line and fits');
  }
 }
}
const transition=cueAt(87.49),nextVerse=cueAt(99.59),transitionEnd=Math.round((nextVerse.callAt-.8)*1000)/1000;
for(const [time,count] of [[transition.callAt+.01,1],[93.05,2],[97,2]]){
 const state=goWestLyricState(time);assert.equal(state.groups.length,count);
 for(let i=0;i<state.groups.length;i++)for(const g of [state.groups[i],state.chinese[i]]){
  assert.equal(g.style,'tableau');assert.equal(g.end,transitionEnd);assert.equal(g.sequential,true);
  assert.equal(g.callLetters.map(l=>l.text).join('').replace(/\u00a0/g,' '),g.call);
  assert.equal(g.responseLetters.map(l=>l.text).join('').replace(/\u00a0/g,' '),g.response);
  for(const list of [g.callLetters,g.responseLetters])if(list.length>1){
   const delays=list.map(l=>Number(l.style.match(/animation-delay: (-?\d+)ms/)[1]));
   assert.ok(delays.at(-1)>delays[0],'All three lines enter character by character');
  }
 }
}
assert.equal(goWestLyricState(transition.responseAt-.001).groups[0].responseVisible,false);
assert.equal(goWestLyricState(transition.responseAt+.001).groups[0].responseVisible,true);
assert.equal(goWestLyricState(transitionEnd+.001).groups.length,0,'Transition still leaves its approved quiet gap');
assert.equal(pairAt(nextVerse,nextVerse.callAt+.1).style,'impact');
const promise=cueAt(166.52),promiseGroup=pairAt(promise,promise.responseAt+.1);
assert.equal(promiseGroup.call,"WE'LL BE");assert.equal(promiseGroup.response,'what we want to be');assert.equal(promiseGroup.style,'promise');
for(const [start,expected] of [[142.3,'This is our destiny'],[171.5,'Now if we make a stand'],[174.31,"We'll find our promised land"]]){
 const c=cueAt(start);
 for(const width of [320,375,430]){
  const pages=[];
  for(let time=c.responseAt+.001;time<Math.min(c.end,247.1);time+=.025){
   const g=pairAt(c,time,width);if(!g)continue;
   if(pages.at(-1)!==g.response)pages.push(g.response);
  }
  assert.equal(pages.join(' '),expected,'New voice windows retain every word through single-line pagination');
 }
}
const pickup=cueAt(210.14);
for(const width of [320,375,430]){
 const pages=[];
 for(let time=pickup.callAt+.001;time<pickup.end;time+=.01){
  const group=pairAt(pickup,time,width);if(!group)continue;
  if(pages.at(-1)!==group.call)pages.push(group.call);
 }
 assert.deepEqual(pages.slice(-2),['DO','IS']);assert.equal(pages.join(' '),"WHAT WE'RE GONNA DO IS");
}
for(const c of data.GO_WEST_CUES.filter(c=>c.style==='choir')){
 const g=pairAt(c,c.responseAt+.1);assert.equal(g.style,'choir');assert.equal(g.maxScale,1);
 assert.ok(g.responseSize>g.callSize);
}
assert.equal(GO_WEST_LYRIC_CUTOFF,247.1);
for(const time of [247.1,247.63,248.1,251.34,259,284]){
 assert.equal(goWestLyricState(time).groups.length,0);assert.equal(goWestLyricState(time).chinese.length,0);
}
assert.ok(goWestLyricState(246.9).groups.length>0,'Last response remains until the existing confetti clearance');
assert.equal(goWestLyricState(246.9).groups.at(-1).end,247.1);
const beforeData=load('docs/reviews/go-west-srt-timing-2026-10-23/before/go-west-cues.js',
 ['GO_WEST_CUES','GO_WEST_TIMING','goWestChorusSection'],text);
const beforeSong=load('docs/reviews/go-west-srt-timing-2026-10-23/before/go-west-song.js',
 ['goWestFrame'],{...beforeData,...text,ZenVisualClock,ZenSongOpening,goWestFinaleFrame,GO_WEST_LYRIC_CUTOFF});
for(let time=0;time<260;time+=.05)assert.equal(JSON.stringify(goWestFrame(time)),JSON.stringify(beforeSong.goWestFrame(time)),
 'Audio-time Earth lighting, beat, six global sky flashes and confetti remain exactly unchanged');
assert.deepEqual(Array.from(GO_WEST_STAR_CUES),[67.27,74.75,130.72,138.35,211.78,219.38]);
assert.equal(goWestFrame(32.02).gain,0);assert.equal(goWestFrame(36.02).nightMix,1);assert.ok(goWestFrame(259).gain>1);
const makePage=time=>({data:{lang:'zh'},__zenAudioMgr:{audio:{currentTime:time,paused:false}},
 __getLayoutMgr:()=>({getViewport:()=>({windowWidth:390,windowHeight:800})}),
 setData(patch){this.patches=(this.patches||0)+1;Object.assign(this.data,patch);}});
const page=makePage(35.3),song=new GoWestSong({page});
song.clock.read=()=>34.5;let live=song.update(true,0);
assert.equal(live.time,34.5);assert.equal(live.lyricTime,35.3,'A fresh native sample cannot be held back by a lagging scene clock');
assert.equal(page.data.goWestGroups[0].call,'TOGETHER');assert.equal(song.opening.lyricTime,35.3);
const patchCount=page.patches;song.update(true,16);assert.equal(page.patches,patchCount,'No per-frame setData');
page.data.lang='en';song.update(true,32);assert.equal(page.data.goWestChinese.length,0);
song.update(false,48);assert.equal(page.data.goWestGroups.length,0);song.stop();song.stop();
const combined=cueAt(51.44),comboPage=makePage(combined.callAt+.1),comboSong=new GoWestSong({page:comboPage});
comboSong.update(true,1000);const comboId=comboPage.data.goWestGroups.find(g=>g.combined).id;
comboPage.__zenAudioMgr.audio.currentTime=combined.responseAt+.4;comboSong.clock.reset();comboSong.update(true,1032);
assert.notEqual(comboPage.data.goWestGroups.find(g=>g.combined).id,comboId,'Seeking resumes the selected echo/wave');
comboSong.pause();assert.equal(comboPage.data.goWestGroups.length,0);comboSong.resume();comboSong.update(true,1048);comboSong.stop();
let now=1000;const fakeDate={now:()=>now};
const preview=load('miniprogram/pages/gl/go-west-song.js',['GoWestPreviewClock'],
 {...data,...text,ZenVisualClock,ZenSongOpening,goWestFinaleFrame,Date:fakeDate});
const clock=new preview.GoWestPreviewClock();now+=2000;assert.equal(clock.currentTime,2);
clock.pause();now+=9000;assert.equal(clock.currentTime,2);clock.play();now+=1000;assert.equal(clock.currentTime,3);
clock.seek(70);assert.equal(clock.currentTime,70);
const measure=(value,size)=>value.length*size,fit=goWestTextFit('A'.repeat(60),35,250,measure);
assert.ok((measure('A'.repeat(60),fit)+.15*60)*1.22*1.08<250);
// Missing track four must never create an audio context playing track one.
let contexts=0;
const {ZenAudio}=load('miniprogram/pages/gl/zen-audio.js',['ZenAudio'],{
  wx:{createInnerAudioContext(){contexts++;throw Error('must not create');}},Set});
const audio=new ZenAudio({fileIds:{1:'first-song'},appCfg:{}});audio.start(4);
assert.equal(contexts,0);assert.equal(audio.ctx,null);
let actualSource='',played=0;
const {ZenAudio:ConfiguredAudio}=load('miniprogram/pages/gl/zen-audio.js',['ZenAudio'],{
  wx:{createInnerAudioContext(){return {set src(value){actualSource=value;},play(){played++;},onPlay(){},onEnded(){},onError(){},stop(){},destroy(){}};}},Set});
const configuredId=fs.readFileSync('miniprogram/pages/gl/page-state.js','utf8').match(/cloudZen4FileId: '([^']+)'/)[1];
assert.match(configuredId,/\/assets\/Go-West\.mp3$/);
new ConfiguredAudio({fileIds:{4:configuredId},appCfg:{}}).start(4);
assert.equal(actualSource,configuredId,'Track four selects the uploaded MP3');assert.ok(played>0);
// Exercise actual project r108 geometry, visibility gates and resource ownership.
const T=require('../miniprogram/node_modules/threejs-miniprogram').createScopedThreejs({width:390,height:753,createImage(){return {}}});
const {GoWestVisual,mirrorLampStrength,createGlassPanels}=load('miniprogram/pages/gl/go-west-visual.js',['GoWestVisual','mirrorLampStrength','createGlassPanels']);
// A neutral mirror reflects its source only at the reflected viewing angle.
const front=new T.Vector3(0,0,1),back=new T.Vector3(0,0,-1);
assert.equal(mirrorLampStrength(front,front,front,back,100,1),1);
assert.equal(mirrorLampStrength(front,front,front,back,16,0),0,'Unlit mirrors cannot glow');
assert.equal(mirrorLampStrength(back,front,front,back,16,1),0,'No illumination through a back face');
assert.equal(mirrorLampStrength(front,front,front,front,16,1),0,'A lamp aimed away cannot light a facet');
assert.equal(mirrorLampStrength(front,front,back,back,16,1),0,'A reflected ray must face the viewer');
assert.equal(mirrorLampStrength(front,front,front,back,400,1),.25,'Inverse-square attenuation');
const oblique=new T.Vector3(.6,0,.8),viewer=new T.Vector3(-.6,0,.8);
assert.ok(Math.abs(mirrorLampStrength(front,oblique,viewer,oblique.clone().negate(),100,1)-.8)<1e-10);
assert.ok(mirrorLampStrength(front,oblique,front,oblique.clone().negate(),16,1)<1e-40,
  'A visible illuminated facet is not automatically a mirror flash');
const scene=new T.Scene(),globeGroup=new T.Group(),camera=new T.PerspectiveCamera(50,.5,.1,100);
scene.add(globeGroup);camera.position.z=5;
const originalMaterial=new T.MeshBasicMaterial({color:0x123456});
const earth=new T.Mesh(new T.SphereBufferGeometry(1,16,8),originalMaterial);globeGroup.add(earth);
const visual=new GoWestVisual({THREE:T,scene,camera,globeGroup,renderer:{getPixelRatio:()=>2}});
visual.update(goWestFrame(70));assert.equal(visual.surface.visible,true);
assert.equal(earth.material,originalMaterial,'Original Earth material is retained');
const starUniforms={uBrightnessGain:{value:2.2},uGlowFactor:{value:.25},uSizeScale:{value:1.8},uOpacity:{value:.7}};
visual.getStars=()=>({material:starMaterial});
const starMaterial={uniforms:starUniforms};
visual.update(goWestFrame(67.37));
assert.ok(starUniforms.uBrightnessGain.value>2.2);
const starPeak=starUniforms.uBrightnessGain.value;visual.updateLights();
assert.equal(starUniforms.uBrightnessGain.value,starPeak,'Render frames do not compound the star gain');
assert.equal(starUniforms.uOpacity.value,.7,'Normal star visibility is retained');
visual.update(goWestFrame(69.5));
assert.deepEqual(Object.values(starUniforms).map(u=>u.value),[2.2,.25,1.8,.7]);
visual.update(goWestFrame(74.85));visual.reset();
assert.deepEqual(Object.values(starUniforms).map(u=>u.value),[2.2,.25,1.8,.7],'Leaving during a shimmer restores the normal sky');
visual.update(goWestFrame(70));
const panels=createGlassPanels(T);
assert.ok(panels.rows.flat().length>1000,'The entire globe has separate small glass pieces');
const positions=panels.geometry.attributes.position,normals=panels.geometry.attributes.normal;
for(let i=0;i<positions.count;i+=6){
  const p0=new T.Vector3().fromBufferAttribute(positions,i),n=new T.Vector3().fromBufferAttribute(normals,i);
  for(let j=1;j<6;j++){
    const offset=new T.Vector3().fromBufferAttribute(positions,i+j).sub(p0);
    assert.ok(Math.abs(offset.dot(n))<2e-7,'Each mirror is a genuinely flat plane');
  }
}
panels.geometry.dispose();
for(const lamp of visual.lamps){
  const relative=lamp.position.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().inverse());
  assert.ok(relative.z>0,'Every source is behind the observer');
  assert.ok(Math.abs(lamp.hit.distanceTo(globeGroup.position)-1.009)<1e-6,'Incoming haze ends on the glass');
}
assert.equal(visual.surface.material.blendDst,T.OneMinusSrcAlphaFactor,'Clear coating transmits the night Earth');

assert.equal(visual.glints.geometry.attributes.position.count,108);
const firstPositions=Array.from(visual.glints.geometry.attributes.position.array);
const firstDirections=visual.lamps.map(l=>l.direction.clone());
assert.ok(new Set(visual.lamps.map(l=>l.halfAngle.toFixed(4))).size>6,'The beams have different physical apertures');
visual.update(goWestFrame(80.5));
assert.ok(visual.lamps.some((l,i)=>l.direction.distanceTo(firstDirections[i])>.02),'Independent heads sweep different targets');
assert.ok(firstPositions.some((v,i)=>Math.abs(v-visual.glints.geometry.attributes.position.array[i])>.001),
  'Sweeping lights move the mirror image across actual glass panels');
visual.lamps[0].colour.setRGB(1,0,0);visual.updateLights();
assert.equal(visual.uniforms.lampColour.value[0],visual.beams[0].material.uniforms.tint.value);
assert.deepEqual(Array.from(visual.glints.geometry.attributes.tint.array.slice(0,3)),[1,0,0],
  'Surface, haze and glare share the source colour');
// Moving the observer changes the reflection; changing the globe rotates the facets.
camera.position.x=1;visual.updateLights();
const changedView=Array.from(visual.glints.geometry.attributes.position.array);
camera.position.x=0;globeGroup.rotation.y=.25;visual.updateLights();
assert.ok(changedView.some((v,i)=>Math.abs(v-visual.glints.geometry.attributes.position.array[i])>.01));
globeGroup.rotation.y=0;

// Count genuine facet returns during a moving ten-second scene. This protects
// the requested busy mirror-ball rhythm without introducing timed fake flashes.
let returns=0,previous=[];
for(let sample=0;sample<600;sample++){
  globeGroup.rotation.y=sample/60*.025;
  visual.update(goWestFrame(67+sample/60));
  const visible=Array.from(visual.glints.geometry.attributes.strength.array,value=>value>.12);
  returns+=visible.filter((value,index)=>value&&!previous[index]).length;
  previous=visible;
}
assert.ok(returns>=40,'External lamps create frequent real mirror returns');
globeGroup.rotation.y=0;

// Outgoing shafts begin on real pieces of glass and follow the reflection
// vector, including rays that do not travel into the viewer's eye.
visual.update(goWestFrame(70));
const scatter=visual.scattered.geometry.attributes;
let sideReturns=0;
for(let index=0;index<scatter.position.count;index+=6){
  if(scatter.strength.getX(index)<=.002)continue;
  const a=new T.Vector3().fromBufferAttribute(scatter.position,index);
  const b=new T.Vector3().fromBufferAttribute(scatter.position,index+1);
  const c=new T.Vector3().fromBufferAttribute(scatter.position,index+2);
  const d=new T.Vector3().fromBufferAttribute(scatter.position,index+5);
  const start=a.add(b).multiplyScalar(.5),R=c.add(d).multiplyScalar(.5).sub(start).normalize();
  const P=start.clone().addScaledVector(R,-.012),N=P.clone().normalize();
  const lamp=visual.lamps[Math.floor(index/54)];
  const L=lamp.position.clone().sub(P).normalize();
  const expected=N.multiplyScalar(2*N.dot(L)).sub(L).normalize();
  assert.ok(expected.dot(R)>.99999,'Haze follows each facet reflection, not a decorative radial line');
  assert.ok(Math.abs(P.length()-1.009)<1e-6,'Reflection starts on the glass');
  if(Math.abs(R.x)>.35)sideReturns++;
}
assert.ok(sideReturns>3,'Illuminated facets scatter light toward the sides');
const initialPowers=visual.lamps.map(l=>l.power);
visual.lamps.forEach(l=>l.power=0);visual.lamps.forEach((lamp,i)=>visual.updateScatteredLamp(lamp,i,1));
assert.ok(Array.from(scatter.strength.array).every(v=>v===0),'No external light means no outgoing scattering');
visual.lamps.forEach((l,i)=>l.power=initialPowers[i]);

visual.update(null);assert.equal(visual.surface.visible,false);assert.equal(visual.background.visible,false);assert.equal(visual.glints.visible,false);
const resources=[];visual.background.traverse(o=>{if(o.geometry)resources.push(o.geometry);if(o.material)resources.push(o.material);});
resources.push(visual.surface.geometry,visual.surface.material,visual.glints.geometry,visual.glints.material);let released=0;
resources.forEach(r=>r.addEventListener('dispose',()=>released++));visual.dispose();visual.dispose();
assert.equal(released,resources.length);assert.equal(earth.material,originalMaterial);
// Track four uses only the night texture, and restores borrowed resources.
const nightTexture=new T.Texture(),cloud=new T.Mesh(new T.SphereBufferGeometry(1.012,8,8),
  new T.MeshBasicMaterial({transparent:true,opacity:.48}));
let borrowedDisposed=0;nightTexture.addEventListener('dispose',()=>borrowedDisposed++);
originalMaterial.addEventListener('dispose',()=>borrowedDisposed++);
earth.geometry.addEventListener('dispose',()=>borrowedDisposed++);
const nightVisual=new GoWestVisual({THREE:T,scene,camera,globeGroup,renderer:{},
  getEarth:()=>earth,getNightTexture:()=>nightTexture,getCloud:()=>cloud});
nightVisual.update(null,true);
assert.equal(earth.material,nightVisual.nightMaterial,'Entry/hidden lyrics retain the all-night base');
nightVisual.update(null,false);assert.equal(earth.material,originalMaterial,'Leaving track four restores the original');
nightVisual.update(goWestFrame(12));assert.equal(earth.material,originalMaterial,'Opening remains ordinary Zen');
assert.equal(nightVisual.surface,null,'Disco geometry is not built during the quiet opening');
nightVisual.update(goWestFrame(34.02));
assert.equal(earth.material,originalMaterial,'Normal Earth remains underneath the gradual night overlay');
assert.equal(nightVisual.nightOverlay.visible,true);assert.equal(nightVisual.nightOverlay.geometry,earth.geometry);
assert.ok(Math.abs(nightVisual.nightMaterial.uniforms.nightMix.value-.5)<1e-12);
assert.ok(Math.abs(cloud.material.opacity-.24)<1e-12,'Clouds recede with the same transition');
nightVisual.update(goWestFrame(30));assert.equal(nightVisual.nightOverlay.visible,false);
assert.equal(cloud.material.opacity,.48,'Seeking back before Together restores the ordinary opening');
nightVisual.update(goWestFrame(36.02));assert.equal(earth.material,nightVisual.nightMaterial);
assert.equal(nightVisual.nightOverlay.visible,false);assert.equal(nightVisual.nightMaterial.depthWrite,true);

assert.equal(nightVisual.nightMaterial.uniforms.nightMap.value,nightTexture);
assert.equal(cloud.material.opacity,0,'Daylit cloud layer cannot mask the night glass');
nightVisual.update(goWestFrame(247.63),1);const brightPowers=nightVisual.lamps.map(l=>l.power);
nightVisual.update(goWestFrame(254),1);
assert.ok(nightVisual.lamps.every((l,i)=>l.power>=brightPowers[i]),'The finale keeps the actual external sources powered');
nightVisual.update(goWestFrame(257.6),1);
assert.equal(nightVisual.surface.visible,true);assert.equal(nightVisual.background.visible,true);
assert.equal(earth.material,nightVisual.nightMaterial,'The ending retains the night Earth under the lit glass');
assert.equal(cloud.material.opacity,0);
nightVisual.reset();assert.equal(earth.material,originalMaterial);assert.equal(cloud.material.opacity,.48);
nightVisual.update(goWestFrame(70));
const externallyChangedMaterial=new T.MeshBasicMaterial();earth.material=externallyChangedMaterial;
nightVisual.reset();assert.equal(earth.material,externallyChangedMaterial,'Moon/theme changes win over stale restoration');
nightVisual.dispose();assert.equal(borrowedDisposed,0,'Borrowed night texture and original material are not disposed');
console.log('Go West: call/response, paired Chinese, chorus anchors, clock, exclusions and missing audio PASS');
