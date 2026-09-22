const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadZenPoetry() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'zen-poetry.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^import.*$/gm, '');
  source = source.replace(/export async function /g, 'async function ');
  source = source.replace(/export function /g, 'function ');
  source += '\nmodule.exports = { playPoetry, resolvePresetForLang, resolveNextPreset, getPresetIdsForLang, resolvePresetLabel };';

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console: { info() {}, log() {}, warn() {} },
    Number,
    String,
    Object,
    Array,
    Math,
    Promise
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.module.exports;
}

function loadAudioPresetResolver() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'zen-audio.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace('export class ZenAudio', 'class ZenAudio');
  source = source.replace(/export function /g, 'function ');
  source = source.replace(/export const /g, 'const ');
  source += '\nmodule.exports = { resolveAudioPresetForLang };';

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Set,
    Number,
    Math
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.module.exports.resolveAudioPresetForLang;
}

function testTrackSequenceUsesEnglishLyricsForTracksTwoAndThree() {
  const poetry = loadZenPoetry();
  const page = {};

  assert.deepEqual(Array.from(poetry.getPresetIdsForLang(false)), [1, 102, 103]);
  assert.deepEqual(Array.from(poetry.getPresetIdsForLang(true)), [101, 102, 103]);
  assert.equal(poetry.resolvePresetForLang(page, 2, false), 102);
  assert.equal(poetry.resolvePresetForLang(page, 3, false), 103);
  assert.equal(poetry.resolveNextPreset(page, 1, false), 102);
  assert.equal(poetry.resolveNextPreset(page, 102, false), 103);
  assert.equal(poetry.resolveNextPreset(page, 103, false), 1);
  assert.equal(poetry.resolveNextPreset(page, 101, true), 102);
  assert.equal(poetry.resolveNextPreset(page, 102, true), 103);
  assert.equal(poetry.resolveNextPreset(page, 103, true), 101);
}

function testCanonicalEnglishTrackNamesIgnoreInterfaceLanguage() {
  const poetry = loadZenPoetry();
  const labels = { 2: '君情深几许', 3: '冲破黑暗', 102: 'HOW DEEP IS YOUR LOVE', 103: 'OUT OF DARKNESS' };

  assert.equal(poetry.resolvePresetLabel(labels, 102, false), 'How Deep Is Your Love');
  assert.equal(poetry.resolvePresetLabel(labels, 103, false), 'Out of Darkness');
  assert.equal(poetry.resolvePresetLabel(labels, 102, true), 'How Deep Is Your Love');
  assert.equal(poetry.resolvePresetLabel(labels, 103, true), 'Out of Darkness');
}

function testEnglishLyricPresetStillUsesPhysicalAudioTracks() {
  const resolveAudioPreset = loadAudioPresetResolver();

  assert.equal(resolveAudioPreset(102, false), 2);
  assert.equal(resolveAudioPreset(103, false), 3);
  assert.equal(resolveAudioPreset(102, true), 2);
  assert.equal(resolveAudioPreset(103, true), 3);
}

async function testChineseLyricsRemainStoredButEnglishLyricsAreSelected() {
  const poetry = loadZenPoetry();
  const chineseLines = [{ text: '君情深几许', duration: 5000 }];
  const englishLines = [{ text: 'How deep is your love, I really mean to learn', duration: 5000 }];
  let started = null;
  const page = {
    data: { lang: 'zh' },
    __poetryPresets: { 2: chineseLines, 102: englishLines },
    __getPoetryMgr: () => ({
      start(preset, map) { started = { preset, map }; }
    })
  };

  await poetry.playPoetry(page, 102, 0);

  assert.equal(started.preset, 102);
  assert.match(started.map[102][0].text, /\n/);
  assert.equal(page.__poetryPresets[2][0].text, '君情深几许', '中文版仍原样保留');
  assert.equal(page.__poetryPresets[102][0].text, englishLines[0].text, '英文原数据不应被格式化流程改写');
}

(async () => {
  testTrackSequenceUsesEnglishLyricsForTracksTwoAndThree();
  testCanonicalEnglishTrackNamesIgnoreInterfaceLanguage();
  testEnglishLyricPresetStillUsesPhysicalAudioTracks();
  await testChineseLyricsRemainStoredButEnglishLyricsAreSelected();
  console.log('zen English-only track tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
