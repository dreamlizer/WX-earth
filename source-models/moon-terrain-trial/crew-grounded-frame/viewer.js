import {createScene} from './scene.js';
const $=s=>document.querySelector(s),errors=[];
window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
try{
 const [config,anchor]=await Promise.all(['./shot-config.json','./orbit-anchor.json'].map(p=>fetch(p).then(r=>r.json())));
 const canvas=$('#render'),stage=$('#stage');const fit=()=>{const b=stage.getBoundingClientRect(),s=Math.min(b.width/config.width,b.height/config.height);canvas.style.width=config.width*s+'px';canvas.style.height=config.height*s+'px'};new ResizeObserver(fit).observe(stage);fit();
 const view=await createScene(canvas,config,anchor);let enabled=true;
 function show(value){enabled=value;view.setRefined(value);view.render(config.end);$('#enhanced').setAttribute('aria-pressed',String(value));$('#baseline').setAttribute('aria-pressed',String(!value));$('#status').textContent=value?'精修后 · 支撑贴合、姿态与人物材质':'精修前 · 已确认高清月面与原人物'}
 $('#enhanced').onclick=()=>show(true);$('#baseline').onclick=()=>show(false);
 async function save(name,data){const res=await fetch('/capture/'+name,{method:'POST',body:data});if(!res.ok)throw Error('保存失败 '+name)}
 const states=[];
 $('#save').onclick=async()=>{const selected=enabled;states.length=0;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{
  for(const scale of [1,2]){view.setResolution(scale);for(const value of [false,true]){show(value);await save((value?'enhanced':'baseline')+(scale===2?'-hd':'')+'.png',await new Promise(r=>canvas.toBlob(r,'image/png')));states.push({refined:value,resolution:[canvas.width,canvas.height],time:config.end,camera:view.camera.position.toArray(),quaternion:view.camera.quaternion.toArray(),fov:view.camera.fov,crew:(value?view.refinedCrew:view.crew).userData.seats,webglError:view.renderer.getContext().getError()});}}
  view.setResolution(1);show(selected);const cr=canvas.getBoundingClientRect(),ar=$('aside').getBoundingClientRect();await save('validation.json',new Blob([JSON.stringify({states,errors,contacts:view.refinedCrew.userData.contacts,probes:view.refinedCrew.userData.probes,fragmentCount:view.refinedCrew.userData.fragmentCount,light:await fetch('./earth-calibration.json').then(r=>r.json()),layout:{viewport:[innerWidth,innerHeight],frameVisible:cr.top>=0&&cr.bottom<=innerHeight&&cr.left>=0&&cr.right<=innerWidth,controlsVisible:ar.top>=0&&ar.bottom<=innerHeight}},null,2)],{type:'application/json'}));$('#status').textContent='已保存540/1080两档真实渲染与支撑点检查';
 }catch(e){errors.push(e.message);$('#status').textContent=e.message;console.error(e)}finally{const message=$('#status').textContent;view.setResolution(1);show(selected);$('#status').textContent=message;document.querySelectorAll('button').forEach(b=>b.disabled=false)}};
 show(true);document.querySelectorAll('button').forEach(b=>b.disabled=false);
}catch(e){$('#status').textContent=e.message;console.error(e)}
