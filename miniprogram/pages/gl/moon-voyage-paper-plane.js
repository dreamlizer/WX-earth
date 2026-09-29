const DATA = require('../../assets/models/paper-airplane.js');
const smooth = x => { x = Math.max(0, Math.min(1, x)); return x*x*(3-2*x); };

// CC0 mesh by Clint Bellanger. One quiet encounter, before the Moon appears.
export class PaperPlaneEffect {
  setContext({ THREE, scene, camera, isPCClient }) {
    this.dispose(); this.THREE=THREE; this.scene=scene; this.camera=camera; this.isPCClient=isPCClient;
  }
  preload() { return Promise.resolve(); }
  _create() {
    const T=this.THREE, geometry=new T.BufferGeometry();
    for(const [name,size] of [['position',3],['normal',3],['uv',2]]) geometry.addAttribute(name,new T.Float32BufferAttribute(DATA[name],size));
    geometry.computeBoundingBox();
    const center=geometry.boundingBox.getCenter(new T.Vector3());
    geometry.translate(-center.x,-center.y,-center.z);
    geometry.scale(4,4,4); geometry.rotateX(Math.PI/2);
    const material=new T.MeshLambertMaterial({color:0x707780,side:T.DoubleSide,transparent:true,opacity:0,depthWrite:false});
    const mesh=new T.Mesh(geometry,material);mesh.name='MoonVoyagePaperPlane';this.mesh=mesh;this.scene.add(mesh);

  }
  update({t,node1Time}) {
    const elapsed=t-node1Time;
    if(elapsed<2 || elapsed>=38){if(this.mesh)this.mesh.visible=false;return;}
    if(!this.mesh)this._create();
    const m=this.mesh,T=this.THREE;
    // 40–58s: approach. 58–76s: pass to the right and recede; no camera edits.
    const p=smooth((elapsed-2)/18),q=smooth((elapsed-20)/18);
    const x=-1.15+1.5*p+2.4*q, y=.65-.15*p+1.5*q, z=-17+12*p-7*q;
    const local=new T.Vector3(x,y,z).applyQuaternion(this.camera.quaternion);
    m.position.copy(this.camera.position).add(local);
    m.quaternion.copy(this.camera.quaternion);
    m.rotateY(-.32+.7*p+.5*q);m.rotateX(.62);m.rotateZ(-.18+.3*p-.5*q);
    m.material.opacity=smooth((elapsed-2)/3)*(1-smooth((elapsed-34)/4));
    m.visible=m.material.opacity>.001;
  }
  reset(){this.dispose();}
  dispose(){
    if(this.mesh){this.mesh.parent?.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.material.dispose();this.mesh=null;}
  }
}
