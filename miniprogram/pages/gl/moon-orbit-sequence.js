import { fixTexture } from './asset-manager.js';

export class MoonOrbitSequence {
  constructor() {
    this.THREE = null;
    this.scene = null;

    this._initDone = false;
    this._baseAz = null;
    this._baseY = null;
    this._radiusXZ = null;

    this._fromMoonToCam0 = null;
    this._sideAxis0 = null;
    this._upAxis0 = null;
    this._earthDir0 = null;

    this._sunOffset0 = null;
    this._earthOffset0 = null;
    this._sunMesh = null;
    this._earthProxyMesh = null;
    this._dirLightPos0 = null;
    this._camQuat0 = null;
    this._enterPos0 = null;
    this._enterQuat0 = null;
    this._enterAmb0 = null;
    this._enterDirInt0 = null;
    this._enterDirPos0 = null;
    this._dbgNext = 0;

    this._tmpMoon = null;
    this._tmpRel = null;
    this._tmpForward = null;
    this._tmpRight = null;
    this._tmpSide = null;
    this._tmpUp = null;
    this._tmpAway = null;
    this._tmpSunPos = null;
    this._tmpEarthPos = null;
    this._tmpLocalPos = null;
    this._tmpEarthCenter = null;
    this._tmpLightDir = null;
    this._tmpMat4 = null;
    this._tmpQuatLook = null;
    this._tmpQuatDesired = null;
    this._tmpCamDir = null;
    this._tmpCamTargetPos = null;
  }

  init(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
  }

  hasArtifacts() {
    return !!(this._sunMesh || this._farEarth || this._glare);
  }

  reset() {
    if (this._farEarthCloud) {
      this._farEarthCloud.parent?.remove(this._farEarthCloud);
      this._farEarthCloud.geometry.dispose();
      this._farEarthCloud.material.dispose();
      this._farEarthCloudTexture?.dispose();
    }
    this._farEarthCloud = null;
    this._farEarthCloudTexture = null;
    if (this._farEarth) {
      this.scene?.remove(this._farEarth);
      this._farEarth.geometry.dispose();
      this._farEarth.material.dispose();
      this._farEarthTexture?.dispose();
    }
    this._farEarth = null;
    this._farEarthTexture = null;
    this._farEarthEndAxis = null;
    this._farEarthFacing = null;
    if (this._glare) {
      this.scene?.remove(this._glare);
      this._glare.children.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); });
    }
    this._glare = null;
    this._initDone = false;
    this._baseAz = null;
    this._baseY = null;
    this._radiusXZ = null;
    this._fromMoonToCam0 = null;
    this._sideAxis0 = null;
    this._upAxis0 = null;
    this._earthDir0 = null;
    this._sunOffset0 = null;
    this._earthOffset0 = null;
    this._dirLightPos0 = null;
    this._camQuat0 = null;
    this._enterPos0 = null;
    this._enterQuat0 = null;
    this._enterAmb0 = null;
    this._enterDirInt0 = null;
    this._enterDirPos0 = null;
    if (this._earthProxyMesh) {
      try { this.scene?.remove?.(this._earthProxyMesh); } catch (_) {}
      try { this._earthProxyMesh.geometry?.dispose?.(); } catch (_) {}
      try { this._earthProxyMesh.material?.dispose?.(); } catch (_) {}
      this._earthProxyMesh = null;
    }
  }

  dispose() {
    if (this._sunMesh) {
      try { this.scene?.remove?.(this._sunMesh); } catch (_) {}
      try { this._sunMesh.geometry?.dispose?.(); } catch (_) {}
      try { this._sunMesh.material?.dispose?.(); } catch (_) {}
      this._sunMesh = null;
    }
    this.reset();
  }

  // 画外阳光的镜头散射：不改变任何场景灯光、月面材质或相机。
  _tickGlare(camera, moonWorld, moonRadius, orbitDeg, orbitT, orbitDurationSec = 130, orbitEndDeg = 630) {
    const THREE = this.THREE;
    if (!this._glare) {
      const group = new THREE.Group();
      group.name = 'MOON_VOYAGE_SUN_GLARE';
      const material = new THREE.ShaderMaterial({
        uniforms: { strength: { value: 0 }, peak: { value: 0 }, aspect: { value: 1 },
          root: { value: new THREE.Vector2() }, variation: { value: 0.9 + Math.random() * 0.2 } },
        vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: `varying vec2 vUv;
          uniform float strength,peak,aspect,variation; uniform vec2 root;
          float ray(vec2 p,float slope,float width,float reach){
            float d=root.y-p.y;
            float lateral=p.x-root.x-slope*d;
            float w=width*(0.85+0.55*d);
            return exp(-lateral*lateral/(w*w))*exp(-max(0.0,d)/reach)*smoothstep(0.0,0.12,d);
          }
          void main(){
            vec2 p=(vUv*2.0-1.0)*vec2(aspect,1.0);
            float reach=0.30+0.60*peak;
            float slope=-root.x*0.35;
            // 单一宽主芒；周边只有低强度、连续的不规则散光。
            float d=max(0.0,root.y-p.y);
            float rays=ray(p,slope+0.03,0.36,reach)*0.62;
            float grain=0.70+0.16*sin(p.x*13.0+d*5.0+variation*9.0)
              +0.10*sin(p.x*23.0-d*8.0+variation*17.0);
            float scatter=ray(p,slope-0.025,0.65,reach*0.85)*grain*0.22;
            rays+=scatter;
            float halo=exp(-length(p-root)*3.5)*0.20;
            float a=1.0-exp(-strength*(halo+rays*(0.20+0.90*peak)));
            gl_FragColor=vec4(vec3(1.0,0.98,0.94),a);
          }`,
        transparent: true, depthWrite: false, depthTest: false, blending: THREE.NormalBlending
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
      mesh.renderOrder=30;group.add(mesh);this._glare=group;this.scene.add(group);
    }
    const sun=this._dirLightPos0.clone().sub(moonWorld).normalize();
    const local=sun.clone().applyQuaternion(camera.quaternion.clone().inverse());
    const angle=Math.acos(Math.max(-1,Math.min(1,-local.z)))*180/Math.PI;
    // 原光源离轴约 52°；采用电影化的镜头响应，不把太阳移进视野。
    const envelope=1-smoothstep(75,90,angle);
    const toMoon=moonWorld.clone().sub(camera.position), along=toMoon.dot(sun);
    const clearance=toMoon.clone().addScaledVector(sun,-along).length();
    const visible=along>0?smoothstep(moonRadius,moonRadius*1.12,clearance):1;
    const pass=clamp01((180+360*Math.round((orbitDeg-180)/360))/orbitEndDeg);
    const center=pass<0.5?Math.cbrt(pass/4):1-Math.cbrt((1-pass)/4);
    const elapsed=Math.abs(orbitT-center)*orbitDurationSec;
    // 每次 10 秒：4.5 秒线性渐入，1 秒保持，4.5 秒线性渐出。
    // 束形保持不变，只调强度，避免半秒内突然伸长再缩回。
    const fade=clamp01((5-elapsed)/4.5);
    const strength=fade*envelope*visible*(local.z<0&&local.y>0?1:0);
    this._glare.children[0].material.uniforms.strength.value=strength;
    this._glare.visible=strength>0.0001;
    if(!this._glare.visible)return;
    const peak=1;
    this._glare.position.copy(camera.position);this._glare.quaternion.copy(camera.quaternion);
    const h=2*Math.tan(camera.fov*Math.PI/360),mesh=this._glare.children[0];
    mesh.position.set(0,0,-2);mesh.scale.set(h*camera.aspect,h,1);
    const u=mesh.material.uniforms;
    u.strength.value=strength;u.peak.value=peak;u.aspect.value=camera.aspect;
    // 束根在画外上缘；只沿原太阳投影的来向移动，绝不横扫屏幕。
    u.root.value.set(local.x/Math.max(0.01,local.y)*1.16,1.16);
  }

  tick({
    t,
    node3Time,
    camera,
    moonWorld,
    globeGroup,
    baseGlobeScale,
    orbitDurationSec = 90.0,
    orbitEndDeg = 270.0,
    appearDeg = 150.0,
    appearFullDeg = 165.0,
    disappearDeg = 255.0,
    disappearEndDeg = 270.0,
    sunDist = 140.0,
    sunSide = 16.0,
    sunUp = 22.0,
    sunLightDist = 140.0,
    earthDist = 90.0,
    earthSide = 18.0,
    earthUp = 6.0,
    earthAzOffsetDeg = 300.0,
    earthMode = 'far',
    earthBetweenK = 0.62,
    earthBetweenSide = -2.0,
    earthBetweenUp = 0.8,
    earthBetweenRotate = false,
    earthBetweenRotateDegOffset = 0.0,
    earthOccludeFade = true,
    earthScaleMul = null,
    earthUseProxy = false,
    moonRadius = 1.0,
    sunOpacity = 0.95,
    sunBaseScale = 4.0,
    sunScaleAdd = 10.0,
    cameraMinY = 4.5,
    cameraLiftEndDeg = 55.0,
    lookBlendDeg = 28.0,
    enterBlendSec = 0.85,
    enterLightBlendSec = 3.0,
    enableSun = true,
    debug = false,
    lockDirLight = true,
    maxAmbient = 0.18,
    minDir = 1.65,
    farEarth = false,
    sunGlare = false,
    isPC = false,
    finalApproachSec = 18,
  }) {
    if (!this.THREE || !this.scene || !camera || !moonWorld) return { active: false };
    if (!(t >= node3Time)) return { active: false };

    const THREE = this.THREE;
    const orbitT = clamp01((t - node3Time) / Math.max(1e-6, orbitDurationSec));
    const orbitP = easeInOut(orbitT);
    const orbitDegNow = orbitEndDeg * orbitP;
    const orbitRad = orbitDegNow * Math.PI / 180.0;

    if (!this._tmpMoon) this._tmpMoon = new THREE.Vector3();
    if (!this._tmpRel) this._tmpRel = new THREE.Vector3();
    if (!this._tmpForward) this._tmpForward = new THREE.Vector3();
    if (!this._tmpRight) this._tmpRight = new THREE.Vector3();
    if (!this._tmpSide) this._tmpSide = new THREE.Vector3();
    if (!this._tmpUp) this._tmpUp = new THREE.Vector3();
    if (!this._tmpAway) this._tmpAway = new THREE.Vector3();
    if (!this._tmpSunPos) this._tmpSunPos = new THREE.Vector3();
    if (!this._tmpEarthPos) this._tmpEarthPos = new THREE.Vector3();
    if (!this._tmpLocalPos) this._tmpLocalPos = new THREE.Vector3();
    if (!this._tmpEarthCenter) this._tmpEarthCenter = new THREE.Vector3();
    if (!this._tmpLightDir) this._tmpLightDir = new THREE.Vector3();
    if (!this._tmpMat4) this._tmpMat4 = new THREE.Matrix4();
    if (!this._tmpQuatLook) this._tmpQuatLook = new THREE.Quaternion();
    if (!this._tmpQuatDesired) this._tmpQuatDesired = new THREE.Quaternion();
    if (!this._tmpCamDir) this._tmpCamDir = new THREE.Vector3();
    if (!this._tmpCamTargetPos) this._tmpCamTargetPos = new THREE.Vector3();

    this._tmpMoon.copy(moonWorld);

    if (!this._initDone) {
      this._enterPos0 = camera.position?.clone?.() || null;
      this._enterQuat0 = camera.quaternion?.clone?.() || null;
      try {
        const amb0 = this.scene?.children?.find?.(c => c.type === 'AmbientLight');
        const dir0 = this.scene?.children?.find?.(c => c.type === 'DirectionalLight');
        this._enterAmb0 = (amb0 && typeof amb0.intensity === 'number') ? amb0.intensity : null;
        this._enterDirInt0 = (dir0 && typeof dir0.intensity === 'number') ? dir0.intensity : null;
        this._enterDirPos0 = dir0?.position?.clone?.() || null;
      } catch (_) {
        this._enterAmb0 = null;
        this._enterDirInt0 = null;
        this._enterDirPos0 = null;
      }

      this._tmpRel.copy(camera.position).sub(this._tmpMoon);
      const y = this._tmpRel.y;
      const rXZ = Math.max(1e-6, Math.sqrt(Math.max(0.0, this._tmpRel.lengthSq() - y * y)));
      this._baseY = y;
      this._radiusXZ = rXZ;
      this._baseAz = Math.atan2(this._tmpRel.x, this._tmpRel.z);

      this._tmpForward.copy(this._tmpMoon).sub(camera.position).normalize();
      this._tmpRight.crossVectors(this._tmpForward, camera.up).normalize();

      this._fromMoonToCam0 = this._tmpRel.clone().normalize();
      this._upAxis0 = camera.up?.clone?.() || new THREE.Vector3(0, 1, 0);
      this._earthDir0 = this._fromMoonToCam0.clone();
      try {
        const a = Number(earthAzOffsetDeg || 0) * Math.PI / 180.0;
        if (Number.isFinite(a) && this._upAxis0) {
          this._earthDir0.applyAxisAngle(this._upAxis0, a).normalize();
        }
      } catch (_) {}
      this._sideAxis0 = this._tmpRight.clone();

      this._earthOffset0 = this._earthDir0.clone()
        .multiplyScalar(earthDist)
        .addScaledVector(this._sideAxis0, earthSide)
        .addScaledVector(this._upAxis0, earthUp);

      this._sunOffset0 = this._earthDir0.clone()
        .multiplyScalar(sunDist)
        .addScaledVector(this._sideAxis0, sunSide)
        .addScaledVector(this._upAxis0, sunUp);

      this._dirLightPos0 = this._tmpMoon.clone()
        .addScaledVector(this._fromMoonToCam0, sunLightDist)
        .addScaledVector(this._upAxis0, sunLightDist * 0.15);
      this._camQuat0 = camera.quaternion?.clone?.() || null;

      if (!enableSun || !(sunOpacity > 0)) {
        if (this._sunMesh) {
          try { this.scene?.remove?.(this._sunMesh); } catch (_) {}
          try { this._sunMesh.geometry?.dispose?.(); } catch (_) {}
          try { this._sunMesh.material?.dispose?.(); } catch (_) {}
          this._sunMesh = null;
        }
      } else {
        if (this._sunMesh) {
          try { this.scene?.remove?.(this._sunMesh); } catch (_) {}
          try { this._sunMesh.geometry?.dispose?.(); } catch (_) {}
          try { this._sunMesh.material?.dispose?.(); } catch (_) {}
          this._sunMesh = null;
        }
        try {
          const geo = new THREE.SphereGeometry(1.0, 24, 24);
          const mat = new THREE.MeshBasicMaterial({ color: 0xfff4d6, transparent: true, opacity: 0.0 });
          mat.depthWrite = false;
          mat.depthTest = true;
          mat.blending = THREE.AdditiveBlending;
          const mesh = new THREE.Mesh(geo, mat);
          mesh.visible = false;
          mesh.frustumCulled = false;
          mesh.renderOrder = 6;
          mesh.position.copy(this._tmpMoon);
          this._sunMesh = mesh;
          this.scene?.add?.(mesh);
        } catch (_) {}
      }

      this._initDone = true;
    }

    const blendSec = Math.max(0.0, Number(enterBlendSec || 0) || 0.0);
    const enterK = blendSec > 1e-6 ? smoothstep(node3Time, node3Time + blendSec, t) : 1.0;
    const lightBlendSec = Math.max(0.0, Number(enterLightBlendSec || 0) || 0.0);
    const lightK = lightBlendSec > 1e-6 ? smoothstep(node3Time, node3Time + lightBlendSec, t) : 1.0;

    const az = (this._baseAz || 0.0) + orbitRad;
    const x = Math.sin(az) * (this._radiusXZ || 1.0);
    const z = Math.cos(az) * (this._radiusXZ || 1.0);
    const liftK = smoothstep(0.0, cameraLiftEndDeg, orbitDegNow);
    const baseY = (this._baseY || 0.0);
    const targetY = (typeof cameraMinY === 'number') ? Math.max(baseY, cameraMinY) : baseY;
    const y = baseY + (targetY - baseY) * liftK;
    this._tmpCamTargetPos.set(this._tmpMoon.x + x, this._tmpMoon.y + y, this._tmpMoon.z + z);
    if (this._enterPos0 && enterK < 0.999) camera.position.lerpVectors(this._enterPos0, this._tmpCamTargetPos, enterK);
    else camera.position.copy(this._tmpCamTargetPos);
    try {
      const lookK = smoothstep(0.0, lookBlendDeg, orbitDegNow);
      this._tmpMat4.lookAt(camera.position, this._tmpMoon, this._upAxis0 || camera.up);
      this._tmpQuatLook.setFromRotationMatrix(this._tmpMat4);
      if (this._camQuat0 && camera.quaternion) {
        this._tmpQuatDesired.copy(this._camQuat0).slerp(this._tmpQuatLook, lookK);
        if (this._enterQuat0 && enterK < 0.999) {
          camera.quaternion.copy(this._enterQuat0).slerp(this._tmpQuatDesired, enterK);
        } else {
          camera.quaternion.copy(this._tmpQuatDesired);
        }
      } else {
        camera.lookAt(this._tmpMoon);
      }
    } catch (_) {}

    const dir = this.scene?.children?.find?.(c => c.type === 'DirectionalLight');
    const amb = this.scene?.children?.find?.(c => c.type === 'AmbientLight');

    if (dir && lockDirLight && this._dirLightPos0) {
      try {
        if (this._enterDirPos0 && lightK < 0.999) dir.position.lerpVectors(this._enterDirPos0, this._dirLightPos0, lightK);
        else dir.position.copy(this._dirLightPos0);
      } catch (_) {}
      try {
        if (dir.target) {
          dir.target.position.copy(this._tmpMoon);
          if (!dir.target.parent) this.scene?.add?.(dir.target);
        }
      } catch (_) {}
    }
    if (amb) {
      const fromAmb = (typeof this._enterAmb0 === 'number') ? this._enterAmb0 : (Number(amb.intensity || 0) || 0);
      const toAmb = Math.max(0.0, Number(maxAmbient || 0) || 0.0);
      amb.intensity = fromAmb + (toAmb - fromAmb) * lightK;
    }
    if (dir) {
      const fromDir = (typeof this._enterDirInt0 === 'number') ? this._enterDirInt0 : (Number(dir.intensity || 0) || 0);
      const toDir = Math.max(fromDir, Math.max(0.0, Number(minDir || 0) || 0.0));
      dir.intensity = fromDir + (toDir - fromDir) * lightK;
    }

    const showK =
      smoothstep(appearDeg, appearFullDeg, orbitDegNow) *
      (1.0 - smoothstep(disappearDeg, disappearEndDeg, orbitDegNow));

    this._tmpUp.copy(this._upAxis0 || camera.up);
    this._tmpForward.copy(this._tmpMoon).sub(camera.position);
    const fLen = Math.max(1e-6, this._tmpForward.length());
    this._tmpForward.multiplyScalar(1.0 / fLen);
    this._tmpRight.crossVectors(this._tmpForward, this._tmpUp);
    const rLen = Math.max(1e-6, this._tmpRight.length());
    this._tmpRight.multiplyScalar(1.0 / rLen);
    this._tmpAway.copy(this._tmpForward);

    const earthDistSafe = Math.max(1e-6, earthDist);
    const sunDistSafe = Math.max(1e-6, sunDist);

    const earthBaseSide = earthSide;
    const earthBaseUp = earthUp;
    const sunBaseSide = sunSide;
    const sunBaseUp = sunUp;

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    const moonR = Math.max(1e-6, Number(moonRadius || 1.0));
    const moonAng = Math.asin(Math.min(0.999, moonR / Math.max(1e-6, fLen)));
    const occlMargin = 1.06;
    const occlIn = moonAng * 0.98;
    const occlOut = moonAng * 1.18;

    if (enableSun && this._sunMesh && sunOpacity > 0) {
      this._tmpSunPos.copy(this._tmpMoon)
        .addScaledVector(this._earthDir0 || this._tmpAway, sunDistSafe)
        .addScaledVector(this._sideAxis0 || this._tmpRight, sunBaseSide)
        .addScaledVector(this._upAxis0 || this._tmpUp, sunBaseUp);

      try { this._sunMesh.position.copy(this._tmpSunPos); } catch (_) {}
      const m = this._sunMesh.material;
      if (m) {
        let kOcc = 1.0;
        try {
          this._tmpRel.copy(this._tmpSunPos).sub(camera.position).normalize();
          const dot = clamp(this._tmpRel.dot(this._tmpForward), -1.0, 1.0);
          const ang = Math.acos(dot);
          kOcc = smoothstep(occlIn, occlOut, ang);
        } catch (_) {}
        m.opacity = sunOpacity * showK * kOcc;
        m.transparent = true;
        m.needsUpdate = true;
      }
      const s = sunBaseScale + sunScaleAdd * showK;
      this._sunMesh.scale.set(s, s, s);
      this._sunMesh.visible = showK > 0.01;
    } else if (this._sunMesh) {
      this._sunMesh.visible = false;
    }

    if (earthMode === 'between') {
      const k = Math.max(0.05, Math.min(0.95, Number(earthBetweenK ?? 0.62)));
      const distFromCamRaw = fLen * k;
      const moonR2 = Math.max(0.001, Number(moonRadius || 1.0)) * 1.1;
      const distFromCam = Math.max(0.25, Math.min(distFromCamRaw, fLen - moonR2));
      let side = Number(earthBetweenSide || 0);
      let up = Number(earthBetweenUp || 0);
      if (earthBetweenRotate) {
        const degOffset = Number(earthBetweenRotateDegOffset || 0);
        const ang = (Number(orbitDegNow || 0) + degOffset) * Math.PI / 180;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        const side2 = side * c - up * s;
        const up2 = side * s + up * c;
        side = side2;
        up = up2;
      }
      this._tmpEarthPos.copy(camera.position)
        .addScaledVector(this._tmpForward, distFromCam)
        .addScaledVector(this._tmpRight, side)
        .addScaledVector(this._tmpUp, up);
    } else {
      this._tmpEarthPos.copy(this._tmpMoon)
        .addScaledVector(this._earthDir0 || this._tmpAway, earthDistSafe)
        .addScaledVector(this._sideAxis0 || this._tmpRight, earthBaseSide)
        .addScaledVector(this._upAxis0 || this._tmpUp, earthBaseUp);
    }

    if (globeGroup) {
      try {
        const parent = globeGroup.parent;
        if (parent && typeof parent.worldToLocal === 'function') {
          this._tmpLocalPos.copy(this._tmpEarthPos);
          parent.worldToLocal(this._tmpLocalPos);
          globeGroup.position.copy(this._tmpLocalPos);
        } else {
          globeGroup.position.copy(this._tmpEarthPos);
        }
      } catch (_) {
        try { globeGroup.position.set(this._tmpEarthPos.x, this._tmpEarthPos.y, this._tmpEarthPos.z); } catch(_){}
      }
      const baseScale = Number(baseGlobeScale || 1.0);
      const mul = (typeof earthScaleMul === 'number') ? earthScaleMul : (0.85 + 0.15 * showK);
      const earthScale = baseScale * mul;
      globeGroup.scale.set(earthScale, earthScale, earthScale);
      let kOcc = 1.0;
      if (earthMode !== 'between' && earthOccludeFade) {
        try {
          this._tmpRel.copy(this._tmpEarthPos).sub(camera.position).normalize();
          const dot = clamp(this._tmpRel.dot(this._tmpForward), -1.0, 1.0);
          const ang = Math.acos(dot);
          kOcc = smoothstep(occlIn, occlOut, ang);
        } catch (_) {}
      }
      globeGroup.visible = !earthUseProxy && ((showK * kOcc) > 0.01);
      try { globeGroup.frustumCulled = false; } catch(_){}
      try { globeGroup.children.forEach(c => c.visible = true); } catch(_) {}
    }

    if (earthUseProxy && this.scene) {
      try {
        if (!this._earthProxyMesh && THREE) {
          const geo = new THREE.SphereGeometry(1.0, 24, 24);
          const mat = new THREE.MeshBasicMaterial({ color: 0x2a7fff });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.frustumCulled = false;
          mesh.renderOrder = 50;
          this._earthProxyMesh = mesh;
          this.scene.add(mesh);
        }
        if (this._earthProxyMesh) {
          const baseScale = Number(baseGlobeScale || 1.0);
          const mul = (typeof earthScaleMul === 'number') ? earthScaleMul : (0.85 + 0.15 * showK);
          const s = baseScale * mul;
          this._earthProxyMesh.position.copy(this._tmpEarthPos);
          this._earthProxyMesh.scale.set(s, s, s);
          this._earthProxyMesh.visible = showK > 0.01;
        }
      } catch (_) {}
    } else if (this._earthProxyMesh) {
      this._earthProxyMesh.visible = false;
    }

    if (globeGroup && dir) {
      try {
        let earthMesh = null;
        if (typeof globeGroup.getObjectByName === 'function') {
          earthMesh = globeGroup.getObjectByName('EARTH');
        }
        if (!earthMesh) {
          globeGroup.traverse?.((o) => {
            if (earthMesh) return;
            if (o?.name === 'EARTH') earthMesh = o;
          });
        }
        const mat = earthMesh?.material;
        const u = mat?.uniforms;
        if (u?.uLightDirWorld?.value && u?.uGlobeCenterWorld?.value) {
          globeGroup.getWorldPosition(this._tmpEarthCenter);
          this._tmpLightDir.copy(dir.position).sub(this._tmpEarthCenter).normalize();
          u.uLightDirWorld.value.copy(this._tmpLightDir);
          u.uGlobeCenterWorld.value.copy(this._tmpEarthCenter);
          try { if (u.uCameraPosWorld?.value) u.uCameraPosWorld.value.copy(camera.position); } catch(_){}
          try { if (u.uTime) u.uTime.value = Date.now() * 0.001; } catch(_){}
        }
      } catch (_) {}
    }

    if (debug && globeGroup) {
      try {
        const now = Date.now();
        if (now >= (this._dbgNext || 0)) {
          this._dbgNext = now + 650;
          let dotCam = null;
          try {
            if (typeof camera.getWorldDirection === 'function') {
              camera.getWorldDirection(this._tmpCamDir);
              this._tmpCamDir.normalize();
              this._tmpRel.copy(this._tmpEarthPos).sub(camera.position).normalize();
              dotCam = clamp(this._tmpRel.dot(this._tmpCamDir), -1.0, 1.0);
            }
          } catch (_) {}
          console.log('[Moon][EarthDiag]', {
            orbitDeg: Number((orbitDegNow || 0).toFixed(1)),
            showK: Number((showK || 0).toFixed(3)),
            earthDist: Number((earthDistSafe || 0).toFixed(2)),
            earthSide: Number((earthBaseSide || 0).toFixed(2)),
            earthUp: Number((earthBaseUp || 0).toFixed(2)),
            earthMode,
            earthUseProxy: !!earthUseProxy,
            earthX: Number((this._tmpEarthPos.x || 0).toFixed(2)),
            earthY: Number((this._tmpEarthPos.y || 0).toFixed(2)),
            earthZ: Number((this._tmpEarthPos.z || 0).toFixed(2)),
            camX: Number((camera.position?.x || 0).toFixed(2)),
            camY: Number((camera.position?.y || 0).toFixed(2)),
            camZ: Number((camera.position?.z || 0).toFixed(2)),
            dotCam,
            visible: !!globeGroup.visible,
          });
        }
      } catch (_) {}
    }

    if (farEarth) {
      // 在原轨道确定后固定地球位置；不挪动主地球，不修改原绕月相机。
      if (!this._farEarth) {
        const endAz = this._baseAz + orbitEndDeg * Math.PI / 180;
        const endOffset = new THREE.Vector3(Math.sin(endAz) * this._radiusXZ,
          Math.max(this._baseY, cameraMinY), Math.cos(endAz) * this._radiusXZ);
        this._farEarthEndAxis = endOffset.clone().normalize();
        const forward = this._farEarthEndAxis.clone().negate();
        const right = new THREE.Vector3().crossVectors(forward, this._upAxis0).normalize();
        const up = new THREE.Vector3().crossVectors(right, forward).normalize();
        const halfHeight = 40 * moonR * Math.tan(camera.fov * Math.PI / 360);
        const geo = new THREE.SphereGeometry(1, 48, 32);
        // 远景冰雪不额外顶白，保留海洋与陆地的颜色层次。
        const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(1, 1, 1) });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'MOON_VOYAGE_FAR_EARTH';
        // 以原轨道终点的视野定地球，而不是转动镜头去找地球。
        mesh.position.copy(moonWorld).add(endOffset).addScaledVector(forward, 40 * moonR)
          .addScaledVector(right, -0.5 * halfHeight * Math.min(camera.aspect, 0.75))
          .addScaledVector(up, 0.62 * halfHeight);
        // 约占竖屏宽度 14%，是 MV 的视觉比例，不是天文距离比例。
        const size = 0.14 * 40 * moonR * Math.tan(camera.fov * Math.PI / 360) * Math.min(camera.aspect, 0.75);
        mesh.scale.setScalar(size);
        // 终景以中国中部（105°E、35°N）朝向观众，北方朝画面上方。
        // 等距经纬贴图：u=(经度+180)/360，v=(纬度+90)/180。
        const lon = 105 * Math.PI / 180, lat = 35 * Math.PI / 180;
        const normal = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
        const east = new THREE.Vector3(-Math.sin(lon), 0, -Math.cos(lon));
        const north = new THREE.Vector3().crossVectors(normal, east);
        const finalCamera = moonWorld.clone().addScaledVector(this._farEarthEndAxis, 4.5 * moonR);
        const facing = finalCamera.sub(mesh.position).normalize();
        // 中国中部朝亮面偏约 36 度，避免大陆被晨昏线压黑、只剩海洋和极区。
        const sunlight = this._fromMoonToCam0.clone().addScaledVector(this._upAxis0, 0.15).normalize();
        facing.addScaledVector(sunlight, -facing.dot(sunlight)).normalize();
        facing.multiplyScalar(Math.cos(Math.PI / 5)).addScaledVector(sunlight, Math.sin(Math.PI / 5));
        const screenRight = new THREE.Vector3().crossVectors(this._upAxis0, facing).normalize();
        const screenUp = new THREE.Vector3().crossVectors(facing, screenRight).normalize();
        const localBasis = new THREE.Matrix4().makeBasis(east, north, normal);
        const worldBasis = new THREE.Matrix4().makeBasis(screenRight, screenUp, facing);
        this._farEarthFacing = new THREE.Quaternion().setFromRotationMatrix(worldBasis.multiply(localBasis.transpose()));
        mesh.visible = false;
        this._farEarth = mesh;
        this.scene.add(mesh);
        // 复用包内灰度云图作透明度，黑色区域透出海陆；与地表共用原光照。
        const cloudMaterial = new THREE.MeshLambertMaterial({
          color: 0xffffff, transparent: true, opacity: 0.58, depthWrite: false
        });
        const cloud = new THREE.Mesh(new THREE.SphereGeometry(1.008, 48, 32), cloudMaterial);
        cloud.name = 'MOON_VOYAGE_FAR_EARTH_CLOUD';
        cloud.visible = false;
        mesh.add(cloud);
        this._farEarthCloud = cloud;
        this._farEarthCloudTexture = new THREE.TextureLoader().load('/assets/textures/preview-cloud.png', texture => {
          if (this._farEarthCloud !== cloud) return;
          fixTexture(texture, isPC);
          // alphaMap 是线性数据，不采用地表彩色贴图的 sRGB 解码。
          texture.minFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;
          cloudMaterial.alphaMap = texture;
          cloudMaterial.needsUpdate = true;
          cloud.visible = true;
        }, undefined, () => { if (this._farEarthCloud === cloud) cloud.visible = false; });
        // 使用已有的自然色日间贴图；试验版素材在亚洲北部有大片白色覆盖。
        this._farEarthTexture = new THREE.TextureLoader().load('/assets/textures/preview-day.jpg', texture => {
          if (this._farEarth !== mesh) return;
          fixTexture(texture, isPC);
          texture.encoding = THREE.sRGBEncoding;
          texture.minFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;
          mat.map = texture;
          mat.needsUpdate = true;
          mesh.visible = true;
        }, undefined, () => { if (this._farEarth === mesh) mesh.visible = false; });
      }
      // 约每分钟转 31 度，仅转动地表；固定地球位置、太阳方向和相机均不变。
      // 按绝对旅程时间计算，暂停/跳时/帧率变化不会累计出不同朝向。
      this._farEarth.quaternion.copy(this._farEarthFacing);
      // 以推近完成时刻为朝向基准，自转仍连续且可重复定位。
      this._farEarth.rotateY((t - node3Time - orbitDurationSec - finalApproachSec) * 0.009);
      // 云层随地球转动，并带很轻的相对漂移；按绝对时间避免跳时积累误差。
      if (this._farEarthCloud) this._farEarthCloud.rotation.y =
        (t - node3Time - orbitDurationSec - finalApproachSec) * 0.00035;
      // 原 630 度环绕完整结束后才推近，前面的位置/朝向逐帧保持原值。
      const approach = smoothstep(node3Time + orbitDurationSec, node3Time + orbitDurationSec + finalApproachSec, t);
      if (approach > 0) {
        const endPosition = this._tmpCamTargetPos.copy(moonWorld)
          .addScaledVector(this._farEarthEndAxis, 4.5 * moonR);
        // 保持原朝向，只沿视线推近。地球在推近前后均在同一侧可见。
        camera.position.lerp(endPosition, approach);
      }
    }

    if (sunGlare) this._tickGlare(camera, moonWorld, moonR, orbitDegNow, orbitT, orbitDurationSec, orbitEndDeg);
    else if (this._glare) this._glare.visible = false;
    return { active: true, orbitDeg: orbitDegNow, showK };
  }
}

function clamp01(v) {
  return Math.max(0.0, Math.min(1.0, v));
}

function smoothstep(edge0, edge1, x) {
  const denom = Math.max(1e-6, edge1 - edge0);
  const t = clamp01((x - edge0) / denom);
  return t * t * (3.0 - 2.0 * t);
}

function easeInOut(t) {
  return t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}
