// 最终优化版：集成 kdbush 索引，解决点击延迟和错位问题
import { createScopedThreejs } from 'threejs-miniprogram';
import KDBush from '../../libs/kdbush.min.js'; // [优化] 导入 kdbush 库

Page({
  onLoad() {
    const sys = wx.getSystemInfoSync()
    const isPC = sys.platform === 'windows' || sys.platform === 'mac' || sys.platform === 'devtools'

    wx.createSelectorQuery().select('#gl').fields({ node: true, size: true }).exec(res => {
      const hit = res && res[0]
      if (!hit || !hit.node) { console.error('[FAIL] canvas 节点未取到'); return }

      const canvas = hit.node
      const { width, height } = hit;

      // ---- Three.js 核心对象 ----
      const THREE = createScopedThreejs(canvas)
      
      const dpr = sys.pixelRatio
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
      renderer.setPixelRatio(dpr)
      renderer.setSize(width, height, false)

      const scene  = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, width/height, 0.1, 1000)
      
      const RADIUS = 1;
      const MARGIN = 1.02;

      const vFov  = camera.fov * Math.PI / 180
      const distV = RADIUS / Math.tan(vFov/2)
      const distH = RADIUS / (Math.tan(vFov/2) * camera.aspect)
      camera.position.set(0, 0, Math.max(distV, distH) * MARGIN)

      scene.add(new THREE.AmbientLight(0xffffff, 0.30))
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.15)
      scene.add(dirLight)

      const globeGroup = new THREE.Group()
      globeGroup.position.y = -0.55
      scene.add(globeGroup)

      // ---- 经纬度与三维坐标转换工具 ----
      const toRad = d => d * Math.PI / 180;
      const normalizeLon = lon => { let x=lon; while(x<=-180)x+=360; while(x>180)x-=360; return x };

      function lonlatToVec3(lon, lat, r = RADIUS + 0.001) {
        const phi   = toRad(90 - lat);
        const theta = toRad(lon + 180);
        const x = -r * Math.sin(phi) * Math.cos(theta);
        const z =  r * Math.sin(phi) * Math.sin(theta);
        const y =  r * Math.cos(phi);
        return new THREE.Vector3(x, y, z);
      }

      function lonlatFromPoint(p) {
        const lon = -(Math.atan2(p.z, p.x) * 180 / Math.PI);
        const lat = Math.asin(p.y / RADIUS) * 180 / Math.PI;
        return [normalizeLon(lon), lat];
      }

      // ---- 国家数据处理与绘制 ----
      let COUNTRY_FEATURES = null;
      let BORDER_GROUP = null;
      let HIGHLIGHT_GROUP = null;
      let searchIndex = null; // [优化] 用于存放 kdbush 索引

      const makeLineMat = (color, ro=30) => {
        const m = new THREE.LineBasicMaterial({ color, depthTest: true });
        m.depthWrite = true; m.userData = { ro }; return m;
      }
      const setRO = (obj)=>{ obj.renderOrder = obj.material?.userData?.ro ?? 0 };

      const loadCountries = () => new Promise((resolve, reject) => {
        if (COUNTRY_FEATURES) return resolve(COUNTRY_FEATURES);
        try {
          const gj = require('../../assets/data/countries.json.js');
          COUNTRY_FEATURES = gj.features.map(f => ({
            props: f.properties || {},
            type: f.geometry.type,
            coords: f.geometry.coordinates || [],
            bbox: bboxOf(f.geometry.type, f.geometry.coordinates || [])
          }));
          resolve(COUNTRY_FEATURES);
        } catch (e) { reject(e); }
      });
      
      function bboxOf(type, coords) { let minLon = 181, minLat = 91, maxLon = -181, maxLat = -91; const scan = p => { const [lon, lat] = p; if (lon < minLon) minLon = lon; if (lat < minLat) minLat = lat; if (lon > maxLon) maxLon = lon; if (lat > maxLat) maxLat = lat; }; if (type === 'Polygon') coords.forEach(r => r.forEach(scan)); else if (type === 'MultiPolygon') coords.forEach(poly => poly.forEach(r => r.forEach(scan))); return [minLon, minLat, maxLon, maxLat]; }
      const inBox = (b, lon, lat) => lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3];
      function pointInRing(lon, lat, ring) { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const xi = ring[i][0], yi = ring[i][1]; const xj = ring[j][0], yj = ring[j][1]; const inter = ((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi); if (inter) inside = !inside; } return inside; }

      function featureContains(f, lon, lat) {
          if (!f || !inBox(f.bbox, lon, lat)) return false;
          const cs = f.coords;
          if (f.type === 'Polygon') {
              if (!pointInRing(lon, lat, cs[0])) return false;
              for (let k = 1; k < cs.length; k++) if (pointInRing(lon, lat, cs[k])) return false;
              return true;
          } else if (f.type === 'MultiPolygon') {
              for (const poly of cs) {
                  if (!pointInRing(lon, lat, poly[0])) continue;
                  let hole = false;
                  for (let k = 1; k < poly.length; k++) if (pointInRing(lon, lat, poly[k])) { hole = true; break; }
                  if (!hole) return true;
              }
          }
          return false;
      }
      
      // [优化] 新增函数：创建国家中心点索引
      function initSearchIndex(features) {
        const points = features.map(f => {
          const [minLon, minLat, maxLon, maxLat] = f.bbox;
          return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
        });
        searchIndex = new KDBush(points);
        console.log('[SearchIndex] Index created successfully.');
      }

      function drawBorders() {
        if (BORDER_GROUP) globeGroup.remove(BORDER_GROUP);
        BORDER_GROUP = new THREE.Group();
        const lineMat = makeLineMat(0xffffff, 20);
        COUNTRY_FEATURES.forEach(f => {
            const addRing = (ring) => {
                const pts = ring.map(([lon, lat]) => lonlatToVec3(lon, lat, RADIUS + 0.0015));
                const g = new THREE.BufferGeometry().setFromPoints(pts);
                const line = new THREE.LineLoop(g, lineMat); setRO(line);
                BORDER_GROUP.add(line);
            };
            if (f.type === 'Polygon') f.coords.forEach(addRing);
            else if (f.type === 'MultiPolygon') f.coords.forEach(poly => poly.forEach(addRing));
        });
        globeGroup.add(BORDER_GROUP);
      }

      // 仅绘制边框的高亮函数
      function highlight(f) {
        if (HIGHLIGHT_GROUP) {
            HIGHLIGHT_GROUP.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
            globeGroup.remove(HIGHLIGHT_GROUP);
            HIGHLIGHT_GROUP = null;
        }
        if (!f) return;

        HIGHLIGHT_GROUP = new THREE.Group();
        const edgeMat = makeLineMat(0xffcc33, 40);

        const processPolygon = (rings) => {
            rings.forEach(ring => {
                const pts = ring.map(([lon, lat]) => lonlatToVec3(lon, lat, RADIUS + 0.002));
                const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), edgeMat);
                setRO(line);
                HIGHLIGHT_GROUP.add(line);
            });
        };

        if (f.type === 'Polygon') processPolygon(f.coords);
        else if (f.type === 'MultiPolygon') f.coords.forEach(processPolygon);
        
        globeGroup.add(HIGHLIGHT_GROUP);
      }

      // ---- 地球模型加载 ----
      let earthMesh;
      new THREE.TextureLoader().load('../../assets/textures/earth.jpg', (tex) => {
        tex.minFilter = THREE.LinearFilter;
        earthMesh = new THREE.Mesh(
          new THREE.SphereGeometry(RADIUS, 64, 64),
          new THREE.MeshPhongMaterial({ map: tex, shininess: 8 })
        );
        earthMesh.name = 'EARTH';
        globeGroup.add(earthMesh);
        
        // [优化] 加载数据后，同时绘制边界并创建索引
        loadCountries().then((features) => {
          drawBorders();
          initSearchIndex(features);
        });
      });

      // ---- 交互处理 ----
      const touchState = { isPC, rotX: 0, rotY: 0 };
      const raycaster = new THREE.Raycaster();

      this.onTouchStart = e => {
        const t = e.touches[0];
        touchState.isDragging = true;
        touchState.lastX = t.x; touchState.lastY = t.y;
        touchState.downX = t.x; touchState.downY = t.y;
        touchState.downTime = Date.now();
      };

      this.onTouchMove = e => {
        const t = e.touches[0];
        if (!touchState.isDragging) return;
        const dx = t.x - touchState.lastX;
        const dy = t.y - touchState.lastY;
        touchState.lastX = t.x; touchState.lastY = t.y;
        
        const dxFactor = touchState.isPC ? -1 : 1;
        const dyFactor = touchState.isPC ? 1 : -1;
        touchState.rotY -= dxFactor * dx * 0.005;
        touchState.rotX += dyFactor * dy * 0.005;
        touchState.rotX = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, touchState.rotX));
      };

      this.onTouchEnd = () => {
        const isTap = (Date.now() - touchState.downTime) <= 250 && Math.hypot(touchState.lastX - touchState.downX, touchState.lastY - touchState.downY) <= 6;
        touchState.isDragging = false;
        
        if (!isTap || !earthMesh || !searchIndex) return;

        raycaster.setFromCamera({ x: (touchState.downX / width) * 2 - 1, y: -(touchState.downY / height) * 2 + 1 }, camera);
        const inter = raycaster.intersectObject(earthMesh, true)[0];
        if (!inter) return highlight(null);

        const p = inter.point.clone().sub(globeGroup.position);
        const invQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-touchState.rotX, -touchState.rotY, 0, 'XYZ'));
        p.applyQuaternion(invQ);
        const [lon, lat] = lonlatFromPoint(p);
        
        // [优化] 使用 kdbush 索引进行高效查找
        let hit = null;
        // 1. 快速找出最近的 10 个候选国家
        const neighborIds = searchIndex.around(lon, lat, 10); 
        const potentialHits = neighborIds.map(id => COUNTRY_FEATURES[id]);

        // 2. 只在这 10 个国家里进行精确判断
        for (const f of potentialHits) {
            if (featureContains(f, lon, lat)) {
                hit = f;
                break;
            }
        }

        highlight(hit);
        if (hit) {
          console.log('[select] country:', hit.props?.NAME || '(unknown)');
        }
      };

      // ---- 渲染循环 ----
      const renderLoop = () => {
        if (!this.renderer) return;
        dirLight.position.copy(camera.position);
        globeGroup.rotation.set(touchState.rotX, touchState.rotY, 0);
        renderer.render(scene, camera);
        canvas.requestAnimationFrame(renderLoop);
      };
      renderLoop();

      this.pageCtx = { scene, renderer };
    });
  },

  onUnload() {
    if (this.pageCtx) {
      this.pageCtx.scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      this.pageCtx.renderer.dispose();
      this.pageCtx = null;
      this.renderer = null;
    }
  }
});