import * as THREE from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { DRACOLoader } from './vendor/loaders/DRACOLoader.js';
import { FBXLoader } from './vendor/loaders/FBXLoader.js';
import { OrbitControls } from './vendor/controls/OrbitControls.js';

const models = [
  { id: 'mech', name: 'Mech Drone', type: '机械无人机', author: 'Willy Decarpentrie', format: 'glTF · 贴图', url: '/mech-encounter-candidates/mech-drone/scene.gltf', source: 'https://sketchfab.com/3d-models/mech-drone-8d06874aac5246c59edb4adbe3606e0e' },
  { id: 'shayan', name: 'Flying Robot', type: '飞行机器人', author: 'Shayan', format: 'GLB · 动画', url: '/mech-encounter-candidates/shayan-flying-robot/robot-extracted.glb', source: 'https://sketchfab.com/3d-models/futuristic-flying-animated-robot-low-poly-c5b92c281dc444448e64c0607719c7a2' },
  { id: 'eve', name: 'EVE from Wall-E', type: '角色机器人', author: 'mdv_mlhtr_dev_', format: 'GLB', url: '/mech-encounter-candidates/eve-from-wall-e/eve-from-wall-e.glb', source: 'https://sketchfab.com/3d-models/eve-from-wall-e-d23a3ce48b4e4fc9aa33340c3634330d' },
  { id: 'camera', name: 'Sci-Fi Camera Drone', type: '侦察无人机', author: '3dsofsan', format: 'GLB · 贴图 · 动画', url: '/mech-encounter-candidates/sci-fi-camera-drone/sci-fi-camera-drone.glb', source: 'https://sketchfab.com/3d-models/sci-fi-camera-drone-3dbf07385d1b471a96dce6de6cba97d6' },
  { id: 'luminaris', name: 'Luminaris Starship', type: '科幻星舰', author: 'iggy-design', format: 'FBX · 贴图', url: '/mech-encounter-candidates/luminaris-starship/luminaris-starship.fbx', source: 'https://sketchfab.com/3d-models/luminaris-starship-b8001c7cf83240f383ccdbe75094e468' },
  { id: 'rx78-2', name: 'RX-78-2 Gundam', type: '高精细人形机甲', author: 'AnonmalyFound / BlendKit', format: 'GLB · 贴图', url: '/rx78-2-anonmalyfound/rx78_refined.glb', source: 'https://www.blendkit.com/asset-gallery-detail/a6a1000b-3b72-48bb-be81-6f4ab36fabda/' },
  { id: 'exia', name: 'Gundam Exia', type: '高精细人形机甲', author: 'yqms / Sketchfab', format: 'GLB · 顶点色 · PBR', url: '/gundam-exia-yqms/exia_refined.glb', source: 'https://sketchfab.com/3d-models/gundam-exia-de3a7fec6d9347108720e0e816c40985' },
  { id: 'zaku-desert', name: 'Desert Zaku MK-II', type: '高精细人形机甲', author: 'AnonmalyFound / BlendKit', format: 'GLB · PBR 贴图', url: '/zaku-desert-anonmalyfound/zaku_desert_refined.glb', source: 'https://www.blendkit.com/asset-gallery-detail/ebee94b8-5e10-4b96-947b-7788145feaf5/' },
  { id: 'freedom', name: 'Strike Freedom Gundam', type: '高精细人形机甲', author: 'K0077 / Sketchfab', format: 'GLB · 内嵌 PBR 贴图', url: '/freedom-gundam-k0077/freedom_refined.glb', source: 'https://sketchfab.com/3d-models/strike-freedom-gundam-0d5a236cdb164c5094a8d296d9352943' },
  { id: 'unicorn', name: 'RX-0 Unicorn Gundam', type: '高精细人形机甲', author: 'kurojishi / Sketchfab', format: 'GLB · 80 张外置贴图', url: '/unicorn-gundam-kurojishi/unicorn_refined.glb', source: 'https://sketchfab.com/3d-models/gundam-unicorn-1410ff9dd1c94807a00b8a0936170196' },
  { id: 'ronin', name: 'RONIN / 04', type: '高精细人形机甲', author: 'Ramon Linares', format: 'GLB · 内嵌 PBR · 12 组动画', url: '/ronin-04-ramonlinares/ronin-04.glb', source: 'https://github.com/RamonLinares/atlas-09/blob/1b8fb9d54160215c071c5a29a49b1c36dc01f0df/public/models/ronin-04.glb' },
  { id: 'chandra', name: 'Chandra X-ray Observatory', type: '空间望远镜', author: 'NASA 3D Resources', format: 'GLB · Draco · 贴图', url: '/chandra-x-ray-observatory-nasa/Chandra X-ray Observatory.glb', source: 'https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Chandra%20X-ray%20Observatory' },
  { id: 'magellan', name: 'Magellan', type: '金星探测器', author: 'NASA 3D Resources', format: 'GLB · Draco · 贴图', url: '/magellan-nasa/Magellan.glb', source: 'https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Magellan' },
  { id: 'stardust', name: 'Stardust', type: '彗星采样探测器', author: 'NASA 3D Resources', format: 'GLB · Draco · 贴图', url: '/stardust-nasa/Stardust.glb', source: 'https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Stardust' },
  { id: 'parker', name: 'Parker Solar Probe', type: '太阳探测器', author: 'NASA 3D Resources', format: 'GLB · Draco · 贴图', url: '/parker-solar-probe-nasa/Parker Solar Probe.glb', source: 'https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Parker%20Solar%20Probe' },
  { id: 'ingenuity', name: 'Ingenuity Mars Helicopter', type: '旋翼飞行器', author: 'NASA 3D Resources', format: 'GLB · Draco · 贴图', url: '/ingenuity-mars-helicopter-nasa/Ingenuity Mars Helicopter.glb', source: 'https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Ingenuity%20Mars%20Helicopter' },
  { id: 'webb', name: 'James Webb Space Telescope (A)', type: '空间望远镜', author: 'NASA 3D Resources', format: 'GLB · Draco', url: '/james-webb-space-telescope-a-nasa/James Webb Space Telescope (A).glb', source: 'https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/James%20Webb%20Space%20Telescope%20(A)' },
  { id: 'juno', name: 'Juno (A)', type: '木星探测器', author: 'NASA 3D Resources', format: 'GLB · Draco · 贴图', url: '/juno-a-nasa/Juno (A).glb', source: 'https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Juno%20(A)' },
];

const dracoLoader = new DRACOLoader().setDecoderPath('./vendor/libs/draco/gltf/');
const gltfLoader = new GLTFLoader().setDRACOLoader(dracoLoader);

const $ = (selector) => document.querySelector(selector);
const canvas = $('#canvas');
const stage = $('#stage');
const status = $('#status');
const loading = $('#loading');
const list = $('#model-list');
const resetButton = $('#reset');
const rotateButton = $('#rotate');
const animateButton = $('#animate');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 2.1;
controls.maxDistance = 18;
controls.enablePan = false;
scene.add(new THREE.HemisphereLight(0xc6e7ff, 0x2b3c5c, 2.3));
const key = new THREE.DirectionalLight(0xffffff, 3.1);
key.position.set(4, 7, 8);
scene.add(key);
const rim = new THREE.DirectionalLight(0x77cfff, 2.2);
rim.position.set(-6, 1, -5);
scene.add(rim);

let current = null;
let mixer = null;
let loadSequence = 0;
let animating = true;
const clock = new THREE.Clock();

function setStatus(message, kind = 'normal') {
  status.textContent = message;
  status.dataset.kind = kind;
}

function setLoading(message) {
  loading.textContent = message;
  loading.hidden = false;
}

function resetView() {
  camera.position.set(5.1, 2.9, 7.4);
  controls.target.set(0, 0, 0);
  controls.update();
}

function disposeObject(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
      material.dispose();
    }
  });
}

function displayObject(object, animations = []) {
  if (current) {
    scene.remove(current);
    disposeObject(current);
  }
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  if (!Number.isFinite(size.length()) || size.length() === 0) throw new Error('模型没有可显示的几何体');
  object.position.sub(center);
  const group = new THREE.Group();
  group.scale.setScalar(3.9 / Math.max(size.x, size.y, size.z));
  group.add(object);
  scene.add(group);
  current = group;
  mixer = animations.length ? new THREE.AnimationMixer(object) : null;
  if (mixer) mixer.clipAction(animations[0]).play();
  animateButton.disabled = !mixer;
  animateButton.style.opacity = mixer ? '1' : '.45';
  animateButton.textContent = mixer ? (animating ? '暂停动画' : '播放动画') : '无动画';
  resetView();
}

async function loadStarship() {
  const base = '/mech-encounter-candidates/luminaris-starship/';
  const textureNames = {
    'Luminaris Diffuse.jpg': 'Luminaris_Diffuse.tga.png',
    'Luminaris Normal.jpg': 'Luminaris_Normal.tga.png',
    'Luminaris Specular.jpg': 'Luminaris_Specular.tga.png',
    'Luminaris Emissive.jpg': 'Luminaris_Emissive.tga.png',
  };
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    const name = decodeURIComponent(url).split(/[\\/]/).pop();
    return textureNames[name] ? base + textureNames[name] : url;
  });
  const object = await new FBXLoader(manager).loadAsync(base + 'luminaris-starship.fbx');
  const textureLoader = new THREE.TextureLoader();
  const [map, normalMap, roughnessMap, emissiveMap] = await Promise.all([
    'Luminaris_Diffuse.tga.png', 'Luminaris_Normal.tga.png',
    'Luminaris_roughness.tga.png', 'Luminaris_Emissive.tga.png',
  ].map((name) => textureLoader.loadAsync(base + name)));
  map.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  object.traverse((child) => {
    if (!child.isMesh) return;
    const old = child.material;
    child.material = new THREE.MeshStandardMaterial({
      map, normalMap, roughnessMap, emissiveMap,
      emissive: new THREE.Color(0x626262), metalness: 0.28, side: THREE.DoubleSide,
    });
    for (const material of Array.isArray(old) ? old : [old]) material?.dispose();
  });
  return { object, animations: object.animations || [] };
}

async function loadMech() {
  const gltf = await gltfLoader.loadAsync('/mech-encounter-candidates/mech-drone/scene.gltf');
  // 这份旧 glTF 使用 KHR_materials_pbrSpecularGlossiness；新版 Three.js 已不读取该扩展。
  // 从同一份源素材的贴图恢复预览材质，不修改原模型文件。
  const textureLoader = new THREE.TextureLoader();
  const base = '/mech-encounter-candidates/mech-drone/textures/';
  const [robotMap, robotNormal, robotEmissive, fireMap] = await Promise.all([
    'Robot_diffuse.jpeg', 'Robot_normal.jpeg', 'Robot_emissive.jpeg', 'Fire_diffuse.png',
  ].map((name) => textureLoader.loadAsync(base + name)));
  for (const texture of [robotMap, robotNormal, robotEmissive, fireMap]) texture.flipY = false;
  robotMap.colorSpace = THREE.SRGBColorSpace;
  robotEmissive.colorSpace = THREE.SRGBColorSpace;
  fireMap.colorSpace = THREE.SRGBColorSpace;
  gltf.scene.traverse((child) => {
    if (!child.isMesh) return;
    const replace = (material) => {
      const result = material.name === 'Fire'
        ? new THREE.MeshBasicMaterial({ map: fireMap, transparent: true, opacity: .6, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
        : new THREE.MeshStandardMaterial({ map: robotMap, normalMap: robotNormal, emissiveMap: robotEmissive, emissive: 0x343434, metalness: .38, roughness: .66 });
      material.dispose();
      return result;
    };
    child.material = Array.isArray(child.material) ? child.material.map(replace) : replace(child.material);
  });
  return { object: gltf.scene, animations: gltf.animations };
}

async function selectModel(index) {
  const model = models[index];
  const sequence = ++loadSequence;
  for (const button of list.children) button.setAttribute('aria-pressed', String(Number(button.dataset.index) === index));
  $('#detail-index').textContent = `OBJECT ${String(index + 1).padStart(2, '0')} / ${String(models.length).padStart(2, '0')}`;
  $('#detail-title').textContent = model.name;
  $('#detail-meta').textContent = `${model.type}  ·  作者 ${model.author}  ·  ${model.format}`;
  $('#source-link').href = model.source;
  setStatus('读取中');
  setLoading(`正在读取 ${model.name}…`);
  try {
    const loaded = model.id === 'luminaris'
      ? await loadStarship()
      : model.id === 'mech'
        ? await loadMech()
        : await gltfLoader.loadAsync(model.url).then((gltf) => ({ object: gltf.scene, animations: gltf.animations }));
    if (sequence !== loadSequence) {
      disposeObject(loaded.object);
      return;
    }
    displayObject(loaded.object, loaded.animations);
    loading.hidden = true;
    setStatus('模型已加载');
    history.replaceState(null, '', `#${model.id}`);
  } catch (error) {
    if (sequence !== loadSequence) return;
    console.error(error);
    setStatus('加载失败', 'error');
    setLoading(`加载失败：${error.message}`);
  }
}

models.forEach((model, index) => {
  const button = document.createElement('button');
  button.className = 'model-choice';
  button.type = 'button';
  button.dataset.index = index;
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = `<span class="num">${String(index + 1).padStart(2, '0')}</span><span><span class="choice-name"></span><span class="choice-type"></span></span><span class="choice-arrow">↗</span>`;
  button.querySelector('.choice-name').textContent = model.name;
  button.querySelector('.choice-type').textContent = model.type;
  button.addEventListener('click', () => selectModel(index));
  list.append(button);
});

resetButton.addEventListener('click', resetView);
rotateButton.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  controls.autoRotateSpeed = 1.1;
  rotateButton.setAttribute('aria-pressed', String(controls.autoRotate));
});
animateButton.addEventListener('click', () => {
  animating = !animating;
  animateButton.setAttribute('aria-pressed', String(animating));
  animateButton.textContent = animating ? '暂停动画' : '播放动画';
});

function resize() {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
new ResizeObserver(resize).observe(stage);
resize();
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), .05);
  if (animating) mixer?.update(delta);
  controls.update();
  renderer.render(scene, camera);
});
const requestedModel = new URLSearchParams(location.search).get('model') || location.hash.slice(1);
const initial = models.findIndex((model) => model.id === requestedModel);
selectModel(initial < 0 ? 0 : initial);
