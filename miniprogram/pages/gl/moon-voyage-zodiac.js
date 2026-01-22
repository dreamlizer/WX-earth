
import { SCORPIO_DATA, ZODIAC_ALL_DATA } from './moon-voyage-zodiac-data.js';
import { makeTextSprite } from './text-sprite.js';

// [Config] Debug Switch: Set to true to show Red Dot on constellations
export const SHOW_DEBUG_RED_DOT = false; 

export class ZodiacSystem {
  constructor() {
    this.THREE = null;
    this.scene = null;
    this.group = null;
    this._texture = null;
    this.active = false;
  }

  setContext({ THREE, scene, isDevtools }) {
    this.THREE = THREE;
    this.scene = scene;
    this.isDevtools = isDevtools;
  }

  // Load shared texture for stars
  preload() {
    return new Promise((resolve) => {
      if (this._texture) { resolve(); return; }
      // Generate a simple glow texture programmatically
      if (typeof document !== 'undefined' && document.createElement) {
          // Web env (not used in miniprogram typically, but for safety)
          resolve(); 
      } else {
        // Miniprogram: use a data URI or procedural canvas if possible, 
        // but for now we'll use a simple circle if texture fails, 
        // or load a generic particle texture if available.
        // Let's try to load the common star particle if we have path, 
        // otherwise we will use a generated canvas in _createStarTexture if platform allows,
        // or just null to let THREE use default square/circle points.
        
        // Strategy: We will create a CanvasTexture on the fly if OffscreenCanvas is available
        // But in wx-miniprogram, it's tricky without 'canvas' node.
        // So we will stick to THREE.PointsMaterial with map: null (squares) or use a known asset.
        // Let's use the same texture as the starfield if possible, or just standard points for now.
        // Better: load the glow texture used by moon-voyage-visuals if we can find it.
        // For Phase 1, we will use default points to ensure visibility.
        resolve();
      }
    });
  }

  init() {
    if (this.group) return; // Already inited
    
    const THREE = this.THREE;
    this.group = new THREE.Group();
    this.group.name = 'ZODIAC_SYSTEM';
    this.group.visible = false; 
    
    // Create a wrapper for offset logic if needed, 
    // but for "Under the Equator" plan, we can just position the group directly in tick()
    
    // Ensure camera sees far enough for the giant ring
    if (this.camera) {
       this.camera.far = Math.max(this.camera.far, 4000);
       this.camera.updateProjectionMatrix();
    }

    // Build the Ring of 12 Constellations
    this._buildRing();
    
    this.scene.add(this.group);
    this.active = true;
    // console.log('[Zodiac] System initialized (Ring Mode)');
  }

  _buildRing() {
    // Ring Configuration
    const RADIUS = 400.0; // Super Giant Mode
    const SCALE = 50.0;   // [Config] Constellation Size (星座整体大小): Increase to make constellations larger
    const COUNT = 12;
    
    // Use the full Zodiac data
    const dataset = ZODIAC_ALL_DATA; 

    for (let i = 0; i < COUNT; i++) {
        const angle = (i / COUNT) * Math.PI * 2;
        
        // Calculate position on the ring
        const x = Math.cos(angle) * RADIUS;
        const z = Math.sin(angle) * RADIUS;
        const y = 0; 

        const pos = this.THREE.Vector3 ? new this.THREE.Vector3(x, y, z) : { x, y, z };
        
        // Get specific constellation data (modulo just in case, though counts match)
        const data = dataset[i % dataset.length];

        // Create constellation group
        const conGroup = this._createConstellation(data, pos, SCALE);
        this.group.add(conGroup);
    }
  }

  _createConstellation(data, position, scale) {
    const THREE = this.THREE;
    const conGroup = new THREE.Group();
    
    // Set position relative to Moon center
    conGroup.position.copy(position);
    
    // Look at Moon Center (0,0,0) so they stand upright on the ring
    conGroup.lookAt(0, 0, 0);

    const w = scale;
    const h = scale;
    
    // 1. Create Stars (Mesh Spheres for 3D feel)
    data.points.forEach(p => {
       const mesh = this._createStarMesh(p);
       // Normalize coordinates: (0,0) is center of constellation
       const px = (p.x - 0.5) * w;
       const py = (p.y - 0.5) * h;
       // Z=0 is the plane of the constellation
       mesh.position.set(px, py, 0);
       conGroup.add(mesh);
    });

    // 2. Create Lines
    if (data.lines && data.lines.length > 0) {
      const lineGeo = new THREE.BufferGeometry();
      const linePos = [];
      
      data.lines.forEach(pair => {
        const p1 = data.points[pair[0]];
        const p2 = data.points[pair[1]];
        if (p1 && p2) {
           linePos.push(
             (p1.x - 0.5) * w, (p1.y - 0.5) * h, 0,
             (p2.x - 0.5) * w, (p2.y - 0.5) * h, 0
           );
        }
      });
      
      const BufAttr = THREE.Float32BufferAttribute || THREE.BufferAttribute;
      const attr = new BufAttr(linePos, 3);
      if (lineGeo.setAttribute) lineGeo.setAttribute('position', attr);
      else lineGeo.addAttribute('position', attr);

      const lineMat = new THREE.LineBasicMaterial({
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.08, // Fainter lines as requested (was 0.2)
        depthTest: true
      });
      
      const lines = new THREE.LineSegments(lineGeo, lineMat);
      conGroup.add(lines);
    }
    
    // 3. Add Debug Red Dot at the Top (Controlled by Switch)
    if (SHOW_DEBUG_RED_DOT) {
      // Local coords range from -h/2 to +h/2 in Y.
      // We place it slightly above the top edge.
      const topY = h * 0.5 + (scale * 0.1); // Add 10% margin
      const debugGeo = new THREE.SphereGeometry(1, 8, 8);
      const debugMat = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
      const debugMesh = new THREE.Mesh(debugGeo, debugMat);
      
      // Make it visible enough (Red Dot size)
      const debugScale = scale * 0.05; 
      debugMesh.scale.set(debugScale, debugScale, debugScale);
      debugMesh.position.set(0, topY, 0);
      
      conGroup.add(debugMesh);
    }

    // 4. Add Constellation Name (Bold Uppercase, High Transparency)
    try {
      // Calculate topY regardless of red dot for text positioning
      const topY = h * 0.5 + (scale * 0.1); 

      const nameStr = (data.name || '').toUpperCase();
      const textSprite = makeTextSprite(THREE, nameStr, {
        font: 'bold 64px sans-serif', // High res font
        color: '#ffffff',
        strokeWidth: 0, // No stroke for clean look
        padding: 16,
        worldHeight: scale * 0.2, // [Config] Font Size (字体大小): relative to constellation scale (0.1 = 10%)
        depthTest: true, // Occlude behind moon
        renderOrder: 1000
       });
       
       if (textSprite) {
         // Position below the red dot
         // The textSprite origin is center.
         // red dot at topY.
         // We want text top to be below red dot.
         // Shift down by smaller amount since text is smaller
         const textY = topY - (scale * 0.15); 
         textSprite.position.set(0, textY, 0);
         
         // Higher Transparency ("Looming" effect)
          if (textSprite.material) {
             textSprite.material.opacity = 0.12; // [Config] Font Opacity (字体透明度): 0.0 to 1.0 (lower is more transparent)
             textSprite.material.transparent = true;
          }
         
         conGroup.add(textSprite);
       }
    } catch(e) {
      console.warn('[Zodiac] Text fail', e);
    }
    
    return conGroup;
  }
  
  _createStarMesh(p) {
    const THREE = this.THREE;
    // Use SphereGeometry for 3D volume
    const geo = new THREE.SphereGeometry(1, 8, 8); 
    const mat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF, // Force pure white for max brightness
      transparent: true,
      opacity: 1.0     // Force max opacity
    });
    
    const mesh = new THREE.Mesh(geo, mat);
    // Base scale adjustment
    // Adjusted for Super Giant Mode (Parent Scale 40.0) -> 0.18 gives ~7.2 world size (visible from 400 dist)
    // User requested "larger" (20% more than 0.15)
    const baseS = (p.size || 1.0) * 0.18; 
    mesh.scale.set(baseS, baseS, baseS);
    
    return mesh;
  }

  setVisible(v) {
    if (this.group) {
      this.group.visible = !!v;
    }
  }

  reset() {
    if (this.group) {
      this.group.visible = false;
    }
  }

  tick(dt, moonMesh, camera) {
    if (!this.active || !this.group || !moonMesh) return;
    
    // Scheme: Parallel Plane but Sunk Below Equator
    // 
    // X/Z: Follow Moon (Orbit Center)
    // Y:   Sunk below Moon Center (e.g., -120.0)
    //      This ensures that when Camera lifts up and looks down, 
    //      the zodiac ring is comfortably in the background view.
    
    this.group.position.x = moonMesh.position.x;
    this.group.position.z = moonMesh.position.z;
    
    // Sink the ring!
    // Radius is 400, so sinking -120 gives a nice viewing angle from above.
    this.group.position.y = moonMesh.position.y - 120.0; 
    
    // Slow rotation of the entire zodiac system around the moon
    // This makes the stars slowly drift across the sky
    this.group.rotation.y += 0.05 * dt; 
    
    // Note: We do NOT copy moon rotation anymore.
    // Also we do NOT copy moon rotation on X/Z, kept flat parallel to equator.
    
    if (this.group.visible) {
        // ...
    }
  }
}
