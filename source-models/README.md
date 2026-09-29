# source-models

登月模型与相遇素材的本地来源和检查区。Apollo 与 EVA-00 曾用于 104 秒落地试航，该路线已于 2026-09-27 移出运行包，只保留源文件和存档。当前正式 MV 使用的旅行者号已从此处离线转换为包内几何与贴图；替换原文件后需要按 `tools/model-build/README.md` 重新构建。原 GLB 保持不变。

| 资源 | 状态 | 路径 |
| --- | --- | --- |
| NASA Apollo Lunar Module | 已下载 GLB | `apollo-lunar-module-nasa/` |
| EVA-00 / 01 / 02 低模 | 已下载 GLB（GitHub 公开镜像） | `eva-units-github-juan-hernandez/` |
| NASA Astronaut | 已下载 GLB，可作为非 EVA 旅伴备选 | `nasa-astronaut/` |
| Tigerar1 EVA-00 预览 | 仅预览图，GLB 见上一行 | `eva-unit-00-tigerar1/` |

## 2026-09-28：登月前半段相遇素材来源检查

| 素材 | 原始文件 | 检查结果 |
| --- | --- | --- |
| 太阳帆 | `solar-sail-nasa/Solar Sail Concept.glb` | 235,524 bytes，10,316 三角面，17 材质，无图片依赖 |
| 旅行者号 | `voyager-nasa/Voyager.glb` | 3,128,204 bytes，20,390 三角面，4 张内嵌贴图 |
| ACE | `ace-nasa/Advanced Composition Explorer.glb` | 2,030,760 bytes，25,778 三角面，27 材质，无图片依赖 |

各目录含 SOURCE.md 与 inspection.json（来源、文件校验值、结构统计）。太阳帆和 ACE 另有官方预览图，当前仍只在源文件区和离线试验中使用。

2026-09-28 的原实施顺序是先用太阳帆确定时机与轨迹，再安排另外两种物件；该顺序已被后续旅行者号正式接入替代，不再作为现役计划。

## 2026-09-28：免费开放授权的轻量候选

`paper-airplane-cc0/`：Clint Bellanger 的 CC0 纸飞机。已下载作者 .blend 与内嵌贴图，保留源文件，导出 GLB 和几何 JSON。实测 16 三角面，几何 JSON + 128×128 PNG 共 8,727 bytes。项目 Three r108 的几何/材质对象构建检查通过；独立效果和测试已完成，但未接入正式 MV，微信视觉和帧率也未验收。详细来源和复现见该目录 SOURCE.md。

## 2026-09-29：当前接入状态

- 旅行者号已接入正式 MV。`miniprogram/assets/models/voyager/` 保存紧凑几何数据，`miniprogram/voyager-assets/` 是约 1.4 MB 的贴图/二进制分包；来源仍以 `voyager-nasa/Voyager.glb` 为准。
- 太阳帆和 ACE 尚未进入运行包，也没有正式 MV 时间线承诺。
- 纸飞机源文件、导出的几何 JSON 和独立效果模块均已保留，但正式管理器尚未导入，不能算已接入。
