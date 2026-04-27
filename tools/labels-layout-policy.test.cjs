const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadLabelsLayout() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'labels-layout.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^import .*$/gm, '');
  source = source.replace(/export\s+const\s+LabelsLayout\s*=/, 'const LabelsLayout =');
  source += '\nmodule.exports = { LabelsLayout };';

  class FakeVector4 {
    constructor() { this.set(0, 0, 0, 1); }
    set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
    applyMatrix4() { return this; }
  }

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Math,
    _const: { GRID_SIZE: 64, EDGE_FADE_PX: 28 }
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return {
    LabelsLayout: sandbox.module.exports.LabelsLayout,
    THREE: { Vector4: FakeVector4 }
  };
}

function testMakeGridReusesAndClearsSameShape() {
  const { LabelsLayout } = loadLabelsLayout();
  const first = LabelsLayout.makeGrid(320, 640, 64);
  first.occ[0] = 1;

  const second = LabelsLayout.makeGrid(320, 640, 64);

  assert.strictEqual(second, first, 'same grid shape should reuse the grid object');
  assert.strictEqual(second.occ[0], 0, 'reused grid occupancy should be cleared');
}

function testMakeGridReallocatesWhenShapeChanges() {
  const { LabelsLayout } = loadLabelsLayout();
  const first = LabelsLayout.makeGrid(320, 640, 64);
  const second = LabelsLayout.makeGrid(321, 640, 64);

  assert.notStrictEqual(second, first, 'different grid shape should allocate a fresh grid object');
}

function testWorldToScreenCanReuseOutputObject() {
  const { LabelsLayout, THREE } = loadLabelsLayout();
  const out = {};
  const res = LabelsLayout.worldToScreen(
    { x: 0, y: 0, z: 0 },
    {
      THREE,
      width: 200,
      height: 100,
      camera: { matrixWorldInverse: {}, projectionMatrix: {} }
    },
    out
  );

  assert.strictEqual(res, out, 'worldToScreen should write into the provided output object');
  assert.deepStrictEqual(out, { x: 100, y: 50, ndcX: 0, ndcY: 0 });
}

function testEstimatePixelSizeCanReuseOutputObject() {
  const { LabelsLayout } = loadLabelsLayout();
  const out = {};
  const res = LabelsLayout.estimatePixelSize(
    { scale: { x: 2, y: 1 } },
    { x: 0, y: 0, z: 0 },
    { height: 100, camera: { fov: 90, position: { x: 0, y: 0, z: 10 } } },
    out
  );

  assert.strictEqual(res, out, 'estimatePixelSize should write into the provided output object');
  assert.ok(out.w > out.h, 'wider mesh scale should produce wider pixel estimate');
}

testMakeGridReusesAndClearsSameShape();
testMakeGridReallocatesWhenShapeChanges();
testWorldToScreenCanReuseOutputObject();
testEstimatePixelSizeCanReuseOutputObject();
console.log('labels-layout policy tests passed');
