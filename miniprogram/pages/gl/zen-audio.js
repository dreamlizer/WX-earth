// 职责：封装禅定音频的云解析、离线保存与播放控制。
// 说明：与页面状态解耦，内部维护音频上下文；调用方传入 fileIDs 与配置。

const AUDIO_SAVED_KEY = '__audio_saved_paths_v1';

function readAudioSaved(){ try { return (typeof wx?.getStorageSync === 'function') ? (wx.getStorageSync(AUDIO_SAVED_KEY) || {}) : {}; } catch(_) { return {}; } }
function writeAudioSaved(obj){ try { if (typeof wx?.setStorageSync === 'function') wx.setStorageSync(AUDIO_SAVED_KEY, obj || {}); } catch(_){} }
function audioTargetPath(preset){
  try {
    const root = wx.env?.USER_DATA_PATH || '';
    if (!root) return '';
    const dir = root + '/audio';
    wx.getFileSystemManager().mkdir({ dirPath: dir, recursive: true, success(){}, fail(){} });
    // 禅音频文件名：preset1 为 aac，preset2/3 为 mp3（与你上传的文件一致）
    const name = preset === 1 ? 'zen-1.aac' : (preset === 2 ? 'zen-2.mp3' : 'zen-3.mp3');
    return dir + '/' + name;
  } catch(_) { return ''; }
}

export class ZenAudio {
  constructor({ fileIds = {}, appCfg = {} } = {}){
    this.fileIds = fileIds; // { 1: fileID1, 2: fileID2 }
    this.appCfg = appCfg;   // 用于读取延迟播放等配置
    this.audio = null;
    this.delayUsed = false;
    this.preset = 1;
  }

  updateFileIds(map){ this.fileIds = { ...this.fileIds, ...(map || {}) }; }

  // 创建新的音频实例：不复用旧实例，避免淡出定时器误停新音频
  _createAudio(){
    const a = wx.createInnerAudioContext();
    a.loop = true; a.autoplay = false; a.obeyMuteSwitch = false;
    try {
      a.onError && a.onError(err => { try { console.error('[ZEN audio] onError:', err); } catch(_){ } });
      a.onPlay && a.onPlay(() => { try { console.info('[ZEN audio] onPlay'); } catch(_){ } });
      a.onCanplay && a.onCanplay(() => { try { console.info('[ZEN audio] onCanplay'); } catch(_){ } });
    } catch(_){ }
    return a;
  }

  async ensureOffline(){
    // 本地预览或缺少文件系统/云下载能力时直接跳过
    if (this.appCfg?.cloud?.enabled === false || !(wx?.cloud?.downloadFile && wx?.getFileSystemManager)) { return; }
    try {
      const map = readAudioSaved();
      const fs = wx.getFileSystemManager();
      // 三个预设均尝试离线保存（若 fileID 存在）
      const files = [ { preset: 1, fileID: this.fileIds[1] }, { preset: 2, fileID: this.fileIds[2] }, { preset: 3, fileID: this.fileIds[3] } ];
      for (const it of files) {
        const pSaved = map[it.preset];
        if (pSaved) { try { fs.accessSync(pSaved); continue; } catch(_){} }
        if (!it.fileID || !wx.cloud?.downloadFile) continue;
        const df = await wx.cloud.downloadFile({ fileID: it.fileID });
        const temp = df?.tempFilePath || '';
        if (!temp) continue;
        const target = audioTargetPath(it.preset);
        if (!target) continue;
        await new Promise((resolve,reject)=>{ fs.saveFile({ tempFilePath: temp, filePath: target, success(){ resolve(); }, fail(e){ reject(e); } }); });
        map[it.preset] = target; writeAudioSaved(map);
        try { console.info('[ZEN audio] 禅音频已离线保存', { preset: it.preset, path: target }); } catch(_){ }
      }
    } catch(e) { try { console.warn('[ZEN audio] ensureOffline失败', e); } catch(_){} }
  }

  async resolveCloudAudio(preset){
    // 离线优先
    try {
      const saved = readAudioSaved()[preset];
      if (saved) { try { wx.getFileSystemManager().accessSync(saved); return saved; } catch(_){} }
    } catch(_){}
    const fileId = this.fileIds?.[preset] || '';
    const app = (typeof getApp === 'function') ? getApp() : null;
    const env = app?.globalData?.env;
    try { console.info('[ZEN audio] resolving cloud URL', { fileId, env }); } catch(_){}
    if (!fileId || !wx.cloud) return '';
    try {
      if (wx.cloud.getTempFileURL) {
        const res = await wx.cloud.getTempFileURL({ fileList: [{ fileID: fileId, maxAge: 3600 }], ...(env ? { config: { env } } : {}) });
        const item = res?.fileList?.[0] || {};
        const status = (typeof item.status === 'number') ? item.status : undefined;
        const url = item?.tempFileURL || '';
        const errMsg = item?.errMsg || res?.errMsg;
        try { console.info('[ZEN audio] tempFileURL result:', { status, errMsg, url }); } catch(_){}
        if (url && status === 0) return url;
        const df1 = await wx.cloud.downloadFile({ fileID: fileId });
        const path1 = df1?.tempFilePath || '';
        try { console.info('[ZEN audio] fallback downloadFile tempFilePath:', path1); } catch(_){}
        return path1;
      }
      const df = await wx.cloud.downloadFile({ fileID: fileId });
      const path = df?.tempFilePath || '';
      try { console.info('[ZEN audio] downloadFile tempFilePath:', path); } catch(_){}
      return path;
    } catch(e){
      try { console.warn('[ZEN audio] resolve error:', { message: e?.message, errCode: e?.errCode, errMsg: e?.errMsg }); } catch(_){}
      return '';
    }
  }

  start(preset = 1, localUrl = ''){
    return (async () => {
      try {
        this.preset = preset || 1;
        // 始终创建新实例，避免旧实例淡出在 1 秒后 stop 新音频
        const a = this._createAudio();
        this.audio = a;
        // 每次开始播放前重置音量到 1，避免上一次淡出影响
        try { this.audio.volume = 1.0; } catch(_){}
        const cloudUrl = await this.resolveCloudAudio(this.preset);
        if (cloudUrl) {
          this.audio.src = cloudUrl;
          try { console.info('[ZEN audio] src(cloud):', cloudUrl); } catch(_){}
          const delayFirstMs = Number(this.appCfg?.zen?.audioFirstDelayMs || 200);
          const first = !this.delayUsed;
          const playNow = () => { try { this.audio?.play?.(); } catch(_){ } };
          if (first && delayFirstMs > 0) { this.delayUsed = true; setTimeout(playNow, delayFirstMs); } else { playNow(); }
        } else if (localUrl) {
          this.audio.src = localUrl;
          try { console.info('[ZEN audio] src(local):', localUrl); } catch(_){}
          const delayFirstMs = Number(this.appCfg?.zen?.audioFirstDelayMs || 200);
          const first = !this.delayUsed;
          const playNow = () => { try { this.audio?.play?.(); } catch(_){ } };
          if (first && delayFirstMs > 0) { this.delayUsed = true; setTimeout(playNow, delayFirstMs); } else { playNow(); }
        } else {
          try { console.warn('[ZEN audio] 云端链接未获取到，本地兜底已禁用，跳过播放'); } catch(_){}
        }
      } catch(_){ }
    })();
  }

  // 启动：先等 delayMs，再以 fadeMs 时长从 0->1 淡入
  startWithDelayFadeIn(preset = 1, localUrl = '', delayMs = 1000, fadeMs = 1000){
    return (async () => {
      try {
        this.preset = preset || 1;
        // 始终创建新实例，避免并发淡出误停新音频
        const a = this._createAudio();
        this.audio = a;
        // 初始化音量为 0，准备淡入
        try { this.audio.volume = 0.0; } catch(_){}
        const cloudUrl = await this.resolveCloudAudio(this.preset);
        const srcUrl = cloudUrl || localUrl || '';
        if (!srcUrl) { try { console.warn('[ZEN audio] 未获取到 src，跳过淡入播放'); } catch(_){} return; }
        this.audio.src = srcUrl;
        // 延迟后开始播放并淡入
        const playAndFade = () => {
          try { this.audio?.play?.(); } catch(_){}
          const steps = Math.max(10, Math.floor(fadeMs / 50));
          const stepMs = Math.max(10, Math.floor(fadeMs / steps));
          let i = 0;
          const timer = setInterval(() => {
            try {
              i += 1;
              const k = Math.max(0, Math.min(1, i / steps));
              try { this.audio.volume = k; } catch(_){}
              if (i >= steps) { clearInterval(timer); }
            } catch(e){ try { console.warn('[ZEN audio] fadeIn error', e); } catch(_){} clearInterval(timer); }
          }, stepMs);
        };
        const dms = Math.max(0, Number(delayMs || 0));
        if (dms > 0) setTimeout(playAndFade, dms); else playAndFade();
      } catch(_){ }
    })();
  }

  // 淡出并停止：在支持 volume 的环境逐步降低音量；否则直接停止
  fadeOutStop(ms = 2000){
    try {
      const a = this.audio;
      if (!a) return;
      const hasVolume = (() => { try { if (typeof a.volume === 'number') return true; } catch(_){} return false; })();
      if (!hasVolume || ms <= 0) { try { a.stop?.(); } catch(_){} return; }
      const steps = 20; // 20 步，每步 ~100ms，共约2秒
      const stepMs = Math.max(10, Math.floor(ms / steps));
      let i = 0;
      const startVol = (typeof a.volume === 'number') ? a.volume : 1.0;
      const timer = setInterval(() => {
        try {
          i += 1;
          const k = Math.max(0, 1 - i / steps);
          a.volume = Math.max(0, startVol * k);
          if (i >= steps) {
            clearInterval(timer);
            try { a.stop?.(); } catch(_){}
            // 停止后恢复音量值，避免下次播放仍为0
            try { a.volume = 1.0; } catch(_){}
            // 释放旧实例资源（若支持）
            try { a.destroy?.(); } catch(_){}
          }
        } catch(e){
          try { console.warn('[ZEN audio] fadeOutStop error', e); } catch(_){}
          clearInterval(timer);
          try { a.stop?.(); } catch(_){}
        }
      }, stepMs);
    } catch(_){ try { this.audio?.stop?.(); } catch(_){} }
  }

  stop(){ try { this.audio?.stop?.(); } catch(_){} }
}