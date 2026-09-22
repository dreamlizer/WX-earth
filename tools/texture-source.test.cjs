const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadTextureSource({ platform = 'ios', forceCloudTextures = false } = {}) {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'texture-source.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/import\s+\{\s*getSystemInfo\s*\}\s+from\s+['"].\/sys-info\.js['"];\s*/, '');
  source = source.replace(/export\s+(async\s+function|function)\s+([A-Za-z0-9_]+)/g, '$1 $2');
  source += '\nmodule.exports = { getTextureUrl, ensureOfflineTextures, prefetchTextureUrls, clearTextureCache, clearTextureSaved };';

  const storage = {};
  const calls = { downloadFile: 0, saveFile: 0, getTempFileURL: 0 };
  const existingFiles = new Set();

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    setTimeout,
    clearTimeout,
    Date,
    Promise,
    Number,
    String,
    Object,
    Array,
    Math,
    isFinite,
    getApp: () => ({ globalData: { env: 'test-env', forceCloudTextures } }),
    getSystemInfo: () => ({ platform, environment: 'miniprogram' }),
    wx: {
      env: { USER_DATA_PATH: '/user' },
      getStorageSync(key) { return storage[key]; },
      setStorageSync(key, value) { storage[key] = value; },
      getFileSystemManager() {
        return {
          mkdir({ success }) { if (success) setTimeout(success, 0); },
          accessSync(filePath) {
            if (!existingFiles.has(filePath)) throw new Error('missing');
          },
          unlinkSync(filePath) { existingFiles.delete(filePath); },
          saveFile({ filePath, success }) {
            calls.saveFile += 1;
            setTimeout(() => {
              existingFiles.add(filePath);
              if (success) success({ savedFilePath: filePath });
            }, 5);
          }
        };
      },
      cloud: {
        async downloadFile({ fileID }) {
          calls.downloadFile += 1;
          await new Promise(resolve => setTimeout(resolve, 10));
          return { tempFilePath: `/tmp/${calls.downloadFile}-${path.basename(fileID)}` };
        },
        async getTempFileURL() {
          calls.getTempFileURL += 1;
          if (platform === 'ios') throw new Error('iOS path should prefer downloadFile');
          return { fileList: [{ tempFileURL: 'https://test.example/earth.jpg' }] };
        }
      }
    }
  };

  vm.runInNewContext(source, sandbox, { filename: file });
  return { api: sandbox.module.exports, calls };
}

async function testConcurrentGetTextureUrlCoalesces() {
  const { api, calls } = loadTextureSource();

  const [a, b] = await Promise.all([
    api.getTextureUrl('earth'),
    api.getTextureUrl('earth')
  ]);

  assert.strictEqual(calls.downloadFile, 1, 'concurrent getTextureUrl should share one download');
  assert.strictEqual(calls.saveFile, 1, 'concurrent getTextureUrl should share one save');
  assert.strictEqual(a.url, b.url, 'concurrent callers should receive the same stable URL');
}

async function testEnsureOfflineWaitsForForegroundLoad() {
  const { api, calls } = loadTextureSource();

  await Promise.all([
    api.getTextureUrl('earth'),
    api.ensureOfflineTextures(['earth'])
  ]);

  assert.strictEqual(calls.downloadFile, 1, 'ensureOfflineTextures should not start a competing download');
  assert.strictEqual(calls.saveFile, 1, 'ensureOfflineTextures should not start a competing save');
}

async function testPreferNetworkWaitsForActiveSameTexture() {
  const { api, calls } = loadTextureSource();

  const [a, b] = await Promise.all([
    api.getTextureUrl('earth'),
    api.getTextureUrl('earth', true)
  ]);

  assert.strictEqual(calls.downloadFile, 1, 'preferNetwork should not bypass an active same-texture request');
  assert.strictEqual(calls.saveFile, 1, 'preferNetwork should not create a competing same-texture save');
  assert.strictEqual(a.url, b.url, 'same-texture callers should receive the same in-flight URL');
}

async function testDesktopPreviewUsesRealLocalTextures() {
  for (const platform of ['devtools', 'mac', 'windows']) {
    const { api, calls } = loadTextureSource({ platform });
    for (const name of ['earth', 'earth_night', 'earth_day', 'cloud']) {
      for (const preferNetwork of [false, true]) {
        const result = await api.getTextureUrl(name, preferNetwork);
        assert.ok(result.url.startsWith('/assets/textures/'), 'desktop preview must use a real packaged texture, not a 1x1 placeholder');
        const asset = path.join(__dirname, '../miniprogram', result.url);
        assert.ok(fs.statSync(asset).size > 1024, 'preview image must be packaged');
      }
    }
    assert.strictEqual(calls.downloadFile + calls.getTempFileURL, 0, 'desktop preview must not start cloud requests or retry cloud');
  }
}

async function testCloudRoutePreserved() {
  for (const options of [{ platform: 'android' }, { platform: 'devtools', forceCloudTextures: true }]) {
    const { api, calls } = loadTextureSource(options);
    const result = await api.getTextureUrl('earth');
    assert.strictEqual(result.url, 'https://test.example/earth.jpg');
    assert.ok(result.fallback.startsWith('data:image/png'), 'phone failure fallback remains unchanged');
    assert.strictEqual(calls.getTempFileURL, 1);
  }
}

(async () => {
  await testConcurrentGetTextureUrlCoalesces();
  await testEnsureOfflineWaitsForForegroundLoad();
  await testPreferNetworkWaitsForActiveSameTexture();
  await testDesktopPreviewUsesRealLocalTextures();
  await testCloudRoutePreserved();
  console.log('texture-source tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
