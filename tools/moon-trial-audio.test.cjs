const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function load(file, name, globals = {}) {
  const source = fs.readFileSync('miniprogram/pages/gl/'+file, 'utf8').replace(/^import.*;$/gm, '').replace(/export (class|const|function) /g, '$1 ');
  const box = { module: {}, console, setTimeout, clearTimeout, setInterval, clearInterval, ...globals };
  vm.runInNewContext(source+`\nmodule.exports = ${name};`, box);
  return box.module.exports;
}
function context() {
  const handlers = {};
  return { handlers, currentTime: 0, paused: false, plays: 0, pauses: 0, destroyed: 0,
    onPlay(f) { handlers.play=f; }, onError(f) { handlers.error=f; }, onEnded(f) { handlers.ended=f; },
    play() { this.plays++; this.paused=false; handlers.play?.(); },
    pause() { this.pauses++; this.paused=true; }, stop() {}, destroy() { this.destroyed++; }
  };
}
(async () => {
  const downloads=[], contexts=[];
  const wx = { cloud: { downloadFile(request) { downloads.push(request); } },
    getFileSystemManager() { return { accessSync() {} }; },
    createInnerAudioContext() { const c=context(); contexts.push(c); return c; } };
  const Audio = load('moon-trial.js', 'MoonTrialAudio', { wx, APP_CFG: { audio: { zenVolume: 0.8 } } });
  let errors=0, ended=0;
  const a = new Audio(() => errors++, () => ended++);
  const waiting=a.start();
  a.dispose();
  downloads[0].success({ tempFilePath: '/late.mp3' });
  await assert.rejects(waiting, /取消/);
  assert.equal(contexts.length,0,'late download cannot start cancelled audio');
  const b = new Audio(() => errors++, () => ended++);
  const playing=b.start();
  downloads[1].success({ tempFilePath: '/song.mp3' });
  await playing;
  contexts[0].currentTime=42;
  assert.equal(b.getTime(),42);
  b.fadeOut(0.5);
  assert.equal(contexts[0].volume,0.4);
  contexts[0].handlers.error();
  assert.equal(errors,1);
  b.dispose();
  contexts[0].handlers.error();contexts[0].handlers.ended();
  assert.equal(errors,1);assert.equal(ended,0);
  assert.equal(contexts[0].destroyed,1);
  const c = new Audio(() => {}, () => ended++);
  await c.start();
  assert.equal(downloads.length,2,'valid session cache prevents repeat downloads');
  contexts[1].handlers.ended();assert.equal(ended,1);c.dispose();

  const ZenAudio=load('zen-audio.js','ZenAudio',{wx});
  const zen = new ZenAudio({ fileIds: {1:'cloud://zen'}, appCfg:{} });
  zen.start(1);
  const original=zen.ctx;original.currentTime=19;
  zen.suspend();assert.equal(original.paused,true);
  zen.resume();assert.equal(zen.ctx,original);assert.equal(original.currentTime,19);
  assert.equal(original.plays,2,'resume reuses the paused context and position');
  zen.suspend();zen.start(1);
  assert.equal(zen.ctx.plays,0,'delayed zen start during the voyage must stay silent');
  zen.resume();assert.equal(zen.ctx.plays,1);
  zen.ctx.pause();const plays=zen.ctx.plays;zen.suspend();zen.resume();
  assert.equal(zen.ctx.plays,plays,'a previously paused track must remain paused');
  zen.dispose();zen.resume();
  console.log('moon trial audio tests passed: cancellation, cache, clock, error, zen suspension');
})().catch(e=>{console.error(e);process.exitCode=1;});
