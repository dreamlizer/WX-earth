
export function createFadeOverlay(THREE, camera, tweener) {
  const geo = new THREE.PlaneGeometry(20, 20); // 覆盖全屏
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.0, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 9999;
  mesh.visible = false;
  mesh.position.set(0, 0, -2); // 挂载在相机前方
  camera.add(mesh);
  return {
      fadeInBlack: (dur = 500, cb) => {
          mesh.visible = true;
          tweener.to(mat, { opacity: 1.0 }, dur, t => t * t, null, cb);
      },
      fadeOutBlack: (dur = 500, cb) => {
          tweener.to(mat, { opacity: 0.0 }, dur, t => t * (2 - t), null, () => {
              mesh.visible = false;
              if (cb) cb();
          });
      }
  };
}
