"""Kuya Sugo v4: pure-white, faceless, athletic, front-facing, 10 seconds."""
import json
import math
import runpy
import sys
from pathlib import Path

import bpy
from mathutils import Vector, Quaternion

SOURCE = Path(__file__).resolve().parent
ROOT = SOURCE.parents[1]
WORK = ROOT/'scratch/kuya-sugo-blender'
sys.path.insert(0,str(SOURCE))
import blender_geometry as g

SPEC = json.loads((SOURCE/'mascot_spec.json').read_text(encoding='utf-8'))
SHOULDER, ELBOW, WRIST = (.575,.025,3.035),(.775,.025,2.545),(.87,-.025,2.065)


def mirrored(point, sign):
    return (point[0]*sign,point[1],point[2])


def white_arm(side, sign, material):
    start=Vector(SHOULDER).lerp(Vector(ELBOW),.59)
    elbow,wrist=Vector(ELBOW),Vector(WRIST)
    rings=[(start,.148),(start.lerp(elbow,.4),.151),(elbow,.139),
           (elbow.lerp(wrist,.25),.148),(elbow.lerp(wrist,.58),.135),
           (elbow.lerp(wrist,.85),.108),(wrist,.097)]
    vertices,faces,steps=[],[],32
    for j,(center,radius) in enumerate(rings):
        center=Vector(mirrored(center,sign))
        previous=Vector(mirrored(rings[max(0,j-1)][0],sign))
        following=Vector(mirrored(rings[min(len(rings)-1,j+1)][0],sign))
        tangent=(following-previous).normalized()
        axis_x=tangent.cross(Vector((0,1,0))).normalized()
        axis_y=axis_x.cross(tangent).normalized()
        for i in range(steps):
            a=math.tau*i/steps
            vertices.append(center+radius*(axis_x*math.cos(a)+axis_y*.90*math.sin(a)))
    for j in range(len(rings)-1):
        for i in range(steps):
            a,b=j*steps+i,j*steps+(i+1)%steps
            faces.append((a,b,b+steps,a+steps))
    faces.extend([tuple(reversed(range(steps))),tuple(range((len(rings)-1)*steps,len(rings)*steps))])
    mesh=bpy.data.meshes.new('Continuous athletic arm '+side)
    mesh.from_pydata(vertices,[],faces)
    import bmesh
    bm=bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj=bpy.data.objects.new('Continuous white arm '+side,mesh)
    bpy.context.collection.objects.link(obj)
    g.finish(obj,obj.name,material,'upper_arm.'+side)
    sub=obj.modifiers.new('Smooth anatomical arm','SUBSURF')
    sub.levels=sub.render_levels=2
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=sub.name)


def make_rig():
    import rigify
    bpy.ops.object.select_all(action='DESELECT')
    data=bpy.data.armatures.new('Faceless athlete metarig')
    meta=bpy.data.objects.new('Kuya Sugo metarig',data)
    bpy.context.collection.objects.link(meta)
    meta.select_set(True)
    bpy.context.view_layer.objects.active=meta
    runpy.run_path(str(Path(rigify.__file__).parent/'metarigs/basic/basic_human.py'))['create'](meta)
    bpy.ops.object.mode_set(mode='EDIT')
    for b in list(data.edit_bones):
        if b.name.startswith(('breast','pelvis')):
            data.edit_bones.remove(b)
    spine=[1.79,2.00,2.24,2.57,3.09,3.22,3.38,4.10]
    for i in range(7):
        b=data.edit_bones['spine' if not i else f'spine.{i:03d}']
        b.head,b.tail,b.roll=(0,.025,spine[i]),(0,.025,spine[i+1]),0
    for side,sign in [('L',1),('R',-1)]:
        arm=[mirrored(p,sign) for p in (SHOULDER,ELBOW,WRIST,(.90,-.025,1.84))]
        for i,name in enumerate(('upper_arm','forearm','hand')):
            b=data.edit_bones[name+'.'+side]
            b.head,b.tail=arm[i],arm[i+1]
        b=data.edit_bones['shoulder.'+side]
        b.head,b.tail=(sign*.16,.025,3.045),arm[0]
        leg=[(sign*.235,.025,1.80),(sign*.25,-.055,.965),(sign*.25,.04,.315),
             (sign*.25,-.20,.13),(sign*.25,-.39,.13)]
        for i,name in enumerate(('thigh','shin','foot','toe')):
            b=data.edit_bones[name+'.'+side]
            b.head,b.tail,b.roll=leg[i],leg[i+1],0
        b=data.edit_bones['heel.02.'+side]
        b.head,b.tail=(sign*.25-.10,.18,.07),(sign*.25+.10,.18,.07)
    bpy.ops.object.mode_set(mode='OBJECT')
    for b in meta.pose.bones:
        if b.name.startswith(('upper_arm','thigh')):
            b.rigify_parameters.segments=1
    bpy.ops.pose.rigify_generate()
    rig=bpy.context.object
    rig.name='KUYA_SUGO_RIG'
    meta.hide_render=True
    meta.hide_set(True)
    rig.show_in_front=True
    aliases={'head':'DEF-spine.006','neck':'DEF-spine.005','spine':'DEF-spine.003'}
    for obj,bone in g.PARTS:
        name=aliases.get(bone,'DEF-'+bone)
        assert name in rig.data.bones,name
        group=obj.vertex_groups.new(name=name)
        group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
        modifier=obj.modifiers.new('Rigify skin deformation','ARMATURE')
        modifier.object=rig
    for side in ('L','R'):
        obj=bpy.data.objects['Athletic navy trousers '+side]
        thigh=obj.vertex_groups['DEF-thigh.'+side]
        shin=obj.vertex_groups.new(name='DEF-shin.'+side)
        for vertex in obj.data.vertices:
            z=(obj.matrix_world@vertex.co).z
            blend=min(1,max(0,(z-.82)/.29))
            thigh.add([vertex.index],blend,'REPLACE')
            shin.add([vertex.index],1-blend,'REPLACE')
        rig.pose.bones['upper_arm_parent.'+side]['IK_FK']=1.0
        rig.pose.bones['thigh_parent.'+side]['IK_FK']=0.0
        arm=bpy.data.objects['Continuous white arm '+side]
        upper=arm.vertex_groups['DEF-upper_arm.'+side]
        lower=arm.vertex_groups.new(name='DEF-forearm.'+side)
        for vertex in arm.data.vertices:
            blend=min(1,max(0,(vertex.co.z-2.46)/.18))
            blend=blend*blend*(3-2*blend)
            upper.add([vertex.index],blend,'REPLACE')
            lower.add([vertex.index],1-blend,'REPLACE')
    rig['Design']='Faceless pure-white athletic courier; pink uniform; dark-blue trousers; no headwear; front view.'
    rig['Animation']='240 rendered frames at 24 fps = 10 seconds. Greeting, welcome gesture, frontal walk in place, rest.'
    rig['Flat logo rule']='App logo remains separate, flat white/pink SVG artwork.'
    return rig


def animate(rig):
    def ease(t):
        t=min(1,max(0,t))
        return t*t*(3-2*t)
    def rotate(name,degrees,axis=(0,1,0)):
        b=rig.pose.bones[name]
        basis=b.bone.matrix_local.to_quaternion()
        b.rotation_mode='QUATERNION'
        b.rotation_quaternion=basis.inverted()@Quaternion(axis,math.radians(degrees))@basis
    def translate(name,offset):
        b=rig.pose.bones[name]
        b.location=b.bone.matrix_local.to_3x3().inverted()@Vector(offset)
    for name,end in [('KuyaSugo_Idle',241),('KuyaSugo_Greeting',241),('KuyaSugo_Walk',49)]:
        rig.animation_data_create()
        rig.animation_data.action=bpy.data.actions.new(name)
        action=rig.animation_data.action
        action.use_fake_user=True
        # A complete pose every three source frames gives predictable baked motion.
        for frame in sorted(set([1,end]+list(range(1,end+1,3)))):
            for b in rig.pose.bones:
                b.location=(0,0,0)
                b.scale=(1,1,1)
                b.rotation_mode='QUATERNION'
                b.rotation_quaternion=(1,0,0,0)
            sec=(frame-1)/24
            breath=math.sin(sec*math.tau*.4)
            rig.pose.bones['chest'].scale=(1+.003*breath,1+.002*breath,1+.004*breath)
            walk=0
            if name.endswith('Greeting'):
                wave=ease((sec-.25)/.8)*(1-ease((sec-3.0)/.7))
                rotate('upper_arm_fk.L',-92*wave)
                rotate('forearm_fk.L',-43*wave)
                rotate('hand_fk.L',wave*(7+16*math.sin((sec-1.05)*math.tau*1.45)))
                present=ease((sec-4.0)/.5)*(1-ease((sec-5.4)/.5))
                for side,sign in [('L',1),('R',-1)]:
                    if present:
                        rotate('upper_arm_fk.'+side,-sign*29*present)
                        rotate('forearm_fk.'+side,-sign*40*present)
                rotate('head',-3*math.sin(sec*math.pi)*present,(1,0,0))
                walk=ease((sec-6)/.4)*(1-ease((sec-8.6)/.4))
                phase=(sec-6)*math.tau
            elif name.endswith('Walk'):
                walk,phase=1,sec*math.tau
            if walk:
                translate('torso',(.012*math.sin(phase)*walk,0,.016*(1-math.cos(2*phase))*walk))
                for side,offset in [('L',0),('R',math.pi)]:
                    p=phase+offset
                    u=(p/math.tau)%1
                    if u<.5:
                        foot_y=.17-.34*ease(u*2)
                        foot_z=.13*math.sin(u*math.tau)
                    else:
                        foot_y=-.17+.34*((u-.5)*2)
                        foot_z=0
                    translate('foot_ik.'+side,(0,foot_y*walk,foot_z*walk))
                    rotate('upper_arm_fk.'+side,12*math.sin(p)*walk,(1,0,0))
                    rotate('forearm_fk.'+side,-8*walk,(1,0,0))
            for b in rig.pose.bones:
                if not b.name.startswith(('DEF-','MCH-','ORG-','VIS_')):
                    b.keyframe_insert('location',frame=frame,group=b.name)
                    b.keyframe_insert('rotation_quaternion',frame=frame,group=b.name)
                    if b.name=='chest':
                        b.keyframe_insert('scale',frame=frame,group=b.name)
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:
                            key.interpolation='BEZIER'
                            key.handle_left_type=key.handle_right_type='AUTO_CLAMPED'
    rig.animation_data.action=bpy.data.actions['KuyaSugo_Greeting']


def configure_render(scene):
    scene.render.engine='CYCLES'
    scene.render.use_persistent_data=True
    scene.cycles.samples,scene.cycles.use_denoising=32,True
    scene.render.threads_mode,scene.render.threads='FIXED',8
    scene.cycles.device='CPU'
    scene['Render device']='CPU'
    try:
        preferences=bpy.context.preferences.addons['cycles'].preferences
        preferences.compute_device_type='CUDA'
        preferences.refresh_devices()
        gpu=[d for d in preferences.devices if d.type=='CUDA']
        if gpu:
            for d in preferences.devices:
                d.use=d.type=='CUDA'
            scene.cycles.device='GPU'
            scene['Render device']=gpu[0].name+' / CUDA'
    except (TypeError,RuntimeError):
        pass


def main():
    bpy.ops.preferences.addon_enable(module='rigify')
    bpy.ops.preferences.addon_enable(module='node_wrangler')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    g.PARTS.clear()
    WORK.mkdir(parents=True,exist_ok=True)
    white=g.material('Pure white body #FFFFFF',SPEC['body'],.42)
    pink=g.material('Pink athletic uniform #F62459',SPEC['uniform'],.70,0,.20)
    trim=g.material('Pink seam','#C41B47',.76)
    navy=g.material('Dark-blue trousers #11294B',SPEC['pants'],.76)
    # A single smooth blank head: no eyes, nose, mouth, ears, hair or headwear.
    g.sphere('Faceless pure-white head',(0,.025,3.70),(.35,.30,.46),white,'head')
    g.capsule('Pure-white neck',(0,.025,3.11),(0,.025,3.43),.139,white,'neck')
    g.loft('Athletic pink uniform',[(1.76,.316,.205,.025),(1.83,.345,.222,.025),
        (2.04,.350,.230,.025),(2.28,.385,.252,.025),(2.58,.47,.285,.025),
        (2.88,.545,.293,.025),(3.04,.548,.266,.025),(3.14,.385,.20,.025),
        (3.19,.17,.137,.025)],pink,'spine')
    # Tailored collar, small button placket and a flat white chest print.
    bpy.ops.mesh.primitive_torus_add(major_radius=.154,minor_radius=.019,major_segments=48,minor_segments=12,location=(0,.025,3.174))
    g.finish(bpy.context.object,'Pink polo collar',pink,'spine')
    g.tube('Polo placket',[(0,-.186,3.105),(0,-.237,2.945)],.009,trim,'spine')
    for z,y in [(3.07,-.202),(2.99,-.226)]:
        g.sphere('White polo button '+str(z),(0,y,z),(.013,.006,.013),white,'spine')
    g.letter('Flat white chest print','S',(.28,-.229,2.84),.10,white,'spine')
    for side,sign in [('L',1),('R',-1)]:
        shoulder,elbow,wrist=[mirrored(p,sign) for p in (SHOULDER,ELBOW,WRIST)]
        hem=Vector(shoulder).lerp(Vector(elbow),.63)
        g.capsule('Pink fitted sleeve '+side,shoulder,hem,.187,pink,'upper_arm.'+side,width=.203)
        white_arm(side,sign,white)
        palm=g.sphere('Hand palm '+side,(sign*.891,-.025,1.954),(.104,.067,.126),white)
        fingers=[palm]
        for i,end_z in enumerate([1.77,1.745,1.76,1.795]):
            x=sign*(.815+i*.048)
            fingers.append(g.capsule('Hand finger '+side+str(i),(x,-.025,1.939),(x+sign*.008,-.025,end_z),.028,white))
        fingers.append(g.capsule('Hand thumb '+side,(sign*.807,-.037,2.015),(sign*.759,-.065,1.922),.037,white))
        hand=g.sculpt_union('Pure-white hand '+side,fingers,.010)
        g.PARTS.append((hand,'hand.'+side))
        g.loft('Athletic navy trousers '+side,[(.30,.127,.140,.04),(.39,.148,.155,.04),
            (.82,.161,.172,-.04),(1.03,.180,.187,-.04),(1.38,.209,.226,.025),
            (1.72,.218,.230,.025),(1.84,.190,.203,.025)],navy,'thigh.'+side,x=sign*.25)
        g.rounded('White shoe sole '+side,(sign*.25,-.11,.105),(.35,.59,.07),white,.033,'foot.'+side)
        g.rounded('White shoe upper '+side,(sign*.25,-.10,.215),(.34,.57,.17),white,.075,'foot.'+side)
    rig=make_rig()
    animate(rig)
    scene=bpy.context.scene
    def camera(name,target_z,scale):
        data=bpy.data.cameras.new(name)
        obj=bpy.data.objects.new(name,data)
        bpy.context.collection.objects.link(obj)
        obj.location=(0,-12,target_z)
        obj.rotation_euler=(Vector((0,0,target_z))-obj.location).to_track_quat('-Z','Y').to_euler()
        data.type,data.ortho_scale='ORTHO',scale
        return obj
    scene.camera=camera('CAM_Onboarding',2.13,4.88)
    camera('CAM_Portrait',3.63,1.38)
    for name,pos,power,size in [('Neutral key',(-3.5,-4.5,6),480,4),
        ('Neutral fill',(3.5,-2,4),180,3.8),('White rim',(1,3,5.4),430,3)]:
        data=bpy.data.lights.new(name,'AREA')
        data.energy,data.shape,data.size,data.color=power,'DISK',size,(1,1,1)
        obj=bpy.data.objects.new(name,data)
        bpy.context.collection.objects.link(obj)
        obj.location=pos
        obj.rotation_euler=(Vector((0,0,2.2))-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.25,.25,.25,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.3
    configure_render(scene)
    scene.render.resolution_x,scene.render.resolution_y=768,896
    scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.render.image_settings.file_format,scene.render.image_settings.color_mode='PNG','RGBA'
    scene.render.fps=SPEC['fps']
    scene.frame_start,scene.frame_end=1,SPEC['frameCount']
    scene.view_settings.view_transform='AgX'
    scene['Character spec']=json.dumps(SPEC)
    scene.frame_set(48)
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.context.view_layer.objects.active=rig
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'kuya-sugo.blend'),compress=True)
    if '--preview' in sys.argv:
        scene.render.resolution_x,scene.render.resolution_y=660,770
        scene.render.filepath=str(WORK/'faceless-preview.png')
        try:
            bpy.ops.render.render(write_still=True)
        except RuntimeError:
            scene.cycles.device='CPU'
            scene['Render device']='CPU fallback'
            bpy.ops.render.render(write_still=True)
            scene.render.resolution_x,scene.render.resolution_y=768,896
            bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'kuya-sugo.blend'),compress=True)
    print('SUGO_FACELESS_COMPLETE',scene['Render device'],flush=True)
    if '--export' in sys.argv:
        runpy.run_path(str(SOURCE/'render_mascot.py'))


if __name__=='__main__':
    main()
