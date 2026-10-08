const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const THREE = require('../miniprogram/node_modules/threejs-miniprogram').createScopedThreejs({ width: 390, height: 720, createImage() { return {}; } });

function load(name, exports, dependencies = {}) {
  const file = path.resolve('miniprogram/pages/gl', name);
  const source = fs.readFileSync(file, 'utf8').replace(/^import[\s\S]*?;\s*$/gm, '').replace(/export /g, '');
  const box = { module: { exports: {} }, console, setTimeout, clearTimeout, ...dependencies };
  vm.runInNewContext(`${source}\nmodule.exports = { ${exports.join(', ')} };`, box, { filename: file });
  return box.module.exports;
}
const shaders = load('saturn-preview-shaders.js', ['SATURN_VERTEX', 'SATURN_FRAGMENT', 'RING_VERTEX', 'RING_FRAGMENT']);
const { createSaturnPreviewScene } = load('saturn-preview-scene.js', ['createSaturnPreviewScene'], shaders);
// The preview must never steal zen/moon input or mutate Earth camera/materials.
const { AppEngine } = load('app-engine.js', ['AppEngine'], {
  APP_CFG: {}, getSystemInfo: () => ({}), createTouchState: () => ({}),
  zenState: { active: false }
});
const engine = new AppEngine();
let previewEnters = 0, previewMoves = 0, earthMoves = 0;
engine.state = { page: { __isMoonLocked: () => true }, camera: { sentinel: true } };
engine.earthReady = true;
engine.saturnPreview = { active: false, enter() { previewEnters++; return true; }, touchMove() { previewMoves++; } };
assert.equal(engine.enterSaturnPreview(), false, 'moon entering/exiting lock blocks the preview');
engine.state.page.__isMoonLocked = () => false;
engine.moonMgr = { isActive: () => true };
assert.equal(engine.enterSaturnPreview(), false);
engine.moonMgr = { isActive: () => false };
assert.equal(engine.enterSaturnPreview(), true);
assert.equal(previewEnters, 1);
engine.managers.input = { onTouchMove() { earthMoves++; } };
engine.saturnPreview.active = true;
engine.onTouchMove({ touches: [] });
assert.equal(previewMoves, 1); assert.equal(earthMoves, 0);
assert.deepEqual(engine.state.camera, { sentinel: true });
engine.saturnPreview.active = false;
engine.onTouchMove({ touches: [] });
assert.equal(earthMoves, 1);

const pendingPackages = [], pendingTextures = [];
THREE.TextureLoader = class {
  load(url, done, progress, fail) { pendingTextures.push({ url, done, fail }); }
};
const { SaturnPreviewManager } = load('saturn-preview-manager.js', ['SaturnPreviewManager'], {
  createSaturnPreviewScene,
  require(url, resolve, reject) {
    assert.equal(url, '../../saturn-assets/ready.js');
    pendingPackages.push({ resolve, reject });
  }
});
const page = { data: {}, setData(data) { Object.assign(this.data, data); } };
const renderer = { capabilities: { getMaxAnisotropy: () => 8 }, getSize: out => out.set(390, 720), render(scene, camera) { this.lastScene = scene; this.lastCamera = camera; } };
const manager = new SaturnPreviewManager(THREE, renderer, page);
const flush = () => new Promise(resolve => setImmediate(resolve));
function texture() {
  const t = new THREE.Texture();
  t.disposals = 0;
  t.addEventListener('dispose', () => t.disposals++);
  return t;
}

(async () => {
  manager.enter(); manager.enter();
  assert.equal(pendingPackages.length, 1, 'duplicate taps cannot start duplicate loads');
  manager.exit();
  pendingPackages.shift().resolve();
  await flush();
  assert.equal(pendingTextures.length, 0, 'closing during package loading cannot construct an abandoned model');

  manager.enter(); pendingPackages.shift().resolve(); await flush();
  assert.equal(pendingTextures.length, 2);
  const abandoned = pendingTextures.splice(0);
  manager.exit(); manager.enter();
  const oldTextures = abandoned.map(request => { const t = texture(); request.done(t); return t; });
  assert(oldTextures.every(t => t.disposals === 1), 'late textures from the previous visit must be freed');
  pendingPackages.shift().resolve(); await flush();
  const loaded = pendingTextures.splice(0).map(request => { const t = texture(); request.done(t); return t; });
  await flush();
  assert.equal(page.data.saturnPreviewLoading, false);
  assert(manager.model);
  manager.render();
  assert.equal(renderer.lastScene, manager.model.scene);
  assert(Number.isFinite(renderer.lastCamera.position.length()));
  assert.equal(loaded[0].anisotropy, 4);
  const meshes = [];
  manager.model.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
  assert.equal(meshes.length, 2, 'sphere and transparent ring are actual 3D meshes');
  assert.equal(meshes[0].scale.y, 0.902);

  const before = manager.target.yaw;
  manager.touchStart({ touches: [{ x: 50, y: 50 }] });
  manager.touchMove({ touches: [{ x: 80, y: 80 }] });
  assert.notEqual(manager.target.yaw, before);
  manager.touchStart({ touches: [{ x: 0, y: 0 }, { x: 100, y: 0 }] });
  manager.touchMove({ touches: [{ x: 0, y: 0 }, { x: 10000, y: 0 }] });
  assert.equal(manager.target.distance, 3.2, 'pinching cannot enter Saturn');
  manager.touchEnd({ touches: [{ x: 20, y: 20 }] });
  manager.touchMove({ touches: [{ x: 25, y: 20 }] });
  assert(Number.isFinite(manager.target.yaw), 'two-to-one finger transitions remain usable');
  manager.setView('close');
  assert.equal(page.data.saturnView, 'close');
  manager.pause();
  assert.equal(manager.points.length, 0);
  manager.exit();
  assert(loaded.every(t => t.disposals === 1));
  assert.equal(page.data.saturnPreviewActive, false);

  // Failed load must also invalidate its still-pending sibling callback.
  manager.enter(); pendingPackages.shift().resolve(); await flush();
  const failed = pendingTextures.splice(0);
  failed[0].fail(new Error('test asset failure'));
  await flush();
  const late = texture(); failed[1].done(late);
  assert.equal(late.disposals, 1);
  assert(page.data.saturnPreviewError);
  manager.dispose();
  assert.equal(manager.pendingCancels.size, 0);
  assert.equal(manager.textures.size, 0);
  console.log('Saturn preview: legacy Three geometry, subpackage loading, drag/pinch, re-entry, failure and disposal PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
