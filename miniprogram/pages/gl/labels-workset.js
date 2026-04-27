const ARRAY_FIELDS = [
  'candidates',
  'countryCands',
  'cityCands',
  'cityCandsFiltered',
  'forcedCities',
  'otherCities',
  'mustCentral',
  'citiesQueue'
];

const SET_FIELDS = [
  'winners',
  'forcedCodesSet',
  'forcedCityIds',
  'mustIds',
  'countryIndicesPlaced'
];

function resetCandidate(c) {
  c.id = null;
  c.mesh = null;
  c.meta = null;
  c.sp = null;
  c.size = null;
  c.score = 0;
  c.edgeAlpha = 1;
  c.centerWeight = 0;
  c.isSmallCountryCity = false;
  return c;
}

export function createLabelFrameWorkset() {
  const ws = {
    candidatePool: [],
    candidateCount: 0
  };
  for (const key of ARRAY_FIELDS) ws[key] = [];
  for (const key of SET_FIELDS) ws[key] = new Set();
  return ws;
}

export function resetLabelFrameWorkset(ws) {
  const out = ws || createLabelFrameWorkset();
  out.candidateCount = 0;
  for (const key of ARRAY_FIELDS) out[key].length = 0;
  for (const key of SET_FIELDS) out[key].clear();
  return out;
}

export function nextLabelCandidate(ws) {
  const index = ws.candidateCount++;
  const candidate = ws.candidatePool[index] || (ws.candidatePool[index] = {});
  return resetCandidate(candidate);
}

export function copyForcedCodes(ws, forcedCodes, extraCode) {
  const target = ws.forcedCodesSet;
  target.clear();
  try {
    for (const code of forcedCodes || []) {
      const text = String(code || '').toUpperCase();
      if (text) target.add(text);
    }
  } catch(_) {}
  const extra = String(extraCode || '').toUpperCase();
  if (extra) target.add(extra);
  return target;
}
