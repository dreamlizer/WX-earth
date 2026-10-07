# source-models

登月模型与相遇素材的本地来源和检查区。Apollo 与 EVA-00 曾用于 104 秒落地试航，该路线已于 2026-09-27 移出运行包，只保留源文件和存档。当前正式 MV 使用旅行者号、黄色机器人 Mech Drone、RX-78-2 高达和 Luminaris Starship 四类模型，均从这里或其离线摆姿工程转换为包内几何与贴图；替换原文件后需要按 `tools/model-build/README.md` 重新构建。原 GLB 保持不变。

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

## 2026-09-30：NASA 太空飞行物高精度候选

从 NASA 3D Resources 官方仓库筛选了 7 款能在深色宇宙背景中形成强轮廓、近看保留机械层次的航天器/飞行器源文件。它们均通过 GLB 结构检查和 Blender 5.2.1 实际导入；全部必需 `KHR_draco_mesh_compression`，尚未接入小程序，也未验证微信渲染和性能。

| 候选 | 视觉特征 | GLB | 三角面 | 目录 |
| --- | --- | ---: | ---: | --- |
| Chandra X-ray Observatory | 浅灰筒形机身、大型高增益天线与四片太阳翼 | 998,500 bytes | 30,132 | `chandra-x-ray-observatory-nasa/` |
| Magellan | 球形舱体、长吊杆与三片棕色太阳翼 | 3,156,768 bytes | 7,364 | `magellan-nasa/` |
| Stardust | 金白机械主体、长翼和采样舱结构 | 3,800,544 bytes | 14,456 | `stardust-nasa/` |
| Parker Solar Probe | 防热盾、碟形天线、桁架和深色太阳翼 | 443,572 bytes | 39,257 | `parker-solar-probe-nasa/` |
| Ingenuity Mars Helicopter | 真实旋翼飞行器、细腿与顶部太阳能阵列 | 2,019,408 bytes | 9,124 | `ingenuity-mars-helicopter-nasa/` |
| James Webb Space Telescope (A) | 标志性金色镜面、遮阳板与展开结构 | 4,710,016 bytes | 493,785 | `james-webb-space-telescope-a-nasa/` |
| Juno (A) | 三片大型太阳翼、银色舱体和长吊杆 | 8,999,028 bytes | 17,124 | `juno-a-nasa/` |

授权说明统一见根目录 `NASA-3D-Resources-README.md` 与各目录 `SOURCE.md`。NASA 资源免费且无版权，但使用时仍应遵守 NASA Images and Media Usage Guidelines，并避免暗示 NASA 为项目背书。

注意：`ingenuity-mars-helicopter-nasa/Ingenuity Mars Helicopter.png` 的来源目录图片内容不是火星直升机，不能作为预览依据。GLB 内部节点、材质与网格结构确认模型本体为 Ingenuity，实际视觉效果需在支持 Draco/WebP 的渲染器中另行确认。

## 2026-09-30：高精细人形机器人与机甲候选

`rx78-2-anonmalyfound/`、`gundam-exia-yqms/`、`zaku-desert-anonmalyfound/`、`freedom-gundam-k0077/`、`unicorn-gundam-kurojishi/` 与 `ronin-04-ramonlinares/` 保存了可下载 GLB、模型统计和来源说明，并组成当前网页的 6 款高精细机甲。RX-78-2 约 77,407 三角面；Exia 约 283,923 三角面；沙漠 Zaku 约 68,004 三角面；Strike Freedom 约 429,608 三角面；Unicorn Gundam 约 403,176 三角面并依赖 80 张外置贴图；RONIN / 04 约 31,533 三角面并含 12 组动画。六款均已接入 `mech-encounter-candidates/preview/`，尚未进入微信小程序运行包。

NASA Robonaut R2 与 Valkyrie R5 的下载包和转换 GLB 仍保留在 `nasa-robonaut-r2/`、`nasa-valkyrie-r5/`，但因工程姿态/转换效果不适合展示而撤出网页。RX-93 Nu Gundam 的文件保留在 `nu-gundam-ryanwill679/`，但因展开浮游炮遮挡人体主体、轮廓不适合网页展示而撤出。Exia 与 Strike Freedom 的上传者标注 `CC BY 4.0`，RX-78-2、沙漠 Zaku 与 RONIN / 04 标注 `CC0`，Unicorn Gundam 为 `CC BY-NC 4.0` 且仅限非商业使用；高达角色、机体设计、名称和商标权利不由这些许可授予，公开或商业使用前需另行确认。

## 2026-10-03：高达接入与伊娃移除

RX-78-2 已转换为 gundam-assets 分包。2026-10-06更新：77.8–97.8秒调度、约79.5–80秒实际从右侧入画；4.3机体尺度、约85°前倾保留，近景放慢并逐渐侧倾展示胸部，沿连续弧线飞向左前方，全身在画内约6秒，最后淡出在画外。源文件保留，构建脚本 tools/model-build/prepare-gundam.py；已接入选定的C固定飞行姿势：源工程的头、肩肘和髋膝分组离线摆姿并烘焙为静态几何，默认构建源为rx78-flight-poses-2026-10-06/bank.glb；运行时维持整体飞行控制，没有新增关节动画。EVE 已按用户要求从正式绕月移除，源文件继续保留，旧运行资产移入 archives/removed-eve-2026-10-03/。

## 2026-10-07：正式 MV 四类模型索引

| 运行角色 | 来源 | 构建脚本 |
| --- | --- | --- |
| 旅行者号 | `voyager-nasa/` | `tools/model-build/prepare-voyager.py` |
| 黄色机器人 Mech Drone | `mech-encounter-candidates/mech-drone/` | `tools/model-build/prepare-mech-drone.py` |
| RX-78-2 高达 | `rx78-2-anonmalyfound/` 与 `rx78-flight-poses-2026-10-06/bank.glb` | `tools/model-build/prepare-gundam.py` |
| Luminaris Starship | `mech-encounter-candidates/luminaris-starship/` | `tools/model-build/prepare-starship.mjs`、`tools/model-build/prepare-starship-textures.py` |

四类运行资源分别位于 `miniprogram/voyager-assets/`、`miniprogram/robot-assets/`、`miniprogram/gundam-assets/` 和 `miniprogram/starship-assets/`；署名与许可见各分包内说明文件。其余候选状态仍按上文历史记录。
