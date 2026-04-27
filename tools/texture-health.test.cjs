const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadTextureHealth() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'texture-health.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/export\s+function\s+/g, 'function ');
  source += '\nmodule.exports = { inspectEarthTextureState, repairEarthTexture, createTextureHealthChecker };';
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Math,
    Number,
    Promise
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.module.exports;
}

function makeMesh(map) {
  return {
    visible: true,
    material: {
      map,
      needsUpdate: false
    }
  };
}

function testInspectReportsHealthyPhongEarth() {
  const { inspectEarthTextureState } = loadTextureHealth();
  const tex = { uuid: 'day' };
  const state = inspectEarthTextureState({
    earthMesh: makeMesh(tex),
    earthDayTex: tex,
    currentTheme: 'default'
  });

  assert.strictEqual(state.ok, true);
  assert.strictEqual(state.reason, 'ok');
}

function testRepairRebindsExistingDayTextureBeforeReloading() {
  const { repairEarthTexture } = loadTextureHealth();
  const tex = { uuid: 'day', needsUpdate: false };
  const mesh = makeMesh(null);

  const result = repairEarthTexture({
    earthMesh: mesh,
    earthDayTex: tex,
    currentTheme: 'default'
  });

  assert.strictEqual(result.action, 'rebind');
  assert.strictEqual(mesh.material.map, tex);
  assert.strictEqual(mesh.material.needsUpdate, true);
  assert.strictEqual(tex.needsUpdate, true);
  assert.strictEqual(mesh.visible, true);
}

async function testCheckerThrottlesRefreshWhenNoTextureCanBeRebound() {
  const { createTextureHealthChecker } = loadTextureHealth();
  let refreshCalls = 0;
  const checker = createTextureHealthChecker({
    APP_CFG: { textureHealth: { enabled: true, intervalMs: 1000, startDelayMs: 0, minReloadGapMs: 5000 } },
    refs: {
      earthMesh: () => makeMesh(null),
      earthDayTex: () => null,
      currentTheme: () => 'default'
    },
    refreshTextures: () => { refreshCalls += 1; return Promise.resolve(true); },
    diagnostics: { recordTextureState() {} },
    logger: () => {}
  });

  await checker.tick(1000);
  await checker.tick(2000);
  await checker.tick(7000);

  assert.strictEqual(refreshCalls, 2, 'checker should throttle reload attempts by minReloadGapMs');
}

async function testCheckerSkipsReloadBeforeEarthIsReady() {
  const { createTextureHealthChecker } = loadTextureHealth();
  let refreshCalls = 0;
  const checker = createTextureHealthChecker({
    APP_CFG: { textureHealth: { enabled: true, intervalMs: 1000, startDelayMs: 0, minReloadGapMs: 5000 } },
    refs: {
      earthMesh: () => null,
      earthDayTex: () => null,
      currentTheme: () => 'default'
    },
    isReady: () => false,
    refreshTextures: () => { refreshCalls += 1; return Promise.resolve(true); },
    diagnostics: { recordTextureState() {} },
    logger: () => {}
  });

  const result = await checker.tick(1000);

  assert.strictEqual(result.reason, 'not-ready');
  assert.strictEqual(refreshCalls, 0, 'checker should not reload while the foreground texture load is still in progress');
}

testInspectReportsHealthyPhongEarth();
testRepairRebindsExistingDayTextureBeforeReloading();
testCheckerThrottlesRefreshWhenNoTextureCanBeRebound().then(() => testCheckerSkipsReloadBeforeEarthIsReady()).then(() => {
  console.log('texture-health tests passed');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
