# 结束帧 · 可见近景材质精修（2026-10-21）

预览： http://127.0.0.1:8974/moon-terrain-trial/ending-detail-frame/index.html

本轮只处理 271.7266666667 秒结束帧。页面可即时切换「加强版 / 原版对照」，保存两张实际 WebGL 帧与相机检查数据。原 8973 动态版、全部旧样段、小程序和其他歌曲均未修改。

## 材质处理

- 沿用已确认的地形网格、人物模型与坐标、相机位置/朝向/FOV、地球姿态、原项目星空及右侧太阳光；没有重新制作大地形或将图片覆盖到屏幕。
- `prepare-assets.py` 从原作者现有 8192² Albedo / Normal / Roughness / Occlusion 中裁出 1311×1148 的原像素局部，未放大或锐化。UV 原点、范围见 `assets/crop.json`。沿用已验证的 Y-up 物体空间法线通道转换 (-R,B,G)。
- 原图缺少近距离月壤颗粒，因此另用内置 imagegen 生成 `assets/regolith-detail-generated.png`（实际 1254²），仅作为补充微表面材质。它不是实拍月壤扫描，也不是作者原始资产；这张图不替代地形、人物、地球或光照。
- 新材质在原 3D 表面上按世界坐标三向投影，避免斜坡把颗粒拉成长条。纹理用于细微颜色、微起伏受光；原纹理的粗尺度法线在近处逐渐让位于原网格平滑法线，减弱近坡条带。微起伏按同一右侧太阳方向着色，未新增光源、未提高曝光。
- 原像素材质补丁按距离 4–14 场景单位渐隐；颗粒与近坡法线修正在 2–7 单位渐隐，补丁边缘另有羽化。这些是场景单位，不是实测米制。
- 主要变化在右下近侧坡面和少量近侧受光区域；深黑前景未主动增强，保持压暗。地形轮廓、人物遮挡及接触阴影仍由原几何和阴影系统决定。
- 新增四张局部 PBR 与一张颗粒图合计 7,330,939 字节（约 6.99 MiB）。这是桌面静帧试验资源，尚未做手机资源压缩和负载验收。

## 直接查看

- `output/enhanced.png` / `output/baseline.png`：540×960 同帧真实渲染。
- `output/comparison.png`：完整构图与下方近景联系图。
- `output/near-comparison.png`：右侧近坡相同区域放大两倍，使用最近邻方便观察实际像素；不是新增渲染精度。
- `output/window-preview.jpg`：当前 476×991 预览窗口。

## 验证

实际在浏览器切换原版/加强版，并检查完整构图、近坡纹理、羽化过渡、黑色前景、人物轮廓与右侧来光。当前窗口完整竖幅及全部按钮均可见。两次导出无 WebGL 错误、无页面错误；材质切换不改变相机或人物。

`verify-delivery.py` 检查已确认目录 40 个文件的 SHA-256 均不变；两模式的时间、相机位置/四元数/FOV及三人座位完全一致；地球与星空像素完全一致；深黑前景采样区 RGB 最大差异仅 2/255（不能据此宣称全阴影逐像素相同）。见 `output/checks.json` 与 `output/validation.json`。

项目要求的全部 41 个 `tools/*.test.cjs` 已通过，见 `output/project-tests.txt`。本轮是单帧观感试做，未重新制作或验收动态材质过渡；未接入小程序、未进行微信开发者工具或真机验收，也未上传发布。

## 复现

项目根目录执行：

```bash
node source-models/moon-terrain-trial/ending-detail-frame/server.cjs
```

预览页点击「保存同帧对比」后，在项目根目录执行：

```bash
python3 source-models/moon-terrain-trial/ending-detail-frame/verify-delivery.py
```

源码入口 `scene.js` / `near-detail.js` / `viewer.js`。跨目录复用 `../preview/assets/`、`../airborne-comparison/assets/`、`../crew-rim-balance/assets/` 和该目录的 `shared-starfield/`，Three.js / GLTFLoader 来自既有 vendor。地球/月球/云贴图由本机服务映射既有项目资源。所有新增捕获只写本目录 `output/`。
