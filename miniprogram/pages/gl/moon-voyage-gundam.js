import { release } from './moon-voyage-robot.js';
const DATA = require('../../assets/models/gundam/model.js');
const FLIGHT = [
  [0, 5, .3, 3], [2, 2, .45, -10], [4, 1.8, .65, -19],
  [6, 1.2, .85, -31], [8, -3, 1.5, -48],
  [11, -15, 2.8, -79], [14, -40, 5, -120]
];
const FLIGHT_END = 14;
const flightEase = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
// Timed Hermite segments keep both position and velocity continuous through
// a readable forward overtake, then an accelerating sweep to the front left.
function flightTrack(e) {
  let i = 0;
  while (i < FLIGHT.length - 2 && e > FLIGHT[i + 1][0]) i++;
  const a = FLIGHT[i], b = FLIGHT[i + 1], span = b[0] - a[0], u = (e - a[0]) / span;
  const before = FLIGHT[Math.max(0, i - 1)], after = FLIGHT[Math.min(FLIGHT.length - 1, i + 2)];
  const position = [], velocity = [];
  for (let k = 1; k <= 3; k++) {
    const va = (b[k] - before[k]) / (b[0] - before[0]), vb = (after[k] - a[k]) / (after[0] - a[0]);
    position.push((2*u*u*u-3*u*u+1)*a[k] + (u*u*u-2*u*u+u)*span*va + (-2*u*u*u+3*u*u)*b[k] + (u*u*u-u*u)*span*vb);
    velocity.push((6*u*u-6*u)*a[k]/span + (3*u*u-4*u+1)*va + (-6*u*u+6*u)*b[k]/span + (3*u*u-2*u)*vb);
  }
  return { position, velocity };
}

function orientGundam(frame, track, bank) {
  frame.rotateZ(-.3 * bank);
  frame.rotateY(Math.atan2(-track.velocity[0], -track.velocity[2]) + .7 * bank);
  frame.rotateZ(-.82 * bank);
}

const flightBank = e => flightEase((e - 4.8) / 3.2);
// Exhaust length comes from backward flow, not several seconds of flight
// history. Old wisps move away from their emission point and die individually.
const WAKE_LIFE = .85, WAKE_START = 1.6, WAKE_END = 11.9, WAKE_SEGMENTS = 48;
function buildExhaustSheet(T, segments, plume) {
  const geometry = new T.BufferGeometry(), count = segments + 1;
  geometry.addAttribute('position', new T.BufferAttribute(new Float32Array(count * 6), 3));
  geometry.addAttribute('uv', new T.BufferAttribute(new Float32Array(count * 4), 2));
  geometry.addAttribute('strength', new T.BufferAttribute(new Float32Array(count * 2), 1));
  const index = [];
  for (let i = 0; i < segments; i++) {
    const j = i * 2; index.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
  }
  geometry.setIndex(index);
  const material = new T.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    blending: T.AdditiveBlending, side: T.DoubleSide,
    uniforms: { exhaustTime: { value: 0 }, isPlume: { value: plume ? 1 : 0 } },
    vertexShader: `
      attribute float strength;
      varying vec2 wakeUV;
      varying float wakeStrength;
      void main() {
        wakeUV = uv; wakeStrength = strength;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec2 wakeUV;
      varying float wakeStrength;
      uniform float exhaustTime;
      uniform float isPlume;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
      }
      float cloud(vec2 p) { return noise(p) * 0.65 + noise(p * 2.03 + 9.2) * 0.35; }
      void main() {
        float crossTrail = wakeUV.x * 2.0 - 1.0;
        float along = wakeUV.y;
        // Increasing phase moves the pattern from the nozzle toward the tail.
        float flow = cloud(vec2(crossTrail * 2.3, along * 7.0 - exhaustTime * 8.0));
        float detail = cloud(vec2(crossTrail * 5.0 + flow, along * 17.0 - exhaustTime * 16.0));
        float edge = 1.0 - smoothstep(0.35, 1.0, abs(crossTrail));
        float haze = exp(-crossTrail * crossTrail * 3.0);
        float erosion = smoothstep(0.36 + along * 0.15, 0.72, flow * 0.7 + detail * 0.3);
        // Only the short, attached plume has a bright core. The separate wake
        // contains soft patches, never a continuous centerline through the arc.
        float core = exp(-crossTrail * crossTrail * 55.0) * pow(1.0 - along, 4.0);
        float plumeLight = haze * (0.16 + erosion * 0.9) + core * (0.5 + flow);
        float wispLight = haze * (0.07 + erosion * 0.93) * (0.5 + detail) * 2.8;
        vec3 blue = mix(vec3(0.015, 0.14, 0.75), vec3(0.10, 0.48, 1.0), flow);
        blue = mix(blue, vec3(0.62, 0.9, 1.0), isPlume * core);
        gl_FragColor = vec4(blue, mix(wispLight, plumeLight, isPlume) * edge * wakeStrength);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`
  });
  const mesh = new T.Mesh(geometry, material); mesh.frustumCulled = false;
  return { mesh, segments, centers: new Float32Array(count * 3), widths: new Float32Array(count), birthTimes: new Float32Array(count) };
}

function buildGundamWake(T, raw, scale) {
  const wisps = buildExhaustSheet(T, WAKE_SEGMENTS, false), plume = buildExhaustSheet(T, 32, true);
  const group = new T.Group(); group.add(wisps.mesh, plume.mesh); group.visible = false;
  return { group, wisps, plume, frame: new T.Group(),
    // Between the backpack nozzles, in the packed model's original units.
    emitter: new T.Vector3(-1.12, 4.3, 1.9).applyQuaternion(raw.quaternion).multiplyScalar(scale),
    point: new T.Vector3(), direction: new T.Vector3(), tangent: new T.Vector3(), side: new T.Vector3(), view: new T.Vector3() };
}

function writeExhaustSheet(wake, sheet, elapsed) {
  const { point, tangent, side, view } = wake, { centers, widths, segments } = sheet;
  const attrs = sheet.mesh.geometry.attributes;
  for (let i = 0; i <= segments; i++) {
    const prev = Math.max(0, i - 1) * 3, next = Math.min(segments, i + 1) * 3;
    point.fromArray(centers, i * 3);
    tangent.fromArray(centers, next).sub(view.fromArray(centers, prev));
    view.copy(point).negate(); side.crossVectors(tangent, view);
    if (side.lengthSq() < 1e-10) side.set(1, 0, 0); else side.normalize();
    for (let edge = 0; edge < 2; edge++) {
      view.copy(point).addScaledVector(side, (edge ? 1 : -1) * widths[i]);
      view.toArray(attrs.position.array, i * 6 + edge * 3);
    }
  }
  attrs.position.needsUpdate = attrs.uv.needsUpdate = attrs.strength.needsUpdate = true;
  sheet.mesh.material.uniforms.exhaustTime.value = elapsed;
}

function updateGundamWake(wake, elapsed, camera) {
  wake.group.visible = elapsed > WAKE_START && elapsed < WAKE_END + WAKE_LIFE;
  if (!wake.group.visible) return;
  wake.group.position.copy(camera.position); wake.group.quaternion.copy(camera.quaternion);
  const { frame, point, direction } = wake, head = Math.min(elapsed, WAKE_END);
  for (const sheet of [wake.plume, wake.wisps]) {
    const plume = sheet === wake.plume, attrs = sheet.mesh.geometry.attributes;
    sheet.mesh.visible = !plume || elapsed < WAKE_END + .18;
    for (let i = 0; i <= sheet.segments; i++) {
      const along = i / sheet.segments;
      // Deterministic birth times allow seeking, slow frames and re-entry
      // without accumulating a second, stale trail.
      const sample = plume ? head : Math.max(WAKE_START, head - WAKE_LIFE * along);
      sheet.birthTimes[i] = sample;
      const age = plume ? along : Math.min(1, (elapsed - sample) / WAKE_LIFE);
      const track = flightTrack(sample), bank = flightBank(sample);
      frame.quaternion.set(0, 0, 0, 1); orientGundam(frame, track, bank);
      point.copy(wake.emitter).applyQuaternion(frame.quaternion).add(frame.position.fromArray(track.position));
      direction.fromArray(track.velocity);
      const boost = flightEase((direction.length() - 4.5) / 9);
      direction.normalize().negate();
      const distance = Math.max(0, -point.z - 3);
      const limit = distance * .68;
      const travel = (34 + boost * 62) * Math.max(0, elapsed - sample);
      const length = plume ? Math.min(3.4 + boost * 6, distance * .32) * along
        : limit * (1 - Math.exp(-travel / Math.max(.01, limit)));
      point.addScaledVector(direction, length);
      point.toArray(sheet.centers, i * 3);
      // Flow spreads the outer light. Its end is eroded in the shader rather
      // than drawn as a thin, bright line attached to the aircraft.
      sheet.widths[i] = plume ? (.09 + .48 * Math.sin(Math.PI * along)) * (.8 + boost * .3)
        : .16 + (1.0 + boost * .7) * along;
      let strength = flightEase((sample - WAKE_START) / .5) * flightEase((WAKE_END - sample) / .4)
        * flightEase((-point.z - 3) / 4) * Math.pow(Math.max(0, 1 - age), plume ? 1.2 : 1.8);
      if (plume) strength *= flightEase((WAKE_END + .18 - elapsed) / .18);
      else strength *= flightEase(along / .12) * (.5 + boost * .5);
      for (let edge = 0; edge < 2; edge++) {
        attrs.uv.array[i * 4 + edge * 2] = edge;
        attrs.uv.array[i * 4 + edge * 2 + 1] = along;
        attrs.strength.array[i * 2 + edge] = strength;
      }
    }
    writeExhaustSheet(wake, sheet, elapsed);
  }
}

export function buildGundam(T, buffer, texture) {
  const material = new T.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: new T.Color(.035, .045, .065), metalness: .3, roughness: .36, transparent: true });
  material.userData.craftLightProfile = 'gundam';
  // r108 includes defines in its program cache key. Keep this lighting variant
  // separate from the other crafts even when their compile callbacks match.
  material.defines = { GUNDAM_CRAFT_LIGHT: 1 };
  const raw = new T.Group();
  for (const d of DATA.meshes) {
    const source = new Int16Array(buffer, d.position, d.count * 3);
    const normals = new Int8Array(buffer, d.normal, d.count * 3);
    const uv = new Uint16Array(buffer, d.uv, d.count * 2);
    const positions = Float32Array.from(source, v => v / 32767 * DATA.extent);
    const geometry = new T.BufferGeometry();
    geometry.addAttribute('position', new T.BufferAttribute(positions, 3));
    geometry.addAttribute('normal', new T.BufferAttribute(normals, 3, true));
    geometry.addAttribute('uv', new T.BufferAttribute(uv, 2, true));
    geometry.setIndex(new T.BufferAttribute(new Uint16Array(buffer, d.index, d.indexCount), 1));
    const mesh = new T.Mesh(geometry, material); mesh.frustumCulled = false; raw.add(mesh);
  }
  // Source faces -Z. Fly almost prone: head leads, feet / soles trail
  // toward the observer after overtaking, with a slight side bank.
  // C's head / arms / bent leg are baked into the geometry; the shield and
  // weapon follow that pose. No runtime joint rig is needed.
  raw.rotation.set(-Math.PI * .47, .22, -.10);
  const model = new T.Group(); model.add(raw); model.scale.setScalar(2.8 / DATA.height);
  model.visible = false;
  return { model, raw, materials: [material], wake: buildGundamWake(T, raw, model.scale.x) };
}

export class VoyageGundam {
  constructor({ THREE, scene, readBuffer }) {
    this.THREE = THREE; this.scene = scene; this.readBuffer = readBuffer; this.generation = 0;
  }
  preload() {
    if (this.model || this.attempted) return this.pending || Promise.resolve();
    this.attempted = true;
    const T = this.THREE, generation = this.generation;
    const ready = this.readBuffer ? Promise.resolve() : new Promise((resolve, reject) => require('../../gundam-assets/ready.js', resolve, reject));
    const read = this.readBuffer || (() => new Promise((resolve, reject) => wx.getFileSystemManager().readFile({ filePath: 'gundam-assets/geometry.bin', success: r => resolve(r.data), fail: reject })));
    let texture;
    this.pending = ready.then(read).then(buffer => Promise.all([
      Promise.resolve(buffer),
      new Promise((resolve, reject) => new T.TextureLoader().load('/gundam-assets/basecolor.jpg', t => {
        texture = t; t.flipY = false; t.encoding = T.sRGBEncoding; resolve(t);
      }, undefined, reject))
    ])).then(([buffer, map]) => {
      if (generation !== this.generation) { map.dispose(); return; }
      Object.assign(this, buildGundam(T, buffer, map)); this.scene.add(this.model, this.wake.group);
    }).catch(error => {
      if (texture) texture.dispose();
      if (generation === this.generation) console.warn('[Moon] Gundam unavailable; skipping optional flyby', error);
    }).then(() => { if (generation === this.generation) this.pending = null; });
    return this.pending;
  }
  update(t, camera) {
    if (!this.model) return;
    this.model.visible = false;
    const e = t - 77.8;
    updateGundamWake(this.wake, e, camera);
    if (e < 0 || e >= FLIGHT_END) return;
    const track = flightTrack(e), bank = flightBank(e);
    this.model.position.fromArray(track.position)
      .applyQuaternion(camera.quaternion).add(camera.position);
    this.model.quaternion.copy(camera.quaternion);
    // Anticipate the left turn slightly; bank the chest toward the observer
    // instead of leaving the soles as the only readable surface.
    // Lift the leading shoulder into a diagonal instead of flattening the
    // silhouette across the frame. Ease into the bank with the curved flight.
    orientGundam(this.model, track, bank);
    this.materials[0].opacity = flightEase(FLIGHT_END - e);
    this.model.visible = true;
  }
  reset() {
    if (this.model) this.model.visible = false;
    if (this.wake) this.wake.group.visible = false;
  }
  dispose() {
    this.generation++; release(this.model); release(this.wake && this.wake.group);
    this.model = null; this.raw = null; this.wake = null;
    this.materials = []; this.pending = null; this.attempted = false;
  }
}
