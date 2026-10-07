import { registerGLTFLoader } from './vendor/gltf-loader.js';

function release(model) {
  if (!model) return;
  const geometries = new Set(), materials = new Set(), textures = new Set();
  model.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.material) for (const m of [].concat(o.material)) {
      materials.add(m);
      for (const value of Object.values(m)) if (value && value.isTexture) textures.add(value);
    }
    if (o.skeleton && o.skeleton.boneTexture) textures.add(o.skeleton.boneTexture);
  });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose());
  textures.forEach(t => t.dispose());
  if (model.parent) model.parent.remove(model);
}

// The bind-pose bounding box is wrong after posing this skinned asset.
function posedBodyBounds(T, raw) {
  const box = new T.Box3(), matrix = new T.Matrix4();
  raw.updateMatrixWorld(true);
  raw.traverse(o => {
    if (!o.isSkinnedMesh) return;
    o.skeleton.update();
    const a = o.geometry.attributes;
    for (let i = 0; i < a.position.count; i++) {
      const v = new T.Vector3().fromBufferAttribute(a.position, i).applyMatrix4(o.bindMatrix);
      const point = new T.Vector3();
      for (let j = 0; j < 4; j++) {
        matrix.fromArray(o.skeleton.boneMatrices, a.skinIndex.array[i * 4 + j] * 16);
        point.addScaledVector(v.clone().applyMatrix4(matrix), a.skinWeight.array[i * 4 + j]);
      }
      box.expandByPoint(point.applyMatrix4(o.bindMatrixInverse).applyMatrix4(o.matrixWorld));
    }
  });
  return box;
}

function buildRobot(T, gltf) {
  const raw = gltf.scene, mixer = new T.AnimationMixer(raw), clip = gltf.animations[0];
  // Keep the reviewed arm pose, excluding the source animation's body turns.
  if (clip) {
    const pose = clip.clone();
    pose.tracks = pose.tracks.filter(t => !t.name.startsWith('Body_00.'));
    mixer.clipAction(pose).play();
    mixer.update(1.8);
    const transforms = [];
    raw.traverse(o => transforms.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
    mixer.stopAllAction();
    mixer.uncacheClip(pose);
    transforms.forEach(([o, p, q, s]) => { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); });
  }
  const fireClip = clip && clip.clone();
  if (fireClip) fireClip.tracks = fireClip.tracks.filter(t => t.name.startsWith('Cone'));
  const fireAction = fireClip && mixer.clipAction(fireClip).play();
  const materials = new Set(), arms = [];
  raw.traverse(o => {
    if (o.name === 'ArmL2_02' || o.name === 'ArmR2_08') arms.push({ node: o, rotation: o.quaternion.clone() });
    if (!o.isMesh) return;
    o.frustumCulled = false;
    for (const m of [].concat(o.material)) {
      if (materials.has(m)) continue;
      materials.add(m);
      if (m.name === 'Fire') {
        m.opacity = .55; m.depthWrite = false; m.blending = T.AdditiveBlending;
        m.emissive.setRGB(.38, .75, 1.5);
      }
      m.userData.voyageOpacity = m.opacity;
      m.transparent = true; m.needsUpdate = true;
    }
  });
  const box = posedBodyBounds(T, raw), size = box.getSize(new T.Vector3());
  raw.position.sub(box.getCenter(new T.Vector3()));
  const model = new T.Group(); model.add(raw);
  model.scale.setScalar(.8 / Math.max(size.x, size.y, size.z));
  model.visible = false;
  return { model, raw, mixer, fireAction, arms, materials: Array.from(materials) };
}

class VoyageRobot {
  constructor({ THREE, scene, readBuffer }) {
    this.THREE = THREE; this.scene = scene; this.readBuffer = readBuffer;
    this.generation = 0; this.attempted = false;
  }
  preload() {
    if (this.model) return Promise.resolve();
    if (this.pending) return this.pending;
    if (this.attempted) return Promise.resolve();
    this.attempted = true;
    const generation = this.generation, T = this.THREE;
    const ready = this.readBuffer ? Promise.resolve() : new Promise((resolve, reject) => require('../../robot-assets/ready.js', resolve, reject));
    const read = this.readBuffer || (() => new Promise((resolve, reject) => wx.getFileSystemManager().readFile({ filePath: 'robot-assets/robot.glb', success: r => resolve(r.data), fail: reject })));
    if (!T.GLTFLoader) registerGLTFLoader(T);
    this.pending = ready.then(read).then(buffer => new Promise((resolve, reject) => new T.GLTFLoader().parse(buffer, '/robot-assets/', resolve, reject))).then(gltf => {
      if (generation !== this.generation) { release(gltf.scene); return; }
      Object.assign(this, buildRobot(T, gltf));
      this.scene.add(this.model);
    }).catch(error => {
      if (generation === this.generation) console.warn('[Moon] Robot unavailable; retaining Voyager fallback', error);
    }).then(() => { if (generation === this.generation) this.pending = null; });
    return this.pending;
  }
  update(elapsed, alpha) {
    if (!this.model) return;
    if (this.fireAction) { this.fireAction.time = (1.8 + elapsed) % this.fireAction.getClip().duration; this.mixer.update(0); }
    this.arms.forEach((arm, i) => { arm.node.quaternion.copy(arm.rotation); arm.node.rotateZ(Math.sin(elapsed * .75 + i * 1.1) * .14); arm.node.rotateX(Math.sin(elapsed * .53 + i * 1.6) * .08); });
    this.materials.forEach(m => { m.opacity = m.userData.voyageOpacity * alpha; });
  }
  reset() { if (this.model) this.model.visible = false; }
  dispose() {
    this.generation++; this.pending = null; this.attempted = false;
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.raw); }
    release(this.model);
    this.model = null; this.raw = null; this.mixer = null; this.fireAction = null;
    this.arms = []; this.materials = [];
  }
}
export { VoyageRobot, buildRobot, release };
