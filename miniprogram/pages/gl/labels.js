// 数据驱动标签引擎：仅计算数据，不直接操作 WXML
import { GRID_SIZE, MAX_LABELS_BUDGET, LABEL_FADEIN, LABEL_FADEOUT, EDGE_FADE_START, EDGE_FADE_END, FONT_COUNTRY_BASE, FONT_CITY_BASE, LABEL_ALTITUDE, CENTER_PRIORITY, AREA_WEIGHT, SCORE_THRESHOLD, TEXT_LENGTH_DECAY, DYNAMIC_FONT_BY_DISTANCE, CLAMP_TO_VIEWPORT } from './label-constants.js'
import { getRenderContext } from './main.js'
import { convertLatLonToVec3 } from './geography.js'

let BASE_LABELS = [] // { id, text, isCity, lat, lon, area }
let lastFrameVisible = new Map() // id -> { opacity }

export function initLabels(baseLabels) {
  BASE_LABELS = (baseLabels || []).map(lb => {
    const v = convertLatLonToVec3(lb.lon, lb.lat)
    return { ...lb, baseVec3: v }
  })
}

function worldToScreen(vec3, ctx) {
  const { THREE, camera, width, height } = ctx
  const v = (typeof vec3.clone === 'function') ? vec3.clone() : new THREE.Vector3(vec3.x, vec3.y, vec3.z)
  v.project(camera)
  const x = (v.x * 0.5 + 0.5) * width
  const y = ( -v.y * 0.5 + 0.5) * height
  return { x, y, ndcZ: v.z }
}

function computeOpacity(ndcX, ndcY, wasVisible) {
  // 视野边缘渐隐：离中心越远越淡
  const r = Math.sqrt(ndcX*ndcX + ndcY*ndcY)
  let edgeFade = 1.0
  if (r > EDGE_FADE_START) {
    const t = Math.min(1.0, (r - EDGE_FADE_START) / Math.max(1e-5, (EDGE_FADE_END - EDGE_FADE_START)))
    edgeFade = 1.0 - t
  }
  // 基于上一帧是否可见，做淡入淡出
  let opacity = wasVisible ? Math.min(1, (lastFrameVisible.get(wasVisible)?.opacity || 0) + LABEL_FADEIN) : LABEL_FADEIN
  opacity = Math.max(0, Math.min(1, opacity * edgeFade))
  return opacity
}

function calcFontSize(isCity, cameraDistance, text) {
  const base = isCity ? FONT_CITY_BASE : FONT_COUNTRY_BASE
  const lengthPenalty = Math.max(0, (text?.length || 0) * TEXT_LENGTH_DECAY)
  let size = base - lengthPenalty
  if (DYNAMIC_FONT_BY_DISTANCE) {
    // 距离越近，标签越大；适度限制范围
    const s = 1.0 / Math.max(0.6, Math.min(2.2, cameraDistance))
    size *= 0.9 + s * 0.6
  }
  return Math.max(10, Math.min(28, size))
}

function scoreLabel(label, screenPos, ctx) {
  const { width, height } = ctx
  const dx = (screenPos.x - width * 0.5) / width
  const dy = (screenPos.y - height * 0.5) / height
  const centerBonus = (1.0 - Math.sqrt(dx*dx + dy*dy)) * CENTER_PRIORITY
  const areaBonus = (label.area ? Math.log2(Math.max(1, label.area)) : 0) * AREA_WEIGHT
  return centerBonus + areaBonus
}

function isFrontFacing(worldPos, ctx) {
  const { THREE, camera, globeGroup } = ctx
  // 使用球心法判断是否在可视半球：点的法线与“球心指向相机”的向量的夹角
  const sphereCenter = new THREE.Vector3()
  globeGroup.getWorldPosition(sphereCenter)
  const normal = worldPos.clone().sub(sphereCenter).normalize()
  const toCamera = camera.position.clone().sub(sphereCenter).normalize()
  const dot = normal.dot(toCamera)
  return dot > 0.0
}

function isOutOfViewport(sp, ctx) {
  const { width, height } = ctx
  return sp.x < 0 || sp.y < 0 || sp.x > width || sp.y > height
}

function collideGrid(occupied, sp) {
  const gx = Math.floor(sp.x / GRID_SIZE)
  const gy = Math.floor(sp.y / GRID_SIZE)
  const key = `${gx},${gy}`
  if (occupied.has(key)) return true
  occupied.add(key)
  return false
}

export function selectAndComputeLabels() {
  const ctx = getRenderContext()
  if (!ctx || !BASE_LABELS || BASE_LABELS.length === 0) return []

  const { THREE, camera } = ctx
  const occupied = new Set()
  const winners = []

  for (const lb of BASE_LABELS) {
    // 使用缓存的基础向量，略抬高后转换到世界坐标
    const base = lb.baseVec3 || convertLatLonToVec3(lb.lon, lb.lat)
    const worldPosLocal = new ctx.THREE.Vector3(base.x, base.y, base.z).multiplyScalar(1 + LABEL_ALTITUDE)
    const worldPos = worldPosLocal.clone().applyMatrix4(ctx.globeGroup.matrixWorld)
    // 背面过滤
    if (!isFrontFacing(worldPos, ctx)) continue
    const sp = worldToScreen(worldPos, ctx)
    // 视口裁剪
    if (CLAMP_TO_VIEWPORT && isOutOfViewport(sp, ctx)) continue
    // 网格碰撞
    if (collideGrid(occupied, sp)) continue
    const sc = scoreLabel(lb, sp, ctx)
    if (sc < SCORE_THRESHOLD) continue
    const cameraDistance = camera.position.length()
    const fontSize = calcFontSize(lb.isCity, cameraDistance, lb.text)
    winners.push({
      id: lb.id,
      text: lb.text,
      isCity: !!lb.isCity,
      x: Math.round(sp.x),
      y: Math.round(sp.y),
      opacity: computeOpacity(sp.x/ctx.width*2-1, sp.y/ctx.height*2-1, lb.id),
      fontSize: Math.round(fontSize)
    })
    if (winners.length >= MAX_LABELS_BUDGET) break
  }

  // 记录可见态用于淡入淡出（简化：当前全可见）
  lastFrameVisible.clear()
  for (const w of winners) {
    lastFrameVisible.set(w.id, { opacity: w.opacity })
  }

  return winners
}

export function updateLabels() {
  return selectAndComputeLabels()
}