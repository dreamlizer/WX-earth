import { createSaturnPreviewScene } from './saturn-preview-scene.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const presets = {
  whole: { yaw: 0.08, pitch: 0.32, distance: 11.8 },
  close: { yaw: 0.28, pitch: 0.28, distance: 5.5 },
  rings: { yaw: -0.35, pitch: -0.08, distance: 6.8 }
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
  }

  enter() {
    if (this.active) return true;
    this.active = true;
    const token = ++this.token;
    this.clock = 0;
    this.lastFrame = 0;
    this.view = { ...presets.whole };
    this.target = { ...this.view };
    this.page.setData({ saturnPreviewActive: true, saturnPreviewLoading: true, saturnPreviewError: '', saturnView: 'whole' });
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
    const [surface, ring] = await Promise.all([loadTexture('/saturn-assets/saturn.jpg'), loadTexture('/saturn-assets/saturn-ring.png')]);
    if (!this.isCurrent(token)) return;
    const size = this.renderer.getSize(new this.THREE.Vector2());
    this.model = createSaturnPreviewScene(this.THREE, surface, ring, size.x / size.y);
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
    this.page.setData({ saturnPreviewActive: false, saturnPreviewLoading: false, saturnPreviewError: '' });
  }
  retry() { this.exit(); this.enter(); }
  release() {
    for (const cancel of [...this.pendingCancels]) cancel();
    this.model?.dispose();
    this.model = null;
    for (const texture of this.textures) texture.dispose();
    this.textures.clear();
    this.points = [];
  }
  dispose() { this.active = false; ++this.token; this.release(); this.page = null; }
  pause() { this.lastFrame = 0; this.points = []; }

  render() {
    const now = Date.now();
    const dt = this.lastFrame ? clamp((now - this.lastFrame) / 1000, 0, 0.05) : 0;
    this.lastFrame = now;
    this.clock += dt;
    if (!this.model) { this.renderer.render(this.empty, this.emptyCamera); return; }
    const smoothing = 1 - Math.exp(-dt * 6);
    for (const key of ['yaw', 'pitch', 'distance']) this.view[key] += (this.target[key] - this.view[key]) * smoothing;
    const size = this.renderer.getSize(new this.THREE.Vector2());
    this.model.update(this.view, this.clock, size.x / Math.max(1, size.y));
    this.renderer.render(this.model.scene, this.model.camera);
  }
  setView(key) {
    if (!presets[key] || !this.active) return;
    this.target = { ...presets[key] };
    this.page.setData({ saturnView: key });
  }
  touchStart(e) { this.points = (e.touches || []).map(t => ({ x: t.x, y: t.y })); }
  touchMove(e) {
    const points = e.touches || [], previous = this.points;
    if (points.length === 2 && previous.length === 2) {
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
