# poetrySets 云函数

`poetrySets` 提供诗句预设的读取和更新能力，使用云数据库集合 `poetry_sets`。

## 接口

- `type: "list"`：读取最多 100 条诗句预设。
- `type: "upsert"`：按 `preset` 写入或更新预设。

写入格式：

```js
{
  type: "upsert",
  preset: 1,
  lines: [
    { text: "海上生明月", duration: 7000 }
  ]
}
```

## 部署

在微信开发者工具中右键该云函数目录，选择“上传并部署（云端安装依赖）”。

也可以用 CloudBase CLI：

```bash
tcb functions:deploy poetrySets -e cloud1-1g6316vt2769d82c -p ./cloudfunctions/poetrySets --force
```

小程序端会优先尝试云函数和数据库；不可用时回退到本地诗句数据。
