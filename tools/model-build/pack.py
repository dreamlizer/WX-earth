"""Pack the two static trial models into a small buffer + one PNG atlas each."""
import json, struct, io, sys
from pathlib import Path
import numpy as np
from PIL import Image
root = Path(__file__).resolve().parents[2]
stage = Path(sys.argv[1])
out = root / 'miniprogram/assets/models'
for name, height in [('lander', 2.25), ('eva00', 1.65)]:
 b = (stage / (name+'.glb')).read_bytes(); size = struct.unpack_from('<I',b,12)[0]
 d = json.loads(b[20:20+size]); binary = b[28+size:]
 def acc(i):
  a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];dt=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]);dim={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
  return np.ndarray((a['count'],dim),dtype=dt,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',dt.itemsize*dim),dt.itemsize)).copy()
 def matrix(n):
  if 'matrix' in n:return np.array(n['matrix']).reshape(4,4).T
  x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4);m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])*n.get('scale',[1,1,1]);m[:3,3]=n.get('translation',[0,0,0]);return m
 # Four padded atlas cells; keep a white cell for untextured materials.
 cell=512; atlas=Image.new('RGB',(1024,1024),'white')
 for i,img in enumerate(d.get('images',[])):
  v=d['bufferViews'][img['bufferView']];off=v.get('byteOffset',0)
  im=Image.open(io.BytesIO(binary[off:off+v['byteLength']])).convert('RGB').resize((508,508),Image.Resampling.LANCZOS)
  tile=Image.fromarray(np.pad(np.array(im),((2,2),(2,2),(0,0)),mode='edge'))
  atlas.paste(tile,((i%2)*cell,(i//2)*cell))
 parts=[]
 def walk(i,parent):
  n=d['nodes'][i];m=np.einsum('ij,jk->ik',parent,matrix(n))
  if 'mesh' in n:
   for p in d['meshes'][n['mesh']]['primitives']:
    a=p['attributes'];xyz=acc(a['POSITION']);xyz=np.einsum('ij,kj->ik',np.c_[xyz,np.ones(len(xyz))],m)[:,:3]
    normals=np.einsum('ij,kj->ik',acc(a['NORMAL']),np.linalg.inv(m[:3,:3]).T);normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-12)
    mat=d['materials'][p['material']]['pbrMetallicRoughness'];colors=np.tile(mat.get('baseColorFactor',[1,1,1,1])[:3],(len(xyz),1))
    if 'baseColorTexture' in mat:
     ti=d['textures'][mat['baseColorTexture']['index']];image=ti.get('source',ti.get('extensions',{}).get('EXT_texture_webp',{}).get('source'));uv=acc(a['TEXCOORD_0'])
     assert uv.min()>-0.001 and uv.max()<1.001,(name,'tiling UV requires baking',uv.min(),uv.max())
     uv=(np.clip(uv,0,1)*508+2+np.array([image%2,image//2])*512)/1024
    else:uv=np.tile([.75,.75],(len(xyz),1))
    idx=acc(p['indices']).reshape(-1).astype(np.uint32)
    if np.linalg.det(m[:3,:3])<0:idx=idx.reshape(-1,3)[:,[0,2,1]].reshape(-1)
    parts.append((xyz,normals,uv,colors,idx))
  for child in n.get('children',[]):walk(child,m)
 for i in d['scenes'][d.get('scene',0)]['nodes']:walk(i,np.eye(4))
 pos=np.concatenate([p[0]for p in parts]);lo=pos.min(0);hi=pos.max(0);pos-=np.array([(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2]);pos*=height/(hi[1]-lo[1])
 norm=np.concatenate([p[1]for p in parts]);uv=np.concatenate([p[2]for p in parts]);color=np.concatenate([p[3]for p in parts]);indices=[];offset=0
 for p in parts:indices.extend(p[4]+offset);offset+=len(p[0])
 assert offset<65536 and np.isfinite(pos).all()
 chunks=[struct.pack('<4sII',b'MV01',offset,len(indices)),pos.astype('<f4').tobytes(),np.round(norm*127).astype('i1').tobytes()]
 chunks.append(bytes((-sum(map(len,chunks)))%4));chunks.append(np.round(uv*65535).astype('<u2').tobytes());chunks.append(np.round(np.clip(color,0,1)*255).astype('u1').tobytes());chunks.append(bytes((-sum(map(len,chunks)))%4));chunks.append(np.array(indices,dtype='<u2').tobytes())
 (out/(name+'.bin')).write_bytes(b''.join(chunks));atlas.save(out/(name+'.png'),optimize=True)
 print(name, 'triangles',len(indices)//3,'vertices',offset,'height',height,'bytes',sum(map(len,chunks)),'bounds',pos.min(0).tolist(),pos.max(0).tolist())
