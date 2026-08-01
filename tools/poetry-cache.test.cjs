const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CACHE_KEY = 'gl.poetry.presets.v1';

function loadPoetryLoader(overrides = {}) {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'content-loader.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^import[\s\S]*?;\s*$/gm, '');
  source = source.replace('export const loadPoetryPresets', 'const loadPoetryPresets');
  source = source.replace('export const loadPoetryLabelsFromDB', 'const loadPoetryLabelsFromDB');
  source = source.replace('export const loadSpecialTexts', 'const loadSpecialTexts');
  source += '\nmodule.exports = { loadPoetryPresets };';

  const storage = overrides.storage || new Map();
  const calls = { cloud: 0, db: 0, writes: 0 };
  const cloudDocs = overrides.cloudDocs || [
    { _id: 'preset_1', preset: 1, lines: [{ text: '云端诗句', duration: 7000 }] }
  ];
  const dbDocs = overrides.dbDocs || [
    { _id: 'preset_2', preset: 2, lines: [{ text: '数据库诗句', duration: 7000 }] }
  ];
  const localDocs = overrides.localDocs || [];

  const wx = {
    getStorageSync(key) {
      return storage.get(key);
    },
    setStorageSync(key, value) {
      calls.writes += 1;
      storage.set(key, value);
    },
    cloud: {
      async callFunction() {
        calls.cloud += 1;
        if (overrides.cloudError) throw new Error('cloud unavailable');
        return { result: { data: cloudDocs } };
      },
      database() {
        return {
          collection() {
            return {
              limit() {
                return {
                  async get() {
                    calls.db += 1;
                    if (overrides.dbError) throw new Error('database unavailable');
                    return { data: dbDocs };
                  },
                  field() {
                    return this;
                  }
                };
              }
            };
          }
        };
      }
    }
  };

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console: { ...console, warn() {} },
    Date,
    Object,
    Array,
    Number,
    String,
    isNaN,
    wx,
    isDevtools: () => true,
    require(request) {
      if (request.endsWith('poetry_sets.json')) return localDocs;
      return require(request);
    }
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return { loadPoetryPresets: sandbox.module.exports.loadPoetryPresets, calls, storage };
}

async function testFreshCloudResultIsCached() {
  const runtime = loadPoetryLoader();
  const result = await runtime.loadPoetryPresets({}, console);

  assert.equal(result.source, 'cloud-fn:poetrySets');
  assert.equal(runtime.calls.cloud, 1);
  assert.equal(runtime.calls.db, 0);
  assert.equal(runtime.calls.writes, 1);
  assert.equal(runtime.storage.get(CACHE_KEY).map[1][0].text, '云端诗句');
}

async function testFreshCacheSkipsCloudAndDatabase() {
  const storage = new Map([[CACHE_KEY, {
    schema: 1,
    savedAt: Date.now(),
    map: { 3: [{ text: '缓存诗句', duration: 7000 }] },
    labels: { 3: 'preset_3' }
  }]]);
  const runtime = loadPoetryLoader({ storage });
  const result = await runtime.loadPoetryPresets({}, console);

  assert.equal(result.source, 'cache:poetry_sets');
  assert.equal(result.map[3][0].text, '缓存诗句');
  assert.equal(runtime.calls.cloud, 0);
  assert.equal(runtime.calls.db, 0);
  assert.equal(runtime.calls.writes, 0);
}

async function testExpiredCacheRefreshesFromCloud() {
  const storage = new Map([[CACHE_KEY, {
    schema: 1,
    savedAt: Date.now() - (7 * 60 * 60 * 1000),
    map: { 1: [{ text: '旧缓存', duration: 7000 }] },
    labels: {}
  }]]);
  const runtime = loadPoetryLoader({ storage });
  const result = await runtime.loadPoetryPresets({}, console);

  assert.equal(result.source, 'cloud-fn:poetrySets');
  assert.equal(runtime.calls.cloud, 1);
  assert.equal(runtime.calls.writes, 1);
}

async function testCloudFailureKeepsDatabaseFallback() {
  const runtime = loadPoetryLoader({ cloudError: true });
  const result = await runtime.loadPoetryPresets({}, console);

  assert.equal(result.source, 'db:poetry_sets');
  assert.equal(result.map[2][0].text, '数据库诗句');
  assert.equal(runtime.calls.cloud, 1);
  assert.equal(runtime.calls.db, 1);
  assert.equal(runtime.calls.writes, 1);
}

async function testOfflineLocalFallbackIsCached() {
  const localDocs = [
    { _id: 'preset_1', preset: 1, lines: [{ text: '本地诗句', duration: 7000 }] }
  ];
  const runtime = loadPoetryLoader({ cloudError: true, dbError: true, localDocs });
  const result = await runtime.loadPoetryPresets({}, console);

  assert.equal(result.source, 'local:poetry_sets.json');
  assert.equal(result.map[1][0].text, '本地诗句');
  assert.equal(runtime.calls.cloud, 1);
  assert.equal(runtime.calls.db, 1);
  assert.equal(runtime.calls.writes, 1);
}

Promise.resolve()
  .then(testFreshCloudResultIsCached)
  .then(testFreshCacheSkipsCloudAndDatabase)
  .then(testExpiredCacheRefreshesFromCloud)
  .then(testCloudFailureKeepsDatabaseFallback)
  .then(testOfflineLocalFallbackIsCached)
  .then(() => console.log('poetry cache tests passed'));
