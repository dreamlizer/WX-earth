# EVA 追逐飞行姿势与移动端派生资源

2026-10-22，按用户确认的三机追逐方案制作。原始 `eva-unit-01-lefort/evangelion_unit_01.glb` 与 `eva-unit-02-ryanwill679/eva_02.glb` 不覆盖，SHA-256 与各目录 inspection.json 一致。

- `unit01-flight.glb`：初号机抬头、收臂、错位屈膝的静态飞姿，保留 60,522 三角面。
- `unit02-flight.glb`：二号机不同的左右肘/膝角度，减面至 56,743 三角面。
- `pose-report.json`：关节参数、受影响顶点、减面比例。
- 无源骨骼/动作；按规范化坐标中的关节区域设置渐变影响权重，离线烘焙姿势。运行时仅按轨迹调整整体姿态。

构建：Blender 执行 `tools/model-build/build-eva-flight-poses.py`，再运行 `python3 tools/model-build/prepare-eva.py`。Blender 导出仅限新建的当前场景，不包含默认立方体或其他场景。若受限终端不能访问 Metal 设备，Blender 可能在启动阶段崩溃，需通过宿主批准的本地执行环境运行。

小程序派生资源分别为 `miniprogram/eva01-assets/`、`miniprogram/eva02-assets/`，元数据在 `miniprogram/assets/models/eva/`。初号机 1 次机体绘制，二号机 2 次；分别使用 512px、1024px 颜色图集及量化几何，无运行时 GLB 解码依赖。每台另加 2 次轻量喷流绘制。`build-report.json` 记录实际字节与顶点数量；派生资源仍保留来源署名。

作者与许可沿用原 SOURCE.md：lefort、Ryanwill679 / TrashCG；上传者 CC BY 4.0，不替代角色/IP 权利。未上传或发布。
