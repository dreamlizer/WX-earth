const smooth = x => { x=Math.max(0,Math.min(1,x)); return x*x*(3-2*x); };
const rampIntegral = (x,d) => x<=0?0:x>=d?x-d/2:d*(Math.pow(x/d,3)-.5*Math.pow(x/d,4));
export const FLOW_COUNT = 840;
// Camera-relative depth, not a scrolling backdrop. Motion stays continuous when scrubbing.
export function flowMotion(elapsed) {
  return {
    speed:8*smooth((elapsed+10)/18)-5.5*smooth((elapsed-10)/3)+15.5*smooth((elapsed-24)/6),
    distance:8*rampIntegral(elapsed+10,18)-5.5*rampIntegral(elapsed-10,3)+15.5*rampIntegral(elapsed-24,6),
    lateral:.48*(elapsed+47-rampIntegral(elapsed+10,18))
  };
}
export function createStarFlow(T) {
  const group=new T.Group();
  const geometry=new T.BufferGeometry();
  geometry.addAttribute('position',new T.BufferAttribute(new Float32Array(FLOW_COUNT*3),3));
  geometry.addAttribute('color',new T.BufferAttribute(new Float32Array(FLOW_COUNT*3),3));
  const points=new T.Points(geometry,new T.PointsMaterial({size:.052,vertexColors:T.VertexColors,transparent:true,opacity:.85,depthWrite:false}));
  const trailGeometry=new T.BufferGeometry();
  trailGeometry.addAttribute('position',new T.BufferAttribute(new Float32Array(FLOW_COUNT*6),3));
  trailGeometry.addAttribute('color',new T.BufferAttribute(new Float32Array(FLOW_COUNT*6),3));
  const trails=new T.LineSegments(trailGeometry,new T.LineBasicMaterial({vertexColors:T.VertexColors,transparent:true,opacity:.6,depthWrite:false}));
  group.add(points,trails);group.visible=false;
  return {group,points,trails};
}
export function updateStarFlow(flow,elapsed,voyageTime=elapsed+47) {
  const {distance,speed,lateral}=flowMotion(elapsed);
  const opacity=smooth(voyageTime/6)*(1-smooth((elapsed-36)/5));
  flow.group.visible=opacity>.001;
  if(!flow.group.visible)return;
  const p=flow.points.geometry.attributes,c=flow.trails.geometry.attributes;
  for(let i=0;i<FLOW_COUNT;i++) {
    const angle=i*2.399963, radius=.15+Math.sqrt(((i*73)%839)/839)*8;
    const x=((32*((i*317)%839)/839-16+lateral+16)%32+32)%32-16,y=Math.sin(angle)*radius*1.5;
    const z=-1.4-(((i*.319-distance)%56+56)%56);
    const fade=smooth((-z-1.4)/2)*smooth((z+57.4)/9);
    // These same foreground stars are present during departure, before turning in depth.
    const density=i<280?1:smooth((elapsed+12-12*(i-280)/560)/12);
    const brightness=opacity*fade*density*(.5+((i*31)%97)/194);
    const tail=speed*.07;
    const j=i*3,k=i*6,positions=p.position.array,colors=p.color.array;
    const trails=c.position.array,trailColors=c.color.array;
    positions[j]=x;positions[j+1]=y;positions[j+2]=z;
    colors[j]=brightness*.7;colors[j+1]=brightness*.82;colors[j+2]=brightness;
    trails[k]=x;trails[k+1]=y;trails[k+2]=z;
    trails[k+3]=x;trails[k+4]=y;trails[k+5]=z-tail;
    trailColors[k]=brightness*.7;trailColors[k+1]=brightness*.82;trailColors[k+2]=brightness;
    trailColors[k+3]=trailColors[k+4]=trailColors[k+5]=0;
  }
  for(const a of [p.position,p.color,c.position,c.color])a.needsUpdate=true;
}
export function disposeStarFlow(flow) {
  if(!flow)return;
  if(flow.group.parent)flow.group.parent.remove(flow.group);
  for(const mesh of [flow.points,flow.trails]){mesh.geometry.dispose();mesh.material.dispose();}
}
