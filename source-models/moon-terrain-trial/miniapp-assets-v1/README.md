# 小程序月面尾段资源 v1

构建输入为已确认 `crew-grounded-motion` 的跨目录原素材，原文件不变。

- 媒体10项，共9093615字节（8.67 MiB）；版本 `ae1950a881d16a6a`。
- `manifest.json` 记录输入SHA-256、输出SHA-256/MD5、尺寸与编码参数。
- `cloud-upload/terrain-crew-v1/ae1950a881d16a6a/` 是本次上传所用的本地媒体副本。
- 云端已上传同名版本目录；正式fileID在小程序 `moon-terrain-manifest.js`，不覆盖原素材。

本地重建：`python3 tools/model-build/prepare-moon-terrain.py`。此命令不执行上传，不更改旧预览。Three.js r108适配源码已直接保存在 `miniprogram/pages/gl/moon-terrain-*.js`。

实际接入、验证证据与限制见 `docs/reviews/moon-terrain-integration-2026-10-21/README.md`。
