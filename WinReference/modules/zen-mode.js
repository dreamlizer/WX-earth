// modules/zen-mode.js
// 职责：专门管理“禅定模式”的所有状态和交互逻辑。

import * as THREE from 'three';
import * as TWEEN from 'tween.js';
import { AppConfig } from './config.js';
import { earthMat, dayTexture, nightTexture, zenDayTexture, ambientLight, mainLight, fillLight, rimLight } from './scene.js';
import { createStarfield } from './zen-background.js';
import { poetryConfig } from './poetry.js';
import { playEnterAnimation } from './zen-animation.js';

// ... 变量声明无变化 ...
let scene,camera,renderer,controls;let globeAssembly,stand,zenMasterGroup;let settingsBtn;let sunLight,rightSideGlowLight,spotLightZen,zenFillLight;let zenMusic;let poetryContainer;let langBtn,timeObserver;let poetryTimeoutId=null;let defaultAmbientIntensity,defaultMainIntensity,defaultFillIntensity,defaultRimIntensity;export let starfield;let isInitialized=!1,isZenAnimationComplete=!1;window.isZenMode=!1;const cameraInitialPosition=new THREE.Vector3(0,0,10),TRANSITION_DURATION=1200;let isRotating=!1,isPanning=!1;let lastPointerPos={x:0,y:0};const globeLocalYAxis=new THREE.Vector3(0,1,0),DETAIL_MODE_THRESHOLD=6,MAX_PAN_RADIUS=1.8,MAX_AUTO_TILT_DEG=15;function throttle(e,t){let o;return function(){const n=arguments,i=this;o||(e.apply(i,n),o=!0,setTimeout(()=>o=!1,t))}}const throttledPointerMoveZen=throttle(onPointerMoveZen,AppConfig.OPTIMIZATION.INTERACTION_THROTTLE_MS);

// ... initZenMode, updateZenMode, createZenLights, cleanupZenLights, toggleZenMode 无变化 ...
export function initZenMode(e){isInitialized||(scene=e.scene,camera=e.camera,renderer=e.renderer,controls=e.controls,globeAssembly=e.globeAssembly,stand=e.stand,zenMasterGroup=e.zenMasterGroup,settingsBtn=document.getElementById("settings-btn"),zenMusic=document.getElementById("zen-music"),poetryContainer=document.getElementById("poetry-container"),langBtn=document.getElementById("language-switch-btn"),timeObserver=document.getElementById("time-observer"),defaultAmbientIntensity=ambientLight.intensity,defaultMainIntensity=mainLight.intensity,defaultFillIntensity=fillLight.intensity,defaultRimIntensity=rimLight.intensity,starfield=createStarfield(),isInitialized=!0,document.getElementById("toggle-stand-btn").addEventListener("click",toggleZenMode))}export function updateZenMode(){if(window.isZenMode){if(!isRotating&&stand.visible&&isZenAnimationComplete){const e=AppConfig.ZEN_MODE_CONFIG.auto_rotation_speed;globeAssembly.rotateOnAxis(globeLocalYAxis,e)}const e=camera.position.length();if(e>=DETAIL_MODE_THRESHOLD)zenMasterGroup.position.lerp(new THREE.Vector3(0,0,0),.05);const t=-zenMasterGroup.position.y/MAX_PAN_RADIUS,o=THREE.MathUtils.degToRad(MAX_AUTO_TILT_DEG)*t;zenMasterGroup.rotation.x=THREE.MathUtils.lerp(zenMasterGroup.rotation.x,o,.05)}}function createZenLights(){cleanupZenLights();const e=AppConfig.ZEN_MODE_CONFIG;zenFillLight=new THREE.DirectionalLight(e.zen_fill_light_color,0),zenFillLight.position.set(e.zen_fill_light_pos_x,e.zen_fill_light_pos_y,e.zen_fill_light_pos_z),zenFillLight.target.position.set(e.zen_fill_light_target_x,e.zen_fill_light_target_y,e.zen_fill_light_target_z),scene.add(zenFillLight),scene.add(zenFillLight.target)}function cleanupZenLights(){zenFillLight&&(scene.remove(zenFillLight.target),scene.remove(zenFillLight),zenFillLight.dispose(),zenFillLight=null)}function toggleZenMode(){TWEEN.removeAll(),window.isZenMode?exitZenMode():enterZenMode()}


// ▼▼▼ 核心修改：恢复到原始的、简单的诗句循环逻辑 ▼▼▼
function startPoetryCycle() {
    if (!poetryContainer || !poetryConfig || !poetryConfig.poetryLines || poetryConfig.poetryLines.length === 0) return;

    let currentIndex = 0;
    const lines = poetryConfig.poetryLines;

    // 应用配置
    poetryContainer.style.fontSize = poetryConfig.fontSize || '26px';
    if (poetryConfig.position) {
        poetryContainer.style.top = poetryConfig.position.top || 'auto';
        poetryContainer.style.right = poetryConfig.position.right || 'auto';
    }

    function showNextPoem() {
        // 1. 先淡出当前的诗句
        poetryContainer.classList.remove('visible');

        // 2. 等待淡出动画结束
        setTimeout(() => {
            if (!window.isZenMode) return; // 安全检查
            // 更新诗句内容
            const currentLine = lines[currentIndex % lines.length];
            poetryContainer.textContent = currentLine.text;
            // 3. 再淡入新的诗句
            poetryContainer.classList.add('visible');
            currentIndex++;
        }, 1500); // 这个时间应与 CSS 中的 transition 时间匹配
    }

    // 立即显示第一句
    const firstLine = lines[currentIndex % lines.length];
    poetryContainer.textContent = firstLine.text;
    setTimeout(() => {
      if(window.isZenMode) poetryContainer.classList.add('visible');
    }, 500);
    currentIndex++;

    // 设置循环
    const intervalDuration = firstLine.duration || poetryConfig.lineDisplayDuration || 7000;
    poetryTimeoutId = setInterval(showNextPoem, intervalDuration);
}

function stopPoetryCycle() {
    if (poetryTimeoutId) {
        clearInterval(poetryTimeoutId);
        poetryTimeoutId = null;
    }
    if (poetryContainer) {
        poetryContainer.classList.remove('visible');
    }
}
// ▲▲▲ 核心修改 ▲▲▲

function enterZenMode() {
    window.isZenMode = true;
    controls.enabled = false;
    isZenAnimationComplete = false;

    if (settingsBtn) settingsBtn.style.display = 'none';
    if (langBtn) langBtn.style.display = 'none';
    if (timeObserver) timeObserver.style.display = 'none';

    if (earthMat.uniforms && earthMat.uniforms.uIsZenMode) {
        earthMat.uniforms.uIsZenMode.value = 1.0;
    }

    earthMat.map = zenDayTexture;
    earthMat.emissiveIntensity = AppConfig.ZEN_MODE_CONFIG.night_lights_intensity;
    earthMat.needsUpdate = true;

    mainLight.intensity = AppConfig.ZEN_MODE_CONFIG.sun_light_intensity;
    mainLight.position.set(AppConfig.ZEN_MODE_CONFIG.sun_light_position_x, 0, 0);

    fillLight.intensity = 0;
    rimLight.intensity = 0;
    ambientLight.intensity = AppConfig.ZEN_MODE_CONFIG.ambient_light_intensity;

    createZenLights();
    scene.add(starfield);
    zenMasterGroup.add(globeAssembly, stand);

    playEnterAnimation({
        camera,
        globeAssembly,
        stand,
        starfield,
        zenFillLight
    }, () => {
        isZenAnimationComplete = true;
        addZenEventListeners();
        if (zenMusic) {
            zenMusic.currentTime = 0;
            zenMusic.play().catch(error => {
                console.warn("音乐自动播放失败", error);
            });
        }
        startPoetryCycle();
    });
}

// ... exitZenMode 和底部辅助函数无变化 ...
function exitZenMode(){window.isZenMode=!1,removeZenEventListeners(),isZenAnimationComplete=!1,settingsBtn&&(settingsBtn.style.display="flex"),langBtn&&(langBtn.style.display="block"),timeObserver&&(timeObserver.style.display="flex"),zenMusic&&!zenMusic.paused&&new TWEEN.Tween({volume:zenMusic.volume}).to({volume:0},800).easing(TWEEN.Easing.Quadratic.Out).onUpdate(e=>{zenMusic.volume=e.volume}).onComplete(()=>{zenMusic.pause(),zenMusic.volume=1}).start(),stopPoetryCycle(),new TWEEN.Tween(starfield.material).to({opacity:0},TRANSITION_DURATION/2).onComplete(()=>{scene.remove(starfield)}).start();const e=stand.getObjectByName("stand_base_group"),t=stand.getObjectByName("stand_support_pole"),o=stand.getObjectByName("stand_ring_group");if(e&&t&&o){const n=e.position.y,i=t.position.y,s={value:1};new TWEEN.Tween(s).to({value:0},.8*TRANSITION_DURATION).easing(TWEEN.Easing.Quadratic.In).onUpdate(()=>{const r=s.value;stand.traverse(a=>{a.isMesh&&a.material&&(a.material.opacity=r)}),e.position.y=n-.5*(1-r),t.position.y=i-.5*(1-r),o.rotation.y=Math.PI*(1-r),o.scale.set(r,r,r)}).onStart(()=>{stand.traverse(a=>{a.isMesh&&a.material&&(a.material.transparent=!0)})}).onComplete(()=>{stand.visible=!1,e.position.y=n,t.position.y=i,o.rotation.y=0,o.scale.set(1,1,1),stand.traverse(a=>{a.isMesh&&a.material&&(a.material.transparent=!1,a.material.opacity=1)})}).start()}else stand.visible=!1;const n=TWEEN.Easing.Quadratic.Out;zenFillLight&&new TWEEN.Tween(zenFillLight).to({intensity:0},TRANSITION_DURATION/2).easing(n).start(),new TWEEN.Tween(globeAssembly.rotation).to({x:0,y:0,z:0},TRANSITION_DURATION).easing(n).start(),new TWEEN.Tween(zenMasterGroup.position).to({x:0,y:0,z:0},TRANSITION_DURATION).easing(n).start(),new TWEEN.Tween(zenMasterGroup.rotation).to({x:0,y:0,z:0},TRANSITION_DURATION).easing(n).onComplete(()=>{cleanupZenLights(),scene.add(globeAssembly),scene.add(stand),earthMat.uniforms&&earthMat.uniforms.uIsZenMode&&(earthMat.uniforms.uIsZenMode.value=0);const i=document.getElementById("night-mode-toggle");i&&i.checked?(earthMat.map=nightTexture,earthMat.emissiveIntensity=0,ambientLight.intensity=AppConfig.NIGHT_MODE_AMBIENT_LIGHT):(earthMat.map=dayTexture,earthMat.emissiveIntensity=0,ambientLight.intensity=defaultAmbientIntensity),earthMat.needsUpdate=!0,mainLight.position.set(5,5,5),mainLight.intensity=defaultMainIntensity,fillLight.intensity=defaultFillIntensity,rimLight.intensity=defaultRimIntensity,controls.enabled=!0}).start()}function addZenEventListeners(){renderer.domElement.addEventListener("pointerdown",onPointerDownZen),renderer.domElement.addEventListener("pointermove",throttledPointerMoveZen),window.addEventListener("pointerup",onPointerUpZen),renderer.domElement.addEventListener("contextmenu",e=>e.preventDefault()),renderer.domElement.addEventListener("wheel",onWheel,{passive:!1})}function removeZenEventListeners(){renderer.domElement.removeEventListener("pointerdown",onPointerDownZen),renderer.domElement.removeEventListener("pointermove",throttledPointerMoveZen),window.removeEventListener("pointerup",onPointerUpZen),renderer.domElement.removeEventListener("contextmenu",e=>e.preventDefault()),renderer.domElement.removeEventListener("wheel",onWheel)}function onWheel(e){e.preventDefault();const t=.1,o=e.deltaY<0?1-t:1+o,n=camera.position.length()*o;n>controls.minDistance&&n<controls.maxDistance&&camera.position.multiplyScalar(n)}function onPointerDownZen(e){0===e.button?isRotating=!0:2===e.button&&(isPanning=!0),lastPointerPos.x=e.clientX,lastPointerPos.y=e.clientY}function onPointerMoveZen(e){const t=camera.position.length(),o=t<DETAIL_MODE_THRESHOLD,n=e.clientX-lastPointerPos.x,i=e.clientY-lastPointerPos.y;if(isRotating)globeAssembly.rotateOnAxis(globeLocalYAxis,n*.005);if(isPanning&&o){const s=.002*t;zenMasterGroup.position.x+=n*s,zenMasterGroup.position.y-=i*s,zenMasterGroup.position.length()>MAX_PAN_RADIUS&&zenMasterGroup.position.setLength(MAX_PAN_RADIUS)}lastPointerPos.x=e.clientX,lastPointerPos.y=e.clientY}function onPointerUpZen(){isRotating=!1,isPanning=!1}