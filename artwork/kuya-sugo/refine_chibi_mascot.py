"""Apply the user's faceless chibi reference to the editable Pack + Box rider."""
import bpy, sys, shutil
from pathlib import Path
from mathutils import Vector, Matrix
SOURCE=Path(__file__).resolve().parent
ROOT=SOURCE.parents[1]
scene=bpy.context.scene
rig=bpy.data.objects['KUYA_SUGO_RIG']
assert not rig.get('Chibi reference'), 'Run against the clean source, not an already scaled chibi'
rig.animation_data.action=bpy.data.actions['KuyaSugo_Idle']
scene.frame_set(1)
head=bpy.data.objects['headGroup / whiteSharpSkin']
for v in head.data.vertices:
    v.co.x=v.co.x/.335*.84
    v.co.y=-.035+(v.co.y+.035)/.285*.79
    v.co.z=4.40+(v.co.z-3.72)/.395*1.16
# A softer, straighter shirt silhouette suits the short body better than a V taper.
for obj in scene.objects:
    if obj.type!='MESH': continue
    if obj.name in ('Tailored pink uniform','Subtle uniform hem'):
        for v in obj.data.vertices:
            factor=1+.14*max(0,min(1,(2.85-v.co.z)/.65))
            v.co.x*=factor
    # Shared parent coordinates preserve every existing skin and carrying action.
    obj.parent=rig
    obj.matrix_parent_inverse=Matrix.Identity(4)
rig.scale=(.70,.70,.50)
rig['Chibi reference']='reference/chibi-style-reference.png'
rig['Design']='Faceless chibi: large spherical head, short soft body and compact limbs'
scene.camera=bpy.data.objects['CAM_Onboarding']
scene.camera.location.z=1.47
scene.camera.data.ortho_scale=3.20
portrait=bpy.data.objects['CAM_Portrait']
portrait.location.z=2.22
portrait.data.ortho_scale=1.65
scene.render.engine='BLENDER_EEVEE'
scene.eevee.taa_render_samples=32
bpy.data.materials['whiteSharpSkin'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.65
for name,position,power,size in [('Studio key',(-3,-4,4.2),360,4),('Studio fill',(3,-4,2.1),270,5),('Backpack rim',(1,3,3.5),240,3)]:
    light=bpy.data.objects[name]
    light.location=position
    light.data.energy,light.data.size=power,size
    light.rotation_euler=(Vector((0,0,1.6))-light.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.lights.new('Soft white bounce','AREA')
data.energy,data.shape,data.size=100,'DISK',4
light=bpy.data.objects.new('Soft white bounce',data)
scene.collection.objects.link(light)
light.location=(0,-4,.5)
light.rotation_euler=(Vector((0,0,1.8))-light.location).to_track_quat('-Z','Y').to_euler()
rig.animation_data.action=bpy.data.actions['KuyaSugo_PackBox']
scene.frame_set(48)
scene.render.resolution_x,scene.render.resolution_y=660,770
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'kuya-sugo.blend'),compress=True)
shutil.copy2(SOURCE/'kuya-sugo.blend',SOURCE/'kuya-sugo-chibi.blend')
shutil.copy2(SOURCE/'kuya-sugo.blend',SOURCE/'pink-express-pack-box-smooth.blend')
if '--no-preview' not in sys.argv or '--chibi-preview' in sys.argv:
    scene.render.filepath=str(ROOT/'scratch/kuya-sugo-blender/chibi-preview.png')
    bpy.ops.render.render(write_still=True)
print('CHIBI_REFERENCE_APPLIED',flush=True)
