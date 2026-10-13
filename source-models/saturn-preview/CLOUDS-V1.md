# 土星云涡贴图 v1

2026-10-11 使用内置 image_gen（imagegen skill，非 CLI/API）生成艺术云层展开图。用户授权增强云层细节和近景观感；这不是卡西尼观测数据或科学重建。未修改原有 Solar System Scope 贴图，预览的「原版」仍使用原图，其余版本使用新图。

- 保留生成原图：`saturn-clouds-v1.png`，1774×887。
- 分包运行图：`miniprogram/saturn-assets/saturn-clouds-v1.jpg`，2048×1024 RGB，JPEG quality 93，353596 bytes。为现有 WebGL 1 使用二次幂尺寸，放大不增加原始细节。
- 运行时柔化经度接缝，云带使用缓慢的纬度相关漂移；方向光、暗面、星环阴影由 shader 计算。
- 冰块来自现有 Three.js 二十面体几何体，合并为一个网格，大小与厚度作艺术增强。未复制 SpaceEngine 代码，未引入新的运行依赖。

## 完整生成提示词

Use case: scientific-educational / game texture. Generate a production 3D albedo texture for a cinematic Saturn gas giant, flat rectangular 2:1 equirectangular global UV map, ideally 4096x2048. This is NOT an image of a sphere or a scene: the entire rectangle is covered edge to edge with Saturn atmospheric cloud bands. Latitude bands run horizontally continuously from left edge to right edge and must tile seamlessly across the left/right seam. Detailed softly turbulent cream, pale ochre, muted taupe, warm ivory and slightly slate-gray cloud belts, sinuous wavy interfaces, fine filamentary eddies and small irregular vortices integrated into the horizontal bands. Convincing fluid clouds with multiscale organic structure and fine softly feathered wisps, premium realistic planetary texture rather than perfectly straight gradient stripes. Enhanced cloud contrast for artistic immersion yet recognizably Saturn, substantially gentler than Jupiter; no giant Jupiter red spot. Equatorial latitudes slightly warm creamy beige, high latitudes muted gray-ochre, gently uniform horizontally near top and bottom poles to reduce spherical pinching. Uniform diffuse unlit ALBEDO only: no directional lighting, no specular highlights, no cast shadows, no dark night hemisphere, no rim or curved horizon. Absolutely no rings, no stars, no space background, no rocks, no terrain, no craters, no text, no grid, no border or watermark. Deliver one flat wide map with 2:1 aspect ratio.
