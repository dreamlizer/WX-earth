import { SATURN_VERTEX, SATURN_FRAGMENT, RING_VERTEX, RING_FRAGMENT } from './saturn-preview-shaders.js';

// Reuses Three.js primitives and Spacekit's texture-radius ring rendering.
// A single factory is shared by the mini-program and optional offline reviews.
export function createSaturnPreviewScene(THREE, surface, ring, aspect) {
  const scene = new THREE.Scene();
  // Keep the existing transparent native canvas composition for WXML overlays.
  const camera = new THREE.PerspectiveCamera(38, aspect, 0.05, 300);
  const planet = new THREE.Group();
  planet.rotation.set(0.08, 0.0, 0.42);
  scene.add(planet);
  const worldLight = new THREE.Vector3(-3.8, 2.6, 5.0).normalize();
  planet.updateMatrixWorld(true);
  const localLight = worldLight.clone().applyQuaternion(planet.quaternion.clone().inverse());
  const surfaceMaterial = new THREE.ShaderMaterial({
    uniforms: { sphereTexture: { value: surface }, ringTexture: { value: ring }, lightDirection: { value: localLight }, spin: { value: 0 } },
    vertexShader: SATURN_VERTEX, fragmentShader: SATURN_FRAGMENT
  });
  const sphere = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 96, 64), surfaceMaterial);
  sphere.scale.y = 0.902;
  planet.add(sphere);
  const rings = new THREE.Mesh(new THREE.RingBufferGeometry(1.24, 2.32, 256, 4), new THREE.ShaderMaterial({
    uniforms: { ringTexture: { value: ring }, lightDirection: { value: localLight } },
    vertexShader: RING_VERTEX, fragmentShader: RING_FRAGMENT,
    side: THREE.DoubleSide, transparent: true, depthWrite: false
  }));
  rings.rotation.x = -Math.PI / 2;
  planet.add(rings);

  // Sparse stars, one draw call; deterministic so screenshots can be compared.
  let seed = 7421;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const vertices = [], colors = [];
  for (let i = 0; i < 750; i++) {
    const z = rand() * 2 - 1, angle = rand() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    vertices.push(90 * r * Math.cos(angle), 90 * z, 90 * r * Math.sin(angle));
    const intensity = 0.15 + Math.pow(rand(), 3) * 0.5;
    colors.push(intensity * 0.9, intensity * 0.94, intensity);
  }
  const starsGeometry = new THREE.BufferGeometry();
  const addAttribute = (name, data) => {
    const attribute = new THREE.Float32BufferAttribute(data, 3);
    if (starsGeometry.setAttribute) starsGeometry.setAttribute(name, attribute);
    else starsGeometry.addAttribute(name, attribute);
  };
  addAttribute('position', vertices);
  addAttribute('color', colors);
  scene.add(new THREE.Points(starsGeometry, new THREE.PointsMaterial({ size: 0.065, vertexColors: THREE.VertexColors, transparent: true, opacity: 0.65, depthWrite: false })));

  function update(view, elapsed, currentAspect) {
    camera.aspect = currentAspect;
    camera.updateProjectionMatrix();
    const radius = view.distance;
    camera.position.set(radius * Math.sin(view.yaw) * Math.cos(view.pitch), radius * Math.sin(view.pitch), radius * Math.cos(view.yaw) * Math.cos(view.pitch));
    camera.lookAt(0, 0, 0);
    surfaceMaterial.uniforms.spin.value = elapsed * 0.002;
  }
  function dispose() {
    scene.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  }
  return { scene, camera, update, dispose };
}
