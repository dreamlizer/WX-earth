"""Decode NASA Chandra offline, then pack geometry and local 512px color maps.
Run with system Python (Pillow), using the installed Blender's Draco decoder.
"""
import argparse, hashlib, json, struct, subprocess, tempfile
from io import BytesIO
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=root / 'miniprogram/chandra-assets')
parser.add_argument('--blender', default='/Applications/Blender.app/Contents/MacOS/Blender')
parser.add_argument('--source', type=Path, default=root / 'source-models/chandra-x-ray-observatory-nasa/Chandra X-ray Observatory.glb')
args = parser.parse_args()
source = args.source.resolve()
out = args.output
out.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='wx-earth-chandra-build-') as temp:
    decoded = Path(temp) / 'decoded.glb'
    expression = ('import bpy; bpy.ops.wm.read_factory_settings(use_empty=True); '
                  f'bpy.ops.import_scene.gltf(filepath={str(source)!r}); '
                  f'bpy.ops.export_scene.gltf(filepath={str(decoded)!r},export_format="GLB",'
                  'export_draco_mesh_compression_enable=False,export_animations=False)')
    subprocess.run([args.blender, '-b', '-t', '2', '--python-expr', expression], check=True)
    blob = decoded.read_bytes()
length = struct.unpack_from('<I', blob, 12)[0]
doc = json.loads(blob[20:20 + length])
bin_start = 28 + length
chunks, accessors, offset = [], [], 0
for a in doc['accessors']:
    view = doc['bufferViews'][a['bufferView']]
    assert not view.get('byteStride') and not a.get('sparse')
    size = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    width = {5126: 4, 5123: 2, 5125: 4}[a['componentType']]
    pad = (-offset) % 4
    chunks.append(bytes(pad)); offset += pad
    start = bin_start + view.get('byteOffset', 0) + a.get('byteOffset', 0)
    data = blob[start:start + a['count'] * size * width]
    accessors.append(dict(offset=offset, count=a['count'], size=size, type=a['componentType']))
    chunks.append(data); offset += len(data)
(out / 'geometry.bin').write_bytes(b''.join(chunks))
images = []
# Keep only color maps: the small ambient hull uses the existing Phong lights.
used_images = {doc['textures'][m['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
               for m in doc['materials'] if m.get('pbrMetallicRoughness', {}).get('baseColorTexture')}
image_indices = {}
for i, image in enumerate(doc.get('images', [])):
    if i not in used_images: continue
    view = doc['bufferViews'][image['bufferView']]
    start = bin_start + view.get('byteOffset', 0)
    img = Image.open(BytesIO(blob[start:start + view['byteLength']])).convert('RGB')
    img.thumbnail((512, 512), Image.Resampling.LANCZOS)
    name = f'color-{i}.jpg'
    img.save(out / name, quality=88, optimize=True)
    image_indices[i] = len(images)
    images.append(name)
for texture in doc.get('textures', []):
    texture['source'] = image_indices.get(texture.get('source'), 0)
metadata = dict(accessors=accessors, nodes=doc['nodes'], meshes=doc['meshes'],
                materials=doc['materials'], textures=doc.get('textures', []), images=images)
(out / 'model.js').write_text('module.exports = ' + json.dumps(metadata, separators=(',', ':')) + ';\n')
for name, content in {'ready.js':"module.exports = require('./model.js');\n", 'index.js':'Page({});\n',
                      'index.json':'{}\n', 'index.wxml':'<view></view>\n', 'index.wxss':''}.items():
    (out / name).write_text(content)
(out / 'AUTHOR.md').write_text(source.stem + ' — NASA\n\n'
    'Retained source, original URL and NASA usage notes: ' + str(source.parent.relative_to(root)) + '/SOURCE.md\n'
    'Local derivative: offline Draco decode; original mesh/UVs retained; color maps resized to 512px JPEG. '
    'No runtime decoder, remote resource, rig, or extra global light.\n')
report = dict(sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives']),
    drawCalls=sum(len(m['primitives']) for m in doc['meshes']), textureMax=512,
    geometryBytes=(out/'geometry.bin').stat().st_size,
    files={p.name:dict(bytes=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in out.iterdir() if p.is_file() and p.name!='build-report.json'})
(out / 'build-report.json').write_text(json.dumps(report, indent=2) + '\n')
assert sum(p.stat().st_size for p in out.iterdir() if p.is_file()) < 2 * 1024 * 1024
print(json.dumps(report, indent=2))
