// main.js - 3D引擎入口 (Refactored to AppEngine)
// 职责：向小程序页面层暴露 API，转发调用至 AppEngine 实例
// 状态：已重构为无状态代理

import { AppEngine } from './app-engine.js';

// 单例引擎实例
const engine = new AppEngine();

// —— 生命周期 ——

export function boot(page) {
  engine.init(page);
}

export function teardown() {
  engine.teardown();
}

// —— 交互事件 ——

export function onTouchStart(e) { engine.onTouchStart(e); }
export function onTouchMove(e) { engine.onTouchMove(e); }
export function onTouchEnd(e) { engine.onTouchEnd(e); }

// —— 核心控制 ——

export function setZoom(z) { engine.setZoom(z); }
export function flyTo(lat, lon, duration) { engine.flyTo(lat, lon, duration); }
export function setZenMode(on) { engine.setZenMode(on); }
export function setPaused(on) { engine.setPaused(on); }

// —— 视觉与主题 ——

export function setNightMode(on) { engine.setNightMode(on); }
export function setTheme(kind) { engine.setTheme(kind); }
export function setCloudVisible(on) { engine.setCloudVisible(on); }
export function setBrightnessScale(s) { engine.setBrightnessScale(s); }
export function setPerfMode(mode) { engine.setPerfMode(mode); }
export function refreshTextures() { engine.refreshTextures(); }

// —— 高级功能 ——

export function enterMoonVoyage() { engine.enterMoonVoyage(); }
export function exitMoonVoyage() { engine.exitMoonVoyage(); }
export function setMoonVoyageSpeed(mult) { engine.setMoonVoyageSpeed(mult); }
export function isMoonVoyageActive() { return engine.isMoonVoyageActive(); }

export function startPoetry3D(lines, conf) { engine.startPoetry3D(lines, conf); }
export function stopPoetry3D() { engine.stopPoetry3D(); }

// —— 数据与上下文 ——

export function getRenderContext() { return engine.getRenderContext(); }
export function getCountries() { return engine.getCountries(); }
export function selectCountryByCode(code) { return engine.selectCountryByCode(code); }

// —— 调试与辅助 ——

export function setDebugFlags(flags) { engine.setDebugFlags(flags); }
export function setInertia(pct) { engine.setInertia(pct); }
export function nudgeCenter(lat, lon) { engine.nudgeCenter(lat, lon); }
