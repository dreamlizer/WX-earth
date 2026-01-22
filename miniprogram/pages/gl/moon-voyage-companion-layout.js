
// Moon Voyage Companion Layout
// Handles 3D positioning and screen-to-world projection for companion robots

export class CompanionLayout {
  constructor() {
    this._tmpRight = null;
    this._tmpUp = null;
    this._tmpFwd = null;
    this._tmpWorld = null;
  }

  projectToWorld(camera, THREE, x01, y01Bob, cfgOne) {
    if (!THREE || !camera) return null;

    const camQ = camera.quaternion;
    const camP = camera.position;
    if (!camQ || !camP) return null;

    // Calculate dimensions
    const depth = Math.max(0.5, Number(cfgOne?.depth ?? 2.4) || 2.4);
    const sizeH = Math.max(0.01, Math.min(0.25, Number(cfgOne?.sizeScreenH ?? 0.05) || 0.05));
    const fovRad = (Number(camera.fov || 45) * Math.PI) / 180.0;
    const visH = 2.0 * depth * Math.tan(fovRad * 0.5);
    const visW = visH * Math.max(0.2, Number(camera.aspect || 1.0) || 1.0);
    
    const posX = (x01 - 0.5) * visW;
    const posY = (y01Bob - 0.5) * visH;

    // Initialize vectors if needed
    if (!this._tmpRight) this._tmpRight = new THREE.Vector3();
    if (!this._tmpUp) this._tmpUp = new THREE.Vector3();
    if (!this._tmpFwd) this._tmpFwd = new THREE.Vector3();
    if (!this._tmpWorld) this._tmpWorld = new THREE.Vector3();

    // Calculate world position
    this._tmpRight.set(1, 0, 0).applyQuaternion(camQ);
    this._tmpUp.set(0, 1, 0).applyQuaternion(camQ);
    this._tmpFwd.set(0, 0, -1).applyQuaternion(camQ);

    this._tmpWorld.copy(camP)
      .addScaledVector(this._tmpRight, posX)
      .addScaledVector(this._tmpUp, posY)
      .addScaledVector(this._tmpFwd, depth);

    const spriteH = visH * sizeH;

    return {
      position: this._tmpWorld,
      spriteH,
      visH
    };
  }
}
