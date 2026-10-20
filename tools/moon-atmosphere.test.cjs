const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createScopedThreejs } = require('../miniprogram/node_modules/threejs-miniprogram');
const T = createScopedThreejs({ width: 390, height: 720, createImage() { return {}; } });
const box = {
  module: { exports: {} }, console,
  makeTextSprite: () => new T.Sprite(new T.SpriteMaterial({ transparent: true }))
};
const source = ['moon-voyage-zodiac-data.js', 'moon-voyage-zodiac.js']
  .map(f => fs.readFileSync('miniprogram/pages/gl/' + f, 'utf8')
    .replace(/^import .*;$/gm, '').replace(/export /g, '')).join('\n');
vm.runInNewContext(source + '\nmodule.exports=ZodiacSystem;', box);
const scene = new T.Scene(), moon = new T.Object3D(), camera = new T.PerspectiveCamera();
moon.position.set(-5.8, -1.2, 0);
const zodiac = new box.module.exports();
zodiac.setContext({ THREE: T, scene });
zodiac.init(); zodiac.setVisible(true);
const links = () => zodiac.group.children.flatMap(g => g.children.filter(c => c.name === 'ZODIAC_LINKS'));
const stars = () => zodiac.group.children.flatMap(g => g.children.filter(c => c.name === 'ZODIAC_STAR'));
for (const t of [78, 92, 112.65, 113, 116, 119, 125, 129, 137, 167, 174, 200, 243, 255, 271]) {
  zodiac.tick(1 / 30, moon, camera, t);
  assert(links().every(l => l.material.opacity === 0), 'Arrival, major reveals and ending have no constellation diagram');
  assert(zodiac.group.children.every(g => g.children.filter(c => c.name === 'ZODIAC_LABEL').every(c => !c.visible)), 'Labels never compete with song or Earth');
}
zodiac.tick(1 / 30, moon, camera, 132);
assert.equal(links().filter(l => l.material.opacity > 0).length, 1, 'Only one constellation is revealed');
assert.equal(links().find(l => l.material.opacity > 0).parent.name, 'Sagittarius');
const pose = zodiac.group.rotation.y;
const starCount = stars().length;
zodiac.tick(1 / 30, moon, camera, 140);
assert.equal(stars().length, starCount, 'Retiring the lines does not remove their stars');
assert(stars().every(s => s.material.opacity > 0), 'The same star field remains after the reveal');
zodiac.tick(1 / 30, moon, camera, 132);
assert.equal(zodiac.group.rotation.y, pose, 'Seeking back rebuilds exactly the same constellation placement');
let previous = 0;
for (let t = 129; t <= 137; t += 1 / 60) {
  zodiac.tick(1 / 60, moon, camera, t);
  const opacity = Math.max(...links().map(l => l.material.opacity));
  assert(Math.abs(opacity - previous) < .001, 'Discovery has no flashing or abrupt reveal');
  previous = opacity;
}
zodiac.reset();
assert.equal(zodiac.group.visible, false);
assert.equal(zodiac.group.rotation.y, 0);
zodiac.setVisible(true); zodiac.tick(1 / 30, moon, camera, 0);
assert(stars().every(s => s.material.opacity === 0), 'Re-entry cannot revive the previous reveal');
zodiac.dispose(); zodiac.dispose();
assert.equal(scene.children.length, 0, 'All constellation resources detach on exit');
console.log('Moon atmosphere: isolated discovery, quiet arrival/ending, continuous fade and deterministic replay PASS');
