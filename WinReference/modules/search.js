// modules/search.js
// 职责：搜索面板的基础交互：打开/关闭与城市建议列表；点击建议飞到城市。
import { camera } from './scene.js';
import { convertLatLonToVec3 } from './geography.js';
import { cities } from '../../miniprogram/assets/data/cities_data.js';

function showPanel(show){
  const panel = document.getElementById('search-panel');
  if (!panel) return;
  panel.classList[show ? 'add' : 'remove']('visible');
}

function flyTo(lat, lon){
  const target = convertLatLonToVec3(lat, lon, 1.0);
  // 将相机置于目标方向外侧，并看向地心
  const dist = 3.0;
  camera.position.copy(target.clone().normalize().multiplyScalar(dist));
  camera.lookAt(0,0,0);
}

export async function initSearch(){
  const icon = document.getElementById('search-icon');
  const input = document.getElementById('search-input');
  const list = document.getElementById('search-suggestions');
  if (!icon || !input || !list) return;
  icon.addEventListener('click', () => showPanel(true));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') showPanel(false); });

  function render(items){
    list.innerHTML = '';
    items.slice(0, 8).forEach(c => {
      const el = document.createElement('div');
      el.className = 'suggestion-item';
      el.innerHTML = `<span>${c.name_zh || c.name_en}</span><span class="subtitle">${c.name_en || ''}</span>`;
      el.addEventListener('click', () => { flyTo(c.lat, c.lon); showPanel(false); });
      list.appendChild(el);
    });
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { render(cities.slice(0, 10)); return; }
    const filtered = cities.filter(c => (c.name_en||'').toLowerCase().includes(q) || (c.name_zh||'').includes(q));
    render(filtered);
  });
  render(cities.slice(0, 10));
}