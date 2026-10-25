import * as THREE from 'three';
import {mergeGeometries} from '/mech-encounter-candidates/preview/vendor/utils/BufferGeometryUtils.js';
// Task-authored static three-dimensional seated meshes. No image billboards.
// Coordinates: feet/hips near y=0, gaze toward -Z, camera sees the +Z back.
const V=p=>new THREE.Vector3(...p);
const mat=(color,roughness=.72)=>new THREE.MeshStandardMaterial({color,roughness,metalness:.035});
function mesh(group,geometry,material,name){const m=new THREE.Mesh(geometry,material);m.name=name;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
function ellipsoid(group,p,s,material,name){const m=mesh(group,new THREE.SphereGeometry(1,24,16),material,name);m.position.fromArray(p);m.scale.fromArray(s);return m;}
function curved(group,points,radius,material,name,flatten=1){const curve=new THREE.CatmullRomCurve3(points.map(V));const geometry=new THREE.TubeGeometry(curve,24,radius,12,false);if(flatten!==1){const p=geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,p.getZ(i)*flatten);geometry.computeVertexNormals();}return mesh(group,geometry,material,name);}
function loft(group,rings,material,name){const count=32,pos=[],uv=[],index=[];for(let j=0;j<rings.length;j++){const [y,rx,rz,z]=rings[j];for(let k=0;k<=count;k++){const a=k/count*Math.PI*2;pos.push(Math.sin(a)*rx,y,Math.cos(a)*rz+z);uv.push(k/count,j/(rings.length-1));if(j&&k){const n=j*(count+1)+k;index.push(n,n-1,n-count-2,n,n-count-2,n-count-1);}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return mesh(group,g,material,name);}
function hairCap(group,center,scale,material,kind){const sides=48,rows=20,pos=[],index=[];for(let j=0;j<=rows;j++)for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2;const back=Math.cos(a);const edge=(kind==='rei'?2.30:1.72)+.16*Math.max(0,back)+.035*Math.sin(a*9)+.025*Math.sin(a*15);const theta=j/rows*edge;const radial=1+.016*Math.sin(a*13)*Math.sin(theta);pos.push(center[0]+Math.sin(a)*Math.sin(theta)*scale[0]*radial,center[1]+Math.cos(theta)*scale[1],center[2]+Math.cos(a)*Math.sin(theta)*scale[2]*radial);if(j&&i){const n=j*(sides+1)+i;index.push(n,n-sides-2,n-1,n,n-sides-1,n-sides-2);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(index);g.computeVertexNormals();return mesh(group,g,material,kind+' hair cap');}
function hairLock(group,points,width,material,name){const c=new THREE.CatmullRomCurve3(points.map(V)),g=new THREE.TubeGeometry(c,24,width,8,false),p=g.attributes.position;for(let i=0;i<p.count;i++){const row=Math.floor(i/9),t=row/24,mid=c.getPointAt(t),v=new THREE.Vector3().fromBufferAttribute(p,i).sub(mid).multiplyScalar(.18+.82*Math.sin(Math.PI*(.08+.92*t)));p.setXYZ(i,mid.x+v.x,mid.y+v.y,mid.z+v.z);}g.computeVertexNormals();return mesh(group,g,material,name);}
function hand(group,p,material,name){const m=ellipsoid(group,p,[.105,.055,.16],material,name);for(let k=0;k<4;k++)ellipsoid(group,[p[0]+(k-1.5)*.035,p[1]-.008,p[2]-.12],[.022,.032,.08],material,name+' finger');return m;}
export function createSeatedPilot(kind){
 const group=new THREE.Group();group.name={rei:'Rei Ayanami',shinji:'Shinji Ikari',asuka:'Asuka Langley'}[kind];
 const suit=mat(kind==='asuka'?0xb92d28:0xd8ddda),blue=mat(0x244e87),black=mat(0x16202a),trim=mat(0x39454b),skin=mat(0xe2b997,.83),red=mat(0xb82d2d),green=mat(0x788f58),hair=mat(kind==='rei'?0x90b8d2:kind==='shinji'?0x251f1c:0x74401c,.86);
 const shoulder=kind==='shinji'?.43:.39;
 // A continuous tapered torso avoids stacked-sphere / mannequin silhouettes.
 loft(group,[[.25,.23,.15,.03],[.4,.28,.19,.015],[.61,.255,.165,-.005],[.85,.27,.18,-.015],[1.12,.34,.22,-.045],[1.34,shoulder,.21,-.075],[1.45,shoulder*.87,.175,-.075],[1.5,.20,.12,-.07],[1.52,0,0,-.07]],suit,'plugsuit torso');
 ellipsoid(group,[0,.24,.03],[.32,.23,.28],kind==='shinji'?blue:suit,'seated hips');
 ellipsoid(group,[0,1.56,-.075],[.13,.13,.12],black,'collar');
 ellipsoid(group,[0,1.66,-.075],[.102,.15,.10],skin,'neck');
 ellipsoid(group,[0,1.94,-.095],[.245,.30,.23],skin,'head');
 // Quiet facial planes exist in 3D but the reviewed camera stays behind them.
 ellipsoid(group,[0,1.93,-.319],[.047,.075,.065],skin,'nose');
 for(const s of [-1,1])ellipsoid(group,[s*.242,1.91,-.06],[.045,.085,.055],skin,'ear');
 hairCap(group,[0,1.99,-.065],[.276,.303,.275],hair,kind);
 if(kind==='rei'){
 }else if(kind==='shinji'){
  for(let i=0;i<9;i++){const a=(i/8-.5)*Math.PI*1.5;hairLock(group,[[Math.sin(a)*.24,2.03,Math.cos(a)*.24-.065],[Math.sin(a)*.27,1.89,Math.cos(a)*.26-.045],[Math.sin(a)*.24,1.81+Math.abs(Math.sin(a))*.05,Math.cos(a)*.24-.03]],.032,hair,'short dark nape lock');}
  // Deep blue suit sides and a pale back: recognisable without machine-purple.
  for(const s of [-1,1]){const m=ellipsoid(group,[s*.27,.99,.115],[.08,.30,.10],blue,'blue side panel');m.rotation.z=s*-.1;}
 }else{
  // Solid separate long locks: geometry, rather than an alpha hair card.
  const hairTones=[mat(0x9b6130,.86),mat(0x693819,.86),mat(0x845025,.86)];
  for(let i=0;i<15;i++){const x=(i-7)*.044,side=Math.abs(x)/.31;const h=hairTones[i%3];hairLock(group,[[x*.72,2.04,.095],[x*.94,1.7,.25],[x*1.12,1.2,.31],[x*1.18,.67+side*.1,.35],[x*1.22,.48+side*.16,.27]],.046,h,'auburn long hair strand');}
  for(const s of [-1,1]){ellipsoid(group,[s*.25,2.095,-.08],[.055,.082,.042],red,'red interface hair clip');hairLock(group,[[s*.24,2.04,-.035],[s*.32,1.78,.06],[s*.34,1.29,.15],[s*.40,.83,.20]],.075,hair,'side hair gather');}
 }
 // Black seam/panel geometry sits just above the suit's curved surface.
 for(const s of [-1,1]){curved(group,[[s*.23,.4,.14],[s*.24,.77,.145],[s*.30,1.14,.115],[s*.35,1.30,.08]],.026,black,'side seam');ellipsoid(group,[s*.29,1.36,.08],[.095,.09,.09],black,'shoulder insert');}
 ellipsoid(group,[0,1.19,.175],[.065,.105,.025],trim,'small upper back connector');
 if(kind==='rei')for(const s of [-1,1])ellipsoid(group,[s*.18,1.30,.12],[.033,.075,.035],red,'red suit accent');
 if(kind==='asuka')for(const s of [-1,1]){ellipsoid(group,[s*.31,1.28,.13],[.095,.12,.055],green,'green shoulder accent');const panel=ellipsoid(group,[s*.265,.91,.13],[.09,.28,.075],black,'black waist insert');panel.rotation.z=s*-.12;}
 // Bent thighs and shins, using smooth connected volumes.
 for(const s of [-1,1]){
  const legMat=kind==='shinji'?blue:suit,kneeX=s*(kind==='asuka'?.40:.34);
  curved(group,[[s*.18,.29,-.02],[s*.28,.40,-.26],[kneeX,.59,-.56],[kneeX,.58,-.69]],.145,legMat,'bent thigh');
  ellipsoid(group,[kneeX,.58,-.65],[.15,.145,.16],black,'knee joint');
  curved(group,[[kneeX,.54,-.70],[s*.36,.30,-.94],[s*.35,.105,-1.13]],.105,legMat,'shin');
  ellipsoid(group,[s*.35,.10,-1.25],[.13,.105,.235],black,'boot');
 }
 for(const s of [-1,1]){
  const support=(kind==='asuka'&&s===1)||(kind==='rei'&&s===-1);
  const elbow=support?[s*.60,.65,.10]:[s*.52,.94,-.30],wrist=support?[s*.68,.11,.20]:[s*.39,.65,-.60];
  ellipsoid(group,[s*shoulder,1.32,-.07],[.145,.18,.16],kind==='asuka'?black:suit,'shoulder');
  curved(group,[[s*shoulder,1.31,-.07],[s*.49,1.13,-.15],elbow],.108,kind==='shinji'?blue:kind==='asuka'?trim:suit,'upper arm');
  ellipsoid(group,elbow,[.11,.11,.11],black,'elbow joint');
  curved(group,[elbow,[(elbow[0]+wrist[0])/2,(elbow[1]+wrist[1])/2,(elbow[2]+wrist[2])/2],wrist],.083,kind==='asuka'?black:suit,'forearm');
  hand(group,wrist,black,'gloved hand');
 }
 // Merge static parts per material, preserving actual volumes and normals.
 group.updateMatrixWorld(true);const buckets=new Map();for(const part of [...group.children]){const g=part.geometry.clone().applyMatrix4(part.matrix);g.deleteAttribute('uv');const k=part.material.uuid;if(!buckets.has(k))buckets.set(k,{material:part.material,geometries:[]});buckets.get(k).geometries.push(g);group.remove(part);part.geometry.dispose();}for(const b of buckets.values()){const g=mergeGeometries(b.geometries,false);mesh(group,g,b.material,'merged seated body '+kind);b.geometries.forEach(x=>x.dispose());}
 group.userData={kind,construction:'task-authored static 3D meshes',gazeLocal:[0,0,-1],seatedHeight:2.31};
 return group;
}
export function createCrew(terrain,models=null){
 const root=new THREE.Group();root.name='Seated EVA-inspired pilot trio';const ray=new THREE.Raycaster(),seats=[{kind:'rei',x:32.9,z:-19,scale:.60},{kind:'shinji',x:34,z:-19.15,scale:.62},{kind:'asuka',x:35.1,z:-19,scale:.60}],records=[];
 terrain.updateMatrixWorld(true);
 for(const seat of seats){ray.set(new THREE.Vector3(seat.x,100,seat.z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(terrain,true)[0];if(!hit)throw Error('No terrain under crew seat');const pilot=models?models[seat.kind].clone(true):createSeatedPilot(seat.kind);pilot.name={rei:"Rei Ayanami",shinji:"Shinji Ikari",asuka:"Asuka Langley"}[seat.kind];pilot.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});pilot.position.copy(hit.point);pilot.position.y+=.04;pilot.scale.setScalar(seat.scale);pilot.rotation.y=Math.atan2(seat.x,20517+seat.z);root.add(pilot);records.push({...seat,position:pilot.position.toArray(),groundNormal:hit.face.normal.toArray()});}
 root.userData.seats=records;return root;
}
