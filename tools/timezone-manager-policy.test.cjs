const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadTimezoneManagerHarness() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'timezone-manager.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^import .*$/gm, '');
  source = source.replace(/export\s+function\s+createTimezoneManager/, 'function createTimezoneManager');
  source += '\nmodule.exports = { createTimezoneManager };';

  let now = 1000;
  let gatherCalls = 0;
  let containsCalls = 0;

  class FakeVector3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    applyEuler(e) {
      this.x += e.x || 0;
      this.y += e.y || 0;
      this.z += e.z || 0;
      return this;
    }
  }

  class FakeEuler {
    constructor(x = 0, y = 0, z = 0, order = 'XYZ') { this.set(x, y, z, order); }
    set(x, y, z, order = this.order) { this.x = x; this.y = y; this.z = z; this.order = order; return this; }
  }

  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Date: FakeDate,
    Math,
    isFinite,
    setTimeout,
    clearTimeout,
    convertVec3ToLatLon: (x, y) => [x, y],
    normalizeLon: (lon) => lon,
    gatherCandidates: () => { gatherCalls += 1; return [0]; },
    featureContains: () => { containsCalls += 1; return true; }
  };

  vm.runInNewContext(source, sandbox, { filename: file });
  return {
    createTimezoneManager: sandbox.module.exports.createTimezoneManager,
    THREE: { Vector3: FakeVector3, Euler: FakeEuler },
    advance(ms) { now += ms; },
    get gatherCalls() { return gatherCalls; },
    get containsCalls() { return containsCalls; }
  };
}

function createManager(harness, touch) {
  const page = { currentTZ: null, selectedTimezone: null, data: { currentTime: '' } };
  return harness.createTimezoneManager({
    THREE: harness.THREE,
    RADIUS: 1,
    page,
    searchRef: () => ({}),
    countriesRef: () => [{ id: 1 }],
    getCountryOverride: () => 'Asia/Shanghai',
    tzlookup: () => 'Etc/UTC',
    computeGmtOffsetStr: () => '+08:00',
    formatTime: () => '12:34:56',
    touchRef: () => touch
  });
}

function testMotionSkipsHeavyCountryLookupInsideThrottleWindow() {
  const touch = { isDragging: true, rotX: 0, rotY: 0 };
  const harness = loadTimezoneManagerHarness();
  const manager = createManager(harness, touch);

  manager.computeCenterTZ(0, 0);
  assert.strictEqual(harness.gatherCalls, 1, 'first compute should query the country index');

  harness.advance(20);
  touch.rotX = 0.01;
  touch.rotY = 0.02;
  manager.computeCenterTZ(touch.rotX, touch.rotY);

  assert.strictEqual(harness.gatherCalls, 1, 'motion within throttle window should reuse the last center lookup');
  assert.strictEqual(harness.containsCalls, 1, 'motion within throttle window should skip polygon contains checks');
}

function testMotionRecomputesAfterThrottleWindow() {
  const touch = { isDragging: true, rotX: 0, rotY: 0 };
  const harness = loadTimezoneManagerHarness();
  const manager = createManager(harness, touch);

  manager.computeCenterTZ(0, 0);
  harness.advance(90);
  touch.rotX = 0.04;
  touch.rotY = 0.03;
  manager.computeCenterTZ(touch.rotX, touch.rotY);

  assert.strictEqual(harness.gatherCalls, 2, 'motion after throttle window should refresh the center lookup');
  assert.strictEqual(harness.containsCalls, 2, 'motion after throttle window should run contains checks again');
}

testMotionSkipsHeavyCountryLookupInsideThrottleWindow();
testMotionRecomputesAfterThrottleWindow();
console.log('timezone-manager policy tests passed');
