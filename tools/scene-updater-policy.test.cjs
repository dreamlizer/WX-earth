const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSceneUpdaterPolicies() {
  const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'gl', 'scene-updater.js');
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/^import .*$/gm, '');
  source = source.replace(/export\s+function\s+/g, 'function ');
  source += '\nmodule.exports = { getLabelUpdateIntervalMs, getMarkerUpdateIntervalMs };';
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Date,
    Math,
    Number,
    Set,
    Map
  };
  vm.runInNewContext(source, sandbox, { filename: file });
  return sandbox.module.exports;
}

const { getLabelUpdateIntervalMs, getMarkerUpdateIntervalMs } = loadSceneUpdaterPolicies();

assert.strictEqual(
  getLabelUpdateIntervalMs({ isDragging: false, idle: false, isFlying: false, hasInertia: true }),
  48,
  'inertia should relayout labels at a capped 20fps instead of every frame'
);

assert.strictEqual(
  getLabelUpdateIntervalMs({ isDragging: true, idle: false, isFlying: false, hasInertia: false }),
  96,
  'dragging should use a lighter label relayout cadence'
);

assert.strictEqual(
  getLabelUpdateIntervalMs({ isDragging: false, idle: true, isFlying: false, hasInertia: false }),
  140,
  'idle should use the slowest label relayout cadence'
);

assert.strictEqual(
  getMarkerUpdateIntervalMs({ isDragging: false, hasHighlight: false }),
  100,
  'normal city marker breathing does not need per-frame material updates'
);

assert.strictEqual(
  getMarkerUpdateIntervalMs({ isDragging: false, hasHighlight: true }),
  50,
  'highlighted city markers should update faster than normal breathing'
);

assert.strictEqual(
  getMarkerUpdateIntervalMs({ isDragging: true, hasHighlight: true }),
  Infinity,
  'dragging hides city markers, so marker material updates can be skipped'
);

console.log('scene-updater policy tests passed');

// Starting track four must not move a globe already at its normal Zen anchor.
// Exercise the updater and real rotation code across the song-frame boundary.
const sceneBox={console,Math,Date};
vm.runInNewContext(fs.readFileSync('miniprogram/pages/gl/zen-scene.js','utf8').replace(/export /g,'')+
  '\nglobalThis.rotation=advanceRotationFrame;',sceneBox);
const zen={active:true,tiltZ:23*Math.PI/180,zoom:.74,anim:null,stableSince:1};
const touch={rotX:0,rotY:0,velX:0,velY:0},globe={position:{y:-1.3},rotation:{set(){}},traverse(){}};
const no=()=>{};
const deps={...sceneBox,zenState:zen,advanceRotationFrame:sceneBox.rotation,INTERACTION_DEBUG_LOG:false,
  PERF_HIDE_MARKERS_ON_DRAG:false,LOD_CITIES_START_APPEAR:0,updateLabels:no,updateCityMarkers:no,
  setCityMarkersVisible:no,renderWithBloom:o=>o,module:{exports:{}}};
const motionBox={Math,module:{exports:{}}};
vm.runInNewContext(fs.readFileSync('miniprogram/pages/gl/go-west-opening-motion.js','utf8').replace(/export /g,'')+
  '\nmodule.exports={goWestOpeningSpin};',motionBox);
deps.goWestOpeningSpin=motionBox.module.exports.goWestOpeningSpin;
vm.runInNewContext(fs.readFileSync('miniprogram/pages/gl/scene-updater.js','utf8').replace(/^import .*$/gm,'').replace(/export /g,'')+
  '\nmodule.exports={createSceneUpdater};',deps);
const livePage={data:{zenMode:true}},config={zen:{globeYOffsetR:-.75,zoom:.74,tiltDeg:23,autoRotate:{enabled:false}}};
const updater=deps.module.exports.createSceneUpdater({page:livePage,LIGHT_CFG:config,APP_CFG:{startup:{clearDefaultSelection:false}},
  perfMonitor:{update:()=>.016},tweener:{update:no},highlight:{updatePerFrame:no},flyMgr:{advanceFlight:()=>false,updateFx:no},
  starCtl:{tick:no},tzMgr:{updatePerFrame:no},lighting:{updateDirLight:no,syncDayNightShader:no},touch,globeGroup:globe,
  camera:{position:{length:()=>5}},clampZoom:x=>x,updateCamDist:no,setZenMode:no,
  refs:{cloudMesh:()=>null,themeState:()=>({get:()=>({})}),poetry3d:()=>null,composer:()=>null,bloomPass:()=>null,zoom:()=>.74}});
updater.update();assert.equal(zen.anim,null);assert.equal(globe.position.y,-1.3);
livePage.__goWestSong={frame:{time:0}};
for(let i=0;i<10;i++)updater.update();
assert.equal(zen.anim,null,'Loading the Go West clock cannot schedule another vertical transition');
assert.equal(globe.position.y,-1.3,'The Zen globe anchor stays unchanged when the song appears');
const spin=deps.goWestOpeningSpin;
assert.equal(spin(.99).active,false);assert.equal(spin(1).speed,3);
assert.equal(spin(2).speed,91.5);assert.equal(spin(3).speed,180);
assert.equal(spin(26.2).speed,180,'Two-second turns remain until the earlier braking point');
assert.ok(spin(30).speed>3&&spin(30).speed<180);
assert.ok(Math.abs(spin(30).normalAt-spin(30).slowAt-8.6)<1e-9,'Braking lasts 8.6 seconds');
assert.ok(Math.abs(spin(31).slowAt-26.22)<1e-9);
for(let time=1;time<3;time+=.01)assert.ok(spin(time+.01).speed>=spin(time).speed-1e-10);
for(let time=26.22;time<34.82;time+=.01)assert.ok(spin(time+.01).speed<=spin(time).speed+1e-10);
assert.equal(spin(35).speed,3);assert.equal(spin(35).active,false);
assert.equal(spin(35,2.2).speed,2.2,'Normal speed comes from the existing Zen configuration');
assert.ok(spin(31).normalAt<35.52,'Slow rotation resumes before the first lyric pickup');
livePage.data.goWestActive=true;let paused=false;
livePage.__goWestSong={frame:{time:5},getAudio:()=>({paused})};
const beforeFast=touch.rotY;updater.update();
assert.ok(Math.abs(touch.rotY-beforeFast-Math.PI*.016)<1e-10,'Actual updater applies 180 degrees/second');
assert.equal(config.zen.autoRotate.enabled,false,'Song speed never mutates the shared configuration');
paused=true;const beforePause=touch.rotY;updater.update();assert.equal(touch.rotY,beforePause,'Paused audio holds the fast Earth');
paused=false;livePage.__goWestSong.frame.time=35;config.zen.autoRotate={enabled:true,degPerSec:3,startDelayMs:0};
const beforeNormal=touch.rotY;updater.update();assert.ok(Math.abs(touch.rotY-beforeNormal-3*Math.PI/180*.016)<1e-10);
livePage.data.goWestActive=false;livePage.__goWestSong.frame.time=5;
const beforeOther=touch.rotY;updater.update();assert.ok(Math.abs(touch.rotY-beforeOther-3*Math.PI/180*.016)<1e-10,'Other songs cannot inherit the fast spin');
