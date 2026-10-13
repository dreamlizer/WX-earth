import { buildChandra, releaseChandra } from './ambient-chandra-model.js';

// Separate local subpackages keep each NASA source comfortably below 2 MiB.
export const AMBIENT_CRAFT = {
  chandra: { package: 'chandra-assets', name: '钱德拉', description: 'X 射线太空望远镜', en: 'Chandra', enDescription: 'X-ray space telescope', pose: [1.18, .55, 1.25] },
  juno: { package: 'juno-assets', name: '朱诺号', description: '木星探测器', en: 'Juno', enDescription: 'Jupiter probe', pose: [.85, .25, -.35] },
  magellan: { package: 'magellan-assets', name: '麦哲伦号', description: '金星雷达探测器', en: 'Magellan', enDescription: 'Venus radar probe', pose: [.6, .3, -.3] }
};
export const ZEN_CRAFT = {
  eve: { package:'eve-assets', name:'伊娃', en:'EVE', pose:[0,0,0], humanoid:true },
  astronaut: { package:'astronaut-assets', name:'宇航员', en:'Astronaut', pose:[0,.2,0], humanoid:true }
};
const loadPackage = key => new Promise((resolve, reject) => {
  // Async subpackage requires must remain literal for the WeChat compiler.
  if (key === 'eve') require('../../eve-assets/ready.js', resolve, reject);
  else if (key === 'astronaut') require('../../astronaut-assets/ready.js', resolve, reject);
  else if (key === 'juno') require('../../juno-assets/ready.js', resolve, reject);
  else if (key === 'magellan') require('../../magellan-assets/ready.js', resolve, reject);
  else require('../../chandra-assets/ready.js', resolve, reject);
});

export function ambientBrowseState({ page, touch, ready, zen, moon, saturn, flying, transitioning }) {
  const d = page && page.data || {};
  const blocked = !ready || !!(zen || moon || saturn || transitioning || d.loading || d.zenMode ||
    d.moonVoyageActive || d.saturnPreviewActive);
  const covered = !!(d.searchOpen || d.settingsOpen || d.countryPanelOpen);
  const busy = !!(flying || touch.isDragging || touch.pinch ||
    Math.abs(touch.velX || 0) + Math.abs(touch.velY || 0) > 0.001);
  return { blocked, busy, covered };
}

export function ambientOrbitPoint(out, pass, progress) {
  const q = Math.max(0, Math.min(1, progress)), u = 2 * q - 1;
  // Move faster while hidden at the back, and linger on the visible sweep.
  // Closed loops disappear behind Earth; the open sky arc leaves only after
  // sweeping across the whole upper sky.
  const angle = 1.2 * u + (Math.PI - 1.2) * u * u * u;
  const sin = Math.sin(angle), cos = Math.cos(angle);
  if (pass.route === 'wide') {
    const a = Math.pow(1 - q, 3), b = 3 * Math.pow(1 - q, 2) * q;
    const c = 3 * (1 - q) * q * q, d = q * q * q;
    out.set(pass.side * (-0.45 * a - 2.8 * b + 1.8 * c + 3.3 * d),
      0.65 * a + 2.4 * (b + c) + 1.2 * d + pass.height, -1.5 - 0.1 * (b + c) + 0.1 * d);
  } else if (pass.route === 'front') {
    out.set(pass.side * 0.76 * sin, 0.7 + 0.8 * sin * sin + pass.height, 1.8 * cos);
  } else {
    out.set(pass.side * 1.2 * sin, 0.4 + 1.55 * cos + pass.height, -1.7 + 0.5 * cos);
  }
  out.x *= pass.span || 1;
  out.z *= pass.depth || 1;
  const tilt = pass.tilt || 0, x = out.x, y = out.y;
  return out.set(x * Math.cos(tilt) - y * Math.sin(tilt),
    x * Math.sin(tilt) + y * Math.cos(tilt), out.z);
}

export class AmbientEncounterManager {
  constructor({ THREE, scene, camera, globeGroup, renderer, page, random = Math.random }) {
    Object.assign(this, { THREE, scene, camera, globeGroup, renderer, page, random });
    this.root = new THREE.Group();
    this.root.name = 'AMBIENT_CHANDRA';
    this.root.visible = false;
    scene.add(this.root);
    this.center = new THREE.Vector3();
    this.local = new THREE.Vector3();
    this.wait = this.range(2, 5);
    this.nextKey = this.pickCraft();
    this.models = {};
    this.loadedKey = null;
    this.raycaster = new THREE.Raycaster();
    this.planetSphere = new THREE.Sphere();
    this.surfacePoint = new THREE.Vector3();
    this.quiet = 0;
    this.generation = 0;
    this.disposed = false;
    this.pass = null;
    this.cancelLoad = null;
    this.model = null;
    this.pending = null;
  }

  range(min, max) { return min + (max - min) * Math.max(0, Math.min(1, this.random())); }

  pickCraft() {
    const choices = Object.keys(AMBIENT_CRAFT).filter(key => key !== this.lastKey);
    return choices[Math.min(choices.length - 1, Math.floor(this.range(0, choices.length)))];
  }

  activateModel(key) {
    if (this.model) this.root.remove(this.model);
    this.model = this.models[key];
    this.loadedKey = key;
    this.root.add(this.model);
  }

  preload() {
    if (this.disposed || this.pending || this.loadedKey === this.nextKey) return;
    if (this.models[this.nextKey]) { this.activateModel(this.nextKey); return; }
    const key = this.nextKey, pack = (AMBIENT_CRAFT[key] || ZEN_CRAFT[key]).package;
    const T = this.THREE, token = this.generation, textures = new Set();
    let live = true, model = null, rejectCancel;
    const current = () => live && !this.disposed && token === this.generation;
    const cancelled = new Promise((resolve, reject) => { rejectCancel = reject; });
    const cancel = () => {
      if (!live || model) return;
      live = false;
      textures.forEach(t => t.dispose()); textures.clear();
      rejectCancel(new Error('Ambient load cancelled'));
    };
    this.cancelLoad = cancel;
    const timer = setTimeout(cancel, 20000);
    const work = loadPackage(key)
      .then(data => {
        if (!current()) throw new Error('Ambient lifecycle ended');
        return Promise.all([
          new Promise((resolve, reject) => wx.getFileSystemManager().readFile({
            filePath: pack + '/geometry.bin', success: r => resolve(r.data), fail: reject
          })),
          ...data.images.map(name => new Promise((resolve, reject) => {
            new T.TextureLoader().load('/' + pack + '/' + name, texture => {
              if (!current()) { texture.dispose(); reject(new Error('Ambient late texture')); return; }
              texture.flipY = false;
              texture.encoding = T.sRGBEncoding;
              texture.minFilter = texture.magFilter = T.LinearFilter;
              texture.generateMipmaps = false;
              texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
              textures.add(texture); resolve(texture);
            }, undefined, reject);
          }))
        ]).then(([buffer, ...maps]) => {
          if (!current()) return;
          model = buildChandra(T, data, buffer, maps);
          this.models[key] = model;
          this.activateModel(key);
        });
      });
    this.pending = Promise.race([work, cancelled]).catch(error => {
      if (current()) console.warn('[Ambient] ' + key + ' unavailable', error);
      // Sibling callbacks may still arrive after a failure.
      live = false;
      if (model) releaseChandra(model);
      else textures.forEach(t => t.dispose());
      textures.clear();
      if (token === this.generation && !this.disposed) this.wait = this.range(90, 150);
    }).then(() => {
      clearTimeout(timer);
      if (token === this.generation) { this.pending = null; this.cancelLoad = null; }
    });
  }

  finish() {
    if (this.pass) {
      this.wait = this.range(90, 150);
      this.nextKey = this.pickCraft();
    }
    this.clearCaption();
    this.pass = null;
    this.root.visible = false;
  }

  pause() {
    this.lastTime = null;
    this.quiet = 0;
    this.finish();
  }

  update(now, { blocked, busy, covered = false }) {
    if (this.disposed) return;
    const delta = this.lastTime == null ? 0 : Math.max(0, (now - this.lastTime) / 1000);
    this.lastTime = now;
    // Only a mode change ends a pass. onHide explicitly calls pause(); a slow
    // selection/setData frame is not evidence that the page went background.
    if (blocked) {
      this.quiet = 0; this.finish(); return;
    }
    const dt = Math.min(delta, .1);
    if (covered) this.clearCaption();
    if (busy || covered) this.quiet = 0;
    else this.quiet += dt;
    if (this.pass) {
      this.pass.elapsed += dt;
      if (this.pass.elapsed >= this.pass.duration) { this.finish(); return; }
      this.place(); return;
    }
    const first = !this.lastKey;
    // The first local load/countdown runs during ordinary browsing too.
    // Later encounters retain the quiet cadence, without interrupting a pass.
    if (!first && (busy || covered)) return;
    this.wait -= first ? delta : dt;
    // Start the first local load as soon as normal browsing is ready.
    if (this.wait <= 5 && this.loadedKey !== this.nextKey) this.preload();
    if ((!first && this.quiet < 4) || this.wait > 0 || !this.model || this.loadedKey !== this.nextKey) return;
    this.pass = {
      key: this.loadedKey, spin: this.range(.012, .018) * (this.random() < .5 ? -1 : 1), elapsed: 0, duration: this.range(50, 65), side: this.random() < 0.5 ? -1 : 1,
      route: this.pickRoute(),
      height: this.range(-0.06, 0.14), size: this.range(0.30, 0.36), roll: this.range(-0.18, 0.18),
      span: this.range(0.92, 1.06), depth: this.range(0.85, 1.1), tilt: this.range(-0.1, 0.1)
    };
    this.lastKey = this.loadedKey;
    this.root.visible = true;
    this.place();
  }

  pickRoute() {
    const chance = this.random();
    return chance < 0.45 ? 'wide' : chance < 0.75 ? 'back' : 'front';
  }

  place() {
    const p = this.pass, q = p.elapsed / p.duration;
    this.camera.updateMatrixWorld(true);
    this.globeGroup.getWorldPosition(this.center);
    // Camera-relative 3D loops preserve the portrait composition while keeping
    // real perspective and the ordinary Earth's depth occlusion.
    ambientOrbitPoint(this.local, p, q);
    this.root.position.copy(this.local.applyQuaternion(this.camera.quaternion).add(this.center));
    this.root.quaternion.copy(this.camera.quaternion);
    const pose = AMBIENT_CRAFT[p.key || 'chandra'].pose;
    this.root.rotateZ(pose[2] + p.roll + q * 0.12);
    this.root.rotateY(pose[1] + q * 0.2);
    this.root.rotateX(pose[0] + q * 0.08 + .035 * Math.sin(p.elapsed * .16));
    this.root.scale.setScalar(p.size);
    // Spin the centered hull locally, independently of its camera-relative
    // trajectory pose. Opposite orbital turns cannot cancel this rotation.
    if (this.model) this.model.rotation.set(0, p.elapsed * (p.spin || 0), .025 * Math.sin(p.elapsed * .16));
  }

  clearCaption() {
    if (this.page && this.page.data.ambientName) this.page.setData({ ambientName: '', ambientDescription: '' });
  }

  tap({ downX, downY, width, height }) {
    this.clearCaption();
    if (!this.pass || !this.root.visible || !this.model || !(width > 0 && height > 0)) return false;
    this.camera.updateMatrixWorld(true);
    this.root.updateMatrixWorld(true);
    this.globeGroup.getWorldPosition(this.planetSphere.center);
    const scale = this.globeGroup.getWorldScale(new this.THREE.Vector3());
    this.planetSphere.radius = Math.max(scale.x, scale.y, scale.z);
    // A few nearby rays give a small touch tolerance without selecting the
    // entire bounding box. Every hit must be in front of the globe surface.
    for (const [dx, dy] of [[0, 0], [-8, 0], [8, 0], [0, -8], [0, 8], [-5, -5], [5, -5], [-5, 5], [5, 5]]) {
      this.raycaster.setFromCamera({ x: (downX + dx) / width * 2 - 1, y: 1 - (downY + dy) / height * 2 }, this.camera);
      const hit = this.raycaster.intersectObject(this.model, true)[0];
      if (!hit) continue;
      const surface = this.raycaster.ray.intersectSphere(this.planetSphere, this.surfacePoint);
      if (surface && surface.distanceTo(this.raycaster.ray.origin) < hit.distance - .001) continue;
      const craft = AMBIENT_CRAFT[this.pass.key || this.loadedKey];
      if (this.page) {
        const english = this.page.data.lang === 'en';
        this.page.setData({ ambientName: english ? craft.en : craft.name, ambientDescription: english ? craft.enDescription : craft.description });
      }
      return true;
    }
    return false;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    if (this.cancelLoad) this.cancelLoad();
    this.cancelLoad = null;
    this.pending = null;
    this.clearCaption();
    Object.values(this.models).forEach(releaseChandra);
    this.models = {};
    releaseChandra(this.root);
    this.model = null;
    this.pass = null;
  }
}
