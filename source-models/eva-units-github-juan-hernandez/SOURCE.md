# EVA Unit-00 / 01 / 02（公开 GitHub GLB）

Sketchfab 官方 Download API 需要登录。后来在公开仓库里找到同一批模型的直链，已免登录下载。

- 镜像仓库：[Juan-Hernandez-11/Evangelion](https://github.com/Juan-Hernandez-11/Evangelion/tree/main/models)
- 原始作者：Tigerar1 / `allanromanreyes`（写在 GLB `asset.extras` 里）
- 原始页面：
  - Unit-00：https://sketchfab.com/3d-models/evangelion-unit-00-abe48f0c88914d66b7a5c916704767b3
  - Unit-01：https://sketchfab.com/3d-models/evangelion-unit-01-9fddeb0a7143436598c805dab2f147bf
  - Unit-02：https://sketchfab.com/3d-models/evangelion-unit-02-a8731145a84f4e63b0fbc51f4f5948da
- 授权（GLB 内记录）：CC BY-SA 4.0，需署名作者；修改版需保持相同协议
- 下载时间：2026-09-09

## 本地文件

| 文件 | 大小 | 三角面 | 顶点 | 骨骼/动画 |
| --- | ---: | ---: | ---: | --- |
| `eva00.glb` | 294,804 B | 3,692 | 3,188 | 无 |
| `eva01.glb` | 296,428 B | 4,226 | 3,907 | 无 |
| `eva02.glb` | 293,368 B | 3,952 | 3,470 | 无 |

`previews/` 是从 GLB 里抽出的贴图，用来确认颜色：黄 / 紫 / 红。

## 使用限制

- 这是低模静态网格，没有骨骼，不能直接走路或转头。
- 文件协议是 CC BY-SA，但 Evangelion 角色 IP 本身不是开源。小程序上线前仍需单独判断版权风险。
- 当前小程序运行链路还没有 GLB 加载器，这些文件还不会自动出现在登月动画里。
