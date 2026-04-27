const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadRenderLoop() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'render-loop.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/export\s+function\s+createRenderLoop/, 'function createRenderLoop');
  source += '\nmodule.exports = { createRenderLoop };';
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Date,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: undefined
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.module.exports.createRenderLoop;
}

function createCanvasScheduler() {
  let nextId = 1;
  const callbacks = new Map();
  return {
    scheduled() { return callbacks.size; },
    requestAnimationFrame(cb) {
      const id = nextId++;
      callbacks.set(id, cb);
      return id;
    },
    cancelAnimationFrame(id) {
      callbacks.delete(id);
    },
    flushOne() {
      const first = callbacks.entries().next();
      if (first.done) return false;
      const [id, cb] = first.value;
      callbacks.delete(id);
      cb();
      return true;
    }
  };
}

function testStartIsIdempotent() {
  const createRenderLoop = loadRenderLoop();
  const canvas = createCanvasScheduler();
  const loop = createRenderLoop(() => canvas);
  let ticks = 0;

  loop.start(() => { ticks += 1; });
  loop.start();

  assert.strictEqual(ticks, 1, 'duplicate start should not tick immediately twice');
  assert.strictEqual(canvas.scheduled(), 1, 'duplicate start should keep only one scheduled frame');
}

function testResumeReusesLastTick() {
  const createRenderLoop = loadRenderLoop();
  const canvas = createCanvasScheduler();
  const loop = createRenderLoop(() => canvas);
  let ticks = 0;

  loop.start(() => { ticks += 1; });
  loop.stop();
  loop.start();

  assert.strictEqual(ticks, 2, 'resume without a tick should reuse the previous tick');
  assert.strictEqual(canvas.scheduled(), 1, 'resume should schedule one frame');
}

function testStopPreventsQueuedFrame() {
  const createRenderLoop = loadRenderLoop();
  const canvas = createCanvasScheduler();
  const loop = createRenderLoop(() => canvas);
  let ticks = 0;

  loop.start(() => { ticks += 1; });
  loop.stop();
  canvas.flushOne();

  assert.strictEqual(ticks, 1, 'cancelled queued frame should not tick after stop');
  assert.strictEqual(canvas.scheduled(), 0, 'stop should cancel queued frame');
}

function testStopInsideTickDoesNotReschedule() {
  const createRenderLoop = loadRenderLoop();
  const canvas = createCanvasScheduler();
  const loop = createRenderLoop(() => canvas);
  let ticks = 0;

  loop.start(() => {
    ticks += 1;
    loop.stop();
  });

  assert.strictEqual(ticks, 1, 'tick should run once before stopping itself');
  assert.strictEqual(canvas.scheduled(), 0, 'stopping inside tick should not schedule another frame');
}

testStartIsIdempotent();
testResumeReusesLastTick();
testStopPreventsQueuedFrame();
testStopInsideTickDoesNotReschedule();
console.log('render-loop tests passed');
