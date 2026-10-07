"""Package the attributed Mech Drone, preserving skin/animation and reducing textures."""
import hashlib,json,struct
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[2]
src=root/'source-models/mech-encounter-candidates/mech-drone'
out=root/'miniprogram/robot-assets';out.mkdir(exist_ok=True)
d=json.loads((src/'scene.gltf').read_text())
binary=(src/'scene.bin').read_bytes()
assert len(binary)==d['buffers'][0]['byteLength']
d['buffers'][0].pop('uri')
for i,item in enumerate(d['images']):
    image=Image.open(src/item['uri']);image.thumbnail((512,512),Image.Resampling.LANCZOS)
    ext='png' if image.mode=='RGBA' or item['uri'].endswith('.png') else 'jpg'
    name=f'texture-{i}.{ext}'
    if ext=='png':image.save(out/name,optimize=True)
    else:image.convert('RGB').save(out/name,quality=85,optimize=True)
    item['uri']=name
j=json.dumps(d,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
binary+=b'\0'*((-len(binary))%4)
(out/'robot.glb').write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary)
(out/'AUTHOR.txt').write_text('Mech Drone — Willy Decarpentrie (skudgee)\nhttps://sketchfab.com/3d-models/mech-drone-8d06874aac5246c59edb4adbe3606e0e\nCC BY 4.0 — https://creativecommons.org/licenses/by/4.0/\nSource: https://github.com/jgbarah/aframe-playground/tree/master/assets/3d/mech_drone\nModified: repackaged as GLB; textures resized to 512px; flight pose and animation selection adapted.\n')
(out/'LICENSE.txt').write_bytes((src/'LICENSE').read_bytes())
report={'triangles':9251,'joints':14,'textureMax':512,'totalBytes':sum(f.stat().st_size for f in out.iterdir() if f.is_file()),'sourceBinarySha256':hashlib.sha256((src/'scene.bin').read_bytes()).hexdigest()}
print(json.dumps(report,indent=2))
