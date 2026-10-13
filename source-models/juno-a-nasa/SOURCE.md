# Juno (A)

- 收集日期：2026-09-30
- 来源目录：https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Juno%20(A)
- 授权与使用：NASA 3D Resources 标明资源免费且无版权；仍需遵守 [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media)，不得暗示 NASA 为项目背书。仓库说明副本见 `../NASA-3D-Resources-README.md`。
- 原文件：`Juno (A).glb`；8,999,028 bytes
- 模型统计：17,124 三角面，24,332 顶点，10 mesh，9 材质，14 张内嵌图片，0 动画
- 检查：GLB 2.0 头、chunk 对齐、bufferView/accessor 边界通过；无外部文件依赖；Blender 5.2.1 实际导入通过。
- 加载要求：必需扩展 `KHR_draco_mesh_compression`，运行时加载器必须支持 Draco。
- 状态：仅作为高质量太空飞行物候选源文件收集，未接入小程序，未验证微信渲染、材质、性能或包体策略。GLB 约 9 MB，移动端接入前需要压缩贴图与包体。

## 本地文件

2026-10-12：原始文件保留，已生成 `miniprogram/juno-assets/`，用于普通浏览随机飞行器及点选名称。资源、几何、包体和逻辑测试通过；本轮独立微信模拟器启动受阻，微信视觉及手机性能尚未验收。参见 `docs/AMBIENT-CHANDRA.md` 和分包 `build-report.json`。

- `Juno (A).glb`
- `Juno (A).png`（NASA 官方 1920×1080 预览）
- `inspection.json`
- `SOURCE.md`

