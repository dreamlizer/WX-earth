# 主包上传超限修复 · 2026-10-23

用户失败提示是 `main package source size 2193KB exceed max limit 2048KB`，不是单纯网络不可达。本轮本地修复已完成，实际重试上传被自动审批拦截，尚不能声称服务端上传已通过。

## 修改范围

只修改 `project.config.json` 的 `packOptions.ignore`。

- 原规则带多余的 `miniprogram/` 前缀。按小程序源码目录修正路径，让原本要排除的三个未使用国家 JSON、Troika 文本副本、GeoJSON 源文件与重复 npm 路径正确匹配。
- 增加两个明确文件排除项：`pages/gl/tz-lookup.js`、`assets/models/paper-airplane.json`。开发者工具将它们列为无依赖文件；全文引用核对也无运行引用。实际入口使用的是 `libs/tz-lookup.js`，国家功能继续使用 `country_data.js` 和 `countries.json.js`，均保留打包。
- 磁盘文件全部保留，未移动、删除、压缩或重新编码素材；没有改 JS、页面、分包、音乐、镜头、云资源或其他歌曲。

原配置在 `before/project.config.json`，本轮补丁在 `project-config.patch`。

## 验证

- 开发者工具实际刷新后的依赖分析：主包源文件分析从 **2.50MB → 2.31MB**，总分析文件从 **334 → 329**。这是本地依赖源文件统计，不等于服务端编译后的 `source size`，不要把 2.31MB 直接与上传 2048KB 对比。
- 规则新增匹配的磁盘源文件共 1,062,953 bytes，含未必计入原上传包的原始 GeoJSON/文本文件；这个数字不作为“上传包减少量”。见 `pack-audit.json`。
- 保留源文件的相对 import/require 扫描没有引用任何本轮排除文件；实际页面编译错误数 0，普通地球正常显示。
- **49/49** 个 `tools/*.test.cjs` 通过；`git diff --check -- project.config.json` 通过。
- 本轮排除的 7 份磁盘原文件哈希不变；旧预览 108/108 份文件哈希不变。

## 上传停留状态

应用：wx-earth / 行星物语，AppID `wx6f41ba1a7d7bc51e`，当前线上版本显示 2.0。

修订版填写为 **2.0.1**，备注为“修复主包上传超限：纠正打包排除路径，保留登月、原音乐和结尾照片效果。”开发者工具已提示重新上传会覆盖当前体验版。

自动审批拒绝实际提交上传，理由是此前用户明确要求“先不要上传发布”，当前“上传失败处理”尚未被判为明确撤销该限制。没有换用 CLI 或预览等方式绕过。当前窗口保留在上传确认页，截图见 `upload-awaiting-approval.jpg`。

剩余验证：取得明确允许覆盖体验版后，用已准备版本执行上传并检查服务端结果；本轮没有提交审核或发布上线。
