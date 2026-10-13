const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const THREE = require('../miniprogram/node_modules/threejs-miniprogram').createScopedThreejs({ width: 390, height: 720, createImage() { return {}; } });
function load(name, exports, dependencies = {}) {
  const file = path.resolve('miniprogram/pages/gl', name);
  const source = fs.readFileSync(file, 'utf8').replace(/^import[\s\S]*?;\s*$/gm, '').replace(/^import .*$/gm, '').replace(/export /g, '');
  const box = { module: { exports: {} }, console, setTimeout, clearTimeout, ...dependencies };
  vm.runInNewContext(`${source}\nmodule.exports = { ${exports.join(', ')} };`, box, { filename: file });
  return box.module.exports;
}
const { buildChandra, releaseChandra } = load('ambient-chandra-model.js', ['buildChandra', 'releaseChandra']);
const packages = [], requests = [];
const data = require('../miniprogram/chandra-assets/model.js');
const bytes = fs.readFileSync('miniprogram/chandra-assets/geometry.bin');
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
THREE.TextureLoader = class { load(url, done, progress, fail) { requests.push({ url, done, fail }); } };
const { AmbientEncounterManager, ambientBrowseState, ambientOrbitPoint, AMBIENT_CRAFT } = load('ambient-encounter-manager.js', ['AmbientEncounterManager', 'ambientBrowseState', 'ambientOrbitPoint', 'AMBIENT_CRAFT'], {
  buildChandra, releaseChandra,
  require(url, resolve, reject) { assert(/^..\/..\/(chandra|juno|magellan)-assets\/ready.js$/.test(url)); packages.push({ resolve, reject }); },
  wx: { getFileSystemManager: () => ({ readFile({ success }) { success({ data: buffer }); } }) }
});
const idle = { blocked: false, busy: false };
function manager(random = () => 0) {
  const scene = new THREE.Scene(), globeGroup = new THREE.Group(); scene.add(globeGroup);
  globeGroup.position.y = -0.55;
  const camera = new THREE.PerspectiveCamera(45, 390 / 720, .1, 1000); camera.position.z = 4.5;
  const page = { data: { lang: 'zh' }, setData(d) { Object.assign(this.data, d); } };
  return new AmbientEncounterManager({ THREE, scene, camera, globeGroup, renderer: { capabilities: { getMaxAnisotropy: () => 8 } }, page, random });
}
const base = { page: { data: {} }, touch: {}, ready: true };
assert.equal(ambientBrowseState(base).blocked, false);
for (const flag of ['zen', 'moon', 'saturn', 'transitioning']) assert.equal(ambientBrowseState({ ...base, [flag]: true }).blocked, true);
for (const flag of ['loading', 'zenMode', 'moonVoyageActive', 'saturnPreviewActive']) {
  assert.equal(ambientBrowseState({ ...base, page: { data: { [flag]: true } } }).blocked, true, flag);
}
for (const flag of ['searchOpen', 'settingsOpen', 'countryPanelOpen']) {
  const state = ambientBrowseState({ ...base, page: { data: { [flag]: true } } });
  assert.equal(state.blocked, false, flag + ' must not terminate the craft');
  assert.equal(state.covered, true);
}
assert.equal(ambientBrowseState({ ...base, ready: false }).blocked, true);
for (const touch of [{ isDragging: true }, { pinch: true }, { velY: .01 }]) assert.equal(ambientBrowseState({ ...base, touch }).busy, true);
assert.equal(ambientBrowseState({ ...base, flying: true }).busy, true);

let now = 0;
function seed(m) { for (const key of Object.keys(AMBIENT_CRAFT)) m.models[key] = new THREE.Group(); m.activateModel(m.nextKey); }
const m = manager(); seed(m);
function step(seconds, state = idle) { for (let i = 0; i < seconds * 10; i++) { now += 100; m.update(now, state); } }
m.update(0, idle);
step(1); assert.equal(m.root.visible, false);
step(1.2, { blocked: false, busy: true }); assert(m.pass, 'first appearance does not wait for continuous quiet'); assert.equal(m.pass.duration, 50); assert.equal(m.pass.side, -1);
assert.equal(m.pass.route, 'wide');
const pass = m.pass; step(2, { blocked: false, busy: true }); assert.equal(m.pass, pass, 'dragging does not pop away a visible craft');
assert(Number.isFinite(m.root.position.length()));
step(.1, { blocked: true, busy: false }); assert.equal(m.root.visible, false); assert.equal(m.wait, 90);
step(30, { blocked: true, busy: false }); assert.equal(m.wait, 90, 'other modes do not consume the cooldown');
step(89.9); assert.equal(m.pass, null);
step(.2); assert(m.pass);
const beforeStall = m.pass, beforeElapsed = m.pass.elapsed;
now += 1700; m.update(now, idle); assert.equal(m.pass, beforeStall, 'a slow blank-click frame must not finish the craft');
assert(Math.abs(m.pass.elapsed - beforeElapsed - .1) < .001, 'resume smoothly after a foreground stall');
m.page.setData({ ambientName: 'selected' });
step(.2, { ...idle, covered: true }); assert.equal(m.pass, beforeStall, 'country/search/settings panels cannot terminate an active orbit');
assert.equal(m.page.data.ambientName, '', 'panel interaction only clears identification');
m.pause(); assert.equal(m.root.visible, false, 'real onHide pause still ends the encounter'); assert.equal(m.wait, 90); assert.equal(m.lastTime, null); assert.equal(m.quiet, 0);
m.dispose(); assert.equal(m.root.parent, null);
const high = manager(() => 1); assert.equal(high.wait, 5); seed(high);
high.update(0, idle); for (let t = 100; t <= 5500; t += 100) high.update(t, idle);
assert.equal(high.pass.duration, 65); assert.equal(high.pass.side, 1); assert.equal(high.pass.size, .36);
assert.equal(high.pass.route, 'front');
high.pause(); assert.equal(high.wait, 150); high.dispose();

// Check what the viewer actually sees: a long, wide arc, with natural globe
// occlusion at both ends and a real foreground pass on the occasional route.
const view = manager(), eye = view.camera.position, planet = view.globeGroup.position;
view.camera.updateMatrixWorld(true);
assert.equal(view.pickRoute(), 'wide');
view.random = () => .5; assert.equal(view.pickRoute(), 'back');
view.random = () => .8; assert.equal(view.pickRoute(), 'front');
const isHidden = point => {
  const direction = point.clone().sub(eye), distance = direction.length(); direction.normalize();
  const offset = eye.clone().sub(planet), b = offset.dot(direction), discriminant = b * b - offset.lengthSq() + 1;
  return discriminant >= 0 && -b - Math.sqrt(discriminant) < distance;
};
for (const route of ['wide', 'back', 'front']) for (const side of [-1, 1]) for (const height of [-.06, .14]) {
  const pass = { route, side, height }, visible = [];
  for (let i = 0; i <= 200; i++) {
    const point = ambientOrbitPoint(new THREE.Vector3(), pass, i / 200).add(planet);
    const projected = point.clone().project(view.camera);
    if (route !== 'wide') assert(Math.abs(projected.x) < .95 && projected.y < .8, 'the route stays inside the sky composition');
    if (i === 0 || i === 200 && route !== 'wide') assert(isHidden(point), 'closed loops start and finish behind the globe');
    if (i === 200 && route === 'wide') assert(Math.abs(projected.x) > 1.3, 'open arc is already offscreen before it ends');
    if (!isHidden(point) && Math.abs(projected.x) < 1 && projected.y < .8) visible.push(projected);
  }
  assert(visible.length / 201 * 50 >= 28, 'at least 28 seconds visibly in frame at the shortest duration');
  if (route !== 'front') {
    assert(Math.max(...visible.map(p => p.x)) - Math.min(...visible.map(p => p.x)) > 1.5, 'sweep spans over three quarters of the screen');
    const middle = ambientOrbitPoint(new THREE.Vector3(), pass, .5).add(planet).project(view.camera);
    assert(middle.y > visible[0].y + .25, 'a broad curved sweep, not a straight side exit');
  } else {
    const middle = ambientOrbitPoint(new THREE.Vector3(), pass, .5).add(planet);
    assert(middle.z > 1 && !isHidden(middle), 'foreground path passes between Earth and the viewer');
  }
}
view.dispose();

// Randomly tilted, wider/nearer variants still give a long readable encounter.
const variants = manager(); variants.camera.updateMatrixWorld(true);
for (const route of ['wide', 'back', 'front']) for (const side of [-1, 1])
for (const height of [-.06, .14]) for (const span of [.92, 1.06])
for (const depth of [.85, 1.1]) for (const tilt of [-.1, .1]) {
  let seen = 0;
  for (let i = 0; i <= 200; i++) {
    const p = ambientOrbitPoint(new THREE.Vector3(), { route, side, height, span, depth, tilt }, i / 200).add(planet);
    const projected = p.clone().project(variants.camera);
    assert(p.distanceTo(planet) > 1.4, 'random variants remain outside the globe');
    if (!isHidden(p) && Math.abs(projected.x) < 1 && projected.y < .8) seen++;
    if (i === 0 || i === 200 && route !== 'wide') assert(isHidden(p), 'random closed loops are hidden at their endpoints');
  }
  assert(seen / 201 * 50 > 28, 'shortest randomly varied encounter stays visible for at least 28 seconds');
}
// Worst-case initial hidden approach plus the five-second initial wait stays below 20 seconds.
for (const route of ['wide', 'back', 'front']) for (const side of [-1, 1]) for (const height of [-.06, .14]) for (const span of [.92, 1.06]) for (const depth of [.85, 1.1]) for (const tilt of [-.1, .1]) {
  let first = 1;
  for (let i = 0; i <= 400; i++) {
    const p = ambientOrbitPoint(new THREE.Vector3(), { route, side, height, span, depth, tilt }, i / 400).add(planet), projected = p.clone().project(variants.camera);
    if (!isHidden(p) && Math.abs(projected.x) < 1 && projected.y < .8) { first = i / 400; break; }
  }
  assert(5 + 65 * first < 20, 'first visible sweep reaches the sky within 20 seconds once Earth is ready');
}
for (const previous of Object.keys(AMBIENT_CRAFT)) {
  variants.lastKey = previous;
  for (const value of [0, .5, 1]) { variants.random = () => value; assert.notEqual(variants.pickCraft(), previous, 'no immediate repeat'); }
}
for (const value of [0, .5, 1]) {
  const browsing = manager(() => value); seed(browsing); browsing.update(0, { ...idle, busy: true });
  let firstSeen = null;
  for (let time = 100; time <= 20000; time += 100) {
    const covered = time % 3000 < 1600;
    browsing.update(time, { ...idle, busy: true, covered });
    if (!browsing.pass) continue;
    const point = browsing.root.position, projected = point.clone().project(browsing.camera);
    if (!isHidden(point) && Math.abs(projected.x) < 1 && projected.y < .8) { firstSeen = time; break; }
  }
  assert(firstSeen !== null && firstSeen <= 20000, 'active browsing and panels do not postpone the first visible craft');
  browsing.dispose();
}
variants.dispose();

const complete = manager(() => .5); seed(complete);
let frameTime = 0; complete.update(frameTime, idle);
while (!complete.pass && frameTime < 40000) { frameTime += 100; complete.update(frameTime, idle); }
assert(complete.pass && complete.pass.route === 'back');
const cachedModel = complete.model, duration = complete.pass.duration, startedAt = frameTime;
while (complete.pass && frameTime - startedAt < 70000) { frameTime += 100; complete.update(frameTime, idle); }
assert(Math.abs((frameTime - startedAt) / 1000 - duration) < .2, 'normal frame updates keep the complete long encounter');
assert.equal(complete.root.visible, false); assert.equal(complete.wait, 120);
assert.equal(complete.model, cachedModel, 'completed orbit retains the loaded model for reuse'); complete.dispose();

// Exercise the input boundary: spacecraft taps consume country picking;
// empty-space taps and dragging keep their original behavior.
let countryTaps = 0, craftTaps = 0, consume = true, gestureReleases = 0;
const { createInputManager } = load('input-manager.js', ['createInputManager'], {
  createGestureManager: () => ({ onTouchStart() {}, onTouchMove() {}, onTouchEndRelease() { gestureReleases++; } }),
  SelectionManager: class { tap() { countryTaps++; return null; } },
  TAP_MAX_MOVE_PX: 8, TAP_MAX_DURATION_MS: 300
});
const touch = { downTime: Date.now(), downX: 30, lastX: 30, downY: 40, lastY: 40 };
const input = createInputManager({ touch, width: 390, height: 720, onAmbientTap: point => { craftTaps++; assert.equal(point.downX, 30); return consume; } });
input.onTouchEnd(); assert.equal(craftTaps, 1); assert.equal(countryTaps, 0);
consume = false; input.onTouchEnd(); assert.equal(countryTaps, 1);
touch.lastX = 100; input.onTouchEnd(); assert.equal(craftTaps, 2); assert.equal(countryTaps, 1); assert.equal(gestureReleases, 3);

for (const key of ['juno', 'magellan']) {
  const pack = path.resolve('miniprogram', key + '-assets'), meta = require(path.join(pack, 'model.js'));
  const bytes = fs.readFileSync(path.join(pack, 'geometry.bin'));
  const maps = meta.images.map(() => new THREE.Texture());
  const model = buildChandra(THREE, meta, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), maps);
  const report = JSON.parse(fs.readFileSync(path.join(pack, 'build-report.json')));
  let triangles = 0, calls = 0;
  model.traverse(o => { if (o.isMesh) { triangles += o.geometry.index.count / 3; calls++; assert(o.material.depthWrite); } });
  assert.equal(triangles, report.triangles); assert.equal(calls, report.drawCalls);
  assert(fs.readdirSync(pack).reduce((sum, name) => sum + fs.statSync(path.join(pack, name)).size, 0) < 2 * 1024 * 1024);
  releaseChandra(model);
}

const flush = () => new Promise(resolve => setImmediate(resolve));
function texture() { const t = new THREE.Texture(); t.disposals = 0; t.addEventListener('dispose', () => t.disposals++); return t; }
(async () => {
  const a = manager(); a.preload(); a.preload(); assert.equal(packages.length, 1);
  a.dispose(); packages.shift().resolve(data); await flush(); assert.equal(requests.length, 0, 'no texture load after teardown');
  const b = manager(); b.preload(); packages.shift().resolve(data); await flush(); assert.equal(requests.length, 3);
  const abandoned = requests.splice(0); b.dispose();
  const late = abandoned.map(r => { const t = texture(); r.done(t); return t; }); await flush();
  assert(late.every(t => t.disposals === 1)); assert.equal(b.root.parent, null);
  const c = manager(); c.preload(); packages.shift().resolve(data); await flush();
  const failed = requests.splice(0); failed[0].fail(new Error('test failure')); await flush();
  for (const r of failed.slice(1)) { const t = texture(); r.done(t); assert.equal(t.disposals, 1); }
  assert.equal(c.wait, 90); c.dispose();
  const d = manager(); d.preload(); packages.shift().resolve(data); await flush();
  const maps = requests.splice(0).map(r => { const t = texture(); r.done(t); return t; }); await flush();
  assert(d.model); assert.equal(d.root.children.length, 1); d.preload(); assert.equal(packages.length, 0);
  const box = new THREE.Box3().setFromObject(d.model), size = box.getSize(new THREE.Vector3());
  assert(Math.abs(Math.max(size.x, size.y, size.z) - 1) < .00001);
  const geometries = new Set(), materials = new Set(); let triangles = 0;
  d.root.traverse(o => { if (o.isMesh) { geometries.add(o.geometry); materials.add(o.material); triangles += o.geometry.index.count / 3; assert.equal(o.material.depthWrite, true); assert.equal(o.material.transparent, false); } });
  assert.equal(triangles, 30132); assert.equal(geometries.size, 6);
  for (const material of materials) {
    if (material.type !== 'MeshPhongMaterial') continue;
    const linear = { fragmentShader: THREE.ShaderLib.phong.fragmentShader };
    material.onBeforeCompile(linear, { outputEncoding: THREE.LinearEncoding });
    assert(linear.fragmentShader.includes('LinearTosRGB( gl_FragColor )'), 'local r108 color output');
    const srgb = { fragmentShader: THREE.ShaderLib.phong.fragmentShader };
    material.onBeforeCompile(srgb, { outputEncoding: THREE.sRGBEncoding });
    assert.equal(srgb.fragmentShader, THREE.ShaderLib.phong.fragmentShader, 'avoid double conversion');
  }
  assert(maps.every(t => t.anisotropy === 4 && t.flipY === false));
  const cameraPosition = d.camera.position.clone(), cameraRotation = d.camera.quaternion.clone();
  for (const route of ['wide', 'back', 'front']) for (const side of [-1, 1]) for (let i = 0; i <= 20; i++) {
    const q = i / 20;
    d.pass = { elapsed: q * 46, duration: 46, side, route, height: -.04, size: .36, roll: -.18 };
    d.place(); d.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(d.root), center = d.globeGroup.getWorldPosition(new THREE.Vector3());
    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
    assert(d.root.position.distanceTo(center) - radius > 1, 'the hull never penetrates Earth');
    const projected = [];
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) projected.push(new THREE.Vector3(x, y, z).project(d.camera));
    const width = Math.max(...projected.map(p => p.x)) - Math.min(...projected.map(p => p.x));
    const height = Math.max(...projected.map(p => p.y)) - Math.min(...projected.map(p => p.y));
    assert(width * d.camera.aspect > height, 'broad solar-panel silhouette stays readable');
    if (q < .001 || q > .999 && route !== 'wide') {
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        assert(isHidden(new THREE.Vector3(x, y, z)), 'the entire hull is hidden before the loop ends');
      }
    }
  }
  assert(d.camera.position.equals(cameraPosition) && d.camera.quaternion.equals(cameraRotation), 'all routes preserve the user camera');
  d.root.visible = true;
  d.loadedKey = 'chandra';
  d.pass = { key: 'chandra', route: 'front', elapsed: 25, duration: 50, side: 1, height: .04, size: .36, roll: 0, spin: .009 };
  d.place(); d.root.updateMatrixWorld(true);
  let hitPoint = null;
  for (let x = 130; x < 265 && !hitPoint; x += 2) for (let y = 150; y < 330; y += 2) {
    if (d.tap({ downX: x, downY: y, width: 390, height: 720 })) { hitPoint = { downX: x, downY: y, width: 390, height: 720 }; break; }
  }
  assert(hitPoint, 'visible craft has a forgiving tappable mesh');
  assert.equal(d.page.data.ambientName, '钱德拉');
  assert.equal(d.page.data.ambientDescription, 'X 射线太空望远镜');
  d.page.data.lang = 'en'; assert(d.tap(hitPoint)); assert.equal(d.page.data.ambientName, 'Chandra');
  assert.equal(d.tap({ downX: 0, downY: 0, width: 390, height: 720 }), false);
  assert.equal(d.page.data.ambientName, '', 'a miss clears the label and allows ordinary Earth selection');
  const passOnMiss = d.pass; d.lastTime = 1000; d.update(2900, idle); assert.equal(d.pass, passOnMiss); assert(d.root.visible, 'blank-space tap plus a slow frame leaves the model flying');
  d.pass.elapsed = 0; d.place(); d.root.updateMatrixWorld(true);
  const hidden = d.root.position.clone().project(d.camera);
  assert.equal(d.tap({ downX: (hidden.x + 1) / 2 * 390, downY: (1 - hidden.y) / 2 * 720, width: 390, height: 720 }), false, 'Earth-occluded craft cannot intercept taps');
  d.pass.elapsed = 25; d.pass.spin = -.018; d.place(); const orientation = d.model.quaternion.clone(), position = d.root.position.clone();
  d.pass.elapsed += 5; d.place(); assert(orientation.angleTo(d.model.quaternion) > .08, 'the hull rotates independently at a readable slow rate');
  assert(!d.root.position.equals(position), 'self spin and orbital travel continue together');
  assert(Math.abs(d.model.rotation.y - d.pass.elapsed * d.pass.spin) < .00001, 'spin cannot be cancelled by the orbital pose');
  let released = 0; [...geometries, ...materials].forEach(o => o.addEventListener('dispose', () => released++));
  d.dispose(); d.dispose(); assert.equal(released, geometries.size + materials.size); assert(maps.every(t => t.disposals === 1));
  const app = JSON.parse(fs.readFileSync('miniprogram/app.json')); assert(app.subpackages.some(p => p.root === 'chandra-assets'));
  const folder = path.resolve('miniprogram/chandra-assets');
  assert(fs.readdirSync(folder).reduce((sum, name) => sum + fs.statSync(path.join(folder, name)).size, 0) < 2 * 1024 * 1024);
  console.log('Ambient spacecraft: random quiet scheduling, mode/interaction gates, native geometry and async disposal PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
