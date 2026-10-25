"""Native-density patch from the original OBJ. Never alters the whole-terrain trial."""
import bpy, bmesh, json
from pathlib import Path

root = Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.wm.obj_import(filepath=str(root / 'extracted/LAN_Mesher_01.obj'))
obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
bm=bmesh.new(); bm.from_mesh(obj.data)
# Blender Y = -source Z after OBJ Y-up conversion.
outside=[v for v in bm.verts if not (0 <= v.co.x <= .75 and -.75 <= v.co.y <= .25)]
bmesh.ops.delete(bm,geom=outside,context='VERTS')
bm.to_mesh(obj.data); bm.free()
for uv in obj.data.uv_layers.active.data:
    uv.uv.x=(uv.uv.x-.5)/.375
    uv.uv.y=(uv.uv.y-.125)/.5
for p in obj.data.polygons: p.use_smooth=True
obj.data.materials.clear()
bpy.ops.export_scene.gltf(filepath=str(root/'crop-preview/assets/terrain.glb'),export_format='GLB',use_selection=True,export_materials='NONE',export_animations=False)
stats={'vertices':len(obj.data.vertices),'triangles':sum(len(p.vertices)-2 for p in obj.data.polygons),'decimation':False,'texture_pixels':[3072,4096],'source_image_crop':[4096,3072,7168,7168],'source_area_fraction':.1875}
(root/'crop-preview/assets/stats.json').write_text(json.dumps(stats,indent=2))
print(json.dumps(stats))
