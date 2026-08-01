const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadAppEngine() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'app-engine.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^import[\s\S]*?;\s*$/gm, '');
  source = source.replace('export class AppEngine', 'class AppEngine');
  source += '\nmodule.exports = { AppEngine };';

  let nextTimer = 1;
  const timers = new Map();
  const nextTicks = [];
  const calls = { clearedTimers: 0, offWindowResize: 0 };
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Set,
    Object,
    Array,
    Number,
    Math,
    APP_CFG: {},
    getSystemInfo: () => ({}),
    createTouchState: () => ({}),
    setTimeout(fn) {
      const id = nextTimer++;
      timers.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      calls.clearedTimers += 1;
      timers.delete(id);
    },
    wx: {
      offWindowResize() {
        calls.offWindowResize += 1;
      },
      nextTick(callback) {
        nextTicks.push(callback);
      }
    }
  };

  vm.runInNewContext(source, sandbox, { filename: file });
  return {
    AppEngine: sandbox.module.exports.AppEngine,
    calls,
    flushTimers() {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((fn) => fn());
    },
    flushNextTicks() {
      const callbacks = nextTicks.splice(0);
      callbacks.forEach((fn) => fn());
    }
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

function testTeardownCancelsOldWorkAndReleasesSceneResources() {
  const runtime = loadAppEngine();
  const engine = new runtime.AppEngine();
  const texture = disposable({ isTexture: true });
  const geometry = disposable();
  const material = disposable({
    map: texture,
    uniforms: { uDayTex: { value: texture } }
  });
  const renderer = disposable();
  const loop = { stopCount: 0, stop() { this.stopCount += 1; } };
  const resizeCallback = () => {};
  let delayedMutation = 0;

  engine.earthDayTex = texture;
  engine.earthMesh = {};
  engine.countryFeatures = [{}];
  engine.searchIndex = {};
  engine.earthReady = true;
  engine.loop = loop;
  engine.state = {
    onWinResizeCb: resizeCallback,
    renderer,
    scene: {
      traverse(visitor) {
        visitor({ geometry, material });
        visitor({ geometry, material });
      }
    }
  };

  const token = engine._lifecycleToken;
  engine._schedule(token, () => { delayedMutation += 1; }, 100);
  engine.teardown();
  runtime.flushTimers();

  assert.equal(delayedMutation, 0, 'teardown must prevent callbacks from an old page lifecycle');
  assert.equal(runtime.calls.clearedTimers, 1, 'teardown must cancel tracked timers');
  assert.equal(runtime.calls.offWindowResize, 1, 'teardown must unregister the resize listener');
  assert.equal(loop.stopCount, 1, 'teardown must stop the render loop');
  assert.equal(geometry.disposeCount, 1, 'shared geometry must be disposed once');
  assert.equal(material.disposeCount, 1, 'shared material must be disposed once');
  assert.equal(texture.disposeCount, 1, 'shared textures and shader uniforms must be disposed once');
  assert.equal(renderer.disposeCount, 1, 'renderer must be disposed');
  assert.equal(engine.state, null);
  assert.equal(engine.earthMesh, null);
  assert.equal(engine.countryFeatures, null);
  assert.equal(engine.searchIndex, null);
  assert.equal(engine.earthReady, false);
}

function testTeardownResetsRefsBeforeCanvasSetupCompletes() {
  const runtime = loadAppEngine();
  const engine = new runtime.AppEngine();
  engine.cloudMesh = {};
  engine.sceneCtx = {};
  engine.managers = { stale: true };

  engine.teardown();

  assert.equal(engine.cloudMesh, null);
  assert.equal(engine.sceneCtx, null);
  assert.equal(Object.keys(engine.managers).length, 0);
}

function testPageUnloadCanDeferOnlyHeavyResourceDisposal() {
  const runtime = loadAppEngine();
  const engine = new runtime.AppEngine();
  const geometry = disposable();
  const material = disposable();
  const renderer = disposable();
  const loop = { stopCount: 0, stop() { this.stopCount += 1; } };

  engine.earthMesh = {};
  engine.loop = loop;
  engine.state = {
    renderer,
    scene: {
      traverse(visitor) {
        visitor({ geometry, material });
      }
    }
  };

  engine.teardown({ deferResourceDisposal: true });

  assert.equal(loop.stopCount, 1, 'rendering must stop synchronously');
  assert.equal(engine.state, null, 'page references must detach synchronously');
  assert.equal(engine.earthMesh, null, 'runtime references must reset synchronously');
  assert.equal(geometry.disposeCount, 0, 'heavy scene disposal should leave onUnload');
  assert.equal(renderer.disposeCount, 0);

  runtime.flushNextTicks();

  assert.equal(geometry.disposeCount, 1);
  assert.equal(material.disposeCount, 1);
  assert.equal(renderer.disposeCount, 1);
}

testTeardownCancelsOldWorkAndReleasesSceneResources();
testTeardownResetsRefsBeforeCanvasSetupCompletes();
testPageUnloadCanDeferOnlyHeavyResourceDisposal();
console.log('app-engine lifecycle tests passed');
