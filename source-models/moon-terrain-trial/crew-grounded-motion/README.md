# 三人同望 · 精修人物完整动态预览

预览：http://127.0.0.1:8977/moon-terrain-trial/crew-grounded-motion/index.html

把已确认 `crew-grounded-frame` 的人物接地、坐压、撑手/屈膝姿态、人物材质、接触阴影和9粒坑缘碎屑，放回193秒至271.7266666667秒的原音乐与连续镜头。全长78.7266667秒。

## 保持内容

- 相机路径、整体人物缩放、座位排列、原音乐、地球朝向/倾斜、右侧太阳光、原项目星空、已确认高清月面均保持。
- `characters.js` / `grounding.js` / `near-detail.js` 与已确认静帧源码一致；构建精修人物后，位置与支撑点不随相机移动。没有新增人物动画或按时间切换坐姿。
- 窗口完整保留9:16构图和播放控件。
- 所有旧目录、素材、8975完整高清旧人物版和8976精修静帧版均保留，SHA-256检查见 `output/checks.json`。

## 操作

播放/暂停、193秒重播、时间滑条；「近景起点」从228秒播放，「结束帧」看最后构图。

「旧人物对照」在当前时间关闭/恢复人物精修，保持高清月面，镜头和音乐不跳转。

展开说明可保存12张关键帧、联系图和播放/几何检查数据。`output/contact-sheet.png` 是实际渲染联系图。

## 验证

实际从193秒以原音乐正常速度连续播放至自然结束，复看靠近时的撑手、臀部、脚部、坑缘遮挡和右侧接触阴影；检查近景纹理和镜头前行。数值报告按精修后的三个角色检查可见性，不把细碎石组当成人物。

`output/full-playback.json` / `validation.json` 记录音频时间、播放帧、等待、页面/WebGL错误、相机连续性、人物先于地球的显露时间，以及人物固定支撑点和实际网格采样。人物可辨时地形LOD已为1，渲染地形与支撑点使用的原网格一致。接触验证为局部采样，不等同全身体积碰撞求解。

最终验证：连续原速播放4730帧，0次音频等待，页面/WebGL错误均为0；本机最大帧间隔25.8ms（非手机性能结论）。三人从233.5秒可辨，地球从238.9秒开始进入画面。末帧第640–959行的月面和人物像素与已确认精修静帧完全一致。123个旧文件SHA-256保持。

`verify-delivery.py` 验证完整播放、原镜头/比例/音乐、精修角色源码与支撑数据、末帧和已确认静帧的地面/人物像素一致，以及旧文件保留。项目全部41个 `tools/*.test.cjs` 日志见 `output/project-tests.txt`。

本轮仍是独立浏览器预览；没有压缩新资源、接入小程序、上传云端或发布，也没有进行微信模拟器/真机性能验收。

## 资源与复现

双击本目录 `启动完整预览.command` 可启动并打开预览。服务由 macOS 后台托管，不依赖 Codex 终端会话；重启电脑或注销后需再次双击。命令行可加 `--no-open` 仅恢复服务。

跨目录复用 `../ending-detail-frame/assets/` 高清局部与月壤材质、`../crew-rim-balance/assets/` 原三人GLB供对照及原星空源码、`../preview/assets/` 地形和PBR、`../airborne-comparison/assets/` 修正法线、`../descent-to-earth-193/assets/moon-tail-193.wav` 原音乐片尾、既有Three.js/GLTFLoader vendor及项目地球/月球/云贴图。未新增大纹理。

```bash
node source-models/moon-terrain-trial/crew-grounded-motion/server.cjs
```

完整播放至自然结束后，在页面展开说明、保存关键帧与检查数据，再运行：

```bash
python3 source-models/moon-terrain-trial/crew-grounded-motion/verify-delivery.py
```
