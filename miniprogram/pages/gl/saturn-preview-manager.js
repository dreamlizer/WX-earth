import { createSaturnPreviewScene } from './saturn-preview-scene.js';
import { SATURN_LOOKS, DEFAULT_SATURN_LOOK } from './saturn-preview-looks.js';
import { sampleSaturnVoyage, saturnVoyageTime, SATURN_VOYAGE_DURATION } from './saturn-voyage-route.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const presets = {
  whole: { yaw: 0.08, pitch: 0.32, distance: 11.8, ice: 0 },
  close: { yaw: 0.28, pitch: 0.28, distance: 5.5, ice: 0 },
  rings: { yaw: -0.35, pitch: -0.08, distance: 6.8, ice: 0 },
  ice: { yaw: 0, pitch: 0, distance: 6.8, ice: 1 }
};

export class SaturnPreviewManager {
  constructor(THREE, renderer, page) {
    this.THREE = THREE;
    this.renderer = renderer;
    this.page = page;
    this.active = false;
    this.token = 0;
    this.textures = new Set();
    this.pendingCancels = new Set();
    this.model = null;
    this.empty = new THREE.Scene();
    this.emptyCamera = new THREE.PerspectiveCamera();
    this.view = { ...presets.whole };
    this.target = { ...this.view };
    this.clock = 0;
    this.lastFrame = 0;
    this.points = [];
    this.look = DEFAULT_SATURN_LOOK;
    this.voyage = null;
    this.voyageUi = '';
  }

  enter() {
    if (this.active) return true;
    this.active = true;
    const token = ++this.token;
    this.clock = 0;
    this.lastFrame = 0;
    this.voyage = null;
    this.voyageUi = '';
    this.view = { ...presets.whole };
    this.target = { ...this.view };
    this.page.setData({ saturnPreviewActive: true, saturnPreviewLoading: true, saturnPreviewError: '', saturnView: 'whole', saturnLook: this.look, saturnLookCaption: SATURN_LOOKS[this.look].caption, saturnVoyageActive: false, saturnVoyagePaused: false, saturnVoyageComplete: false });
    this.load(token).catch(error => {
      if (!this.isCurrent(token)) return;
      ++this.token;
      this.release();
      this.page.setData({ saturnPreviewLoading: false, saturnPreviewError: '土星资源加载失败，点击重试' });
      console.warn('[Saturn preview]', error.message);
    });
    return true;
  }

  isCurrent(token) { return this.active && token === this.token; }

  async load(token) {
    await this.withTimeout((resolve, reject) => {
      require('../../saturn-assets/ready.js', resolve, reject);
    }, 'Saturn asset package');
    if (!this.isCurrent(token)) return;
    const loader = new this.THREE.TextureLoader();
    const loadTexture = (path) => this.withTimeout((resolve, reject) => {
      loader.load(path, texture => {
        if (!this.isCurrent(token)) { texture.dispose(); return; }
        this.textures.add(texture);
        texture.minFilter = this.THREE.LinearFilter;
        texture.magFilter = this.THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
        texture.needsUpdate = true;
        resolve(texture);
      }, undefined, reject);
    }, path);
    const [surface, ring, profiles, clouds] = await Promise.all([loadTexture('/saturn-assets/saturn.jpg'), loadTexture('/saturn-assets/saturn-ring.png'), loadTexture('/saturn-assets/ring-profiles.png'), loadTexture('/saturn-assets/saturn-clouds-v1.jpg')]);
    if (!this.isCurrent(token)) return;
    const size = this.renderer.getSize(new this.THREE.Vector2());
    clouds.wrapS = this.THREE.RepeatWrapping;
    this.model = createSaturnPreviewScene(this.THREE, surface, ring, size.x / size.y, profiles, clouds);
    this.model.setLook(this.look);
    this.page.setData({ saturnPreviewLoading: false });
  }

  withTimeout(start, name) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.pendingCancels.delete(cancel);
        if (error) reject(error); else resolve(value);
      };
      const cancel = () => finish(new Error('Saturn preview cancelled'));
      const timer = setTimeout(() => finish(new Error(`${name} timeout`)), 20000);
      this.pendingCancels.add(cancel);
      try { start(value => finish(null, value), error => finish(error || new Error(name))); }
      catch (error) { finish(error); }
    });
  }

  exit() {
    this.active = false;
    ++this.token;
    this.release();
    this.page.setData({ saturnPreviewActive: false, saturnPreviewLoading: false, saturnPreviewError: '', saturnVoyageActive: false, saturnVoyagePaused: false, saturnVoyageComplete: false });
  }
  retry() { this.exit(); this.enter(); }
  release() {
    for (const cancel of [...this.pendingCancels]) cancel();
    this.model?.dispose();
    this.model = null;
    for (const texture of this.textures) texture.dispose();
    this.textures.clear();
    this.points = [];
    this.voyage = null;
    this.voyageUi = '';
  }
  dispose() { this.active = false; ++this.token; this.release(); this.page = null; }
  pause() { this.lastFrame = 0; this.points = []; }

  startVoyage() {
    if (!this.active || !this.model) return;
    const reviewLook = this.voyage ? this.voyage.reviewLook : this.look;
    this.target = { ...this.view };
    this.setLook('cinema');
    this.voyage = { time: 0, paused: false, complete: false, exiting: false, blend: 0, yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0, reviewLook };
    this.lastFrame = 0;
    this.points = [];
    this.voyageUi = '';
    this.syncVoyage();
  }
  toggleVoyagePause() {
    if (!this.voyage || this.voyage.exiting || this.voyage.complete) return;
    this.voyage.paused = !this.voyage.paused;
    this.lastFrame = 0;
    this.points = [];
    this.syncVoyage();
  }
  stopVoyage() {
    if (!this.voyage || this.voyage.exiting) return;
    this.voyage.exiting = true;
    this.setLook(this.voyage.reviewLook);
    this.target = { ...presets.whole };
    this.page.setData({ saturnVoyageActive: false, saturnVoyagePaused: false, saturnVoyageComplete: false, saturnView: 'whole' });
  }
  resetVoyageGaze() {
    if (!this.voyage || this.voyage.exiting) return;
    this.voyage.targetYaw = 0;
    this.voyage.targetPitch = 0;
    this.points = [];
  }
  syncVoyage() {
    const voyage = this.voyage;
    if (!voyage || voyage.exiting) return;
    const frame = sampleSaturnVoyage(voyage.time);
    const time = `${saturnVoyageTime(voyage.time)} / ${saturnVoyageTime(SATURN_VOYAGE_DURATION)}`;
    const key = `${frame.stage}|${time}|${voyage.paused}|${voyage.complete}`;
    // Avoid a page bridge/setData on every WebGL frame.
    if (key === this.voyageUi) return;
    this.voyageUi = key;
    this.page.setData({ saturnVoyageActive: true, saturnVoyagePaused: voyage.paused, saturnVoyageComplete: voyage.complete, saturnVoyageStage: frame.stage, saturnVoyageTime: time });
  }

  render() {
    const now = Date.now();
    const dt = this.lastFrame ? clamp((now - this.lastFrame) / 1000, 0, 0.05) : 0;
    this.lastFrame = now;
    if (!this.model) { this.renderer.render(this.empty, this.emptyCamera); return; }
    if (!this.voyage || !this.voyage.paused || this.voyage.exiting) this.clock += dt;
    const smoothing = 1 - Math.exp(-dt * 6);
    for (const key of ['yaw', 'pitch', 'distance', 'ice']) this.view[key] += (this.target[key] - this.view[key]) * smoothing;
    let frame = null;
    if (this.voyage) {
      const voyage = this.voyage;
      if (voyage.exiting) voyage.blend *= Math.exp(-dt * 3);
      else if (!voyage.paused) {
        voyage.time = Math.min(SATURN_VOYAGE_DURATION, voyage.time + dt);
        voyage.blend += (1 - voyage.blend) * (1 - Math.exp(-dt * 3));
        if (voyage.time >= SATURN_VOYAGE_DURATION) { voyage.complete = true; voyage.paused = true; }
      }
      // Pause holds all travel/scene motion; deliberate looking remains usable.
      voyage.yaw += (voyage.targetYaw - voyage.yaw) * smoothing;
      voyage.pitch += (voyage.targetPitch - voyage.pitch) * smoothing;
      frame = { ...sampleSaturnVoyage(voyage.time), blend: voyage.blend, yaw: voyage.yaw, pitch: voyage.pitch };
      this.syncVoyage();
      if (voyage.exiting && voyage.blend < .001) { this.voyage = null; frame = null; }
    }
    const size = this.renderer.getSize(new this.THREE.Vector2());
    this.model.update(this.view, this.clock, size.x / Math.max(1, size.y), size.y, this.renderer.getPixelRatio ? this.renderer.getPixelRatio() : 1, frame);
    this.renderer.render(this.model.scene, this.model.camera);
  }
  setView(key) {
    if (!presets[key] || !this.active) return;
    this.stopVoyage();
    this.target = { ...presets[key] };
    this.page.setData({ saturnView: key });
  }
  setLook(key) {
    if (!this.active || !SATURN_LOOKS[key]) return;
    this.look = key;
    this.model?.setLook(key);
    this.page.setData({ saturnLook: key, saturnLookCaption: SATURN_LOOKS[key].caption });
  }
  touchStart(e) { this.points = (e.touches || []).map(t => ({ x: t.x, y: t.y })); }
  touchMove(e) {
    const points = e.touches || [], previous = this.points;
    if (this.voyage && !this.voyage.exiting) {
      if (points.length === 1 && previous.length === 1) {
        this.voyage.targetYaw = clamp(this.voyage.targetYaw - (points[0].x - previous[0].x) * .004, -1.1, 1.1);
        this.voyage.targetPitch = clamp(this.voyage.targetPitch + (points[0].y - previous[0].y) * .003, -.48, .48);
      }
    } else if (points.length === 2 && previous.length === 2) {
      const distance = p => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const nextDistance = distance(points);
      if (nextDistance > 0) this.target.distance = clamp(this.target.distance * distance(previous) / nextDistance, 3.2, 16);
    } else if (points.length === 1 && previous.length === 1) {
      this.target.yaw -= (points[0].x - previous[0].x) * 0.006;
      this.target.pitch = clamp(this.target.pitch + (points[0].y - previous[0].y) * 0.004, -1.15, 1.15);
    }
    this.touchStart(e);
  }
  touchEnd(e) { this.touchStart(e || {}); }
}
