// Audio currentTime can arrive in coarse samples. Integrate render-frame time
// between samples; small drift corrections never cause a visible speed jump.
export class ZenVisualClock {
  read(audio, now = Date.now()) {
    const sample = Number(audio?.currentTime || 0);
    if (this.audio !== audio || this.lastNow == null || Math.abs(sample - this.time) > 1) {
      this.audio = audio; this.time = sample;
    } else if (audio && !audio.paused && sample > 0) {
      const dt = Math.max(0, (now - this.lastNow) / 1000);
      this.time += dt;
      if (sample !== this.lastSample) {
        const correction = Math.max(-dt * .04, Math.min(dt * .04, sample - this.time));
        this.time += correction;
      }
    }
    if (!audio || sample === 0) this.time = sample;
    this.lastNow = now; this.lastSample = sample;
    return this.time;
  }
  reset() { this.audio = null; this.lastNow = null; }
}
