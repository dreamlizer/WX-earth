const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadLabelsWorkset() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'labels-workset.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/export\s+/g, '');
  source += '\nmodule.exports = { createLabelFrameWorkset, resetLabelFrameWorkset, nextLabelCandidate, copyForcedCodes };';

  const sandbox = {
    module: { exports: {} },
    exports: {},
    Set,
    Array,
    String,
    Math
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.module.exports;
}

function testResetReusesContainers() {
  const { createLabelFrameWorkset, resetLabelFrameWorkset } = loadLabelsWorkset();
  const ws = createLabelFrameWorkset();
  const candidates = ws.candidates;
  const winners = ws.winners;

  ws.candidates.push({ id: 'A' });
  ws.countryCands.push({ id: 'B' });
  ws.winners.add('A');
  ws.forcedCodesSet.add('US');

  resetLabelFrameWorkset(ws);

  assert.strictEqual(ws.candidates, candidates, 'candidate array should be reused');
  assert.strictEqual(ws.winners, winners, 'winner set should be reused');
  assert.strictEqual(ws.candidates.length, 0, 'candidate array should be cleared');
  assert.strictEqual(ws.countryCands.length, 0, 'country array should be cleared');
  assert.strictEqual(ws.winners.size, 0, 'winner set should be cleared');
  assert.strictEqual(ws.forcedCodesSet.size, 0, 'forced code set should be cleared');
}

function testCandidateObjectsAreReusedAcrossFrames() {
  const { createLabelFrameWorkset, resetLabelFrameWorkset, nextLabelCandidate } = loadLabelsWorkset();
  const ws = createLabelFrameWorkset();

  const first = nextLabelCandidate(ws);
  first.id = 'A';
  first.score = 10;

  resetLabelFrameWorkset(ws);
  const second = nextLabelCandidate(ws);

  assert.strictEqual(second, first, 'candidate object should be reused after reset');
  assert.strictEqual(second.id, null, 'candidate fields should be reset before reuse');
  assert.strictEqual(second.score, 0, 'candidate score should be reset before reuse');
}

function testCopyForcedCodesNormalizesAndReusesSet() {
  const { createLabelFrameWorkset, copyForcedCodes } = loadLabelsWorkset();
  const ws = createLabelFrameWorkset();
  const setRef = ws.forcedCodesSet;

  copyForcedCodes(ws, new Set(['us', '', 'cn']), 'jp');

  assert.strictEqual(ws.forcedCodesSet, setRef, 'forced code set should be reused');
  assert.deepStrictEqual([...ws.forcedCodesSet].sort(), ['CN', 'JP', 'US']);
}

testResetReusesContainers();
testCandidateObjectsAreReusedAcrossFrames();
testCopyForcedCodesNormalizesAndReusesSet();
console.log('labels-workset policy tests passed');
