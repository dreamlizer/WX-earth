import fs from 'node:fs';
import * as THREE from '../../mech-encounter-candidates/preview/vendor/three.module.js';
// Offline sampler of the same mature GLB and spherical cap deformation as scene.js.
export function terrainSampler(){
 const b=fs.readFileSync(new URL('../preview/assets/terrain.glb',import.meta.url)),n=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+n).toString()),bin=b.subarray(28+n),p=g.meshes[0].primitives[0];
 function values(i,c){const a=g.accessors[i],v=g.bufferViews[a.bufferView],arr=[];for(let j=0;j<a.count*c;j++){const off=(v.byteOffset||0)+(a.byteOffset||0)+j*(a.componentType===5123?2:4);arr.push(a.componentType===5126?bin.readFloatLE(off):a.componentType===5123?bin.readUInt16LE(off):bin.readUInt32LE(off));}return arr;}
 const pos=values(p.attributes.POSITION,3);for(let i=0;i<pos.length;i+=3){const x=pos[i]*100,y=pos[i+1]*100,z=pos[i+2]*100,edge=THREE.MathUtils.smoothstep(100-Math.max(Math.abs(x),Math.abs(z)),0,25);pos[i]=x;pos[i+1]=-650+Math.sqrt(650*650-x*x-z*z)+y*edge+.08;pos[i+2]=z;}
 const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geom.setIndex(values(p.indices,1));geom.computeVertexNormals();const mesh=new THREE.Mesh(geom,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld(true);const ray=new THREE.Raycaster();
 return {mesh,height(x,z){ray.set(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];if(!hit)throw Error('Outside terrain');return hit.point.y;}};
}
