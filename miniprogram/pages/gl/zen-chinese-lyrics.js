import SONG_TRANSLATIONS from '../../assets/data/zen-song-translations.js';

// Match the approved translation across the original commas and display line breaks.
const lyricKey = text => String(text || '').toLowerCase().replace(/[^a-z0-9]/g,'');
// The original PoetryManager owns every cue. This helper only animates its translation.
export class ZenChineseLyrics {
  constructor({lines, translations, getLang, setData, onStop, onEnglishShow, preset}) {
    Object.assign(this,{lines,getLang,setData,onStop,onEnglishShow});
    this.songTranslations = SONG_TRANSLATIONS[preset] || {};
    this.byTime = new Map((translations || []).filter(l => Number.isFinite(Number(l?.['start-time'])))
      .map(l => [Number(l['start-time']),String(l.text || '')]));
    this.current = null;
    this.prepared = null;
    this.pending = null;
  }
  prepare(index,useA) {
    const line = this.lines[index];
    const text = index >= 2 && this.getLang() === 'zh'
      ? this.songTranslations[lyricKey(line?.text)] || this.byTime.get(Number(line?.['start-time'])) || '' : '';
    const slot = useA ? 'zenChineseA' : 'zenChineseB';
    this.prepared = {index,slot,text};
    if (!text) return {};
    return {[slot]:{text,visible:false,y:20,moveMs:0}};
  }
  show(index,useA) {
    this.onEnglishShow?.(index);
    clearTimeout(this.pending);
    this.pending = null;
    const next = this.prepared;
    const slot = useA ? 'zenChineseA' : 'zenChineseB', other = useA ? 'zenChineseB' : 'zenChineseA';
    this.current = index;
    if (!next || next.index !== index || this.getLang() !== 'zh' || !next.text) return {
      'zenChineseA.visible':false,'zenChineseB.visible':false
    };
    // User-requested delay relative to the original English visibility event.
    this.pending = setTimeout(() => {
      this.pending = null;
      if (this.current !== index || this.getLang() !== 'zh') return;
      this.setData({[slot+'.visible']:true,[slot+'.y']:14,[slot+'.moveMs']:650,
        [other+'.visible']:false,[other+'.y']:4,[other+'.moveMs']:650});
    },500);
    return {};
  }
  hide(index) {
    if (this.current !== index) return {};
    clearTimeout(this.pending);
    this.pending = null;
    return {'zenChineseA.visible':false,'zenChineseB.visible':false,
      'zenChineseA.y':4,'zenChineseB.y':4,'zenChineseA.moveMs':650,'zenChineseB.moveMs':650};
  }
  stop() {
    clearTimeout(this.pending);
    this.pending = null;
    this.current = this.prepared = null;
    this.setData({'zenChineseA.visible':false,'zenChineseB.visible':false});
    this.onStop?.();
  }
}
