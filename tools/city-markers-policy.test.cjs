const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCityMarkersHarness() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'city-markers.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^import .*$/gm, '');
  source = source.replace(/export\s+function\s+/g, 'function ');
  source += '\nmodule.exports = { initCityMarkers, highlightCityMarker, clearCityHighlights, getHighlightedWorldPositions, disposeCityMarkers };';

  class FakeVector3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v) { return this.set(v.x, v.y, v.z); }
  }

  class FakeGroup {
    constructor() { this.children = []; this.name = ''; }
    add(child) { child.parent = this; this.children.push(child); }
    remove(child) { this.children = this.children.filter((c) => c !== child); }
  }

  class FakeGeometry {
    dispose() {}
  }

  class FakeMaterial {
    constructor() {
      this.opacity = 1;
      this.color = {
        hex: 0,
        getHex() { return this.hex; },
        setHex(v) { this.hex = v; }
      };
    }
    dispose() {}
  }

  class FakeMesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = new FakeVector3();
      this.scale = { x: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.userData = {};
    }
    getWorldPosition(out) { return out.copy(this.position); }
  }

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Date,
    Math,
    String,
    Number,
    Map,
    convertLatLonToVec3: (lon, lat, radius = 1) => ({ x: lon * 0.01 * radius, y: lat * 0.01 * radius, z: radius })
  };

  vm.runInNewContext(source, sandbox, { filename: file });
  return {
    api: sandbox.module.exports,
    THREE: {
      Group: FakeGroup,
      SphereGeometry: FakeGeometry,
      MeshBasicMaterial: FakeMaterial,
      Mesh: FakeMesh,
      Vector3: FakeVector3,
      AdditiveBlending: 'add'
    }
  };
}

function testHighlightedWorldPositionsReuseArrayAndVectors() {
  const { api, THREE } = loadCityMarkersHarness();
  const globeGroup = new THREE.Group();

  api.initCityMarkers(THREE, globeGroup, [{ lon: 10, lat: 20, country_code: 'AAA', name_en: 'Foo' }]);
  assert.strictEqual(api.highlightCityMarker('CITY_AAA_Foo', 3000), true);

  const first = api.getHighlightedWorldPositions();
  const firstWorld = first[0]?.world;
  const second = api.getHighlightedWorldPositions();

  assert.strictEqual(second, first, 'highlight position result array should be reused');
  assert.strictEqual(second[0]?.world, firstWorld, 'highlight world vector should be reused between calls');

  api.clearCityHighlights();
  const emptyA = api.getHighlightedWorldPositions();
  const emptyB = api.getHighlightedWorldPositions();
  assert.strictEqual(emptyB, emptyA, 'empty highlight result array should also be reused');

  api.disposeCityMarkers();
}

testHighlightedWorldPositionsReuseArrayAndVectors();
console.log('city-markers policy tests passed');
