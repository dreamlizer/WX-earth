import bpy, math, random, bmesh
from mathutils import Vector
from pathlib import Path
ROOT=Path('/Users/a1234/Documents/Codex项目/wx-earth')
OUT=ROOT/'docs/reviews/solar-sail'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'source-models/solar-sail-nasa/Solar Sail Concept.glb'))
model=bpy.context.selected_objects[0]
model.rotation_mode='XYZ'
model.visible_shadow=False # Thin overlapping source membranes: avoid coplanar ray self-shadow in lookdev.
# Source custom normals are unsuitable for a close material study.
if model.data.has_custom_normals:
 bpy.ops.mesh.customdata_custom_splitnormals_clear()
bm=bmesh.new();bm.from_mesh(model.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=0.00001)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.to_mesh(model.data);bm.free()
for poly in model.data.polygons: poly.use_smooth=False

# Preserve source geometry; center for reproducible portrait composition.
pts=[model.matrix_world@Vector(c) for c in model.bound_box]
center=sum(pts,Vector())/8
model.location-=center
model.rotation_euler.x=math.radians(-23)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=48
scene.cycles.use_denoising=True
scene.render.resolution_x=780;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(0,0,0,1)
scene.view_settings.view_transform='AgX'
bpy.ops.object.camera_add(location=(-18,-24,11))
cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.5))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=48;scene.camera=cam
# Off-frame sources: soft key and very restrained cool reflection.
def area(name,loc,power,size,color):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
area('Warm distant key',(-15,8,13),6500,8,(1,.93,.83))
area('Cool restrained fill',(-8,-15,1),650,12,(.63,.75,1))
# Sparse background points are scene geometry, not a painted replacement for the model.
random.seed(81)
q=cam.rotation_euler.to_quaternion();right=q@Vector((1,0,0));up=q@Vector((0,1,0));forward=q@Vector((0,0,-1))
star=bpy.data.materials.new('Quiet stars');star.use_nodes=True
ns=star.node_tree.nodes;ns.clear();em=ns.new('ShaderNodeEmission');em.inputs[0].default_value=(.66,.75,1,1);em.inputs[1].default_value=.65;out=ns.new('ShaderNodeOutputMaterial');star.node_tree.links.new(em.outputs[0],out.inputs[0])
verts=[];faces=[]
for i in range(200):
 p=cam.location+forward*65+right*random.uniform(-16,16)+up*random.uniform(-25,25);r=random.uniform(.008,.025);k=len(verts)
 verts.extend([p-right*r-up*r,p+right*r-up*r,p+up*r]);faces.append((k,k+1,k+2))
mesh=bpy.data.meshes.new('Stars');mesh.from_pydata(verts,[],faces);o=bpy.data.objects.new('Stars',mesh);scene.collection.objects.link(o);mesh.materials.append(star)
# Source baseline under the exact same camera/light, for an honest comparison.
scene.render.filepath=str(OUT/'01-source.png');bpy.ops.render.render(write_still=True)
for m in model.data.materials:
 if not m:continue
 m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
 if not p:continue
 name=m.name.lower()
 p.inputs['Metallic'].default_value=.65;p.inputs['Roughness'].default_value=.38
 if 'sailfaces' in name or 'sailedge' in name:
  p.inputs['Base Color'].default_value=(.47,.5,.54,1)
  p.inputs['Metallic'].default_value=.78;p.inputs['Roughness'].default_value=.34
  n=m.node_tree.nodes;l=m.node_tree.links
  tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=95;tex.inputs['Detail'].default_value=2;tex.inputs['Roughness'].default_value=.6
  coord=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(1,1,4)
  l.new(coord.outputs['Generated'],mapping.inputs[0]);l.new(mapping.outputs[0],tex.inputs['Vector'])
  bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.18;bump.inputs['Distance'].default_value=.013;l.new(tex.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs[0],p.inputs['Normal'])
 elif 'gold' in name or 'bronze' in name:
  p.inputs['Base Color'].default_value=(.38,.28,.14,1)
 elif 'blue' in name or name.endswith('panel1') or name.endswith('panel2'):
  p.inputs['Base Color'].default_value=(.025,.052,.095,1);p.inputs['Roughness'].default_value=.29
 else:
  p.inputs['Base Color'].default_value=(.23,.26,.29,1)
scene.render.filepath=str(OUT/'02-silver-sail.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'solar-sail-lookdev.blend'))
bpy.ops.render.render(write_still=True)
