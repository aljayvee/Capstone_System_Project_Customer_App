"""Smooth the user's actual HTML rider and bake its Pack + Box motion in Blender."""
import json
import math
import runpy
import sys
import shutil
from pathlib import Path
from collections import defaultdict

import bpy
import bmesh
from mathutils import Matrix, Vector

SOURCE=Path(__file__).resolve().parent
ROOT=SOURCE.parents[1]
WORK=ROOT/'scratch/kuya-sugo-blender'
sys.path.insert(0,str(SOURCE))
import blender_geometry as g
from build_faceless_mascot import configure_render


def matrix(values):
    return Matrix([values[i:i+4] for i in range(0,16,4)]).transposed()


def main():
    data=json.loads((SOURCE/'reference/model-pack-box.json').read_text(encoding='utf-8'))
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    convert=Matrix.Rotation(math.pi/2,4,'X')
    nodes={node['id']:node for node in data['objects']}
    def visible(node):
        return node['visible'] and (node['parent'] is None or visible(nodes[node['parent']]))
    groups=[n for n in nodes.values() if n['type']=='GROUP' and visible(n)]
    materials={}
    for name,mat in data['materials'].items():
        color='#F62459' if name=='pinkShirt' else mat['color']
        roughness=.72 if name in ('pinkShirt','pinkTrim','darkBluePants') else max(.48,mat['roughness'])
        materials[name]=g.material(name,color,roughness,metal=0)
    buckets=defaultdict(list)
    for node in nodes.values():
        if node['type']!='MESH' or not visible(node):
            continue
        transform=convert@matrix(node['world'])
        raw=node['positions']
        vertices=[transform@Vector(raw[i:i+3]) for i in range(0,len(raw),3)]
        indices=node['indices'] or list(range(len(vertices)))
        faces=[indices[i:i+3] for i in range(0,len(indices),3)]
        mesh=bpy.data.meshes.new(node['name'])
        mesh.from_pydata(vertices,[],faces)
        bm=bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=.00001)
        bmesh.ops.dissolve_limit(bm,angle_limit=.0001,verts=bm.verts,edges=bm.edges)
        bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()
        obj=bpy.data.objects.new(node['name'],mesh)
        bpy.context.collection.objects.link(obj)
        g.finish(obj,obj.name,materials[node['material']])
        bpy.context.view_layer.objects.active=obj
        if node['geometryType']=='BoxGeometry':
            p=node['parameters']
            bevel=obj.modifiers.new('Rounded reference edges','BEVEL')
            bevel.width=min(.05,min(p['width'],p['height'],p['depth'])*.24)
            bevel.segments=6
            bpy.ops.object.modifier_apply(modifier=bevel.name)
        buckets[(node['parent'],node['material'])].append(obj)
    parts=[]
    for (parent,material),objects in buckets.items():
        name=nodes[parent]['name']+' / '+material
        # Continuous anatomical volumes, retaining the reference's pecs and V taper.
        organic=(material=='whiteSharpSkin' and nodes[parent]['name'] not in ('leftAnkle','rightAnkle')) or (material=='pinkShirt' and nodes[parent]['name'] in ('chestGroup','spineGroup')) or (material=='darkBluePants' and nodes[parent]['name'] in ('leftHip','rightHip','leftKnee','rightKnee'))
        if organic:
            if nodes[parent]['name']=='headGroup':
                # Retain the reference's sculpted skull/jaw, while removing its
                # unfinished cheek/brow overlay blocks rather than polishing bumps.
                obj=objects[0]
                original_min=Vector(tuple(min(v.co[i] for v in obj.data.vertices) for i in range(3)))
                original_max=Vector(tuple(max(v.co[i] for v in obj.data.vertices) for i in range(3)))
                for extra in objects[1:]:
                    bpy.data.objects.remove(extra,do_unlink=True)
                bm=bmesh.new()
                bm.from_mesh(obj.data)
                hull=bmesh.ops.convex_hull(bm,input=list(bm.verts),use_existing_faces=False)
                bmesh.ops.delete(bm,geom=hull.get('geom_interior',[])+hull.get('geom_unused',[]),context='VERTS')
                bm.to_mesh(obj.data)
                bm.free()
                bpy.context.view_layer.objects.active=obj
                smooth=obj.modifiers.new('Continuous faceless surface','SMOOTH')
                smooth.factor,smooth.iterations=.9,12
                bpy.ops.object.modifier_apply(modifier=smooth.name)
                sub=obj.modifiers.new('Smooth reference skull','SUBSURF')
                sub.levels=sub.render_levels=2
                bpy.ops.object.modifier_apply(modifier=sub.name)
                current_min=Vector(tuple(min(v.co[i] for v in obj.data.vertices) for i in range(3)))
                current_max=Vector(tuple(max(v.co[i] for v in obj.data.vertices) for i in range(3)))
                for vertex in obj.data.vertices:
                    for axis in range(3):
                        vertex.co[axis]=original_min[axis]+(vertex.co[axis]-current_min[axis])*(original_max[axis]-original_min[axis])/(current_max[axis]-current_min[axis])
                obj.name=name
                for face in obj.data.polygons:
                    face.use_smooth=True
            else:
                obj=g.sculpt_union(name,objects,.015)
                smooth=obj.modifiers.new('Relax sculpted planes','SMOOTH')
                smooth.factor,smooth.iterations=.8,15
                bpy.context.view_layer.objects.active=obj
                bpy.ops.object.modifier_apply(modifier=smooth.name)
        else:
            bpy.ops.object.select_all(action='DESELECT')
            for obj in objects:
                obj.select_set(True)
            bpy.context.view_layer.objects.active=objects[0]
            bpy.ops.object.join()
            obj=bpy.context.object
            obj.name=name
        obj['Reference group']=nodes[parent]['name']
        parts.append((obj,parent))
    # Wearable straps make the selected backpack readable in the required front view.
    chest=next(n for n in groups if n['name']=='chestGroup')
    chest_matrix=convert@matrix(chest['world'])
    for sign in (-1,1):
        points=[Vector((sign*.34,y,z)) for y,z in ((.58,-.42),(.68,-.10),(.50,.365),(.30,.33),(.10,.27),(-.06,.22))]
        vertices=[chest_matrix@(p+Vector((edge*.037,0,0))) for p in points for edge in (-1,1)]
        mesh=bpy.data.meshes.new('Flat backpack strap')
        mesh.from_pydata(vertices,[],[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(points)-1)])
        obj=bpy.data.objects.new('Pack shoulder strap '+str(sign),mesh)
        bpy.context.collection.objects.link(obj)
        g.finish(obj,obj.name,materials['pinkTrim'])
        sub=obj.modifiers.new('Curved fabric strap','SUBSURF')
        sub.levels=sub.render_levels=2
        solid=obj.modifiers.new('Strap thickness','SOLIDIFY')
        solid.thickness=.012
        parts.append((obj,chest['id']))
    arm=bpy.data.armatures.new('Original HTML kinematic hierarchy')
    rig=bpy.data.objects.new('KUYA_SUGO_RIG',arm)
    bpy.context.collection.objects.link(rig)
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='EDIT')
    names={}
    for node in groups:
        bone=arm.edit_bones.new(node['name'])
        bone.head=(0,0,0)
        bone.tail=(0,.15,0)
        bone.matrix=convert@matrix(node['world'])
        bone.length=.15
        if node['parent'] in names:
            bone.parent=arm.edit_bones[names[node['parent']]]
        bone.use_deform=True
        names[node['id']]=bone.name
    bpy.ops.object.mode_set(mode='OBJECT')
    for obj,parent in parts:
        group=obj.vertex_groups.new(name=names[parent])
        group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
        mod=obj.modifiers.new('Original Pack + Box kinematics','ARMATURE')
        mod.object=rig
    rig.animation_data_create()
    for action_name,samples in [('KuyaSugo_PackBox',data['samples']),('KuyaSugo_Idle',[data['idle'],data['idle']])]:
        action=bpy.data.actions.new(action_name)
        action.use_fake_user=True
        rig.animation_data.action=action
        for i,sample in enumerate(samples):
            frame=i+1 if action_name=='KuyaSugo_PackBox' else (1 if i==0 else 241)
            targets={key:convert@matrix(value) for key,value in sample.items() if key in names}
            for node in groups:
                pb=rig.pose.bones[names[node['id']]]
                parent=node['parent']
                options={'parent_matrix':targets[parent],'parent_matrix_local':arm.bones[names[parent]].matrix_local} if parent in names else {}
                pb.matrix_basis=pb.bone.convert_local_to_pose(targets[node['id']],pb.bone.matrix_local,invert=True,**options)
                pb.rotation_mode='QUATERNION'
                for prop in ('location','rotation_quaternion','scale'):
                    pb.keyframe_insert(prop,frame=frame,group=pb.name)
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:
                            key.interpolation='LINEAR'
    rig.animation_data.action=bpy.data.actions['KuyaSugo_PackBox']
    rig.show_in_front=True
    rig['Source HTML']=data['source']
    rig['Source SHA256']=data['sourceSha256']
    rig['Carry mode']='Pack + Box'
    rig['Surface finish']='Dense parametric surfaces, welded topology, bevels, voxel union, smooth normals and subdivision.'
    scene=bpy.context.scene
    def camera(name,height,scale):
        cam=bpy.data.cameras.new(name)
        obj=bpy.data.objects.new(name,cam)
        bpy.context.collection.objects.link(obj)
        obj.location=(0,-12,height)
        obj.rotation_euler=(math.pi/2,0,0)
        cam.type,cam.ortho_scale='ORTHO',scale
        return obj
    scene.camera=camera('CAM_Onboarding',2.18,4.8)
    camera('CAM_Portrait',3.55,1.4)
    for name,position,power,size in [('Studio key',(-3,-5,6),490,4),('Studio fill',(4,-2,4.5),220,4),('Backpack rim',(1,3,5),480,3)]:
        light=bpy.data.lights.new(name,'AREA')
        light.energy,light.shape,light.size=power,'DISK',size
        obj=bpy.data.objects.new(name,light)
        bpy.context.collection.objects.link(obj)
        obj.location=position
        obj.rotation_euler=(Vector((0,0,2.2))-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.3
    configure_render(scene)
    scene.render.film_transparent=True
    scene.render.image_settings.file_format,scene.render.image_settings.color_mode='PNG','RGBA'
    scene.render.resolution_x,scene.render.resolution_y=768,896
    scene.render.resolution_percentage=100
    scene.render.fps=24
    scene.frame_start,scene.frame_end=1,240
    scene.view_settings.view_transform='AgX'
    scene.frame_set(10)
    bpy.context.view_layer.update()
    WORK.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'kuya-sugo.blend'),compress=True)
    shutil.copy2(SOURCE/'kuya-sugo.blend',SOURCE/'pink-express-pack-box-smooth.blend')
    if '--preview' in sys.argv:
        scene.cycles.samples=32
        scene.render.resolution_x,scene.render.resolution_y=660,770
        scene.render.filepath=str(WORK/'pack-box-preview.png')
        bpy.ops.render.render(write_still=True)
    print('SUGO_REFERENCE_IMPORT_COMPLETE',len(parts),'smooth parts',flush=True)
    if '--export' in sys.argv:
        runpy.run_path(str(SOURCE/'render_mascot.py'))


if __name__=='__main__':
    main()
