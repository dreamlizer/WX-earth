
import * as _const from './label-constants.js';

const GRID_SIZE = _const?.GRID_SIZE ?? 68;
const EDGE_FADE_PX = _const?.EDGE_FADE_PX ?? 28;

export const LabelsLayout = {
  makeGrid(width, height, cell = GRID_SIZE) {
    const cols = Math.max(1, Math.ceil(width  / cell));
    const rows = Math.max(1, Math.ceil(height / cell));
    const occ  = new Array(rows * cols).fill(0);
    return { cols, rows, cell, occ };
  },

  worldToScreen(worldPos, ctx) {
    const { THREE, camera, width, height } = ctx;
    const clip = LabelsLayout.__clip || (LabelsLayout.__clip = new THREE.Vector4());
    
    clip.set(worldPos.x, worldPos.y, worldPos.z, 1.0);
    clip.applyMatrix4(camera.matrixWorldInverse);
    clip.applyMatrix4(camera.projectionMatrix);

    if (clip.w <= 0) return null;
    const ndcX = clip.x / clip.w, ndcY = clip.y / clip.w, ndcZ = clip.z / clip.w;
    if (ndcZ < -1 || ndcZ > 1) return null;

    const x = (ndcX * 0.5 + 0.5) * width;
    const y = (-ndcY * 0.5 + 0.5) * height;
    return { x, y, ndcX, ndcY };
  },

  estimatePixelSize(mesh, worldPos, ctx) {
    const { camera, height } = ctx;
    if (!mesh || !worldPos || !height) return { w: GRID_SIZE, h: GRID_SIZE };
    
    const fov = camera.fov;
    if (LabelsLayout.__fov !== fov || !LabelsLayout.__tanHalfFov) {
      LabelsLayout.__fov = fov;
      LabelsLayout.__tanHalfFov = Math.tan(((fov * Math.PI) / 180) / 2);
    }
    const tanHalfFov = LabelsLayout.__tanHalfFov;
    
    const dx = camera.position.x - worldPos.x;
    const dy = camera.position.y - worldPos.y;
    const dz = camera.position.z - worldPos.z;
    const distToLabel = Math.max(1e-6, Math.sqrt(dx*dx + dy*dy + dz*dz));
    
    const visibleHeightAtDist = 2 * distToLabel * tanHalfFov;
    const pxPerWorldUnit = height / Math.max(1e-6, visibleHeightAtDist);
    const hpx = Math.abs(mesh.scale.y * pxPerWorldUnit);
    const wpx = Math.abs(mesh.scale.x * pxPerWorldUnit);
    
    return { w: Math.max(1, wpx), h: Math.max(1, hpx) };
  },

  tryOccupy(grid, x, y, w=1, h=1) {
    const { cols, rows, cell, occ } = grid;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    
    // Check
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const gx = cx + dx, gy = cy + dy;
        if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return false;
        if (occ[gy * cols + gx]) return false;
      }
    }
    // Occupy
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const gx = cx + dx, gy = cy + dy;
        occ[gy * cols + gx] = 1;
      }
    }
    return true;
  },

  occupyForce(grid, x, y, w=1, h=1) {
    if (!grid) return;
    const { cols, rows, cell, occ } = grid;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const gx = cx + dx, gy = cy + dy;
        if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
        occ[gy * cols + gx] = 1;
      }
    }
  },

  occupyAround(grid, x, y, radiusPx = GRID_SIZE) {
    if (!grid) return;
    const rCells = Math.ceil(radiusPx / grid.cell);
    const cx = Math.floor(x / grid.cell);
    const cy = Math.floor(y / grid.cell);
    const { cols, rows, occ } = grid;
    
    for (let dy = -rCells; dy <= rCells; dy++) {
      for (let dx = -rCells; dx <= rCells; dx++) {
        const gx = cx + dx;
        const gy = cy + dy;
        if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
        if (dx*dx + dy*dy <= rCells*rCells) {
          occ[gy * cols + gx] = 1;
        }
      }
    }
  }
};
