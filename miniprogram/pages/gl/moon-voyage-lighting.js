
export const updateLighting = (mgrState, p, moonP = 0) => {
  const s = mgrState._startState;
  if (!s) return;
  
  const targetAmb = 0.6; // Normal mode ambient ~0.6
  const targetDir = 1.5; // Strong directional
  const targetDirPos = { x: 2, y: 5, z: 8 };
  
  const scene = mgrState.scene;
  if (!scene) return;

  const amb = scene.children.find(c => c.type === 'AmbientLight');
  const dir = scene.children.find(c => c.type === 'DirectionalLight');
  
  if (amb) {
      amb.intensity = s.ambInt + (targetAmb - s.ambInt) * p;
  }
  
  if (dir) {
      dir.intensity = s.dirInt + (targetDir - s.dirInt) * p;
      
      dir.position.x = s.dirPos.x + (targetDirPos.x - s.dirPos.x) * p;
      dir.position.y = s.dirPos.y + (targetDirPos.y - s.dirPos.y) * p;
      dir.position.z = s.dirPos.z + (targetDirPos.z - s.dirPos.z) * p;
  }
  // Establish the existing orbit light while the Moon is still approaching.
  // Its first stable view then has the same illumination as orbit entry.
  if (moonP > 0) {
    const moon = mgrState._tmpMoonStart || { x: -5.8, y: -1.2, z: 0 };
    const dx = -moon.x, dy = -moon.y, dz = 5 - moon.z, distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (amb) amb.intensity = .6 + (.07 - .6) * moonP;
    if (dir) {
      dir.position.set(2 + (moon.x + dx/distance*28 - 2)*moonP,
        5 + (moon.y + dy/distance*28 + 4.2 - 5)*moonP,
        8 + (moon.z + dz/distance*28 - 8)*moonP);
      if (dir.target) {
        const start = s.dirTarget || { x: 0, y: 0, z: 0 };
        dir.target.position.set(start.x + (moon.x-start.x)*moonP, start.y + (moon.y-start.y)*moonP, start.z + (moon.z-start.z)*moonP);
        if (!dir.target.parent) scene.add(dir.target);
      }
    }
  }
};
