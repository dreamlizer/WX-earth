"""Extract NASA GLB buffers without changing geometry; resize embedded textures for mobile."""
import json,struct,io,hashlib
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[2];src=root/'source-models/voyager-nasa/Voyager.glb';b=src.read_bytes();n=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+n]);binary=b[28+n:];out=root/'miniprogram/voyager-assets';out.mkdir(exist_ok=True)
packed=bytearray();attrs=[]
for a in d['accessors']:
 assert not a.get('sparse')
 v=d['bufferViews'][a['bufferView']];count=a['count'];size={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];unit={5123:2,5126:4}[a['componentType']];width=size*unit;stride=v.get('byteStride',width);start=v.get('byteOffset',0)+a.get('byteOffset',0)
 while len(packed)%4:packed.append(0)
 offset=len(packed)
 for i in range(count):packed.extend(binary[start+i*stride:start+i*stride+width])
 attrs.append(dict(offset=offset,count=count,size=size,type=a['componentType']))
(out/'geometry.bin').write_bytes(packed)
images=[]
for i,im in enumerate(d['images']):
 v=d['bufferViews'][im['bufferView']];raw=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];image=Image.open(io.BytesIO(raw));image.thumbnail((512,512),Image.Resampling.LANCZOS);name=f'texture-{i}.png';image.save(out/name,optimize=True);images.append(name)
meta={k:d[k] for k in ['nodes','meshes','materials','textures','scenes']};meta.update(accessors=attrs,images=images,scene=d.get('scene',0));(root/'miniprogram/assets/models/voyager/model.js').write_text('module.exports='+json.dumps(meta,separators=(',',':'))+';\n')
report={'sourceSha256':hashlib.sha256(b).hexdigest(),'geometryBytes':len(packed),'totalBytes':sum(p.stat().st_size for p in out.iterdir()),'textureMax':512,'triangles':20390};(root/'source-models/voyager-nasa/mobile-inspection.json').write_text(json.dumps(report,indent=2)+'\n');print(report)
