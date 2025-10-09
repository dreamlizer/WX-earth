import { createScopedThreejs } from 'threejs-miniprogram'

Page({
  onLoad() {
    const sys = wx.getSystemInfoSync()
    const isPC = sys.platform === 'windows' || sys.platform === 'mac' || sys.platform === 'devtools'

    const q = wx.createSelectorQuery()
    q.select('#gl').fields({ node: true, size: true }).exec(res => {
      const hit = res && res[0]
      if (!hit || !hit.node) { console.error('[FAIL] canvas 节点未取到'); return }

      const canvas = hit.node
      const width  = hit.width
      const height = hit.height
      const dpr    = Math.min(sys.pixelRatio || 1, 2)

      // ---- 可调参数 ----
      const EXPOSURE   = 1.35
      const LIGHT_MAIN = 1.15
      const LIGHT_AMBI = 0.30
      const OFFSET_Y   = -0.55
      const RADIUS     = 1
      const MARGIN     = 1.02

      const ROT_SPEED    = 0.005
      const PITCH_CLAMP  = Math.PI/2 - 0.01
      const Z_MIN        = 1.4
      const Z_MAX        = 6.0
      const WHEEL_ZOOM_STEP = 0.15

      const TAP_MOVE_PX = 6
      const TAP_TIME_MS = 250

      // ---- Three 基础 ----
      canvas.width  = Math.max(1, Math.floor(width  * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))

      const THREE = createScopedThreejs(canvas)
      const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true })
      renderer.setPixelRatio(dpr)
      renderer.setSize(width, height, false)
      renderer.setClearColor(0x000000, 1)
      if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding
      if (THREE.ACESFilmicToneMapping) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = EXPOSURE
      }

      const scene  = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, width/height, 0.1, 1000)

      // 让球“正好卡住左右边”
      const vFov  = camera.fov * Math.PI / 180
      const distV = RADIUS / Math.tan(vFov/2)
      const distH = RADIUS / (Math.tan(vFov/2) * camera.aspect)
      camera.position.set(0,0, Math.max(distV, distH) * MARGIN)

      // 光照（主光跟随相机，保证正面亮）
      const ambient = new THREE.AmbientLight(0xffffff, LIGHT_AMBI)
      scene.add(ambient)
      const dir = new THREE.DirectionalLight(0xffffff, LIGHT_MAIN)
      dir.position.copy(camera.position)
      scene.add(dir)

      // 分组：把地球整体下移
      const globeGroup = new THREE.Group()
      globeGroup.position.y = OFFSET_Y
      scene.add(globeGroup)

      // ---- 经纬↔球面工具 ----
      const toRad = d => d * Math.PI / 180
      function lonlatToVec3(lon, lat, r = RADIUS + 0.001) {
        const phi   = toRad(90 - lat)
        const theta = toRad(lon + 180) // [修正] 对齐贴图
        const x = -r * Math.sin(phi) * Math.cos(theta)
        const z =  r * Math.sin(phi) * Math.sin(theta)
        const y =  r * Math.cos(phi)
        return new THREE.Vector3(x, y, z)
      }
      function lonlatFromPoint(p) {
        const lon = Math.atan2(p.z, p.x) * 180/Math.PI
        const lat = Math.asin(p.y / RADIUS) * 180/Math.PI
        return [normalizeLon(lon), lat]
      }
      function normalizeLon(lon){ let x=lon; while(x<=-180)x+=360; while(x>180)x-=360; return x }
      
      // [修正] 解决透视问题
      const makeLineMat = (color, ro=30) => {
        const m = new THREE.LineBasicMaterial({ color, depthTest: true });
        m.depthWrite = true;
        m.userData = { ro }; return m
      }
      const makeFillMat = (color, alpha=0.25, ro=25) => {
        const m = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:alpha, side:THREE.DoubleSide, depthTest:true });
        m.depthWrite = false;
        m.userData = { ro }; return m
      }
      const setRO = (obj)=>{ obj.renderOrder = obj.material?.userData?.ro ?? 0 }

      // ---- 地球贴图 ----
      const loader = new THREE.TextureLoader()
      loader.load('../../assets/textures/earth.jpg', (tex)=>{
        if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding
        const geo = new THREE.SphereGeometry(RADIUS, 64, 64)
        const mat = new THREE.MeshPhongMaterial({ map: tex, shininess: 8 })
        const earth = new THREE.Mesh(geo, mat)
        earth.name = 'EARTH'
        globeGroup.add(earth)

        // ===== 国家数据 + 边界常显 + 点击高亮 =====
        let COUNTRY_FEATURES = null
        let BORDER_GROUP   = null
        let HIGHLIGHT_GROUP = null

        const loadCountries = () => new Promise((resolve, reject) => {
          if (COUNTRY_FEATURES) return resolve(COUNTRY_FEATURES)
          try {
            const gj = require('../../assets/data/countries.json.js')
            const feats = (gj && gj.features) || []
            COUNTRY_FEATURES = feats.map(f => {
              const g = f.geometry || {}
              const type = g.type
              const coords = g.coordinates || []
              const bbox = bboxOf(type, coords)
              return { props: f.properties || {}, type, coords, bbox }
            })
            console.log('[geo] features:', COUNTRY_FEATURES.length)
            resolve(COUNTRY_FEATURES)
          } catch (e) {
            console.warn('[geo] load failed:', e)
            reject(e)
          }
        })

        // 包围盒先粗过滤
        function bboxOf(type, coords) {
          let minLon= 999, minLat= 999, maxLon=-999, maxLat=-999
          // [本次修正] 修复此处的语法错误
          const scan = p => { const [lon,lat]=p; if(lon<minLon)minLon=lon; if(lat<minLat)minLat=lat; if(lon>maxLon)maxLon=lon; if(lat>maxLat)maxLat=lat }
          if (type === 'Polygon') coords.forEach(r => r.forEach(scan))
          else if (type === 'MultiPolygon') coords.forEach(poly => poly.forEach(r => r.forEach(scan)))
          return [minLon, minLat, maxLon, maxLat]
        }
        const inBox = (b,lon,lat)=> lon>=b[0] && lon<=b[2] && lat>=b[1] && lat<=b[3]

        // 常显白色国界线
        function drawBorders() {
          if (BORDER_GROUP) globeGroup.remove(BORDER_GROUP)
          BORDER_GROUP = new THREE.Group()
          const lineMat = makeLineMat(0xffffff, 20)
          const SKIP_EVERY = 1

          COUNTRY_FEATURES.forEach(f => {
            const addRing = (ring) => {
              const pts = []
              for (let i=0;i<ring.length;i+=SKIP_EVERY) {
                const [lon,lat] = ring[i]
                pts.push(lonlatToVec3(lon, lat, RADIUS + 0.0015))
              }
              const g = new THREE.BufferGeometry().setFromPoints(pts)
              const line = new THREE.LineLoop(g, lineMat); setRO(line)
              BORDER_GROUP.add(line)
            }
            if (f.type === 'Polygon') f.coords.forEach(addRing)
            else if (f.type === 'MultiPolygon') f.coords.forEach(poly => poly.forEach(addRing))
          })
          globeGroup.add(BORDER_GROUP)
        }
        
        // [修正] 默认加载国境线
        loadCountries().then(() => {
            if (!BORDER_GROUP) {
                drawBorders();
            }
        }).catch(e => {
            console.warn('[onLoad] Pre-loading borders failed:', e);
        });

        // 点是否在多边形（射线法）
        function pointInRing(lon, lat, ring) {
          let inside = false
          for (let i=0, j=ring.length-1; i<ring.length; j=i++) {
            const xi=ring[i][0], yi=ring[i][1]
            const xj=ring[j][0], yj=ring[j][1]
            const inter = ((yi>lat)!==(yj>lat)) && (lon < (xj-xi)*(lat-yi)/(yj-yi+1e-12)+xi)
            if (inter) inside = !inside
          }
          return inside
        }
        function featureContains(f, lon, lat) {
          if (!inBox(f.bbox, lon, lat)) return false
          const cs = f.coords
          if (f.type === 'Polygon') {
            if (!pointInRing(lon,lat,cs[0])) return false
            for (let k=1;k<cs.length;k++) if (pointInRing(lon,lat,cs[k])) return false
            return true
          } else if (f.type === 'MultiPolygon') {
            for (let p=0;p<cs.length;p++) {
              const poly = cs[p]
              if (!pointInRing(lon,lat,poly[0])) continue
              let hole=false
              for (let k=1;k<poly.length;k++) if (pointInRing(lon,lat,poly[k])) { hole=true; break }
              if (!hole) return true
            }
            return false
          }
          return false
        }

        // 点击后高亮（黄边 + 半透明填充）
        function highlight(f) {
          if (HIGHLIGHT_GROUP) {
            globeGroup.remove(HIGHLIGHT_GROUP)
            dispose(HIGHLIGHT_GROUP)
            HIGHLIGHT_GROUP = null
          }
          const grp = new THREE.Group()

          // 黄边
          const edgeMat = makeLineMat(0xffcc33, 40)
          const addEdge = (ring) => {
            const pts = ring.map(([lon,lat]) => lonlatToVec3(lon,lat,RADIUS+0.002))
            const g = new THREE.BufferGeometry().setFromPoints(pts)
            const line = new THREE.LineLoop(g, edgeMat); setRO(line)
            grp.add(line)
          }
          if (f.type==='Polygon') f.coords.forEach(addEdge)
          else if (f.type==='MultiPolygon') f.coords.forEach(poly => poly.forEach(addEdge))

          // 半透明面
          const fillMat = makeFillMat(0xffcc33, 0.26, 35)
          const addFill = (polyRings) => {
            const outer = polyRings[0].map(([lon,lat]) => new THREE.Vector2(lon,lat))
            const holes = polyRings.slice(1).map(r => r.map(([lon,lat]) => new THREE.Vector2(lon,lat)))
            const shape = new THREE.Shape(outer); holes.forEach(h => shape.holes.push(new THREE.Path(h)))
            const shpGeo = new THREE.ShapeGeometry(shape) // 先在经纬平面三角化
            const pos = shpGeo.attributes.position
            const v   = new THREE.Vector3()
            for (let i=0;i<pos.count;i++) {
              const lon = pos.getX(i), lat = pos.getY(i)
              v.copy( lonlatToVec3(lon, lat, RADIUS+0.001) )
              pos.setXYZ(i, v.x, v.y, v.z)
            }
            pos.needsUpdate = true
            const mesh = new THREE.Mesh(shpGeo, fillMat); setRO(mesh)
            grp.add(mesh)
          }
          if (f.type==='Polygon') addFill(f.coords)
          else if (f.type==='MultiPolygon') f.coords.forEach(addFill)

          globeGroup.add(grp)
          HIGHLIGHT_GROUP = grp
        }

        function dispose(obj) {
          obj.traverse(o => {
            if (o.isLine) { o.geometry?.dispose?.(); o.material?.dispose?.() }
            if (o.isMesh) { o.geometry?.dispose?.(); o.material?.dispose?.() }
          })
        }

        // ---- 交互：拖拽/点选/缩放 ----
        const raycaster = new THREE.Raycaster()
        let isDragging=false, lastX=0,lastY=0, rotX=0,rotY=0
        let pinchStartDist=0, pinchStartZ=camera.position.z
        let downTime=0, downX=0, downY=0

        this.onTouchStart = e => {
          const t = e.touches || []
          if (t.length === 1) {
            const p=t[0]; isDragging=true; lastX=p.x; lastY=p.y; downX=p.x; downY=p.y; downTime=Date.now()
          } else if (t.length >= 2) {
            const a=t[0], b=t[1]
            pinchStartDist = Math.hypot(a.x-b.x, a.y-b.y)
            pinchStartZ    = camera.position.z
          }
        }

        this.onTouchMove = e => {
          const t = e.touches || []
          if (t.length >= 2 && pinchStartDist>0) {
            const a=t[0], b=t[1]
            const scale = Math.hypot(a.x-b.x, a.y-b.y) / pinchStartDist
            camera.position.z = Math.max(Z_MIN, Math.min(Z_MAX, pinchStartZ/scale))
            return
          }
          if (!isDragging || t.length !== 1) return
          const p=t[0]; const dx=p.x-lastX; const dy=p.y-lastY; lastX=p.x; lastY=p.y
          const dxFactor = isPC ? -1 : 1
          const dyFactor = isPC ? +1 : -1
          rotY -= dxFactor * dx * ROT_SPEED
          rotX += dyFactor * dy * ROT_SPEED
          rotX = Math.max(-PITCH_CLAMP, Math.min(PITCH_CLAMP, rotX))
        }

        this.onTouchEnd = async () => {
          const upTime = Date.now()
          const moved  = Math.hypot(lastX-downX, lastY-downY)
          const isTap  = (upTime-downTime)<=TAP_TIME_MS && moved<=TAP_MOVE_PX
          isDragging=false; pinchStartDist=0
          if (!isTap) return

          try {
            // 屏幕点 -> 射线 -> 球面点 -> 经纬
            const xNdc=(downX/width)*2-1, yNdc=-(downY/height)*2+1
            raycaster.setFromCamera({x:xNdc,y:yNdc}, camera)
            const inter = raycaster.intersectObject(earth,true)[0]
            if (!inter) return
            const p = inter.point.clone().sub(globeGroup.position)

            // 把点从当前旋转系变回“零姿态”，再求经纬
            const invQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-rotX, -rotY, 0, 'XYZ'))
            p.applyQuaternion(invQ)
            const [lon, lat] = lonlatFromPoint(p)

            // 命中特征
            let hit=null
            // 确保COUNTRY_FEATURES已加载
            if (!COUNTRY_FEATURES) await loadCountries()
            
            for (let i=0;i<COUNTRY_FEATURES.length;i++){
              const f=COUNTRY_FEATURES[i]
              if (featureContains(f, lon, lat)) { hit=f; break }
            }
            if (hit){
              highlight(hit)
              const name = hit.props?.name || hit.props?.NAME || hit.props?.ADMIN || hit.props?.country || hit.props?.Country
              console.log('[select] country:', name || '(unknown)', { lon, lat })
            }
          } catch(e) {
            console.warn('[tap] failed:', e)
          }
        }

        // 鼠标滚轮缩放（PC）
        try {
          canvas.addEventListener && canvas.addEventListener('wheel', ev=>{
            let z = camera.position.z + (ev.deltaY>0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP)
            camera.position.z = Math.max(Z_MIN, Math.min(Z_MAX, z))
          })
        } catch(e){}

        // 渲染循环
        const render = () => {
          dir.position.copy(camera.position)
          globeGroup.rotation.set(rotX, rotY, 0)
          renderer.render(scene, camera)
          canvas.requestAnimationFrame(render)
        }
        render()

        this._ctx = { renderer, scene, camera, globeGroup }
        console.log('[OK] earth ready with borders & pick highlight')
      })
    })
  },

  onTouchStart(){}, onTouchMove(){}, onTouchEnd(){},

  onUnload(){
    const C=this._ctx; if(!C) return
    C.scene.traverse(o=>{
      if (o.isLine||o.isMesh){ o.geometry?.dispose?.(); o.material?.dispose?.() }
    })
    C.renderer.dispose?.(); this._ctx=null
  }
})