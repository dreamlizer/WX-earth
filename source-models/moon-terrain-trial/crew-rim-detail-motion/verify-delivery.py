from pathlib import Path
from PIL import Image
import hashlib,json
import numpy as np
p=Path(__file__).resolve().parent;r=p.parent
manifest=json.loads((p/'preserved-approved.json').read_text())
for name,sha in manifest.items():assert hashlib.sha256((r/name).read_bytes()).hexdigest()==sha,name
v=json.loads((p/'output/full-playback.json').read_text());assert not v['errors'] and v['webglError']==0
q=v['playback'];assert q['nativeEnded'] and q['completed']>=1 and q['startTime']==193 and q['stalls']==0
assert q['frames']>2300 and v['detail']['fullPlaybackInHD']
assert abs(v['audio']['duration']-78.7266666667)<1e-6
assert v['layout']['fullFrameVisible'] and v['layout']['controlsVisible']
assert v['earthPoseErrorDegrees']<.001 and v['finalSunInEarthView'][0]>.9 and v['starfield']['count']==16000
assert v['minTerrainClearance']>0 and v['minLateSpeed']>.005 and v['cameraTravel255ToEnd']>.2
assert len(v['earthVisibilityEvents'])==1 and len(v['crew']['events'])==1
assert v['earthVisibilityEvents'][0]['time']-v['crew']['events'][0]['time']>4
for name in ['camera-path.js','characters.js','shot-config.json','orbit-anchor.json','earth-calibration.json']:assert (p/name).read_bytes()==(r/'crew-rim-balance'/name).read_bytes(),name
# Rows 0–639 include stochastic sky stars. Rows 640–959 contain only the terrain and crew.
a=np.asarray(Image.open(p/'output/frame-271.73.png').convert('RGB')).astype(int);b=np.asarray(Image.open(r/'ending-detail-frame/output/enhanced.png').convert('RGB')).astype(int)
d=abs(a[640:]-b[640:]);assert d.max()==0,('Ending frame diverged',d.max())
checks={'preservedFiles':len(manifest),'fullNativePlayback':True,'playback':q,'duration':v['audio']['duration'],'frameAndControlsVisible':True,'sameCameraMusicActorsLighting':True,'endingTerrainMaxChannelDifferenceFromApprovedStill':int(d.max()),'pageErrors':v['errors'],'webglError':v['webglError'],'scope':'independent desktop browser preview, no mini-program integration or compression'}
(p/'output/checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2));print(json.dumps(checks,ensure_ascii=False,indent=2))
