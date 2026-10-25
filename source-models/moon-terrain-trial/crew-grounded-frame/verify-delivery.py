from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import hashlib,json
import numpy as np
p=Path(__file__).resolve().parent;r=p.parent;o=p/'output'
manifest=json.loads((p/'preserved-approved.json').read_text())
for name,sha in manifest.items():assert hashlib.sha256((r/name).read_bytes()).hexdigest()==sha,name
v=json.loads((o/'validation.json').read_text());assert not v['errors'] and len(v['states'])==4
states=v['states'];reference=states[0]
for s in states:
 for key in ['time','camera','quaternion','fov']:assert s[key]==reference[key],key
 assert s['webglError']==0
 for before,after in zip(reference['crew'],s['crew']):
  for key in ['kind','x','z','scale','position']:assert before[key]==after[key],key
assert [s['resolution'] for s in states]==[[540,960],[540,960],[1080,1920],[1080,1920]]
assert len(v['contacts'])==11 and len(v['probes'])==19
assert all(0<=c['afterGap']<.0001 for c in v['contacts'])
assert all(q['minTerrainClearance']>=-.000002 for q in v['probes'])
for c in v['contacts']:
 if c['part']=='palm':assert abs(c['upperArmLength']-.75)<1e-6 and abs(c['forearmLength']-.59)<1e-6
 if c['part']=='sole':assert abs(c['thighLength']-.70)<1e-6 and abs(c['shinLength']-.68)<1e-6
for name in ['camera-path.js','shot-config.json','orbit-anchor.json','earth-calibration.json']:assert (p/name).read_bytes()==(r/'crew-rim-detail-motion'/name).read_bytes(),name
assert v['layout']['frameVisible'] and v['layout']['controlsVisible']
ia=Image.open(o/'baseline.png').convert('RGB');ib=Image.open(o/'enhanced.png').convert('RGB');a=np.asarray(ia).astype(int);b=np.asarray(ib).astype(int);d=np.max(abs(a-b),2)
old=np.asarray(Image.open(r/'ending-detail-frame/output/enhanced.png').convert('RGB')).astype(int);assert np.max(abs(a[640:]-old[640:]))==0,'Baseline no longer matches the approved frame'
assert d[:660].max()==0,'Earth/sky/far terrain changed';mask=np.ones(d.shape,dtype=bool);mask[660:775,190:335]=False;assert d[mask].max()<=1,'Change outside crew and contacts';assert np.count_nonzero(d)>500
for f in ['baseline-hd.png','enhanced-hd.png']:assert Image.open(o/f).size==(1080,1920)
font='/System/Library/Fonts/STHeiti Light.ttc';big=ImageFont.truetype(font,23);small=ImageFont.truetype(font,17)
full=Image.new('RGB',(1112,1480),'#080b11');draw=ImageDraw.Draw(full)
for x,img,label in [(8,ia,'精修前 · 已确认高清月面'),(564,ib,'精修后 · 接地 / 坐姿 / 光影')]:
 draw.text((x+6,10),label,font=big,fill='#dbe5f1');full.paste(img,(x,48))
 draw.text((x+6,1020),'人物局部 · 来自1080实渲染',font=small,fill='#a4b5ca')
 hd=Image.open(o/('baseline-hd.png' if x==8 else 'enhanced-hd.png')).convert('RGB');full.paste(hd.crop((390,1310,650,1510)).resize((540,415),Image.Resampling.LANCZOS),(x,1053))
full.save(o/'comparison.png')
crew=Image.new('RGB',(1112,490),'#080b11');draw=ImageDraw.Draw(crew)
for x,f,label in [(8,'baseline-hd.png','精修前'),(564,'enhanced-hd.png','精修后')]:
 draw.text((x+10,9),label,font=big,fill='#dbe5f1');im=Image.open(o/f).convert('RGB');crew.paste(im.crop((390,1310,650,1510)).resize((540,415),Image.Resampling.LANCZOS),(x,45))
draw.text((16,465),'相同位置的局部放大 · 机位、人物排列与整体缩放一致',font=small,fill='#96a9bf');crew.save(o/'crew-comparison.png')
yy,xx=np.where(d>1)
checks={'preservedFiles':len(manifest),'cameraAndFigureAnchorsAndScaleUnchanged':True,'rightSunCalibrationUnchanged':True,'baselineMatchesApprovedTerrainPixels':True,'skyEarthFarTerrainIdenticalBetweenModes':True,'changeBounds540':[int(xx.min()),int(yy.min()),int(xx.max()),int(yy.max())],'contactPoints':len(v['contacts']),'contactVertexProbeSamples':sum(q['samples'] for q in v['probes']),'minSampledContactClearance':min(q['minTerrainClearance'] for q in v['probes']),'supportArmLengths':[.75,.59],'seatedLegLengths':[.70,.68],'nativeCaptureSizes':[[540,960],[1080,1920]],'newTextureAssets':0,'webglErrors':0,'pageErrors':v['errors'],'scope':'single still frame; no mini-program/device or new motion acceptance'}
(o/'checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2));print(json.dumps(checks,ensure_ascii=False,indent=2))
