// 极薄适配层：页面生命周期与事件绑定，只转交给 main.js
import { boot, teardown, onTouchStart, onTouchMove, onTouchEnd, getRenderContext } from './main.js';
import tzlookup from '../../libs/tz-lookup.js';
import { initLabels, updateLabels } from './labels.js';

Page({
  data: {
    currentTime: '--:--:--',
    hoverText: '',
    labels: [],
  },

  // 接受 IANA 名称时，将时间格式化为 YYYY/MM/DD HH:mm:ss（24小时制，含秒）
  formatTime(date, timeZone) {
    try {
      if (typeof timeZone === 'string' && timeZone) {
        const options = {
          timeZone,
          hour12: false,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        };
        let s = date.toLocaleString('en-CA', options);
        s = s.replace(/,/g, '').trim();
        s = s.replace(/-/g, '/');
        return s;
      }
    } catch (e) {
      console.warn('[formatTime] failed:', e);
    }
    return '--:--:--';
  },

  onLoad() {
    boot(this);
    // 初始化时区查询器（geo-tz 返回 IANA 名称）
    this.tzlookup = tzlookup;
    this.selectedTimezone = null;
    this.lastTimeUpdate = 0;

    // 使用本地 country_data.json 构建基础标签（bbox 中点作为近似质心）
    try {
      const countryMeta = require('./country_data.json');
      const baseLabels = Object.keys(countryMeta).map(k => {
        const m = countryMeta[k] || {};
        const lon = ((m.MIN_LON ?? -10) + (m.MAX_LON ?? 10)) / 2;
        const lat = ((m.MIN_LAT ?? -10) + (m.MAX_LAT ?? 10)) / 2;
        return {
          id: k,
          text: m.NAME_ZH || m.NAME_EN || k,
          isCity: false,
          lon, lat,
          area: Math.max(1, Math.log10(m.AREA_KM2 || 1000)),
        };
      });
      initLabels(baseLabels);
    } catch (e) { console.warn('[labels init] failed:', e); }
    this._lastLabelsUpdate = 0;
  },
  onUnload() { teardown(); },
  onTouchStart(e){ onTouchStart(e); },
  onTouchMove(e){ onTouchMove(e); },
  onTouchEnd(e){ onTouchEnd(e); },

  // 每帧钩子：由 main.js 的 render 调用
  onRenderTick(){
    try {
      const now = Date.now();
      if (now - (this._lastLabelsUpdate || 0) < 100) return; // 至少 100ms 才更新一次标签，降低 setData 压力
      const newLabels = updateLabels();
      if (this.shouldUpdate(this.data.labels, newLabels)) {
        this.setData({ labels: newLabels });
        this._lastLabelsUpdate = now;
      }
    } catch (e) { /* noop */ }
  },

  shouldUpdate(prev, next){
    if (!Array.isArray(prev) || !Array.isArray(next)) return true;
    if (prev.length !== next.length) return true;
    for (let i = 0; i < prev.length; i++) {
      const a = prev[i], b = next[i];
      if (!a || !b) return true;
      if (a.id !== b.id) return true;
      if (a.x !== b.x || a.y !== b.y) return true;
      if (a.opacity !== b.opacity) return true;
      if (a.fontSize !== b.fontSize) return true;
      if (a.text !== b.text) return true;
    }
    return false;
  },
  onCountriesLoaded(features){
    try {
      if (!features || !Array.isArray(features)) return;
      const baseLabels = features.map((f, idx) => {
        const p = f.props || {};
        const name = p.NAME || p.ADMIN || p.NAME_LONG || `#${idx}`;
        const [minLon, minLat, maxLon, maxLat] = f.bbox || [-10,-10,10,10];
        const lon = (minLon + maxLon) / 2;
        const lat = (minLat + maxLat) / 2;
        return { id: p.ISO_A2 || p.ISO || String(idx), text: name, isCity: false, lon, lat, area: Math.max(1, Math.log10((p.AREA || 5000))) };
      });
      initLabels(baseLabels);
    } catch (e) { console.warn('[onCountriesLoaded] failed', e); }
  },
});