"""Run with Blender --background --factory-startup --disable-autoexec --python."""
import bpy, json
from pathlib import Path

root = Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.wm.obj_import(filepath=str(root / 'extracted/LAN_Mesher_01.obj'))
obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
original_faces = len(obj.data.polygons)
original_vertices = len(obj.data.vertices)
mod = obj.modifiers.new('Trial 80k triangles', 'DECIMATE')
mod.ratio = min(1, 80000 / sum(len(p.vertices)-2 for p in obj.data.polygons))
bpy.ops.object.modifier_apply(modifier=mod.name)
for p in obj.data.polygons: p.use_smooth = True
obj.data.materials.clear()
bpy.ops.export_scene.gltf(filepath=str(root / 'preview/assets/terrain.glb'), export_format='GLB', use_selection=True, export_materials='NONE', export_animations=False)
stats = {'source_vertices': original_vertices, 'source_faces': original_faces, 'trial_vertices': len(obj.data.vertices), 'trial_triangles': sum(len(p.vertices)-2 for p in obj.data.polygons), 'blender_bounds': [[min(v.co[i] for v in obj.data.vertices), max(v.co[i] for v in obj.data.vertices)] for i in range(3)]}
(root / 'preview/assets/mesh-stats.json').write_text(json.dumps(stats, indent=2))
print(json.dumps(stats))
