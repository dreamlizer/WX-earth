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
assert.equal(goWestLyricState(89).groups[0].response.endsWith('Go West'),false);
assert.equal(goWestLyricState(94).groups[0].call,'GO WEST','Refrain tail gets an independent full-size chant');
assert.equal(goWestLyricState(94).chinese[0].call,'去西部');
assert.equal(data.GO_WEST_TIMING.firstLyricSec,36.02);
assert.equal(goWestLyricState(35.51).groups.length,0);
for(const at of [35.52,35.91,35.92,36.01]){
 const s=goWestLyricState(at);
 assert.equal(s.groups[0].call,'TOGETHER');assert.equal(s.groups[0].callVisible,true);
 assert.equal(s.chinese[0].callVisible,true);
 assert.equal(s.groups[0].responseVisible,false);assert.equal(s.chinese[0].responseVisible,false);
}
assert.equal(goWestLyricState(36.51).groups[0].responseVisible,false);
assert.equal(goWestLyricState(36.52).groups[0].responseVisible,true,'The first reply keeps its original time');
for(const cue of data.GO_WEST_CUES.slice(2))assert.equal(cue.callAt,cue.start,'Other calls retain their original time');
assert.equal(goWestLyricState(36.6).groups[0].response,'We will go our way');
assert.equal(goWestLyricState(36.6).chinese[0].response,'走出属于我们的路');
// Only the last four Together pairs before the first Go West use the approved
// echo lead and original small-wave reply. Later Together verses stay intact.
const combinedStarts=[51.44,55.42,59.37,63.39];
for(const cue of data.GO_WEST_CUES.filter(c=>c.callKind==='together')){
 const s=goWestLyricState(cue.start+.1),selected=combinedStarts.includes(cue.start);
 for(const g of [...s.groups,...s.chinese]){
  assert.equal(!!g.combined,selected,'Only numbered Together 05–08 change');
  if(!selected)continue;
  assert.equal(g.style,'combined');assert.equal(g.responseVisible,false);
  assert.equal(g.callEchoLayers.length,3,'The lead keeps three distinct echo layers');
  assert.ok(g.callEchoLayers.every(layer=>layer.style.includes('animation-delay: -100ms')));
  assert.equal(g.responseLetters.map(letter=>letter.text).join('').replace(/\u00a0/g,' '),g.response,'Per-character response preserves spaces and complete lyrics');
 }
 const before=goWestLyricState(cue.responseAt-.001),after=goWestLyricState(cue.responseAt+.1);
 for(const g of [...before.groups,...before.chinese])assert.equal(g.responseVisible,false);
 for(const g of [...after.groups,...after.chinese]){
  assert.equal(g.responseVisible,true);
  if(selected){
   assert.equal(g.responseLetters[0].style.match(/animation-delay: (-?\d+)ms/)[1],'-100');
   assert.ok(g.responseLetters.at(-1).style.includes('animation-delay: '+(after.groups.includes(g)?212:143)+'ms'),'Letters retain the original small-wave stagger');
  }
 }
}
assert.equal(goWestLyricState(211.9).groups[0].call,'GO WEST','Cross-line parenthesis is repaired');
assert.equal(data.GO_WEST_TIMING.durationSec,259);
assert.equal(GO_WEST_LYRIC_CUTOFF,247.1);
assert.equal(goWestLyricState(246.9).groups[0].end,247.1,'The active bilingual choir fades and ends before the first foil');
assert.ok(goWestLyricState(246.9).groups.length>0);
assert.ok(text.GO_WEST_LINES.some(line=>line.start===247.63),'Number 53 source remains intact');
for(const at of [247.1,247.63,248.1,250,251.5,255.5,258.9]){
 assert.equal(goWestLyricState(at).groups.length,0,'All voices clear one second before confetti');
 assert.equal(goWestLyricState(at).chinese.length,0);
}
assert.ok(text.GO_WEST_LINES.some(line=>line.start===255.37),'Hidden source words are retained');
for(const t of [259,261.95,270.1,283.6]){
  assert.equal(goWestLyricState(t).groups.length,0,'No English lyrics after the shortened ending');
  assert.equal(goWestLyricState(t).chinese.length,0,'No Chinese lyrics after the shortened ending');
}
for(const [at,expected] of [[142.9,'This is our destiny'],
  [171.6,'Now if we make a stand'],[174.4,"We'll find our promised land"]]){
  const cue=data.GO_WEST_CUES.find(c=>at>=c.start&&at<c.end);
  assert.equal(text.GO_WEST_TEXT[cue.id].response,expected);
  const pages=[];
  for(let t=cue.start+.01;t<cue.end;t+=.05){
    const phrase=goWestLyricState(t).groups[0].response;
    assert.ok(!/[()]/.test(phrase),'Displayed bridge lyrics contain no backing echoes');
    if(pages.at(-1)!==phrase)pages.push(phrase);
  }
  assert.equal(pages.join(' '),expected,'Cleaned main words survive any single-line pagination');
}
for(let i=0;i<data.GO_WEST_CUES.length;i++){
  const cue=data.GO_WEST_CUES[i];
  assert.ok(cue.end>cue.start,'No invalid/negative cue window');
  if(i)assert.ok(cue.start>data.GO_WEST_CUES[i-1].start);
}
const copy={'gw-02':{call:'CALL',response:'ANSWER',zhCall:'上句',zhResponse:'下句'}};
let state=goWestLyricState(36.04,copy);
assert.equal(state.groups[0].callVisible,true);
assert.equal(state.groups[0].responseVisible,false);
assert.equal(state.chinese[0].call,'上句');assert.equal(state.chinese[0].response,'下句');
state=goWestLyricState(36.6,copy);
assert.equal(state.groups[0].responseVisible,true);
assert.equal(goWestLyricState(67.4,copy).groups[0].slot,'chorus');
assert.equal(goWestLyricState(131,copy).groups[0].slot,'chorus');
for(const [time,look] of [[67.9,'stars'],[131.5,'bands'],[212.5,'stars'],[232.6,'stars']]){
 const s=goWestLyricState(time);
 assert.equal(s.groups[0].chorusLook,look);assert.equal(s.groups[0].skyCall,true);
 assert.equal(s.chinese[0].skyCall,false,'Chinese lead remains visible below Earth');
}

assert.equal(goWestLyricState(164,copy).groups[0].callVisible,false,'Bridge is a continuous phrase');
assert.equal(goWestLyricState(228.9).groups[0].callVisible,false,'Response-only source cue has no invented call');
assert.equal(goWestLyricState(228.9).groups[0].responseVisible,true);
assert.equal(goWestLyricState(0,copy).groups.length,0);
assert.equal(goWestLyricState(35,{}).groups.length,0,'Intro chants do not appear');
for(const t of [33.8,243.3,259.5,273,276.6,280.3,284]){
  const hidden=goWestLyricState(t);assert.equal(hidden.groups.length,0);assert.equal(hidden.chinese.length,0);
}
assert.equal(goWestFrame(32.02).gain,0);assert.ok(Math.abs(goWestFrame(34.02).nightMix-.5)<1e-12);
assert.equal(goWestFrame(36.02).nightMix,1);
assert.ok(goWestFrame(259).gain>1,'The finale keeps the ball lit at audio end');
for(let t=0;t<304;t+=.05){
  const frame=goWestFrame(t);
  assert.ok(frame.gain>=0&&frame.gain<=3);assert.ok(frame.light>=0&&frame.light<=1);
}
assert.ok(goWestFrame(70).chorus>.99);assert.ok(goWestFrame(165).chorus<.01);
assert.deepEqual(Array.from(GO_WEST_STAR_CUES),[67.27,74.75,130.72,138.35,211.78,219.38]);
for(const removed of [70.87,134.42,215.26])assert.equal(goWestStarShimmer(removed+.1),0);
let starBursts=0,previousShimmer=0;
for(let t=0;t<304;t+=.01){
  const shimmer=goWestStarShimmer(t);
  assert.ok(shimmer>=0&&shimmer<=1);
  if(shimmer>0&&previousShimmer===0)starBursts++;
  previousShimmer=shimmer;
}
assert.equal(starBursts,6,'Only three pairs of isolated star accents occur in the complete song');
for(const at of GO_WEST_STAR_CUES){
 for(const peak of [.1,.75,1.4])assert.ok(goWestStarShimmer(at+peak)>.99,'Three perceptible peaks per accent');
 assert.ok(goWestStarShimmer(at+.425)<.35,'Each accent visibly flickers between its peaks');
 assert.ok(goWestStarShimmer(at+1.8)>0,'An accent lasts one second longer');
 assert.equal(goWestStarShimmer(at+2.06),0);
}
const page={data:{lang:'zh'},__zenAudioMgr:{audio:{currentTime:36.04,paused:false}},
  __getLayoutMgr:()=>({getViewport:()=>({windowHeight:800})}),
  setData(patch){this.patches=(this.patches||0)+1;Object.assign(this.data,patch);}};
const song=new GoWestSong({page,text:copy});song.update(true,0);
assert.equal(page.data.goWestChinese[0].call,'上句');
const patches=page.patches;song.update(true,1);assert.equal(page.patches,patches,'No per-frame setData');
page.data.lang='en';song.update(true,2);assert.equal(page.data.goWestChinese.length,0);
song.update(false,3);assert.equal(page.data.goWestGroups.length,0,'Moon/normal exclusion clears both voices');
song.stop();assert.equal(page.data.goWestActive,false);song.stop();
// Runtime presentation advances both languages and GPU lyric time together,
// while the audio clock, lighting and finale remain at their original times.
for(const audioTime of [34.30,34.33,35.4,66.2,86.4,230.4,245.91]){
 const livePage={data:{lang:'zh'},__zenAudioMgr:{audio:{currentTime:audioTime,paused:false}},
  __getLayoutMgr:()=>({getViewport:()=>({windowWidth:390,windowHeight:800})}),
  setData(patch){Object.assign(this.data,patch);}};
 const liveSong=new GoWestSong({page:livePage}),frame=liveSong.update(true,0);
 const expected=goWestLyricState(audioTime+1.2,text.GO_WEST_TEXT,false,{width:390,measure:liveSong.measure});
 assert.equal(JSON.stringify(livePage.data.goWestGroups),JSON.stringify(expected.groups));
 assert.equal(JSON.stringify(livePage.data.goWestChinese),JSON.stringify(expected.chinese));
 assert.equal(frame.lyricTime,audioTime+1.2,'GPU chorus shares the bilingual lyric offset');
 assert.equal(liveSong.opening.lyricTime,frame.lyricTime,'GPU Chinese uses the same advanced time');
 assert.equal(JSON.stringify(liveSong.lightingFrame),JSON.stringify(goWestFrame(audioTime)),
  'Lighting, beat and confetti are not advanced with the lyrics');
 assert.equal(frame.time,audioTime);assert.equal(livePage.__zenAudioMgr.audio.currentTime,audioTime);
 liveSong.stop();
}
assert.match(fs.readFileSync('miniprogram/pages/gl/app-engine.js','utf8'),
 /goWestChorus\.update\(goWestFrame\?\.lyricTime \?\? null\)/,'GPU chorus receives the advanced lyric time');
const comboPage={data:{lang:'zh'},__zenAudioMgr:{audio:{currentTime:51.54-1.2,paused:false}},
 __getLayoutMgr:()=>({getViewport:()=>({windowWidth:390,windowHeight:800})}),
 setData(patch){this.patches=(this.patches||0)+1;Object.assign(this.data,patch);}};
const comboSong=new GoWestSong({page:comboPage});comboSong.update(true,1000);
const comboPatches=comboPage.patches,comboId=comboPage.data.goWestGroups[0].id;
comboSong.update(true,1016);assert.equal(comboPage.patches,comboPatches,'Echo and wave animate without per-frame setData');
comboPage.__zenAudioMgr.audio.currentTime=53-1.2;comboSong.clock.reset();comboSong.update(true,1032);
assert.notEqual(comboPage.data.goWestGroups[0].id,comboId,'Seeking inside the same pair remounts its absolute-time entrance');
assert.ok(comboPage.data.goWestGroups[0].callEchoLayers.every(layer=>layer.style.includes('animation-delay: -1560ms')));
comboSong.pause();assert.equal(comboPage.data.goWestGroups.length,0);assert.equal(comboPage.data.goWestChinese.length,0);
comboSong.resume();comboSong.update(true,1048);assert.equal(comboPage.data.goWestGroups[0].combined,true);
comboSong.stop();assert.equal(comboPage.data.goWestGroups.length,0);
let now=1000;const fakeDate={now:()=>now};
const preview=load('miniprogram/pages/gl/go-west-song.js',['GoWestPreviewClock'],
  {...data,...text,ZenVisualClock,ZenSongOpening,goWestFinaleFrame,Date:fakeDate});
const clock=new preview.GoWestPreviewClock();now+=2000;assert.equal(clock.currentTime,2);
clock.pause();now+=9000;assert.equal(clock.currentTime,2);clock.play();now+=1000;assert.equal(clock.currentTime,3);
clock.seek(70);assert.equal(clock.currentTime,70);
// Single-line fitting reserves the largest animated size, including impact.
for(const width of [320,375,430])for(const cue of data.GO_WEST_CUES)for(let at=cue.start+.01;at<cue.end;at+=.17){
  const lyric=goWestLyricState(at,text.GO_WEST_TEXT,false,{width,measure:(text,size)=>text.length*size});
  const earlyCall=data.GO_WEST_CUES.some(c=>!c.adlib && c.callAt<c.start && at>=c.callAt && at<c.start);
  if((cue.adlib && !earlyCall) || cue.hidden || at>=GO_WEST_LYRIC_CUTOFF){assert.equal(lyric.groups.length,0);continue;}
  assert.equal(lyric.groups[0].pairFadeStyle,lyric.chinese[0].pairFadeStyle,'Both languages share the same exit clock');
  assert.equal(lyric.groups[0].id,lyric.chinese[0].id,'Any voice boundary resumes the complete pair together');
  for(const group of [...lyric.groups,...lyric.chinese])for(const role of ['call','response']){
    assert.equal(group[role+'FadeStyle'],group.pairFadeStyle,'Upper and lower voices disappear together');
    const english=lyric.groups.includes(group),special=group.style!=='impact';
    const minimum=english?(role==='call'?(special?18:20):group.style==='choir'?22:16):14;
    assert.ok(group[role+'Size'] >= minimum,'Readable minimum type size');
    assert.ok(!/[\r\n]/.test(group[role]));
    const region=english?width*.90:width*.76;
    assert.ok((group[role].length*group[role+'Size']+.15*group[role].length)*(role==='call'?group.callMaxScale:group.maxScale)<=region,
      'Every supplied voice fits its region at the maximum animated scale');
  }
}
for(const at of [228.8]){
  const s=goWestLyricState(at);
  for(const g of [...s.groups,...s.chinese]){
    assert.equal(g.style,'drift');assert.equal(g.maxScale,1,'Quiet transitions never zoom');
  }
}
for(const [at,count] of [[87.49,1],[93.28,1],[93.29,2],[97,2],[98.78,2]]){
 const s=goWestLyricState(at);
 assert.equal(s.groups.length,count);assert.equal(s.chinese.length,count);
 assert.equal(new Set(s.groups.map(g=>g.row)).size,count,'Transition rows occupy different positions');
 for(let i=0;i<count;i++){
  const g=s.groups[i],zh=s.chinese[i];
  assert.equal(g.style,'tableau');assert.equal(g.maxScale,1);assert.equal(g.callMaxScale,1);
  assert.equal(g.pairFadeStyle,s.groups[0].pairFadeStyle,'All three rows leave on one end clock');
  assert.equal(g.pairFadeStyle,zh.pairFadeStyle);assert.equal(g.id,zh.id);
 }
}
for(const at of [98.79,99,99.58]){
 const s=goWestLyricState(at);
 assert.equal(s.groups.length,0,'Both transition rows clear 0.8 seconds before number 15');
 assert.equal(s.chinese.length,0,'Chinese clears on the same earlier boundary');
}
for(const width of [320,375,390,430])for(const at of [166.52,167.51,167.52,169.9]){
 const s=goWestLyricState(at,undefined,false,{width});
 const en=s.groups[0],zh=s.chinese[0];
 assert.equal(en.call,"WE'LL BE");assert.equal(en.response,'what we want to be');
 assert.equal(en.style,'promise','The prefix has an independent non-explosive entrance');
 assert.equal(zh.call,'我们会');assert.equal(zh.response,'活成我们想要的人');
 for(const row of [en,zh]){
  assert.equal(row.responseAt,167.52);assert.equal(row.responseVisible,at>=167.52);
  assert.equal(row.callFadeStyle,row.responseFadeStyle,'The split voices still fade as one pair');
 }
 assert.ok(en.callSize>=20&&en.responseSize>=16,'Both halves stay readable');
}
for(const [at,reply] of [[99.59,false],[100.08,false],[100.09,true],[102.99,true]]){
 const s=goWestLyricState(at);
 assert.equal(s.groups.length,1,'The transition clears when number 15 starts');
 assert.equal(s.chinese.length,1);
 for(const g of [...s.groups,...s.chinese]){
  assert.equal(g.style,'impact');assert.ok(g.maxScale>1.3);
  assert.equal(g.responseVisible,reply,'Number 15 retains its original half-second voice gap');
 }
 assert.equal(s.groups[0].call,'TOGETHER');assert.equal(s.groups[0].callSize,33);
}
assert.equal(goWestLyricState(99.59).groups[0].style,goWestLyricState(103.12).groups[0].style,
 'Numbers 15 and 16 use the same normal presentation');
for(const width of [320,375,390,430]){
 const pages=[];
 for(let time=210.141;time<211.78;time+=.01){
  const phrase=goWestLyricState(time,undefined,false,{width}).groups[0].call;
  if(pages.at(-1)!==phrase)pages.push(phrase);
 }
 assert.deepEqual(pages.slice(-2),['DO','IS'],'DO and IS remain separate at every viewport width');
 assert.equal(pages.join(' '),"WHAT WE'RE GONNA DO IS",'Forced word breaks preserve the whole pickup');
}
for(const at of [231.5,235.1,239.3,244.2]){
  const s=goWestLyricState(at);
  assert.equal(s.groups[0].call,'GO WEST','Sung order and lead wording are preserved');
  for(const g of [...s.groups,...s.chinese]){
    assert.equal(g.style,'choir');assert.ok(g.responseSize>g.callSize,'The responding choir leads in both languages');
    assert.equal(g.maxScale,1,'Large choir does not keep expanding beyond the single line');
  }
}
for(const start of [231.4,235.03,239.2,244.07]){
  const cue=data.GO_WEST_CUES.find(c=>c.start===start);
  assert.ok(Math.abs(cue.responseAt-start-1)<1e-10);
  for(const offset of [.5,.99,1,1.1]){
    const s=goWestLyricState(start+offset);
    for(const group of [...s.groups,...s.chinese]){
      assert.equal(group.callVisible,true);
      assert.equal(group.responseVisible,offset>=1,'Only numbers 49–52 wait one second in both languages');
    }
  }
}
for(const cue of data.GO_WEST_CUES.filter(c=>!['choir','promise'].includes(c.style)))assert.equal(cue.responseDelayMs,500);
const measure=(text,size)=>text.length*size;
const fit=goWestTextFit('A'.repeat(60),35,250,measure);
assert.ok((measure('A'.repeat(60),fit)+.15*60)*1.22*1.08<250,
  'Maximum growth and impact still fit on a narrow phone');
const entry=goWestLyricState(67.4),late=goWestLyricState(68.1);
assert.notEqual(entry.groups[0].callEnterStyle,late.groups[0].callEnterStyle,'Seeking resumes the current animation phase');
assert.match(entry.groups[0].callFadeStyle,/animation-delay:/,'Fade begins before the cue is removed');
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
