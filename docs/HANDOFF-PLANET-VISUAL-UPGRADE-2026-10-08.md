# 地球与月球视觉提升交接

日期：2026-10-08。项目：`/Users/a1234/Documents/Codex项目/wx-earth`。

## 当前任务与交接状态

用户认为登月飞行动画已经基本满意，现在希望提升地球和月球本体的美感，向所附概念图中的电影感靠近：地球近景有厚实云层、柔和海面反光、薄亮蓝色大气边缘与暖色夜灯；月球有清楚的陨石坑和侧光明暗。用户允许适度艺术化，不以严格还原物理观感为首要目标。

上一轮仅完成代码检查、资料研究和方案讨论，没有更换贴图、修改材质或新增渲染效果。本次只交付交接文档与新线程提示词。不要把候选方案描述为已实现，或把概念图当作当前小程序截图。

新线程建议先完成第一轮实际渲染试做：用准备接入小程序的材质代码制作地球近景、地球远景、月球近景三组现状/新版静态对照。用户确认效果后再接回正式体验。第一轮不是生成新的 AI 概念图。

## 视觉参照

用户原附件已保存在项目内：

![用户提供的地球与月球概念参照](/Users/a1234/Documents/Codex项目/wx-earth/docs/reviews/planet-visual-upgrade-2026-10-08/user-reference.png)

参照文件：`/Users/a1234/Documents/Codex项目/wx-earth/docs/reviews/planet-visual-upgrade-2026-10-08/user-reference.png`。

项目另有概念图目录：`/Users/a1234/Documents/Codex项目/wx-earth/docs/reviews/solar-system-concepts-2026-10-08/`，其 README 明确这些图由 imagegen 生成，尚未接入小程序。该目录还包含太阳系、土星等概念，当前任务只涉及地球和月球，不因此扩展为太阳系开发。

从附件提取的重点：

- 地球边缘是细亮蓝边向外柔和衰减，亮度跟随太阳方向；避免均匀粗蓝圈。
- 云层有内部明暗、团块结构和地表之间的空间层次；避免一层发白的半透明纱。
- 海洋有宽而柔和的反光，反光随光源与视角变化；陆地不能同样发亮。
- 夜侧保留深蓝黑的体积，城市灯光是局部暖光，不能让整个暗面发灰。
- 月球的立体感主要来自侧光和明暗交界处的坑壁细节；不添加地球式蓝色大气。
- 靠近和远离都要成立。极近云团特写可能需要更高质量云图或局部细节，不能承诺仅靠全球贴图在任意距离完全复现概念图。

## 已核实的实现基础

| 位置 | 当前基础及注意事项 |
| --- | --- |
| `/Users/a1234/Documents/Codex项目/wx-earth/miniprogram/pages/gl/scene-loader.js` | 地球及贴图加载、独立云层。云球半径为地球半径加 0.012；初始云材质是透明 MeshPhongMaterial、opacity 0.28、AdditiveBlending。后续状态可能调整材质参数，要沿实际运行链路核实。 |
| `/Users/a1234/Documents/Codex项目/wx-earth/miniprogram/pages/gl/shaders/dayNightMix.glsl.js` | 已有昼夜混合、海面高光、视角相关反光等着色器基础；存在简化路径，新增效果要确认实际设备走哪条路径。 |
| `/Users/a1234/Documents/Codex项目/wx-earth/miniprogram/pages/gl/theme-manager.js` | 禅定材质创建、主题切换和 uniform 配置。目前禅定配置启用按地表颜色估算海洋的方式，未使用专门高光遮罩。注意不同主题贴图与昼夜纹理对齐。 |
| `/Users/a1234/Documents/Codex项目/wx-earth/miniprogram/pages/gl/layers.js` | Scoped Three.js、渲染器、相机与基础灯光；现有色彩输出和 tone mapping 配置。确认实际 Three.js 版本和 API，不能直接照抄新版 colorSpace 接口。 |
| `/Users/a1234/Documents/Codex项目/wx-earth/miniprogram/pages/gl/moon-voyage-scene-setup.js` | createMoon 使用 SphereGeometry(1,64,64) 和 MeshStandardMaterial，roughness 0.9、metalness 0、底色 0xdddddd。当前只有颜色贴图，没有 normalMap、bumpMap 或 displacementMap。 |
| `/Users/a1234/Documents/Codex项目/wx-earth/miniprogram/pages/gl/moon-voyage-lifecycle.js` | 月球颜色图引用云存储中的 assets/Moon/2k_moon.jpg，保留生命周期保护与进入/退出状态还原。 |
| `/Users/a1234/Documents/Codex项目/wx-earth/miniprogram/pages/gl/moon-voyage-lighting.js` | 月球接近时的灯光交接。已有 103–113 秒连续过渡修复，避免稳定后又突然变暗。 |
| `/Users/a1234/Documents/Codex项目/wx-earth/miniprogram/pages/gl/asset-manager.js` | 贴图修正与资源管理。月球现有 fixTexture 处理 PC 微信贴图方向，新增数据图须与颜色图方向一致。 |

根目录现有素材：`/Users/a1234/Documents/Codex项目/wx-earth/2k_moon.jpg`（2048×1024）、`/Users/a1234/Documents/Codex项目/wx-earth/earth_day8k.webp`（8192×4096）、`/Users/a1234/Documents/Codex项目/wx-earth/earth.jpg`（5400×2700）、`/Users/a1234/Documents/Codex项目/wx-earth/earth_night.webp`。根目录有素材不等于当前主题已加载它，也不等于它被打入小程序包；沿 asset 注册与加载链路确认实际使用资源。

现有月球图的准确来源未确认，不要仅因文件名断言其来自 NASA。不能直接把颜色图的亮暗当作真实高度。

## 第一轮落地方案

1. **地球大气**：轻量球壳着色器，用视线与表面法线形成边缘亮度，用太阳方向约束日侧/夜侧亮度，控制内侧蓝色与外侧衰减。先做可控视觉近似，不引入完整多次散射或重型全屏后处理。
2. **云层**：复用现有独立云球，改进透明混合和受光；从云密度数据构建适度的凹凸光照，用偏移采样近似投到地表的云影。不要把数据图中的阴影重复烘焙进颜色。先解决厚实层次，再判断是否补更精细云图和局部细节。
3. **海洋**：增加与地表 UV 对齐的海陆/高光遮罩，让柔和太阳反光只出现在海洋。保留夜灯与昼夜过渡，调整曝光与高光，避免反光剪成白斑或陆地像塑料。
4. **月球**：使用 NASA CGI Moon Kit 的颜色和真实高程来源，离线派生适合球面 UV 的法线图或凹凸图。正确处理高程单位、球面比例、极区与接缝；法线图按线性数据读取。先使用凹凸光照，不增加大量顶点位移。它改善光照细节，不会自动产生真实坑壁遮挡或改变球体轮廓。
5. **统一观感**：核实颜色图、数据图、手写 shader 的颜色空间和曝光链路，防止重复 gamma 或 tone mapping。地球、云、大气和月球必须采用一致的太阳方向与适当的材质表现。

第一轮优先复用现有引擎，不升级 Three.js 大版本，不引入 React Three Fiber、WebGPU 或新的应用结构。具体模块组织以最小必要改动为准。

## 来源及使用方式

- [Three.js Journey：Earth shaders](https://threejs-journey.com/lessons/earth-shaders)：已查看官方公开页面。课程讲解昼夜、城市灯光、云、海洋反射、暮光与大气辉光的视觉近似；不是一键可安装的小程序插件。完整课程与工程资源需要相应访问权限，不绕过限制；可以自行实现公开描述的通用方法。课程引用 Solar System Scope 的 CC BY 4.0 贴图，使用相应素材时记录来源与署名。
- [NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/)：已查看官方页面。提供专用于 3D 渲染的颜色与高程数据；新版颜色图于 2025 年末制作，改善动态范围与极区。2K JPG 可直接用于初试；4K TIFF 等高精度原始文件应离线转换，不能把大 TIFF/EXR 直接作为小程序运行资产。高程 TIFF 有不同单位与参考半径，下载时记录具体版本。

资源准备可以在本地进行。正式资源拟延续云端下载与本地缓存；新纹理云上传、发布或部署需另有授权。本轮不把大素材塞入小程序主包。核对纹理分辨率、设备限制和解码后的 GPU 内存，压缩文件体积小不等于运行内存小。

## 第一轮交付与验收

- 使用真实待接入材质输出三组静态对照：地球近景、地球远景、月球近景。同一组保持相机、构图、光源位置和输出尺寸一致，标明材质/曝光等有意调整项。
- 对照应使用正式候选素材，不要用低清预览贴图代表最终效果。保存图片、可复现的渲染入口/参数及素材来源，交付可点击的本地文件。
- 静态样片可以由代理检查。但桌面/浏览器样片只证明该渲染环境下的效果，不能代替微信小程序的编译、云资源加载、设备兼容与性能验收。
- 用户已明确：类似视频的动画视觉验收由用户完成。不要为了重复观察飞行效果，主动启动开发者工具录屏、截图或逐帧分析。
- 用户认可静态方向后，再接入禅定/登月相关体验，并确认普通模式切换、moon lock、异步资源退出/重入、还原与释放正常。不要顺便改变普通模式的地图功能或遮挡层。
- 若修改 JS，运行所有 `/Users/a1234/Documents/Codex项目/wx-earth/tools/*.test.cjs`，例如：`for f in tools/*.test.cjs; do node "$f" || exit 1; done`，再运行 `git diff --check`。本次只写文档，未重跑 JS 测试。

## 必须保留的已确认效果与工作区

用户已表示飞行动画基本满意。详细历史以 `/Users/a1234/Documents/Codex项目/wx-earth/docs/HANDOFF-MOON-VOYAGE.md` 顶部当前章节为准，历史章节中的旧参数不得覆盖新参数。

- 旅行者号保持原入场，后段飞向左上，再从右上贴近头顶、大体积离场，带轻微自转；不要又变成远处缩小离场。
- 高达保持 C 固定飞姿、先前飞再左前方弧线、逐渐加速及流动短寿命蓝色喷流；旧版持续长彩带已被替代，不要恢复。
- 保留黄色机器人节奏、相遇间隔、38/78/113 秒主节点、原绕月轨道、太阳/远地球/最终画面及月球灯光交接的连续性。
- 保留进入/退出重入保护、资源生命周期校验、贴图方向修正和退出还原。视觉升级必要的光照改动可以做，但不能重现 113 秒稳定后突然变暗的问题。

本次写文档前工作区已有未提交变更：README、登月交接文档、旅行者号相遇代码及测试；还有未跟踪的概念图目录与其他文件。以新线程开始时的 `git status` 为准。保护用户已有修改，不重置、不清理、不格式化无关文件，不擅自提交、推送、上传或发布。

## 可复制到新线程的提示词

在 `/Users/a1234/Documents/Codex项目/wx-earth` 继续做地球与月球的视觉提升。请先读 AGENTS.md、README 和 `/Users/a1234/Documents/Codex项目/wx-earth/docs/HANDOFF-PLANET-VISUAL-UPGRADE-2026-10-08.md`，查看其中的概念参照图；登月已有动画状态参考 `/Users/a1234/Documents/Codex项目/wx-earth/docs/HANDOFF-MOON-VOYAGE.md` 顶部当前章节。

请直接开始第一轮本地试做：用能接入现有小程序引擎的实际材质代码，改善地球的薄蓝大气边缘、云层受光与层次、海洋柔和反光和夜侧，以及月球的真实地形凹凸与侧光。可以适度艺术化，目标是接近参照图的漂亮层次。参考 Three.js Journey 的公开渲染方法和 NASA CGI Moon Kit；复用现有引擎，不照搬整套教学工程，不升级大版本。

先交付地球近景、地球远景、月球近景三组同构图的现状/新版实际渲染对照，并保存可复现入口、参数和素材来源。请自己检查静态样片，确认改善清楚可见；不要用 AI 新概念图代替代码效果。我看过并确认方向后，再接回正式体验。普通方案细节自行决定，无需逐项询问。

现有飞行动画基本满意，不改旅行者号、高达、黄色机器人和主时间线；动态视觉由我验收，你不需要主动录屏或反复截图观察动画。保留月球灯光连续性、模式切换、异步加载与退出还原。保护工作区现有改动，大资源先在本地准备，正式云上传另行确认；不要擅自提交、推送、上传或发布。修改 JS 后跑项目全部 tools 测试，交付时区分静态渲染效果、代码检查和尚未进行的微信/真机验收。
