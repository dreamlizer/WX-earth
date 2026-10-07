# coding: utf-8
"""Run after prepare-starship.mjs; preserve source images and attribution."""
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[2]
out=root/'miniprogram/starship-assets'
src=root/'source-models/mech-encounter-candidates/luminaris-starship'
for source,name in [('Diffuse','diffuse'),('Normal','normal'),('roughness','roughness'),('Emissive','emissive')]:
    image=Image.open(src/('Luminaris_'+source+'.tga.png')).convert('RGB')
    image.thumbnail((512,512),Image.Resampling.LANCZOS)
    if name=='roughness':
        rough=image.convert('L');white=Image.new('L',image.size,255)
        image=Image.merge('RGB',(white,rough,white))
    image.save(out/(name+'.jpg'),quality=90,optimize=True)
for name in ['ready.js','index.js','index.json','index.wxml','index.wxss']:
    source=root/'miniprogram/voyager-assets'/name
    if source.exists():(out/name).write_bytes(source.read_bytes())
(out/'AUTHOR.txt').write_text('Luminaris Starship — Igor Puškarić (iggy-design)\nhttps://sketchfab.com/3d-models/luminaris-starship-b8001c7cf83240f383ccdbe75094e468\nSource files: https://vfxstudy.com/tutorials/starship-1/\nSource page lists CC BY: https://creativecommons.org/licenses/by/4.0/\nModified: converted FBX to GLB, baked mesh transforms, resized textures to 512px, adapted materials.\n')
print(sum(p.stat().st_size for p in out.iterdir() if p.is_file()))
