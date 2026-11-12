"""Refine the selected rider's silhouette on its original Pack + Box rig.

Run against the preserved source master; this is not a new animation skeleton.
"""
import bpy, math, sys, shutil
from pathlib import Path
from mathutils import Vector
SOURCE=Path(__file__).resolve().parent
ROOT=SOURCE.parents[1]
sys.path.insert(0,str(SOURCE))
import blender_geometry as g
rig=bpy.data.objects['KUYA_SUGO_RIG']
scene=bpy.context.scene
rig.animation_data.action=bpy.data.actions['KuyaSugo_Idle']
scene.frame_set(1)
white=bpy.data.materials['whiteSharpSkin']
pink=bpy.data.materials['pinkShirt']
navy=bpy.data.materials['darkBluePants']
trim=bpy.data.materials['pinkTrim']
sole=g.material('Clean ivory rubber','#FFFFFF',.48)
shoe=g.material('Navy textile sneaker','#172554',.64)
for mat in (white,pink,navy,trim):
    bs=mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Roughness'].default_value=.48 if mat==white else .6
    bs.inputs['Sheen Weight'].default_value=.12 if mat!=white else 0

# Keep the source backpack, parcel, hierarchy and baked movement. Retopologize
# the unfinished body panels into continuous, weighted garment surfaces.
for obj in list(scene.objects):
    if obj.type!='MESH': continue
    group=obj.get('Reference group','')
    if group not in ('backpackGroup','deliveryBoxGroup'):
        bpy.data.objects.remove(obj,do_unlink=True)

def bind(obj,weights):
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    for v in obj.data.vertices:
        values=weights(v.co.z) if callable(weights) else {weights:1}
        for bone,w in values.items():
            if w>0:
                vg=obj.vertex_groups.get(bone) or obj.vertex_groups.new(name=bone)
                vg.add([v.index],w,'REPLACE')
    mod=obj.modifiers.new('Original rider deformation','ARMATURE'); mod.object=rig
    mod.use_deform_preserve_volume=True
    obj['Reference refinement']='Original rider proportions and Pack + Box hierarchy'
    obj.select_set(False)
    return obj

def mix(z,lower,upper,start,end):
    t=max(0,min(1,(z-start)/(end-start)))
    t=t*t*(3-2*t)
    return {lower:1-t,upper:t}

def ell(name,xyz,size,mat,bone):
    x,y,z=xyz
    return bind(g.sphere(name,(x,-z,y),(size[0],size[2],size[1]),mat),bone)

def loft(name,rings,mat,weights,x=0):
    # Ring tuple: source height, width radius, front/back radius, forward offset.
    obj=g.loft(name,[(h,w,d,-f) for h,w,d,f in rings],mat,x=x,subdivisions=2)
    # Apply subdivision before assigning smooth joint weights.
    bpy.context.view_layer.objects.active=obj
    for mod in list(obj.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    return bind(obj,weights)

ell('headGroup / whiteSharpSkin',(0,3.72,.035),(.335,.395,.285),white,'headGroup')
ell('Soft neck',(0,3.34,.015),(.135,.20,.135),white,'neckGroup')
loft('Tailored pink uniform',[(2.16,.29,.18,0),(2.17,.33,.205,0),(2.25,.35,.22,0),(2.54,.395,.24,0),(2.85,.48,.265,0),(3.08,.56,.24,0),(3.18,.50,.215,0),(3.27,.22,.16,0),(3.29,.17,.14,0)],pink,lambda z:mix(z,'spineGroup','chestGroup',2.5,2.87))
loft('Trouser waist',[(1.94,.26,.16,0),(1.97,.34,.20,0),(2.12,.35,.205,0),(2.19,.325,.20,0)],navy,'pelvisGroup')
loft('Subtle uniform hem',[(2.17,.329,.204,0),(2.19,.334,.208,0),(2.22,.337,.21,0)],trim,'spineGroup')
# Fine zipper, pull and a simple white chest badge; no sculpted muscle plates.
bind(g.tube('Uniform zipper',[(0,-.249,2.55),(0,-.269,2.84),(0,-.248,3.08),(0,-.17,3.24)],.009,trim),'chestGroup')
ell('Zipper pull',(0,3.16,.207),(.022,.045,.011),sole,'chestGroup')
ell('White chest badge',(-.23,3.04,.247),(.065,.065,.009),sole,'chestGroup')
for sign,side in [(-1,'left'),(1,'right')]:
    sx=sign*.72
    loft(side+' tailored sleeve',[(2.87,.145,.15,0),(2.90,.175,.18,0),(3.02,.20,.20,0),(3.13,.18,.18,0),(3.20,.10,.12,0),(3.22,.02,.03,0)],pink,side+'Shoulder',sign*.66)
    loft(side+' smooth arm',[(2.14,.075,.08,0),(2.18,.09,.09,0),(2.37,.12,.115,0),(2.62,.125,.12,0),(2.81,.135,.13,0),(2.97,.14,.14,0)],white,lambda z,s=side:mix(z,s+'Elbow',s+'Shoulder',2.52,2.73),sx)
    ell(side+' rounded hand',(sx,2.085,.015),(.095,.13,.09),white,side+'Hand')
    ell(side+' thumb',(sx-sign*.07,2.10,.06),(.04,.075,.045),white,side+'Hand')
    loft(side+' continuous trousers',[(.29,.115,.115,0),(.33,.13,.135,0),(.59,.145,.16,0),(1.0,.16,.17,0),(1.17,.17,.175,0),(1.46,.195,.205,0),(1.85,.21,.21,0),(2.04,.205,.205,0),(2.08,.15,.17,0)],navy,lambda z,s=side:mix(z,s+'Knee',s+'Hip',1.04,1.30),sign*.24)
    ell(side+' sneaker upper',(sign*.24,.20,.115),(.15,.145,.30),shoe,side+'Ankle')
    obj=g.rounded(side+' white sneaker sole',(sign*.24,-.115,.115),(.31,.61,.095),sole,.045)
    bind(obj,side+'Ankle')
    # Thin straps follow the fitted garment and disappear over the shoulder.
    pts=[(sign*.33,.18,3.23),(sign*.39,-.12,3.24),(sign*.39,-.22,3.06),(sign*.34,-.255,2.83),(sign*.30,-.24,2.62)]
    bind(g.tube(side+' backpack strap',pts,.027,trim),'chestGroup')

rig['Surface finish']='Clean continuous garments, smooth joint weights, rounded faceless head and tailored sleeves.'
scene.render.engine='BLENDER_EEVEE'
scene.eevee.taa_render_samples=32
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.55
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.camera=bpy.data.objects['CAM_Onboarding']
scene.camera.data.ortho_scale=4.65
rig.animation_data.action=bpy.data.actions['KuyaSugo_PackBox']
scene.frame_set(48)
scene.render.resolution_x,scene.render.resolution_y=660,770
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'kuya-sugo.blend'),compress=True)
shutil.copy2(SOURCE/'kuya-sugo.blend',SOURCE/'pink-express-pack-box-smooth.blend')
if '--no-preview' not in sys.argv:
    scene.render.filepath=str(ROOT/'scratch/kuya-sugo-blender/clean-preview.png')
    bpy.ops.render.render(write_still=True)
print('CLEAN_REFINEMENT_COMPLETE',flush=True)
