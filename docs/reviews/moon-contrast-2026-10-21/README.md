# 月球明暗与结尾地球校准

2026-10-21。按用户要求先修小程序月球明暗，再按实际地球朝向、倾斜与右侧来光制作独立预览。

## 结论与正式改动

当前实际运行材质已经没有历史`LinearTosRGB`输出补亮，所以本次没有重复套用旧诊断。相同相机、月球姿态和灯光下，关法线后暗侧坑壁亮点消失；保留法线时，扰动后的局部法线能把球面暗侧坑壁重新照亮，同时0.07环境光托起背光面。

本次仅在`miniprogram/pages/gl/moon-voyage-scene-setup.js`的月球材质加入整体球面昼夜约束：使用r108在法线扰动前保存的`geometryNormal`，以与太阳方向点积控制平滑明暗边界；保留normalScale=1的坑壁细节，收低月球暗侧间接光。保留已有颜色图、粗糙度、主光、全局曝光及原生颜色输出，不修改其他对象的材质。`moon-voyage-scene-setup.before.js`保存本轮前的源文件，包含当时已有未提交修改，不能用Git HEAD差异全算成本次工作。

`tools/planet-visual.test.cjs`只更新相应shader合同断言；原有纹理、生命周期与地球合同保留。全部41个`tools/*.test.cjs`通过，源码语法与`git diff --check`通过，日志`project-tests.log`。

## 实际检查证据

微信开发者工具Stable 2.02.2608070、基础库3.16.1，实际WebGL画布780×1408。通过画布下一帧`gl.readPixels`采集RGBA并翻转Y转换PNG；普通canvasToTempFilePath无法保存该WebGL缓冲，因此不把黑图当证据。

- `moon-audit-normal-on.png`：154秒，原始法线与补光。
- `moon-audit-normal-off.png`：同机位临时关闭法线，用于定位。
- `moon-audit-persisted.png`：重新编译后实际源代码修复，法线保留；相机与月球姿态固定至相同基准。
- `contrast-comparison.png`：三者同区域裁切并列。
- `moon-audit-154.json`：相机、月球姿态、光向、ambient=0.07、direct=1.5。
- `analyze-contrast.py` / `contrast-metrics.json`：按球面可见点与太阳点积划分暗面（dot<-0.06）和亮面（dot>0.2），统计8bit亮度。暗面均值由6.83降到0，暗侧亮度>20的比例由5.20%降到0；亮面均值83.12→81.04，主要保留亮面层次。这是该帧的图像统计，不代表整曲主观验收。

重新普通编译后检查材质回调实际存在、画布GL错误为0。检查登月进入、退出后普通地球恢复、国家点选可用，禅定可进入并播放诗句，再退出；最终moon/zen为false、moon lock释放。没有将浏览器结果作为小程序真实渲染证据，也未做真机验收。

## 地球校准

`earth-reference-255.json/.png`来自正常初始化后的正式小程序255秒。地球半径1.156503，Lambert材质；实际相机坐标中的光向X=+0.955552，地球中心视图坐标X=+0.924339，来自右上方。保留其海陆朝向、地轴倾斜、云透明度与自转速度。

独立新目录：`source-models/moon-terrain-trial/descent-to-earth-193-rightlight/`，本机8968。旧8967目录及所有样段保留。新预览把地球姿态与光向一起变换到新终景，未把整图水平翻转；同一固定太阳照射地球和地形。详见新目录README、校准脚本、实帧联系图与验证数据。

本轮没有接入地形镜头到小程序，没有上传、发布或改动其他歌曲。
