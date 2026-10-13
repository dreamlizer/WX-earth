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
const profiles = load('saturn-profile-shaders.js', ['PROFILE_SURFACE_FRAGMENT', 'PROFILE_RING_FRAGMENT', 'ATMOSPHERE_FRAGMENT']);
const looks = load('saturn-preview-looks.js', ['SATURN_LOOKS', 'DEFAULT_SATURN_LOOK']);
const iceRing = load('saturn-ice-ring.js', ['createSaturnIceRing']);
const voyageRoute = load('saturn-voyage-route.js', ['sampleSaturnVoyage', 'saturnVoyageTime', 'SATURN_VOYAGE_DURATION', 'SATURN_VOYAGE_SUN']);
const { createSaturnPreviewScene } = load('saturn-preview-scene.js', ['createSaturnPreviewScene'], { ...shaders, ...profiles, ...looks, ...iceRing, ...voyageRoute });
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
  ...looks,
  ...voyageRoute,
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
  assert.equal(pendingTextures.length, 4);
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
  assert.equal(meshes.length, 4, 'sphere, ring, atmosphere and merged ice are actual 3D meshes');
  assert.equal(meshes[0].scale.y, 0.902);
  assert.equal(meshes[0].material.uniforms.sphereTexture.value, loaded[3], 'new looks use the cloud map');
  assert.equal(loaded[3].wrapS, THREE.RepeatWrapping);
  assert.equal(meshes[3].visible, false, 'overview does not draw the ice patch');
  assert.equal(manager.model.iceCount, 1900);
  const cameraBefore = manager.model.camera.position.clone();
  const targetBefore = JSON.stringify(manager.target);
  const modelBefore = manager.model;
  const releasedMaterials = new Set();
  for (const key of Object.keys(looks.SATURN_LOOKS)) {
    manager.setLook(key);
    assert.equal(page.data.saturnLook, key);
    assert.equal(manager.model.getLook(), key);
    assert.equal(manager.model, modelBefore, 'look changes reuse the scene and textures');
    assert(manager.model.camera.position.equals(cameraBefore), 'look changes preserve the camera');
    assert.equal(JSON.stringify(manager.target), targetBefore);
    for (const mesh of meshes) releasedMaterials.add(mesh.material);
  }
  manager.setLook('invalid');
  assert.equal(page.data.saturnLook, 'eclipse');
  assert.equal(pendingTextures.length, 0, 'switching looks never reloads the subpackage');
  let materialDisposals = 0;
  releasedMaterials.forEach(material => material.addEventListener('dispose', () => materialDisposals++));

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
  manager.setView('ice');
  assert.equal(manager.target.ice, 1);
  const geometry = meshes[3].geometry;
  let geometryDisposals = 0;
  geometry.addEventListener('dispose', () => geometryDisposals++);
  manager.model.update(manager.target, 12, 390 / 720);
  assert.equal(meshes[3].visible, true);
  const localEye = manager.model.camera.position.clone().applyQuaternion(meshes[3].parent.quaternion.clone().inverse());
  assert(localEye.length() > 2.4 && localEye.length() < 2.7, 'ice camera stays outside Saturn near the outer ring');
  assert(Math.abs(localEye.y) < .1, 'ice view is close to the equatorial ring plane');
  const eyeBefore = manager.model.camera.position.clone();
  manager.model.update(manager.target, 24, 390 / 720);
  assert(!manager.model.camera.position.equals(eyeBefore), 'ice encounter gently moves with elapsed time');
  manager.model.update({ ...manager.target, ice: 0 }, 24, 390 / 720);
  assert.equal(meshes[3].visible, false);

  // Sample the complete camera rail, not just its endpoint: continuous motion,
  // no planet collision, and a real shadow cast by Saturn at the destination.
  let lastEye = null;
  for (let t = 0; t <= voyageRoute.SATURN_VOYAGE_DURATION; t += .25) {
    const frame = voyageRoute.sampleSaturnVoyage(t);
    const eye = new THREE.Vector3(...frame.position);
    assert(eye.length() > 2.2, 'the whole rail stays outside the planet');
    if (lastEye) assert(eye.distanceTo(lastEye) < .12, 'no cuts at route stage boundaries');
    lastEye = eye;
  }
  const endFrame = voyageRoute.sampleSaturnVoyage(132);
  const endEye = new THREE.Vector3(...endFrame.position).divide(new THREE.Vector3(1, .902, 1));
  const sun = new THREE.Vector3(...voyageRoute.SATURN_VOYAGE_SUN).divide(new THREE.Vector3(1, .902, 1)).normalize();
  const along = endEye.dot(sun);
  assert(along < 0 && endEye.clone().addScaledVector(sun, -along).length() < .99, 'final camera lies in Saturn\'s actual shadow cylinder');
  assert.equal(voyageRoute.sampleSaturnVoyage(36).stage, '沿冰环航行');
  assert.equal(voyageRoute.sampleSaturnVoyage(92).stage, '进入土星阴影');
  assert.equal(voyageRoute.saturnVoyageTime(132), '02:12');

  manager.startVoyage();
  assert.equal(page.data.saturnVoyageActive, true);
  assert.equal(manager.look, 'cinema');
  assert.equal(pendingTextures.length, 0, 'the voyage reuses the loaded scene');
  manager.voyage.time = 58; manager.voyage.blend = 1;
  manager.toggleVoyagePause();
  const heldTime = manager.voyage.time, heldClock = manager.clock;
  manager.render();
  assert.equal(manager.voyage.time, heldTime);
  assert.equal(manager.clock, heldClock, 'pause holds camera travel, clouds and ice motion');
  const heldEye = manager.model.camera.position.clone();
  const heldGaze = manager.model.camera.quaternion.clone();
  manager.touchStart({ touches: [{ x: 10, y: 10 }] });
  manager.touchMove({ touches: [{ x: 200, y: 80 }] });
  manager.lastFrame = Date.now() - 40;
  manager.render();
  assert(manager.model.camera.position.equals(heldEye), 'looking cannot derail the flight even when paused');
  assert(!manager.model.camera.quaternion.equals(heldGaze), 'dragging still turns the gaze while paused');
  manager.resetVoyageGaze();
  for (let i = 0; i < 30; i++) { manager.lastFrame = Date.now() - 50; manager.render(); }
  assert(manager.model.camera.quaternion.angleTo(heldGaze) < .001, 'recenter returns to the route composition');
  assert.equal(manager.voyage.time, heldTime, 'recenter does not resume the voyage');
  manager.pause(); manager.render();
  assert.equal(manager.voyage.time, heldTime, 'background lifecycle pause preserves a user pause');
  manager.touchStart({ touches: [{ x: 0, y: 0 }, { x: 100, y: 0 }] });
  manager.touchMove({ touches: [{ x: 0, y: 0 }, { x: 10000, y: 0 }] });
  assert.equal(manager.voyage.time, heldTime, 'a pinch cannot jump along the route');
  manager.toggleVoyagePause();
  manager.lastFrame = Date.now() - 40; manager.render();
  assert(manager.voyage.time > heldTime, 'continue resumes from the paused position');
  manager.voyage.time = 131.99;
  manager.lastFrame = Date.now() - 40; manager.render();
  assert.equal(manager.voyage.time, 132);
  assert.equal(page.data.saturnVoyageComplete, true);
  assert.equal(manager.voyage.paused, true, 'arrival stops rather than looping abruptly');
  manager.startVoyage();
  assert.equal(manager.voyage.time, 0);
  assert.equal(manager.voyage.targetYaw, 0, 'restart clears the previous gaze offset');
  manager.stopVoyage();
  assert.equal(page.data.saturnVoyageActive, false);
  assert.equal(manager.look, 'eclipse', 'returning to model review restores its previous look');
  assert.equal(manager.voyage.exiting, true);
  for (let i = 0; i < 70; i++) { manager.lastFrame = Date.now() - 50; manager.render(); }
  assert.equal(manager.voyage, null);
  manager.pause();
  assert.equal(manager.points.length, 0);
  manager.exit();
  assert.equal(materialDisposals, 6, 'inactive original, new and ice materials are all disposed');
  assert.equal(geometryDisposals, 1, 'merged ice geometry is released on exit');
  assert(loaded.every(t => t.disposals === 1));
  assert.equal(page.data.saturnPreviewActive, false);
  assert.equal(page.data.saturnVoyageActive, false);

  // Failed load must also invalidate its still-pending sibling callback.
  manager.enter(); pendingPackages.shift().resolve(); await flush();
  const failed = pendingTextures.splice(0);
  failed[0].fail(new Error('test asset failure'));
  await flush();
  for (const request of failed.slice(1)) {
    const late = texture(); request.done(late);
    assert.equal(late.disposals, 1);
  }
  assert(page.data.saturnPreviewError);
  manager.dispose();
  assert.equal(manager.pendingCancels.size, 0);
  assert.equal(manager.textures.size, 0);
  console.log('Saturn preview: legacy Three geometry, subpackage loading, drag/pinch, re-entry, failure and disposal PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
