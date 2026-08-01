const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createTimerRuntime() {
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout(fn) {
      const id = nextId++;
      timers.set(id, { kind: 'timeout', fn });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    setInterval(fn) {
      const id = nextId++;
      timers.set(id, { kind: 'interval', fn });
      return id;
    },
    clearInterval(id) {
      timers.delete(id);
    },
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

function loadMoonManager() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'moon-voyage-manager.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^import[\s\S]*?;\s*$/gm, '');
  source = source.replace('export class MoonVoyageManager', 'class MoonVoyageManager');
  source += '\nmodule.exports = { MoonVoyageManager };';

  const timers = createTimerRuntime();
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Set,
    Object,
    Array,
    Number,
    Math,
    ...timers,
    MoonOrbitSequence: class {},
    CompanionRobotEffect: class {},
    ZodiacSystem: class {},
    detectEnvironment: () => ({}),
    getSystemInfo: () => ({}),
    findEarthMesh: () => null,
    stopMoonLyrics(mgr) {
      mgr._lyricToken += 1;
      mgr._lyricTimers = [];
    },
    wx: { hideLoading() {} }
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return { MoonVoyageManager: sandbox.module.exports.MoonVoyageManager, timers };
}

function loadMoonLifecycle(preloadAssets) {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'moon-voyage-lifecycle.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^import[\s\S]*?;\s*$/gm, '');
  source = source.replace(/export const /g, 'const ');
  source += '\nmodule.exports = { enterVoyage };';

  let playAudioCalls = 0;
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Promise,
    Date,
    Math,
    Number,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    APP_CFG: {},
    preloadAssets,
    prepareUiForLaunch() {},
    pauseZenPoetryAndUi() {},
    stopZenAudio() {},
    stopMoonLyrics() {},
    findEarthMesh() { return null; },
    rebuildMilkyWay() {},
    rebuildStarDust() {},
    refreshMainStarfieldMesh() {},
    updateTimeline() {},
    playAudio() { playAudioCalls += 1; },
    wx: {
      showLoading() {},
      hideLoading() {},
      showToast() {}
    }
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return {
    enterVoyage: sandbox.module.exports.enterVoyage,
    playAudioCalls: () => playAudioCalls
  };
}

function loadMoonAudio() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'moon-voyage-audio.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^import[\s\S]*?;\s*$/gm, '');
  source = source.replace(/export const /g, 'const ');
  source += '\nmodule.exports = { playAudio };';

  let lyricStarts = 0;
  const contexts = [];
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Date,
    Math,
    Number,
    APP_CFG: {},
    startMoonLyrics() { lyricStarts += 1; },
    wx: {
      createInnerAudioContext() {
        const ctx = {
          currentTime: 0,
          destroy() {},
          onPlay(cb) { this.playListener = cb; },
          onError(cb) { this.errorListener = cb; },
          onEnded(cb) { this.endedListener = cb; }
        };
        contexts.push(ctx);
        return ctx;
      }
    }
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return {
    playAudio: sandbox.module.exports.playAudio,
    contexts,
    lyricStarts: () => lyricStarts
  };
}

function disposable(extra = {}) {
  return {
    disposeCount: 0,
    dispose() {
      this.disposeCount += 1;
    },
    ...extra
  };
}

function testDisposeCancelsWorkAndReleasesOwnedResources() {
  const runtime = loadMoonManager();
  const manager = new runtime.MoonVoyageManager();
  let delayedMutation = 0;
  let pendingCancelCalls = 0;
  const geometry = disposable();
  const texture = disposable({ isTexture: true });
  const material = disposable({ map: texture });
  const mesh = {
    geometry,
    material,
    parent: { removeCalls: 0, remove() { this.removeCalls += 1; } }
  };
  const audio = {
    stopCalls: 0,
    destroyCalls: 0,
    stop() { this.stopCalls += 1; },
    destroy() { this.destroyCalls += 1; }
  };
  const companion = { disposeCalls: 0, dispose() { this.disposeCalls += 1; } };
  const orbit = { disposeCalls: 0, dispose() { this.disposeCalls += 1; } };
  const zodiac = { disposeCalls: 0, dispose() { this.disposeCalls += 1; } };
  const page = {};

  manager.page = page;
  page.__moonVoyageMgr = manager;
  page.debugSpeedUp = () => {};
  manager.moonMesh = mesh;
  manager.audioContext = audio;
  manager._companionFx = companion;
  manager._orbitSeq = orbit;
  manager._zodiacSys = zodiac;
  manager.timer = runtime.timers.setInterval(() => {});
  manager._schedule(() => { delayedMutation += 1; }, 100);
  manager._trackPendingCancel(() => { pendingCancelCalls += 1; });

  manager.dispose();
  runtime.timers.flushTimeouts();

  assert.equal(delayedMutation, 0, 'disposed voyage must not run delayed mutations');
  assert.equal(pendingCancelCalls, 1, 'dispose must cancel in-flight asset work');
  assert.equal(runtime.timers.count('timeout'), 0);
  assert.equal(runtime.timers.count('interval'), 0);
  assert.equal(audio.stopCalls, 1);
  assert.equal(audio.destroyCalls, 1);
  assert.equal(companion.disposeCalls, 1);
  assert.equal(orbit.disposeCalls, 1);
  assert.equal(zodiac.disposeCalls, 1);
  assert.equal(geometry.disposeCount, 1);
  assert.equal(material.disposeCount, 1);
  assert.equal(texture.disposeCount, 1);
  assert.equal(page.__moonVoyageMgr, null);
  assert.equal(manager.page, null);
  assert.equal(manager.scene, null);
  assert.equal(manager.loaded, false);
}

async function testStalePreloadCannotStartVoyage() {
  let resolvePreload;
  const preload = new Promise((resolve) => { resolvePreload = resolve; });
  const runtime = loadMoonLifecycle(() => preload);
  const manager = {
    active: false,
    loaded: false,
    _disposed: false,
    _entering: false,
    _exiting: false,
    _lifecycleToken: 1,
    _isLifecycleCurrent(token) {
      return !this._disposed && token === this._lifecycleToken;
    },
    _zodiacSys: { preload: () => Promise.resolve() },
    page: { data: {} }
  };

  runtime.enterVoyage(manager);
  manager._disposed = true;
  manager._lifecycleToken += 1;
  manager._entering = false;
  resolvePreload();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(runtime.playAudioCalls(), 0, 'a preload from an old page must not start voyage audio');
  assert.equal(manager.active, false);
}

function testDisposedAudioCallbacksCannotRestartLyricsOrExit() {
  const runtime = loadMoonAudio();
  let exitCalls = 0;
  const manager = {
    _disposed: false,
    _lifecycleToken: 1,
    _isLifecycleCurrent(token) {
      return !this._disposed && token === this._lifecycleToken;
    },
    exit() { exitCalls += 1; },
    audioContext: null
  };

  runtime.playAudio(manager, { AUDIO: 'cloud://moon-audio' });
  const ctx = runtime.contexts[0];
  manager._disposed = true;
  manager._lifecycleToken += 1;
  manager.audioContext = null;
  ctx.playListener();
  ctx.endedListener();

  assert.equal(runtime.lyricStarts(), 0);
  assert.equal(exitCalls, 0);
}

function testPeriodicDiagnosticsRequireExplicitMoonDebug() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'moon-voyage-timeline.js');
  const source = fs.readFileSync(file, 'utf8');

  assert.doesNotMatch(
    source,
    /if\s*\(mgr\._isDevtools\)/,
    'periodic voyage diagnostics must not run merely because DevTools is open'
  );
  assert.match(source, /if\s*\(mgr\._moonDebug\)/);
}

(async () => {
  testDisposeCancelsWorkAndReleasesOwnedResources();
  await testStalePreloadCannotStartVoyage();
  testDisposedAudioCallbacksCannotRestartLyricsOrExit();
  testPeriodicDiagnosticsRequireExplicitMoonDebug();
  console.log('moon voyage lifecycle tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
