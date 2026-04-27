const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadRuntimeDiagnostics() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'runtime-diagnostics.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/export\s+function\s+/g, 'function ');
  source += '\nmodule.exports = { createRuntimeDiagnostics };';
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Math,
    Number,
    Date
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.module.exports;
}

function testDiagnosticsAreOffByDefault() {
  const { createRuntimeDiagnostics } = loadRuntimeDiagnostics();
  const logs = [];
  const diag = createRuntimeDiagnostics({
    APP_CFG: {},
    globalDataRef: () => ({}),
    logger: (payload) => logs.push(payload)
  });

  diag.recordFrame(1000, 0.05);
  diag.recordSpan('labels', 7);
  diag.recordTextureState({ ok: false, reason: 'missing-map' });
  diag.flush(7000);

  assert.strictEqual(diag.isEnabled(), false, 'diagnostics should be disabled by default');
  assert.strictEqual(logs.length, 0, 'disabled diagnostics should not log or retain samples');
}

function testDiagnosticsCanBeEnabledByGlobalFlag() {
  const { createRuntimeDiagnostics } = loadRuntimeDiagnostics();
  const logs = [];
  const diag = createRuntimeDiagnostics({
    APP_CFG: { diagnostics: { flushIntervalMs: 1000, slowFrameMs: 34 } },
    globalDataRef: () => ({ wxEarthDiagnostics: true }),
    logger: (payload) => logs.push(payload)
  });

  diag.recordFrame(1000, 0.05);
  diag.recordSpan('labels', 7);
  diag.recordSpan('markers', 3);
  diag.recordTextureState({ ok: false, reason: 'missing-map', action: 'rebind' });
  diag.flush(2100);

  assert.strictEqual(logs.length, 1, 'enabled diagnostics should emit one summary after the interval');
  assert.strictEqual(logs[0].frames, 1);
  assert.strictEqual(logs[0].slowFrames, 1);
  assert.strictEqual(logs[0].spans.labels.count, 1);
  assert.strictEqual(logs[0].spans.labels.maxMs, 7);
  assert.strictEqual(logs[0].spans.markers.maxMs, 3);
  assert.strictEqual(logs[0].texture.ok, false);
  assert.strictEqual(logs[0].texture.reason, 'missing-map');
  assert.strictEqual(logs[0].texture.action, 'rebind');
}

function testDiagnosticsResetCountersAfterFlush() {
  const { createRuntimeDiagnostics } = loadRuntimeDiagnostics();
  const logs = [];
  const diag = createRuntimeDiagnostics({
    APP_CFG: { diagnostics: { enabled: true, flushIntervalMs: 1000, slowFrameMs: 34 } },
    logger: (payload) => logs.push(payload)
  });

  diag.recordFrame(1000, 0.05);
  diag.flush(2100);
  diag.flush(3200);

  assert.strictEqual(logs.length, 2, 'flush should be periodic while diagnostics are enabled');
  assert.strictEqual(logs[0].frames, 1);
  assert.strictEqual(logs[1].frames, 0, 'counters should reset after each flush');
}

testDiagnosticsAreOffByDefault();
testDiagnosticsCanBeEnabledByGlobalFlag();
testDiagnosticsResetCountersAfterFlush();
console.log('runtime-diagnostics tests passed');
