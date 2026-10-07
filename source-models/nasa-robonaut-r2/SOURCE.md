# NASA Robonaut R2

- 收集日期：2026-09-30
- 类型：高精细人形航天机器人
- 来源索引：https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Robonaut%202
- 原始下载包：`nasa-r2-description.zip`，包含完整 `r2_description` ROS/URDF 描述、Xacro、DAE 网格和材质。
- 原始包 SHA-256：`6432dfca71eb32dc604e326f2941c4c9669d63517d94ededff0da1113bdde173`
- 授权：`r2_description/package.xml` 标记 `NASA-1.3`；使用时保留 NASA 来源与许可信息，不得暗示 NASA 为项目背书。

## 网页模型

- `robonaut-r2.glb`：32,995,008 bytes，SHA-256 `30b4993c04f31069fa4d971c202d5b1d4dc893d55891120711076b83689f21b2`
- 由 `r2_description/urdf/r2c6.urdf` 的 69 个 visual 组装，保留 URDF link/joint 层级。
- 统计：346,234 三角面，1,038,702 顶点，90 mesh，132 links，131 joints，90 材质，12 张内嵌图片，无缺失 mesh。
- 导出：GLB 2.0，保留几何、层级和内嵌贴图；为避免无头浏览器的 Draco worker 解码差异，最终文件不使用 `KHR_draco_mesh_compression`。
- 检查：原始 ZIP 完整性通过，URDF 所引用 visual mesh 均已解析并进入 GLB，统计见 `robonaut-r2.glb.stats.json`。

## 转换说明

源 DAE 为 ROS/Collada 常用的 Y_UP 表达，但 URDF visual 的 `rpy` 已包含轴向补偿。转换时禁用 Collada 的 `Y_UP` 预旋转，只应用 URDF 自身的 `rpy`，避免两次补偿造成上下身错位。转换中同时校正法线和 UV，材质重建为基础 PBR。转换目标是网页预览，不替代原始 URDF 作为机器人仿真或工程数据。

## 本地文件

- `nasa-r2-description.zip`
- `robonaut-r2.glb`
- `robonaut-r2.glb.stats.json`
- `SOURCE.md`
