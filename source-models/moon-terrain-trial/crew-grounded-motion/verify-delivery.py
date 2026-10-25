from pathlib import Path
from PIL import Image
import hashlib,json
import numpy as np
p=Path(__file__).resolve().parent;r=p.parent
m=json.loads((p/'preserved-approved.json').read_text())
for name,sha in m.items():assert hashlib.sha256((r/name).read_bytes()).hexdigest()==sha,name
v=json.loads((p/'output/full-playback.json').read_text());q=v['playback']
assert not v['errors'] and v['webglError']==0
assert q['nativeEnded'] and q['completed']>=1 and q['startTime']==193 and q['stalls']==0 and q['frames']>2300
assert v['crewRefinement']['fullPlaybackRefined'] and v['detail']['fullPlaybackInHD']
assert abs(v['audio']['duration']-78.7266666667)<1e-6
assert v['layout']['fullFrameVisible'] and v['layout']['controlsVisible']
assert v['minTerrainClearance']>0 and v['minRadiusClearance']>0 and v['minLateSpeed']>.005 and v['cameraTravel255ToEnd']>.2
assert v['earthPoseErrorDegrees']<.001 and v['finalSunInEarthView'][0]>.9 and v['starfield']['count']==16000
assert len(v['crew']['events'])==1 and v['crew']['events'][0]['readable'] and len(v['crew']['events'][0]['figures'])==3
assert len(v['earthVisibilityEvents'])==1 and v['earthVisibilityEvents'][0]['time']-v['crew']['events'][0]['time']>3
readable=[s for s in v['samples'] if s['crewReadable']];assert readable and min(s['geometryLOD'] for s in readable)==1
assert len(v['crew']['contacts'])==11 and all(0<=c['afterGap']<.0001 for c in v['crew']['contacts'])
assert all(c['minTerrainClearance']>=-.000002 for c in v['crew']['probes'])
for name in ['camera-path.js','shot-config.json','orbit-anchor.json','earth-calibration.json']:
 assert (p/name).read_bytes()==(r/'crew-rim-detail-motion'/name).read_bytes(),name
for name in ['characters.js','grounding.js','near-detail.js']:
 assert (p/name).read_bytes()==(r/'crew-grounded-frame'/name).read_bytes(),name
still=json.loads((r/'crew-grounded-frame/output/validation.json').read_text());oldSeats=next(s['crew'] for s in still['states'] if s['refined'])
assert v['crew']['seats']==oldSeats
# Only terrain and people occupy rows640–959; stochastic stars are outside this comparison.
a=np.asarray(Image.open(p/'output/frame-271.73.png').convert('RGB')).astype(int);b=np.asarray(Image.open(r/'crew-grounded-frame/output/enhanced.png').convert('RGB')).astype(int);d=abs(a[640:]-b[640:]);assert d.max()==0,('Ending frame changed',d.max())
checks={'preservedFiles':len(m),'fullNativeMusicPlayback':q,'duration':v['audio']['duration'],'cameraScaleMusicAndApprovedCharacterSourceUnchanged':True,'endTerrainAndCrewPixelDifferenceFromApprovedStill':int(d.max()),'crewReadableFrom':v['crew']['events'][0]['time'],'earthVisibleFrom':v['earthVisibilityEvents'][0]['time'],'terrainLODWhenCrewReadable':1,'fixedContactPoints':len(v['crew']['contacts']),'sampledContactClearanceMin':min(c['minTerrainClearance'] for c in v['crew']['probes']),'frameAndControlsVisible':True,'pageErrors':v['errors'],'webglError':0,'scope':'independent desktop preview; no compression or mini-program integration'}
(p/'output/checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2));print(json.dumps(checks,ensure_ascii=False,indent=2))
