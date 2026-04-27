
import { advanceRotationFrame, zenState } from './zen-mode-manager.js';
import { renderWithBloom } from './bloom-manager.js';
import { INTERACTION_DEBUG_LOG, PERF_HIDE_MARKERS_ON_DRAG, LOD_CITIES_START_APPEAR } from './label-constants.js';
import { updateLabels } from './labels.js';
import { updateCityMarkers, setCityMarkersVisible } from './city-markers.js';

export function getLabelUpdateIntervalMs({ isDragging, idle, isFlying, hasInertia } = {}) {
  if (isDragging) return 96;
  if (idle) return 140;
  if (isFlying || hasInertia) return 48;
  return 48;
}

export function getMarkerUpdateIntervalMs({ isDragging, hasHighlight } = {}) {
  if (isDragging) return Infinity;
  return hasHighlight ? 50 : 100;
}

export function createSceneUpdater(ctx) {
  const {
    perfMonitor, runtimeDiagnostics, textureHealthChecker,
    tweener, highlight, page, flyMgr, starCtl, tzMgr,
    lighting, touch, globeGroup, camera, baseDist, clampZoom, updateCamDist,
    APP_CFG, LIGHT_CFG, setZenMode,
    THREE, renderer, scene, width, height,
    isMoonVoyageActive // New dependency
  } = ctx;

  // Mutable state local to the updater
  let __shaderSyncNext = 0;
  let __startupClearSelection = (APP_CFG?.startup?.clearDefaultSelection ?? true);
  
  // Storage for inertia log throttling (replaces render.__lastInertiaLog)
  const debugState = { __lastInertiaLog: 0 };

  // View Update State
  let __lastRotX = 0;
  let __lastRotY = 0;
  let __lastLabelUpdateAt = 0;
  let __lastMarkerUpdateAt = 0;
  let __lastBorderWidth = 0;
  let __borderLines = [];
  let __markersVisible = true;

  // Helper to access dynamic refs
  const getRefs = () => ctx.refs;

  const update = () => {
    const refs = getRefs();
    const now = Date.now();
    const dtSec = perfMonitor.update(now);
    try { runtimeDiagnostics?.recordFrame?.(now, dtSec); } catch(_){}
    
    tweener.update(now);

    // 0. Moon Voyage Override
    // If Moon Voyage is active, we skip standard Earth rotation/interaction logic
    // and only perform rendering. The MoonVoyageManager handles its own animation loop.
    const moonUiActive = !!page?.data?.moonVoyageActive;
    const moonActive = moonUiActive || (isMoonVoyageActive && isMoonVoyageActive());
    if (moonActive) {
       try { starCtl?.tick?.(now, dtSec); } catch(_){ }
       // Still render the scene
       let composer = refs.composer();
       let bloomPass = refs.bloomPass();
       const zenActive = true; // Force zen active for rendering config if needed
       
       try {
          const res = renderWithBloom({
            THREE, renderer, scene, camera, width, height,
            composer, bloomPass, zenActive, APP_CFG
          });
          if (res.composer !== composer) refs.setComposer(res.composer);
          if (res.bloomPass !== bloomPass) refs.setBloomPass(res.bloomPass);
       } catch(e) { console.error('[Moon] Render failed', e); }
       
       try { runtimeDiagnostics?.flush?.(now); } catch(_){}
       return;
    }
    
    // 1. Startup Logic
    try {
      if (__startupClearSelection) {
        __startupClearSelection = false;
        highlight.setHighlight(null);
        page.selectedTimezone = null;
        page.setData({ hoverText: '' });
        page.lastTimeUpdate = 0;
        try { page?.onCountryPicked?.(null); } catch(_){}
      }
    } catch(_){}

    // 2. State Exposure
    try { 
      const s = ctx.getState?.();
      if (s) s.isFlying = !!flyMgr?.isFlying?.(); 
    } catch(_){}

    // 3. Environment Updates
    try { starCtl?.tick?.(now, dtSec); } catch(_){}

    // 4. Timezone Logic
    try { tzMgr.updatePerFrame(now); } catch(_){}

    // 5. Lighting & Zen State
    // Access zenActive from zenState for consistency, but allow override if passed
    // Actually main.js passes zenActive via setZenMode closure, but we can read it from zenState
    const zenActive = zenState.active; 
    lighting.updateDirLight(zenActive);

    // 6. Rotation & Inertia
    if (!touch.isDragging && !touch.pinch) {
      // Mock 'render' object for advanceRotationFrame logging compatibility
      const mockRender = { __lastInertiaLog: debugState.__lastInertiaLog };
      
      const rot = advanceRotationFrame({
        touch, dtSec, now, LIGHT_CFG, zenActive, globeGroup, camera, 
        baseDist, clampZoom, updateCamDist, flyMgr, INTERACTION_DEBUG_LOG,
        render: mockRender, // Pass mock object
        setZenMode, 
        tiltZ: zenState.tiltZ, 
        zoom: zenState.zoom, 
        __zenAnim: zenState.anim, 
        __zenBrake: zenState.brake, 
        zenStableSince: zenState.stableSince, 
        __zenDelayEnter: zenState.delayEnter
      });
      
      // Sync back debug state
      debugState.__lastInertiaLog = mockRender.__lastInertiaLog;

      // Update State
      zenState.tiltZ = rot.tiltZ;
      zenState.zoom = rot.zoom;
      zenState.anim = rot.__zenAnim;
      zenState.brake = rot.__zenBrake;
      zenState.stableSince = rot.zenStableSince;
      zenState.delayEnter = rot.__zenDelayEnter;
    }
    
    // Apply Rotation
    globeGroup.rotation.set(touch.rotX, touch.rotY, zenState.tiltZ);

    // 7. Cloud Rotation
    try {
      const cloudMesh = refs.cloudMesh();
      const spinDegSec = Number(APP_CFG?.cloud?.spinDegPerSec ?? 0);
      if (cloudMesh && cloudMesh.visible && spinDegSec !== 0) {
        cloudMesh.rotation.y += (spinDegSec * Math.PI / 180) * dtSec;
      }
    } catch(_){ }

    // 8. Visual Effects
    try { flyMgr.updateFx(now); } catch(_){ }
    
    try { 
        const dayNightMat = refs.themeState().get()?.dayNightMat;
        if (now >= __shaderSyncNext) { 
            lighting.syncDayNightShader(dayNightMat); 
            __shaderSyncNext = now + 33; 
        } 
    } catch(_){}
    
    try { refs.poetry3d()?.update?.(now); } catch(_){}
    try { highlight.updatePerFrame(now); } catch(_){ }

    // 9. Rendering (Bloom)
    let composer = refs.composer();
    let bloomPass = refs.bloomPass();
    
    try {
      const res = renderWithBloom({
        THREE, renderer, scene, camera, width, height,
        composer, bloomPass, zenActive, APP_CFG
      });
      // Update refs if changed
      if (res.composer !== composer) refs.setComposer(res.composer);
      if (res.bloomPass !== bloomPass) refs.setBloomPass(res.bloomPass);
    } catch(e){ console.error('[RenderBloom] failed', e); }

    // 10. View Updates (Labels, Markers, Borders)
    try {
      const rx = globeGroup.rotation.x;
      const ry = globeGroup.rotation.y;
      const isFlying = !!flyMgr?.isFlying?.();
      const isDragging = !!touch.isDragging;
      const hasInertia = Math.abs(touch.velX || 0) > 0.0002 || Math.abs(touch.velY || 0) > 0.0002;
      
      // Idle detection
      let idle = false;
      if (!isDragging && !isFlying) {
         const dx = Math.abs(rx - __lastRotX);
         const dy = Math.abs(ry - __lastRotY);
         idle = (dx < 0.0006 && dy < 0.0006);
      }
      __lastRotX = rx;
      __lastRotY = ry;

      // Label Updates
      const intervalMs = getLabelUpdateIntervalMs({ isDragging, idle, isFlying, hasInertia });
      if ((now - __lastLabelUpdateAt) >= intervalMs) {
          if (runtimeDiagnostics?.isEnabled?.()) runtimeDiagnostics.measure('labels', () => updateLabels());
          else updateLabels();
          __lastLabelUpdateAt = now;
      }

      // City Marker Updates
      const camDist = Math.max(0.1, camera.position.length());
      const wantMarkers = (!PERF_HIDE_MARKERS_ON_DRAG || !isDragging) && (camDist <= (LOD_CITIES_START_APPEAR + 0.3));
      if (wantMarkers !== __markersVisible) {
          setCityMarkersVisible(wantMarkers);
          __markersVisible = wantMarkers;
          if (wantMarkers) __lastMarkerUpdateAt = 0;
      }
      if (wantMarkers) {
          const markerIntervalMs = getMarkerUpdateIntervalMs({ isDragging, hasHighlight: false });
          if ((now - __lastMarkerUpdateAt) >= markerIntervalMs) {
              if (runtimeDiagnostics?.isEnabled?.()) runtimeDiagnostics.measure('markers', () => updateCityMarkers(camera, now));
              else updateCityMarkers(camera, now);
              __lastMarkerUpdateAt = now;
          }
      }

      // Border Width Updates
      const z = refs.zoom?.() || 1; 
      const base = 0.003;
      const newWidth = base / Math.max(0.001, z);
      if (Math.abs(__lastBorderWidth - newWidth) > 1e-4) {
          if (!__borderLines.length) {
              globeGroup.traverse(obj => {
                  const mat = obj?.material;
                  const ro = mat?.userData?.ro;
                  if (obj?.isLine && mat && (ro === 20 || ro === 40)) {
                      __borderLines.push(obj);
                  }
              });
          }
          for (const obj of __borderLines) {
              if (obj.material) obj.material.linewidth = newWidth;
          }
          __lastBorderWidth = newWidth;
      }
    } catch(e) { console.error('[ViewUpdate] error', e); }

    try { textureHealthChecker?.tick?.(now); } catch(_){}
    try { runtimeDiagnostics?.flush?.(now); } catch(_){}
  };

  return { update };
}
