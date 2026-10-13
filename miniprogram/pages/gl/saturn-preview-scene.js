import { SATURN_VERTEX, SATURN_FRAGMENT, RING_VERTEX, RING_FRAGMENT } from './saturn-preview-shaders.js';
import { PROFILE_SURFACE_FRAGMENT, PROFILE_RING_FRAGMENT, ATMOSPHERE_FRAGMENT } from './saturn-profile-shaders.js';
import { SATURN_LOOKS, DEFAULT_SATURN_LOOK } from './saturn-preview-looks.js';
import { createSaturnIceRing } from './saturn-ice-ring.js';
import { SATURN_VOYAGE_SUN } from './saturn-voyage-route.js';

// Reuses Three.js primitives and Spacekit's texture-radius ring rendering.
// A single factory is shared by the mini-program and optional offline reviews.
export function createSaturnPreviewScene(THREE, surface, ring, aspect, profiles, clouds = surface) {
  const scene = new THREE.Scene();
  // Keep the existing transparent native canvas composition for WXML overlays.
  const camera = new THREE.PerspectiveCamera(38, aspect, 0.008, 300);
  const planet = new THREE.Group();
  planet.rotation.set(0.08, 0.0, 0.42);
  scene.add(planet);
  planet.updateMatrixWorld(true);
  const inversePlanet = planet.quaternion.clone().inverse();
  const localLight = new THREE.Vector3();
  const localCamera = new THREE.Vector3();
  const shared = {
    profileTexture: { value: profiles }, lightDirection: { value: localLight }, localCamera: { value: localCamera },
    sunlight: { value: new THREE.Vector3() }, exposure: { value: 1 }, ambient: { value: .01 },
    atmosphere: { value: .2 }, ringGain: { value: 1 }, pixelAngle: { value: .001 }, spin: { value: 0 },
    elapsed: { value: 0 }, iceBlend: { value: 0 }, previewHeight: { value: 720 }, voyageBlend: { value: 0 }
  };
  // Native WebGL can composite above text in DevTools. Leave transparent,
  // softly feathered space at the review controls only during the ice encounter.
  function reviewFragment(shader, premultiplied = false) {
    return 'uniform float previewHeight;\n' + shader.replace(/gl_FragColor\s*=\s*[^;]+;/g, statement => `${statement}
      float screenY = gl_FragCoord.y / max(previewHeight, 1.0);
      float reviewFade = mix(1.0, smoothstep(.23, .30, screenY) * (1.0 - smoothstep(.86, .94, screenY)), iceBlend);
      gl_FragColor.a *= reviewFade;
      ${premultiplied ? 'gl_FragColor.rgb *= reviewFade;' : ''}
    `);
  }
  const surfaceMaterial = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { ...shared, sphereTexture: { value: surface }, ringTexture: { value: ring }, spin: { value: 0 } },
    vertexShader: SATURN_VERTEX, fragmentShader: reviewFragment('uniform float iceBlend;\n' + SATURN_FRAGMENT)
  });
  const sphere = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 96, 64), surfaceMaterial);
  sphere.scale.y = 0.902;
  planet.add(sphere);
  const oldRingMaterial = new THREE.ShaderMaterial({
    uniforms: { ...shared, ringTexture: { value: ring } },
    vertexShader: RING_VERTEX, fragmentShader: reviewFragment(RING_FRAGMENT),
    side: THREE.DoubleSide, transparent: true, depthWrite: false
  });
  const rings = new THREE.Mesh(new THREE.RingBufferGeometry(1.2363, 2.3294, 384, 4), oldRingMaterial);
  rings.rotation.x = -Math.PI / 2;
  planet.add(rings);
  const detailedSurface = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { ...shared, sphereTexture: { value: clouds } },
    extensions: { derivatives: true },
    vertexShader: SATURN_VERTEX, fragmentShader: reviewFragment('uniform float iceBlend;\n' + PROFILE_SURFACE_FRAGMENT)
  });
  const detailedRing = new THREE.ShaderMaterial({
    uniforms: shared, vertexShader: RING_VERTEX, fragmentShader: reviewFragment(PROFILE_RING_FRAGMENT, true),
    extensions: { derivatives: true },
    side: THREE.DoubleSide, transparent: true, depthWrite: false, premultipliedAlpha: true
  });
  const hazeMaterial = new THREE.ShaderMaterial({
    uniforms: shared, vertexShader: SATURN_VERTEX, fragmentShader: reviewFragment('uniform float iceBlend;\n' + ATMOSPHERE_FRAGMENT),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const haze = new THREE.Mesh(new THREE.SphereBufferGeometry(1.016, 64, 48), hazeMaterial);
  haze.scale.y = .902;
  planet.add(haze);
  const ice = createSaturnIceRing(THREE, shared);
  ice.material.fragmentShader = reviewFragment(ice.material.fragmentShader);
  planet.add(ice.mesh);
  const materials = [surfaceMaterial, oldRingMaterial, detailedSurface, detailedRing, hazeMaterial, ice.material];
  let lookKey = DEFAULT_SATURN_LOOK;
  function setLook(key) {
    const settings = SATURN_LOOKS[key];
    if (!settings) return;
    lookKey = key;
    localLight.set(...settings.light).normalize().applyQuaternion(inversePlanet);
    shared.sunlight.value.set(...settings.sun);
    for (const name of ['exposure', 'ambient', 'atmosphere', 'ringGain']) shared[name].value = settings[name];
    sphere.material = key === 'original' ? surfaceMaterial : detailedSurface;
    rings.material = key === 'original' ? oldRingMaterial : detailedRing;
    haze.visible = key !== 'original';
  }
  setLook(DEFAULT_SATURN_LOOK);

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

  function update(view, elapsed, currentAspect, viewportHeight = 720, pixelRatio = 1, voyage = null) {
    const voyageBlend = voyage ? voyage.blend : 0;
    const iceBlend = THREE.Math.lerp(Math.max(0, Math.min(1, view.ice || 0)), voyage ? voyage.ice : 0, voyageBlend);
    camera.aspect = currentAspect;
    camera.fov = THREE.Math.lerp(38 + (view.ice || 0) * 26, voyage ? voyage.fov : 38, voyageBlend);
    camera.updateProjectionMatrix();
    const radius = view.distance;
    camera.position.set(radius * Math.sin(view.yaw) * Math.cos(view.pitch), radius * Math.sin(view.pitch), radius * Math.cos(view.yaw) * Math.cos(view.pitch));
    const nearRadius = Math.max(2.40, Math.min(3.2, 2.48 + (radius - 6.8) * .12));
    const angle = view.yaw * .65 + Math.sin(elapsed * .06) * .018;
    const nearPosition = new THREE.Vector3(nearRadius * Math.sin(angle), .052 + view.pitch * .10 + Math.sin(elapsed * .10) * .003, nearRadius * Math.cos(angle)).applyQuaternion(planet.quaternion);
    camera.position.lerp(nearPosition, view.ice || 0);
    const focus = new THREE.Vector3(.38, -.10, 0).applyQuaternion(planet.quaternion).multiplyScalar(view.ice || 0);
    // Dragging changes the gaze, never the camera's safe orbital rail.
    if (voyage) {
      const position = new THREE.Vector3(...voyage.position);
      const direction = new THREE.Vector3(...voyage.focus).sub(position);
      direction.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(voyage.pitch, voyage.yaw, 0, 'YXZ')));
      const gaze = direction.add(position).applyQuaternion(planet.quaternion);
      camera.position.lerp(position.applyQuaternion(planet.quaternion), voyageBlend);
      focus.lerp(gaze, voyageBlend);
    }
    const settings = SATURN_LOOKS[lookKey];
    localLight.set(...settings.light).normalize().applyQuaternion(inversePlanet);
    localLight.lerp(new THREE.Vector3(...SATURN_VOYAGE_SUN).normalize(), voyageBlend).normalize();
    shared.ambient.value = THREE.Math.lerp(settings.ambient, .002, voyageBlend);
    shared.voyageBlend.value = voyageBlend;
    camera.lookAt(focus);
    localCamera.copy(camera.position).applyQuaternion(inversePlanet);
    shared.pixelAngle.value = 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, viewportHeight);
    shared.spin.value = elapsed * 0.002;
    shared.elapsed.value = elapsed;
    shared.iceBlend.value = iceBlend;
    shared.previewHeight.value = viewportHeight * pixelRatio;
    ice.mesh.visible = iceBlend > .01;
    surfaceMaterial.uniforms.spin.value = elapsed * 0.002;
  }
  function dispose() {
    scene.traverse(o => { o.geometry?.dispose?.(); if (o.isPoints) o.material.dispose(); });
    materials.forEach(material => material.dispose());
  }
  return { scene, camera, update, setLook, getLook: () => lookKey, iceCount: ice.count, dispose };
}
