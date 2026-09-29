# 太阳系漫游素材包

这是从 `G:\Trea\AICoach` 项目导出的“太阳系漫游”卡片及其运行素材。

## 目录

- `solar-system/`：可直接放到任意静态站点 `public/` 或 Web 服务器根目录的完整运行包，包含 HTML、CSS、JavaScript、行星贴图和银河背景图。
- `source/frontend/`：项目中的集成源码，按原始相对路径保存，便于迁移到另一个 Next.js/React 项目时对照。

## 直接运行

把 `solar-system/` 整个目录放到静态服务根目录后访问：

```text
/solar-system/index.html
```

项目当前的 iframe 地址为：

```text
/solar-system/index.html?v=20260411k
```

运行时不依赖第三方 CDN、外部字体或网络接口；所有运行资源都在 `solar-system/` 内。

## Next.js/React 接入参考

1. 将 `solar-system/` 放到 `frontend/public/solar-system/`。
2. 参考 `source/frontend/app/components/SolarSystemWorkbench.tsx`，它负责 iframe、加载进度、就绪/关闭消息。
3. 参考 `source/frontend/app/components/FeatureHub.tsx` 中 `id: "solar-system"` 的卡片配置，以及 `source/frontend/app/page.tsx` 中的打开回调。
4. 参考 `source/frontend/lib/startup_preload.ts` 的 `solarSystem` 预加载清单和 `source/frontend/lib/feature_domains.ts` 的 `solar` 子域映射。
5. 如需沿用缓存策略，参考 `source/frontend/next.config.js` 中 `/solar-system/*` 的 headers 配置。

`SolarSystemWorkbench.tsx` 使用了项目现有的 Tailwind 工具类；迁移到没有 Tailwind 的项目时，需要将这些类替换为目标项目的样式方案。`FeatureHub.tsx`、`page.tsx` 和 `HomeModeViewport.tsx` 是原项目的完整源码文件，保留它们是为了展示卡片与工作台的真实接入关系，其中还包含其他功能的协调代码。

## 内容清单

- 运行入口：`index.html`
- JavaScript：`Galaxy.js`、`Controls.js`、`Engine.js`、`Controller_new.js`、`UI_new.js`
- 样式：`style.css`、`styles/controls.range.css`、`styles/controls.tilt.css`、`styles/controls.tokens.css`、`tex/记录.css`
- 贴图：`8k_stars_milky_way.jpg`、`tex/mercury.jpg`、`tex/venus_surface.jpg`、`tex/earth.jpg`、`tex/mars.jpg`、`tex/jupiter.jpg`、`tex/saturn.jpg`、`tex/saturn_ring.png`、`tex/uranus.jpg`、`tex/neptune.jpg`、`tex/sun.jpg`

`Engine.js` 还保留了一个仅在 `?diag=1` 时加载的诊断叠层引用 `tools/diag_overlay.js`；该文件在原项目中不存在，正常访问不会加载它。

`MANIFEST.sha256` 是本包内文件的 SHA-256 清单，可用于传输后核对完整性。
