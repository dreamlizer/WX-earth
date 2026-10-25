"""Verify preservation and same-frame render, and compose the requested comparison."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib,json
import numpy as np
p=Path(__file__).resolve().parent;o=p/'output';old=p.parent/'crew-rim-balance'
manifest=json.loads((p/'preserved-approved.json').read_text())
assert all((old/k).is_file() and hashlib.sha256((old/k).read_bytes()).hexdigest()==v for k,v in manifest.items()),'Approved version changed'
r=json.loads((o/'validation.json').read_text());a,b=r['states']
for k in ['time','camera','quaternion','fov','crew']:assert a[k]==b[k],k
assert a['webglError']==b['webglError']==0 and not r['errors']
assert r['layout']['frameVisible'] and r['layout']['controlsVisible']
ia=Image.open(o/'baseline.png').convert('RGB');ib=Image.open(o/'enhanced.png').convert('RGB')
x=np.asarray(ia).astype(float);y=np.asarray(ib).astype(float);delta=abs(x-y)
assert np.max(delta[:605])==0,'Sky/Earth changed between material modes'
assert np.max(delta[820:960,:280])<=3,'Deep foreground shadow was lifted'
assert np.mean(delta[820:960,440:540])>2,'No visible near-terrain material change'
font='/System/Library/Fonts/STHeiti Light.ttc'
f=ImageFont.truetype(font,22);small=ImageFont.truetype(font,17)
sheet=Image.new('RGB',(1112,1510),'#080b11');d=ImageDraw.Draw(sheet)
for xx,img,label in [(8,ia,'原版'),(564,ib,'加强版 · 原图局部 + 月壤细节')]:
 d.text((xx+8,9),label,font=f,fill='#e2e9f3');sheet.paste(img,(xx,48));d.text((xx+8,1022),'近景局部 · 同像素比例',font=small,fill='#b3c3d7');sheet.paste(img.crop((0,610,540,960)),(xx,1060))
d.text((16,1434),'同一结束帧 271.73 秒 · 相机 / 人物 / 右侧阳光一致',font=small,fill='#b3c3d7')
d.text((16,1467),'独立浏览器材质试验 · 旧动态版保留',font=small,fill='#8393a8');sheet.save(o/'comparison.png')
# Tight, enlarged crops are a reading aid, not a higher-resolution render claim.
near=Image.new('RGB',(960,525),'#080b11');d=ImageDraw.Draw(near)
for xx,img,label in [(0,ia,'原版近景'),(480,ib,'加强版近景')]:
 d.text((xx+12,8),label,font=f,fill='#e2e9f3');near.paste(img.crop((300,750,540,960)).resize((480,420),Image.Resampling.NEAREST),(xx,48))
d.text((12,484),'右侧近坡 · 相同区域放大 2 倍，便于查看颗粒；未增加渲染分辨率',font=small,fill='#9daec5');near.save(o/'near-comparison.png')
result={'approvedFilesUnchanged':len(manifest),'cameraActorsAndTimeIdentical':True,'skyEarthStarsIdentical':True,'webglErrors':0,'frameAndControlsVisible':True,'deepShadowMaxChannelDifference':float(delta[820:960,:280].max()),'nearTerrainMeanAbsoluteChannelDifference':float(delta[820:960,440:540].mean()),'newMaterialBytes':sum(q.stat().st_size for q in (p/'assets').glob('*') if q.suffix in ['.jpg','.png']),'generatedMicrotexture':{'file':'assets/regolith-detail-generated.png','type':'AI-generated visual material; not a NASA scan or measured PBR height field','pixels':list(Image.open(p/'assets/regolith-detail-generated.png').size)},'scope':'single final frame; no mini-program integration or dynamic material validation'}
(o/'checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
