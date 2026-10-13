const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPoetryManager() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'poetry-manager.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^import.*$/gm, '');
  source = source.replace('export class PoetryManager', 'class PoetryManager');
  source += '\nmodule.exports = { PoetryManager };';

  let nextTimer = 1;
  const timers = new Map();
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console: { info() {}, log() {}, warn() {}, table() {} },
    Date,
    Math,
    Number,
    Array,
    String,
    Object,
    Promise,
    setTimeout(fn, delay) {
      const id = nextTimer++;
      timers.set(id, { fn, delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    computeStartNearCenter() { return { x: 0, y: 0 }; },
    computeMove() { return { tx: 0, ty: 0, endX: 0, endY: 0 }; },
    nearbyFrom() { return { x: 0, y: 0 }; },
    placePoetryAvoidingOverlap(start, w, h, move) { return {start, move, fits:true}; }
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return { PoetryManager: sandbox.module.exports.PoetryManager, timers };
}

async function buildTimeline(lines, { preset = 2, lang = 'zh' } = {}) {
  const { PoetryManager, timers } = loadPoetryManager();
  const updates = [];
  const manager = new PoetryManager({
    appCfg: {
      poetry: {
        fadeInMs: 1200,
        fadeOutMs: 1200,
        leadInMs: 1200,
        displayMs: 7000,
        preferLineDuration: true,
        crossfadeMs: 800,
        use3D: false
      }
    },
    getViewport: () => ({ windowWidth: 390, windowHeight: 844 }),
    getCanvasRect: () => ({ top: 0, height: 844 }),
    getLang: () => lang,
    setData(update) { updates.push(update); }
  });
  await manager.start(preset, { [preset]: lines }, 0);
  return { manager, timers, updates };
}

async function testTimestampedLyricsLeadInWithoutShorteningCueDuration() {
  const { manager, timers } = await buildTimeline([
    { text: '第一句', duration: 5000, 'start-time': 3000 },
    { text: '第二句', duration: 4000, 'start-time': 9000 }
  ]);

  assert.equal(manager._timeline[0].cueStart, 3000);
  assert.equal(manager._timeline[0].tStart, 1800, 'lyric fade should start 1.2s before its cue');
  assert.equal(manager._timeline[0].tEnd, 8000, 'lead-in must not make the lyric end early');
  assert.equal(manager._timeline[0].visibleDur, 6200);
  assert.equal([...timers.values()].some(timer => timer.delay <= 1800 && timer.delay >= 1750), true);
}

async function testLeadInIsClampedAtAudioStart() {
  const { manager } = await buildTimeline([
    { text: '开场', duration: 5000, 'start-time': 600 }
  ]);

  assert.equal(manager._timeline[0].tStart, 0);
  assert.equal(manager._timeline[0].tEnd, 5600);
  assert.equal(manager._timeline[0].visibleDur, 5600);
}

async function testUntimedPoetryStillStartsWithAudio() {
  const { manager, timers } = await buildTimeline([
    { text: '无时间戳诗句', duration: 7000 }
  ]);

  assert.equal(manager._timeline[0].tStart, 0);
  assert.equal([...timers.values()].some(timer => timer.delay === 0), true);
}

async function testEnglishPresetUsesHorizontalLayoutInChineseInterface() {
  const { updates } = await buildTimeline([
    { text: 'How deep is your love', duration: 5000, 'start-time': 3000 }
  ], { preset: 102, lang: 'zh' });

  assert.equal(updates.some(update => update.poetryHorizontal === true), true);
}

async function testEarlierEnglishFadeKeepsMotionAndChineseEnd() {
  for (const preset of [2, 102, 103]) {
    const {manager,timers,updates}=await buildTimeline([
      {text:'First lyric',duration:5000,'start-time':3000}
    ],{preset});
    let subtitleEnds=0;
    manager._subtitle={prepare:()=>({}),show:()=>({}),hide:()=>{subtitleEnds++;return {'zenChineseA.visible':false};},stop:()=>{}};
    const showing=manager._showLineOn(true,'First lyric',6200);
    // Complete the original measure + two animation-frame preparation stages.
    for (let step=0;step<2;step++) {
      await Promise.resolve();await Promise.resolve();
      const frame=[...timers].find(([,t])=>t.delay===16);
      assert.ok(frame);timers.delete(frame[0]);frame[1].fn();
    }
    await showing;
    assert.ok(updates.some(p=>p['poetryA.moveMs']===7000),'Original movement duration remains 6200 + crossfade 800');
    const fade=[...timers].find(([,t])=>t.delay===(preset===2?6200:5200));
    assert.ok(fade);timers.delete(fade[0]);fade[1].fn();
    assert.equal(updates.at(-1)['poetryA.visible'],false);
    assert.equal(updates.at(-1)['poetryA.fadeMs'],1200,'Original fade duration remains unchanged');
    if(preset===2) assert.equal(subtitleEnds,1,'Other poetry keeps its original end');
    else {
      assert.equal(subtitleEnds,0,'Chinese does not inherit the earlier English end');
      const chineseEnd=[...timers].find(([,t])=>t.delay===6200);
      assert.ok(chineseEnd);chineseEnd[1].fn();assert.equal(subtitleEnds,1);
    }
  }
}

(async () => {
  await testTimestampedLyricsLeadInWithoutShorteningCueDuration();
  await testLeadInIsClampedAtAudioStart();
  await testUntimedPoetryStillStartsWithAudio();
  await testEnglishPresetUsesHorizontalLayoutInChineseInterface();
  await testEarlierEnglishFadeKeepsMotionAndChineseEnd();
  console.log('poetry timing tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
