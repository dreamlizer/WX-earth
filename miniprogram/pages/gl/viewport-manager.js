export function createViewportManager({ wx, renderer, camera, state }){
  const update = () => {
    try {
      wx.createSelectorQuery().select('#gl').fields({ size: true }).exec(r => {
        const s = r && r[0];
        if (!s) return;
        const sys2 = wx.getSystemInfoSync() || {};
        const wRaw = s.width, hRaw = s.height;
        const w = Math.max(1, Math.min(wRaw, sys2.windowWidth || wRaw));
        const h = Math.max(1, Math.min(hRaw, sys2.windowHeight || hRaw));
        if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
          try { renderer.setSize(w, h); } catch(_){ }
          try { camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); } catch(_){ }
          if (state) { state.width = w; state.height = h; }
        }
      });
    } catch(_){ }
  };
  return { update };
}