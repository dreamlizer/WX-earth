# NASA Valkyrie R5

- 收集日期：2026-09-30
- 类型：高精细人形航天机器人
- 来源索引：https://github.com/nasa/NASA-3D-Resources
- 原始下载包：`nasa-val-description.zip`，包含完整 `val_description` ROS/URDF 描述、Xacro、DAE/STL 网格和贴图。
- 原始包 SHA-256：`f0448bed0cb0226073855f3ba22edd61c339d37e5780caa81bd8da1a13c2ee75`
- 授权：`val_description/README.md` 与 `package.xml` 标记 `NASA-1.3`。README credits：NASA Johnson Space Center ER4 Valkyrie Team、IHMC Humanoids、Maurice Fallon 团队、Open Source Robotics Foundation。

## 网页模型

- `valkyrie-r5.glb`：2,900,000 bytes，SHA-256 `962e6d0c4eacca489a554eeaf816b954d9fff3b02d1b0aea036cd51a19b06a01`
- 由展开后的 `valkyrie_D.xacro` / URDF visual 层级组装。
- 统计：14,522 三角面，43,564 顶点，59 mesh，69 links，68 joints，59 材质，16 张内嵌图片，无缺失 mesh。
- 导出：GLB 2.0，保留几何、层级和内嵌贴图；为避免无头浏览器的 Draco worker 解码差异，最终文件不使用 `KHR_draco_mesh_compression`。
- 检查：原始 ZIP 完整性通过。源 DAE 中 `dae_000_000.029`、`dae_000_000.009` 是空 primitive，导出器跳过；其余视觉 mesh 均已进入 GLB，统计见 `valkyrie-r5.glb.stats.json`。

## 转换说明

Valkyrie 的 DAE 使用 Y_UP 表达；转换到 Blender Z_UP 时统一校正轴向、法线、UV 与贴图颜色空间，材质重建为基础 PBR。转换目标是网页预览，不替代原始 URDF 作为机器人仿真或工程数据。

## 本地文件

- `nasa-val-description.zip`
- `valkyrie-r5.glb`
- `valkyrie-r5.glb.stats.json`
- `SOURCE.md`
