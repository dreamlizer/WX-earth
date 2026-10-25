"""Crop native pixels; preserve the original source and previous preview."""
from pathlib import Path
from PIL import Image, ImageChops
root=Path(__file__).resolve().parents[1]
box=(4096,3072,7168,7168)
out=Path(__file__).resolve().parent/'assets'
for name,target in [('Albedo','albedo'),('Roughness','roughness'),('Occlusion','ao')]:
    Image.open(root/'extracted'/f'LAN_{name}_01.jpg').crop(box).save(out/f'{target}.jpg',quality=96,subsampling=0)
# Gaea map represents heightfield normals, not residual normal detail for
# an already-displaced surface. Source red points -X, green points +Z,
# blue points +Y in our exported Y-up geometry. Verified against source slopes.
r,g,b=Image.open(root/'extracted/LAN_Normal Map_01.jpg').crop(box).split()
Image.merge('RGB',(ImageChops.invert(r),b,g)).save(out/'normal-object.jpg',quality=96,subsampling=0)
