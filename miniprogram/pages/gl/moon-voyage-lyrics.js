
import { APP_CFG } from './config.js';
import { loadPoetryPresets } from './content-loader.js';

export const stopMoonLyrics = (mgrState) => {
  try { mgrState._lyricToken++; } catch(_){ }
  try { for (const t of (mgrState._lyricTimers || [])) clearTimeout(t); } catch(_){ }
  mgrState._lyricTimers = [];
  mgrState._lyricCurrentId = 0;
  mgrState._lyricCurrentLayer = null;
  try { mgrState.page?.setData?.({ moonLyricA: { text: '', visible: false }, moonLyricB: { text: '', visible: false } }); } catch(_){ }
};

export const startMoonLyrics = async (mgrState, baseTimeMs) => {
  const token = ++mgrState._lyricToken;
  try { for (const t of (mgrState._lyricTimers || [])) clearTimeout(t); } catch(_){ }
  mgrState._lyricTimers = [];
  mgrState._lyricCurrentId = 0;
  mgrState._lyricCurrentLayer = null;

  const preset = Number(APP_CFG?.moonVoyage?.lyrics?.preset ?? 999) || 999;
  const offsetMs = Number(APP_CFG?.moonVoyage?.lyrics?.offsetMs ?? APP_CFG?.poetry?.offsetMs ?? 0);
  const formatLyricText = (raw) => {
    let t = String(raw ?? '');
    t = t.replace(/\./g, '');
    t = t.replace(/[，,]/g, '\n');
    t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    t = t.replace(/[ \t]{2,}/g, ' ');
    t = t
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .join('\n');
    return t;
  };

  const normalizeLines = (rawLines) => {
    const pickStart = (l) => {
      const candidates = [
        l?.['start-time'],
        l?.['start time'],
        l?.startTime,
        l?.start_time,
        l?.startTimeMs,
        l?.startTimeMS
      ];
      for (const v of candidates) {
        const n = Number(v);
        if (Number.isFinite(n)) return n;
      }
      return undefined;
    };
    return (Array.isArray(rawLines) ? rawLines : []).map(l => {
      const st = pickStart(l);
      return {
        text: String(l?.text ?? ''),
        duration: Number(l?.duration || 7000),
        ['start-time']: Number.isFinite(Number(st)) ? Number(st) : undefined
      };
    });
  };

  let lines = null;
  try { lines = mgrState.page?.__poetryPresets?.[preset] || null; } catch(_){ }
  if (!Array.isArray(lines) || lines.length === 0) {
    try {
      const { map } = await loadPoetryPresets(APP_CFG, console);
      if (token !== mgrState._lyricToken) return;
      if (mgrState.page) mgrState.page.__poetryPresets = { ...(mgrState.page.__poetryPresets || {}), ...(map || {}) };
      lines = (map && map[preset]) ? map[preset] : null;
    } catch(_){ }
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    const __cloudDisabled = (APP_CFG?.cloud?.enabled === false);
    const __canDb = !!(!__cloudDisabled && wx && wx.cloud && typeof wx.cloud.database === 'function');
    if (__canDb) {
      try {
        const db = wx.cloud.database();
        let r = await db.collection('poetry_sets').where({ preset }).limit(1).get();
        if (!Array.isArray(r?.data) || r.data.length === 0) {
          r = await db.collection('poetry_sets').where({ preset: String(preset) }).limit(1).get();
        }
        const doc = (Array.isArray(r?.data) && r.data[0]) ? r.data[0] : null;
        const normalized = normalizeLines(doc?.lines);
        if (normalized.length) {
          lines = normalized;
          try {
            if (mgrState.page) {
              mgrState.page.__poetryPresets = { ...(mgrState.page.__poetryPresets || {}), [preset]: normalized };
            }
          } catch(_){ }
        }
        if (mgrState._moonDebug) console.log('[Moon][Lyrics] direct load preset:', preset, 'lines:', normalized.length);
      } catch(e) {
        if (mgrState._moonDebug) console.warn('[Moon][Lyrics] direct load failed:', e);
      }
    }
  }

  if (token !== mgrState._lyricToken) return;
  if (!Array.isArray(lines) || lines.length === 0) {
    if (mgrState._moonDebug) console.warn('[Moon][Lyrics] preset not found or empty:', preset);
    try { mgrState.page?.setData?.({ moonLyricA: { text: '', visible: false }, moonLyricB: { text: '', visible: false } }); } catch(_){ }
    return;
  }

  const hasAbsStart = lines.some(l => Number.isFinite(Number(l?.['start-time'])));
  const timeline = [];
  if (hasAbsStart) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const baseStart = Math.max(0, Number(l?.['start-time'] || 0));
      const dur = Math.max(0, Number(l?.duration || 0));
      const tStart = Math.max(0, baseStart + offsetMs);
      timeline.push({ id: i + 1, tStart, tEnd: tStart + dur, text: String(l?.text ?? '') });
    }
  } else {
    let accum = Math.max(0, offsetMs);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const dur = Math.max(0, Number(l?.duration || 0));
      const tStart = Math.max(0, accum);
      timeline.push({ id: i + 1, tStart, tEnd: tStart + dur, text: String(l?.text ?? '') });
      accum += dur;
    }
  }

  timeline.sort((a, b) => a.tStart - b.tStart);

  const now = Date.now();
  const elapsedNow = Math.max(0, now - Math.max(0, Number(baseTimeMs || now)));

  const fadeMs = Math.max(0, Number(APP_CFG?.moonVoyage?.lyrics?.fadeMs ?? 350) || 0);
  if (mgrState._moonDebug) {
    console.log('[Moon][Lyrics] start', { preset, hasAbsStart, lines: lines.length, offsetMs, elapsedNow });
  }

  const showLine = (item) => {
    if (token !== mgrState._lyricToken) return;
    if (!mgrState.active) return;
    const text = formatLyricText(item?.text ?? '');
    const id = Number(item?.id || 0);
    const nextLayer = (mgrState._lyricCurrentLayer === 'A') ? 'B' : 'A';
    const nextKey = (nextLayer === 'A') ? 'moonLyricA' : 'moonLyricB';
    const prevKey = (nextLayer === 'A') ? 'moonLyricB' : 'moonLyricA';
    mgrState._lyricCurrentId = id;
    mgrState._lyricCurrentLayer = nextLayer;
    try {
      const visible = !!text;
      mgrState.page?.setData?.({
        [`${nextKey}.text`]: text,
        [`${nextKey}.visible`]: visible,
        [`${prevKey}.visible`]: false
      });
    } catch(_){ }
  };

  const hideLineLater = (id, layer, delayMs) => {
    const h = setTimeout(() => {
      if (token !== mgrState._lyricToken) return;
      if (!mgrState.active) return;
      if (mgrState._lyricCurrentId !== id) return;
      if (mgrState._lyricCurrentLayer !== layer) return;
      const key = (layer === 'A') ? 'moonLyricA' : 'moonLyricB';
      try { mgrState.page?.setData?.({ [`${key}.visible`]: false }); } catch(_){ }
      const h2 = setTimeout(() => {
        if (token !== mgrState._lyricToken) return;
        if (!mgrState.active) return;
        if (mgrState._lyricCurrentId !== id) return;
        if (mgrState._lyricCurrentLayer !== layer) return;
        try { mgrState.page?.setData?.({ [`${key}.text`]: '' }); } catch(_){ }
      }, fadeMs + 50);
      mgrState._lyricTimers.push(h2);
    }, delayMs);
    mgrState._lyricTimers.push(h);
  };

  timeline.forEach(item => {
    const tShow = item.tStart;
    const tHide = item.tEnd;
    if (tHide <= elapsedNow) return;

    const delayShow = tShow - elapsedNow;
    if (delayShow <= 0) {
      // Should show immediately
      showLine(item);
      const remain = tHide - elapsedNow;
      if (remain > 0) hideLineLater(item.id, mgrState._lyricCurrentLayer, remain);
    } else {
      const h = setTimeout(() => {
        showLine(item);
        const duration = item.tEnd - item.tStart;
        hideLineLater(item.id, mgrState._lyricCurrentLayer, duration);
      }, delayShow);
      mgrState._lyricTimers.push(h);
    }
  });
};
