const fs=require('fs');const assert=require('assert');const path=require('path');
const {createScopedThreejs}=require('../../miniprogram/node_modules/threejs-miniprogram');
const T=createScopedThreejs({width:390,height:720,createImage(){return {}}});
const base=path.join(__dirname,'../../source-models/paper-airplane-cc0/');
const d=JSON.parse(fs.readFileSync(base+'paper-airplane.geometry.json'));const g=new T.BufferGeometry();
for(const [name,size]of [['position',3],['normal',3],['uv',2]]){assert(d[name].every(Number.isFinite));g.addAttribute(name,new T.Float32BufferAttribute(d[name],size));}
g.computeBoundingSphere();assert(g.boundingSphere.radius>0);const mat=new T.MeshLambertMaterial({side:T.DoubleSide});const m=new T.Mesh(g,mat);m.rotation.set(.2,.4,.1);m.updateMatrixWorld(true);assert(m.matrixWorld.elements.every(Number.isFinite));
const report={threeRevision:T.REVISION,triangles:g.attributes.position.count/3,geometryBytes:Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0),geometryFileBytes:fs.statSync(base+'paper-airplane.geometry.json').size,textureFileBytes:fs.statSync(base+'lined_paper.png').size,textureDecodedBytes:128*128*4,drawCallsWithoutShadows:1,engineConstruction:'PASS',wechatVisualAndFps:'NOT_TESTED'};
fs.writeFileSync(base+'engine-check.json',JSON.stringify(report,null,2)+'\n');console.log(report);g.dispose();mat.dispose();
