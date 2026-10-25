# 登月月面 B 方案：执行方案与新线程交接

更新：2026-10-20。项目根目录：`/Users/a1234/Documents/Codex项目/wx-earth`。

## 1. 已确认的决定与当前交付边界

用户已看过三档实渲染对比图，并明确选择 **B「环形山中景」**。不要重新做 A/B/C 方向征询，也不要继续投入贴地近景。

用户原话：

> 还是避免那种特别近景的看着地面那种场景，没必要了吧？可以悬在空中几十米或者几百米的样子……看到环形山的时候就挺震撼。
>
> 好的，我觉得 B 方案可以。

目标：以悬空视角观看完整环形山，利用坑壁明暗、坑底层次、小坑尺度对比、远处地球与黑色宇宙形成沉浸感。用户希望有一眼能看出的视觉变化，已经否定过“只做精修但几乎无感”的路线。

**已确认的是 B 的静态构图方向；尚未完成动态镜头、歌词衔接、微信接入和手机性能验证。** 下一步先做独立动态样段，原版保留；效果通过后再推进小程序接入。本文是执行交接，本次只新增文档，没有继续修改视觉代码或正式小程序。

高度仅表示“悬在空中几十米至几百米的感觉”。素材没有真实尺寸标定，现有场景单位不是已确认的米，不要在界面或报告里冒充精确离地高度。

## 2. 快速阅读顺序

1. 项目根目录 `AGENTS.md`。
2. 本文与 `source-models/moon-terrain-trial/airborne-comparison/comparison.png`。
3. 同目录 `viewer.js`、`index.html`、`README.md`，这是选定 B 的直接依据。
4. `source-models/moon-terrain-trial/README.md` 和 `crop-preview/README.md`，了解已试过什么及失败边界。
5. `docs/HANDOFF-MOON-VOYAGE.md` 顶部最新记录，了解正式 MV 状态。该文件有大量历史条目，旧条目不能覆盖新决定。
6. 需要衔接正式 MV 时再读当前 `config.js`、`moon-voyage-timeline.js`、`moon-orbit-sequence.js`、音频和歌词模块；涉及视频导出时读 `docs/VIDEO-PRODUCTION-GUIDE.md`。

历史 `docs/MOON-VOYAGE-ATMOSPHERE-EXECUTION-PLAN-2026-10-20.md` 和 `docs/original-moon-mv-refinement-plan.md` 用来理解背景，不能把旧实验或旧时间当成这次 B 样段的执行指令。

## 3. 从旧方案到 B 的结论

| 阶段 | 内容与用户反馈 | 后续地位 |
| --- | --- | --- |
| 原 MV 氛围精修 | 技术检查通过；用户在电脑微信开发者工具看后认为几乎没有可感知变化 | 保留正式版本，不以测试通过代替体验成功 |
| 手写月缘/山脊样段 | 镜头方向可接受，月面太光滑、模型感强 | 保留供前后对照，不继续自造月面细节 |
| 成熟资产整片轻量试装 | 环形山丰富，但整片 2K/8 万面贴地发糊 | 作为中景资产基础 |
| 原精度局部裁切 | 坑壁细节改善，过近仍不好；用户认为中景可以 | 保留诊断，不将 24 MiB 局部直接放手机 |
| 悬空 A/B/C | 真实 WebGL 渲染，用户选择 B | 当前视觉基准 |

原作者资料说明包含 PBR 贴图、32 位 EXR 和场景文件；此前没有找到明确的推荐摄影高度或详细灯光教程。当前效果未采用 EXR 位移/C4D 离线渲染，不能说是素材质量上限。新线程也不必为追求贴地写实去展开这些重流程：用户已选择中景。

## 4. 现有目录与依赖

以下路径相对项目根目录，均已核对存在；标为“拟新增”的除外。

```text
wx-earth/
├── AGENTS.md
├── docs/
│   ├── HANDOFF-MOON-TERRAIN-B-2026-10-20.md     # 本文
│   ├── HANDOFF-MOON-VOYAGE.md                 # 正式 MV 最新状态及历史
│   ├── VIDEO-PRODUCTION-GUIDE.md
│   └── reviews/moon-atmosphere-2026-10-20/    # 前轮精修证据
├── experiments/moon-ridge-sample-2026-10-20/ # 最早手写山脊样段，保留
│   ├── index.html / player.js / scene.js / server.cjs
│   ├── original-harness.snapshot.js
│   ├── original-orbit.snapshot.js
│   ├── assets/earth.jpg                      # B 当前跨目录依赖
│   └── output/                              # 旧视频及对比图，保留
├── source-models/
│   ├── mech-encounter-candidates/preview/vendor/
│   │   ├── three.module.js                   # B 的 Three.js 公共依赖
│   │   └── loaders/GLTFLoader.js             # 及其已有相对依赖
│   └── moon-terrain-trial/
│       ├── README.md
│       ├── original/LAN-Moon-landscape-free-1.7z
│       ├── extracted/
│       │   ├── LAN_Mesher_01.obj
│       │   ├── LAN_Albedo_01.jpg
│       │   ├── LAN_Normal Map_01.jpg
│       │   ├── LAN_Roughness_01.jpg
│       │   ├── LAN_Occlusion_01.jpg
│       │   ├── LAN_Curvature_01.jpg
│       │   ├── LAN_Erosion_01.exr
│       │   └── SCN_moon_landscape.c4d
│       ├── prepare.py                       # 整片减面转换
│       ├── prepare-crop.py                  # 原精度局部裁切
│       ├── preview/                         # 8963：整片轻量旧样段
│       │   ├── index.html / viewer.js / server.cjs
│       │   ├── trial-near.png / trial-wide.png
│       │   └── assets/
│       │       ├── terrain.glb / mesh-stats.json
│       │       └── albedo.jpg / normal.jpg / roughness.jpg / ao.jpg
│       ├── crop-preview/                    # 8964：局部近景对照
│       │   ├── index.html / viewer.js / server.cjs / README.md
│       │   ├── prepare-textures.py
│       │   ├── crop-near.png / baseline-near.png
│       │   └── assets/                      # 原精度裁切及修正法线
│       ├── airborne-comparison/             # 8965：用户确认 B 的基准
│       │   ├── index.html / viewer.js / server.cjs / README.md
│       │   ├── comparison.png               # 1656×1120，三张540×960
│       │   └── assets/normal-object.jpg      # 修正后的整片法线
│       └── airborne-b-motion/               # 拟新增：B 动态样段独立目录
└── miniprogram/pages/gl/                     # 正式实现，当前不接入
    ├── index.* / main.js / app-engine.js
    ├── config.js
    ├── moon-voyage-manager.js
    ├── moon-voyage-timeline.js
    ├── moon-orbit-sequence.js
    ├── moon-voyage-scene-setup.js
    ├── moon-voyage-assets.js
    ├── moon-voyage-lighting.js
    ├── moon-voyage-audio.js / moon-voyage-lyrics.js
    └── moon-voyage-lifecycle.js
```

**B 文件夹不是自包含工程。** 它从 `../preview/assets/` 加载网格、颜色、粗糙度和 AO；从自身 `assets/` 加载修正法线；通过公共 vendor 加载 Three.js/GLTFLoader；`server.cjs` 将 `/earth.jpg` 映射到旧手写样段的地球图。移动/复制目录时必须保留这些路径或显式更新引用，不要只拷 HTML 就宣布可复现。

下载原件还在 `/Users/a1234/Downloads/LAN-Moon-landscape-free-1.7z`，项目内已有完整备份，新线程无需再次下载。

## 5. 资源来源与大小

作者：Oleksiy Rysyuk。资源页：[Free 8K Moon terrain | PBR](https://www.artstation.com/marketplace/p/y2ez/free-8k-moon-terrain-pbr)。历史查询记录为 5.0/5、12 个评分、7 条文字评价，可见文字评价针对付费完整版，不能解释为免费单块的独立评分。免费档许可历史记录为 Standard License；最终分发前核对实际适用条款，不为本地样段重新领取或购买。

| 资源档 | 已核对结果 | 用途 |
| --- | --- | --- |
| 原压缩包 | 409,844,514 字节，390.86 MiB | 本地源资产，绝不整包进小程序 |
| 原 OBJ | 1,048,576 顶点，2,093,058 三角面 | 源模型 |
| 原 JPG | 五张 8192×8192；另有 EXR 和 C4D | 源贴图与离线场景 |
| 8963 旧轻量档 | 5,272,466 字节，5.03 MiB | 8 万面，全地形 |
| 8964 原精度局部档 | 25,246,677 字节，24.08 MiB | 391,426 三角面，四图 3072×4096，仅诊断 |
| **B 实际月面依赖** | **5,734,067 字节，约 5.47 MiB** | 8 万面，与旧轻量档相比换了修正法线 |

B 的资源明细：

| 文件 | 字节 |
| --- | ---: |
| preview/assets/terrain.glb | 1,773,400 |
| preview/assets/albedo.jpg | 961,554 |
| preview/assets/roughness.jpg | 360,541 |
| preview/assets/ao.jpg | 142,333 |
| airborne-comparison/assets/normal-object.jpg | 2,496,239 |

以上不含公共代码、地球图、页面及缓冲。JPEG 传输体积不等于显存：B 的两张 2K、两张 1K 图按 RGBA8 加 mip 链估算约 53.3 MiB；局部四图约 256 MiB。均非手机测量，另有阴影、模型与渲染缓冲。不要把 4096 阴影图和桌面预览配置直接视为手机配置。

## 6. B 构图复现参数

以 `airborne-comparison/viewer.js` 为最终代码依据，下列为交接时快照。

| 项目 | 当前值 |
| --- | --- |
| 单帧尺寸 | 540×960，9:16，pixelRatio=1 |
| 相机 | PerspectiveCamera，FOV 55°，near=0.1，far=2000 |
| **B 相机位置** | **(55, 60, 140)** |
| **B 看向目标** | **(25, 8, -60)** |
| 地形 | GLB，整体 scale=100，80,000 三角面、40,386 顶点 |
| 太阳 | DirectionalLight，0xfff5e9，强度3.3，位置(-110,48,35)，默认目标原点 |
| 环境光 | 0xadb5c8，强度0.09 |
| 输出 | sRGB，ACESFilmicToneMapping，曝光1.35 |
| 阴影 | PCFSoft，4096²；范围±145，near1/far350，bias=-0.00015，normalBias=0.025 |
| 材质 | MeshStandardMaterial，roughness=1，metalness=0，AO强度0.6 |
| 法线 | ObjectSpaceNormalMap；现有修正图通道为 (255-R, B, G) |
| 贴图 | 月面flipY=false；颜色图sRGB，其余NoColorSpace；anisotropy最大8 |
| UV | uv1复用uv，供AO使用 |
| 地球 | 球半径16，位置(0,95,-520)，rotation.y=2，Standard材质 |

法线修正依据是原高度场梯度与贴图通道关系，不是无依据“加强凹凸”。不要直接恢复旧 normal.jpg 的默认切线法线接法。旋转/重导出模型后需检查坐标变换与法线一致性。

图中地球用于构图示意，当前没有正式 MV 的完整云层、自转和朝向逻辑。局部地形是有限的地块，并非完整月球：动态取景必须防止露出矩形边缘或把地块远边当作真实月球地平线。

## 7. 新线程第一阶段：B 动态样段

### 7.1 立即执行的工作

创建 `source-models/moon-terrain-trial/airborne-b-motion/`，复用 B 的素材、灯光和终态构图。保留全部已有样段及 comparison.png，不覆盖旧 viewer.js，不复制390 MiB源包，不重新造地形。

建议文件：`index.html`、`viewer.js`、`shot-config.json`、`server.cjs`、`README.md`、`output/`。这是最小可编辑样段，不需要引入新框架或重做全曲。

先把 B 静态画面复现准确，再做 **约20秒** 的连续运镜；20秒是建议默认值，不是用户确认的正式曲目时长。提供播放/暂停、重播、时间滑条和直达 B 基准帧，控制条放画面外。终态或中后段必须能明确辨认为已选 B，不能借“动起来”重新改变主体构图。

### 7.2 运镜草案

| 样段相对时间 | 画面与运动 | 判断重点 |
| --- | --- | --- |
| 0–5秒 | 已在月面上空，沿坑缘缓慢前行；坑壁整体可辨 | 开场就有尺度，不贴地，不用大片模糊地面铺屏 |
| 5–12秒 | 轻微升高/平移，展开主环形山的坑底与远处小坑 | 依靠真实三维视差展示结构，速度连续，不突然俯冲 |
| 12–16秒 | 缓慢进入选定 B 构图 | 地球、坑壁、黑色留白的关系保持，主坑不被裁断 |
| 16–20秒 | 接近停留，保留极轻的空间运动 | 留白、安静，让观众看清环形山和远地球 |

“越过山脊再看见地球”是前面提出的叙事意图，但 B 静态画面本身已经露出地球。新线程可以在悬空前提下尝试自然遮挡/揭示；如果现有地形做不到，直接让地球已在远方也可以。不要为了强行揭示而把相机压回地面，或让地球瞬移、假淡入、改变世界位置来伪造越岭。

先不用新增飞行器、碎石、尘雾、脚印或强光特效。保留单一太阳方向与黑色背景；月面层次主要由成熟地形、法线和阴影产生。若需要修整有限地块的可见边缘，只处理实际露馅区域，不重新生成整个月球。

用绝对时间驱动相机位置和朝向，支持重复seek；采用连续曲线/缓入缓出，防止位置平滑而朝向跳变。记录关键帧及参数。初版以浏览器可播放样段和关键帧联系图为交付，不强制先导出高码率长视频。

### 7.3 快速验证与停止条件

- 先看0秒、中间两帧、B停留帧，再正常速度看完整20秒；不能仅靠末帧判断运动成功。
- 全程检查地形边缘、穿模、地球遮挡、阴影跳动和贴图加载。出现问题后修具体问题，不做无目标精修。
- 至少有一个可感知变化来自运动中的坑壁/坑底展开和视差；不是把现有截图平移缩放。
- 与选定 B 对照时保留同样画幅和主光，避免同时大改灯光导致无法判断镜头是否成立。
- 样段通过这些检查即可给用户看，等待动态观感反馈。不要擅自把“静态 B 已选”写成“整段动画已验收”。

## 8. 歌词、故事线与正式 MV 的衔接

现有大故事线：离开地球 → 星空长廊与既有相遇 → 接近月球 → 绕月观看 → 远地球终景与留白。新月面段是其中的地貌体验候选，不重写前半程角色剧情，也不自动替换整段绕月。

当前 `config.js` 的阶段长度为离地38秒、长廊40秒、接近35秒、绕行130秒，即113秒入绕月、243秒进入末段。最新交接记录为末段12秒推近、255秒停稳；271.7267秒音轨与歌词preset999是前轮核对记录，接入时仍以实际音轨/代码/页面为准。不能套用已过时的261秒停稳或其他歌曲时间轴。

新动态样段先使用自己的0–20秒相对时间。接入前读取 `moon-voyage-audio.js`、`moon-voyage-lyrics.js` 和preset999实际歌词，记录候选插入点、该处歌词/间奏、接入前后相机状态。当前尚未确定具体插入秒数，不要编造某句歌词已与越岭对齐。

情绪安排建议：接近段的期待 → 坑壁展开的尺度感 → 环形山与地球同框的安静。地貌展开优先放在可以看画面的间奏或疏朗段落；字幕不遮主坑关键结构，保留现有中英歌词调度。若歌词/音乐不支持20秒完整插段，缩放样段节奏或替换局部航段，不延长歌曲或改动歌词来迁就镜头。

## 9. 第二阶段：效果通过后的小程序接入方案

此节是后续计划，第一阶段不执行正式接入。

1. **确定衔接位置**：在当前正式时间线中选择局部段落，记录进入/退出的相机位置、朝向、速度、太阳方向、月球与地球大小。静态示意灯光不能直接覆盖正式 MV 全局灯光。
2. **确认真实加载链路**：检查 `threejs-miniprogram.js`、已有资源管理和模型加载方式。桌面ESM/importmap/浏览器GLTFLoader不能直接复制进微信当作已适配。
3. **只准备镜头实际需要的资源**：B 的8万面和约5.47MiB作为对照起点；按可见范围、屏幕像素和实机瓶颈决定裁切/简化。禁止全图反复压缩后再宣称画质够用；保留B画面对照。
4. **分开量化传输与显存**：列模型、贴图、解码内存、GPU纹理、阴影缓冲和峰值加载；核对当前微信包限制与项目资源分包。云端资源或GPU压缩格式必须按实际平台支持选，不预先承诺某格式一定可用。
5. **接入可回退入口**：新地形逻辑局部封装，保留原路径；正式替换范围以用户已确认的动态方案为准，不改正常地球/禅定歌曲及其他相遇。
6. **生命周期**：进入时加载、退出释放geometry/material/texture；退出中的迟到加载不得重新挂场景，保留`_entering`/`_exiting`、生命周期token和moon lock。加载失败应仍能退出，并保留原路径兜底。
7. **微信验证**：先目标项目普通编译，再看模拟器连续播放和真机；不重启/关闭其他项目，不把浏览器结果说成微信成功。
8. **发布**：本方案不包含云上传、正式部署、公开发布或购买新资产；需要这些动作时遵循用户相应授权。

## 10. 验收表：如何才算过关

| 层级 | 通过标准 | 当前状态 |
| --- | --- | --- |
| B静态方向 | 用户明确选B；主坑、地球与留白关系可接受 | **已通过方向确认** |
| 动态样段 | 全程悬空；无贴地段；主坑展开可感知；B构图可辨；无矩形边、穿模、突跳；正常速度完整观看 | 未制作 |
| 用户动态观感 | 用户看完整样段后认可节奏和尺度感 | 待样段交付 |
| 音画衔接 | 实际音轨/歌词对应；前后姿态和速度连续；无重复漏段；不影响既有故事线 | 未确定插入点 |
| 加载与退出 | 目标平台资源正确；失败可退出；再入/中退/自然结束无残留和状态锁死 | 未接入 |
| 手机性能 | 指定实际机型记录加载时间、帧时/帧率、卡顿和可取得的内存指标；连续播放及重复进退无崩溃或资源持续增长 | 未测 |
| 功能回归 | 普通地球、禅定、登月均可正常进入退出；字幕、音频、按钮层级正确 | 新方案未接入，待后续验证 |

手机阶段建议以稳定30fps作为初步底线，并与原版同机对照卡顿和加载；这是执行建议，尚非已确认性能承诺。拿不到指标就写未测，不以桌面60fps替代。

修改JS后按 `AGENTS.md` 执行全部 `tools/*.test.cjs`；正式接入还需`git diff --check`及微信真实运行验证。文档改动无需重跑渲染或整套测试。已有41个测试在B对比页制作后通过，日志为`/tmp/wx-earth-airborne-tests.log`；临时日志可能消失，不作为长期唯一证据，也不证明新动态样段通过。

## 11. 预览启动与已知运行方式

在项目根目录执行对应命令；服务是否还活着以实际端口为准。先检查占用，已存在就复用，不杀其他服务。

```bash
cd '/Users/a1234/Documents/Codex项目/wx-earth'
lsof -nP -iTCP:8965 -sTCP:LISTEN
node source-models/moon-terrain-trial/airborne-comparison/server.cjs
```

B预览：<http://127.0.0.1:8965/>，自动跳转到`/moon-terrain-trial/airborne-comparison/index.html`。页面“保存对比图”会覆盖该目录`comparison.png`，因此新样段必须使用自己的导出目录，避免改掉已确认基准。

| 旧入口 | 服务文件 |
| --- | --- |
| 8962 手写山脊 | experiments/moon-ridge-sample-2026-10-20/server.cjs |
| 8963 整片轻量 | source-models/moon-terrain-trial/preview/server.cjs |
| 8964 原精度局部 | source-models/moon-terrain-trial/crop-preview/server.cjs |
| 8965 已选B对比 | source-models/moon-terrain-trial/airborne-comparison/server.cjs |

动态样段建议使用空闲8966端口，未占用才启动；不要假设它必然空闲。绑定127.0.0.1即可。

本机已有Node、Python/Pillow/numpy、Blender。Blender路径`/Applications/Blender.app/Contents/MacOS/Blender`。初版直接复用GLB，无需再运行Blender。过去受沙箱影响，监听本地端口和Blender后台运行需要工具权限处理；按实际错误解决，不擅自安装新软件或修改系统安全设置。

## 12. 保留边界与下轮交付清单

工作区有大量现存未提交修改，包括正式MV、其他歌曲、Video、experiments与素材。新线程开始先看`git status --short`，不要reset/clean、全库格式化或一并提交。未提交不等于可删除，git也不是唯一备份。

下一阶段交付：

- 独立可播放的B动态样段及明确预览URL。
- 0秒/展开中段/B停留帧的实际渲染联系图。
- 参数化源文件，B基准机位可恢复。
- 简短README：资源依赖、相对时间线、加载体积、实际验证、未通过或未测项。
- 对原版和本轮新文件的清晰区分；正式小程序仍保留，直至进入确认后的接入阶段。

## 13. 可直接粘贴到新线程的提示词

```text
请继续 wx-earth 的登月月面 B 方案。

项目：/Users/a1234/Documents/Codex项目/wx-earth
先读 AGENTS.md 和 docs/HANDOFF-MOON-TERRAIN-B-2026-10-20.md，再查看 source-models/moon-terrain-trial/airborne-comparison/comparison.png 与 viewer.js。

我已经确认 B「环形山中景」。不要再做方案选择，不要贴地看地面；保持悬空几十米至几百米的视觉感，以完整环形山、坑壁层次、远地球与黑色宇宙留白为主。高度不冒充真实米制。

请直接开始制作独立的 B 动态样段，默认约20秒：悬空接近坑缘→缓慢展开环形山→进入已确认B构图→安静停留。复用已有成熟地形和修正法线，不重新造月面，不再追求极近景。越岭后地球显露只在真实几何允许时实现，不能为此回到贴地视角或让地球瞬移。

新建 source-models/moon-terrain-trial/airborne-b-motion/，保留8962/8963/8964/8965及全部原素材。注意B目录依赖preview/assets、公共Three.js/GLTFLoader和旧样段earth.jpg，具体以交接文档为准。先复现B，再添加连续运镜、播放/暂停/重播和时间滑条。不要覆盖已确认comparison.png，不改其他歌曲或现有未提交工作。

完成后给我可播放预览、关键帧联系图、源目录和验证结论。检查完整正常速度播放、地块边缘、穿模、阴影、镜头连续性及B构图保持；JS改动跑项目必需检查。当前先做独立样段，效果确认后再进小程序；不上传发布，不把浏览器运行说成微信真机验收。无需重新询问已确认的B方向或复用素材许可范围内的本地操作。
```
