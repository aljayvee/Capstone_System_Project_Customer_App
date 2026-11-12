"""Kuya Sugo v3: an original human courier, with an official Rigify control rig.

The flat app logo is authored separately by export_flat_logo.mjs. This scene
never renders launcher artwork. Run through build_mascot.py or directly.
"""
import math
import runpy
import sys
from pathlib import Path

import bpy
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent
WORK = ROOT / 'scratch/kuya-sugo-blender'
PARTS = []


def linear(hex_value):
    return tuple(v / 12.92 if v < .04045 else ((v + .055) / 1.055) ** 2.4
                 for v in (int(hex_value[i:i+2], 16) / 255 for i in (1, 3, 5)))


def material(name, color, rough=.5, subsurface=0, sheen=0, metal=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*linear(color), 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Subsurface Weight'].default_value = subsurface
    bsdf.inputs['Subsurface Radius'].default_value = (.8, .38, .22)
    bsdf.inputs['Sheen Weight'].default_value = sheen
    mat.diffuse_color = (*linear(color), 1)
    # Named and arranged nodes remain easy to work with in Node Wrangler.
    bsdf.label, bsdf.location = name, (0, 0)
    mat.node_tree.nodes.get('Material Output').location = (340, 0)
    return mat


def finish(obj, name, mat, bone=None):
    obj.name = name
    obj.data.materials.append(mat)
    if obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    if bone:
        PARTS.append((obj, bone))
    return obj


def sphere(name, position, scale, mat, bone=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=28, location=position)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bone)


def rounded(name, pos, size, mat, radius=.05, bone=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new('Manufactured edge radius', 'BEVEL')
    bevel.width, bevel.segments = radius, 5
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    normals = obj.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    normals.keep_sharp = True
    return finish(obj, name, mat, bone)


def tube(name, points, radius, mat, bone=None, cyclic=False):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 16
    data.bevel_depth, data.bevel_resolution = radius, 4
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    spline.use_cyclic_u = cyclic
    for p, co in zip(spline.bezier_points, points):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    obj.select_set(False)
    return finish(obj, name, mat, bone)


def capsule(name, start, end, radius, mat, bone=None, width=None):
    a, b = Vector(start), Vector(end)
    obj = sphere(name, (a+b)/2, (width or radius, radius, (b-a).length/2+radius*.65), mat, bone)
    obj.rotation_euler = (b-a).to_track_quat('Z','Y').to_euler()
    return obj


def loft(name, rings, mat, bone=None, x=0, subdivisions=2):
    vertices, faces, steps = [], [], 48
    for z, rx, ry, cy in rings:
        for i in range(steps):
            t = math.tau*i/steps
            vertices.append((x+rx*math.cos(t), cy+ry*math.sin(t), z))
    for j in range(len(rings)-1):
        for i in range(steps):
            a, b = j*steps+i, j*steps+(i+1)%steps
            faces.append((a,b,b+steps,a+steps))
    faces.extend([tuple(reversed(range(steps))), tuple(range((len(rings)-1)*steps,len(rings)*steps))])
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices,[],faces)
    data.update()
    obj = bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    finish(obj,name,mat,bone)
    mod = obj.modifiers.new('Tailored subdivision surface','SUBSURF')
    mod.levels = mod.render_levels = subdivisions
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def sculpt_union(name, objects, voxel=.018):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    remesh = obj.modifiers.new('Continuous sculpted volume','REMESH')
    remesh.mode, remesh.voxel_size = 'VOXEL', voxel
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = obj.modifiers.new('Relaxed sculpt surface','SMOOTH')
    smooth.factor, smooth.iterations = 1.05, 5
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    sub = obj.modifiers.new('Sculpt finish','SUBSURF')
    sub.levels = sub.render_levels = 1
    bpy.ops.object.modifier_apply(modifier=sub.name)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def patch(name, top, bottom, mat, bone='head', front_offset=0):
    verts, faces, steps = [], [], 40
    for row in (0,1):
        for i in range(steps+1):
            u = -1+2*i/steps
            verts.append((.145*u, -.416+front_offset+.050*u*u, top(u) if row==0 else bottom(u)))
    for i in range(steps):
        faces.append((i,i+1,i+steps+2,i+steps+1))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    obj = bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj,name,mat,bone)


def letter(name, text, loc, size, mat, bone='head'):
    data = bpy.data.curves.new(name,'FONT')
    data.body, data.align_x, data.align_y = text, 'CENTER','CENTER'
    data.size, data.extrude, data.bevel_depth = size, .0005, .0003
    obj = bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.location, obj.rotation_euler = loc, (math.pi/2,0,0)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    obj.select_set(False)
    return finish(obj,name,mat,bone)


def make_rig():
    import rigify
    bpy.ops.object.select_all(action='DESELECT')
    data = bpy.data.armatures.new('Kuya Sugo human metarig')
    meta = bpy.data.objects.new('Kuya Sugo human metarig',data)
    bpy.context.collection.objects.link(meta)
    meta.select_set(True)
    bpy.context.view_layer.objects.active = meta
    runpy.run_path(str(Path(rigify.__file__).parent/'metarigs/basic/basic_human.py'))['create'](meta)
    bpy.ops.object.mode_set(mode='EDIT')
    for bone in list(data.edit_bones):
        if bone.name.startswith(('breast','pelvis')):
            data.edit_bones.remove(bone)
    spine = [1.29,1.48,1.68,1.90,2.13,2.23,2.35,3.22]
    for i in range(7):
        b = data.edit_bones['spine' if not i else f'spine.{i:03d}']
        b.head, b.tail, b.roll = (0,.025,spine[i]),(0,.025,spine[i+1]),0
    for side, sign in [('L',1),('R',-1)]:
        points = [(sign*.43,0,2.055),(sign*.63,.025,1.76),
                  (sign*.78,-.045,1.43) if side=='L' else (-.64,-.31,1.53),
                  (sign*.84,-.065,1.24) if side=='L' else (-.64,-.46,1.53)]
        for i,name in enumerate(('upper_arm','forearm','hand')):
            b = data.edit_bones[name+'.'+side]
            b.head,b.tail = points[i],points[i+1]
        b = data.edit_bones['shoulder.'+side]
        b.head,b.tail = (sign*.13,.025,2.06),points[0]
        leg = [(sign*.205,.025,1.30),(sign*.22,-.035,.82),(sign*.22,.04,.30),
               (sign*.22,-.17,.13),(sign*.22,-.36,.13)]
        for i,name in enumerate(('thigh','shin','foot','toe')):
            b = data.edit_bones[name+'.'+side]
            b.head,b.tail,b.roll = leg[i],leg[i+1],0
        b = data.edit_bones['heel.02.'+side]
        b.head,b.tail = (sign*.22-.09,.16,.10),(sign*.22+.09,.16,.10)
    bpy.ops.object.mode_set(mode='OBJECT')
    for bone in meta.pose.bones:
        if bone.name.startswith(('upper_arm','thigh')):
            try:
                bone.rigify_parameters.segments = 1
            except AttributeError:
                pass
    bpy.ops.pose.rigify_generate()
    rig = bpy.context.object
    rig.name = 'KUYA_SUGO_RIG'
    meta.hide_render = True
    meta.hide_set(True)
    rig.show_in_front = True
    # Two ordinary deform bones make eyelid closure portable in the baked GLB.
    # No render-only visibility trick or extra object animation is needed.
    bpy.ops.object.mode_set(mode='EDIT')
    for side,sign in [('L',1),('R',-1)]:
        b=rig.data.edit_bones.new('DEF-eye_blink.'+side)
        b.head,b.tail=(sign*.18,-.367,2.819),(sign*.18,-.367,2.919)
        b.parent=rig.data.edit_bones['DEF-spine.006']
        b.use_deform=True
    bpy.ops.object.mode_set(mode='OBJECT')
    aliases = {'head':'DEF-spine.006','neck':'DEF-spine.005','spine':'DEF-spine.003'}
    for obj, bone in PARTS:
        if not obj.name in bpy.data.objects:
            continue
        name = aliases.get(bone,'DEF-'+bone)
        if obj.name.startswith(('Eye white','Iris ','Pupil ','Eye light','Upper eyelid')):
            name='DEF-eye_blink.'+obj.name[-1]
        assert name in rig.data.bones, name
        group = obj.vertex_groups.new(name=name)
        group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
        modifier = obj.modifiers.new('Rigify deformation','ARMATURE')
        modifier.object = rig
    # Continuous trouser knees bend through blended skinning, without ball joints.
    for side in ('L','R'):
        obj = bpy.data.objects['Tailored trouser '+side]
        thigh = obj.vertex_groups['DEF-thigh.'+side]
        shin = obj.vertex_groups.new(name='DEF-shin.'+side)
        for vertex in obj.data.vertices:
            z = (obj.matrix_world@vertex.co).z
            weight = min(1,max(0,(z-.72)/.20))
            thigh.add([vertex.index],weight,'REPLACE')
            shin.add([vertex.index],1-weight,'REPLACE')
    for side in ('L','R'):
        rig.pose.bones['upper_arm_parent.'+side]['IK_FK'] = 1.0
        rig.pose.bones['thigh_parent.'+side]['IK_FK'] = 1.0
    rig['Authoring tools'] = 'Official bundled Rigify human rig; Node Wrangler enabled for shader editing.'
    rig['Design'] = 'Original Filipino human courier. Pink and white uniform. Flat cyclist app logo is separate SVG artwork.'
    return rig


def animate(rig):
    def rotate(name, degrees, axis=(0,1,0)):
        bone = rig.pose.bones[name]
        basis = bone.bone.matrix_local.to_quaternion()
        bone.rotation_mode = 'QUATERNION'
        bone.rotation_quaternion = basis.inverted()@Quaternion(axis,math.radians(degrees))@basis
    for name, end, step in [('KuyaSugo_Idle',72,12),('KuyaSugo_Greeting',72,6),('KuyaSugo_Walk',33,4)]:
        rig.animation_data_create()
        rig.animation_data.action = bpy.data.actions.new(name)
        action = rig.animation_data.action
        action.use_fake_user = True
        for frame in sorted(set([1,end]+list(range(1,end+1,step))+[k for k in (34,36,37,38,40) if k<=end])):
            for bone in rig.pose.bones:
                bone.location = (0,0,0)
                bone.scale = (1,1,1)
                bone.rotation_mode = 'QUATERNION'
                bone.rotation_quaternion = (1,0,0,0)
            t = (frame-1)/(end-1)
            breath = math.sin(t*math.tau)
            rig.pose.bones['chest'].scale = (1+.004*breath,1+.002*breath,1+.006*breath)
            rotate('head',1.6*breath,(0,0,1))
            if name.endswith('Greeting'):
                rise = .5-.5*math.cos(math.pi*min(1,t/.28))
                fall = .5-.5*math.cos(math.pi*min(1,max(0,(t-.77)/.23)))
                amount = rise*(1-fall)
                rotate('upper_arm_fk.L',-80*amount)
                rotate('forearm_fk.L',-56*amount)
                rotate('hand_fk.L',amount*(8+17*math.sin(t*math.tau*3)),(0,0,1))
                rotate('head',-4*amount,(0,0,1))
                rotate('chest',2*amount,(0,0,1))
            elif name.endswith('Walk'):
                phase = t*math.tau
                rig.pose.bones['torso'].location.z = .017*(1-math.cos(phase*2))
                for side, offset in [('L',0),('R',math.pi)]:
                    p = phase+offset
                    rotate('thigh_fk.'+side,19*math.sin(p),(1,0,0))
                    rotate('shin_fk.'+side,-25*max(0,-math.sin(p)),(1,0,0))
                    rotate('foot_fk.'+side,8*math.sin(p),(1,0,0))
                rotate('upper_arm_fk.L',10*math.sin(phase),(1,0,0))
                rotate('head',-2*math.sin(phase),(0,0,1))
            blink = max(0,1-abs(frame-37)/2.2)
            for side in ('L','R'):
                eye=rig.pose.bones['DEF-eye_blink.'+side]
                eye.scale.y=1-.96*blink
                eye.keyframe_insert('scale',frame=frame,group=eye.name)
            for bone in rig.pose.bones:
                if not bone.name.startswith(('DEF-','MCH-','ORG-','VIS_')):
                    bone.keyframe_insert('location',frame=frame,group=bone.name)
                    bone.keyframe_insert('rotation_quaternion',frame=frame,group=bone.name)
                    if bone.name=='chest':
                        bone.keyframe_insert('scale',frame=frame,group=bone.name)
        # No overshoot between sampled poses or at the loop seam.
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:
                            key.interpolation = 'BEZIER'
                            key.handle_left_type = key.handle_right_type = 'AUTO_CLAMPED'
    rig.animation_data.action = bpy.data.actions['KuyaSugo_Greeting']


def main():
    bpy.ops.preferences.addon_enable(module='rigify')
    bpy.ops.preferences.addon_enable(module='node_wrangler')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    WORK.mkdir(parents=True,exist_ok=True)
    skin = material('Warm Filipino skin','#D99A72',.48,.09)
    skin_light = material('Ear and lip warmth','#BA765E',.56,.05)
    pink = material('Sugo pink technical fabric','#F62459',.70,0,.22)
    seam = material('Pink stitch and trim','#C41B47',.75)
    white = material('Warm white cotton','#FFFDF9',.72,0,.15)
    hair = material('Soft espresso hair','#2C211F',.55)
    iris = material('Warm brown iris','#55372A',.36)
    ink = material('Pupil and lash','#241C1C',.30)
    eye_white = material('Eye whites','#FFFBF2',.32)
    mouth = material('Smile interior','#63392F',.64)
    pants = material('Tailored plum graphite','#39313D',.78)
    sole = material('Warm white sneaker rubber','#E9E1DB',.83)
    metal = material('Brushed zipper hardware','#BDB5B0',.35,metal=.5)
    carton = material('Uncoated kraft parcel','#C49A6C',.86)
    tape = material('Paper parcel tape','#F1DFC4',.84)

    # Subdivision-designed silhouette, with a genuinely continuous sculpted face.
    head = loft('Human head',[(2.30,.10,.13,0),(2.35,.25,.24,0),(2.44,.37,.32,0),
        (2.66,.48,.39,0),(2.88,.48,.40,.01),(3.08,.43,.36,.02),
        (3.24,.28,.24,.04),(3.28,.06,.06,.04)],skin,subdivisions=2)
    nose = sphere('Sculpt nose',(0,-.399,2.692),(.066,.075,.073),skin)
    head = sculpt_union('Sculpted face and nose',[head,nose],.014)
    PARTS.append((head,'head'))
    for side, sign in [('L',1),('R',-1)]:
        sphere('Ear '+side,(sign*.475,.015,2.72),(.070,.055,.109),skin,'head')
        sphere('Ear inner '+side,(sign*.502,-.033,2.72),(.027,.009,.057),skin_light,'head')
        # Ivory sclera and warm irises replace the former black bead eyes.
        sphere('Eye white '+side,(sign*.180,-.367,2.819),(.088,.025,.092),eye_white,'head')
        sphere('Iris '+side,(sign*.168,-.389,2.817),(.047,.012,.063),iris,'head')
        sphere('Pupil '+side,(sign*.165,-.401,2.819),(.025,.005,.040),ink,'head')
        sphere('Eye light '+side,(sign*.165-.009,-.407,2.839),(.010,.004,.012),eye_white,'head')
        tube('Upper eyelid '+side,[(sign*.094,-.364,2.849),(sign*.18,-.386,2.909),(sign*.261,-.327,2.853)],.009,skin_light,'head')
        tube('Eyebrow '+side,[(sign*.089,-.361,2.982),(sign*.18,-.386,3.017),(sign*.286,-.334,2.998)],.025,hair,'head')
    patch('Open warm smile',lambda u:2.59-.023*(1-u*u),lambda u:2.59-.084*(1-u*u),mouth)
    patch('Smile teeth',lambda u:2.586-.023*(1-u*u),lambda u:2.586-.041*(1-u*u),eye_white,front_offset=-.002)
    capsule('Neck',(0,.02,2.14),(0,.02,2.43),.153,skin,'neck')

    # Hairline, sideburns and a single swept fringe, beneath a proper cap.
    loft('Espresso hair silhouette',[(2.91,.435,.35,.055),(3.02,.47,.39,.04),
         (3.22,.36,.32,.04),(3.31,.08,.08,.04)],hair,'head')
    for sign in (-1,1):
        capsule('Hair sideburn '+str(sign),(sign*.419,.02,2.99),(sign*.435,.015,2.79),.052,hair,'head')
    fringe = sphere('Swept fringe',(-.16,-.319,3.063),(.24,.070,.075),hair,'head')
    fringe.rotation_euler.y = -.22
    loft('Pink cap crown',[(3.095,.47,.395,.04),(3.16,.493,.411,.04),
         (3.36,.36,.30,.07),(3.46,.06,.05,.08)],pink,'head')
    sphere('Cap curved visor',(0,-.39,3.112),(.47,.31,.029),pink,'head')
    tube('Cap edge stitching',[(-.38,-.47,3.117),(0,-.67,3.104),(.38,-.47,3.117)],.005,seam,'head')
    sphere('Cap button',(0,.075,3.446),(.037,.037,.019),seam,'head')
    letter('White cap print','S',(0,-.408,3.239),.145,white)

    loft('Soft tailored jacket',[(1.23,.285,.205,.025),(1.28,.33,.23,.025),
         (1.52,.355,.245,.025),(1.89,.405,.252,.025),(2.06,.416,.23,.025),
         (2.17,.30,.18,.025),(2.215,.19,.14,.025)],pink,'spine')
    mesh=bpy.data.meshes.new('White undershirt inset')
    mesh.from_pydata([(-.122,-.178,2.19),(-.08,-.222,2.09),(0,-.24,2.045),(.08,-.222,2.09),(.122,-.178,2.19)],[],[(0,1,2,3,4)])
    inset=bpy.data.objects.new('White undershirt inset',mesh)
    bpy.context.collection.objects.link(inset)
    finish(inset,inset.name,white,'spine')
    tube('Crew neck binding',[(-.104,-.161,2.197),(0,-.183,2.167),(.104,-.161,2.197)],.008,white,'spine')
    tube('Jacket zipper',[(0,-.215,1.29),(0,-.228,1.56),(0,-.239,1.90),(0,-.213,2.037)],.009,metal,'spine')
    rounded('Zipper pull',(0,-.258,1.98),(.024,.013,.057),metal,.006,'spine')
    for sign in (-1,1):
        tube('Jacket welt pocket '+str(sign),[(sign*.16,-.225,1.60),(sign*.265,-.202,1.43)],.008,seam,'spine')
    letter('Chest white S','S',(.222,-.206,1.91),.095,white,'spine')

    # Continuous tapered legs: no exposed toy joints or segmented boots.
    for side,sign in [('L',1),('R',-1)]:
        loft('Tailored trouser '+side,[(.30,.115,.13,.04),(.38,.131,.146,.03),
             (.72,.137,.145,-.025),(.87,.151,.157,-.03),(1.15,.165,.175,.025),
             (1.32,.168,.175,.025),(1.37,.145,.155,.025)],pants,'thigh.'+side,x=sign*.22)
        rounded('Sneaker sole '+side,(sign*.22,-.105,.126),(.325,.55,.105),sole,.052,'foot.'+side)
        sphere('Sneaker upper '+side,(sign*.22,-.081,.235),(.147,.248,.105),white,'foot.'+side)
        rounded('Sneaker heel tab '+side,(sign*.22,.136,.26),(.13,.025,.09),pink,.015,'foot.'+side)
        for j in range(3):
            tube('Lace '+side+str(j),[(sign*.22-.068,-.155+j*.052,.316),(sign*.22+.068,-.155+j*.052,.316)],.008,sole,'foot.'+side)
        shoulder=(sign*.43,0,2.055)
        elbow=(sign*.63,.025,1.76)
        wrist=(.78,-.045,1.43) if side=='L' else (-.64,-.31,1.53)
        sleeve_end=Vector(shoulder).lerp(Vector(elbow),.85)
        capsule('Jacket sleeve '+side,shoulder,sleeve_end,.14,pink,'upper_arm.'+side,width=.145)
        capsule('Upper arm skin '+side,sleeve_end,elbow,.103,skin,'upper_arm.'+side)
        capsule('Forearm '+side,elbow,wrist,.102,skin,'forearm.'+side,width=.109)
        if side=='L':
            palm=sphere('Palm L',(.814,-.052,1.337),(.096,.064,.105),white)
            fingers=[palm]
            for i,z in enumerate([1.19,1.166,1.18,1.215]):
                x=.752+i*.044
                fingers.append(capsule('Finger L '+str(i),(x,-.052,1.315),(x+.012,-.055,z),.026,white))
            fingers.append(capsule('Thumb L',(.733,-.059,1.366),(.698,-.09,1.291),.033,white))
            hand=sculpt_union('Sculpted glove L',fingers,.009)
            PARTS.append((hand,'hand.L'))
        else:
            sphere('Supporting palm R',(-.64,-.394,1.515),(.104,.12,.048),white,'hand.R')
            for i in range(4):
                capsule('Parcel grip '+str(i),(-.722+i*.052,-.439,1.51),(-.722+i*.052,-.49,1.561),.023,white,'hand.R')
            capsule('Parcel thumb',(-.739,-.368,1.53),(-.754,-.392,1.61),.032,white,'hand.R')
    rounded('Kraft parcel',(-.64,-.405,1.779),(.43,.36,.43),carton,.024,'hand.R')
    rounded('Parcel paper tape',(-.64,-.405,1.997),(.087,.363,.006),tape,.002,'hand.R')
    rounded('Parcel front tape',(-.64,-.588,1.779),(.087,.006,.431),tape,.002,'hand.R')
    rounded('Shipping label',(-.543,-.593,1.79),(.126,.005,.079),white,.006,'hand.R')
    for i in range(7):
        rounded('Label barcode '+str(i),(-.59+i*.014,-.597,1.785),(.005,.003,.029+(i%2)*.01),pants,.001,'hand.R')

    rig = make_rig()
    animate(rig)
    scene=bpy.context.scene
    def camera(name,pos,target,scale):
        data=bpy.data.cameras.new(name)
        obj=bpy.data.objects.new(name,data)
        bpy.context.collection.objects.link(obj)
        obj.location=pos
        obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
        data.type,data.ortho_scale='ORTHO',scale
        return obj
    hero=camera('CAM_Onboarding',(3.4,-10,4.0),(0,-.08,1.79),4.13)
    camera('CAM_Portrait',(1.8,-10,3.5),(0,-.02,2.79),1.77)
    for name,pos,power,size,color in [('Large warm key',(-3,-4.5,6),430,4.4,(1,.92,.84)),
         ('Cool soft fill',(4,-3,3.8),210,4,(.88,.94,1)),('Clean rim',(2,3.2,5.4),510,3.2,(1,.97,.94))]:
        data=bpy.data.lights.new(name,'AREA')
        data.energy,data.shape,data.size,data.color=power,'DISK',size,color
        obj=bpy.data.objects.new(name,data)
        bpy.context.collection.objects.link(obj)
        obj.location=pos
        obj.rotation_euler=(Vector((0,0,1.9))-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.25,.25,.25,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35
    scene.camera,scene.render.engine=hero,'CYCLES'
    scene.cycles.samples,scene.cycles.use_denoising=40,True
    scene.render.threads_mode,scene.render.threads='FIXED',8
    scene.render.resolution_x,scene.render.resolution_y=768,896
    scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.render.image_settings.file_format,scene.render.image_settings.color_mode='PNG','RGBA'
    scene.render.fps=24
    scene.frame_start,scene.frame_end=1,72
    scene.view_settings.view_transform='AgX'
    scene.frame_set(25)
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.context.view_layer.objects.active=rig
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'kuya-sugo.blend'),compress=True)
    if '--preview' in sys.argv:
        scene.render.resolution_x,scene.render.resolution_y=660,770
        scene.cycles.samples=32
        scene.render.filepath=str(WORK/'premium-preview.png')
        bpy.ops.render.render(write_still=True)
    print('SUGO_HUMAN_COMPLETE',flush=True)
    if '--export' in sys.argv:
        runpy.run_path(str(SOURCE/'render_mascot.py'))


if __name__=='__main__':
    main()
