# 土星模型素材与复用记录

2026-10-11 云涡 / 冰环版：新生成的艺术云层图用于观测、电影、逆光版本，原版保持原图。新增「冰环近景」，局部合并冰块网格随相机接近显现，保留径向远景环。来源、生成提示词、尺寸和科学边界见 `CLOUDS-V1.md`；本轮实际验证见 `docs/reviews/saturn-ice-2026-10-11/README.md`。下面的旧版资产记录保留作为历史。

2026-10-11 增加四版对照：原版保持；观测 / 电影 / 逆光新增 Björn Jónsson 五组环剖面数据及 I,Voyager 薄层反射、透射公式的 WebGL 1 适配。原始数据在 `bjoern-rings/`，开源原 shader 和 Apache 2 许可在 `ivoyager/`。运行分包保留 NOTICE 和完整许可。

新增数据来源：`https://bjj.mmedia.is/data/s_rings/`，作者允许使用地图、要求署名：`https://bjj.mmedia.is/acknow.html`。使用的是数据，不是其受版权保护的渲染图。获取时间 2026-10-11。

重复转换：`python3 tools/model-build/prepare-saturn-profiles.py`。实现和验证边界见 `docs/reviews/saturn-variants-2026-10-11/README.md`。这三个版本复用同一数据/公式，以布光和曝光区分视觉方向；球面仍为原有色图，不是导入三套完整引擎。

日期：2026-10-08。用于主页左下角「土星预览」，不是太阳系全功能模式。

## 复用来源

- [Solar System Scope 行星贴图](https://www.solarsystemscope.com/textures/)，作者 INOVE，许可 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。贴图来源包含 NASA/Cassini 影像并有颜色调整；它是全球颜色图，不是实时云层数据。
- 该站直接下载在本环境返回验证 HTML，因此从 [Shriisoot/Planets-texture](https://github.com/Shriisoot/Planets-texture) 获取同名贴图。具体镜像地址：`https://raw.githubusercontent.com/Shriisoot/Planets-texture/main/8k_saturn.jpg`、`https://raw.githubusercontent.com/Shriisoot/Planets-texture/main/8k_saturn_ring_alpha.png`。按实际解码尺寸记录，不把文件名当作分辨率证据。
- [Spacekit](https://github.com/typpo/spacekit)，MIT，Copyright (c) 2019 Ian Webster。读取其 SphereObject.addRings、sphere/ring shaders 和土星示例。原始 shaders 保存在 `spacekit-shaders.ts`，完整许可保存在 `SPACEKIT-LICENSE`，运行 shader 也包含许可正文。
- 评估时官方仓库展示 583 stars、47 forks、528 次提交，作为使用积累的辅助信号，不等于微信端兼容或画质验证。小型 stiutin 示例的星环使用不受光的 MeshBasicMaterial，故本次选择 Spacekit 的受光/投影方法。

## 实际资产与处理

| 文件 | 实际尺寸 | 运行处理 |
| --- | --- | --- |
| `8k_saturn.jpg` | 4096×2048 RGB | 保持尺寸，以 JPEG quality 91 保存为分包中的 saturn.jpg，约 481 KiB |
| `8k_saturn_ring_alpha.png` | 8192×500 RGBA | 截取中心一行并用 Lanczos 缩为 2048×1 径向颜色/透明度带，约 6.5 KiB |

运行资产位于 `miniprogram/saturn-assets/`，点击后以微信异步 require 加载，普通地球启动不加载这些纹理。颜色图使用 JPEG、星环使用 PNG；没有 AI 生成贴图，也没有增加运行依赖或升级 Three.js。

离线重复处理：`python3 tools/model-build/prepare-saturn-textures.py`，需要 Pillow。原始素材及 Spacekit 来源文件的摘要记录在 `MANIFEST.sha256`。

土星是现有 Three.js 的球体网格，压扁到极半径比 0.902；星环是双面圆环网格。改编 Spacekit 的径向采样和球体投影方法：统一行星局部坐标、支持扁球体投影、添加星环投向行星的透明度阴影、柔化边缘并调整颜色响应。这里是可控的视觉近似，不是完整粒子散射或科学模拟。

## 预览边界

独立场景、独立相机共享现有渲染器与循环；不修改地球、禅定和登月材质/灯光。拖动移动观察相机，双指缩放；云带缓慢转动用于观察，不代表实时速度。三个镜头预设只服务模型评审，不代表已实现的太空航线。退出、加载失败和卸载释放网格、材质及纹理；异步代次阻止关闭后的资源回调写入新预览。
