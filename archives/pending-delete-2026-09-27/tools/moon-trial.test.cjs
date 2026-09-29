const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createScopedThreejs } = require('../miniprogram/node_modules/threejs-miniprogram');

function load(file, names, dependencies = {}) {
  const filename = path.join(__dirname, '../miniprogram/pages/gl', file);
  const source = fs.readFileSync(filename, 'utf8')
    .replace(/^import[\s\S]*?;\s*$/gm, '')
    .replace(/export (class|function|const) /g, '$1 ');
  const context = { module: { exports: {} }, console, setTimeout, clearTimeout, ...dependencies };
  vm.runInNewContext(source + `\nmodule.exports = { ${names} };`, context, { filename });
  return context.module.exports;
}

function testRouteExclusion() {
  const { AppEngine } = load('app-engine.js', 'AppEngine', {
    APP_CFG: {}, getSystemInfo: () => ({}), createTouchState: () => ({}), TWEEN: {}
  });
  const engine = new AppEngine();
  let originalEntries = 0;
  let trialEntries = 0;
  engine.state = { page: { data: { zenMode: true } } };
  engine.moonMgr = { _entering: false, _exiting: false, isActive: () => false,
    enter() { originalEntries++; } };
  engine.moonTrial = { isActive: () => false, enter() { trialEntries++; } };
  assert.equal(typeof engine.enterMoonTrial, 'function', 'engine must expose the parallel trial entry');
  for (const flag of ['_entering', '_exiting']) {
    engine.moonMgr[flag] = true;
    engine.enterMoonTrial();
    assert.equal(trialEntries, 0, 'original loading/exit must exclude the trial');
    engine.moonMgr[flag] = false;
  }
  engine.moonMgr.isActive = () => true;
  engine.enterMoonTrial();
  assert.equal(trialEntries, 0);
  engine.moonMgr.isActive = () => false;
  engine.enterMoonTrial();
  assert.equal(trialEntries, 1);
  engine.moonTrial.isActive = () => true;
  engine.enterMoonVoyage();
  assert.equal(originalEntries, 0, 'trial loading/playback must exclude the original');
  assert.equal(engine.isMoonVoyageActive(), true, 'trial must lock ordinary globe interactions');
  let exited = 0;
  let resumed = 0;
  engine.moonTrial.exit = (updatePage, resume) => {
    assert.equal(updatePage, true);
    assert.equal(resume, false, 'background cancellation must not resume audio');
    exited++;
  };
  engine.moonTrial.resumeZen = () => { resumed++; };
  engine.setPaused(true);
  assert.equal(exited, 1, 'backgrounding must cancel the trial before pausing rendering');
  engine.setPaused(false);
  assert.equal(resumed, 1, 'foregrounding must restore deferred zen state');
}

async function testTrialLifecycle() {
  const views = [];
  let audioTime = 0;
  let resumed = 0;
  let suspended = 0;
  const poetryRestores = [];
  const { MoonTrial } = load('moon-trial.js', 'MoonTrial', {
    createMoonTrialScene() {
      let resolve, reject;
      const ready = new Promise((ok, fail) => { resolve = ok; reject = fail; });
      const view = { ready, resolve, reject, disposeCount: 0, samples: [],
        update(t) { this.samples.push(t); }, render() {},
        dispose() { this.disposeCount++; } };
      views.push(view);
      return view;
    }, APP_CFG: {},
    playPoetry(...args) { poetryRestores.push(args); }
  });
  const original = { zenMode: true, currentPreset: 103, poetryA: { text: 'kept' } };
  const page = { data: { ...original }, __zenPreset: 103, writes: 0,
    setData(updates) { this.writes++; Object.assign(this.data, updates); },
    __getZenModeMgr: () => ({ closeList() {} }),
    __getZenMgr: () => ({ suspend() { suspended++; }, resume() { resumed++; } }),
    __getPoetryMgr: () => ({ getIndex: () => 7, stop() {} }), showMoonToast() {} };
  const trial = new MoonTrial({}, page, class { start() { return Promise.resolve(); } getTime() { return audioTime; } getDuration() { return 270; } fadeOut() {} dispose() {} });
  const pending = trial.enter();
  assert.equal(trial.isActive(), true, 'loading must own the lock immediately');
  await trial.enter();
  assert.equal(views.length, 1, 'repeated tap must not allocate another scene');
  trial.exit();
  views[0].resolve();
  await pending;
  assert.equal(trial.isActive(), false, 'late texture completion cannot revive cancelled trial');
  assert.equal(views[0].disposeCount, 1);

  const second = trial.enter();
  views[1].resolve();
  await second;
  trial.render({}, 0.46, 1000);
  trial.lyrics = [
    { text: 'first', 'start-time': 1000, duration: 3000 },
    { text: 'second', 'start-time': 3000, duration: 3000 }
  ];
  trial.updateLyrics(3.5);
  assert.equal(page.data.trialLyric, 'second', 'overlapping cues show only the newest line');
  trial.updateLyrics(2);
  assert.equal(page.data.trialLyric, 'first', 'lyric selection follows audio seeking');
  trial.updateLyrics(7);
  assert.equal(page.data.trialLyric, '', 'lyric clears during a musical gap');
  audioTime = 5;
  trial.render({}, 0.46, 6000);
  assert.equal(views[1].samples.at(-1), 5);
  page.__isDevtools = true;
  trial.previewAt(245);
  trial.render({}, 0.46, 20000);
  assert.equal(views[1].samples.at(-1), 245, 'review jumps to the actual ending without waiting for audio');
  assert.equal(trial.isActive(), true, 'paused review must not trigger audio stall handling');
  trial.previewAt(null);
  page.__isDevtools = false;
  trial.previewAt(188);
  assert.equal(trial.previewTime, null, 'review controls are unavailable outside DevTools');
  audioTime = 104;
  trial.render({}, 0.46, 9000);
  assert.equal(trial.isActive(), true, 'old trial duration must not truncate the song');
  audioTime = 270;
  trial.render({}, 0.46, 11000);
  assert.equal(trial.isActive(), false, 'audio reaching the ending must return automatically');
  assert.equal(page.data.zenMode, true);
  assert.equal(page.data.currentPreset, 103);
  assert.equal(page.__zenPreset, 103);
  assert.equal(page.data.poetryA, original.poetryA, 'trial does not replace the running zen timeline');

  const failed = trial.enter();
  views[2].reject(new Error('texture failed'));
  await failed;
  assert.equal(trial.isActive(), false, 'load failure must release input and hide trial UI');
  assert.equal(page.data.moonTrialActive, false);
  const unloading = trial.enter();
  trial.dispose();
  const writes = page.writes;
  views[3].resolve();
  await unloading;
  assert.equal(page.writes, writes, 'unload must not publish late page updates');
  assert.equal(views[3].disposeCount, 1);
  assert.equal(suspended, 4);
  assert.equal(resumed, 3, 'unload must not resume zen audio');
  assert.equal(poetryRestores[0][1], 103);
  assert.equal(poetryRestores[0][2], 7, 'return resumes the saved poem');

  const backgroundTrial = new MoonTrial({}, page, class {
    start() { return Promise.resolve(); } getTime() { return 0; } fadeOut() {} dispose() {}
  });
  const backgroundEntry = backgroundTrial.enter();
  views[4].resolve();
  await backgroundEntry;
  backgroundTrial.exit(true, false);
  assert.equal(resumed, 3);
  backgroundTrial.resumeZen();
  backgroundTrial.resumeZen();
  assert.equal(resumed, 4, 'foreground restores a deferred session only once');

  const stalledEntry = backgroundTrial.enter();
  views[5].resolve();
  await stalledEntry;
  backgroundTrial.render({}, 0.46, 1000);
  backgroundTrial.render({}, 0.46, 16001);
  assert.equal(backgroundTrial.isActive(), false, 'stalled audio must release the locked scene');
}

function testRenderingIsolation() {
  const { createSceneUpdater } = load('scene-updater.js', 'createSceneUpdater');
  let trialFrames = 0;
  const forbidden = () => { throw new Error('original scene must not advance during trial'); };
  const updater = createSceneUpdater({ refs: {}, perfMonitor: { update: () => 0.016 },
    tweener: { update: forbidden }, lighting: { updateDirLight: forbidden },
    renderMoonTrial() { trialFrames++; return true; } });
  updater.update();
  assert.equal(trialFrames, 1);
}

async function testGeometryAndOwnership() {
  const images = [];
  const THREE = createScopedThreejs({ width: 390, height: 844,
    createImage() { const image = {}; images.push(image); return image; } });
  const { createMoonTrialScene } = load('moon-trial-scene.js', 'createMoonTrialScene', {
    fixTexture() {},
    SCORPIO_DATA: load('moon-voyage-zodiac-data.js', 'SCORPIO_DATA').SCORPIO_DATA,
    wx: { getFileSystemManager: () => ({ readFile({filePath, success}) {
      const bytes = fs.readFileSync(path.join(__dirname, '../miniprogram', filePath));
      success({data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength)});
    } }) }
  });
  const view = createMoonTrialScene(THREE, false);
  assert.equal(view.scene.background, null, 'transparent canvas background must preserve native page overlays');
  images.forEach(image => image.dispatchEvent({ type: 'load' }));
  await view.ready;
  const moon = view.scene.getObjectByName('TRIAL_MOON');
  const earth = view.scene.getObjectByName('TRIAL_EARTH');
  const sun = view.scene.getObjectByName('TRIAL_SUN');
  const ambient = view.scene.children.find(object => object.isAmbientLight);
  assert.ok(sun?.isDirectionalLight, 'Earth and Moon need a shared parallel sunlight source');
  assert.equal(sun.castShadow, false, 'surface day/night must not allocate a shadow-map pass');
  assert.ok(ambient.intensity / sun.intensity < 0.05, 'fill light must not erase the lunar night side');
  assert.ok(earth.material.isMeshLambertMaterial && moon.material.isMeshLambertMaterial,
    'both globes must respond to the same scene lighting');
  const sunlight = sun.position.clone().sub(sun.target.position).normalize();
  const originalSunPosition = sun.position.clone();
  const moonPhases = [];
  assert.equal(moon.material.transparent, false, 'occluder must write solid depth');
  assert.equal(moon.material.depthWrite, true);
  assert.equal(earth.material.depthTest, true);
  const originalEarthPosition = earth.position.clone();
  for (const aspect of [0.45, 0.5625, 1.78]) {
    const coverage = [];
    for (let t = 156; t <= 221; t += 0.4) {
      view.update(t, aspect);
      view.scene.updateMatrixWorld(true);
      view.camera.updateMatrixWorld(true);
      let blocked = 0, total = 0;
      const center = earth.position.clone().project(view.camera);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(view.camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(view.camera.quaternion);
      // Sample rays over the Earth's apparent disc, including partial occlusion.
      for (let x = -4; x <= 4; x++) for (let y = -4; y <= 4; y++) {
        if (x*x+y*y > 16) continue;
        const point = earth.position.clone().addScaledVector(right, x * 0.60).addScaledVector(up, y * 0.60);
        const direction = point.sub(view.camera.position).normalize();
        const ray = new THREE.Raycaster(view.camera.position, direction);
        if (ray.intersectObject(moon).length) blocked++;
        total++;
      }
      coverage.push(blocked / total);
      assert.ok(Math.abs(center.x) < 0.93 && Math.abs(center.y) < 0.85, 'Earth must stay framed');
      for (const side of [-1, 1]) {
        const edge = moon.position.clone().addScaledVector(right, side).project(view.camera);
        assert.ok(Math.abs(edge.x) < 0.98, 'Moon must stay inside the frame');
      }
      assert.ok(view.camera.position.distanceTo(moon.position) > 1.1, 'camera must not enter Moon');
    }
    assert.equal(coverage[0], 0, 'Earth is visible before crossing');
    assert.equal(coverage.at(-1), 0, 'Earth is visible after crossing');
    assert.ok(coverage.includes(1), 'Moon fully hides Earth');
    assert.ok(coverage.some(k => k > 0 && k < 1), 'edge produces partial occlusion, not a visibility toggle');
  }
  let previous = null;
  for (let t = 0; t <= 280; t += 0.1) {
    view.update(t, 0.5625);
    assert.ok(sun.position.equals(originalSunPosition), 'sunlight direction must not track the camera');
    const observer = view.camera.position.clone().sub(moon.position).normalize();
    moonPhases.push((1 + observer.dot(sunlight)) / 2);
    assert.ok(view.camera.position.distanceTo(moon.position) > 1.05, 'full journey never penetrates the Moon');
    assert.ok(view.camera.position.distanceTo(earth.position) > 0.95, 'departure never penetrates the Earth');
    if (previous) {
      assert.ok(previous.position.distanceTo(view.camera.position) < 0.4, 'no position jump at a shot boundary');
      assert.ok(previous.quaternion.angleTo(view.camera.quaternion) < 0.1, 'no sudden turn at a shot boundary');
    }
    previous = { position: view.camera.position.clone(), quaternion: view.camera.quaternion.clone() };
  }
  view.update(263, 0.5625);
  assert.ok(Math.max(...moonPhases) - Math.min(...moonPhases) > 0.2,
    'orbiting changes the visible lit fraction without rotating the Sun');
  const finalPhase = (1 + view.camera.position.clone().sub(moon.position).normalize().dot(sunlight)) / 2;
  assert.ok(finalPhase > 0.3 && finalPhase < 0.8, 'final Moon view retains both a lit region and a night region');
  view.camera.updateMatrixWorld(true);
  const finalDirection = earth.position.clone().sub(view.camera.position).normalize();
  assert.equal(new THREE.Raycaster(view.camera.position, finalDirection).intersectObject(moon).length, 0, 'Earth remains visible in the final horizon shot');
  assert.ok(earth.position.equals(originalEarthPosition), 'Earth must not follow the camera');
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(view.camera.quaternion);
  assert.ok(right.dot(sunlight) > 0.8, 'final screen-right receives sunlight');
  const screenEarth = earth.position.clone().project(view.camera);
  assert.ok(Math.abs(screenEarth.x) < 0.9 && Math.abs(screenEarth.y) < 0.9, 'final Earth is in frame');
  const edge = earth.position.clone().addScaledVector(right, 2.6).project(view.camera);
  const diameterCssPx = Math.abs(edge.x - screenEarth.x) * 390;
  assert.ok(diameterCssPx >= 48, `Earth must be legible on a phone, got ${diameterCssPx}px`);
  const heldPosition = view.camera.position.clone();
  const rotation = moon.rotation.y;
  view.update(280, 0.5625);
  assert.ok(view.camera.position.equals(heldPosition), 'ending holds its composition');
  assert.ok(moon.rotation.y > rotation, 'Moon rotates gently during the ending');
  assert.equal(view.scene.getObjectByName('TRIAL_LANDER'), undefined, 'refinement has no landing stage');
  let earthMaterialDisposed = 0;
  earth.material.addEventListener('dispose', () => earthMaterialDisposed++);
  const renderer = { autoClear: false, gammaOutput: false, gammaFactor: 2,
    setRenderTarget() {}, render() {
      assert.equal(this.gammaOutput, true);
      assert.equal(this.gammaFactor, 2.2);
      throw new Error('GPU failure');
    } };
  assert.throws(() => view.render(renderer), /GPU failure/);
  assert.equal(renderer.gammaOutput, false, 'original renderer colour state must be restored even on failure');
  assert.equal(renderer.gammaFactor, 2);
  assert.equal(renderer.autoClear, false);
  let disposed = 0;
  earth.material.map.addEventListener('dispose', () => disposed++);
  view.dispose();
  view.dispose();
  assert.equal(disposed, 1, 'trial releases each owned texture once');
  assert.equal(earthMaterialDisposed, 1, 'shared far/local Earth material is released once');

  const pendingView = createMoonTrialScene(THREE, false);
  const cancelled = assert.rejects(pendingView.ready, /取消/);
  pendingView.dispose();
  images.slice(-3).forEach(image => image.dispatchEvent({ type: 'load' }));
  await cancelled;
  assert.equal(pendingView.scene.getObjectByName('TRIAL_EARTH'), undefined);
}

(async () => {
  testRouteExclusion();
  testRenderingIsolation();
  await testTrialLifecycle();
  await testGeometryAndOwnership();
  console.log('moon trial tests passed: route exclusion, lifecycle, real Three.js occlusion, resource ownership');
})().catch(error => { console.error(error); process.exitCode = 1; });
