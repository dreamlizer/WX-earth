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

function testInspectFlagsPlaceholderTextureAsBroken() {
  const { inspectEarthTextureState } = loadTextureHealth();
  // iOS 云贴图失败时退回的 1×1 占位图：带 isPlaceholder 标记
  const placeholder = { uuid: 'placeholder', userData: { isPlaceholder: true }, image: { width: 1, height: 1 } };
  const state = inspectEarthTextureState({
    earthMesh: makeMesh(placeholder),
    earthDayTex: placeholder,
    currentTheme: 'default'
  });

  assert.strictEqual(state.ok, false, 'placeholder texture must be reported as not ok');
}

function testInspectFlagsTinyImageAsBroken() {
  const { inspectEarthTextureState } = loadTextureHealth();
  // 即使没有标记，≤2px 的图也应被判为兜底/无效
  const tiny = { uuid: 'tiny', image: { width: 1, height: 1 } };
  const state = inspectEarthTextureState({
    earthMesh: makeMesh(tiny),
    earthDayTex: tiny,
    currentTheme: 'default'
  });

  assert.strictEqual(state.ok, false, 'a 1x1 texture must be reported as not ok');
}

function testRepairRequestsReloadWhenOnlyPlaceholderAvailable() {
  const { repairEarthTexture } = loadTextureHealth();
  const placeholder = { uuid: 'placeholder', userData: { isPlaceholder: true }, image: { width: 1, height: 1 } };
  const mesh = makeMesh(placeholder);

  const result = repairEarthTexture({
    earthMesh: mesh,
    earthDayTex: placeholder,
    currentTheme: 'default'
  });

  // 没有任何可用真图可重绑 -> 必须请求重载（refreshTextures），这是 iOS 自愈的关键
  assert.strictEqual(result.action, 'reload', 'must request reload when only a placeholder is available');
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
testInspectFlagsPlaceholderTextureAsBroken();
testInspectFlagsTinyImageAsBroken();
testRepairRequestsReloadWhenOnlyPlaceholderAvailable();
testCheckerThrottlesRefreshWhenNoTextureCanBeRebound().then(() => testCheckerSkipsReloadBeforeEarthIsReady()).then(() => {
  console.log('texture-health tests passed');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
