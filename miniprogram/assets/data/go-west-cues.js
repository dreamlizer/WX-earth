import { GO_WEST_LINES } from './go-west-text.js';

export const GO_WEST_TIMING = {
  source: 'source-lyrics/go_west_psb_1993.lrc',
  alignmentSource: 'source-lyrics/go-west-jianying-20261023.srt',
  status: 'srt-phrase-anchors-with-labelled-voice-estimates', sourceOffsetMs: 0,
  // Scene / audio clocks retain their approved original timings.
  responseDelayMs: 500, previewBeatMs: 495, durationSec: 259,
  firstLyricSec: GO_WEST_LINES.find(line=>line.call==='Together').start,
  discoLeadSec: 4, beatOriginSec: 36.02
};

// Timing anchors from source-lyrics/go-west-jianying-20261023.srt only.
// Words remain in the original user-supplied LRC and bilingual data.
// Tuple: original start, SRT row, sung call, sung reply (null = estimate), sung end, provenance.
const recognition = [
  [36.02, 2, 35.3, null, 38.866, "merged-cadence-estimate"],
  [39.47, 3, 39.333, null, 42.866, "merged-cadence-estimate"],
  [43.45, 4, 43.166, null, 47.333, "merged-cadence-estimate"],
  [47.65, 5, 47.333, null, 51.3, "merged-cadence-estimate"],
  [51.44, 6, 51.3, null, 54.933, "merged-cadence-estimate"],
  [55.42, 7, 55.133, null, 58.733, "merged-cadence-estimate"],
  [59.37, 8, 59.1, null, 62.766, "merged-cadence-estimate"],
  [63.39, 9, 63.166, null, 66.6, "merged-cadence-estimate"],
  [67.27, 10, 66.733, null, 70.666, "merged-cadence-estimate"],
  [70.87, 11, 70.666, null, 74.6, "merged-cadence-estimate"],
  [74.75, 12, 74.7, null, 78.7, "merged-cadence-estimate"],
  [78.79, 13, 78.733, null, 82.533, "merged-cadence-estimate"],
  [87.49, 14, 86.76599999999999, 89.3, 95.666, "srt-split; tail Go West retains source estimate 93.29"],
  [99.59, 16, 98.9, null, 102.7, "merged-cadence-estimate"],
  [103.12, 17, 102.733, null, 106.7, "merged-cadence-estimate"],
  [107.23, 18, 106.8, null, 110.533, "merged-cadence-estimate"],
  [111.04, 19, 110.76599999999999, null, 114.366, "merged-cadence-estimate"],
  [115.25, 20, 114.7, null, 118.333, "merged-cadence-estimate"],
  [119.11, 21, 118.6, null, 122.2, "merged-cadence-estimate"],
  [123.01, 22, 122.566, null, 126.266, "merged-cadence-estimate"],
  [126.8, 23, 126.666, null, 131.2, "merged-cadence-estimate"],
  [130.72, 24, 130.72, 131.6, 134.133, "previous SRT row merges lead as farewell; retain source lead, response anchor provisional"],
  [134.42, 25, 134.2, null, 138.166, "merged-cadence-estimate"],
  [138.35, 26, 138.166, null, 142.066, "merged-cadence-estimate"],
  [142.3, 27, 142.133, null, 145.9, "merged-cadence-estimate"],
  [146.47, 28, 146.2, null, 149.86599999999999, "merged-cadence-estimate"],
  [150.33, 29, 150.1, null, 153.966, "merged-cadence-estimate"],
  [154.28, 30, 154.0, null, 158.066, "merged-cadence-estimate"],
  [158.18, 31, 158.066, null, 161.7, "merged-cadence-estimate"],
  [163.55, 32, 163.333, null, 166.1, "merged-cadence-estimate"],
  [166.52, 33, 166.1, null, 169.86599999999999, "merged-cadence-estimate"],
  [171.5, 34, 171.2, null, 174.966, "merged-cadence-estimate"],
  [174.31, 35, 174.31, null, 177.766, "first We will find merges into previous row; retain source start"],
  [178.83, 36, 178.333, null, 182.733, "merged-cadence-estimate"],
  [182.5, 37, 182.5, null, 185.86599999999999, "To live crosses SRT rows 36-37; retain source lead estimate"],
  [186.33, 38, 186.3, 187.566, 190.14, "srt-split; phrase end estimated within merged row 39"],
  [190.14, 39, 190.14, 191.3, 193.68, "merged rows 39-40; source lead and estimated response/end"],
  [194.2, 40, 193.68, 194.69, 197.69, "merged rows 40-41; word-span estimate"],
  [197.99, 41, 197.69, 198.68, 202.133, "merged row 41; word-span estimate"],
  [202.01, 42, 202.133, null, 205.5, "merged-cadence-estimate"],
  [205.92, 43, 206.0, null, 209.6, "merged-cadence-estimate"],
  [210.14, 44, 210.133, null, 211.6, "merged-cadence-estimate"],
  [211.78, 45, 211.6, 213.5, 215.4, "srt-split"],
  [215.26, 47, 215.666, null, 219.53300000000002, "merged-cadence-estimate"],
  [219.38, 48, 219.666, null, 223.53300000000002, "merged-cadence-estimate"],
  [223.23, 49, 223.566, null, 227.466, "merged-cadence-estimate"],
  [228.74, 50, 229.36599999999999, null, 231.2, "merged-cadence-estimate"],
  [231.4, 51, 231.266, 233.366, 235.166, "srt-split"],
  [235.03, 53, 235.2, 237.4, 239.2, "srt-split; response end estimated before trailing Go West in row 54"],
  [239.2, 54, 239.2, 241.3, 243.21, "destiny omitted by ASR; retain original words and source lead, cadence-estimated response"],
  [244.07, 56, 243.466, 245.166, 247.1, "srt-split"],
];
const recognized = new Map(recognition.map(row=>[row[0],row]));
const roundTime = value => Math.round(value*1000)/1000;
const driftStarts = [228.74];
const tableauStarts = [87.49];
const choirStarts = [231.4,235.03,239.2,244.07];
export const GO_WEST_CUES = GO_WEST_LINES.map((line,index) => {
  const sourceEnd=Math.min(line.start+(line.section==='refrain'?8:3.65),
    GO_WEST_LINES[index+1]?.start ?? line.start+3.65);
  const anchor=recognized.get(line.start);
  const hasCall=!!line.call,hasResponse=!!line.response;
  const callKind=/^Go West$/i.test(line.call)?'west':/^Together$/i.test(line.call)?'together':'other';
  const sungCallAt=anchor?.[2] ?? line.start;
  const sungEnd=anchor?.[4] ?? sourceEnd;
  // The SRT has only phrase-level timing for most pairs. Use the cadence of
  // separately recognized voices for those estimates, not invented word stamps.
  const gap=callKind==='west'?Math.min(1.9,(sungEnd-sungCallAt)*.46):
    callKind==='together'?Math.min(1.266,(sungEnd-sungCallAt)*.34):
    Math.min(1.35,(sungEnd-sungCallAt)*.35);
  const sungResponseAt=hasCall&&hasResponse?(anchor?.[3] ?? sungCallAt+(anchor?gap:.5)):sungCallAt;
  const style=tableauStarts.includes(line.start)?'tableau':driftStarts.includes(line.start)?'drift':
    choirStarts.includes(line.start)?'choir':line.start===166.52?'promise':'impact';
  // Individual entrance headroom; a slower reply gets more than a short call.
  // The first Together retains extra headroom for the phone view bridge.
  const callLead=index===1?.5:style==='tableau'?.45:.25;
  const replyLead=style==='tableau'?.65:style==='choir'?.55:.65;
  const callAt=roundTime(sungCallAt-(hasCall?callLead:replyLead));
  const responseAt=roundTime(sungResponseAt-(hasResponse?replyLead:callLead));
  return {
    id:'gw-'+String(index+1).padStart(2,'0'),start:line.start,sourceEnd,section:line.section,style,
    hidden:[251.34,255.37].includes(line.start),
    adlib:/^(?:(?:come on|go|o+h+|a+h+|yeah)[\s,()]*)+$/i.test(line.call),
    hasCall,hasResponse,callKind,callAt,responseAt,
    sungCallAt:roundTime(sungCallAt),sungResponseAt:roundTime(sungResponseAt),sungEnd,
    // Keep both voices until the response ends, then hold .22s and fade .30s.
    fadeStart:roundTime(sungEnd+.22),end:roundTime(sungEnd+.52),
    responseDelayMs:Math.round((sungResponseAt-sungCallAt)*1000),
    srtRow:anchor?.[1] ?? null,timingMethod:anchor?.[5] ?? 'original-source-fallback',
    tailAt:line.start===87.49?93.29:null
  };
});

// Keep the newly aligned voice entrances. Restore each original inter-phrase
// blank by moving only the preceding pair's exit, with no crossfade overlap.
const visiblePairs=GO_WEST_CUES.filter(c=>!c.adlib && !c.hidden && c.start<GO_WEST_TIMING.durationSec);
visiblePairs.forEach((cue,index)=>{
  const next=visiblePairs[index+1];
  if(!next || cue.style==='tableau')return;
  cue.sourceGapSec=roundTime(Math.max(0,next.start-cue.sourceEnd));
  cue.end=roundTime(Math.min(next.callAt,next.responseAt)-cue.sourceGapSec);
  cue.fadeStart=roundTime(cue.end-.30);
});

// This approved transition retains both rows instead of fading immediately
// after its response; its shared exit is before the following verse entrance.
GO_WEST_CUES.find(c=>c.start===87.49).end=roundTime(
  GO_WEST_CUES.find(c=>c.start===99.59).callAt-.8);

// Small listening corrections affect entrances only, after the approved exits
// have been calculated so later subtitles and existing exits do not move.
for(const [start,role,delay] of [[36.02,'callAt',.15],[39.47,'callAt',.1],[87.49,'responseAt',.2]]){
  const cue=GO_WEST_CUES.find(c=>c.start===start);
  cue[role]=roundTime(cue[role]+delay);
}

// Same approved A / B / A forms, with lyric-only entrances and group exits.
const section = (id,mode,starts,lead,small=false) => {
  const cues=GO_WEST_CUES.filter(c=>starts.includes(c.start));
  return {id,mode,start:cues[0].callAt,end:cues[cues.length-1].end,lead,small,
    firstSource:starts[0],lastSource:starts[starts.length-1]};
};
export const GO_WEST_CHORUS_SECTIONS = [
  section('a1','stars',[67.27,70.87,74.75,78.79],.9),
  section('b','bands',[130.72,134.42,138.35,142.3,146.47,150.33,154.28,158.18],.9),
  section('a2','stars',[211.78,215.26,219.38,223.23],.9),
  section('reprise','stars',[231.4,235.03,239.2,244.07],0,true)
];
export function goWestChorusSection(time,callLeadSec=0){
  const section=GO_WEST_CHORUS_SECTIONS.find(s=>time>=s.start-s.lead-callLeadSec && time<s.end);
  return section?(callLeadSec?{...section,start:section.start-callLeadSec}:section):null;
}
