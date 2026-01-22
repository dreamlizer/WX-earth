
export const updateLighting = (mgrState, p) => {
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
};
