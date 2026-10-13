# Chandra X-ray Observatory

- 收集日期：2026-09-30
- 来源目录：https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Chandra%20X-ray%20Observatory
- 授权与使用：NASA 3D Resources 标明资源免费且无版权；仍需遵守 [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media)，不得暗示 NASA 为项目背书。仓库说明副本见 `../NASA-3D-Resources-README.md`。
- 原文件：`Chandra X-ray Observatory.glb`；998,500 bytes
- 模型统计：30,132 三角面，29,716 顶点，6 mesh，5 材质，6 张内嵌图片，0 动画
- 检查：GLB 2.0 头、chunk 对齐、bufferView/accessor 边界通过；无外部文件依赖；Blender 5.2.1 实际导入通过。
- 加载要求：必需扩展 `KHR_draco_mesh_compression`，运行时加载器必须支持 Draco。
- 收集时状态：仅作为高质量太空飞行物候选源文件收集。

## 2026-10-11 本地接入

已转换为 `miniprogram/chandra-assets/` 本地分包，用于普通地球浏览里的随机偶遇。原始 GLB 保留；Draco 只在离线构建时解码，不要求小程序安装解码器。运行规则与构建方法见 `docs/AMBIENT-CHANDRA.md`。本轮使用独立微信开发者工具副本检查，手机性能及动态视觉仍由实际预览验收。

## 本地文件

- `Chandra X-ray Observatory.glb`
- `Chandra X-ray Observatory.png`（NASA 官方 1920×1080 预览）
- `inspection.json`
- `SOURCE.md`

