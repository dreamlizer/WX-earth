// 职责：管理搜索打开/关闭、输入与候选生成、以及候选点击后的联动行为
// 说明：从页面 decouple，保留原有 UI 数据结构与外部行为，便于复用与测试

import { buildSearchSuggestions as buildSearchSuggestionsUtil } from './search-utils.js';
import { setZoom, setPaused, flyTo, selectCountryByCode, getCountries } from './main.js';
import { INTERACTION_DEBUG_LOG } from './label-constants.js';
import { setForcedLabel, setForcedCityCountries, clearForcedCityCountries } from './labels.js';
import { highlightCityMarker } from './city-markers.js';

export class SearchManager {
  constructor({
    setData = () => {},
    updateTopOffsets = () => {},
    tzlookup = () => '',
    computeGmtOffsetStr = () => '',
    onCountryPicked = async () => {},
    getFeatures = () => (getCountries() || []),
    getLang = () => 'zh',
    normalizeToCanvasTouches = (e) => (e || {}),
    onTouchStart = () => {},
    onTouchMove = () => {},
    markPanelsPendingClose = () => {},
  } = {}){
    this.setData = setData;
    this.updateTopOffsets = updateTopOffsets;
    this.tzlookup = tzlookup;
    this.computeGmtOffsetStr = computeGmtOffsetStr;
    this.onCountryPicked = onCountryPicked;
    this.getFeatures = getFeatures;
    this.getLang = getLang;
    this.normalizeToCanvasTouches = normalizeToCanvasTouches;
    this.onTouchStart = onTouchStart;
    this.onTouchMove = onTouchMove;
    this.markPanelsPendingClose = markPanelsPendingClose;
  }

  toggle(open){
    const next = !!open;
    if (next) {
      this.setData({ countryPanelOpen: false, hoverText: '', suggestions: [], searchQuery: '', searchOpen: true });
      this.updateTopOffsets();
    } else {
      this.setData({ suggestions: [], searchQuery: '', searchOpen: false });
      this.updateTopOffsets();
    }
  }

  close(){ this.setData({ searchOpen: false, suggestions: [], searchQuery: '' }); }

  input(qRaw, { features, citiesCloud } = {}){
    const q = String(qRaw || '').trim();
    this.setData({ searchQuery: q });
    if (q.length >= 2) {
      const lang = this.getLang();
      const list = buildSearchSuggestionsUtil(q, { lang, features, citiesCloud });
      try { if (INTERACTION_DEBUG_LOG) console.log('[search] query=', String(q||'').toLowerCase(), 'matches=', list.length); } catch(_){}
      this.setData({ suggestions: list });
    } else {
      this.setData({ suggestions: [] });
    }
  }

  // 保持与页面行为一致：飞行、缩放、强制高亮、选中国家与面板联动
  pick({ lat, lon, type, id }){
    try {
      const latNum = Number(lat), lonNum = Number(lon);
      const t = String(type || '').toLowerCase();
      const ident = String(id || '');
      if (Number.isFinite(latNum) && Number.isFinite(lonNum)) {
        this.setData({ searchOpen: false, suggestions: [] });
        try { setPaused(false); } catch(_){}
        try { flyTo(latNum * Math.PI/180, lonNum * Math.PI/180, 1000); } catch(_){}
        try { setZoom(2.30); } catch(_){}

        try {
          if (t === 'city' && ident) {
            setForcedLabel(ident);
            highlightCityMarker(ident, 2500);
          } else if (t === 'country' && ident) {
            setForcedLabel(String(ident).toUpperCase());
          }
        } catch(_){}

        // 推断国家，并在飞行完成后触发 selectCountry
        const features = this.getFeatures() || [];
        let countryCode = null;
        if (t === 'country') {
          countryCode = String(ident || '').toUpperCase();
        } else if (t === 'city') {
          const m = /^CITY_([A-Z]{2,3})_/i.exec(ident || '');
          if (m) countryCode = String(m[1]).toUpperCase();
        }
        if (countryCode) {
          setTimeout(() => { try { selectCountryByCode(countryCode); } catch(_){} }, 1200);
        }
      }
    } catch(_){ }
  }

  // 打开国家面板并显示时区提示
  pickOpen({ lat, lon, type, id }){
    try {
      const latNum = Number(lat), lonNum = Number(lon);
      const t = String(type || '').toLowerCase();
      const ident = String(id || '');
      if (Number.isFinite(latNum) && Number.isFinite(lonNum)) {
        this.setData({ searchOpen: false, suggestions: [] });
        try { setPaused(false); } catch(_){}
        try { flyTo(latNum * Math.PI/180, lonNum * Math.PI/180, 1000); } catch(_){}
        try { setZoom(2.30); } catch(_){}

        try {
          if (t === 'city' && ident) {
            setForcedLabel(ident);
            highlightCityMarker(ident, 2500);
          } else if (t === 'country' && ident) {
            setForcedLabel(String(ident).toUpperCase());
          }
        } catch(_){}

        const features = this.getFeatures() || [];
        let countryCode = null;
        let feature = null;
        if (t === 'country') {
          countryCode = String(ident || '').toUpperCase();
          feature = features.find(f => {
            const p = f?.props || {};
            const a3 = String(p.ISO_A3 || '').toUpperCase();
            const a2 = String(p.ISO_A2 || p.ISO || p.ISO2 || p.CC || '').toUpperCase();
            return a3 === countryCode || a2 === countryCode;
          }) || null;
        } else if (t === 'city') {
          const m = /^CITY_([A-Z]{2,3})_/i.exec(ident || '');
          if (m) countryCode = String(m[1]).toUpperCase();
          feature = features.find(f => {
            const p = f?.props || {};
            const a3 = String(p.ISO_A3 || '').toUpperCase();
            const a2 = String(p.ISO_A2 || p.ISO || p.ISO2 || p.CC || '').toUpperCase();
            return countryCode && (a3 === countryCode || a2 === countryCode);
          }) || null;
        }

        try {
          const tzName = this.tzlookup?.(latNum, lonNum) || '';
          const offsetStr = this.computeGmtOffsetStr(tzName);
          this.setData({ hoverText: offsetStr || (tzName || '') });
        } catch(_){}

        if (feature) {
          try { this.onCountryPicked(feature); } catch(_){}
          this.updateTopOffsets();
        } else if (countryCode) {
          try { setForcedLabel(countryCode); } catch(_){}
          try { setForcedCityCountries([countryCode]); } catch(_){}
          this.setData({ countryPanelOpen: true });
          this.updateTopOffsets();
        }
      }
    } catch(_){ }
  }

  // 搜索遮罩触控：与页面保持一致的行为（延迟关闭 + 触控透传）
  maskTouchStart(e){
    try {
      this.markPanelsPendingClose();
      const { touches } = this.normalizeToCanvasTouches(e);
      this.onTouchStart({ touches });
    } catch(_){ }
  }
  maskTouchMove(e){
    try {
      const { touches } = this.normalizeToCanvasTouches(e);
      this.onTouchMove({ touches });
    } catch(_){ }
  }
}