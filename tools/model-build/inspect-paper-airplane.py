"""Convert an existing CC0 mesh for an isolated mini-program compatibility check."""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
out=root/'source-models/paper-airplane-cc0'
bpy.ops.wm.open_mainfile(filepath=str(out/'paper_airplane_0.blend'),load_ui=False,use_scripts=False)
o=bpy.data.objects['PaperAirplane'];mesh=o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh();mesh.calc_loop_triangles()
data={'position':[],'normal':[],'uv':[]}
for tri in mesh.loop_triangles:
 for li in tri.loops:
  v=mesh.vertices[mesh.loops[li].vertex_index]
  data['position']+=list(o.matrix_world@v.co)
  data['normal']+=list((o.matrix_world.to_3x3().inverted().transposed()@tri.normal).normalized())
  data['uv']+=list(mesh.uv_layers.active.data[li].uv)
(out/'paper-airplane.geometry.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
img=bpy.data.images['lined_paper.png'];img.filepath_raw=str(out/'lined_paper.png');img.file_format='PNG';img.save()
report={'sourceVertices':len(o.data.vertices),'triangles':len(mesh.loop_triangles),'renderVertices':len(data['position'])//3,'textureSize':list(img.size),'meshCount':1,'materialCount':1,'textureCount':1,'sourceSha256':hashlib.sha256((out/'paper_airplane_0.blend').read_bytes()).hexdigest()}
(out/'inspection.json').write_text(json.dumps(report,indent=2)+'\n');print(report)
# Reconnect the packed original image: Blender Internal material predates current nodes.
m=bpy.data.materials['Material'];m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.85
tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=img;m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
bpy.ops.export_scene.gltf(filepath=str(out/'paper-airplane.glb'),use_selection=True,export_animations=False)
# Asset inspection render; no procedural redesign or scene changes to the mini-program.
for ob in list(bpy.data.objects):
 if ob!=o:bpy.data.objects.remove(ob,do_unlink=True)
pts=[o.matrix_world@Vector(c) for c in o.bound_box];c=sum(pts,Vector())/8;s=max(o.dimensions)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.035,.035,.035,1)
bpy.ops.object.camera_add(location=c+Vector((1.1,-1.7,1.3))*s);cam=bpy.context.object;cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=52;scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=c+Vector((0,-1,2))*s);light=bpy.context.object;light.rotation_euler=(c-light.location).to_track_quat('-Z','Y').to_euler();light.data.energy=150*s*s;light.data.size=s
scene.render.resolution_x=800;scene.render.resolution_y=650;scene.render.resolution_percentage=100;scene.render.filepath=str(out/'inspection-preview.png');bpy.ops.render.render(write_still=True)
