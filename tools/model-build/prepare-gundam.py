"""Pack the retained RX-78-2 source for a brief flyby; source GLB stays unchanged.
Positions/normals/atlas UVs use quantized buffers. No runtime compression decoder.
"""
import json, struct, hashlib, argparse
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[2]
args = argparse.ArgumentParser()
rest_source = root / 'source-models/rx78-2-anonmalyfound/rx78_refined.glb'
args.add_argument('--source', type=Path, default=root / 'source-models/rx78-flight-poses-2026-10-06/bank.glb')
args.add_argument('--review-output', type=Path, help='Write isolated review geometry and metadata instead of runtime assets')
opts = args.parse_args()
source = opts.source
blob = source.read_bytes()
length = struct.unpack_from('<I', blob, 12)[0]
doc = json.loads(blob[20:20 + length])
bin_start = 28 + length

def read(index):
    a = doc['accessors'][index]
    v = doc['bufferViews'][a['bufferView']]
    dtype = {5126: '<f4', 5123: '<u2', 5125: '<u4'}[a['componentType']]
    size = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
    return np.frombuffer(blob, dtype=dtype, count=a['count'] * size,
                         offset=bin_start + v.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(-1, size).copy()

# All source materials use the same baked atlas (TEXCOORD_1). Two indexed meshes
# keep 16-bit indices and avoid 18 separate draw calls during the passing shot.
groups = [[], []]
for node in doc['nodes']:
    if 'mesh' not in node:
        continue
    for p in doc['meshes'][node['mesh']]['primitives']:
        pos = read(p['attributes']['POSITION']) + np.array(node.get('translation', [0, 0, 0]))
        normal = read(p['attributes']['NORMAL'])
        uv = read(p['attributes']['TEXCOORD_1'])
        indices = read(p['indices']).reshape(-1)
        groups[0 if len(pos) > 50000 else 1].append((pos, normal, uv, indices))

out = opts.review_output or root / 'miniprogram/gundam-assets'
out.mkdir(parents=True, exist_ok=True)
chunks, meshes, offset = [], [], 0

def append(array):
    global offset
    pad = (-offset) % 4
    chunks.append(bytes(pad)); offset += pad
    at = offset
    data = array.tobytes(); chunks.append(data); offset += len(data)
    return at

all_pos = np.concatenate([p for group in groups for p, _, _, _ in group])
center = (all_pos.min(axis=0) + all_pos.max(axis=0)) / 2
preserve_anchor = source.resolve() != rest_source.resolve()
if preserve_anchor:
    pose_blob, pose_doc, pose_bin_start = blob, doc, bin_start
    blob = rest_source.read_bytes()
    rest_length = struct.unpack_from('<I', blob, 12)[0]
    doc = json.loads(blob[20:20 + rest_length]); bin_start = 28 + rest_length
    rest_points = np.concatenate([read(p['attributes']['POSITION']) + np.array(node.get('translation', [0, 0, 0]))
        for node in doc['nodes'] if 'mesh' in node for p in doc['meshes'][node['mesh']]['primitives']])
    center = (rest_points.min(axis=0) + rest_points.max(axis=0)) / 2
    blob, doc, bin_start = pose_blob, pose_doc, pose_bin_start
extent = float(np.abs(all_pos - center).max())
triangles = 0
for group in groups:
    positions, normals, uvs, indices, count = [], [], [], [], 0
    for p, n, uv, ix in group:
        positions.append(p); normals.append(n); uvs.append(uv); indices.append(ix.astype(np.uint32) + count); count += len(p)
    assert count < 65536
    p, n, uv, ix = map(np.concatenate, (positions, normals, uvs, indices))
    meshes.append(dict(count=count, indexCount=len(ix),
        position=append(np.round((p - center) / extent * 32767).astype('<i2')),
        normal=append(np.round(np.clip(n, -1, 1) * 127).astype('i1')),
        uv=append(np.round(np.clip(uv, 0, 1) * 65535).astype('<u2')),
        index=append(ix.astype('<u2'))))
    triangles += len(ix) // 3
(out / 'geometry.bin').write_bytes(b''.join(chunks))
metadata = out if opts.review_output else root / 'miniprogram/assets/models/gundam'
metadata.mkdir(parents=True, exist_ok=True)
# Keep the same body origin and scale across baked poses; their bent knees
# must not cause the model to grow to compensate for a shorter bounding box.
if preserve_anchor:
    height = float(rest_points[:,1].max()-rest_points[:,1].min())
else:
    height = float(all_pos[:,1].max()-all_pos[:,1].min())
(metadata / 'model.js').write_text('module.exports = ' + json.dumps(dict(meshes=meshes, extent=extent, height=height), separators=(',', ':')) + ';\n')
image = doc['images'][0]; view = doc['bufferViews'][image['bufferView']]
from io import BytesIO
texture = Image.open(BytesIO(blob[bin_start + view.get('byteOffset', 0):bin_start + view.get('byteOffset', 0) + view['byteLength']])).convert('RGB')
texture.thumbnail((512, 512), Image.Resampling.LANCZOS)
texture.save(out / 'basecolor.jpg', quality=88, optimize=True)
pose_name = source.stem if source.parent.name == 'rx78-flight-poses-2026-10-06' else 'source'
report = dict(source_sha256=hashlib.sha256(blob).hexdigest(), source=str(source.resolve().relative_to(root)), pose=pose_name, triangles=triangles, drawCalls=2,
              geometryBytes=(out/'geometry.bin').stat().st_size, textureBytes=(out/'basecolor.jpg').stat().st_size,
              staticPose=True, positionMaxError=extent/32767/2, atlasTexCoord=1)
(out / 'build-report.json').write_text(json.dumps(report, indent=2) + '\n')
for name, content in {'ready.js':'module.exports = true;\n', 'index.js':'Page({});\n', 'index.json':'{}\n', 'index.wxml':'<view></view>\n', 'index.wxss':''}.items():
    (out / name).write_text(content)
(out / 'AUTHOR.md').write_text('RX-78-2 Gundam — AnonmalyFound / BlendKit\n\nSource: https://www.blendkit.com/asset-gallery-detail/a6a1000b-3b72-48bb-be81-6f4ab36fabda/\nRetained source and provenance: source-models/rx78-2-anonmalyfound/SOURCE.md\nUploader license: CC0. Character/IP rights are separate.\nLocal derivative: quantized geometry, 512px baked color atlas, shared approximate metal/rough material. Static baked pose: '+pose_name+'. No runtime rig or joint animation added.\nPose source: '+report['source']+'\n')
print(json.dumps(report))
