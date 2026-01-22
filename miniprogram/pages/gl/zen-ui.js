
// 禅定模式 - UI 交互模块
// 职责：管理预设列表、Toast、以及布局传感器更新

import { getSystemInfo } from './sys-info.js';

export function toggleList(page, mgr) {
  return new Promise(async (resolve) => {
    try {
      if (!page.data.zenMode) return resolve();
      const isEn = (page.data?.lang === 'en');
      const ids = isEn ? [101,102,103] : [1,2,3];
      
      // 列表未打开：打开并淡入
      if (!page.data.presetListOpen) {
        if (!page.__presetLabels) { try { await mgr.preloadPresetLabelsCloud(); } catch(_){ } }
        const labels = page.__presetLabels || {};
        const cur = Number(page.__zenPreset || (isEn ? 101 : 1));
        const list = buildList(ids, cur, labels);
        
        page.setData({ 
          presetListOpen: true, 
          presetList: list, 
          currentPreset: cur, 
          presetPinnedId: null, 
          presetPinnedDy: 0, 
          presetCollapsed: false, 
          presetLatched: true, 
          presetListOpacity: 0 
        });

        try {
          const q = wx.createSelectorQuery();
          q.select('.cut-btn').boundingClientRect(rect => {
            try {
              const sys = getSystemInfo();
              const vw = sys.windowWidth;
              const right = Math.max(0, vw - Number(rect?.right || vw));
              const top = Math.max(0, Number(rect?.bottom || 0) + 6);
              page.setData({ presetListRight: right, presetListTop: top });
            } catch(_){ }
          }).exec();
        } catch(_){ }
        
        setTimeout(() => { try { page.setData({ presetListOpacity: 1 }); } catch(_){ } }, 16);
        startIdleTimer(page);
        return resolve();
      }
      
      // 列表已打开：切换折叠状态
      if (page.data.presetCollapsed) {
        // 展开
        try {
          if (!page.__presetLabels) { await mgr.preloadPresetLabelsCloud(); }
        } catch(_){ }
        const labels = page.__presetLabels || {};
        const cur = Number(page.__zenPreset || (isEn ? 101 : 1));
        const list = buildList(ids, cur, labels);
        page.setData({ presetCollapsed: false, presetList: list });
        startIdleTimer(page);
      } else {
        // 折叠
        page.setData({ presetCollapsed: true, presetLatched: true });
        clearIdleTimer(mgr);
        try {
          const curId = Number(page.__zenPreset || (page.data.lang === 'en' ? 101 : 1));
          setTimeout(() => {
            try {
              const list = Array.isArray(page.data.presetList) ? page.data.presetList : [];
              const first = list.find(it => it.id === curId) || list.find(it => it.id === page.data.currentPreset);
              const only = first || (list[0] || null);
              if (only) page.setData({ presetList: [only] });
            } catch(_){ }
          }, 1000);
        } catch(_){ }
      }
      resolve();
    } catch(_){ resolve(); }
  });
}

export function pickPreset(page, mgr, id, switchToPresetCallback) {
  try {
    const targetId = Number(id || 0);
    if (!targetId) return;
    if (String(page.data.presetLatched) === 'true' && targetId === page.data.currentPreset) return;
    
    page.setData({ currentPreset: targetId, presetLatched: true, presetPinnedId: targetId, presetPinnedDy: 0, presetCollapsed: true });
    startIdleTimer(page);
    
    setTimeout(() => {
      try {
        const list = Array.isArray(page.data.presetList) ? page.data.presetList : [];
        const firstId = list.length ? list[0].id : targetId;
        const q = wx.createSelectorQuery();
        q.select(`#preset-item-${firstId}`).boundingClientRect();
        q.select(`#preset-item-${targetId}`).boundingClientRect();
        q.exec(res => {
          try {
            const topA = (res && res[0] && typeof res[0].top === 'number') ? res[0].top : 0;
            const topB = (res && res[1] && typeof res[1].top === 'number') ? res[1].top : topA;
            const dy = Math.max(-2000, Math.min(2000, topA - topB));
            setTimeout(() => { try { page.setData({ presetPinnedDy: dy }); } catch(_){ } }, 900);
            setTimeout(() => {
              try {
                const first = list.find(it => it.id === targetId);
                const others = list.filter(it => it.id !== targetId);
                const newList = first ? [first, ...others] : list;
                page.setData({ presetList: newList, presetPinnedId: null, presetPinnedDy: 0 });
                const only = first || newList[0];
                if (only) page.setData({ presetList: [only] });
              } catch(_){ }
            }, 1900);
          } catch(_){ }
        });
      } catch(_){ }
    }, 30);
    
    if (typeof switchToPresetCallback === 'function') {
      switchToPresetCallback(targetId);
    }
  } catch(_){ }
}

export function closeList(page, mgr) {
  try {
    clearIdleTimer(mgr);
    page.setData({ presetListOpen: false, presetCollapsed: false, presetLatched: false, presetPinnedId: null, presetPinnedDy: 0, presetListOpacity: 0 });
  } catch(_){ }
}

export function buildList(ids, cur, labels) {
  try {
    const list = ids
      .map(id => ({ id, label: labels[id] }))
      .filter(it => typeof it.label === 'string' && it.label.length > 0);
    const first = list.find(it => it.id === cur);
    const others = list.filter(it => it.id !== cur);
    return first ? [first, ...others] : list;
  } catch(_){ return []; }
}

export function clearIdleTimer(mgr) { 
  try { if (mgr.__presetIdleTimer) clearTimeout(mgr.__presetIdleTimer); } catch(_){ } 
  mgr.__presetIdleTimer = 0; 
}

export function startIdleTimer(page) {
  // Use page instance to store timer ref if mgr not passed or direct usage
  // Ideally, manager should hold the timer state.
  // Here we assume the caller (manager) passes 'this' as 'mgr' or 'page' holds it.
  // Let's attach to page since it's UI state related, or return the timer ID?
  // The original code used `this.__presetIdleTimer`.
  // Let's attach to `page.__presetIdleTimer` to be stateless here.
  try {
    if (page.__presetIdleTimer) clearTimeout(page.__presetIdleTimer);
    const delay = 15000;
    page.__presetIdleTimer = setTimeout(() => {
      try {
        if (page?.__zenPoetryPaused) return;
        if (page.data.presetListOpen && !page.data.presetCollapsed) {
          page.setData({ presetCollapsed: true, presetLatched: true });
          const curId = Number(page.__zenPreset || (page.data.lang === 'en' ? 101 : 1));
          setTimeout(() => {
            try {
              const list = Array.isArray(page.data.presetList) ? page.data.presetList : [];
              const first = list.find(it => it.id === curId) || list.find(it => it.id === page.data.currentPreset);
              const only = first || (list[0] || null);
              if (only) page.setData({ presetList: [only] });
            } catch(_){ }
          }, 1000);
        }
      } catch(_){ }
    }, delay);
  } catch(_){ }
}

export function updateSensors(page) {
  try {
    const layoutMgr = page?.__getLayoutMgr?.();
    if (!layoutMgr) return;
    
    const times = [60, 160, 320];
    times.forEach(ms => { setTimeout(() => { try { layoutMgr.updateEggSensor(); } catch(_){} }, ms); });
    const times2 = [80, 200, 360];
    times2.forEach(ms => { setTimeout(() => { try { layoutMgr.updateBrightnessSensor(); } catch(_){} }, ms); });
  } catch(_){ }
}
