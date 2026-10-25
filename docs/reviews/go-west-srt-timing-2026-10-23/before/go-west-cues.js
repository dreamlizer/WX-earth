import { GO_WEST_LINES } from './go-west-text.js';

// Exact whole-line timestamps from the user-supplied LRC. Vocal sub-cues remain
// provisional: this file does not provide word-level or separate voice timing.
export const GO_WEST_TIMING = {
  source: 'source-lyrics/go_west_psb_1993.lrc',
  status: 'user-lrc-line-times', sourceOffsetMs: 0,
  // User-confirmed shortened MP3: preserve cue starts and end the display at 4:19.
  responseDelayMs: 500, previewBeatMs: 495, durationSec: 259,
  firstLyricSec: GO_WEST_LINES.find(line=>line.call==='Together').start,
  discoLeadSec: 4, beatOriginSec: 36.02
};

// 13–14 accumulate into one transition tableau; 15 starts the normal verse.
// 49–52 give the responding choir the visual lead.
const driftStarts = [228.74];
const tableauStarts = [87.49];
const choirStarts = [231.4,235.03,239.2,244.07];
export const GO_WEST_CUES = GO_WEST_LINES.map((line,index) => {
  const responseDelayMs=choirStarts.includes(line.start)||line.start===166.52?1000:GO_WEST_TIMING.responseDelayMs;
  return {
  id: 'gw-' + String(index+1).padStart(2,'0'), start:line.start, section:line.section,
  style:tableauStarts.includes(line.start)?'tableau':driftStarts.includes(line.start)?'drift':choirStarts.includes(line.start)?'choir':line.start===166.52?'promise':'impact',
  hidden:[251.34,255.37].includes(line.start), // Numbered lyrics 54/55: retained, temporarily silent.
  adlib:/^(?:(?:come on|go|o+h+|a+h+|yeah)[\s,()]*)+$/i.test(line.call),
  hasCall:!!line.call, hasResponse:!!line.response,
  callKind: /^Go West$/i.test(line.call) ? 'west' : /^Together$/i.test(line.call) ? 'together' : 'other',
  end:Math.min(line.start + (line.section==='refrain' ? 8 : 3.65),
    GO_WEST_LINES[index+1]?.start ?? line.start+3.65),
  callAt:index===1?Math.round((line.start-.5)*100)/100:line.start,
  responseDelayMs,
  responseAt:line.start + (line.call && line.response ? responseDelayMs/1000 : 0)
};});

// Numbered chorus blocks: A / B / A, then the small reversed-vocal reprise.
export const GO_WEST_CHORUS_SECTIONS = [
  {id:'a1',mode:'stars',start:67.27,end:82.44,lead:.9,small:false},
  {id:'b',mode:'bands',start:130.72,end:161.83,lead:.9,small:false},
  {id:'a2',mode:'stars',start:211.78,end:226.88,lead:.9,small:false},
  {id:'reprise',mode:'stars',start:231.4,end:251.28,lead:0,small:true}
];
export function goWestChorusSection(time){
  return GO_WEST_CHORUS_SECTIONS.find(s=>time>=s.start-s.lead && time<s.end) || null;
}
