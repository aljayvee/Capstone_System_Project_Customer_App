"""Renders one in-place walk cycle of the smoothed Special Delivery chibi for the second onboarding screen.

The app moves the clip across the screen itself, so the courier must walk on the spot here: the camera and the contact
shadow ride along with the rig's travel. Frames 24-47 of the source story are one full cycle (two steps, 1 s at 24 fps;
frame 48 repeats frame 24), carrying the parcel, before the trip. The source legs sweep back about twice as fast as the
rig travels, so the speed that keeps the feet planted is the stance foot's sweep, measured here and printed as
WALK_SPEED in frame heights per second for KuyaSugoMascot. Seen from the courier's right and a little in front, so he
walks toward screen right with his face in view. Transparent film, EEVEE.
Usage: blender -b --python render_walk_cycle_clip.py -- [--framing-only] [--part K/N]
"""
import bpy, os, sys, numpy as np
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.environ.get('DELIVERY_SOURCE', r'C:/Capstone_Server/character_animation/smooth_fix/Chibi_Special_Delivery.blend')
OUT = os.path.join(ROOT, 'scratch', 'kuya-sugo-blender', 'walk-frames')
FIRST, CYCLE, FPS = 24, 24, 24
SIZE = (528, 600)
VIEW = Vector((.5, -.85, .25)).normalized()
FLOOR = -.49
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=SRC)
s = bpy.context.scene
for name in ['Title', 'Subtitle', 'Footer', 'Reassurance card', 'Reassurance text', 'Infinite studio floor', 'Circular delivery stage', 'Stage top']:
    bpy.data.objects[name].hide_render = True
rig = bpy.data.objects['RIG | Courier']
char = next(o for o in bpy.data.objects if o.name.startswith('Courier |'))
box = bpy.data.objects['PARCEL | animated hand / floor handoff']
smile = bpy.data.objects['EXPRESSION | reassuring smile']
# Same friendly face as the hello wave on the first screen.
smile.animation_data_clear()
smile.hide_render = smile.hide_viewport = False
frames = list(range(FIRST, FIRST + CYCLE))

rot = (-VIEW).to_track_quat('-Z', 'Y').to_matrix()
right, up = rot.col[0], rot.col[1]
travel, pts, ankles = {}, [], {'L': [], 'R': []}
for f in frames + [FIRST + CYCLE]:
    s.frame_set(f)
    t = rig.matrix_world.translation.copy()
    travel[f] = t
    for side in 'LR':
        a = rig.matrix_world @ rig.pose.bones['foot.' + side].head - t
        ankles[side].append((f, a.x, a.z))
    if f == FIRST + CYCLE:
        continue
    dg = bpy.context.evaluated_depsgraph_get()
    for o in (char, box):
        e = o.evaluated_get(dg)
        pts += [((e.matrix_world @ Vector(c)) - t) for c in e.bound_box]
    print('VIS', f, 'box', not box.hide_render, 'smile', not smile.hide_render, flush=True)

# Planted-foot speed: while an ankle is on the floor it sweeps backward relative to the rig; average that sweep.
sweeps = []
for side, rows in ankles.items():
    rows = np.array(rows)
    low = rows[:, 2] <= rows[:, 2].min() + .002
    for i in range(1, len(rows)):
        if low[i] and low[i - 1]:
            sweeps.append(rows[i - 1, 1] - rows[i, 1])
stance = float(np.mean(sweeps))
rig_speed = float((travel[FIRST + CYCLE] - travel[FIRST]).length / CYCLE)
loop_gap = max(abs(ankles[sd][0][1] - ankles[sd][-1][1]) + abs(ankles[sd][0][2] - ankles[sd][-1][2]) for sd in 'LR')
print('STANCE units/frame', round(stance, 5), 'rig travel units/frame', round(rig_speed, 5), 'loop gap', round(loop_gap, 5), flush=True)

proj = np.array([(p.dot(right), p.dot(up)) for p in pts])
lo, hi = proj.min(0), proj.max(0)
centre = (lo + hi) / 2
aspect = SIZE[0] / SIZE[1]
# An orthographic scale spans the frame's longer side.
vertical = max(hi[1] - lo[1], (hi[0] - lo[0]) / aspect) * 1.1
scale = vertical if SIZE[1] >= SIZE[0] else vertical * aspect
speed = stance * FPS * right.x / vertical
print('BOUNDS width', round(hi[0] - lo[0], 3), 'height', round(hi[1] - lo[1], 3), 'ortho_scale', round(scale, 3),
      'right.x', round(right.x, 3), flush=True)
print('WALK_SPEED frame heights per second', round(speed, 4), flush=True)
if '--framing-only' in args:
    sys.exit(0)

cam_data = bpy.data.cameras.new('Onboarding walk')
cam = bpy.data.objects.new('CAMERA | onboarding walk', cam_data)
s.collection.objects.link(cam)
s.camera = cam
cam_data.type = 'ORTHO'
cam_data.ortho_scale = scale
cam_data.clip_end = 40
cam.rotation_euler = rot.to_euler()

# Soft contact shadow under the courier; EEVEE has no shadow catcher. It rides with the rig like the camera.
mat = bpy.data.materials.new('SHADOW | courier')
mat.use_nodes = True
mat.surface_render_method = 'BLENDED'
nt = mat.node_tree
nt.nodes.clear()
tc = nt.nodes.new('ShaderNodeTexCoord')
grad = nt.nodes.new('ShaderNodeTexGradient'); grad.gradient_type = 'SPHERICAL'
sharp = nt.nodes.new('ShaderNodeMath'); sharp.operation = 'POWER'; sharp.inputs[1].default_value = 1.6
amt = nt.nodes.new('ShaderNodeMath'); amt.operation = 'MULTIPLY'; amt.inputs[1].default_value = .42
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
bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, FLOOR + .002))
blob = bpy.context.object
blob.name = 'SHADOW | courier'
blob.data.materials.append(mat)
blob.scale = (.30, .30 * .72, 1)
blob.visible_shadow = False

offset = right * float(centre[0]) + up * float(centre[1]) + VIEW * 12
for f in frames:
    cam.location = travel[f] + offset
    cam.keyframe_insert('location', frame=f)
    blob.location = (travel[f].x + .02, travel[f].y, FLOOR + .002)
    blob.keyframe_insert('location', frame=f)

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

todo = frames
if '--part' in args:
    k, n = map(int, args[args.index('--part') + 1].split('/'))
    todo = todo[k::n]
for f in todo:
    s.frame_set(f)
    s.render.filepath = os.path.join(OUT, 'frame-%03d.png' % (f - FIRST))
    bpy.ops.render.render(write_still=True)
print('WALK_FRAMES_DONE', len(todo), OUT, flush=True)
