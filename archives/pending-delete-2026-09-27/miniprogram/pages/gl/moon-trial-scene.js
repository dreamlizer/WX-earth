import { fixTexture } from './asset-manager.js';
import { SCORPIO_DATA } from './moon-voyage-zodiac-data.js';

// 独立叙事场景：固定地月位置，按音频时间推进旅行镜头。
export function createMoonTrialScene(THREE, isPC) {
  const scene = new THREE.Scene();
  // 延续主画布的透明背景，由页面提供黑底，避免遮住小程序浮层。
  const camera = new THREE.PerspectiveCamera(55, 0.46, 0.1, 250);
  // 少量补光只保留暗面轮廓；地月共用固定世界方向的太阳光，不跟随镜头。
  scene.add(new THREE.AmbientLight(0xffffff, 0.018));
  const sun = new THREE.DirectionalLight(0xfff5e6, 1.35);
  sun.name = 'TRIAL_SUN';
  sun.position.set(10, 0, 0);
  scene.add(sun);

  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48),
    new THREE.MeshLambertMaterial({ color: 0xdddddd }));
  moon.name = 'TRIAL_MOON';
  moon.rotation.y = 0.5;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(2.6, 48, 32),
    new THREE.MeshLambertMaterial({ color: new THREE.Color(1.8, 1.8, 1.8), toneMapped: false }));
  earth.name = 'TRIAL_EARTH';
  // MV 采用视觉夸张：远地球约占竖屏宽度的 14%，仍保持固定世界位置。
  earth.position.set(0, 0, -40);
  earth.rotation.y = 1.0;
  moon.visible = earth.visible = false;
  scene.add(moon, earth);

  // 圆形柔边星点提供纵深，不增加后处理或阴影贴图。
  let seed = 73;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const positions = [];
  for (let i = 0; i < 2200; i++) {
    // 同一批星点中加入倾斜银河带，保持单次绘制。
    const y = i < 1400 ? random() * 2 - 1 : (random() + random() + random() - 1.5) * 0.16;
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    positions.push(90 * r * Math.cos(a), 90 * y, 90 * r * Math.sin(a));
  }
  const starsGeometry = new THREE.BufferGeometry();
  starsGeometry.addAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const stars = new THREE.Points(starsGeometry,
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'varying float vGlow; void main(){vec4 p=modelViewMatrix*vec4(position,1.0);vGlow=0.3+0.7*fract(abs(position.x*13.17+position.y*7.31));gl_PointSize=2.0+vGlow*2.2;gl_Position=projectionMatrix*p;}',
      fragmentShader: 'varying float vGlow; void main(){float r=length(gl_PointCoord-0.5)*2.0;float a=(1.0-smoothstep(0.05,1.0,r))*vGlow;if(a<0.01)discard;gl_FragColor=vec4(0.72,0.81,0.95,a);}'
    }));
  stars.rotation.z = 0.48;
  scene.add(stars);

  // 沿途只显影一组已有星座，细线逐渐退去，不增加标签或面板。
  const constellation = new THREE.Group();
  const constellationPositions = [];
  const constellationLines = [];
  const starPoint = p => [(p.x - 0.5) * 16, (p.y - 0.5) * 16, 0];
  SCORPIO_DATA.points.forEach(p => constellationPositions.push(...starPoint(p)));
  SCORPIO_DATA.lines.forEach(([a, b]) => constellationLines.push(...starPoint(SCORPIO_DATA.points[a]), ...starPoint(SCORPIO_DATA.points[b])));
  const constellationGeometry = new THREE.BufferGeometry();
  constellationGeometry.addAttribute('position', new THREE.Float32BufferAttribute(constellationPositions, 3));
  const constellationMaterial = stars.material.clone();
  constellationMaterial.uniforms = { opacity: { value: 0 } };
  constellationMaterial.fragmentShader = constellationMaterial.fragmentShader.replace('varying float vGlow;', 'uniform float opacity; varying float vGlow;').replace('0.95,a)', '0.95,a*opacity)');
  const constellationStars = new THREE.Points(constellationGeometry, constellationMaterial);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.addAttribute('position', new THREE.Float32BufferAttribute(constellationLines, 3));
  const constellationEdges = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: 0x92afcf, transparent: true, opacity: 0, depthWrite: false }));
  constellation.add(constellationStars, constellationEdges);
  constellation.name = 'TRIAL_CONSTELLATION';
  // 世界中的固定星座面朝接近月球的来向，镜头掠过而不是跟着镜头漂移。
  constellation.position.set(7, 7, 12);
  constellation.lookAt(new THREE.Vector3(-6, 1, -13));
  scene.add(constellation);

  // 现有白底伴飞素材在渲染时去白，仅在中远景出现一次。
  const companionMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { map: { value: null }, opacity: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform sampler2D map; uniform float opacity; varying vec2 vUv; void main(){vec4 c=texture2D(map,vUv);float a=(1.0-smoothstep(0.78,0.95,min(c.r,min(c.g,c.b))))*opacity;if(a<0.02)discard;gl_FragColor=vec4(pow(c.rgb,vec3(0.4545)),a);}'
  });
  const companion = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1), companionMaterial);
  companion.name = 'TRIAL_COMPANION';
  companion.visible = false;
  scene.add(companion);
  const textures = [];
  let disposed = false;
  let cancelLoad;
  const textureReady = new Promise((resolve, reject) => {
    let remaining = 3;
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else { moon.visible = earth.visible = true; resolve(); }
    };
    const timeout = setTimeout(() => finish(new Error('试航贴图加载超时')), 8000);
    cancelLoad = () => finish(new Error('试航已取消'));
    const loader = new THREE.TextureLoader();
    for (const [mesh, src] of [[moon, '/assets/textures/refined-moon.jpg'], [earth, '/assets/textures/trial-earth.jpg'], [companion, '/assets/textures/trial-companion.png']]) {
      const texture = loader.load(src, (loaded) => {
        if (disposed || settled) return;
        loaded.encoding = THREE.sRGBEncoding;
        if (mesh === moon || mesh === earth) fixTexture(loaded, isPC);
        loaded.minFilter = THREE.LinearFilter;
        loaded.generateMipmaps = false;
        mesh.material.needsUpdate = true;
        if (--remaining === 0) finish();
      }, undefined, () => finish(new Error('试航贴图加载失败')));
      textures.push(texture);
      if (mesh === companion) companionMaterial.uniforms.map.value = texture;
      else mesh.material.map = texture;
    }
  });

  const ready = textureReady;

  const towardMoon = new THREE.Vector3();
  const towardEarth = new THREE.Vector3();
  const target = new THREE.Vector3();
  const lookCamera = new THREE.PerspectiveCamera();
  const turnStart = new THREE.Quaternion();
  const turnEnd = new THREE.Quaternion();
  const smooth = (t, a, b) => { const p = Math.max(0, Math.min(1, (t-a)/(b-a))); return p*p*(3-2*p); };
  const move = (a, b, p) => camera.position.set(a[0]+(b[0]-a[0])*p, a[1]+(b[1]-a[1])*p, a[2]+(b[2]-a[2])*p);
  const orbit = (angle, radius, y) => camera.position.set(radius*Math.sin(angle), y, radius*Math.cos(angle));
  const update = (seconds, aspect) => {
    if (disposed) return;
    // 音乐段落映射到连续空间轨迹；结尾停留，等待真实音频结束。
    const cues = [[0, 0], [38, 12], [74, 22], [113, 36], [156, 49], [221, 65], [245, 77], [263, 78]];
    const time = Math.max(0, seconds);
    let t = 78;
    for (let i = 1; i < cues.length; i++) {
      if (time <= cues[i][0]) {
        const a = cues[i - 1], b = cues[i];
        t = a[1] + (b[1] - a[1]) * (time - a[0]) / (b[0] - a[0]);
        break;
      }
    }
    const constellationAlpha = smooth(time, 76, 86) * (1 - smooth(time, 106, 120));
    constellation.visible = constellationAlpha > 0;
    constellationMaterial.uniforms.opacity.value = constellationAlpha * 0.85;
    constellationEdges.material.opacity = constellationAlpha * 0.14;
    moon.rotation.y = 0.5 + time * 0.003;
    earth.rotation.y = 1.0 + Math.PI + time * 0.002;
    const ratio = Math.max(0.2, aspect);
    const fov = 2 * Math.atan(Math.tan(25 * Math.PI / 180) / Math.min(ratio, 0.75)) * 180 / Math.PI;
    if (camera.aspect !== ratio || camera.fov !== fov) {
      camera.aspect = ratio;
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (t < 12) {
      move([0, 0.3, -36], [-5, 1, -26], smooth(t, 0, 12));
      camera.lookAt(earth.position);
    } else if (t < 22) {
      move([-5, 1, -26], [-6, 1, -13], smooth(t, 12, 22));
      lookCamera.position.copy(camera.position);
      lookCamera.lookAt(earth.position); turnStart.copy(lookCamera.quaternion);
      lookCamera.lookAt(moon.position); turnEnd.copy(lookCamera.quaternion);
      camera.quaternion.copy(turnStart).slerp(turnEnd, smooth(t, 12, 22));
    } else if (t < 36) {
      move([-6, 1, -13], [-3.39411255, 0.2, -3.39411255], smooth(t, 22, 36));
      camera.lookAt(moon.position);
    } else if (t < 49) {
      orbit(-Math.PI*0.75 + (Math.PI*0.75-0.52)*smooth(t, 36, 49), 4.8, 0.2*(1-smooth(t, 36, 49)));
    } else if (t < 65) {
      // 遮挡段采用平滑轨迹，完整遮挡停留约四秒，两端与前后镜头平滑衔接。
      orbit(-0.52 + 1.04*smooth(t, 49, 65), 4.8, 0);
    } else {
      const p = smooth(t, 65, 77);
      const a = p*Math.PI/2;
      camera.position.set(4.8*Math.sin(0.52)*Math.cos(a), 1.35*Math.sin(a), 4.8*Math.cos(0.52)*(1-p)+1.5*p);
    }
    if (t >= 36) {
      towardMoon.copy(moon.position).sub(camera.position).normalize();
      towardEarth.copy(earth.position).sub(camera.position).normalize();
      const reveal = smooth(t, 40, 49)*0.5;
      target.copy(towardMoon).multiplyScalar(1-reveal).addScaledVector(towardEarth, reveal).normalize();
      if (t >= 65) {
        towardEarth.set(0, -6, -40).sub(camera.position).normalize();
        target.lerp(towardEarth, smooth(t, 65, 77)).normalize();
      }
      camera.lookAt(target.add(camera.position));
    }
    const companionAlpha = smooth(t, 17, 20)*(1-smooth(t, 29, 33));
    companion.visible = companionAlpha > 0 && !disposed;
    companionMaterial.uniforms.opacity.value = companionAlpha;
    if (companion.visible) {
      const p = smooth(t, 17, 33);
      // 角色保持在相机前侧，短暂同行后向月球方向退远。
      const distance = 3 + 5*smooth(t, 26, 33);
      const halfH = distance*Math.tan(camera.fov*Math.PI/360);
      companion.position.set((0.65-0.45*p)*halfH*ratio, -0.27*halfH+Math.sin(t*0.6)*0.015, -distance)
        .applyQuaternion(camera.quaternion).add(camera.position);
      companion.quaternion.copy(camera.quaternion);
      companion.scale.setScalar(halfH*0.3*(1-0.7*smooth(t, 26, 33)));
    }
  };
  update(0, 0.46);

  return {
    scene, camera, ready, update,
    render(renderer) {
      const autoClear = renderer.autoClear;
      const gammaOutput = renderer.gammaOutput;
      const gammaFactor = renderer.gammaFactor;
      try {
        renderer.setRenderTarget(null);
        renderer.autoClear = true;
        // 此小程序适配包的实际渲染器仍使用 gammaOutput，而非 outputEncoding。
        renderer.gammaOutput = true;
        renderer.gammaFactor = 2.2;
        renderer.render(scene, camera);
      } finally {
        renderer.autoClear = autoClear;
        renderer.gammaOutput = gammaOutput;
        renderer.gammaFactor = gammaFactor;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelLoad();
      // 全部是本场景自己加载/创建的资源，不借用原地球的 Texture 或 Material。
      scene.remove(constellation);
      textures.forEach(texture => texture.dispose());
      for (const mesh of [moon, earth, stars, companion, constellationStars, constellationEdges]) {
        mesh.geometry.dispose();
        mesh.material.dispose();
        scene.remove(mesh);
      }
    }
  };
}

