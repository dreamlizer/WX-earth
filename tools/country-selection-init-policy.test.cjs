const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const layersSrc = fs.readFileSync(path.join(root, 'miniprogram/pages/gl/layers.js'), 'utf8');
const appEngineSrc = fs.readFileSync(path.join(root, 'miniprogram/pages/gl/app-engine.js'), 'utf8');

test('makeBorder uses BufferGeometry attribute compatibility for threejs-miniprogram r108', () => {
  const directSetAttribute = "g.setAttribute('position', new THREE.BufferAttribute";
  assert.equal(
    layersSrc.includes(directSetAttribute),
    false,
    'makeBorder must not depend on BufferGeometry.setAttribute only'
  );
  assert.match(layersSrc, /const PosAttr = THREE\.Float32BufferAttribute \|\| THREE\.BufferAttribute/);
  assert.match(layersSrc, /typeof g\.setAttribute === 'function'/);
  assert.match(layersSrc, /typeof g\.addAttribute === 'function'/);
});

test('country search index is initialized before border rendering can fail', () => {
  const indexPos = appEngineSrc.indexOf('this.searchIndex = buildIndex(features);');
  const borderPos = appEngineSrc.indexOf('this.borderGroup = makeBorder');
  assert.notEqual(indexPos, -1, 'search index initialization is missing');
  assert.notEqual(borderPos, -1, 'border rendering initialization is missing');
  assert.ok(
    indexPos < borderPos,
    'search index should be built before makeBorder so tapping still works if borders fail'
  );
});
