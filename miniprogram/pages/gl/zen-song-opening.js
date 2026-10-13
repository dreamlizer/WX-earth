// Independent opening art; the original lyric timeline and motion remain its owner.
export function zenOpeningPhase(timeMs, firstLyricMs, entranceDelayMs=0) {
  const fadeAt = Math.max(8000, firstLyricMs - 2500);
  if (timeMs >= fadeAt) return {phase:'out',title:0,star:0,artist:0,fadeMs:2200};
  if (timeMs >= 8000+entranceDelayMs) return {phase:'artist',title:1,star:1,artist:1,fadeMs:1800};
  if (timeMs >= 4000+entranceDelayMs) return {phase:'title',title:1,star:1,artist:0,fadeMs:1800};
  return {phase:'quiet',title:0,star:0,artist:0,fadeMs:0};
}
export class ZenSongOpening {
  constructor({setData,getAudio,firstLyricMs,topPx,preset=102}) {
    Object.assign(this,{setData,getAudio,firstLyricMs,topPx,preset});
    this.stopped=false;this.phase=null;
    this.setData({zenOpeningEnabled:true,zenOpeningTopPx:topPx,
      zenOpeningTitleOpacity:0,zenOpeningStarOpacity:0,zenOpeningArtistOpacity:0,zenOpeningFadeMs:0});
  }
  update(enabled) {
    if (this.stopped) return;
    const audio=this.getAudio();
    const s=enabled && audio ? zenOpeningPhase(Number(audio.currentTime||0)*1000,this.firstLyricMs,this.preset===103?2000:0)
      : {phase:'off',title:0,star:0,artist:0,fadeMs:0};
    if (s.phase===this.phase) return;
    this.phase=s.phase;
    this.setData({zenOpeningTitleOpacity:s.title,zenOpeningStarOpacity:s.star,
      zenOpeningArtistOpacity:s.artist,zenOpeningFadeMs:s.fadeMs});
  }
  stop() {
    if (this.stopped) return;
    this.stopped=true;
    this.setData({zenOpeningEnabled:false,zenOpeningTitleOpacity:0,zenOpeningStarOpacity:0,
      zenOpeningArtistOpacity:0,zenOpeningFadeMs:0});
  }
}
