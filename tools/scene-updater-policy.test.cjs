const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSceneUpdaterPolicies() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'scene-updater.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^import .*$/gm, '');
  source = source.replace(/export\s+function\s+/g, 'function ');
  source += '\nmodule.exports = { getLabelUpdateIntervalMs, getMarkerUpdateIntervalMs };';
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Date,
    Math,
    Number,
    Set,
    Map
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.module.exports;
}

const { getLabelUpdateIntervalMs, getMarkerUpdateIntervalMs } = loadSceneUpdaterPolicies();

assert.strictEqual(
  getLabelUpdateIntervalMs({ isDragging: false, idle: false, isFlying: false, hasInertia: true }),
  48,
  'inertia should relayout labels at a capped 20fps instead of every frame'
);

assert.strictEqual(
  getLabelUpdateIntervalMs({ isDragging: true, idle: false, isFlying: false, hasInertia: false }),
  96,
  'dragging should use a lighter label relayout cadence'
);

assert.strictEqual(
  getLabelUpdateIntervalMs({ isDragging: false, idle: true, isFlying: false, hasInertia: false }),
  140,
  'idle should use the slowest label relayout cadence'
);

assert.strictEqual(
  getMarkerUpdateIntervalMs({ isDragging: false, hasHighlight: false }),
  100,
  'normal city marker breathing does not need per-frame material updates'
);

assert.strictEqual(
  getMarkerUpdateIntervalMs({ isDragging: false, hasHighlight: true }),
  50,
  'highlighted city markers should update faster than normal breathing'
);

assert.strictEqual(
  getMarkerUpdateIntervalMs({ isDragging: true, hasHighlight: true }),
  Infinity,
  'dragging hides city markers, so marker material updates can be skipped'
);

console.log('scene-updater policy tests passed');
