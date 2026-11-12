"""Run in Blender to check the actual selected Pack + Box reference model."""
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector

source=Path(__file__).resolve().parent
sys.path.insert(0,str(source))
from blender_geometry import linear
reference=json.loads((source/'reference/model-pack-box.json').read_text(encoding='utf-8'))
scene=bpy.context.scene
rig=bpy.data.objects['KUYA_SUGO_RIG']
assert rig['Source SHA256']==reference['sourceSha256']
assert rig['Carry mode']=='Pack + Box'
assert {'backpackGroup','deliveryBoxGroup'} <= set(rig.pose.bones.keys())
assert not {'hatGroup','brimGroup'} & set(rig.pose.bones.keys())
camera=bpy.data.objects['CAM_Onboarding']
assert camera.data.type=='ORTHO' and abs(camera.location.x)<1e-6
assert (camera.matrix_world.to_quaternion()@Vector((0,0,-1))).dot(Vector((0,1,0)))>.99999
assert scene.render.fps==24 and scene.frame_start==1 and scene.frame_end==240
assert tuple(bpy.data.materials['whiteSharpSkin'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value)==(1,1,1,1)
color=bpy.data.materials['darkBluePants'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value
assert all(abs(a-b)<1e-5 for a,b in zip(color,(*linear('#172554'),1)))
meshes=[o for o in scene.objects if o.type=='MESH' and len(o.vertex_groups)]
assert all(any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers) for o in meshes), 'Every weighted part must retain its live rig attachment'
assert all(all(p.use_smooth for p in o.data.polygons) for o in meshes)
assert len(bpy.data.objects['headGroup / whiteSharpSkin'].data.polygons)>1000
assert rig.get('Chibi reference')=='reference/chibi-style-reference.png'
graph=bpy.context.evaluated_depsgraph_get()
head=bpy.data.objects['headGroup / whiteSharpSkin'].evaluated_get(graph)
head_points=[head.matrix_world@Vector(p) for p in head.bound_box]
head_width=max(p.x for p in head_points)-min(p.x for p in head_points)
head_height=max(p.z for p in head_points)-min(p.z for p in head_points)
assert .9 < head_width/head_height < 1.1, 'Chibi head must have a round front silhouette'
all_points=[o.evaluated_get(graph).matrix_world@Vector(p) for o in meshes for p in o.evaluated_get(graph).bound_box]
assert .35 < head_height/(max(p.z for p in all_points)-min(p.z for p in all_points)) < .48
assert sum(o.get('Reference group')=='backpackGroup' for o in meshes)>=3
assert sum(o.get('Reference group')=='deliveryBoxGroup' for o in meshes)>=4
half_height=camera.data.ortho_scale/2
half_width=half_height*6/7
poses=[]
for frame in (1,48,120,180,240):
    scene.frame_set(frame)
    graph=bpy.context.evaluated_depsgraph_get()
    points=[obj.evaluated_get(graph).matrix_world@Vector(corner)
            for obj in meshes for corner in obj.evaluated_get(graph).bound_box]
    assert min(p.x for p in points)>-half_width and max(p.x for p in points)<half_width
    assert min(p.z for p in points)>camera.location.z-half_height
    assert max(p.z for p in points)<camera.location.z+half_height
    poses.append({'frame':frame,'minZ':min(p.z for p in points),'maxZ':max(p.z for p in points)})
assert tuple(bpy.data.actions['KuyaSugo_PackBox'].frame_range)==(1,241)
assert tuple(bpy.data.actions['KuyaSugo_Wave'].frame_range)==(1,241)
print('SUGO_REFERENCE_SCENE_VALID',json.dumps({'source':reference['source'],'carryMode':'Pack + Box','smooth':True,'faceless':True,'headwear':False,'facing':'front','durationSeconds':10,'poses':poses}),flush=True)
