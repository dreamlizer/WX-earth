
export class CompanionAssets {
  constructor() {
    this._cloudPathCache = new Map();
    this._pickedSrcs = null;
    this._pickPromise = null;
    this._pickSig = '';
  }

  reset() {
    this._pickedSrcs = null;
    this._pickPromise = null;
    this._pickSig = '';
  }

  normalizeSrc(src) {
    const s0 = String(src || '').trim();
    if (!s0) return '';
    if (s0.startsWith('data:image/')) return s0;
    const i = s0.indexOf('assets/');
    if (i >= 0) return `/${s0.slice(i)}`;
    if (s0.startsWith('/')) return s0;
    return `/${s0}`;
  }

  cloudExists(fileID) {
    const fid = String(fileID || '');
    if (!fid || !fid.startsWith('cloud://')) return Promise.resolve(false);
    const wxCloud = (typeof wx !== 'undefined') ? wx.cloud : null;
    if (!wxCloud || typeof wxCloud.getTempFileURL !== 'function') return Promise.resolve(false);

    return new Promise((resolve) => {
      try {
        wxCloud.getTempFileURL({
          fileList: [fid],
          success: (r) => {
            const it = r?.fileList?.[0];
            const ok = !!it?.tempFileURL && (it?.status == null || Number(it.status) === 0);
            resolve(!!ok);
          },
          fail: () => resolve(false)
        });
      } catch (_) { resolve(false); }
    });
  }

  buildEvaCandidates(src0, maxIndex = 9) {
    const src = String(src0 || '');
    const m = src.match(/(eva)0[0-9](\.[a-z0-9]+)$/i);
    if (!m) return [src].filter(Boolean);

    const hit = String(m[0] || '');
    const ext = String(m[2] || '.png');
    const prefix0 = hit.slice(0, 3);
    const prefixes = (() => {
      const a = String(prefix0 || 'EVA');
      const b = (a === a.toUpperCase()) ? a.toLowerCase() : a.toUpperCase();
      const out = [a, b];
      const uniq = [];
      for (let i = 0; i < out.length; i++) {
        const s = String(out[i] || '').trim();
        if (!s) continue;
        if (uniq.indexOf(s) >= 0) continue;
        uniq.push(s);
      }
      return uniq;
    })();

    const base = src.replace(/(eva)0[0-9](\.[a-z0-9]+)$/i, `${prefix0}00${ext}`);
    const out = [];
    const lim = Math.max(0, Math.min(99, Math.floor(Number(maxIndex) || 9)));
    for (let k = 0; k < prefixes.length; k++) {
      const prefix = prefixes[k];
      for (let i = 0; i <= lim; i++) {
        const nn = String(i).padStart(2, '0');
        const name = `${prefix}${nn}${ext}`;
        out.push(base.replace(/(eva)00(\.[a-z0-9]+)$/i, name));
      }
    }
    const uniq = [];
    for (let i = 0; i < out.length; i++) {
      const s = String(out[i] || '').trim();
      if (!s) continue;
      if (uniq.indexOf(s) >= 0) continue;
      uniq.push(s);
    }
    return uniq;
  }

  ensurePickedSources(cfg) {
    const c = cfg || {};
    const src = String(c?.autoPickBaseSrc ?? c?.src ?? '');
    const maxIndex = Math.max(0, Math.min(9, Math.floor(Number(c?.autoPickMaxIndex ?? 9) || 9)));
    const pickCount = Math.max(1, Math.min(2, Math.floor(Number(c?.autoPickCount ?? 2) || 2)));
    const sig = `${src}|${maxIndex}|${pickCount}`;
    if (this._pickedSrcs && this._pickSig === sig) return;
    if (this._pickPromise && this._pickSig === sig) return;
    this._pickSig = sig;

    const candidates = this.buildEvaCandidates(src, maxIndex);
    this._pickPromise = (async () => {
      if (!src) return [];
      if (pickCount <= 1) return [src];
      if (!src.startsWith('cloud://')) return [src];

      const exist = [];
      for (let i = 0; i < candidates.length; i++) {
        const fid = String(candidates[i] || '');
        if (!fid) continue;
        try {
          const ok = await this.cloudExists(fid);
          if (ok) exist.push(fid);
        } catch (_) {}
      }

      const available = exist.length ? exist : [src];
      if (available.length <= 1) return [available[0]];
      const picked = [];
      const bag = available.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp;
      }
      for (let i = 0; i < bag.length && picked.length < pickCount; i++) picked.push(bag[i]);
      return picked.length ? picked : [src];
    })().then((arr) => {
      const picked = Array.isArray(arr) ? arr.filter(Boolean) : [];
      this._pickedSrcs = picked.length ? picked : [src].filter(Boolean);
      this._pickPromise = null;
      return this._pickedSrcs;
    }).catch(() => {
      this._pickedSrcs = [src].filter(Boolean);
      this._pickPromise = null;
      return this._pickedSrcs;
    });
  }

  resolveCloudToLocal(fileID) {
    const fid = String(fileID || '');
    const wxCloud = (typeof wx !== 'undefined') ? wx.cloud : null;
    if (!wxCloud || typeof wxCloud.getTempFileURL !== 'function') return Promise.reject(new Error('wx.cloud not ready'));

    const cached = this._cloudPathCache.get(fid);
    if (cached && typeof cached === 'string') return Promise.resolve(cached);

    return new Promise((resolve, reject) => {
      try {
        wxCloud.getTempFileURL({
          fileList: [fid],
          success: (r) => {
            const url0 = r?.fileList?.[0]?.tempFileURL;
            if (!url0) { reject(new Error('getTempFileURL returned empty url')); return; }
            const url = `${url0}${String(url0).includes('?') ? '&' : '?'}__v=${Date.now()}`;
            try {
              wx.downloadFile({
                url,
                success: (res) => {
                  if (res.statusCode === 200 && res.tempFilePath) {
                    this._cloudPathCache.set(fid, res.tempFilePath);
                    resolve(res.tempFilePath);
                  } else reject(new Error(`downloadFile failed: ${res.statusCode}`));
                },
                fail: (e) => reject(e)
              });
            } catch (e) { reject(e); }
          },
          fail: (e) => reject(e)
        });
      } catch (e) { reject(e); }
    });
  }

  getPickedSrcs() {
    return this._pickedSrcs;
  }
  
  getPickPromise() {
    return this._pickPromise;
  }
}
