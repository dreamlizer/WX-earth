"""Run in background Blender against RX78_game_asset.blend.
Use retained joint weights to bake three static poses; never save over the source.
"""
import bpy
import json
import math
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'source-models/rx78-flight-poses-2026-10-06'
OUT.mkdir(parents=True, exist_ok=True)
body = bpy.data.objects['RX78Body']
assert not any(o.type == 'ARMATURE' for o in bpy.data.objects)
rest = [v.co.copy() for v in body.data.vertices]
groups = [g.name for g in body.vertex_groups]
weights = [[(groups[g.group], g.weight) for g in v.groups if groups[g.group] != 'Group'] for v in body.data.vertices]

def turn(pivot, x=0, y=0, z=0):
    p = Vector(pivot)
    return (Matrix.Translation(p) @ Matrix.Rotation(math.radians(z), 4, 'Z')
            @ Matrix.Rotation(math.radians(y), 4, 'Y')
            @ Matrix.Rotation(math.radians(x), 4, 'X') @ Matrix.Translation(-p))

POSES = {
    'cruise': dict(shoulder=(-38, -32), elbow=(60, 55), hip=(8, 14), knee=(-20, -40)),
    'boost': dict(shoulder=(-25, 145), elbow=(40, -35), hip=(12, 8), knee=(-75, -15)),
    'bank': dict(shoulder=(-45, -20), elbow=(65, 25), hip=(8, 30), knee=(-15, -80)),
}
report = []
for name, pose in POSES.items():
    # The retained Middle.004 group is the helmet / head, not the torso.
    transforms = {'Middle.004': turn((0, .166, 16.283), x=35 if name == 'cruise' else 45 if name == 'boost' else 40)}
    for side, suffix in [(0, ''), (1, '.001')]:
        sign = -1 if side == 0 else 1
        # Pivot measured from the original torso / upper-arm seam ring.
        shoulder = turn((sign * 2.0, -.028, 15.648), pose['shoulder'][side], -sign * 8)
        elbow = shoulder @ turn((sign * 3.12, .2, 13.3), pose['elbow'][side])
        transforms['UArmR' + suffix] = shoulder
        transforms['LArmR' + suffix] = elbow
        transforms['LArmR.002' if side == 0 else 'LArmR.003'] = elbow
        for i in range(6 if side == 0 else 21, 21 if side == 0 else 36):
            transforms['Bone.%03d' % i] = elbow
        transforms['Shield' if side == 0 else 'Bone.036'] = elbow
        hip = turn((sign * 1.25, .25, 10.65), pose['hip'][side], -sign * 3,
                   sign * (18 if name == 'bank' else 10))
        knee = hip @ turn((sign * 1.6, .45, 6.55), pose['knee'][side])
        transforms['UlegR' + suffix] = hip
        transforms['LLegR' + suffix] = knee
        transforms['FootR' + suffix] = knee
    changed = 0
    for v, co, vw in zip(body.data.vertices, rest, weights):
        # Ignore the redundant whole-body Group. Keep unposed torso and skirt
        # weights, so existing blended seams keep their original weighting.
        total = sum(w for _, w in vw)
        if not total:
            v.co = co
            continue
        new = Vector((0, 0, 0))
        for group, weight in vw:
            m = transforms.get(group)
            new += ((m @ co) if m else co) * (weight / total)
        v.co = new
        changed += (new - co).length > .0001
    body.data.update()
    bpy.context.view_layer.update()
    # Check actual coordinates and preserve UVs, materials and polygon topology.
    assert all(math.isfinite(c) for v in body.data.vertices for c in v.co)
    assert len(body.data.vertices) == len(rest)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / (name + '.blend')), check_existing=False)
    bpy.ops.export_scene.gltf(filepath=str(OUT / (name + '.glb')), export_format='GLB',
                              export_animations=False, export_skins=False,
                              export_texcoords=True, export_normals=True,
                              export_materials='EXPORT', export_yup=True)
    report.append(dict(pose=name, degrees=pose, movedVertices=changed,
                       vertices=len(rest), source='RX78_game_asset.blend',
                       method='static bake from retained joint vertex groups'))
(OUT / 'pose-report.json').write_text(json.dumps(report, indent=2))
result = {'poses': report, 'output': str(OUT)}
