const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const flagModulePath = path.join(root, 'miniprogram/pages/gl/flag-sprite.js');
const spritePath = path.join(root, 'miniprogram/assets/flags/flags-sprite.webp');
const countryInfoManagerPath = path.join(root, 'miniprogram/pages/gl/country-info-manager.js');

function loadFlagModule() {
  const src = fs.readFileSync(flagModulePath, 'utf8')
    .replace(/export\s+const\s+/g, 'const ')
    .replace(/export\s+function\s+/g, 'function ')
    .replace(/export\s+default\s+[^;]+;/g, '');
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(`${src}
module.exports = {
  FLAG_SPRITE,
  FLAG_SPRITE_COLUMNS,
  FLAG_CELL_WIDTH,
  FLAG_CELL_HEIGHT,
  FLAG_INDEX,
  getFlagSprite
};`, sandbox);
  return sandbox.module.exports;
}

const validCode = (v) => /^[A-Z]{3}$/.test(String(v || ''));

function runtimeCountryCodes() {
  const countries = require('../miniprogram/assets/data/countries.json.js');
  const codes = new Set();
  for (const f of countries.features || []) {
    const p = f.properties || {};
    const code = String(p.ISO_A3 || '').toUpperCase();
    if (validCode(code)) codes.add(code);
  }
  return codes;
}

function countryMetaCodes() {
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/assets/data/country_data.json'), 'utf8'));
  return new Set(Object.keys(meta).filter(validCode));
}

const ALLOWED_NO_FLAG = new Set([
  // Not rendered as standalone selectable country panels in the current product path.
  'TWN',
]);

assert.ok(fs.existsSync(flagModulePath), 'flag-sprite.js should exist');
assert.ok(fs.existsSync(spritePath), 'flags-sprite.webp should exist');

const mod = loadFlagModule();

assert.equal(mod.FLAG_SPRITE, '/assets/flags/flags-sprite.webp');
assert.equal(mod.FLAG_CELL_WIDTH, 64);
assert.equal(mod.FLAG_CELL_HEIGHT, 48);
assert.equal(mod.FLAG_SPRITE_COLUMNS, 16);

for (const code of runtimeCountryCodes()) {
  if (ALLOWED_NO_FLAG.has(code)) continue;
  assert.ok(mod.FLAG_INDEX[code], `missing runtime flag mapping for ${code}`);
  assert.ok(mod.getFlagSprite(code), `getFlagSprite should resolve ${code}`);
}

for (const code of countryMetaCodes()) {
  if (ALLOWED_NO_FLAG.has(code)) continue;
  assert.ok(mod.FLAG_INDEX[code], `missing meta flag mapping for ${code}`);
}

for (const code of ['CHN', 'USA', 'THA', 'FRA', 'NOR', 'XKX', 'ATA', 'ESH']) {
  assert.ok(mod.getFlagSprite(code), `expected ${code} to have a flag sprite`);
}

assert.match(
  mod.getFlagSprite('CHN').style,
  /^width: \d+px; height: \d+px; left: -\d+px; top: -\d+px;$/,
  'flag sprite descriptor should include a WXML-safe style string'
);

const stat = fs.statSync(spritePath);
assert.ok(stat.size > 1024, 'sprite should not be empty');
assert.ok(stat.size < 512 * 1024, `sprite should stay small, got ${stat.size} bytes`);

const managerSrc = fs.readFileSync(countryInfoManagerPath, 'utf8');
assert.match(managerSrc, /from\s+['"]\.\/flag-sprite\.js['"]/, 'country info manager should import flag sprite helpers');
assert.match(managerSrc, /flag:\s*getFlagSprite\(/, 'countryInfo should include a flag sprite descriptor');

console.log('flag-sprite policy tests passed');
