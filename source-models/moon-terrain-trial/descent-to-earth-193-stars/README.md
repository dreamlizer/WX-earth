# 193秒至曲终 · 保留原有星空

2026-10-21。本轮补回独立预览遗漏的星空。新预览：<http://127.0.0.1:8969/>。旧8968右侧光版及所有源文件、输出均保留，指纹记录于`preserved-rightlight.json`。其他歌曲、小程序正式实现未改动。

```bash
node source-models/moon-terrain-trial/descent-to-earth-193-stars/server.cjs
```

项目根目录执行，服务仅监听127.0.0.1。支持播放、暂停、重播、原曲时间滑条、B帧与静音。复用同一原音乐193–271.726667秒（78.726667秒），地球实际海陆朝向、倾斜、右上来光和全部镜头节点沿用8968版。

## 星空来源与连接

`shared-starfield/starfield.glsl.js`、`label-constants.js`是小程序当前同名模块的逐字快照；不重造星点样式。使用原16000点分层分布、星色、尖锐核心、微光晕与点级/呼吸式闪烁。参数沿用普通模式：opacity0.54、sizeScale1.7、brightnessGain2、breathSpeed0.6、breathStrength0.25。星点初始分布由原函数随机生成，不宣称与某次小程序截图的单颗星位置完全一致。

场景比例不同，将星层半径与点尺寸同步放大300倍，星层保持在月球与地球后方；同原轨道坐标变换一起固定世界朝向，仅跟随相机平移，避免下降产生近处粒子飞掠感。深度测试开启、深度写入关闭，星星由月球、地形和地球自然遮挡。闪烁时间直接使用原曲绝对时间，暂停/拖动不会独立继续闪动或累计漂移。星空从193秒贯穿到音乐结束，末帧也保留。

## 文件与复用依赖

`scene.js`增加原星空模块的创建、空间比例和时钟连接；`viewer.js`额外记录每张关键帧顶部240行的星点像素，便于检查全程存在。其余地形/地球/相机逻辑保持右侧光版。

共享：`../preview/assets/`、`../airborne-comparison/assets/normal-object.jpg`、公共Three/GLTFLoader；月球图映射已有实验目录`moon.jpg`；地球/云图映射正式`preview-day.jpg`、`preview-cloud.png`；音频复用`../descent-to-earth-193/assets/moon-tail-193.wav`。详细地球校准、轨迹与来源见`../descent-to-earth-193-rightlight/README.md`。不能只复制HTML或用file://打开。

## 检查与输出

- `output/contact-sheet.png`、12张`frame-*.png`：星空版真实WebGL实帧，检查远景、B构图及终景。
- `output/validation.json`：全轨迹60Hz采样、星空参数、各帧星点像素、地球姿态误差、播放与WebGL状态。
- `output/star-occlusion.json`：与未加星空的旧版相同时间逐像素比较，月球/地形/地球亮面区域99.94%以上像素保持在1灰阶误差内，差异集中在轮廓抗锯齿边缘；结合实帧检查星点没有盖到月面或地球上。
- `output/project-tests.log`：41项项目测试全部通过；JS语法与`git diff --check`通过。
- `output/verification-summary.json`：最终完整原速播放、原生音频结束、星空全段存在及旧版保留核验。

这是浏览器独立候选预览，不是微信真机验收；未接入地形镜头，未上传发布。
