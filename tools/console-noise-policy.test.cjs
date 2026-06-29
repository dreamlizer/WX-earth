const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('poetry loader does not call disabled poetrySetsV2 fallback', () => {
  const src = read('miniprogram/pages/gl/content-loader.js');
  assert.equal(
    src.includes("safeCallFn('poetrySetsV2')"),
    false,
    'poetrySetsV2 is disabled in this repo and must not be called at runtime'
  );
});

test('poetry loader tries the uploaded cloud function before database fallback', () => {
  const src = read('miniprogram/pages/gl/content-loader.js');
  const fnPos = src.indexOf("safeCallFn('poetrySets')");
  const dbPos = src.indexOf("db.collection('poetry_sets')");
  assert.notEqual(fnPos, -1, 'poetrySets cloud function should be the primary source');
  assert.notEqual(dbPos, -1, 'database fallback should remain available');
  assert.ok(fnPos < dbPos, 'cloud function should run before direct database fallback');
  assert.match(src, /if\s*\(\s*__canCallFn\s*\)/);
});

test('poetry loader keeps cloud poetry available in DevTools', () => {
  const src = read('miniprogram/pages/gl/content-loader.js');
  assert.match(src, /const\s+__isDevtools/);
  assert.match(src, /let\s+skipDbFallback\s*=\s*false/);
  assert.match(src, /if\s*\(\s*__canCallFn\s*\)/);
  assert.equal(src.includes('__canCallFn && !__isDevtools'), false);
  assert.match(src, /__canDb\s*&&\s*!skipDbFallback/);
});

test('special text loader has no missing DevTools helper or normal success log', () => {
  const src = read('miniprogram/pages/gl/content-loader.js');
  assert.match(src, /import\s+\{\s*isDevtools\s*\}\s+from\s+['"]\.\/config\.js['"]/);
  assert.equal(src.includes("[special] 加载"), false, 'special text success path should stay quiet');
});

test('app launch initializes cloud for poetry and database APIs', () => {
  const src = read('miniprogram/app.js');
  assert.match(src, /forceCloudTextures:\s*false/);
  assert.match(src, /wx\.cloud\.init\(\{/);
  assert.match(src, /env:\s*this\.globalData\.env/);
  assert.equal(src.includes('!isDevtools || this.globalData.forceCloudTextures'), false);
  assert.equal(src.includes('[cloud init] skipped in devtools'), false, 'normal DevTools cloud skip should be silent');
});

test('moon button cloud url resolution is skipped in DevTools', () => {
  const src = read('miniprogram/pages/gl/index.js');
  const fnPos = src.indexOf('__resolveMoonBtnUrl()');
  const cloudPos = src.indexOf('cloud.getTempFileURL', fnPos);
  assert.notEqual(fnPos, -1, 'moon button resolver should exist');
  assert.notEqual(cloudPos, -1, 'moon button cloud URL resolution should remain for real devices');
  const guardSlice = src.slice(fnPos, cloudPos);
  assert.match(guardSlice, /if\s*\(\s*this\.__isDevtools\s*\)\s*return/);
});

test('selection manager has no temporary SEL-DIAG console noise', () => {
  const src = read('miniprogram/pages/gl/selection-manager.js');
  assert.equal(src.includes('SEL-DIAG'), false, 'temporary selection diagnostics should not ship');
});

test('moon background preload is skipped in WeChat DevTools', () => {
  const src = read('miniprogram/pages/gl/app-engine.js');
  assert.match(src, /const\s+\{\s*isDevtools,\s*isPCClient\s*\}\s*=\s*detectEnvironment\(this\.sys\)/);
  assert.match(src, /if\s*\(\s*this\.moonMgr\s*&&\s*!isDevtools\s*&&\s*!isPCClient\s*\)/);
});

test('isDevtools recognizes environment, brand, and platform markers', () => {
  const src = read('miniprogram/pages/gl/config.js');
  assert.match(src, /info\?\.environment/);
  assert.match(src, /info\?\.brand/);
  assert.match(src, /info\?\.platform/);
});

test('optional cloud texture prefetch is skipped in DevTools and PC clients', () => {
  const src = read('miniprogram/pages/gl/platform-manager.js');
  assert.match(src, /const\s+\{\s*isDevtools,\s*isPCClient\s*\}\s*=\s*detectEnvironment\(sys\)/);
  assert.match(src, /if\s*\(\s*!\(isDevtools\s*\|\|\s*isPCClient\)\s*\|\|\s*forceCloud\s*\)/);
});

test('moon manager avoids deprecated getSystemInfoSync', () => {
  const src = read('miniprogram/pages/gl/moon-voyage-manager.js');
  assert.equal(src.includes('getSystemInfoSync'), false, 'use sys-info wrapper to avoid devtools deprecation noise');
});

test('texture refresh does not preload moon assets in DevTools and PC clients', () => {
  const src = read('miniprogram/pages/gl/app-engine.js');
  const refreshPos = src.indexOf('async refreshTextures()');
  const moonRefreshPos = src.indexOf('this.moonMgr?.refreshAssets?.({ preload: true })');
  assert.notEqual(refreshPos, -1, 'refreshTextures should exist');
  assert.notEqual(moonRefreshPos, -1, 'moon asset refresh call should stay visible and gated');
  assert.ok(moonRefreshPos > refreshPos, 'moon refresh call should be inside refreshTextures');
  const guardStart = src.lastIndexOf('detectEnvironment(this.sys)', moonRefreshPos);
  assert.ok(guardStart > refreshPos, 'moon refresh should be guarded by environment detection');
  const guardedSlice = src.slice(guardStart, moonRefreshPos);
  assert.match(guardedSlice, /isDevtools/);
  assert.match(guardedSlice, /isPCClient/);
});

test('normal startup success logs stay quiet by default', () => {
  const sources = [
    ['miniprogram/pages/gl/content-loader.js', '[poetry] 直接从数据库读取成功'],
    ['miniprogram/pages/gl/zen-poetry.js', '[poetry] 载入'],
    ['miniprogram/pages/gl/zen-poetry.js', '[special] 加载'],
    ['miniprogram/pages/gl/texture-source.js', '[texture] use offline saved'],
    ['miniprogram/pages/gl/scene-loader.js', '[scene] cloud texture applied'],
    ['miniprogram/pages/gl/moon-voyage-manager.js', '[Moon] Manager initialized'],
    ['miniprogram/pages/gl/moon-voyage-scene-setup.js', 'Mesh created and added to SCENE']
  ];

  for (const [rel, marker] of sources) {
    assert.equal(read(rel).includes(marker), false, `${marker} should not print during normal startup`);
  }
});

test('pipeline diagnostics are behind the perf debug flag', () => {
  const src = read('miniprogram/pages/gl/debug-manager.js');
  const dumpPos = src.indexOf('export const dumpRendererInfo');
  const logPos = src.indexOf("console.info('[PIPELINE]'");
  assert.notEqual(dumpPos, -1, 'dumpRendererInfo should exist');
  assert.notEqual(logPos, -1, 'pipeline diagnostic can remain available');
  const guardSlice = src.slice(dumpPos, logPos);
  assert.match(guardSlice, /if\s*\(\s*!PERF_DIAG_LOG\s*\)\s*return/);
});
