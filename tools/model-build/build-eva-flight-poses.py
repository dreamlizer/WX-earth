"""Run in Blender: build isolated, static EVA pursuit poses from retained GLBs.

No source file or existing scene is overwritten. Geometry is normalised to
Y-up, +Z-facing units before measured, smoothly weighted joint adjustments.
Run prepare-eva.py afterwards to atlas and quantise the resulting GLBs.
"""
import bpy
import json
import math
from pathlib import Path
import numpy as np
from mathutils import Matrix

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'source-models/eva-pursuit-flight-2026-10-22'
OUT.mkdir(parents=True, exist_ok=True)
SOURCES = [
    ('unit01', 'eva-unit-01-lefort/evangelion_unit_01.glb', 1.0),
    ('unit02', 'eva-unit-02-ryanwill679/eva_02.glb', .16),
]

def smooth(a, b, x):
    q = np.clip((x - a) / (b - a), 0, 1)
    return q * q * (3 - 2 * q)

def rotate(points, pivot, angles):
    matrix = np.array(Matrix.Rotation(math.radians(angles[2]), 3, 'Z') @
                      Matrix.Rotation(math.radians(angles[1]), 3, 'Y') @
                      Matrix.Rotation(math.radians(angles[0]), 3, 'X'))
    return (points - pivot) @ matrix.T + pivot

reports = []
previous_scene = bpy.context.window.scene
for unit, relative, ratio in SOURCES:
    scene = bpy.data.scenes.new('EVA pursuit build ' + unit)
    bpy.context.window.scene = scene
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'source-models' / relative))
    meshes = [o for o in scene.objects if o.type == 'MESH']
    bpy.context.view_layer.update()
    # Importer uses Blender Z-up; canonical coordinates match the runtime.
    originals = []
    for obj in meshes:
        points = np.array([obj.matrix_world @ v.co for v in obj.data.vertices])
        originals.append(points[:, [0, 2, 1]] * [1, 1, -1])
    all_points = np.concatenate(originals)
    low, high = all_points.min(axis=0), all_points.max(axis=0)
    height = high[1] - low[1]
    origin = np.array([(low[0] + high[0]) / 2, low[1], 0.0])
    body = (all_points - origin) / height
    # Feet at 0; head and shoulder pivots measured against the source body.
    head_y = .83 if unit == 'unit01' else .88
    shoulder_y = .73 if unit == 'unit01' else .78
    elbow_y = .56 if unit == 'unit01' else .57
    hip_y, knee_y = .48, .25
    head_weight = smooth(head_y - .025, head_y + .025, body[:, 1]) * (1 - smooth(.09, .14, np.abs(body[:, 0])))
    posed = body.copy()
    # Lift the helmet so it looks along the flight, not at its own feet.
    posed += (rotate(body, np.array([0, head_y, 0]), [-32 if unit == 'unit01' else -27, 0, 0]) - body) * head_weight[:, None]
    joint_report = []
    for side in [-1, 1]:
        x, y = body[:, 0] * side, body[:, 1]
        arm_weight = smooth(.095, .15, x) * smooth(.43, .50, y) * (1 - smooth(shoulder_y + .025, shoulder_y + .075, y))
        shoulder = np.array([side * .12, shoulder_y, 0])
        elbow = np.array([side * .16, elbow_y, .005])
        forearm_weight = 1 - smooth(elbow_y - .03, elbow_y + .035, y)
        elbow_angle = -48 if (side == -1) == (unit == 'unit01') else -27
        arm = body + (rotate(body, elbow, [elbow_angle, 0, 0]) - body) * forearm_weight[:, None]
        arm = rotate(arm, shoulder, [-14 if unit == 'unit01' else -20, 0, side * -7])
        posed += (arm - body) * arm_weight[:, None]
        leg_weight = smooth(-.02, .025, x) * (1 - smooth(hip_y - .035, hip_y + .025, y))
        hip = np.array([side * .065, hip_y, 0])
        knee = np.array([side * .075, knee_y, 0])
        lower = 1 - smooth(knee_y - .025, knee_y + .03, y)
        knee_angle = (46 if side == 1 else 19) if unit == 'unit01' else (24 if side == 1 else 52)
        leg = body + (rotate(body, knee, [knee_angle, 0, 0]) - body) * lower[:, None]
        leg = rotate(leg, hip, [-8 if side == 1 else 4, 0, side * -4])
        posed += (leg - body) * leg_weight[:, None]
        joint_report.append(dict(side=side, armVertices=int((arm_weight > .5).sum()), legVertices=int((leg_weight > .5).sum()), elbowDegrees=elbow_angle, kneeDegrees=knee_angle))
    assert np.isfinite(posed).all()
    index = 0
    for obj, original in zip(meshes, originals):
        count = len(original)
        canonical = posed[index:index + count] - [0, .5, 0]
        # Store in Blender world coordinates with parents safely detached.
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)
        coords = canonical[:, [0, 2, 1]] * [1, -1, 1]
        obj.data.vertices.foreach_set('co', coords.astype(np.float32).ravel())
        obj.data.update()
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        if ratio < 1:
            modifier = obj.modifiers.new('Mobile pursuit silhouette', 'DECIMATE')
            modifier.ratio = ratio
            modifier.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        index += count
    bpy.context.view_layer.update()
    # Only this new scene is exported. Original source scenes/data stay intact.
    bpy.ops.export_scene.gltf(filepath=str(OUT / (unit + '-flight.glb')), export_format='GLB',
                              export_animations=False, export_skins=False,
                              use_active_scene=True, export_yup=True,
                              export_texcoords=True, export_normals=True)
    triangles = sum(len(o.data.loop_triangles) if o.data.loop_triangles else sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
    reports.append(dict(unit=unit, source=relative, sourceVertices=len(body), triangles=triangles,
                        reduction=ratio, headVertices=int((head_weight>.5).sum()), joints=joint_report,
                        movedVertices=int((np.linalg.norm(posed-body,axis=1)>.0001).sum()),
                        method='offline spatial joint weights and static pose bake; no runtime rig'))
bpy.context.window.scene = previous_scene
(OUT / 'pose-report.json').write_text(json.dumps(reports, indent=2) + '\n')
result = {'output': str(OUT), 'poses': reports}
