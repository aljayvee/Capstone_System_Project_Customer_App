"""Swaps the splash's logo mark for the current flat app logo (2026-11-01: the Sugo Tacurong scooter), then renders.

The splash built its old cyclist mark from curves parented to the camera. The new mark is an image plane laid exactly
over the pink badge, so the white artwork keeps the badge's 512 grid from export_flat_logo.mjs. Run from CustomerApp:
blender -b artwork/kuya-sugo/kuya-sugo-splash.blend --factory-startup --python-exit-code 1 --python artwork/kuya-sugo/splash_swap_logo.py
"""
import bpy, os

here = os.path.dirname(os.path.abspath(__file__))
mark_png = os.path.join(here, 'splash', 'sugo-mark-white-2048.png')
badge = bpy.data.objects['SPLASH | logo badge']

for o in [o for o in bpy.data.objects if o.name.startswith('SPLASH | mark')]:
    bpy.data.objects.remove(o, do_unlink=True)

img = bpy.data.images.load(mark_png, check_existing=False)
img.colorspace_settings.name = 'Non-Color'
img.pack()
mat = bpy.data.materials.new('SPLASH | logo mark')
mat.surface_render_method = 'BLENDED'
nt = mat.node_tree
nt.nodes.clear()
out = nt.nodes.new('ShaderNodeOutputMaterial')
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; tex.interpolation = 'Cubic'
emit = nt.nodes.new('ShaderNodeEmission'); emit.inputs['Color'].default_value = (1, 1, 1, 1)
clear = nt.nodes.new('ShaderNodeBsdfTransparent')
mix = nt.nodes.new('ShaderNodeMixShader')
nt.links.new(tex.outputs['Alpha'], mix.inputs['Fac'])
nt.links.new(clear.outputs['BSDF'], mix.inputs[1])
nt.links.new(emit.outputs['Emission'], mix.inputs[2])
nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])

me = bpy.data.meshes.new('SPLASH | logo mark')
me.from_pydata([(-.5, -.5, 0), (.5, -.5, 0), (.5, .5, 0), (-.5, .5, 0)], [], [(0, 1, 2, 3)])
me.uv_layers.new().data.foreach_set('uv', [0, 0, 1, 0, 1, 1, 0, 1])
me.materials.append(mat)
plane = bpy.data.objects.new('SPLASH | logo mark', me)
for c in badge.users_collection:
    c.objects.link(plane)
plane.parent = badge.parent
plane.matrix_parent_inverse = badge.matrix_parent_inverse.copy()
plane.location = (badge.location.x, badge.location.y, badge.location.z + .1)
plane.rotation_euler = badge.rotation_euler
plane.scale = badge.scale

bpy.ops.wm.save_mainfile()
s = bpy.context.scene
s.render.image_settings.file_format = 'PNG'
s.render.image_settings.color_mode = 'RGBA'
bpy.ops.render.render(write_still=True)
print('SPLASH_LOGO_SWAPPED', s.render.filepath, flush=True)
