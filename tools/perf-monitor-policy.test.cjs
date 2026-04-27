const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadPerfMonitor(perfDiagLog) {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'perf-monitor.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^import .*$/gm, '');
  source = source.replace(/export\s+class\s+PerfMonitor/, 'class PerfMonitor');
  source = source.replace(/export\s+function\s+createPerfMonitor/, 'function createPerfMonitor');
  source += '\nmodule.exports = { PerfMonitor, createPerfMonitor };';

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Math,
    Number,
    isFinite,
    PERF_DIAG_LOG: perfDiagLog
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.module.exports;
}

function testDisabledDiagnosticsDoNotAllocateFrameWindow() {
  const { createPerfMonitor } = loadPerfMonitor(false);
  const monitor = createPerfMonitor();

  monitor.update(1000);
  monitor.update(1016);
  monitor.update(1032);

  assert.strictEqual(monitor.fpsWindow.length, 0, 'disabled diagnostics should not keep per-frame fps samples');
}

function testEnabledDiagnosticsKeepFrameWindow() {
  const { createPerfMonitor } = loadPerfMonitor(true);
  const monitor = createPerfMonitor();

  monitor.update(1000);
  monitor.update(1016);
  monitor.update(1032);

  assert.strictEqual(monitor.fpsWindow.length, 2, 'enabled diagnostics should keep fps samples for logging');
}

testDisabledDiagnosticsDoNotAllocateFrameWindow();
testEnabledDiagnosticsKeepFrameWindow();
console.log('perf-monitor policy tests passed');
