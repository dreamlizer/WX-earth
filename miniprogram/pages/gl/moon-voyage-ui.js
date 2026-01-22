
import { APP_CFG } from './config.js';
import { stopMoonLyrics } from './moon-voyage-lyrics.js';

export const uiMaskFadeIn = (page, fadeInMs, token, mgrState) => {
  try {
    page?.setData?.({ globalBlackMask: true, globalBlackMaskOpacity: 0, globalBlackMaskFadeMs: fadeInMs });
    setTimeout(() => { try { if (token === mgrState._exitFadeToken) page?.setData?.({ globalBlackMaskOpacity: 1 }); } catch (_) {} }, 16);
  } catch (_) {}
};

export const uiMaskFadeOut = (page, fadeOutMs, token, mgrState) => {
  try {
    page?.setData?.({ globalBlackMaskFadeMs: fadeOutMs, globalBlackMaskOpacity: 0 });
    setTimeout(() => { try { if (token === mgrState._exitFadeToken) page?.setData?.({ globalBlackMask: false }); } catch (_) {} }, fadeOutMs + 50);
  } catch (_) {}
};

export const prepareUiForLaunch = (page) => {
  try { page?.__getZenModeMgr?.()?.closeList?.(); } catch (_) {}
  try {
    page?.setData?.({
      moonVoyageActive: true,
      moonTimerText: String(page?.data?.moonTimerText || '00:00'),
      presetListOpen: false,
      presetListOpacity: 0,
      presetCollapsed: false,
      presetLatched: false,
      hoverText: ''
    });
  } catch (_) {}
};

export const pauseZenPoetryAndUi = (mgrState) => {
  const page = mgrState.page;
  if (!page) return;

  stopMoonLyrics(mgrState);
  page.__zenPoetryPaused = true;
  page.setData({
    'poetryA.visible': false,
    'poetryB.visible': false,
    'specialVisible': false,
    presetListOpen: false,
    presetListOpacity: 0,
    presetList: [],
    moonLyricA: { text: '', visible: false },
    moonLyricB: { text: '', visible: false },
    moonLyricFadeMs: Math.max(0, Number(APP_CFG?.moonVoyage?.lyrics?.fadeMs ?? 350) || 0),
    moonLyricBottomPx: Math.max(0, Number(APP_CFG?.moonVoyage?.lyrics?.bottomPx ?? 44) || 0)
  });
  try { page.__getPoetryMgr?.()?.stop?.(); } catch (_) {}
  if (page.stopPoetry3D) page.stopPoetry3D();

  try {
    if (page.data) {
      mgrState._prevLabelQty = page.data.labelQty || 'default';
    }
    if (page.__getLabelsMgr) {
      const lblMgr = page.__getLabelsMgr();
      if (lblMgr && lblMgr.forceHideAll) {
        lblMgr.forceHideAll();
      } else if (lblMgr && lblMgr.onSetLabelQty) {
        lblMgr.onSetLabelQty({ detail: { value: 'none' } });
      }
    }
  } catch (e) { console.warn('[Moon] Failed to hide labels', e); }

  if (page.__getZenMgr) {
    try {
      const zenMgr = page.__getZenMgr();
      if (zenMgr) {
        if (zenMgr.stopPoetry) zenMgr.stopPoetry();
        if (zenMgr.stopSpecial) zenMgr.stopSpecial();
      }
    } catch (_) {}
  }
};
