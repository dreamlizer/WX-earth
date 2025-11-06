本目录的云函数已暂时禁用（仅保留目录占位）。

原因：当前改用本地数据，避免云端上传失败影响开发。

如需恢复：
1) 新建或恢复 `index.js`、`package.json`、`config.json`；
2) 在微信开发者工具选择“上传并部署（云端安装依赖）”；
3) 或用 CloudBase CLI 部署：
   tcb functions:deploy poetrySetsV2 -e cloud1-1g6316vt2769d82c -p ./cloudfunctions/poetrySetsV2 --force

注意：函数名为 `poetrySetsV2`，数据库集合 `poetry_sets`。