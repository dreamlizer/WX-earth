# NASA Apollo Lunar Module

- 来源仓库：[nasa/NASA-3D-Resources](https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Apollo%20Lunar%20Module)
- 官方页面：[NASA Science 3D Resources](https://science.nasa.gov/3d-resources/apollo-lunar-module/)
- 下载时间：2026-09-09
- 授权：NASA 将该仓库资源标为 free and without copyright；使用时需遵守 [NASA images and media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media)，注明 NASA 来源，且不能造成 NASA 为产品背书的印象。NASA 标识本身另有限制。

## 本地文件

- `Apollo Lunar Module.glb`：716,840 bytes（约 700 KB）
- `Apollo Lunar Module.png`：官方预览图
- `NASA-3D-Resources-README.md`：仓库说明副本

## 本地检查（打开 GLB JSON 后）

- glTF 2.0，Blender I/O v4.2.57 导出
- 约 **97,588** 三角面、**64,787** 顶点、**135** 个节点、**134** 个 mesh、**12** 个材质
- 根节点名 `lunarlande`，子节点多为 `group13` / `group31` / `group51` / `pCylinder*` 这类拆件名，**不是**清晰的 “腿 1–4 / 舱门 / 发动机” 语义名
- 比项目目标的 1–2 万面更重，适合先当开发资产，正式进小程序前仍需减面或换低模

对话里 Sketchfab 上约 1.9 万面的 Low Poly Apollo Lunar Module（`9f3ca7ef34cf4fd5a82e19766c3b6f97`）标记为 **不可下载**。
