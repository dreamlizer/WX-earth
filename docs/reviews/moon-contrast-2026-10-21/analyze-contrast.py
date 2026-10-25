from pathlib import Path
import numpy as np,json
from PIL import Image,ImageDraw
D=Path(__file__).parent
info=json.loads((D/'moon-audit-154.json').read_text());w,h=780,1408
x=(np.arange(w)+.5)/w*2-1;y=1-(np.arange(h)+.5)/h*2
xx,yy=np.meshgrid(x,y);rays=np.stack([xx*(w/h)*np.tan(np.pi/8),yy*np.tan(np.pi/8),-np.ones_like(xx)],-1)
rays/=np.linalg.norm(rays,axis=-1,keepdims=True)
qx,qy,qz,qw=info['cameraQuaternion'];q=np.array([qx,qy,qz]);rays=rays+2*np.cross(q,np.cross(q,rays)+qw*rays)
c=np.array(info['cameraPosition']);center=np.array(info['moonPosition']);oc=c-center;r=.9
b=np.sum(rays*oc,axis=-1);disc=b*b-np.dot(oc,oc)+r*r;hit=disc>0
t=-b-np.sqrt(np.maximum(disc,0));n=(c+rays*t[:,:,None]-center)/r;sun=np.array(info['sun']);day=np.sum(n*sun,axis=-1)
night=hit&(day<-.06);lit=hit&(day>.2);report={}
for name in ['normal-on','normal-off','persisted']:
 a=np.asarray(Image.open(D/('moon-audit-'+name+'.png')).convert('RGB'));v=(a.astype(float)*np.array([.2126,.7152,.0722])).sum(axis=-1);report[name]={'nightMean':float(v[night].mean()),'nightP90':float(np.percentile(v[night],90)),'nightFractionOver20':float((v[night]>20).mean()),'dayMean':float(v[lit].mean())}
(D/'contrast-metrics.json').write_text(json.dumps(report,indent=2)+'\n');print(report)
# Show the same actual simulator crop at 154s, preserving the frame and surface orientation.
mask=np.where(hit);box=(int(mask[1].min())-12,int(mask[0].min())-12,int(mask[1].max())+13,int(mask[0].max())+13)
out=Image.new('RGB',(1000,580),'#080b11');draw=ImageDraw.Draw(out)
for i,(name,title) in enumerate([('normal-on','Before: normals + ambient'),('normal-off','Diagnosis: no normal map'),('persisted','After: normals + sphere terminator')]):
 im=Image.open(D/('moon-audit-'+name+'.png')).convert('RGB').crop(box);im.thumbnail((320,490));out.paste(im,(i*334+(320-im.width)//2,48));draw.text((i*334+10,20),title,fill='#d5dfec')
out.save(D/'contrast-comparison.png')
