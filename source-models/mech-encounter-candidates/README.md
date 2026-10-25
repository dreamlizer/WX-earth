# 登月相遇候选模型

这里保存源素材；其中 Mech Drone、Luminaris Starship 和 RX-78-2 Gundam 已通过各自构建脚本进入正式 MV，其余候选仍未接入。Sketchfab 页面标记“可下载”不等于匿名下载；其官方下载接口要求账户认证。

## 本地 3D 预览

在仓库根目录运行：

```bash
node source-models/mech-encounter-candidates/preview/server.cjs
```

然后打开 <http://127.0.0.1:18980/>。网页可切换并拖拽查看当前列表中的模型，含 EVA 机体和月面环形山摆件，滚轮或双指缩放；含动画的模型可以暂停，另有自动旋转和视角重置。页面直接读取 `source-models/` 下的本地源文件，不需要外网，也不会改动小程序。Mech Drone 使用本地贴图重建预览材质，以兼容其旧版 glTF 材质扩展；原始文件保持不变。预览器使用本地 Three.js 0.160.1，许可见 `preview/vendor/LICENSE`。

## 高精细人形机器人与机甲

当前展示 6 款可直接下载、结构复杂且近看有机械层次的人形机甲：RX-78-2 Gundam、Gundam Exia、Desert Zaku MK-II、Strike Freedom Gundam、RX-0 Unicorn Gundam 与 RONIN / 04。六款均为完整人形模型，网页 GLB 不依赖 Draco，也没有外部资源缺失；RONIN 另含 12 组动画。

| 模型 | 本地状态 | 来源 |
| --- | --- | --- |
| RX-78-2 Gundam | 已取得 77,407 三角面、17 材质、内嵌 2K 底色贴图的 GLB，并保留 `.blend` 派生工程 | [BlendKit 原页](https://www.blendkit.com/asset-gallery-detail/a6a1000b-3b72-48bb-be81-6f4ab36fabda/)、[公开派生仓库](https://github.com/zhuxingshifu1992/3d-modeling-and-games/tree/main/%E6%B8%B8%E6%88%8F/%E9%AB%98%E8%BE%BE_%E5%B7%A8%E6%9E%84%E6%9C%BA%E5%BA%93) |
| Gundam Exia | 自包含 GLB，283,923 三角面、54 材质，保留顶点色和发光材质 | [Sketchfab 原页](https://sketchfab.com/3d-models/gundam-exia-de3a7fec6d9347108720e0e816c40985)、[公开派生仓库](https://github.com/zhuxingshifu1992/3d-modeling-and-games/tree/main/%E6%B8%B8%E6%88%8F/%E9%AB%98%E8%BE%BE_%E5%B7%A8%E6%9E%84%E6%9C%BA%E5%BA%93) |
| Desert Zaku MK-II | 自包含 GLB，68,004 三角面、1 套烘焙 PBR；另保留 4 张可编辑贴图 | [BlendKit 原页](https://www.blendkit.com/asset-gallery-detail/ebee94b8-5e10-4b96-947b-7788145feaf5/)、[公开派生仓库](https://github.com/zhuxingshifu1992/3d-modeling-and-games/tree/main/%E6%B8%B8%E6%88%8F/%E9%AB%98%E8%BE%BE_%E5%B7%A8%E6%9E%84%E6%9C%BA%E5%BA%93) |
| Strike Freedom Gundam | 自包含 GLB，429,608 三角面、16 材质、46 张内嵌图片 | [Sketchfab 原页](https://sketchfab.com/3d-models/strike-freedom-gundam-0d5a236cdb164c5094a8d296d9352943)、[公开派生仓库](https://github.com/zhuxingshifu1992/3d-modeling-and-games/tree/main/%E6%B8%B8%E6%88%8F/%E9%AB%98%E8%BE%BE_%E5%B7%A8%E6%9E%84%E6%9C%BA%E5%BA%93) |
| RX-0 Unicorn Gundam | 403,176 三角面、25 材质，依赖同目录 80 张外置贴图 | [Sketchfab 原页](https://sketchfab.com/3d-models/gundam-unicorn-1410ff9dd1c94807a00b8a0936170196)、[公开派生仓库](https://github.com/zhuxingshifu1992/3d-modeling-and-games/tree/main/%E6%B8%B8%E6%88%8F/%E9%AB%98%E8%BE%BE_%E5%B7%A8%E6%9E%84%E6%9C%BA%E5%BA%93) |
| RONIN / 04 | 自包含 GLB，31,533 三角面、4 材质、3 张内嵌图片、12 组动画 | [上游仓库](https://github.com/RamonLinares/atlas-09) |

NASA Robonaut R2 与 Valkyrie R5 的工程描述包和转换 GLB 仍保留在 `../nasa-robonaut-r2/`、`../nasa-valkyrie-r5/`，但不再进入展示列表：前者是 URDF 科研资产，后者转换后存在分件与材质异常，不适合本次展示目标。RX-93 Nu Gundam 也保留下载文件与检查记录，但双侧展开浮游炮在常规视角下遮挡人体主体、轮廓过于破碎，因此不进入展示列表。Exia 与 Strike Freedom 的上传者标注 `CC BY 4.0`；RX-78-2、沙漠 Zaku 与 RONIN / 04 标注 `CC0`；Unicorn Gundam 为 `CC BY-NC 4.0`，仅限非商业使用。高达相关许可都不等于取得角色、机体设计、名称和商标的官方授权。具体来源、校验值和转换边界见各模型目录中的 `SOURCE.md`。

## NASA 太空物体

网页已接入 7 个 NASA 3D Resources 文件：Chandra X-ray Observatory、Magellan、Stardust、Parker Solar Probe、Ingenuity Mars Helicopter、James Webb Space Telescope (A) 和 Juno (A)。它们位于 `../<model-name>-nasa/`，逐项来源、模型统计和授权说明见对应目录的 `SOURCE.md`。NASA 资源免费且无版权，但使用时仍应遵守 [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media)，保留 NASA 来源信息，且不得暗示 NASA 为项目背书。

7 个 GLB 都使用 `KHR_draco_mesh_compression`，预览器通过本地 `DRACOLoader` 和 `preview/vendor/libs/draco/gltf/` 解码，不需要联网下载解码器。James Webb 模型约 49 万个三角面、1,600 个 mesh，适合桌面高精预览；Juno 文件约 9 MB，含 14 张内嵌图片。它们尚未针对微信小程序包体、材质预算和真机性能做接入优化。Ingenuity 的 NASA 来源 PNG 与模型内容不匹配，网页按 GLB 本体显示，GLB 内含 `rotors_01/02`、`leg_01–04`、`solar_panel` 与 `cams` 节点。

本地 Three.js 0.160.1 的 `DRACOLoader.js` 适用 MIT 许可；Google Draco decoder 文件来自 Three.js 0.160.1 发布包，上游为 [google/draco](https://github.com/google/draco)，许可信息见其 [LICENSE](https://github.com/google/draco/blob/master/LICENSE)。这些文件只用于本地预览器加载压缩 GLB。

| 对话中的模型 | 本地状态 | 来源 |
| --- | --- | --- |
| Mech Drone — Willy Decarpentrie | 已取得 glTF、二进制数据、7 张贴图及署名许可 | [Sketchfab 原页](https://sketchfab.com/3d-models/mech-drone-8d06874aac5246c59edb4adbe3606e0e)、[公开项目文件](https://github.com/jgbarah/aframe-playground/tree/master/assets/3d/mech_drone) |
| Futuristic flying animated Robot — Shayan | 已从公开场景中分离出 GLB；属二次导出版本，并非 Sketchfab 原始下载包 | [Sketchfab 原页](https://sketchfab.com/3d-models/futuristic-flying-animated-robot-low-poly-c5b92c281dc444448e64c0607719c7a2)、[公开场景项目](https://github.com/Saad-Hisham/3d-room-portfolio) |
| EVE from Wall-E — mdv_mlhtr_dev_ | 已取得 Objaverse 的同 ID GLB，内嵌原作者与 CC BY 4.0 信息 | [Sketchfab 原页](https://sketchfab.com/3d-models/eve-from-wall-e-d23a3ce48b4e4fc9aa33340c3634330d)、[公开数据集文件](https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/000-062/d23a3ce48b4e4fc9aa33340c3634330d.glb) |
| Sci-Fi Camera Drone — 3dsofsan | 已取得 Objaverse 的同 ID GLB，含贴图与动画 | [Sketchfab 原页](https://sketchfab.com/3d-models/sci-fi-camera-drone-3dbf07385d1b471a96dce6de6cba97d6)、[公开数据集文件](https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/000-142/3dbf07385d1b471a96dce6de6cba97d6.glb) |
| RX-78-2 Gundam Low Poly — Jonathan.C_Arts | 未取得文件，Sketchfab 下载需登录 | [Sketchfab 原页](https://sketchfab.com/3d-models/rx-78-2-gundam-low-poly-2a7578e70915477c9cc0d42415625cf6) |
| Rx-93 Nu Gundam — Ryanwill679/TrashCG | 已从公开派生仓库取得 GLB、贴图副本和转换记录 | [Sketchfab 原页](https://sketchfab.com/3d-models/rx-93-nu-gundam-85c329a2565043c58999afd43506c9a9)、[公开派生仓库](https://github.com/zhuxingshifu1992/3d-modeling-and-games/tree/main/%E6%B8%B8%E6%88%8F/%E9%AB%98%E8%BE%BE_%E5%B7%A8%E6%9E%84%E6%9C%BA%E5%BA%93) |
| Strike Freedom Gundam — K0077 | 已从公开派生仓库取得 GLB、46 张贴图副本和转换记录 | [Sketchfab 原页](https://sketchfab.com/3d-models/strike-freedom-gundam-0d5a236cdb164c5094a8d296d9352943)、[公开派生仓库](https://github.com/zhuxingshifu1992/3d-modeling-and-games/tree/main/%E6%B8%B8%E6%88%8F/%E9%AB%98%E8%BE%BE_%E5%B7%A8%E6%9E%84%E6%9C%BA%E5%BA%93) |
| RX-0 Unicorn Gundam — kurojishi | 已从公开派生仓库取得 GLB、80 张必需外置贴图和转换记录；仅非商业 | [Sketchfab 原页](https://sketchfab.com/3d-models/gundam-unicorn-1410ff9dd1c94807a00b8a0936170196)、[公开派生仓库](https://github.com/zhuxingshifu1992/3d-modeling-and-games/tree/main/%E6%B8%B8%E6%88%8F/%E9%AB%98%E8%BE%BE_%E5%B7%A8%E6%9E%84%E6%9C%BA%E5%BA%93) |
| RX-78-2 Gundam — AnonmalyFound | 已取得公开派生 GLB、`.blend`、2K 贴图和转换记录 | [BlendKit 原页](https://www.blendkit.com/asset-gallery-detail/a6a1000b-3b72-48bb-be81-6f4ab36fabda/)、[公开派生仓库](https://github.com/zhuxingshifu1992/3d-modeling-and-games/tree/main/%E6%B8%B8%E6%88%8F/%E9%AB%98%E8%BE%BE_%E5%B7%A8%E6%9E%84%E6%9C%BA%E5%BA%93) |
| Gundam Exia — yqms | 已取得公开派生自包含 GLB、预览图和转换记录 | [Sketchfab 原页](https://sketchfab.com/3d-models/gundam-exia-de3a7fec6d9347108720e0e816c40985)、[公开派生仓库](https://github.com/zhuxingshifu1992/3d-modeling-and-games/tree/main/%E6%B8%B8%E6%88%8F/%E9%AB%98%E8%BE%BE_%E5%B7%A8%E6%9E%84%E6%9C%BA%E5%BA%93) |
| Desert Zaku MK-II — AnonmalyFound | 已取得公开派生自包含 GLB、4 张 PBR 贴图和转换记录 | [BlendKit 原页](https://www.blendkit.com/asset-gallery-detail/ebee94b8-5e10-4b96-947b-7788145feaf5/)、[公开派生仓库](https://github.com/zhuxingshifu1992/3d-modeling-and-games/tree/main/%E6%B8%B8%E6%88%8F/%E9%AB%98%E8%BE%BE_%E5%B7%A8%E6%9E%84%E6%9C%BA%E5%BA%93) |
| Luminaris Starship — iggy-design | 已取得 FBX 和 5 张贴图 | [Sketchfab 原页](https://sketchfab.com/3d-models/luminaris-starship-b8001c7cf83240f383ccdbe75094e468)、[VFXstudy 公开教程包](https://vfxstudy.com/tutorials/starship-1/) |

Mech Drone 的 `mech-drone/scene.gltf` 引用的 `scene.bin` 与 7 张贴图均已核对存在，二进制文件长度与 glTF 声明一致。公开项目自带 `AUTHOR` 和 CC BY 4.0 `LICENSE` 文件。

Shayan 机器人见 `shayan-flying-robot/robot-extracted.glb` 和该目录的 `SOURCE.md`。公开场景项目明确标注原 Sketchfab 作品；分离出的机器人为 5,774 个三角面，与原页数据一致，含 3 个材质和 1 组动画（14 个通道）。GLB 验证器无错误、警告；这是从场景中单独提取的版本，不能视为作者原始文件的逐字节副本。

EVE 和 Camera Drone 的文件分别见 `eve-from-wall-e/`、`sci-fi-camera-drone/`。两份 GLB 的内嵌 Sketchfab 来源 ID、作者、标题和 CC BY 4.0 许可均与目标作品一致；GLB 结构、缓冲区和资源引用已核对。具体来源与 SHA-256 见各目录 `SOURCE.md`。

Luminaris Starship 是从 VFXstudy 公开教程包中单独提取的模型文件及贴图；教程页明确注明模型作者为 Igor Puškarić。原 Sketchfab 页面列为 CC BY，并带 `NoAI` 标记。教程包没有单独附模型许可文件，后续使用应同时保留作者、来源和页面许可信息。

下载包通过 ZIP 完整性检查，FBX 有有效的二进制文件头，5 张贴图均可识别为 PNG。本机 Blender 5.2.1 的无界面进程在空项目下也会崩溃，因此本轮未完成 FBX 导入验证。

对话提到的 summerforce 付费 RX-78-2 未购买，也不计入上面 7 个免费候选。

截至 2026-09-30，网页形成 6 款复杂人形机甲组合：RX-78-2 Gundam、Gundam Exia、Desert Zaku MK-II、Strike Freedom Gundam、RX-0 Unicorn Gundam 与 RONIN / 04。NASA 两个工程机器人、RX-93 Nu Gundam，以及未入选的 ATLAS / 09、TITAN / 06 候选均不进入展示列表；已下载文件保留，便于后续筛选、仿真或重新转换。
