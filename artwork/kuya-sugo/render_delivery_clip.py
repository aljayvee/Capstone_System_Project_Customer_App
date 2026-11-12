"""Renders the Special Delivery story (walk, trip, recover, pick up, thumbs-up) for the second onboarding screen.

Source is the smoothed rebuild in C:/Capstone_Server/character_animation/smooth_fix. The clip stops on the
thumbs-up so the once-only WebP holds that pose. Transparent film, follow camera, EEVEE (Cycles ran ~19 s/frame
on this GPU). Usage: blender -b --python render_delivery_clip.py -- [--framing-only] [--resume] [--part K/N]
"""
import bpy, os, sys, math, numpy as np
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.environ.get('DELIVERY_SOURCE', r'C:/Capstone_Server/character_animation/smooth_fix/Chibi_Special_Delivery.blend')
OUT = os.path.join(ROOT, 'scratch', 'kuya-sugo-blender', 'delivery-frames')
FIRST, LAST = 0, 305
SIZE = (640, 576)
VIEW = Vector((.85, -.45, .30)).normalized()
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=SRC)
s = bpy.context.scene
for name in ['Title', 'Subtitle', 'Footer', 'Reassurance card', 'Reassurance text', 'Infinite studio floor', 'Circular delivery stage', 'Stage top']:
    bpy.data.objects[name].hide_render = True
char = next(o for o in bpy.data.objects if o.name.startswith('Courier |'))
box = bpy.data.objects['PARCEL | animated hand / floor handoff']
FLOOR = -.49

# Framing pass: one zoom for the whole clip (no pumping), centre eased so the parcel stays in view.
rot = (-VIEW).to_track_quat('-Z', 'Y').to_matrix()
right, up = rot.col[0], rot.col[1]
pts, ground = {}, {}
for f in range(FIRST, LAST + 1):
    s.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    corners = []
    for o in (char, box):
        e = o.evaluated_get(dg)
        corners += [e.matrix_world @ Vector(c) for c in e.bound_box]
    pts[f] = np.array([(p.dot(right), p.dot(up)) for p in corners])
    ce = char.evaluated_get(dg)
    cb = [ce.matrix_world @ Vector(c) for c in ce.bound_box]
    ground[f] = (sum(p.x for p in cb) / 8, sum(p.y for p in cb) / 8, box.matrix_world.translation.copy())
frames = list(range(FIRST, LAST + 1))
raw = np.array([(pts[f].min(0) + pts[f].max(0)) / 2 for f in frames])
k = np.exp(-.5 * (np.arange(-24, 25) / 8) ** 2); k /= k.sum()
pad = np.pad(raw, ((24, 24), (0, 0)), mode='edge')
centre = np.stack([np.convolve(pad[:, i], k, mode='valid') for i in range(2)], 1)
aspect = SIZE[0] / SIZE[1]
need = max(max(2 * np.abs(pts[f][:, 0] - c[0]).max(), 2 * np.abs(pts[f][:, 1] - c[1]).max() * aspect) for f, c in zip(frames, centre))
scale = need * 1.14
print('FRAMING ortho_scale', round(scale, 3), 'centre drift', np.ptp(centre, axis=0).round(3).tolist(), flush=True)

cam_data = bpy.data.cameras.new('Onboarding follow')
cam = bpy.data.objects.new('CAMERA | onboarding follow', cam_data)
s.collection.objects.link(cam)
s.camera = cam
cam_data.type = 'ORTHO'
cam_data.ortho_scale = scale
cam_data.clip_end = 40
cam.rotation_euler = rot.to_euler()
for f, (cx, cy) in zip(frames, centre):
    cam.location = right * float(cx) + up * float(cy) + VIEW * 12
    cam.keyframe_insert('location', frame=f)

# Soft contact shadows: EEVEE has no shadow catcher, so a blended radial blob sits under the courier and the parcel.
def blob(name, radius, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.surface_render_method = 'BLENDED'
    nt = mat.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new('ShaderNodeTexCoord')
    grad = nt.nodes.new('ShaderNodeTexGradient'); grad.gradient_type = 'SPHERICAL'
    sharp = nt.nodes.new('ShaderNodeMath'); sharp.operation = 'POWER'; sharp.inputs[1].default_value = 1.6
    amt = nt.nodes.new('ShaderNodeMath'); amt.operation = 'MULTIPLY'; amt.inputs[1].default_value = strength
    mix = nt.nodes.new('ShaderNodeMixShader')
    clear = nt.nodes.new('ShaderNodeBsdfTransparent')
    dark = nt.nodes.new('ShaderNodeEmission'); dark.inputs[0].default_value = (0, 0, 0, 1)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tc.outputs['Object'], grad.inputs['Vector'])
    nt.links.new(grad.outputs['Fac'], sharp.inputs[0])
    nt.links.new(sharp.outputs[0], amt.inputs[0])
    nt.links.new(amt.outputs[0], mix.inputs['Fac'])
    nt.links.new(clear.outputs[0], mix.inputs[1])
    nt.links.new(dark.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    bpy.ops.mesh.primitive_plane_add(size=2)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    o.scale = (radius, radius * .78, 1)
    o.visible_shadow = False
    return o, amt

body_blob, body_amt = blob('SHADOW | courier', .27, .42)
box_blob, box_amt = blob('SHADOW | parcel', .17, .38)
for f in frames:
    x, y, bpos = ground[f]
    body_blob.location = (x, y, FLOOR + .002)
    body_blob.keyframe_insert('location', frame=f)
    lift = max(0.0, bpos.z - (FLOOR + .10))
    box_blob.location = (bpos.x, bpos.y, FLOOR + .003)
    box_blob.keyframe_insert('location', frame=f)
    # Only while the parcel is free; in the hands the courier's shadow already covers it.
    s.frame_set(f)
    free = box.constraints[0].influence < .5
    box_amt.inputs[1].default_value = .38 * math.exp(-6 * lift) if free else 0
    box_amt.inputs[1].keyframe_insert('default_value', frame=f)

world = bpy.data.worlds.new('Neutral onboarding light')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (.62, .63, .65, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = .55
s.world = world
s.render.engine = 'BLENDER_EEVEE'
s.eevee.taa_render_samples = 16
s.render.film_transparent = True
s.render.resolution_x, s.render.resolution_y = SIZE
s.render.resolution_percentage = 100
s.render.image_settings.media_type = 'IMAGE'
s.render.image_settings.file_format = 'PNG'
s.render.image_settings.color_mode = 'RGBA'
s.render.use_stamp = False
s.render.use_stamp_frame = False

todo = [FIRST, 112, 190, 260, LAST] if '--framing-only' in args else frames
if '--part' in args:
    k, n = map(int, args[args.index('--part') + 1].split('/'))
    todo = todo[k::n]
for f in todo:
    path = os.path.join(OUT, 'frame-%03d.png' % (f - FIRST))
    if '--resume' in args and os.path.exists(path):
        continue
    s.frame_set(f)
    s.render.filepath = path
    bpy.ops.render.render(write_still=True)
print('DELIVERY_FRAMES_DONE', len(todo), OUT, flush=True)
