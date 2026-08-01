const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createTimerRuntime() {
  let nextId = 1;
  const timers = new Map();
  const add = (kind, fn) => {
    const id = nextId++;
    timers.set(id, { kind, fn });
    return id;
  };
  return {
    setTimeout: (fn) => add('timeout', fn),
    clearTimeout: (id) => timers.delete(id),
    setInterval: (fn) => add('interval', fn),
    clearInterval: (id) => timers.delete(id),
    count(kind) {
      return [...timers.values()].filter((timer) => timer.kind === kind).length;
    },
    flushTimeouts() {
      for (const [id, timer] of [...timers]) {
        if (timer.kind !== 'timeout') continue;
        timers.delete(id);
        timer.fn();
      }
    }
  };
}

function loadZenAudio() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'zen-audio.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace('export class ZenAudio', 'class ZenAudio');
  source = source.replace(/export function /g, 'function ');
  source = source.replace(/export const /g, 'const ');
  source += '\nmodule.exports = { ZenAudio };';

  const timers = createTimerRuntime();
  const contexts = [];
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Set,
    Number,
    Math,
    ...timers,
    wx: {
      createInnerAudioContext() {
        const ctx = {
          stopCount: 0,
          destroyCount: 0,
          playCount: 0,
          volume: 1,
          currentTime: 0,
          stop() { this.stopCount += 1; },
          destroy() { this.destroyCount += 1; },
          play() { this.playCount += 1; },
          onPlay(cb) { this.playListener = cb; },
          onEnded(cb) { this.endedListener = cb; },
          onError(cb) { this.errorListener = cb; }
        };
        contexts.push(ctx);
        return ctx;
      },
      removeStorageSync() {}
    }
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return { ZenAudio: sandbox.module.exports.ZenAudio, timers, contexts };
}

function loadZenModeManager() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'zen-mode-manager.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^import[\s\S]*?;\s*$/gm, '');
  source = source.replace(/^export \*.*$/gm, '');
  source = source.replace('export class ZenModeManager', 'class ZenModeManager');
  source += '\nmodule.exports = { ZenModeManager };';

  const timers = createTimerRuntime();
  const poetryCalls = [];
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Set,
    Number,
    Math,
    ...timers,
    setZenMode() {},
    zenState: {},
    ZenAudio: { resolveAudioPresetForLang: (preset) => preset },
    ZenUI: { updateSensors() {}, closeList() {} },
    ZenPoetry: {
      stopPoetry() {},
      stopSpecial() {},
      resolvePresetForLang: (preset) => preset,
      playPoetry(...args) { poetryCalls.push(args); }
    }
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return { ZenModeManager: sandbox.module.exports.ZenModeManager, timers, poetryCalls };
}

function testDelayedAudioIsCancelledOnStop() {
  const runtime = loadZenAudio();
  const audio = new runtime.ZenAudio({ fileIds: { 1: 'cloud://one' }, appCfg: {} });

  audio.startWithDelayFadeIn(1, '', 1000, 1000);
  assert.equal(runtime.timers.count('timeout'), 1);
  audio.stop();
  runtime.timers.flushTimeouts();

  assert.equal(runtime.contexts.length, 0, 'stopped delayed audio must not create a context later');
  assert.equal(runtime.timers.count('timeout'), 0);
}

function testAudioDisposeReleasesContextAndListeners() {
  const runtime = loadZenAudio();
  const audio = new runtime.ZenAudio({ fileIds: { 1: 'cloud://one' }, appCfg: {} });
  let endedCalls = 0;
  const onEnded = () => { endedCalls += 1; };
  const unsubscribe = audio.onEnded(onEnded);
  audio.onEnded(onEnded);
  audio.start(1);
  runtime.contexts[0].endedListener();

  assert.equal(endedCalls, 1, 'the same listener must not be registered twice');
  unsubscribe();
  audio.dispose();
  audio.start(1);

  assert.equal(runtime.contexts[0].stopCount, 1);
  assert.equal(runtime.contexts[0].destroyCount, 1);
  assert.equal(runtime.contexts.length, 1, 'disposed audio manager must not restart');
}

function testAudioPlayEventIdentifiesTheStartedPreset() {
  const runtime = loadZenAudio();
  const audio = new runtime.ZenAudio({ fileIds: { 2: 'cloud://two' }, appCfg: {} });
  let playEvent = null;
  audio.onPlay((event) => { playEvent = event; });
  audio.start(2);
  runtime.contexts[0].currentTime = 0.75;
  runtime.contexts[0].playListener();

  assert.equal(playEvent.preset, 2);
  assert.equal(playEvent.currentTime, 0.75);
}

function testModeManagerRegistersOnceAndUnsubscribes() {
  const runtime = loadZenModeManager();
  let endedRegistrations = 0;
  let playRegistrations = 0;
  let unsubscribeCalls = 0;
  let playListener = null;
  let stopCalls = 0;
  const audio = {
    onEnded() {
      endedRegistrations += 1;
      return () => { unsubscribeCalls += 1; };
    },
    onPlay(cb) {
      playRegistrations += 1;
      playListener = cb;
      return () => { unsubscribeCalls += 1; };
    },
    stop() { stopCalls += 1; },
    getCurrentTime() { return 0; }
  };
  const page = {
    data: {},
    __zenAudioMgr: audio,
    __getZenMgr: () => audio,
    __getPoetryMgr: () => ({ forceAlignToAudioPosition() {} })
  };
  const manager = new runtime.ZenModeManager(page);

  manager._ensureAudioListeners();
  manager._ensureAudioListeners();
  manager.dispose();

  assert.equal(endedRegistrations, 1);
  assert.equal(playRegistrations, 1);
  assert.equal(unsubscribeCalls, 2);
  assert.equal(runtime.timers.count('timeout'), 0, 'dispose must cancel pending timers');
  assert.equal(stopCalls, 1);
}

async function testLyricsWaitForActualAudioPlayback() {
  const runtime = loadZenModeManager();
  let playListener = null;
  let startedPreset = null;
  const alignments = [];
  const audio = {
    onEnded() { return () => {}; },
    onPlay(cb) { playListener = cb; return () => {}; },
    fadeOutStop() {},
    startWithDelayFadeIn(preset) { startedPreset = preset; },
    getCurrentTime() { return 0.75; }
  };
  const page = {
    data: { zenMode: true, lang: 'zh' },
    setData(updates) { Object.assign(this.data, updates); },
    _getLocalAudio() { return ''; },
    __getZenMgr: () => audio,
    __getPoetryMgr: () => ({
      resetImmediate() {},
      forceAlignToAudioPosition(posMs) { alignments.push(posMs); }
    })
  };
  const manager = new runtime.ZenModeManager(page);

  manager.switchToPreset(2);
  assert.equal(startedPreset, 2);
  assert.equal(runtime.poetryCalls.length, 0, 'lyrics must not start during audio delay or buffering');

  playListener({ preset: 2, currentTime: 0.75 });
  await Promise.resolve();
  assert.equal(runtime.poetryCalls.length, 1, 'lyrics start when the selected audio actually plays');
  assert.equal(runtime.poetryCalls[0][1], 2);
  assert.deepEqual(alignments, [750], 'initial alignment must use the real audio clock');
  assert.equal(runtime.timers.count('timeout'), 1, 'one follow-up clock correction is scheduled');
}

async function testAudioResumeRealignsWithoutRestartingLyrics() {
  const runtime = loadZenModeManager();
  let playListener = null;
  const alignments = [];
  const audio = {
    onEnded() { return () => {}; },
    onPlay(cb) { playListener = cb; return () => {}; },
    getCurrentTime() { return 4.25; }
  };
  const page = {
    data: { zenMode: true },
    __getZenMgr: () => audio,
    __getPoetryMgr: () => ({
      forceAlignToAudioPosition(posMs) { alignments.push(posMs); }
    })
  };
  const manager = new runtime.ZenModeManager(page);

  manager._ensureAudioListeners();
  playListener({ preset: 1, currentTime: 4 });
  await Promise.resolve();

  assert.equal(runtime.poetryCalls.length, 0, 'resuming audio must not restart the lyric sequence');
  assert.deepEqual(alignments, [4250], 'resuming audio realigns the existing lyric timeline');
}

function testTrackNameToastIsAnchoredToButtonLeft() {
  const cssFile = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'index.wxss');
  const css = fs.readFileSync(cssFile, 'utf8');
  const block = css.match(/\.cut-btn-toast\s*\{([\s\S]*?)\}/)?.[1] || '';
  assert.match(block, /right:\s*calc\(100%\s*\+/);
  assert.match(block, /top:\s*50%/);
  assert.match(block, /text-align:\s*right/);
  assert.doesNotMatch(block, /bottom:/);
}

(async () => {
  testDelayedAudioIsCancelledOnStop();
  testAudioDisposeReleasesContextAndListeners();
  testAudioPlayEventIdentifiesTheStartedPreset();
  testModeManagerRegistersOnceAndUnsubscribes();
  await testLyricsWaitForActualAudioPlayback();
  await testAudioResumeRealignsWithoutRestartingLyrics();
  testTrackNameToastIsAnchoredToButtonLeft();
  console.log('zen lifecycle tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
