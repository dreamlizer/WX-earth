"""Atlas/quantise the isolated EVA flight poses; original GLBs stay untouched."""
import hashlib
import io
import json
import struct
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'source-models/eva-pursuit-flight-2026-10-22'

def build(unit):
    source = SOURCE / (unit + '-flight.glb')
    blob = source.read_bytes()
    size = struct.unpack_from('<I', blob, 12)[0]
    doc = json.loads(blob[20:20+size])
    binary = 28 + size
    def read(index):
        a = doc['accessors'][index]
        v = doc['bufferViews'][a['bufferView']]
        dtype = {5126:'<f4',5123:'<u2',5125:'<u4'}[a['componentType']]
        width = {'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
        stride = v.get('byteStride',np.dtype(dtype).itemsize*width)
        return np.ndarray((a['count'],width),dtype=dtype,buffer=blob,
                          offset=binary+v.get('byteOffset',0)+a.get('byteOffset',0),
                          strides=(stride,np.dtype(dtype).itemsize)).copy()
    mats=doc.get('materials',[])
    side = 1 if len(mats)==1 else 4
    atlas_size=512 if side==1 else 1024
    cell=atlas_size//side
    padding=4
    atlas=Image.new('RGB',(atlas_size,atlas_size))
    for index,m in enumerate(mats):
        p=m.get('pbrMetallicRoughness',{})
        factor=np.array(p.get('baseColorFactor',[1,1,1,1])[:3])
        ref=p.get('baseColorTexture')
        if ref:
            im=doc['images'][doc['textures'][ref['index']]['source']]
            v=doc['bufferViews'][im['bufferView']]
            start=binary+v.get('byteOffset',0)
            image=Image.open(io.BytesIO(blob[start:start+v['byteLength']])).convert('RGB')
        else:
            image=Image.new('RGB',(4,4),(255,255,255))
        image=image.resize((cell-2*padding,cell-2*padding),Image.Resampling.LANCZOS)
        # glTF baseColorFactor is linear; combine in linear space before encoding.
        encoded=np.asarray(image,dtype=np.float32)/255
        linear=np.where(encoded<=.04045,encoded/12.92,((encoded+.055)/1.055)**2.4)*factor
        encoded=np.where(linear<=.0031308,linear*12.92,1.055*np.maximum(linear,0)**(1/2.4)-.055)
        image=Image.fromarray(np.uint8(np.clip(encoded*255+.5,0,255)))
        x,y=(index%side)*cell,(index//side)*cell
        tile=Image.fromarray(np.pad(np.asarray(image),((padding,padding),(padding,padding),(0,0)),mode='edge'))
        atlas.paste(tile,(x,y))
    def matrix(node):
        if 'matrix' in node:return np.array(node['matrix']).reshape(4,4).T
        x,y,z,w=node.get('rotation',[0,0,0,1])
        r=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],
                    [2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],
                    [2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])
        m=np.eye(4);m[:3,:3]=r@np.diag(node.get('scale',[1,1,1]));m[:3,3]=node.get('translation',[0,0,0]);return m
    pieces=[]
    def visit(i,parent):
        node=doc['nodes'][i];world=parent@matrix(node)
        if 'mesh' in node:
            for p in doc['meshes'][node['mesh']]['primitives']:
                a=p['attributes'];pos=read(a['POSITION']);normal=read(a['NORMAL']);uv=read(a['TEXCOORD_0'])
                pos=pos@world[:3,:3].T+world[:3,3]
                normal=normal@np.linalg.inv(world[:3,:3]);normal/=np.maximum(1e-12,np.linalg.norm(normal,axis=1,keepdims=True))
                material=p.get('material',0);tile=np.array([material%side,material//side])*cell
                uv=(np.clip(uv,0,1)*(cell-2*padding)+padding+tile)/atlas_size
                pieces.append((pos,normal,uv,read(p['indices']).ravel()))
        for child in node.get('children',[]):visit(child,world)
    for node in doc['scenes'][doc.get('scene',0)]['nodes']:visit(node,np.eye(4))
    allpos=np.concatenate([p[0] for p in pieces]);extent=float(np.abs(allpos).max())
    # Reindex triangle corners into <=65535-vertex draws, preserving UV seams.
    groups=[];current=[[],[],[],[]];lookup={}
    for pos,norm,uv,indices in pieces:
        for tri in indices.reshape(-1,3):
            keys=[tuple(np.round(np.r_[pos[i],norm[i],uv[i]],7)) for i in tri]
            if len(lookup)+sum(k not in lookup for k in keys)>65532:
                groups.append(current);current=[[],[],[],[]];lookup={}
            for i,key in zip(tri,keys):
                if key not in lookup:
                    lookup[key]=len(lookup);current[0].append(pos[i]);current[1].append(norm[i]);current[2].append(uv[i])
                current[3].append(lookup[key])
    if current[3]:groups.append(current)
    out=ROOT/'miniprogram'/('eva01-assets' if unit=='unit01' else 'eva02-assets');out.mkdir(exist_ok=True)
    chunks=[];offset=0;meshes=[]
    def append(array):
        nonlocal offset
        pad=(-offset)%4;chunks.append(bytes(pad));offset+=pad;start=offset;data=array.tobytes();chunks.append(data);offset+=len(data);return start
    for pos,norm,uv,indices in groups:
        meshes.append(dict(count=len(pos),indexCount=len(indices),
            position=append(np.round(np.asarray(pos)/extent*32767).astype('<i2')),
            normal=append(np.round(np.clip(norm,-1,1)*127).astype('i1')),
            uv=append(np.round(np.clip(uv,0,1)*65535).astype('<u2')),
            index=append(np.asarray(indices,dtype='<u2'))))
    (out/'geometry.bin').write_bytes(b''.join(chunks))
    atlas.save(out/'basecolor.jpg',quality=90,subsampling=0,optimize=True)
    metadata=ROOT/'miniprogram/assets/models/eva';metadata.mkdir(parents=True,exist_ok=True)
    (metadata/(unit+'.js')).write_text('module.exports = '+json.dumps(dict(meshes=meshes,extent=extent,height=1),separators=(',',':'))+';\n')
    for name,content in {'ready.js':'module.exports = true;\n','index.js':'Page({});\n','index.json':'{}\n','index.wxml':'<view></view>\n','index.wxss':''}.items():(out/name).write_text(content)
    author='lefort' if unit=='unit01' else 'Ryanwill679 / TrashCG'
    srcdir='eva-unit-01-lefort' if unit=='unit01' else 'eva-unit-02-ryanwill679'
    (out/'AUTHOR.md').write_text('Evangelion '+unit+' — '+author+'\n\nUploader license: CC BY 4.0.\nProvenance: source-models/'+srcdir+'/SOURCE.md\nLocal derivative: static flight pose, quantised geometry and colour atlas; unit02 decimated.\nCharacter/IP rights remain separate.\n')
    report=dict(unit=unit,sourceSHA256=hashlib.sha256(blob).hexdigest(),triangles=sum(len(p[3])//3 for p in pieces),vertices=sum(len(g[0]) for g in groups),drawCalls=len(groups),geometryBytes=(out/'geometry.bin').stat().st_size,textureBytes=(out/'basecolor.jpg').stat().st_size,staticPose=True)
    (out/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
    return report

if __name__=='__main__':
    print(json.dumps([build('unit01'),build('unit02')],indent=2))
