"""Renders Kuya Sugo's whole crossing of the second onboarding screen as one screen-wide clip.

He walks in from beyond the left edge carrying the parcel, catches his toe in the middle and stumbles, the parcel
flying ahead, belly-flops, shakes it off, gets up, walks to the parcel and squat-lifts it, step-turns to the viewer for
a thumbs-up, turns back and walks out past the right edge. The clip loops, so the lane is empty at both ends. The app
only shows it; nothing is timed in JavaScript.

The motion is authored in story_choreography.py and solved per frame by story_motion.py (planted-foot IK, hip bob and
sway, overlap on the head and parcel) on the Special Delivery rig; only the source's carry pose of the arms is reused.
The source's thumbs-up (a glove of spheres scaled up over the hand) is replaced: thumbs_up_sculpt.py sculpts a fist
with a raised thumb into the real glove as a shape key, which eases in while the arm rises.
Usage: blender -b --python render_story_clip.py -- [--poses-only | --frames A,B,C | --frames A-B:STEP] [--preview]
                                                   [--part K/N] [--from F] [--save PATH]
--preview renders at half size with 4 samples into scratch/kuya-sugo-blender/story-preview (story-frames untouched).
"""
import bpy, os, sys, math, numpy as np
from mathutils import Vector, Matrix, Quaternion

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from thumbs_up_sculpt import sculpt_thumbs_up
from brand_colors import apply_brand_colors, apply_brand_look
from armpit_fix import fix_right_armpit
from story_motion import Body
from story_choreography import build, FPS

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.environ.get('DELIVERY_SOURCE', r'C:/Capstone_Server/character_animation/smooth_fix/Chibi_Special_Delivery.blend')
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.join(ROOT, 'scratch', 'kuya-sugo-blender', 'story-preview' if '--preview' in args else 'story-frames')
ASPECT = 2.2                         # lane width / height (390 dp phone, 176 dp tall mascot)
SIZE = (1056, 480)
# Level with him: from any raised three-quarter view a fixed orthographic camera shows his straight walk as a slope
# (about 8 degrees at a 14-degree tilt), so he would sink a quarter of the frame crossing the screen.
VIEW = Vector((.5, -.85, 0)).normalized()
FLOOR = -.49
os.makedirs(OUT, exist_ok=True)


bpy.ops.wm.open_mainfile(filepath=SRC)
s = bpy.context.scene
for name in ['Title', 'Subtitle', 'Footer', 'Reassurance card', 'Reassurance text', 'Infinite studio floor', 'Circular delivery stage', 'Stage top']:
    bpy.data.objects[name].hide_render = True
rig = bpy.data.objects['RIG | Courier']
char = next(o for o in bpy.data.objects if o.name.startswith('Courier |'))
box = bpy.data.objects['PARCEL | animated hand / floor handoff']
glove = bpy.data.objects['GESTURE | sculpted thumbs-up glove']
smile = bpy.data.objects['EXPRESSION | reassuring smile']
for o in glove.children_recursive:
    o.hide_render = o.hide_viewport = True
smile.animation_data_clear()
smile.hide_render = smile.hide_viewport = False
# Cap and shirt in the app's brand colour (palette.ts primary) instead of the source's pale pink.
apply_brand_colors(char)
apply_brand_look(s)
# The thumbs-up arm otherwise drags the shirt side out into a lump under the armpit.
fix_right_armpit(char)
pb = rig.pose.bones
names = [p.name for p in pb]

# --- The source's carry pose (arms around the parcel) is all that is kept from its story; story_choreography.py
# poses every frame of the new performance on the same rig.
STORY = rig.animation_data.action
cache = {}
def sample(u):
    u = round(u, 4)
    if u not in cache:
        rig.animation_data.action = STORY
        char.hide_viewport = True    # only the rig and parcel are needed while sampling
        f = math.floor(u)
        s.frame_set(f, subframe=u - f)
        R_ = rig.matrix_world.copy()
        cache[u] = {'rig': R_, 'pose': {n: pb[n].matrix_basis.copy() for n in names}, 'box': R_.inverted() @ box.matrix_world}
        char.hide_viewport = False
    return cache[u]
W0 = sample(24)
body = Body(rig)
carry_basis = {n: W0['pose'][n].copy() for n in names if n.split('.')[0] in ('upper_arm', 'forearm', 'hand', 'fingers')}
box_in_hand = body.fk(W0['pose'])['hand.L'].inverted() @ W0['box']
YAW = math.degrees(math.atan2(VIEW.y, VIEW.x))
timeline, marks, story = build(body, carry_basis, box_in_hand, YAW, log=lambda *a: print(*a, flush=True))
rig.animation_data.action = None

# --- Lane framing: centre the screen between the trip and the pickup, then crop the walk in and out to the lane.
rot = (-VIEW).to_track_quat('-Z', 'Y').to_matrix()
right, up = rot.col[0], rot.col[1]
def char_bounds(rig_m, pose):
    rig.matrix_world = rig_m
    for n in names:
        pb[n].matrix_basis = pose[n]
    bpy.context.view_layer.update()
    e = char.evaluated_get(bpy.context.evaluated_depsgraph_get())
    pts = [e.matrix_world @ Vector(c) for c in e.bound_box]
    return min(p.dot(right) for p in pts), max(p.dot(right) for p in pts), min(p.dot(up) for p in pts), max(p.dot(up) for p in pts)
E = marks['E']
walk_b = []
for k in range(E - 20, E, 3):
    fr = timeline[k]
    rx_ = fr['rig'].translation.dot(right)
    b_ = char_bounds(fr['rig'], fr['pose'])
    walk_b.append((b_[0] - rx_, b_[1] - rx_, b_[2], b_[3]))
# Screen reach past the rig while walking: his body, the parcel's front corner, and the shadow under him.
ahead = max(max(b[1] for b in walk_b), .32 * right.x) + .03
behind = min(min(b[0] for b in walk_b), -.30 * right.x) - .03
lo_v, hi_v = min(b[2] for b in walk_b), max(b[3] for b in walk_b)
# The parcel lands ahead of him, nearer the camera, so it reaches lower on screen than his feet ever do.
corners = [Vector(c) for c in box.bound_box]
lo_v = min(lo_v, min(min((fr['rig'] @ fr['box'] @ c).dot(up) for c in corners) for fr in timeline[E:marks['stand']])) - .015
VERT = (hi_v - lo_v) * 1.1
WIDTH = VERT * ASPECT
trip_x = timeline[marks['trip']]['rig'].translation.x
stand_x = timeline[marks['stand']]['rig'].translation.x
centre = .5 * (trip_x + stand_x) * right.x
left_edge, right_edge = centre - WIDTH / 2, centre + WIDTH / 2
first = max(k for k in range(E + 1) if timeline[k]['rig'].translation.dot(right) + ahead < left_edge)
last = min(k for k in range(marks['walkout'], len(timeline)) if timeline[k]['rig'].translation.dot(right) + behind > right_edge)
frames = timeline[first:last + 1]
event_start = E - first
thumbs_start = marks['thumbs'] - first
still = marks['still'] - first
k = last - marks['walkout']
print('STORY frames', len(frames), 'fps', FPS, 'walk-in', event_start, 'event', event_start, 'thumbs', thumbs_start, 'still', still,
      'walk-out', k, 'lane', round(WIDTH, 3), 'x', round(VERT, 3), flush=True)
# package_chibi_clips.py reads this, so the packed frame count and still always match the timeline that was rendered.
import json
with open(os.path.join(OUT, 'story.json'), 'w') as fh:
    json.dump({'count': len(frames), 'still': still, 'fps': FPS, 'thumbs': thumbs_start}, fh)

# --- Bake: key every output frame on the rig, every bone, the parcel and the fist shape key.
char.hide_viewport = False
for o in (rig, box):
    o.animation_data_clear()
# The parcel's world path was sampled with its hand-attachment constraint applied; left on with its influence
# animation cleared, the constraint would glue the parcel to his hand while it should lie on the floor.
for c in list(box.constraints):
    box.constraints.remove(c)
char.data.shape_keys.animation_data_clear()
for kb in char.data.shape_keys.key_blocks[1:]:
    kb.value = 0
fist_key = sculpt_thumbs_up(char)
rig.rotation_mode = 'QUATERNION'
box.rotation_mode = 'QUATERNION'
for p in pb:
    p.rotation_mode = 'QUATERNION'
s.render.fps = FPS
s.frame_start, s.frame_end = 0, len(frames) - 1
for f, st in enumerate(frames):
    rig.matrix_world = st['rig']
    rig.keyframe_insert('location', frame=f); rig.keyframe_insert('rotation_quaternion', frame=f)
    for n in names:
        pb[n].matrix_basis = st['pose'][n]
        pb[n].keyframe_insert('location', frame=f, group=n)
        pb[n].keyframe_insert('rotation_quaternion', frame=f, group=n)
    box.matrix_world = st['rig'] @ st['box']
    box.keyframe_insert('location', frame=f); box.keyframe_insert('rotation_quaternion', frame=f)
    fist_key.value = st['fist']
    fist_key.keyframe_insert('value', frame=f)
rig.animation_data.action.name = 'Courier | onboarding crossing'

# --- Camera fixed on the lane.
cam = bpy.data.objects.new('CAMERA | onboarding lane', bpy.data.cameras.new('Onboarding lane'))
s.collection.objects.link(cam)
s.camera = cam
cam.data.type = 'ORTHO'
cam.data.ortho_scale = WIDTH          # the longer side of this landscape frame
cam.data.clip_end = 40
cam.rotation_euler = rot.to_euler()
cam.location = right * centre + up * ((lo_v + hi_v) / 2) + VIEW * 12

# --- Soft contact shadows (EEVEE has no shadow catcher): one for the courier, one for the parcel when it is low. A
# level camera sees the floor edge-on, so each shadow is an ellipse facing the camera, centred on the floor line just
# behind what casts it, where his feet hide its middle and it shows around them.
def blob_material(name, strength):
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
    return mat, amt.inputs[1]
FACING = VIEW.to_track_quat('Z', 'Y').to_euler()
def blob(name, strength):
    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, FLOOR))
    o = bpy.context.object
    o.name = name
    o.rotation_euler = FACING
    mat, amount = blob_material(name, strength)
    o.data.materials.append(mat)
    o.visible_shadow = False
    return o, amount
body_blob, _ = blob('SHADOW | courier', .5)
box_blob, box_amount = blob('SHADOW | parcel', .42)
char.hide_viewport = True             # the shadows only follow bones and the parcel
for f in range(len(frames)):
    s.frame_set(f)
    hip = rig.matrix_world @ pb['pelvis'].head
    top = rig.matrix_world @ pb['head'].tail
    mid = (hip + top) / 2
    span = abs((top - hip).dot(right))            # how far he lies along the screen
    ground = Vector((mid.x + .02, mid.y, FLOOR)) - VIEW * .35
    body_blob.location = ground
    body_blob.scale = (.27 + .5 * span, .04, 1)
    body_blob.keyframe_insert('location', frame=f); body_blob.keyframe_insert('scale', frame=f)
    bl = box.matrix_world.translation
    height = bl.z - .1 - FLOOR
    box_blob.location = Vector((bl.x, bl.y, FLOOR)) - VIEW * .2
    box_blob.scale = (.16, .03, 1)
    box_blob.keyframe_insert('location', frame=f); box_blob.keyframe_insert('scale', frame=f)
    box_amount.default_value = .42 * max(0.0, 1 - height / .2)
    box_amount.keyframe_insert('default_value', frame=f)
char.hide_viewport = False

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
s.frame_set(still)

if '--save' in args:
    bpy.ops.wm.save_as_mainfile(filepath=args[args.index('--save') + 1], copy=True)
    print('STORY_SAVED', args[args.index('--save') + 1], flush=True)
if '--preview' in args:
    s.eevee.taa_render_samples = 4
    s.render.resolution_percentage = 50
if '--frames' in args:
    todo = []
    for tok in args[args.index('--frames') + 1].split(','):
        if '-' in tok:
            rng, _, step = tok.partition(':')
            lo, hi = map(int, rng.split('-'))
            todo += list(range(lo, hi + 1, int(step or 1)))
        else:
            todo.append(int(tok))
    todo = [f for f in todo if 0 <= f < len(frames)]
elif '--poses-only' in args:
    todo = sorted({0, event_start // 2, event_start, event_start + 8, event_start + 15, event_start + 22,
                   event_start + 45, event_start + 64, event_start + 80, event_start + 100, event_start + 130,
                   thumbs_start - 28, thumbs_start - 20, thumbs_start - 4, thumbs_start + 10, still, thumbs_start + 70,
                   len(frames) - k // 2, len(frames) - 1})
    todo = [f for f in todo if 0 <= f < len(frames)]
elif '--no-render' in args:
    todo = []
else:
    # --from F re-renders only the tail, when a change leaves every earlier frame as it was.
    todo = list(range(int(args[args.index('--from') + 1]) if '--from' in args else 0, len(frames)))
if '--part' in args:
    kk, nn = map(int, args[args.index('--part') + 1].split('/'))
    todo = todo[kk::nn]
for f in todo:
    s.frame_set(f)
    s.render.filepath = os.path.join(OUT, 'frame-%04d.png' % f)
    bpy.ops.render.render(write_still=True)
print('STORY_FRAMES_DONE', len(todo), OUT, flush=True)
