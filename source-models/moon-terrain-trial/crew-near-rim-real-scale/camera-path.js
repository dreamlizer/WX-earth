import * as THREE from 'three';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10)};
const V=a=>new THREE.Vector3(...a);
function track(keys,t){
 let i=0;while(i<keys.length-2&&t>keys[i+1].t)i++;
 const a=keys[i],b=keys[i+1],dt=b.t-a.t,u=clamp((t-a.t)/dt),u2=u*u,u3=u2*u;
 // Shape-preserving per-axis tangents prevent a fast descent overshooting the slow approach.
 const slope=k=>{if(k===0||keys[k].stop)return new THREE.Vector3();if(k===keys.length-1)return keys[k].v.clone().sub(keys[k-1].v).divideScalar(keys[k].t-keys[k-1].t);const hp=keys[k].t-keys[k-1].t,hn=keys[k+1].t-keys[k].t,w1=2*hn+hp,w2=hn+2*hp,result=new THREE.Vector3();for(const axis of ['x','y','z']){const before=(keys[k].v[axis]-keys[k-1].v[axis])/hp,after=(keys[k+1].v[axis]-keys[k].v[axis])/hn;result[axis]=before*after>0?(w1+w2)/(w1/before+w2/after):0;}return result;};
 return a.v.clone().multiplyScalar(2*u3-3*u2+1).addScaledVector(slope(i),(u3-2*u2+u)*dt).addScaledVector(b.v,-2*u3+3*u2).addScaledVector(slope(i+1),(u3-u2)*dt);
}
export function createCameraPath(anchor,layout){
 const [X,H,Z]=layout.center;
 const center=V(anchor.moonCenter),start=V(anchor.position),end=V([400,600,950]),d0=start.clone().sub(center),d1=end.clone().sub(center),r0=d0.length(),r1=d1.length();d0.normalize();d1.normalize();
 const arc=new THREE.Quaternion().setFromUnitVectors(d0,d1);
 const nodes=[];let previousTwist=null;
 for(const t of [193,196,199,202,205]){const u=(t-193)/12,q=new THREE.Quaternion().identity().slerp(arc,u);const radius=Math.exp(Math.log(r0)*(1-u)+Math.log(r1)*u);const pos=d0.clone().applyQuaternion(q).multiplyScalar(radius).add(center);const look=center.clone().lerp(V([0,-60,0]),smooth(u));const up=V([0,1,0]).applyQuaternion(new THREE.Quaternion(...anchor.quaternion)).applyQuaternion(q);const direction=look.clone().sub(pos).normalize();up.addScaledVector(direction,-up.dot(direction)).normalize();const upright=V([0,1,0]).addScaledVector(direction,-direction.y).normalize();let twist=Math.atan2(direction.dot(up.clone().cross(upright)),up.dot(upright));if(previousTwist!==null){while(twist-previousTwist>Math.PI)twist-=2*Math.PI;while(twist-previousTwist<-Math.PI)twist+=2*Math.PI;}previousTwist=twist;up.applyAxisAngle(direction,twist*smooth((t-193)/15));nodes.push({t,p:pos.toArray(),look:(t===205?[-80,-60,0]:look.toArray()),up:up.toArray()});}
 nodes.push(
 {t:208,p:[110,145,240],look:[-80,8,-30]},
 {t:212,p:[95,90,170],look:[-80,8,-30]},
 {t:216,p:[82,58,125],look:[25,-36,-30]},
 {t:222,p:[44,27,70],look:[25,-20,5]},
 {t:228,p:[35,12,48],look:[X,H+.02,Z]},
 {t:233,p:[X+.30,H+1.25,Z+2.8],look:[X,H+.025,Z]},
 {t:237,p:[X+.12,H+.70,Z+1.50],look:[X,H+.035,Z]},
 {t:241,p:[X+.10,H+.62,Z+1.35],look:[X,H+.12,Z]},
 {t:245,p:[X+.08,H+.57,Z+1.25],look:[X,H+.57-Math.tan(8.5*Math.PI/180)*10,Z-8.75]},
 {t:255,p:[X+.04,H+.53,Z+1.18],look:[X,H+.53-Math.tan(8*Math.PI/180)*10,Z-8.82]},
 {t:271.7266666666667,p:[X,H+.49,Z+1.10],look:[X,H+.49-Math.tan(7.5*Math.PI/180)*10,Z-8.90]});
 const rotations=nodes.map(n=>{const dir=V(n.look).sub(V(n.p)).normalize();const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(V(n.p),V(n.p).add(dir),V(n.up||[0,1,0])));return {t:n.t,q}});rotations[0].q.fromArray(anchor.quaternion);
 const log=q=>{if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);const a=Math.acos(clamp(q.w,-1,1)),s=Math.sin(a);return Math.abs(s)<1e-8?new THREE.Vector3():new THREE.Vector3(q.x,q.y,q.z).multiplyScalar(a/s)};
 const exp=v=>{const a=v.length(),s=a<1e-8?1:Math.sin(a)/a;return new THREE.Quaternion(v.x*s,v.y*s,v.z*s,Math.cos(a))};
 const velocities=rotations.map((r,i)=>{if(i===0||i===rotations.length-1||r.stop)return new THREE.Vector3();const inv=r.q.clone().invert(),before=log(inv.clone().multiply(rotations[i-1].q)).multiplyScalar(-1/(r.t-rotations[i-1].t)),after=log(inv.clone().multiply(rotations[i+1].q)).multiplyScalar(1/(rotations[i+1].t-r.t));return before.add(after).multiplyScalar(.5)});
 function orientation(t){let i=0;while(i<rotations.length-2&&t>rotations[i+1].t)i++;const a=rotations[i],b=rotations[i+1],dt=b.t-a.t,u=clamp((t-a.t)/dt),c=a.q.clone().multiply(exp(velocities[i].clone().multiplyScalar(dt/3))),d=b.q.clone().multiply(exp(velocities[i+1].clone().multiplyScalar(-dt/3)));const ab=a.q.clone().slerp(c,u),bc=c.clone().slerp(d,u),cd=d.clone().slerp(b.q,u);return ab.slerp(bc,u).slerp(bc.slerp(cd,u),u)}
 const positions=nodes.map(n=>({t:n.t,v:V(n.p),stop:n.stop}));
 const directions=nodes.map(n=>({t:n.t,v:V(n.look).sub(V(n.p)).normalize(),stop:n.stop}));
 const ups=nodes.map(n=>({t:n.t,v:V(n.up||[0,1,0]),stop:n.stop}));
 return {nodes,at(t){t=clamp(t,193,271.7266666666667);return {position:track(positions,t),quaternion:orientation(t),direction:track(directions,t).normalize(),up:track(ups,t).normalize(),fov:45+10*smooth((t-193)/15)-12*smooth((t-222)/11)+1*smooth((t-237)/8)}}};
}
