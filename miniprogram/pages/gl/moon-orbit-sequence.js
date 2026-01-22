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
    return !!this._sunMesh;
  }

  reset() {
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
