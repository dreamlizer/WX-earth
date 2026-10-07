# RX-78 固定飞行姿势候选

2026-10-06：用户要求先做可比较的固定飞行造型，再选择接入登月镜头。

源模型：`../rx78-2-anonmalyfound/RX78_game_asset.blend`。没有 armature/action，但保留原关节顶点组与权重：上臂、前臂、手指、腿、头、盾牌和武器。沿用这些分组离线变形，不用重新拆分整台模型。头/肩转轴根据原关节衔接处测量；胸盖、UV 和材质保留。源文件没有覆盖。用户已选C，运行中的 `miniprogram/gundam-assets` 已接入对应的 bank 几何；A/B继续保留作为候选。

- A `cruise`：双臂收拢、适度屈膝，头部抬起35°。
- B `boost`：单臂前伸，另一臂收拢，单腿更明显屈膝，头部抬起45°。
- C `bank`：左右动作错位、一腿明显屈膝，头部抬起40°。

每种都有 `.blend` 编辑工程、`.glb` 静态模型和 `*-assets/` 量化预览数据；仍是77,407三角面、两次绘制，无运行时骨骼/动画新增。预览统一沿用正式飞行路径、4.3尺度、当前暖色主光/冷色轮廓光，固定原模型中心与尺度依据，避免屈膝导致模型自动放大。

复现生成：用 Blender 后台打开源 `.blend`，执行 `tools/model-build/build-gundam-flight-poses.py`。再用含 numpy/Pillow 的 Python 执行以下命令（把 cruise 换成 boost / bank）：

```bash
python tools/model-build/prepare-gundam.py --source source-models/rx78-flight-poses-2026-10-06/cruise.glb --review-output source-models/rx78-flight-poses-2026-10-06/cruise-assets
node tools/voyager-review/integrated-server.cjs
```

比较入口：`http://127.0.0.1:18975/pose-comparison`。最终对比图：`docs/reviews/voyager/pose-comparison-87.7.png`；三个完整画面为 `pose-{cruise,boost,bank}-87.7.png`。

正式分包可直接执行 `python tools/model-build/prepare-gundam.py` 重建，默认使用已选C，保持原机体中心和高度基准。

检查记录：`pose-report.json` 为调整参数/变形顶点数；`joint-check.json` 为关节附近边长检查；`projection-report.json` 为原镜头实际几何投影。三种在85.5/87.7秒全身及武器完整入画；A/C在83.4–89秒采样均完整，B在89秒有少量枪尖离开左沿，若选B须再协调退场构图。此记录不能证明完整碰撞检测或微信真机验收，C已接入正式分包并通过31个本地测试；微信/真机验收仍待确认。

来源与许可继承 `../rx78-2-anonmalyfound/SOURCE.md`。
