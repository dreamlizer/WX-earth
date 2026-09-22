# 试航静态模型离线构建

只处理 `source-models` 中 Apollo 和 EVA-00 的副本；不修改原 GLB。
运行时没有 glTF Transform、Draco 或 Python 依赖。

```sh
mkdir -p /private/tmp/wx-earth-model-build
cp tools/model-build/package*.json /private/tmp/wx-earth-model-build/
npm ci --prefix /private/tmp/wx-earth-model-build
node tools/model-build/convert.mjs /private/tmp/wx-earth-model-build
python3 tools/model-build/pack.py /private/tmp/wx-earth-model-build
```

Python 需要 NumPy、Pillow。转换使用 glTF Transform 4.2.1 和 Meshoptimizer 0.23.0。
官方工具说明：https://gltf-transform.dev/cli

1. 去除源文件单关键帧占位动画；离线解码 Draco，展开节点变换、合并、焊接。
2. Apollo 简化比例 0.18、误差 0.01；实际保留 28,530 三角面。EVA-00 保留 3,692 面。
3. 仅保留漫反射颜色、法线、UV；PNG 图集合并基础颜色贴图，最多四格，边缘填充。
4. 脚底归零、XZ 居中，Apollo 高 2.25，角色高 1.65（艺术比例）。
5. MV01 小端二进制：12 字节 magic/顶点数/索引数，然后 float32 position、snorm8 normal、对齐4、unorm16 uv、unorm8 color、对齐4、uint16 index。

每个模型一个 MeshLambertMaterial 和一个索引网格；源 PBR 高光未保留。
这是静态试航资产，后续骨骼版应从保留的 GLB/原始模型处理，不能把此扁平二进制当作骨骼源文件。
