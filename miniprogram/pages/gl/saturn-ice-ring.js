// Local near-camera ice, built from Three.js primitives. Artistic particle scale;
// not a simulation of the measured size/density of Saturn's rings.
export function createSaturnIceRing(THREE, uniforms) {
  let seed = 81937;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const primitive = new THREE.IcosahedronBufferGeometry(1, 0);
  const source = primitive.index ? primitive.toNonIndexed() : primitive;
  const detailedPrimitive = new THREE.IcosahedronBufferGeometry(1, 1);
  const detailedSource = detailedPrimitive.index ? detailedPrimitive.toNonIndexed() : detailedPrimitive;
  const positions = [], normals = [], centers = [], grains = [], patches = [];
  const point = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const normal = new THREE.Vector3(), edge = new THREE.Vector3();
  for (let i = 0; i < 1900; i++) {
    // Extra foreground density is confined to a short patch, not the full ring.
    const foreground = i >= 1300;
    const angle = foreground ? (random() - .5) * .72 : random() * Math.PI * 2;
    let radius = foreground ? 1.96 + random() * .35 : Math.sqrt(1.30 ** 2 + random() * (2.32 ** 2 - 1.30 ** 2));
    if (radius > 1.94 && radius < 2.02) radius -= .09; // Cassini division.
    const center = [Math.sin(angle) * radius, (random() - .5) * .026, Math.cos(angle) * radius];
    const size = .0017 + Math.pow(random(), 3) * .010;
    const p = (size > .007 ? detailedSource : source).attributes.position;
    const scale = [size * (.65 + random() * .8), size * (.45 + random() * .65), size * (.65 + random() * .8)];
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(random() * 6.28, random() * 6.28, random() * 6.28));
    const tint = random();
    // Shared corners keep pieces closed, with irregular silhouettes and flat faces.
    const cornerScale = new Map();
    const vertices = [];
    for (let j = 0; j < p.count; j++) {
      point.fromBufferAttribute(p, j);
      const key = `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.z.toFixed(4)}`;
      if (!cornerScale.has(key)) cornerScale.set(key, .89 + random() * .22);
      point.multiplyScalar(cornerScale.get(key));
      point.set(point.x * scale[0], point.y * scale[1], point.z * scale[2]).applyQuaternion(rotation);
      vertices.push(point.clone());
    }
    for (let j = 0; j < vertices.length; j += 3) {
      a.copy(vertices[j]); b.copy(vertices[j + 1]); c.copy(vertices[j + 2]);
      normal.subVectors(b, a).cross(edge.subVectors(c, a)).normalize();
      for (const v of [a, b, c]) {
        positions.push(v.x, v.y, v.z);
        point.copy(v).normalize().lerp(normal, .45).normalize();
        normals.push(point.x, point.y, point.z);
        centers.push(...center);
        grains.push(tint);
        patches.push(foreground ? 1 : 0);
      }
    }
  }
  if (source !== primitive) source.dispose();
  primitive.dispose();
  if (detailedSource !== detailedPrimitive) detailedSource.dispose();
  detailedPrimitive.dispose();
  const geometry = new THREE.BufferGeometry();
  const attribute = (name, array, size) => geometry.addAttribute(name, new THREE.Float32BufferAttribute(array, size));
  attribute('position', positions, 3); attribute('normal', normals, 3);
  attribute('iceCenter', centers, 3); attribute('grain', grains, 1);
  attribute('icePatch', patches, 1);
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: true,
    vertexShader: `
      attribute vec3 iceCenter;
      attribute float grain;
      attribute float icePatch;
      uniform float elapsed, voyageBlend;
      varying vec3 vIcePosition, vIceNormal, vFacet;
      varying float vGrain;
      void main() {
        float radius = length(iceCenter.xz);
        // Distribute the review's front patch around the ring during a voyage,
        // so actual pieces continue past the camera along the full route.
        float orbit = elapsed * .006 / pow(radius, 1.5) + icePatch * grain * 6.283185 * voyageBlend;
        float turn = elapsed * (.035 + grain * .05);
        mat2 spin = mat2(cos(turn), -sin(turn), sin(turn), cos(turn));
        mat2 drift = mat2(cos(orbit), -sin(orbit), sin(orbit), cos(orbit));
        vec3 offset = position; offset.xz = spin * offset.xz;
        vec3 center = iceCenter; center.xz = drift * center.xz;
        vIcePosition = center + offset;
        vIceNormal = normal; vIceNormal.xz = spin * normal.xz;
        vFacet = position * 260.0;
        vGrain = grain;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(vIcePosition, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 lightDirection, localCamera, sunlight;
      uniform float iceBlend, exposure;
      varying vec3 vIcePosition, vIceNormal, vFacet;
      varying float vGrain;
      void main() {
        float distanceToEye = length(localCamera - vIcePosition);
        float coverage = iceBlend * (1.0 - smoothstep(.32, .95, distanceToEye)) * smoothstep(.012, .032, distanceToEye);
        if (coverage < .015) discard;
        vec3 n = normalize(vIceNormal), l = normalize(lightDirection);
        vec3 eye = normalize(localCamera - vIcePosition);
        float diffuse = max(dot(n, l), 0.0);
        vec3 p = vIcePosition / vec3(1.0, .902, 1.0);
        vec3 shadowLight = normalize(l / vec3(1.0, .902, 1.0));
        float along = dot(p, shadowLight);
        float shade = along < 0.0 ? smoothstep(.985, 1.02, length(p - shadowLight * along)) : 1.0;
        float fissure = smoothstep(.04, .12, abs(sin(vFacet.x * 2.3 + sin(vFacet.z * 1.4))));
        float frost = .93 + .07 * sin(vFacet.x * 37.0 + sin(vFacet.y * 31.0) + vFacet.z * 19.0);
        vec3 ice = mix(vec3(.30, .37, .43), vec3(.78, .84, .88), vGrain) * mix(.86, 1.0, fissure) * frost;
        float glint = pow(max(dot(n, normalize(l + eye)), 0.0), 24.0) * .16;
        float scatter = pow(1.0 - max(dot(n, eye), 0.0), 3.0) * .06;
        vec3 radiance = ice * (vec3(.045, .064, .085) + sunlight * diffuse * shade) + sunlight * (glint + scatter) * shade;
        gl_FragColor = vec4(pow(vec3(1.0) - exp(-radiance * exposure), vec3(1.0 / 2.2)), coverage);
      }
    `
  });
  const mesh = new THREE.Mesh(geometry, material);
  // Vertices contain offsets; centers are expanded in the shader.
  mesh.frustumCulled = false;
  mesh.visible = false;
  return { mesh, material, count: 1900 };
}
