// Adapted from the approved crew-grounded-motion source; old preview retained.
import {createPilotFactory} from './moon-terrain-characters.js';
export function createGroundingFactory(THREE){
const {createSeatedPilot}=createPilotFactory(THREE);
const smooth=(a,b,x)=>THREE.Math.smoothstep(x,a,b);
const clamp=THREE.Math.clamp;
const sun=new THREE.Vector3(.92489986,.30521965,.22671835);
const deg=THREE.Math.degToRad;

function createGroundedCrew(terrain,layout){
 const root=new THREE.Group();root.name='Refined seated trio';
 const ray=new THREE.Raycaster(),contacts=[],seats=[];
 const ground=(x,z)=>{ray.set(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0));const h=ray.intersectObject(terrain,true)[0];if(!h)throw Error('Missing contact surface');return h;};
 for(const seat of layout.seats){
  const hit=ground(seat.x,seat.z),origin=hit.point.clone().add(new THREE.Vector3(0,layout.seatOffset,0)),yaw=Math.atan2(seat.x,20517+seat.z),scale=seat.scale;
  const world=p=>p.clone().applyAxisAngle(new THREE.Vector3(0,1,0),yaw).multiplyScalar(scale).add(origin);
  const localGround=(x,z)=>{const w=world(new THREE.Vector3(x,0,z));return (ground(w.x,w.z).point.y-origin.y)/scale;};
  const profile={rei:{roll:2.3,lean:.025,head:2.6,yaw:-.8},shinji:{roll:1.1,lean:-.035,head:3.4,yaw:.6},asuka:{roll:-1.9,lean:.04,head:2.2,yaw:-.5}}[seat.kind];
  const pilot=createSeatedPilot(seat.kind,(parts,kind)=>{
   // Bake the authored parts before anatomical edits, then merge as in the existing model.
   for(const part of parts.children){part.updateMatrix();part.geometry.applyMatrix(part.matrix);part.position.set(0,0,0);part.rotation.set(0,0,0);part.scale.set(1,1,1);part.updateMatrix();}
   const pivot=new THREE.Vector3(0,1.64,-.075),headQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(deg(profile.head),deg(profile.yaw),0));
   for(const part of parts.children){const a=part.geometry.attributes.position;const isHead=part.name==='ear'||/head|nose|hair|nape/.test(part.name),isHair=/hair|nape/.test(part.name);for(let i=0;i<a.count;i++){
     const v=new THREE.Vector3().fromBufferAttribute(a,i),original=v.clone();
     if(isHead){const h=v.clone().sub(pivot).applyQuaternion(headQ).add(pivot);v.lerp(h,isHair?smooth(1.15,1.85,v.y):1);}
     const w=smooth(.48,1.45,original.y),roll=deg(profile.roll)*w;
     const x=v.x,y=v.y-.50;v.x=x*Math.cos(roll)-y*Math.sin(roll);v.y=.50+x*Math.sin(roll)+y*Math.cos(roll);
     v.z+=profile.lean*w;
     a.setXYZ(i,v.x,v.y,v.z);
    }a.needsUpdate=true;part.geometry.computeBoundingBox();}
   const supportHand=side=>{
    const partCenter=name=>parts.children.find(p=>p.name===name&&Math.sign(p.geometry.boundingBox.getCenter(new THREE.Vector3()).x)===side).geometry.boundingBox.getCenter(new THREE.Vector3());
    const shoulder=partCenter('shoulder'),oldElbow=partCenter('elbow joint'),oldWrist=new THREE.Vector3(side*.68,.11,.20),l1=.75,l2=.59;
    const choices=[];for(const xx of [.60,.52,.44,.36,.28,.20])for(const zz of [.20,.08,-.04,-.16,-.28,-.40,-.52,-.64]){
     const w=new THREE.Vector3(side*xx,localGround(side*xx,zz)+.055+.00008/scale,zz),d=w.distanceTo(shoulder);
     if(d<l1+l2-.015&&d>Math.abs(l1-l2))choices.push({w,d,score:w.distanceTo(oldWrist)+Math.abs(w.y-.07)*.4});
    }
    choices.sort((a,b)=>a.score-b.score);if(!choices.length)throw Error('No reachable support palm for '+kind);
    const {w:newWrist,d}=choices[0],axis=newWrist.clone().sub(shoulder).normalize(),perp=new THREE.Vector3(side,0,.1).addScaledVector(axis,-new THREE.Vector3(side,0,.1).dot(axis)).normalize(),along=(l1*l1-l2*l2+d*d)/(2*d),bend=Math.sqrt(Math.max(0,l1*l1-along*along)),newElbow=shoulder.clone().addScaledVector(axis,along).addScaledVector(perp,bend),de=newElbow.clone().sub(oldElbow),dw=newWrist.clone().sub(oldWrist);
    const oldUpper=oldElbow.clone().sub(shoulder),oldLower=oldWrist.clone().sub(oldElbow),e=.05,cx=newWrist.x,cz=newWrist.z,sx=clamp((localGround(cx+e,cz)-localGround(cx-e,cz))/(2*e),-1.2,1.2),sz=clamp((localGround(cx,cz+e)-localGround(cx,cz-e))/(2*e),-1.2,1.2);
    for(const part of parts.children){const mid=part.geometry.boundingBox.getCenter(new THREE.Vector3());if(Math.sign(mid.x)!==side)continue;const a=part.geometry.attributes.position;
     for(let i=0;i<a.count;i++){const v=new THREE.Vector3().fromBufferAttribute(a,i),before=v.clone();
      if(part.name==='upper arm'){const t=clamp(v.clone().sub(shoulder).dot(oldUpper)/oldUpper.lengthSq(),0,1);v.addScaledVector(de,t);}
      else if(part.name==='elbow joint')v.add(de);
      else if(part.name==='forearm'){const t=clamp(v.clone().sub(oldElbow).dot(oldLower)/oldLower.lengthSq(),0,1);v.addScaledVector(de,1-t).addScaledVector(dw,t);}
      else if(part.name.includes('gloved hand')){v.add(dw);v.y+=sx*(v.x-cx)+sz*(v.z-cz);}
      a.setXYZ(i,v.x,v.y,v.z);
     }a.needsUpdate=true;
    }
    const wp=world(new THREE.Vector3(cx,newWrist.y-.055,cz)),g=ground(wp.x,wp.z);contacts.push({kind,part:'palm',side,position:g.point.toArray(),beforeGap:origin.y+(.11-.055)*scale-g.point.y,afterGap:wp.y-g.point.y,radii:[.006,.008],wristLocal:newWrist.toArray(),elbowLocal:newElbow.toArray(),upperArmLength:newElbow.distanceTo(shoulder),forearmLength:newWrist.distanceTo(newElbow)});
   };
   if(kind==='rei')supportHand(-1);
   if(kind==='asuka')supportHand(1);
   // Bend the knees to a reachable foot placement rather than stretching the shin to the slope.
   for(const side of [-1,1]){
    const oldHip=new THREE.Vector3(side*.18,.29,-.02),oldKnee=parts.children.find(p=>p.name==='knee joint'&&Math.sign(p.geometry.boundingBox.getCenter(new THREE.Vector3()).x)===side).geometry.boundingBox.getCenter(new THREE.Vector3()),oldAnkle=new THREE.Vector3(side*.35,.105,-1.13),oldBoot=new THREE.Vector3(side*.35,.10,-1.25),cx=side*.35,cz=-.98,newBoot=new THREE.Vector3(cx,localGround(cx,cz)+.105+.00008/scale,cz),newAnkle=newBoot.clone().add(new THREE.Vector3(0,.005,.12)),l1=.70,l2=.68,axis=newAnkle.clone().sub(oldHip),d=axis.length();
    if(d>=l1+l2)throw Error('Foot placement exceeds leg reach');axis.normalize();const up=new THREE.Vector3(0,1,0),perp=up.clone().addScaledVector(axis,-up.dot(axis)).normalize(),along=(l1*l1-l2*l2+d*d)/(2*d),knee=oldHip.clone().addScaledVector(axis,along).addScaledVector(perp,Math.sqrt(Math.max(0,l1*l1-along*along))),dk=knee.clone().sub(oldKnee),da=newAnkle.clone().sub(oldAnkle),db=newBoot.clone().sub(oldBoot),upper=oldKnee.clone().sub(oldHip),lower=oldAnkle.clone().sub(oldKnee),e=.05,sx=clamp((localGround(cx+e,cz)-localGround(cx-e,cz))/(2*e),-1.2,1.2),sz=clamp((localGround(cx,cz+e)-localGround(cx,cz-e))/(2*e),-1.2,1.2);
    for(const part of parts.children){if(Math.sign(part.geometry.boundingBox.getCenter(new THREE.Vector3()).x)!==side)continue;const a=part.geometry.attributes.position;for(let i=0;i<a.count;i++){const v=new THREE.Vector3().fromBufferAttribute(a,i);
     if(part.name==='bent thigh'){const t=clamp(v.clone().sub(oldHip).dot(upper)/upper.lengthSq(),0,1);v.addScaledVector(dk,t);}
     else if(part.name==='knee joint')v.add(dk);
     else if(part.name==='shin'){const t=clamp(v.clone().sub(oldKnee).dot(lower)/lower.lengthSq(),0,1);v.addScaledVector(dk,1-t).addScaledVector(da,t);}
     else if(part.name==='boot'){v.add(db);v.y+=sx*(v.x-cx)+sz*(v.z-cz);}a.setXYZ(i,v.x,v.y,v.z);
    }a.needsUpdate=true;}
    const wp=world(new THREE.Vector3(cx,newBoot.y-.105,cz)),g=ground(wp.x,wp.z);contacts.push({kind,part:'sole',side,position:g.point.toArray(),beforeGap:origin.y+(.10-.105)*scale-g.point.y,afterGap:wp.y-g.point.y,radii:[.008,.013],thighLength:knee.distanceTo(oldHip),shinLength:newAnkle.distanceTo(knee)});
   }
   const hip=parts.children.find(p=>p.name==='seated hips'),hipGround=localGround(0,.03);
   {const a=hip.geometry.attributes.position;let low=Infinity;for(let i=0;i<a.count;i++){const y=a.getY(i);const compressed=y<.24?.24+(y-.24)*.84:y;a.setY(i,compressed);low=Math.min(low,compressed);}const delta=hipGround+.00008/scale-low;for(let i=0;i<a.count;i++)a.setY(i,a.getY(i)+delta);a.needsUpdate=true;}
   // The curved underside conforms to the actual uneven seat, not only its center ray.
   {const a=hip.geometry.attributes.position;for(let i=0;i<a.count;i++){const floor=localGround(a.getX(i),a.getZ(i))+.00008/scale;if(a.getY(i)<floor)a.setY(i,floor);}a.needsUpdate=true;}
   const hipW=world(new THREE.Vector3(0,hipGround+.00008/scale,.03)),hipH=ground(hipW.x,hipW.z);contacts.push({kind,part:'hip',position:hipH.point.toArray(),beforeGap:origin.y+.01*scale-hipH.point.y,afterGap:hipW.y-hipH.point.y,radii:[.016,.014]});
   for(const part of parts.children){part.geometry.computeVertexNormals();part.geometry.computeBoundingBox();part.geometry.computeBoundingSphere();}
   const probes=[];for(const part of parts.children){const side=Math.sign(part.geometry.boundingBox.getCenter(new THREE.Vector3()).x),supportPalm=part.name.includes('gloved hand')&&((kind==='rei'&&side<0)||(kind==='asuka'&&side>0));if(part.name!=='seated hips'&&part.name!=='boot'&&!supportPalm)continue;const a=part.geometry.attributes.position;let min=Infinity,max=-Infinity,count=0;for(let i=0;i<a.count;i+=20){const v=world(new THREE.Vector3().fromBufferAttribute(a,i)),h=ground(v.x,v.z),gap=v.y-h.point.y;min=Math.min(min,gap);max=Math.max(max,gap);count++;}probes.push({kind,part:part.name,side,samples:count,minTerrainClearance:min,maxTerrainClearance:max});}parts.userData.probes=probes;
   // Materials retain their role colors, with softer whites and less striped hair highlights.
   const mats=new Set(parts.children.map(p=>p.material));for(const m of mats){m.metalness=0;m.roughness=.79;const l=(m.color.r+m.color.g+m.color.b)/3;if(l>.6)m.color.multiplyScalar(.84);}
   for(const part of parts.children){if(/hair|nape/.test(part.name)){part.material.roughness=.91;if(kind==='asuka')part.material.color.lerp(new THREE.Color(0x79502f).convertSRGBToLinear(),.40);else if(kind==='rei')part.material.color.multiplyScalar(.90);}if(/glove|boot|joint/.test(part.name))part.material.roughness=.9;}
   parts.userData.profile=profile;
  });
  pilot.position.copy(origin);pilot.scale.setScalar(scale);pilot.rotation.y=yaw;pilot.name={rei:'Rei Ayanami',shinji:'Shinji Ikari',asuka:'Asuka Langley'}[seat.kind];root.add(pilot);seats.push({...seat,position:origin.toArray(),groundNormal:hit.face.normal.toArray(),profile});
  const materials=new Set();pilot.traverse(o=>{if(o.isMesh)materials.add(o.material)});for(const m of materials)installSuitSurface(m,seat.kind);
 }
 // A few flattened, terrain-seated fragments give the feet of the silhouettes a readable edge.
 const fragments=new THREE.Group();fragments.name='Small rim fragments';const stoneMat=new THREE.MeshStandardMaterial({color:new THREE.Color(0x555149).convertSRGBToLinear(),roughness:1,metalness:0});
 for(let j=0;j<layout.seats.length;j++){const seat=layout.seats[j];for(let i=0;i<3;i++){const x=seat.x+(i-1)*.011+(j-1)*.0008,z=seat.z+.014+(i%2)*.003,h=ground(x,z),radius=.0022+.0004*((j+i)%3),height=.0010+.00035*((j+2*i)%3),stone=new THREE.Mesh(new THREE.IcosahedronBufferGeometry(1,1),stoneMat);stone.position.copy(h.point).addScaledVector(h.face.normal,height*.42);stone.scale.set(radius,height,radius*.8);stone.rotation.y=(j*3+i)*1.74;stone.castShadow=true;stone.receiveShadow=true;fragments.add(stone);}}
 root.add(fragments);root.userData={seats,contacts,probes:root.children.flatMap(c=>c.userData.probes||[]),fragmentCount:fragments.children.length};return root;
}

function installSuitSurface(material,kind){
 material.customProgramCacheKey=()=> 'grounded-pilot-surface-1';
 material.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 vPilotLocal;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPilotLocal=position;');
  s.fragmentShader='varying vec3 vPilotLocal;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float dust=(1.-smoothstep(.12,.68,vPilotLocal.y))*.20;
 float grain=fract(sin(dot(floor(vPilotLocal.xz*95.),vec2(41.7,289.3)))*43758.5453);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.178,.158),dust*(.65+.35*grain));`);
 };
}

function installContactOcclusion(material,contacts){
 const enabled={value:1};const centers=contacts.map(c=>new THREE.Vector3(...c.position)),radii=contacts.map(c=>new THREE.Vector2(...c.radii));const prior=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.customProgramCacheKey=()=>key()+'-seated-contact-1';
 material.onBeforeCompile=function(s,...args){prior.call(this,s,...args);Object.assign(s.uniforms,{contactEnabled:enabled,contactCenters:{value:centers},contactRadii:{value:radii}});s.fragmentShader=`uniform float contactEnabled;uniform vec3 contactCenters[${centers.length}];uniform vec2 contactRadii[${centers.length}];\n`+s.fragmentShader;
 s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
 float contactAO=1.;if(contactEnabled>.5){for(int i=0;i<${centers.length};i++){vec3 d=vLunarWorld-contactCenters[i];vec2 q=d.xz/contactRadii[i];float influence=(1.-smoothstep(.08,1.,dot(q,q)))*(1.-smoothstep(.003,.016,abs(d.y)));contactAO*=1.-influence*.48;}}
 reflectedLight.indirectDiffuse*=contactAO;`);
 };
 return {setEnabled(v){enabled.value=v?1:0}};
}

return {createGroundedCrew, installContactOcclusion};
}
