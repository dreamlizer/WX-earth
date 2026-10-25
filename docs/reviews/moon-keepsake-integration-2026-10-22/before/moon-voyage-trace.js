// Bounded local diagnostics for reproducing the native audio / terrain handoff.
// No network writes and no user data; survives a simulator page reload.
export function traceMoon(mgr, event, extra = {}) {
  if (!mgr._isDevtools) return;
  try {
    const key = 'moon-voyage-handoff-trace-v1';
    if (event === 'start') mgr._moonTraceStarted = Date.now();
    const row = {event, wall: Date.now(), elapsed: (Date.now() - (mgr._moonTraceStarted || Date.now())) / 1000,
      time: mgr._accumTime, audio: Number(mgr.audioContext?.currentTime), duration: Number(mgr.audioContext?.duration),
      waiting: mgr._moonAudioWaiting, phase: mgr.phase, terrain: mgr._terrain?.status,
      selected: mgr._terrain?.selected, terrainActive: !!mgr._terrain?.active, ...extra};
    const rows = wx.getStorageSync(key) || [];
    rows.push(row);
    wx.setStorageSync(key, rows.slice(-300));
    console.info('[Moon trace] ' + JSON.stringify(row));
  } catch (_) {}
}
