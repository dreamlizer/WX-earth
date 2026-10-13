> 2026-10-11 更新：用户否定本页记录的地球接入观感。地球现已恢复原默认/白昼贴图映射和原材质光照，只保留陆地法线；以下为上一轮历史。当前记录见 `docs/HANDOFF-PLANET-VISUAL-UPGRADE-2026-10-08.md` 最新章节与 `/private/tmp/wx-earth-default-recovery-20261011/README.md`。月球本轮未改。

# 地球与月球小程序接入记录

2026-10-09。用户明确要求接入小程序并先提交。修改前工作区已保存为本地提交 `5da2b64`，包含已有土星/飞行相关工作；本轮未修改这些轨迹、主时间线或土星实现，没有上传、发布或推送。

## 本轮内容

- 地球沿用用户认可的陆地法线版本：日侧补光、陆地法线强度 2、海陆遮罩下的柔和海面反光、暖城市灯、云层密度梯度和薄蓝大气。地球轮廓仍是球面，法线只改变受光明暗。
- 普通与禅定复用同一 Earth 对象、几何、贴图及 ShaderMaterial，保留普通相机前方光、禅定右侧光。夜景主题、云开关、普通模式亮度设置继续有效。普通与日图主题现在复用同一新版白昼图。
- 月球使用 NASA CGI Moon Kit 颜色与高程派生法线，normalScale 1、roughness .96、颜色乘数 0xeeeeee。沿用登月接近到绕月的连续侧光链路，未改飞行节点、相机或轨迹。月球色彩转换仅在自己的材质中修正。
- 使用现有 r108、ACES 和原渲染器；地球与月球各自输出 sRGB，不改变飞行器与土星的全局颜色设置。
- 贴图最终为 2048×1024，关闭 mipmaps。`earth-look-assets` 与 `moon-look-assets` 各自小于 2 MiB；月球仍按需加载，DevTools 启动不预取月球云资源。本地静态文件无需云端上传。五张地球贴图约 40 MiB、两张月球贴图约 16 MiB 的 RGBA8 GPU 数据，不含原兜底贴图、解码及帧缓冲；未测真机峰值。
- 材质挂到原 Earth/CLOUD 对象，国家点选和登月备份引用保持。刷新替换时释放旧视觉资源；异步迟到纹理不再接入卸载后的场景。

## 素材来源及派生

白昼、夜灯与云密度复用原项目 `earth_day8k.webp`、`earth_night.webp`、`cloud.webp` 在第一轮试样中的 4K 派生图，再按 LANCZOS 缩至 2K。白昼与夜图 JPEG quality 88，云密度 JPEG quality 94。这些旧素材的最初单独授权尚未核实。

陆地法线使用 Three.js r108 官方示例 [earth_normal_2048.jpg](https://raw.githubusercontent.com/mrdoob/three.js/r108/examples/textures/planets/earth_normal_2048.jpg)，原 JPEG 未改；更早的数据出处和单独素材授权仍未核实。仅此次本地接入，未公开发布。

海陆反光遮罩来自 [Solar System Scope / INOVE](https://www.solarsystemscope.com/textures/)，CC BY 4.0，适配为 2K 灰度 PNG。署名：Earth specular texture by Solar System Scope / INOVE, adapted for this planet material.

月球颜色与高程来自 [NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/)，Ernie Wright / NASA / LRO / LROC / LOLA。沿用第一轮的 2025 版颜色 TIFF、高程 TIFF 和球面差分派生法线（坡度艺术化加强 2.6），没有用颜色明暗伪造高程。最终月图 JPEG quality 88；法线缩至 2K 后以 JPEG quality 90、无色度降采样保存。此压缩档位区别于原试样 4K PNG。SHA-256、尺寸与包大小见 `assets-manifest.json`。

## 实际检查与失败修正

首次静态月球检查临时隐藏地球，月球色彩函数误写为 `LinearToSRGB`，在 r108 编译失败；验证输出又因直接序列化循环引用超时，导致没有恢复地球。用户看到只剩边界的“空心”地球后指出问题。该次不能算通过。

已改为实际 r108 的 `LinearTosRGB`，重新普通编译恢复地球。后续静态月球检查保留地球可见，只读取纯数据；已移除临时 Moon 对象并恢复场景。

最终 DevTools 检查记录为 `devtools-verification.json`：

- 原 Earth 材质 UUID 在普通、禅定和退出后相同；法线实际尺寸为 2K。
- 右侧光/前方光、纯夜景、云阴影开关、亮度数值符合设置。
- 刷新后仍使用新材质，仅一个大气组。
- 月球两张本地图加载完毕，法线为线性数据。
- 直接查询地球与月球 WebGL `LINK_STATUS` 均为 true，program/fragment 日志为空；不是只靠 “ready” 日志认定。
- 33 个 `tools/*.test.cjs` 与 `git diff --check` 通过。新增测试覆盖球面不透明/深度写入、原对象保留、云与主题/亮度、月球双贴图就绪与迟到回调、r108 色彩函数。

`normal-devtools.png`、`zen-devtools.png` 是修正后的小程序静态画布记录。禅定记录检查引擎材质/侧光，未走完整诗句与音乐 UI 流程。月球为调用实际 createMoon 的静态资源/着色器检查，没有播放飞行。完整动态效果、云与月球的真机性能仍由用户验收，没有将本轮检查描述为真机或动态视觉验收。
