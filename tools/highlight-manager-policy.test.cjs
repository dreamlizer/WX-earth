const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadHighlightManagerHarness() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'highlight-manager.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^import .*$/gm, '');
  source = source.replace(/export\s+function\s+createHighlightManager/, 'function createHighlightManager');
  source += '\nmodule.exports = { createHighlightManager };';

  let vectorConstructs = 0;

  class FakeVector3 {
    constructor(x = 0, y = 0, z = 0) {
      vectorConstructs += 1;
      this.set(x, y, z);
    }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    clone() { return new FakeVector3(this.x, this.y, this.z); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    normalize() {
      const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z) || 1;
      this.x /= len; this.y /= len; this.z /= len;
      return this;
    }
    dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
    applyQuaternion() { return this; }
  }

  class FakeGroup {
    constructor() { this.children = []; }
    add(child) { this.children.push(child); }
    traverse(cb) { for (const child of this.children) cb(child); }
  }

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Date,
    Math,
    convertLatLonToVec3: (lon, lat, radius = 1) => {
      const phi = (90 - lat) * Math.PI / 180;
      const theta = (lon + 180) * Math.PI / 180;
      return {
        x: -radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.cos(phi),
        z: radius * Math.sin(phi) * Math.sin(theta)
      };
    }
  };

  vm.runInNewContext(source, sandbox, { filename: file });
  return {
    createHighlightManager: sandbox.module.exports.createHighlightManager,
    THREE: { Vector3: FakeVector3, Group: FakeGroup },
    resetVectorConstructs() { vectorConstructs = 0; },
    get vectorConstructs() { return vectorConstructs; }
  };
}

function createGlobeGroup() {
  return {
    quaternion: {},
    children: [],
    getWorldPosition(out) { return out.set(0, 0, 0); },
    add(child) { this.children.push(child); },
    remove(child) { this.children = this.children.filter((c) => c !== child); }
  };
}

function testFrontRatioCheckReusesVectorsAcrossBoundaryPoints() {
  const harness = loadHighlightManagerHarness();
  const feature = {
    type: 'Polygon',
    coords: [[
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20],
      [0, 0]
    ]]
  };
  const manager = harness.createHighlightManager({
    THREE: harness.THREE,
    globeGroup: createGlobeGroup(),
    camera: { position: new harness.THREE.Vector3(0, 0, 3) },
    APP_CFG: {
      highlight: {
        fadeOutMs: 500,
        autoClearOnBackside: { enabled: true, checkIntervalMs: 200, minVisibleRatio: 0.1, requireConsecutive: 99 }
      }
    },
    highlightLayer: () => new harness.THREE.Group(),
    RADIUS: 1,
    onAutoCleared: () => {}
  });

  manager.setHighlight(feature);
  harness.resetVectorConstructs();
  manager.updatePerFrame(1000);

  assert.ok(
    harness.vectorConstructs <= 4,
    `front-ratio check should reuse vectors, saw ${harness.vectorConstructs} Vector3 allocations`
  );
}

testFrontRatioCheckReusesVectorsAcrossBoundaryPoints();
console.log('highlight-manager policy tests passed');
