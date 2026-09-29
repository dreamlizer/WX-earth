# Paper Airplane — Clint Bellanger

- 原作者：Clint Bellanger
- 来源：https://opengameart.org/content/paper-airplane
- 页面明确许可：CC0 https://creativecommons.org/publicdomain/zero/1.0/
- 原文件：https://opengameart.org/sites/default/files/paper_airplane_0.blend
- 下载日期：2026-09-28；原文件不修改，SHA-256 见 inspection.json。

## 实物检查

原文件只有一个纸飞机 mesh，16 个顶点，转换后 16 个三角面。内嵌 128×128 lined_paper.png，已提取，无丢失贴图。没有依赖角色骨骼、物理模拟或特殊材质。

源文件是旧版 Blender Internal 材质。转换时只将原始纸张图片接到现代材质，并导出原几何；没有重建模型。旧动画格式迁移警告不影响这个静态 mesh 的使用。

## 当前项目兼容性

`node tools/model-build/check-paper-airplane.cjs` 已用项目实际 threejs-miniprogram / Three r108 创建 BufferGeometry、MeshLambertMaterial、Mesh 并检查边界和变换。使用 r108 的 addAttribute，不能照搬新版本 setAttribute。

- 几何数据文件 7,753 bytes；PNG 974 bytes，合计 8,727 bytes。
- 几何 Float32 数据 1,536 bytes；贴图 RGBA 基础解码 65,536 bytes（不含驱动、mipmap 和对象开销）。
- 单 mesh、单材质，预期无阴影主渲染 1 次 draw call。
- JSON 可用包内 require，PNG 使用项目已有 TextureLoader / fixTexture 路径，不需要 GLBLoader、Draco 或云端下载。GLB 仅作通用交换副本。

这证明资源复杂度低、当前引擎数据结构兼容；尚未接入 MV，也未完成微信模拟器/真机画面、纹理朝向和帧率验收，不能标记为微信已验证。

## 文件

- paper_airplane_0.blend：作者原文件。
- lined_paper.png：原文件内嵌图片。
- paper-airplane.glb：交换格式副本。
- paper-airplane.geometry.json：现有小程序引擎可构建的几何数据。
- inspection-preview.png：真实模型离线检查图，不是微信截图。
- inspection.json / engine-check.json：原始结构及当前引擎兼容性检查结果。
