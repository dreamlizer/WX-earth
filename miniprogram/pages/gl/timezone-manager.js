import { convertVec3ToLatLon, normalizeLon, featureContains } from './geography.js'
import { gatherCandidates } from './geoindex.js'

export function createTimezoneManager(opts) {
  const {
    THREE,
    RADIUS,
    page,
    getCountryOverride = () => null,
    searchRef = () => null,
    countriesRef = () => [],
    tzlookup = (lat, lon) => null,
    computeGmtOffsetStr = (tzName) => '',
    formatTime = (date, tzName) => '',
    touchRef = () => ({ isDragging: false }),
  } = opts || {}

  const stable = { last: null, count: 0, since: 0 }
  const __vCenter = new THREE.Vector3(0, 0, RADIUS)
  const __eCenter = new THREE.Euler(0, 0, 0, 'XYZ')
  const __vFallback = new THREE.Vector3(0, 0, RADIUS)
  const __eFallback = new THREE.Euler(0, 0, 0, 'XYZ')
  let __lastRotX = NaN
  let __lastRotY = NaN
  let __lastComputedTZ = null
  let __lastComputeAt = 0

  function updateAfterSelection(hit, lat, lon) {
    let tzName = null
    try {
      const override = getCountryOverride(hit)
      tzName = (override !== null && override !== undefined) ? override : (tzlookup?.(lat, lon))
    } catch(_) { tzName = null }
    page.selectedTimezone = tzName ?? null
    const tzLabel = (typeof tzName === 'string') ? tzName : ''
    let hoverText = ''
    try {
      const offsetStr = computeGmtOffsetStr?.(tzName)
      hoverText = offsetStr || tzLabel
    } catch(_) { hoverText = tzLabel }
    try {
      page.__pendingHoverText = hoverText
      try { page.setData({ hoverText: '' }) } catch(_){}
    } catch(_){ }
    const now = Date.now()
    page.lastTimeUpdate = now
    try { if (page?.data?.zenMode) { page.setData({ hoverText: '' }) } } catch(_){ }
    let timeStr = ''
    try { timeStr = formatTime(new Date(now), tzName) } catch(_) { timeStr = '' }
    if (timeStr && timeStr !== page.data.currentTime) page.setData({ currentTime: timeStr })
  }

  function computeCenterTZ(rotX, rotY) {
    const touch = touchRef() || {}
    const now = Date.now()

    const minInterval = touch.isDragging ? 80 : 200
    const dx = Math.abs((rotX || 0) - (__lastRotX || 0))
    const dy = Math.abs((rotY || 0) - (__lastRotY || 0))
    const rotStable = isFinite(__lastRotX) && isFinite(__lastRotY) && dx < 0.001 && dy < 0.001

    if (__lastComputedTZ && (now - __lastComputeAt) < minInterval) {
      if (!rotStable) return null
      if (__lastComputedTZ === stable.last) {
        stable.count++
      } else {
        stable.last = __lastComputedTZ
        stable.count = 1
        stable.since = now
      }
      const frameThreshold = touch.isDragging ? 2 : 3
      const timeThreshold = touch.isDragging ? 250 : 400
      if (stable.count >= frameThreshold || (now - stable.since) >= timeThreshold) {
        return __lastComputedTZ
      }
      return null
    }

    __vCenter.set(0, 0, RADIUS)
    __eCenter.set(rotX, rotY, 0, 'XYZ')
    __vCenter.applyEuler(__eCenter)
    const [clon, clat] = convertVec3ToLatLon(__vCenter.x, __vCenter.y, __vCenter.z)
    let tzByCountry = null
    const search = searchRef()
    const countries = countriesRef() || []
    if (search && countries && countries.length) {
      const candIds = gatherCandidates(search, clon, clat, 24)
      for (const fid of candIds) {
        const f = countries[fid]
        if (featureContains(clon, clat, f)) { tzByCountry = getCountryOverride(f); break }
      }
    }
    let computedTZ = (tzByCountry !== null && tzByCountry !== undefined) ? tzByCountry : (tzlookup?.(clat, clon) ?? null)
    if (!computedTZ || typeof computedTZ !== 'string') {
      const off = Math.round(normalizeLon(clon) / 15)
      const sign = off >= 0 ? '-' : '+'
      const abs = Math.abs(off)
      computedTZ = `Etc/GMT${sign}${abs}`
    }
    __lastRotX = rotX
    __lastRotY = rotY
    __lastComputeAt = now
    __lastComputedTZ = computedTZ
    if (computedTZ === stable.last) {
      stable.count++
    } else {
      stable.last = computedTZ
      stable.count = 1
      stable.since = now
    }
    const frameThreshold = touch.isDragging ? 2 : 3
    const timeThreshold = touch.isDragging ? 250 : 400
    if (stable.count >= frameThreshold || (now - stable.since) >= timeThreshold) {
      return computedTZ
    }
    return null
  }

  function updatePerFrame(now) {
    const touch = touchRef() || {}
    const sel = page.selectedTimezone ?? null
    let active = sel
    if (!active) {
      try { active = computeCenterTZ(touch.rotX, touch.rotY) ?? (page.currentTZ ?? null) } catch(_){}
    }
    const committed = page.currentTZ ?? null
    if (active !== committed) { page.currentTZ = active; page.lastTimeUpdate = 0 }
    const throttle = touch.isDragging ? 150 : 1000
    if ((now - (page.lastTimeUpdate || 0) > throttle) || page.lastTimeUpdate === 0) {
      page.lastTimeUpdate = now
      const dt = new Date(now)
      const tzUse = page.currentTZ ?? active
      let timeStrFull = formatTime(dt, tzUse)
      let timeStrMinute = timeStrFull ? timeStrFull.replace(/^(\d{2}:\d{2}).*$/, '$1') : ''
      try {
        const looksInvalid = !timeStrFull || !/\d{2}:\d{2}/.test(timeStrFull)
        if (looksInvalid) {
          __vFallback.set(0, 0, RADIUS)
          __eFallback.set(touch.rotX || 0, touch.rotY || 0, 0, 'XYZ')
          __vFallback.applyEuler(__eFallback)
          const [clon] = convertVec3ToLatLon(__vFallback.x, __vFallback.y, __vFallback.z)
          const off = Math.round(normalizeLon(clon) / 15)
          const sign = off >= 0 ? '-' : '+'
          const abs = Math.abs(off)
          const etcTZ = `Etc/GMT${sign}${abs}`
          timeStrFull = formatTime(dt, etcTZ)
          timeStrMinute = timeStrFull ? timeStrFull.replace(/^(\d{2}:\d{2}).*$/, '$1') : ''
        }
      } catch(_){}
      let nextStr = timeStrFull
      if (touch.isDragging) {
        nextStr = timeStrMinute
      } else {
        const prev = page.data.currentTime
        if (prev && timeStrFull && prev.slice(0,2) !== timeStrFull.slice(0,2)) {
          if ((now - (page._lastHourChangeAt || 0)) < 600) {
            nextStr = prev.slice(0,5)
          } else {
            page._lastHourChangeAt = now
          }
        }
      }
      if (nextStr && nextStr !== page.data.currentTime) page.setData({ currentTime: nextStr })
    }
  }

  return { updateAfterSelection, computeCenterTZ, updatePerFrame }
}
