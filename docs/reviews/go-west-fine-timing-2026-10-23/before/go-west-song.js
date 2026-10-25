import { GO_WEST_CUES, GO_WEST_TIMING, goWestChorusSection } from '../../assets/data/go-west-cues.js';
import { GO_WEST_CALLS, GO_WEST_TEXT } from '../../assets/data/go-west-text.js';
import { ZenVisualClock } from './zen-visual-clock.js';
import { ZenSongOpening } from './zen-song-opening.js';
import { goWestFinaleFrame, GO_WEST_LYRIC_CUTOFF } from './go-west-finale-timing.js';

const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { x = clamp(x); return x*x*(3-2*x); };
const chorusWindows = GO_WEST_CUES.filter(cue => ['chorus','refrain','reverse','outro'].includes(cue.section))
  .map(cue => [cue.start,cue.sourceEnd ?? cue.end]);
// Numbered lyrics 09, 11, 23, 25, 44, 46: three pairs, six sky accents.
export const GO_WEST_STAR_CUES=[67.27,74.75,130.72,138.35,211.78,219.38];
export function goWestStarShimmer(time){
  return Math.max(0,...GO_WEST_STAR_CUES.map(at=>{
    const age=time-at;
    if(age<0 || age>=2.05)return 0;
    const envelope=ease(age/.085)*(1-ease((age-1.4)/.65));
    // Three gentle peaks in one accent; a lit floor avoids a hard on/off strobe.
    const flicker=.32+.68*Math.pow(.5+.5*Math.cos(2*Math.PI*(age-.1)/.65),2);
    return envelope*flicker;
  }));
}

export function goWestFrame(time) {
  const chorus = Math.max(0, ...chorusWindows.map(([a,b]) =>
    ease((time-a+1.2)/1.2) * (1-ease((time-b)/1.4))));
  const entrance = ease((time-GO_WEST_TIMING.firstLyricSec+GO_WEST_TIMING.discoLeadSec)/GO_WEST_TIMING.discoLeadSec);
  const finale=goWestFinaleFrame(time);
  // Keep the real mirror-ball rig lit through the final impact and audio end.
  // Song/mode exit still restores its original night/day materials as before.
  const outro=0,gain=entrance*(finale?.lampGain || 1);
  // A smooth pulse with a steady brightness floor; no black/white strobe.
  const beat = Math.pow(.5+.5*Math.cos((time-GO_WEST_TIMING.beatOriginSec)*
    Math.PI*2/(GO_WEST_TIMING.previewBeatMs/1000)), 3);
  return {time,chorus,beat,outro,finale,starShimmer:Math.max(goWestStarShimmer(time),(finale?.shock || 0)*.65),
    nightMix:entrance,gain,light:(.38+.42*chorus+.12*beat)*entrance};
}

const LYRIC_GROWTH=1.22;
// Entrance headroom is per voice in the aligned cues; no second global shift.
export const GO_WEST_LYRIC_LEAD_SEC=0;
const estimateTextWidth=(value,size)=>Array.from(value).reduce((sum,c)=>sum+size*(
    /[\u2e80-\uffff]/.test(c)?1.05:/[MW@mw]/.test(c)?.95:/[ilI.,'! ]/.test(c)?.34:/[A-Z]/.test(c)?.76:.63),0);
// Reserve room for both the continuous approach and the impact overshoot.
export function goWestTextFit(text,maxFont,width,measure,reserveScale=LYRIC_GROWTH*1.08){
  const spacing=.15;
  const measured=measure?.(text,maxFont) || estimateTextWidth(text,maxFont);
  const available=Math.max(1,width-14)/reserveScale;
  const font=Math.min(maxFont,maxFont*Math.max(1,available-spacing*text.length)/Math.max(1,measured));
  return Math.floor(font*100)/100;
}
function textMeasure(){
  try {
    const ctx=typeof wx!=='undefined' && wx.createOffscreenCanvas?.({type:'2d',width:1,height:1}).getContext('2d');
    if(ctx){const cache=new Map();return (text,size,mode='normal')=>{
      const key=mode+':'+size+':'+text;if(cache.has(key))return cache.get(key);
      ctx.font=mode==='tableau'?`italic 400 ${size}px Georgia, serif`:`600 ${size}px Arial, sans-serif`;const width=ctx.measureText(text).width;
      cache.set(key,width);return width;
    };}
  }catch(_){}
  return null;
}
function voiceMotion(at,end,time){
  const elapsed=Math.max(0,Math.round((time-at)*1000));
  const duration=Math.max(80,Math.round((end-at)*1000));
  const fade=Math.min(300,Math.round(duration*.24));
  return {
    enter:`animation-delay: -${elapsed}ms;`,
    grow:`animation-duration: ${duration}ms; animation-delay: -${elapsed}ms;`,
    fade:`animation-duration: ${fade}ms; animation-delay: ${Math.round((end-time)*1000)-fade-16}ms;`
  };
}
// Preserve complete source lines, but paginate a long sung phrase rather than
// shrinking it below a readable size. These are successive cues, never wraps.
function voicePage(value,maxFont,minFont,width,measure,at,end,time,reserveScale,forcedParts){
  const join=items=>items.join(value.includes(' ')?' ':'');
  const pages=[];
  for(const part of forcedParts || [value]){
    const words=value.includes(' ')?part.split(/\s+/):Array.from(part);
    let pending=[];
    for(const word of words){
      if(pending.length && goWestTextFit(join([...pending,word]),maxFont,width,measure,reserveScale)<minFont){
        pages.push(join(pending));pending=[];
      }
      pending.push(word);
    }
    if(pending.length)pages.push(join(pending));
  }
  if(!pages.length)pages.push('');
  const duration=(end-at)/pages.length;
  const index=Math.min(pages.length-1,Math.max(0,Math.floor((time-at)/duration)));
  const text=pages[index],start=at+index*duration,stop=start+duration;
  return {text,index,at:start,visible:!!text&&time>=at,size:Math.max(minFont,goWestTextFit(text,maxFont,width,measure,reserveScale)),
    motion:voiceMotion(start,stop,time)};
}
// Numbered Together groups 05–08 only. The first four and later verses retain
// their original entrances; original cue/text data and layout remain intact.
function combinedVoices(callPage,responsePage,time,chinese){
  const factor=chinese?.78:1,echoMs=1350*factor;
  const age=(time-callPage.at)*1000;
  return {combined:true,
    callEchoStyle:`animation-delay: -${Math.max(0,Math.round(age))}ms;`,
    callEchoLayers:[1,2,3].map(layer=>({layer,
      style:`animation-name: go-west-echo-${chinese?'zh-':''}${layer}; animation-duration: ${echoMs}ms; animation-delay: -${Math.max(0,Math.round(age))}ms;`})),
    responseLetters:smallWaveLetters(responsePage,time,chinese)};
}
// Reuse the approved small per-character entrance for the three transition
// lines, without adding the Together lead's echo layers to that passage.
function smallWaveLetters(page,time,chinese){
  const waveMs=780*(chinese?.78:1),replyAge=(time-page.at)*1000;
  const letters=Array.from(page.text);
  return letters.map((char,index)=>({index,text:char===' '?'\u00a0':char,
      style:`animation-name: go-west-small-wave-${chinese?'zh-':''}${index%2?'positive':'negative'}; animation-duration: ${waveMs*.6}ms; animation-delay: ${Math.round((letters.length>1?index/(letters.length-1)*waveMs*.4:0)-replyAge)}ms;`}));
}
// Numbers 13–14 accumulate, then clear 0.8 seconds before the next verse.
function transitionLyricState(time,text,layout){
  const first=GO_WEST_CUES.find(c=>c.start===87.49),last=GO_WEST_CUES.find(c=>c.start===99.59);
  const end=Math.round((last.callAt-.8)*1000)/1000;
  if(time<first.callAt || time>=end)return null;
  const width=layout.width || 375,measure=layout.measure&&((s,n)=>layout.measure(s,n,'tableau'));
  const refrain=text[first.id] || {};
  const rows=[
    {at:first.callAt,replyAt:first.responseAt,call:refrain.call,response:(refrain.response || '').replace(/, Go West$/i,''),
      zhCall:refrain.zhCall,zhResponse:(refrain.zhResponse || '').replace(/（去西部）$/,'')},
    {at:first.tailAt-.25,replyAt:first.tailAt-.25,call:'Go West',response:'',zhCall:'去西部',zhResponse:''}
  ];
  const groups=[],chinese=[];
  const fade=voiceMotion(first.callAt,end,time).fade;
  rows.forEach((row,i)=>{
    if(time<row.at)return;
    const make=zh=>{
      const upper=String(row[zh?'zhCall':'call'] || ''),lower=String(row[zh?'zhResponse':'response'] || '');
      const region=width*(zh ? .76 : .9),replyAt=row.replyAt;
      const a=voicePage(zh?upper:upper.toUpperCase(),zh?14.5:[24,26][i],zh?14:18,
        region,measure,row.at,end,time,1);
      const b=voicePage(lower,zh?14.5:21.5,zh?14:16,region,measure,replyAt,end,time,1);
      return {row:i,callAt:row.at,responseAt:replyAt,end,bottomOffset:[68,0][i],style:'tableau',slot:'transition',maxScale:1,callMaxScale:1,pairFadeStyle:fade,
        sequential:true,callLetters:smallWaveLetters(a,time,zh),responseLetters:smallWaveLetters(b,time,zh),
        call:a.text,response:b.text,callVisible:a.visible,responseVisible:b.visible,
        callEnterStyle:a.motion.enter,callGrowStyle:a.motion.grow,callFadeStyle:fade,
        responseEnterStyle:b.motion.enter,responseGrowStyle:b.motion.grow,responseFadeStyle:fade,
        callSize:a.size,responseSize:b.size,
        revealWidth:Math.min(region,(measure?.(b.text,b.size)||estimateTextWidth(b.text,b.size))+.15*b.text.length+24),
        phase:[a.index,b.index,a.visible,b.visible].join(':')};
    };
    groups.push(make(false));chinese.push(make(true));
  });
  const epoch=groups.map((g,i)=>g.phase+':'+chinese[i].phase).join('|');
  groups.forEach((g,i)=>{g.id=chinese[i].id='transition:'+i+':'+epoch;});
  return {groups,chinese,key:'transition:'+epoch+':'+width};
}
export function goWestLyricState(time,text=GO_WEST_TEXT,preview=false,layout={}) {
  if(time>=Math.min(GO_WEST_TIMING.durationSec,GO_WEST_LYRIC_CUTOFF))return {groups:[],chinese:[],key:'gap'};
  const transition=transitionLyricState(time,text,layout);
  if(transition)return transition;
  const active=GO_WEST_CUES.filter(c=>!c.adlib && !c.hidden &&
    time>=Math.min(c.callAt,c.responseAt) && time<c.end);
  if(!active.length)return {groups:[],chinese:[],key:'gap'};
  const pairs=active.map(cue=>goWestPairState(cue,time,text,layout));
  const groups=pairs.flatMap(pair=>pair.groups),chinese=pairs.flatMap(pair=>pair.chinese);
  // Ordinary pairs have separate exit/entry windows; only the intentional
  // transition tableau retains multiple lines. Resume both languages together.
  const key=pairs.map(pair=>pair.key).join('|');
  groups.forEach((g,i)=>{g.id=chinese[i].id=g.id+':'+key;});
  return {groups,chinese,key};
}
function goWestPairState(cue,time,text,layout){
  const copy={...(text[cue.id] || {})};
  let start=cue.callAt,end=Math.min(cue.end,GO_WEST_TIMING.durationSec,GO_WEST_LYRIC_CUTOFF),id=cue.id;
  // The long refrain ends in its own important chant. Give it a full-size cue
  // instead of appending it to the response. A merged SRT retains its explicitly
  // labelled source-tail estimate until separate voice timing is available.
  if(cue.section==='refrain' && /, Go West$/i.test(copy.response || '')){
    const tailAt=cue.tailAt ?? cue.end-2.2;
    if(time>=tailAt){
      start=tailAt;id+='-tail';copy.call='Go West';copy.response='';
      copy.zhCall='去西部';copy.zhResponse='';
    }else{
      end=tailAt;copy.response=copy.response.replace(/, Go West$/i,'');
      copy.zhResponse=copy.zhResponse.replace(/（去西部）$/,'');
    }
  }
  // Original source is retained separately; display voices omit backing echoes.
  const single=s=>String(s || '').replace(/\(Aah[^)]*\)/gi,'').replace(/\s+/g,' ').trim();
  const call=single(copy.call ?? GO_WEST_CALLS[cue.callKind]).toUpperCase();
  const response=single(copy.response),zhCall=single(copy.zhCall),zhResponse=single(copy.zhResponse);
  const fixed=['chorus','refrain','reverse','outro'].includes(cue.section);
  const chorus=fixed && call==='GO WEST';
  const sky=chorus?goWestChorusSection(time):null;
  const slot=fixed?'chorus':['left','right','center'][Number(cue.id.slice(3))%3];
  const width=layout.width || 375,measure=layout.measure;
  const drift=cue.style==='drift',choir=cue.style==='choir';
  const combined=cue.callKind==='together'&&[51.44,55.42,59.37,63.39].includes(cue.start);
  const maxScale=drift||choir?1:sky?(sky.mode==='stars'?1.10:1.12):LYRIC_GROWTH*1.08;
  const callMaxScale=sky?1:maxScale;
  const pairFadeStyle=voiceMotion(start,end,time).fade;
  const make=(upper,lower,chinese)=>{
    const region=width*(chinese ? .76 : .90),responseAt=id===cue.id?cue.responseAt:start;
    const pickup=!chinese && cue.start===210.14 ? upper.match(/^(.*?)\s+(DO)\s+(IS)$/) : null;
    const callAt=id===cue.id?cue.callAt:start;
    const a=voicePage(upper,chinese?(drift||choir?14:15.5):choir?20:drift?23:chorus?40:33,
      chinese?14:drift||choir?18:20,region,measure,callAt,end,time,callMaxScale,pickup?.slice(1));
    const b=voicePage(lower,chinese?(choir?19:drift?14.5:15.5):choir?29:23,
      chinese?(choir?17:14):choir?22:16,region,measure,responseAt,end,time,maxScale);
    // Remount on the reply entrance as well, so negative delays are applied
    // once to a fresh animation rather than advancing an existing one twice.
    return {id:[id,a.index,b.index,a.visible,b.visible].join(':'),slot,chorus,callAt,responseAt,end,
      style:combined?'combined':choir?'choir':sky?sky.mode:cue.style,chorusLook:sky?.mode || '',skyCall:!!sky && !chinese,
      maxScale,callMaxScale,intro:cue.section==='intro',pairFadeStyle,
      call:a.text,response:b.text,callVisible:a.visible,responseVisible:b.visible,
      callEnterStyle:a.motion.enter,callGrowStyle:a.motion.grow,callFadeStyle:pairFadeStyle,
      responseEnterStyle:b.motion.enter,responseGrowStyle:b.motion.grow,responseFadeStyle:pairFadeStyle,
      callSize:a.size,responseSize:b.size,
      revealWidth:Math.min(region,(measure?.(b.text,b.size) || estimateTextWidth(b.text,b.size))+.15*b.text.length+24),
      ...(combined?combinedVoices(a,b,time,chinese):{})};
  };
  const group=make(call,response,false),chinese=make(zhCall,zhResponse,true);
  // Either language can have a different entrance or page boundary. Both
  // wrappers resume together from the same absolute pair clock on any change.
  const pairKey=group.id+'|'+chinese.id;
  group.id=chinese.id=pairKey;
  return {groups:[group],chinese:[chinese],key:[group.id,chinese.id,group.callVisible,
    group.responseVisible,chinese.callVisible,chinese.responseVisible,width].join(':')};
}

// A silent, explicit rehearsal clock while track four has no audio source.
// It creates no wx audio context and never falls back to another song.
export class GoWestPreviewClock {
  constructor(now = Date.now()) { this.origin=now; this.position=0; this.paused=false; }
  get currentTime() {
    return (this.position + (this.paused ? 0 : (Date.now()-this.origin)/1000)) % GO_WEST_TIMING.durationSec;
  }
  get duration() { return GO_WEST_TIMING.durationSec; }
  pause() { this.position=this.currentTime; this.paused=true; }
  play() { if (this.paused) { this.origin=Date.now(); this.paused=false; } }
  seek(time) { this.position=Math.max(0,Number(time)||0); this.origin=Date.now(); }
}

export class GoWestSong {
  constructor({page, text = GO_WEST_TEXT}) {
    this.page=page; this.text=text; this.clock=new ZenVisualClock(); this.stopped=false;
    this.preview=!page.__zenAudioMgr?.audio;
    this.previewAudio=this.preview ? new GoWestPreviewClock() : null;
    const vp=page.__getLayoutMgr().getViewport();
    this.measure=textMeasure();
    this.opening=new ZenSongOpening({preset:104,getAudio:()=>this.getAudio(),
      firstLyricMs:GO_WEST_TIMING.firstLyricSec*1000,topPx:Math.round(vp.windowHeight*.23),
      setData:patch=>page.setData(patch)});
    page.__zenSongOpening=this.opening;
    page.setData({goWestActive:true,goWestPreview:this.preview,goWestGroups:[],goWestChinese:[]});
  }
  getAudio() { return this.previewAudio || this.page?.__zenAudioMgr?.audio; }
  update(enabled, now = Date.now()) {
    if (this.stopped) return null;
    const time=this.clock.read(this.getAudio(),now);
    // Lyric nodes need precise cue gates, not the heavily smoothed scene clock.
    // Never retain a sub-second visual-clock lag behind a fresh native sample.
    const lyricTime=Math.max(time,Number(this.getAudio()?.currentTime || 0))+GO_WEST_LYRIC_LEAD_SEC;
    this.opening.lyricTime=lyricTime;
    const hidden=!enabled || this.suspended;
    const state=hidden ? {groups:[],chinese:[],key:'hidden'}
      : goWestLyricState(lyricTime,this.text,this.preview,{
        width:this.page.__getLayoutMgr().getViewport().windowWidth || 375,measure:this.measure});
    const lang=this.page.data.lang;
    if(state.groups.some(group=>group.combined || group.sequential)){
      const elapsed=this.lastLyricNow===undefined?0:Math.max(0,(now-this.lastLyricNow)/1000);
      if(this.lastLyricTime!==undefined&&Math.abs(lyricTime-this.lastLyricTime-elapsed)>.4)this.motionEpoch=(this.motionEpoch||0)+1;
      const suffix=':motion-'+(this.motionEpoch||0);
      for(const group of [...state.groups,...state.chinese])group.id+=suffix;
      state.key+=suffix;
    }
    this.lastLyricTime=lyricTime;this.lastLyricNow=now;
    const key=state.key+':'+lang;
    if (key!==this.key) {
      this.key=key;
      this.page.setData({goWestGroups:state.groups,goWestChinese:lang==='zh'?state.chinese:[]});
    }
    this.lightingFrame=goWestFrame(time);
    this.frame=hidden ? null : {...this.lightingFrame,lyricTime};
    return this.frame;
  }
  pause() {
    this.suspended=true; this.previewAudio?.pause(); this.update(false);
  }
  resume() { this.suspended=false; this.previewAudio?.play(); this.clock.reset(); }
  stop() {
    if (this.stopped) return;
    this.stopped=true; this.frame=this.lightingFrame=null;
    this.previewAudio?.pause(); this.opening.stop();
    this.page.setData({goWestActive:false,goWestPreview:false,goWestGroups:[],goWestChinese:[]});
    this.page=null;
  }
}
