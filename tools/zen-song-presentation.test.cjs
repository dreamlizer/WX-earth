const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function load(file,names,extra={}) {
  const source=fs.readFileSync('miniprogram/pages/gl/'+file,'utf8').replace(/^import.*$/gm,'').replace(/export async function /g,'async function ').replace(/export (class|function|const) /g,'$1 ');
  const box={module:{exports:{}},console,Map,Math,Number,Object,Array,String,JSON,setInterval:()=>1,clearInterval:()=>{},...extra};
  vm.runInNewContext(source+'\nmodule.exports={'+names.join(',')+'};',box);
  return box.module.exports;
}
let clock=0,timerId=0;const timers=new Map();
const timeout=(fn,delay)=>{const id=++timerId;timers.set(id,{fn,at:clock+delay});return id;};
const advance=ms=>{clock+=ms;for(const [id,t]of [...timers])if(t.at<=clock){timers.delete(id);t.fn();}};
const SONG_TRANSLATIONS=JSON.parse(fs.readFileSync('miniprogram/assets/data/zen-song-translations.js','utf8')
  .replace(/^\/\/.*\n/,'').replace(/^export default /,'').replace(/;\s*$/,''));
const {ZenChineseLyrics}=load('zen-chinese-lyrics.js',['ZenChineseLyrics'],{SONG_TRANSLATIONS,setTimeout:timeout,clearTimeout:id=>timers.delete(id)});
const lines=[{text:'TITLE','start-time':3000,duration:10000},{text:'ARTIST','start-time':13000,duration:5000},
  {text:'First lyric','start-time':18000,duration:3980},{text:'Second lyric','start-time':21980,duration:5020}];
// Preset 3 has no artist record: translation must use time, never array offsets.
const zh=[{text:'中文歌名','start-time':8000,duration:12000},{text:'译文一','start-time':18000,duration:3980},
  {text:'译文二','start-time':21980,duration:5020}];
let lang='zh',state={};
const p=new ZenChineseLyrics({lines,translations:zh,getLang:()=>lang,setData:patch=>Object.assign(state,patch)});
assert.deepEqual(Object.keys(p.prepare(0,true)),[],'Metadata is not a translated lyric');
const ready=p.prepare(2,true);assert.equal(ready.zenChineseA.text,'译文一');assert.equal(ready.zenChineseA.visible,false);
const shared={'poetryA.visible':true,...p.show(2,true)};
assert.equal(shared['zenChineseA.visible'],undefined,'English event stays immediate; Chinese waits');
advance(499);assert.equal(state['zenChineseA.visible'],undefined);
advance(1);assert.equal(state['zenChineseA.visible'],true);
assert.equal(state['zenChineseA.y'],14);assert.equal(state['zenChineseA.moveMs'],650);
p.prepare(3,false);p.show(3,false);advance(499);
assert.equal(state['zenChineseA.visible'],true,'Previous Chinese stays until the delayed replacement');
advance(1);
assert.equal(state['zenChineseB.visible'],true);assert.equal(state['zenChineseA.visible'],false);
assert.equal(state['zenChineseA.y'],4,'Outgoing line drifts up while fading');
assert.equal(Object.keys(p.hide(2)).length,0,'Old English end cannot hide newer Chinese');
assert.equal(p.hide(3)['zenChineseB.visible'],false);
lang='en';p.prepare(2,true);assert.equal(p.show(2,true)['zenChineseA.visible'],false);
lang='zh';p.prepare(2,true);p.show(2,true);p.stop();advance(500);
assert.equal(state['zenChineseA.visible'],false,'Stopped/mode-switched cues cannot appear late');
// Approved text must win over old cloud/cache translations without changing cues.
for(const [preset,text,expected] of [
  [102,'I know your eyes\n in the morning sun','晨光初照，是那双熟悉的眼眸'],
  [103,'Pulling you, out of darkness','牵引着你，走出幽暗']
]) {
  const cues=[{}, {}, {text,'start-time':34000,duration:6000}];
  const original=JSON.stringify(cues);
  const translated=new ZenChineseLyrics({preset,lines:cues,
    translations:[{text:'旧缓存译文','start-time':34000}],getLang:()=>lang,setData:()=>{}});
  assert.equal(translated.prepare(2,true).zenChineseA.text,expected);
  lang='en';assert.deepEqual(Object.keys(translated.prepare(2,true)),[]);
  lang='zh';assert.equal(JSON.stringify(cues),original,'Translation cannot alter English or its timing');
}
const source=fs.readFileSync('miniprogram/pages/gl/poetry-manager.js','utf8');
assert.doesNotMatch(source,/ZenLyricPresentation|audioClock|setInterval|Math\.round/,'Floating lyrics use their original animation rather than frame polling');
const wxml=fs.readFileSync('miniprogram/pages/gl/index.wxml','utf8');
assert.match(wxml,/transition: transform \{\{poetryA.moveMs\}\}ms linear/);
assert.doesNotMatch(wxml,/zen-floating-text/,'Rewritten lyrics remain removed');
assert.doesNotMatch(wxml,/zen-opening-title/,'Opening scale no longer uses native layout rounding');
const {zenOpeningPhase,ZenSongOpening}=load('zen-song-opening.js',['zenOpeningPhase','ZenSongOpening']);
assert.equal(zenOpeningPhase(3999,16800).title,0);
assert.equal(zenOpeningPhase(4000,16800).title,1);
assert.equal(zenOpeningPhase(7999,16800).artist,0);
assert.equal(zenOpeningPhase(8000,16800).artist,1);
assert.equal(zenOpeningPhase(14299,16800).title,1);
assert.equal(zenOpeningPhase(14300,16800).title,0);
assert.ok(14300+zenOpeningPhase(14300,16800).fadeMs<16800,'Opening finishes fading before original first lyric appears');
assert.equal(zenOpeningPhase(5999,32800,2000).title,0);
assert.equal(zenOpeningPhase(6000,32800,2000).title,1);
assert.equal(zenOpeningPhase(9999,32800,2000).artist,0);
assert.equal(zenOpeningPhase(10000,32800,2000).artist,1);
assert.equal(zenOpeningPhase(30299,32800,2000).title,1);
assert.equal(zenOpeningPhase(30300,32800,2000).title,0,'Out of Darkness fade starts at its unchanged time');
const openingAudio={currentTime:5};let openingState={};let patches=0;
const opening=new ZenSongOpening({getAudio:()=>openingAudio,firstLyricMs:16800,topPx:170,setData:patch=>{patches++;Object.assign(openingState,patch);}});
opening.update(true);const count=patches;opening.update(true);assert.equal(patches,count,'No per-frame setData');
opening.update(false);assert.equal(openingState.zenOpeningTitleOpacity,0,'Moon/normal mode hides opening');
opening.stop();openingState.zenOpeningEnabled=true;opening.stop();assert.equal(openingState.zenOpeningEnabled,true,'Repeated old cleanup cannot disable a new opening');
const {ZenVisualClock}=load('zen-visual-clock.js',['ZenVisualClock']);
const {makeZenEncounterPlan,ZenEncounterManager,applyZenSunlight}=load('zen-encounter-manager.js',['makeZenEncounterPlan','ZenEncounterManager','applyZenSunlight'],{AmbientEncounterManager:class {},AMBIENT_CRAFT:{},ZEN_CRAFT:{},ZenVisualClock});
// Cached/repeated activation must preserve the model's texture shader hook,
// apply the local sunlight once, and leave other materials alone.
let textureHookCalls=0;
const material={userData:{},onBeforeCompile(shader){textureHookCalls++;shader.fragmentShader+='\n// texture colour conversion';}};
const otherMaterial={userData:{}};
const model={traverse(fn){fn({material});fn({material:[material]});}};
applyZenSunlight(model);applyZenSunlight(model);
const shader={fragmentShader:'#include <lights_fragment_end>'};material.onBeforeCompile(shader);
assert.equal(textureHookCalls,1);assert.equal((shader.fragmentShader.match(/float zenSun/g)||[]).length,1);
assert.match(shader.fragmentShader,/texture colour conversion/);
assert.equal(otherMaterial.userData.zenSunlight,undefined);
for(let track=1;track<=3;track++)for(let seed=1;seed<100;seed++){
  let n=seed;const random=()=>{n=(n*16807)%2147483647;return (n-1)/2147483646};
  const plan=makeZenEncounterPlan(track,180,random);assert.equal(plan.length,4);
  assert.ok(plan[0].start<=20);
  for(let i=0;i<plan.length;i++) {assert.ok(plan[i].duration<=20);assert.ok(plan[i].start+plan[i].duration<180);
    assert.ok(plan[i].size>=.65&&plan[i].size<=1.05,'Zen craft has a readable size while remaining smaller than Earth');
    if(track===2 && (i===0||i===2))assert.equal(plan[i].key,'eve','EVE is guaranteed in the love song');
    if(i) {assert.notEqual(plan[i].key,plan[i-1].key);assert.ok(plan[i].start>plan[i-1].start+plan[i-1].duration);}}
}
const mgr=Object.create(ZenEncounterManager.prototype);Object.assign(mgr,{random:()=>.4,finish(){this.pass=null;this.visible=false},preload(){this.loadedKey=this.nextKey},clock:new ZenVisualClock(),globeGroup:{getWorldPosition(){}},camera:{position:{},fov:50,aspect:.5},center:{distanceTo(){return 5}},root:{visible:false},place(){this.positions=(this.positions||0)+1}});
const audio={currentTime:16,duration:190,paused:false};mgr.updateSong({enabled:true,audio,track:3});assert.ok(mgr.pass);
audio.paused=true;audio.currentTime=17;const before=mgr.positions;mgr.updateSong({enabled:true,audio,track:3});assert.equal(mgr.positions,before);
mgr.updateSong({enabled:false,audio,track:3});assert.equal(mgr.pass,null,'Moon/mode exclusion ends the pass');
audio.paused=false;audio.currentTime=0;mgr.updateSong({enabled:true,audio,track:3});assert.equal(mgr.pass,null,'New loop starts quietly');
const engine=fs.readFileSync('miniprogram/pages/gl/app-engine.js','utf8');
assert.doesNotMatch(engine,/new ZenEncounterManager|zenEncounter\.updateSong/,'Zen spacecraft are neither loaded nor shown');
assert.match(engine,/new AmbientEncounterManager/,'Home encounters remain enabled');
const {playPoetry}=load('zen-poetry.js',['playPoetry'],{ZenSongOpening,ZenChineseLyrics,APP_CFG:{poetry:{leadInMs:1200}}});
(async()=>{
 for(const preset of [102,103]) {
  const cue=preset===103?34000:18000;
  const english=[{text:'TITLE','start-time':3000},{text:'ARTIST','start-time':8000},{text:'First lyric','start-time':cue,duration:4000}];
  const translations=[{text:'中文歌名','start-time':8000},{text:'第一句中文','start-time':cue,duration:4000}];
  let started;
  const page={data:{lang:'zh'},__zenAudioMgr:{audio:{currentTime:0}},__poetryPresets:{[preset]:english,[preset-100]:translations},
   setData(){},__getLayoutMgr:()=>({getViewport:()=>({windowHeight:753})}),
   __getPoetryMgr:()=>({start(...args){started=args}})};
  await playPoetry(page,preset,0);
  assert.equal(page.__zenSongOpening.preset,preset);
  assert.equal(page.__zenSongOpening.firstLyricMs,cue-1200);
  assert.equal(started[1][preset][0].text,'');assert.equal(started[1][preset][1].text,'');
  assert.equal(english[0].text,'TITLE','Original cached metadata remains intact');
  assert.equal(started[1][preset][2].text,'First lyric');assert.equal(started[1][preset][2]['start-time'],cue);
  assert.equal(started[3].metadataPresented,true);
  assert.equal(started[3].subtitle.prepare(2,true).zenChineseA.text,'第一句中文','Chinese pairing is by original cue time');
 }
 console.log('Zen songs: both openings, original lyric motion, Chinese cue matching and delay, home encounters retained, zen encounters disabled PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
