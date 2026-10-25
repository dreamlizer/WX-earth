"""Native pixel crop of the existing 8K PBR set, no upscale/sharpening."""
from pathlib import Path
from PIL import Image, ImageChops
import json
root=Path(__file__).resolve().parent
box=(6062,3358,7373,4506) # World X≈48..80, Z≈-18..10, UV is (sourceXZ+100)/200.
for src,out in [('Albedo','albedo'),('Roughness','roughness'),('Occlusion','ao')]:
 Image.open(root.parent/'extracted'/f'LAN_{src}_01.jpg').crop(box).save(root/'assets'/f'{out}.jpg',quality=98,subsampling=0)
r,g,b=Image.open(root.parent/'extracted/LAN_Normal Map_01.jpg').crop(box).split()
Image.merge('RGB',(ImageChops.invert(r),b,g)).save(root/'assets/normal-object.jpg',quality=98,subsampling=0)
(root/'assets/crop.json').write_text(json.dumps({'originalSize':[8192,8192],'crop':box,'size':[box[2]-box[0],box[3]-box[1]],'resized':False,'uvOrigin':[box[0]/8192,box[1]/8192],'uvExtent':[(box[2]-box[0])/8192,(box[3]-box[1])/8192]},indent=2))
