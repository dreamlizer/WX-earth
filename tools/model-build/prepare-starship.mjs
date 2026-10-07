// Read-only FBX conversion using the project's existing, vendored Three loader.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'../..'),vendor=path.join(root,'source-models/mech-encounter-candidates/preview/vendor');
const tmp='/tmp/wx-earth-starship-build';fs.mkdirSync(tmp,{recursive:true});
function stage(rel){const src=path.join(vendor,rel),dst=path.join(tmp,rel.replace(/\.js$/,'.mjs'));if(fs.existsSync(dst))return dst;fs.mkdirSync(path.dirname(dst),{recursive:true});let s=fs.readFileSync(src,'utf8');s=s.replace(/from ['"]([^'"]+)['"]/g,(all,p)=>{if(p==='three')return `from '${pathToFileURL(stage('three.module.js'))}'`;if(p.startsWith('.'))return `from '${pathToFileURL(stage(path.normalize(path.join(path.dirname(rel),p))))}'`;return all;});fs.writeFileSync(dst,s);return dst;}
const T=await import(pathToFileURL(stage('three.module.js')));
T.TextureLoader.prototype.load=function(){return new T.Texture()};
const {FBXLoader}=await import(pathToFileURL(stage('loaders/FBXLoader.js')));
const src=path.join(root,'source-models/mech-encounter-candidates/luminaris-starship');
const bytes=fs.readFileSync(path.join(src,'luminaris-starship.fbx'));
const object=new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');object.updateMatrixWorld(true);
const chunks=[],views=[],accessors=[],primitives=[];let offset=0,triangles=0;
function accessor(array,type,target){let b=Buffer.from(array.buffer,array.byteOffset,array.byteLength);const vi=views.length;views.push({buffer:0,byteOffset:offset,byteLength:b.length,target});chunks.push(b);offset+=b.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}const count=array.length/({SCALAR:1,VEC2:2,VEC3:3}[type]);const a={bufferView:vi,componentType:array instanceof Float32Array?5126:array instanceof Uint16Array?5123:5125,count,type};if(type==='VEC3'){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<array.length;i++) {a.min[i%3]=Math.min(a.min[i%3],array[i]);a.max[i%3]=Math.max(a.max[i%3],array[i]);}}accessors.push(a);return accessors.length-1;}
const bounds=new T.Box3().setFromObject(object);console.log('Source bounds',bounds.min.toArray(),bounds.max.toArray());
object.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(g.attributes.uv){const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));}const attrs={};for(const [a,key,size] of [['position','POSITION','VEC3'],['normal','NORMAL','VEC3'],['uv','TEXCOORD_0','VEC2']])if(g.attributes[a])attrs[key]=accessor(g.attributes[a].array,size,34962);const p={attributes:attrs,material:0};if(g.index)p.indices=accessor(g.index.array,'SCALAR',34963);triangles+=(g.index?g.index.count:g.attributes.position.count)/3;primitives.push(p);});
const names=['diffuse.jpg','normal.jpg','roughness.jpg','emissive.jpg'];
const d={asset:{version:'2.0',generator:'wx-earth local FBX conversion'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives}],buffers:[{byteLength:offset}],bufferViews:views,accessors,images:names.map(uri=>({uri})),textures:names.map((_,source)=>({source})),materials:[{name:'Luminaris',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:.28,roughnessFactor:.72,metallicRoughnessTexture:{index:2}},normalTexture:{index:1},emissiveTexture:{index:3},emissiveFactor:[.12,.12,.12],doubleSided:true}]};
let json=Buffer.from(JSON.stringify(d));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=Buffer.concat(chunks),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
const out=path.join(root,'miniprogram/starship-assets');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'starship.glb'),Buffer.concat([header,jh,json,bh,bin]));console.log({triangles,primitives:primitives.length,bytes:28+json.length+bin.length});
