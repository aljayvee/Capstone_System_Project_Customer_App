"""Authors a 'Like saying Hi' wave on the smoothed Special Delivery chibi and renders it for the first onboarding screen.

Same character, lighting, transparent film and contact shadow as render_delivery_clip.py, so both onboarding screens
show one courier, but seen straight from the front. The pose is built from rotations about fixed armature axes rather
than aiming bones, because aiming a hanging arm straight up is a near-180-degree turn with no stable twist. Five
seconds: rest, raise, about three and a half waves at 1.5 Hz, lower, rest with the smile on.

The hand travels rest -> forward-up in front of him -> beside his head and back the same way, each leg a slerp eased on
its own clock, so it never swings out sideways to a stiff horizontal arm the way blending the arm's angles together
did. The palm faces the viewer, opened by the sculpted 'Wave | open palm' key (thumbs_up_sculpt.py) as the hand
arrives, with the wrist flapping a beat behind each forearm swing.

The delivery rig was only weighted for a hanging arm: its upper-arm influence runs down the shirt side to the hem, so a
raised arm dragged the whole side of the shirt up and left the sleeve underside behind as a bag. This script rebuilds
the right shoulder in memory (the source blend is not saved): a shoulder bone shares the lift, and the arm/torso split
follows surface distance from the forearm versus the torso, so the sleeve rises with the arm while the torso side stays
put below a short armpit gradient.
Usage: blender -b --python render_chibi_wave_clip.py -- [--poses-only] [--part K/N]
"""
import bpy, os, sys, math, heapq, numpy as np
from mathutils import Vector, Matrix, Quaternion

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.environ.get('DELIVERY_SOURCE', r'C:/Capstone_Server/character_animation/smooth_fix/Chibi_Special_Delivery.blend')
OUT = os.path.join(ROOT, 'scratch', 'kuya-sugo-blender', 'chibi-hello-frames')
FRAMES, FPS, POSTER = 120, 24, 40      # frame 40: palm open, forearm and wrist mid-swing
SIZE = (576, 672)
VIEW = Vector((1, 0, .15)).normalized()
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=SRC)
s = bpy.context.scene
rig = bpy.data.objects['RIG | Courier']
char = next(o for o in bpy.data.objects if o.name.startswith('Courier |'))
box = bpy.data.objects['PARCEL | animated hand / floor handoff']
glove = bpy.data.objects['GESTURE | sculpted thumbs-up glove']
smile = bpy.data.objects['EXPRESSION | reassuring smile']
for name in ['Title', 'Subtitle', 'Footer', 'Reassurance card', 'Reassurance text', 'Infinite studio floor', 'Circular delivery stage', 'Stage top']:
    bpy.data.objects[name].hide_render = True
# Empty hands for hello: the parcel and the thumbs-up glove belong to the delivery story.
for o in [box, *box.children_recursive, *glove.children_recursive]:
    o.hide_render = True
for o in (rig, box, glove, smile):
    o.animation_data_clear()
char.data.shape_keys.animation_data_clear()
for k in char.data.shape_keys.key_blocks[1:]:
    k.value = 0
smile.hide_render = smile.hide_viewport = False
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brand_colors import apply_brand_colors, apply_brand_look
from thumbs_up_sculpt import sculpt_open_palm
# Cap and shirt in the app's brand colour (palette.ts primary) instead of the source's pale pink.
apply_brand_colors(char)
apply_brand_look(s)
rig.matrix_world = Matrix.Identity(4)
FLOOR = -.49


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def surface_distance(n, ptr, nbr, length, seeds):
    """Dijkstra over mesh edges from every seed vertex at once."""
    dist = [float('inf')] * n
    heap = [(0.0, int(v)) for v in seeds]
    for v in seeds:
        dist[v] = 0.0
    heapq.heapify(heap)
    while heap:
        dv, v = heapq.heappop(heap)
        if dv > dist[v]:
            continue
        for k in range(ptr[v], ptr[v + 1]):
            u, nd = nbr[k], dv + length[k]
            if nd < dist[u]:
                dist[u] = nd
                heapq.heappush(heap, (nd, u))
    return np.array(dist)


def add_shoulder_bone():
    """A clavicle between chest and upper_arm.R, so the shoulder line rises with the arm instead of folding."""
    bpy.context.view_layer.objects.active = rig
    for o in bpy.context.view_layer.objects:
        o.select_set(o == rig)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    sh = eb.new('shoulder.R')
    sh.head, sh.tail, sh.roll = (-.045, -.035, .045), eb['upper_arm.R'].head.copy(), 0
    sh.parent = eb['chest']
    eb['upper_arm.R'].use_connect = False
    eb['upper_arm.R'].parent = sh
    bpy.ops.object.mode_set(mode='OBJECT')


def rebuild_right_shoulder():
    me = char.data
    n = len(me.vertices)
    co = np.empty(n * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    ed = np.empty(len(me.edges) * 2, dtype=np.int64); me.edges.foreach_get('vertices', ed); ed = ed.reshape(-1, 2)
    a, b = np.concatenate([ed[:, 0], ed[:, 1]]), np.concatenate([ed[:, 1], ed[:, 0]])
    order = np.argsort(a, kind='stable'); a, b = a[order], b[order]
    ptr = np.searchsorted(a, np.arange(n + 1)).tolist()
    length = np.linalg.norm(co[a] - co[b], axis=1).tolist()
    gi = {g.name: g.index for g in char.vertex_groups}
    W = np.zeros((n, len(gi)))
    for v in me.vertices:
        for g in v.groups:
            W[v.index, g.group] = g.weight
    y, z = co[:, 1], co[:, 2]
    hand_side = ('forearm.R', 'hand.R', 'fingers.R')
    F = sum(W[:, gi[nm]] for nm in hand_side)
    # Seeds: the bare forearm and hand, versus the torso centre plus the lower shirt side and hips. The sleeve underside
    # touches the torso side in space, but along the surface they only meet at the armpit, which is where delta = 0.
    arm = np.where((y < 0) & (F > .6))[0]
    torso = np.where(((np.abs(y) < .06) & (z < .05) & (z > -.17) & (W[:, gi['head']] < .05))
                     | ((z < -.11) & (y > -.16) & (y < 0) & (F < .05)))[0]
    delta = surface_distance(n, ptr, b.tolist(), length, torso) - surface_distance(n, ptr, b.tolist(), length, arm)
    # The split leans a little toward the torso, a little more over the shoulder top, so the armpit lifts with a short
    # gradient instead of pinning, and the torso side below it keeps its shape.
    off = -.03 - .02 * smoothstep(-.10, 0, z)
    w_arm = smoothstep(-.07, .07, delta - off)
    region = (y < -.03) & (z > -.22) & (W[:, gi['head']] < .3)
    # The proxy solve left forearm weight on the armpit; torso-side vertices must not follow the raised hand.
    keep = smoothstep(-.02, .02, delta)
    F = F * keep
    share = 1 - F
    torso_now = np.clip(1 - sum(W[:, gi[nm]] for nm in hand_side) - W[:, gi['upper_arm.R']], 0, None)
    clav = smoothstep(-.05, -.12, y) * smoothstep(-.05, .02, z)
    sh_group = char.vertex_groups.new(name='shoulder.R')
    torso_groups = [i for nm, i in gi.items() if nm not in ('upper_arm.R', 'head', *hand_side)]
    for i in map(int, np.where(region)[0]):
        body = (1 - w_arm[i]) * share[i]
        char.vertex_groups['upper_arm.R'].add([i], float(w_arm[i] * share[i]), 'REPLACE')
        sh_group.add([i], float(clav[i] * body), 'REPLACE')
        body -= clav[i] * body
        for nm in hand_side:
            if W[i, gi[nm]] > 0:
                char.vertex_groups[nm].add([i], float(W[i, gi[nm]] * keep[i]), 'REPLACE')
        if torso_now[i] > 1e-4:
            for t_i in torso_groups:
                if W[i, t_i] > 0:
                    char.vertex_groups[t_i].add([i], float(W[i, t_i] * body / torso_now[i]), 'REPLACE')
        else:
            char.vertex_groups['chest'].add([i], float(body), 'REPLACE')
    # Folds at the armhole are deformation artefacts, so a stronger relax runs only in a soft band around it.
    relax = np.exp(-((delta - off) / .06) ** 2) * region
    grp = char.vertex_groups.new(name='Relax armhole')
    for i in map(int, np.where(relax > .02)[0]):
        grp.add([i], float(relax[i]), 'REPLACE')
    cs = char.modifiers.new('Relax armhole', 'CORRECTIVE_SMOOTH')
    cs.rest_source, cs.smooth_type, cs.iterations, cs.factor, cs.vertex_group = 'ORCO', 'LENGTH_WEIGHTED', 60, 1, grp.name
    print('SHOULDER_REBUILT', int(region.sum()), flush=True)


add_shoulder_bone()
rebuild_right_shoulder()
pb = rig.pose.bones
rest = {b.name: b.matrix_local.copy() for b in rig.data.bones}
for p in pb:
    p.rotation_mode = 'QUATERNION'
    p.matrix_basis = Matrix.Identity(4)

def ease(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

def place(n, rot):
    """Pose bone n with armature-space rotation rot (applied to its rest orientation), head carried by its parent."""
    b = rig.data.bones[n]
    head = rest[n].translation if not b.parent else (pb[b.parent.name].matrix @ rest[b.parent.name].inverted() @ rest[n]).translation
    pb[n].matrix = Matrix.Translation(head) @ (rot.to_matrix() @ rest[n].to_3x3()).to_4x4()
    bpy.context.view_layer.update()

def rx(deg):
    return Quaternion((1, 0, 0), math.radians(deg))

def twist(rot, n, deg):
    """rot followed by a turn about bone n's own length, as posed by rot."""
    axis = rot.to_matrix() @ (rest[n].to_3x3() @ Vector((0, 1, 0)))
    return Quaternion(axis, math.radians(deg)) @ rot

def ry(deg):
    return Quaternion((0, 1, 0), math.radians(deg))

HZ = 1.5
def pose(f):
    """Returns how far the palm has opened (the sculpted key's value) for frame f."""
    t = f / FPS
    front = ease(5, 15, f) * (1 - ease(97, 111, f))  # rest -> forward-up, in front of him
    beside = ease(11, 25, f) * (1 - ease(87, 101, f))  # forward-up -> waving beside his head
    env = ease(23, 33, f) * (1 - ease(78, 88, f))
    ph = 2 * math.pi * HZ * (t - 23 / FPS)
    wave, flap = math.sin(ph), math.sin(ph - .9)
    for p in pb:
        p.matrix_basis = Matrix.Identity(4)
    pb['pelvis'].location = (0, .004 * (1 - math.cos(ph / 2)) * env, 0)
    bpy.context.view_layer.update()
    lean = 3 * max(front, beside)
    place('chest', rx(-lean))
    place('head', rx(5 * max(front, beside) + 2 * flap * env) @ rx(-lean))
    # Right arm (screen left): the shoulder takes 12 degrees of the lift and the elbow rises to shoulder height while
    # the forearm leans out beside the big head, swinging side to side in the picture plane with the palm to the viewer.
    fwd = Quaternion((0, 0, 1), math.radians(8 * beside))
    place('shoulder.R', rx(-12 * beside - lean))
    place('upper_arm.R', fwd @ rx(-58 * beside - lean))
    rest_q = Quaternion()
    up_fore = twist(fwd @ rx(-136 - 16 * wave * env - lean), 'forearm.R', 40)
    place('forearm.R', rest_q.slerp(ry(-105), front).slerp(up_fore, beside))
    up_hand = twist(fwd @ rx(-146 - 16 * wave * env - 12 * flap * env - lean), 'hand.R', 85)
    place('hand.R', rest_q.slerp(ry(-118), front).slerp(up_hand, beside))
    for n in ['upper_arm.L', 'forearm.L', 'hand.L']:
        place(n, rx(-lean))
    return ease(13, 25, f) * (1 - ease(87, 99, f))

palm = sculpt_open_palm(char)
for f in range(FRAMES):
    s.frame_set(f)
    palm.value = pose(f)
    palm.keyframe_insert('value', frame=f)
    for p in pb:
        p.keyframe_insert('location', frame=f, group=p.name)
        p.keyframe_insert('rotation_quaternion', frame=f, group=p.name)
rig.animation_data.action.name = 'Courier | hello wave'
s.frame_start, s.frame_end = 0, FRAMES - 1

# One fixed camera covering every frame of the wave, centred on the body at rest so the front view stays symmetric.
rot = (-VIEW).to_track_quat('-Z', 'Y').to_matrix()
right, upv = rot.col[0], rot.col[1]
pts, feet, rest_pts = [], [], []
for f in range(FRAMES):
    s.frame_set(f)
    e = char.evaluated_get(bpy.context.evaluated_depsgraph_get())
    corners = [e.matrix_world @ Vector(c) for c in e.bound_box]
    pts += [(p.dot(right), p.dot(upv)) for p in corners]
    if f == 0:
        rest_pts = [(p.dot(right), p.dot(upv)) for p in corners]
    feet.append((sum(p.x for p in corners) / 8, sum(p.y for p in corners) / 8))
pts, rest_pts = np.array(pts), np.array(rest_pts)
lo, hi = pts.min(0), pts.max(0)
cx = (rest_pts[:, 0].min() + rest_pts[:, 0].max()) / 2
cy = (lo[1] + hi[1]) / 2
aspect = SIZE[0] / SIZE[1]
# An orthographic scale spans the longer side of the frame, which is the height of this portrait one.
scale = max(hi[1] - lo[1], 2 * max(cx - lo[0], hi[0] - cx) / aspect) * 1.04
print('FRAMING ortho_scale', round(scale, 3), flush=True)
cam_data = bpy.data.cameras.new('Onboarding hello')
cam = bpy.data.objects.new('CAMERA | onboarding hello', cam_data)
s.collection.objects.link(cam)
s.camera = cam
cam_data.type = 'ORTHO'
cam_data.ortho_scale = scale
cam_data.clip_end = 40
cam.rotation_euler = rot.to_euler()
cam.location = right * float(cx) + upv * float(cy) + VIEW * 12

# Same soft contact shadow as the delivery clip; the courier stays on one spot.
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
bpy.ops.mesh.primitive_plane_add(size=2, location=(float(np.mean([p[0] for p in feet])), float(np.mean([p[1] for p in feet])), FLOOR + .002))
blob = bpy.context.object
blob.name = 'SHADOW | courier'
blob.data.materials.append(mat)
blob.scale = (.27, .27 * .78, 1)
blob.visible_shadow = False

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

todo = [0, 26, 37, POSTER, 52, 100] if '--poses-only' in args else list(range(FRAMES))
if '--part' in args:
    k, n = map(int, args[args.index('--part') + 1].split('/'))
    todo = todo[k::n]
for f in todo:
    s.frame_set(f)
    s.render.filepath = os.path.join(OUT, 'frame-%03d.png' % f)
    bpy.ops.render.render(write_still=True)
print('HELLO_FRAMES_DONE', len(todo), OUT, flush=True)
