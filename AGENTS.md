# 行星物语项目约定

## 产品定位

这是微信小程序里的单页 3D 地球体验。优化体验时保持“可探索的地球 + 此刻时间 + 诗意沉浸”的方向，不要把它改成普通地图查询页或营销 landing page。

## 代码边界

- 主入口只有 `miniprogram/pages/gl/index`，页面层主要负责事件绑定和状态转交。
- 3D 引擎入口是 `miniprogram/pages/gl/main.js`，具体能力由 `app-engine.js` 和各 manager 模块承接。
- 普通模式、禅定模式、登月模式是三条不同体验路径；改其中一条时要确认另外两条没有被遮挡、锁死或误触发。
- 仓库里可能有未提交改动。不要重置、清理或格式化无关文件。

## 体验修改原则

- 以微信开发者工具模拟器或真机预览作为视觉验收面，静态 dev server 不能代表小程序真实表现。
- 保持 WebGL 画布全屏、深色宇宙背景和轻量浮层，不新增卡片化页面结构。
- 顶部工具栏、搜索面板、设置面板、国家信息面板要尽量少遮挡地球。
- 禅定模式应减少工具感，保持诗句、音乐、缓慢旋转和月亮入口的沉浸感。
- 登月模式会接管交互，普通按钮需要尊重 moon lock，避免切换中误触。

## 常用验证

项目没有统一的 `npm test`。改动 JS 逻辑后至少跑：

```bash
for f in tools/*.test.cjs; do node "$f"; done
```

视觉、触摸、层级、音频、云贴图和微信 API 相关行为需要在微信开发者工具里确认。

## 数据与云端

- 云环境 ID 写在 `miniprogram/app.js`。
- 本地兜底数据在 `miniprogram/assets/data/` 和 `miniprogram/pages/gl/country_data.*`。
- 云函数在 `cloudfunctions/`，部署状态以微信开发者工具和云环境为准。
- 不要在文档或日志里新增密钥、私有 token 或用户数据。

## 易踩边界

- 国家点选依赖 `loadCountries() -> buildIndex(features)` 先完成；边界线或碰撞体异常时，也要保留 `earthMesh + searchIndex` 的点击兜底。
- 微信开发者工具和 PC 客户端默认不要预取云贴图或月球资源，避免假超时；诗句云函数和数据库读取仍可在 DevTools 使用，不要一刀切禁云。
- 禅定预设名来自 `poetry_sets` 文档 `_id`，歌词来自 `lines`；`poetrySetsV2` 是停用占位，运行链路不要再调用。
- 登月进入/退出有异步窗口，保留 `_entering` / `_exiting` 这类重入保护，避免普通地球状态被错误备份。
