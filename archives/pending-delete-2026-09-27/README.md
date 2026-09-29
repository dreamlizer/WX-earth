# 待删除 · 2026-09-27

这里存放 2026-09-27 从运行包里清理出来、暂时保留以备反悔的文件。本目录在小程序 `miniprogramRoot` 之外，不进代码包，不影响上传体积。

## 为什么清理

微信小程序主包源码上限 2MB，本次上传被服务端拒绝：`source size 4473KB exceed max limit 2MB`（错误码 80051）。清理前主包源码约 4.47MB，其中：

- `miniprogram/assets/models/` 1013KB：9 月 9 日落地着陆段的离线模型产物（`lander.bin/png`、`eva00.bin/png`）。运行代码里已无任何引用，可由 `tools/model-build` 从 `source-models/` 重新生成。
- `miniprogram/assets/textures/moon_buttom.png` 16KB：代码只用云存储 fileID，包内副本无引用。
- 试航整套约 1.29MB：`moon-trial.js`、`moon-trial-scene.js` 及 `refined-moon.jpg`、`trial-moon.jpg`、`trial-earth.jpg`、`trial-companion.png`。该入口自 2026-09-22 起已不渲染，2026-09-27 用户确认整条实验不再需要。
- 试航的两个测试文件：`moon-trial.test.cjs`、`moon-trial-audio.test.cjs`。

## 如何恢复

按同一相对路径放回 `miniprogram/` 或 `tools/` 即可；也可以直接用 Git 取回：

```bash
git checkout a7ca266 -- miniprogram/assets/models miniprogram/assets/textures/refined-moon.jpg miniprogram/pages/gl/moon-trial.js
```

`a7ca266`（chore: checkpoint original moon review refinements）是清理前的最后一个提交，包含上述全部文件。

## 其他说明

- `tools/moon-review-server.cjs` 的本机构图检查仍从本目录读取 `refined-moon.jpg` 当月面贴图；删除本目录会让该检查页缺贴图。
- 早期落地试航的完整快照仍在 `archives/moon-trial-landing-2026-09-09/`。
