"""Kuya Sugo's crossing of the second onboarding screen, keyed on story_motion's controls at 20 fps.

He walks in with the parcel, catches his right toe, stumbles two quick steps while the parcel flies out of his hands,
belly-flops (knees, then chest, legs kicking up behind), lies a moment, lifts his head and shakes it, pushes up to his
knees, steps up to standing, brushes off his shirt, walks to the parcel, squats and lifts it (turning it upright on the
way), nods, step-turns to the viewer for the thumbs-up, turns back and walks out. Frame E is the left heel strike just
before the trip; everything before it is walk-in, which render_story_clip.py crops to the lane.
"""
import math
from mathutils import Vector, Matrix
from story_motion import (Story, Feet, Step, Track, R, ypr, smooth, lerp, slerp3, clamp, blend_basis,
                          FLOOR, ANKLE_Z, BALL, HEEL, SIGN, SIDES)

FPS = 20
V = 0.017            # walking speed: 2.5 short chibi steps a second, 0.136 each
STEP_T, SWING_T = 8, 6
HALF = 0.068
WY = 0.09            # half the gap between the feet while walking
ANK_X = -0.05        # flat ankle x relative to the rig origin when standing over it
E = 150              # left heel strike before the trip
GRAVITY = 0.0105     # units per frame squared (cartoon-light: he reads about 1 m tall)


def walk_steps(feet, cur, first_side, first_land, count, x_at, y=WY, step=STEP_T, swing=SWING_T, height=0.04,
               ahead=HALF, off=24.0, strike=12.0):
    side = first_side
    for i in range(count):
        land = first_land + i * step
        b = (x_at(land) + ANK_X + ahead, SIGN[side] * y, 0.0)
        feet.add(Step(side, land - swing, land, cur[side], b, height, off, strike))
        cur[side] = b
        side = 'R' if side == 'L' else 'L'
    return side


def keys(story, name, pairs, mode='auto'):
    t = story.T[name]
    for item in pairs:
        f, v = item[0], item[1]
        t.key(f, v, item[2] if len(item) > 2 else mode)
    return t


def arc(p0, p1, t, h):
    e = smooth(t)
    p = p0.lerp(p1, e)
    p.z += h * math.sin(math.pi * clamp(t))
    return p


def build(body, carry_basis, box_in_hand, view_yaw, log=print):
    st = Story(body, carry_basis, box_in_hand)
    T = st.T
    px = T['px']

    # ---------------------------------------------------------------- walk in (carrying), to the left heel strike at E
    px.key(0, -V * E, 'lin').key(E, 0.0)
    cur = {'L': (px(-16) + ANK_X + HALF, WY, 0.0), 'R': (px(-8) + ANK_X + HALF, -WY, 0.0)}
    st.feet = Feet(cur)
    walk_steps(st.feet, cur, 'L', E - 18 * STEP_T, 19, px)  # L lands at E-144 ... E
    keys(st, 'ww', [(0, 1, 'flat'), (E + 4, 1, 'flat'), (E + 9, 0, 'flat')])
    for s in SIDES:
        keys(st, s + '.carry', [(0, 1, 'flat'), (E + 5, 1, 'flat'), (E + 8, 0, 'flat')])
    keys(st, 'c.counter', [(0, 1.0, 'flat')])
    keys(st, 'p.pitch', [(0, 2.5, 'flat'), (E, 2.5, 'flat')])
    keys(st, 'c.pitch', [(0, -3.0, 'flat'), (E, -3.0, 'flat')])
    keys(st, 'h.yaw', [(0, 0, 'flat'), (E - 52, 0, 'flat'), (E - 44, -26), (E - 32, -24, 'flat'), (E - 24, 0, 'flat')])
    keys(st, 'h.roll', [(0, 0, 'flat'), (E - 52, 0, 'flat'), (E - 44, 5), (E - 32, 5, 'flat'), (E - 24, 0, 'flat')])

    # ---------------------------------------------------------------- the trip
    xr_stub = cur['R'][0] + 2 * V * STEP_T * 0.3
    stub = (xr_stub, -WY, 0.0)
    st.feet.add(Step('R', E + 2, E + 5, cur['R'], stub, height=0.022, off=26, strike=-38, land_pivot=BALL, settle=False))
    px.key(E + 5, 0.08).key(E + 8, 0.13).key(E + 12, 0.198).key(E + 15, 0.25).key(E + 17, 0.29).key(E + 19, 0.33)
    px.key(E + 21, 0.368).key(E + 23, 0.398).key(E + 26, 0.422).key(E + 29, 0.43, 'flat')
    r1 = (0.198 + ANK_X + 0.01, -WY, 0.0)
    st.feet.add(Step('R', E + 8, E + 12, stub, r1, height=0.035, off=38, strike=6))
    l1 = (0.25 + ANK_X - 0.01, WY, 0.0)
    st.feet.add(Step('L', E + 11, E + 15, cur['L'], l1, height=0.03, off=30, strike=4))
    cur['R'], cur['L'] = r1, l1
    keys(st, 'p.zw', [(E + 4, 0, 'flat'), (E + 9, 1, 'flat')])
    keys(st, 'p.z', [(E + 4, -0.196), (E + 8, -0.196), (E + 12, -0.199), (E + 15, -0.21), (E + 17, -0.242),
                     (E + 19, -0.300), (E + 21, -0.345), (E + 23, -0.379), (E + 25, -0.362), (E + 28, -0.379, 'flat')])
    keys(st, 'p.pitch', [(E + 5, 8), (E + 8, 24), (E + 11, 34), (E + 14, 44), (E + 17, 55), (E + 19, 64),
                         (E + 21, 76), (E + 23, 86), (E + 25, 81), (E + 28, 84, 'flat')])
    keys(st, 'c.pitch', [(E + 4, -3), (E + 8, 12), (E + 14, 14), (E + 19, 8), (E + 23, 0), (E + 25, -6),
                         (E + 28, -2, 'flat')])
    keys(st, 'h.pitch', [(0, 0, 'flat'), (E + 4, 0, 'flat'), (E + 7, -22), (E + 12, -40), (E + 17, -45),
                         (E + 21, -48), (E + 23, -28), (E + 25, -38), (E + 28, -26, 'flat')])
    # Arms let go of the parcel and fling forward, then reach out to break the fall.
    for s in SIDES:
        keys(st, s + '.fwd', [(E + 5, 0, 'flat'), (E + 8, 95), (E + 12, 125), (E + 16, 145), (E + 20, 155),
                              (E + 23, 150), (E + 26, 142), (E + 29, 148, 'flat')])
        keys(st, s + '.out', [(E + 5, 0, 'flat'), (E + 8, 18), (E + 12, 25), (E + 16, 32), (E + 23, 55),
                              (E + 29, 52, 'flat')])
        keys(st, s + '.elbow', [(E + 5, 15, 'flat'), (E + 8, 30), (E + 12, 20), (E + 16, 15), (E + 23, 38),
                                (E + 26, 30), (E + 29, 34, 'flat')])
        keys(st, s + '.wrist', [(E + 16, 0, 'flat'), (E + 23, -15), (E + 29, -10, 'flat')])
    # Legs: knees hit the floor, then lie out behind with a little kick up and flop.
    for s in SIDES:
        keys(st, s + '.ov', [(E + 15, 0, 'flat'), (E + 19, 1, 'flat')])
    keys(st, 'leg.prone', [(E + 19, 0, 'flat'), (E + 23, 1, 'flat')])
    keys(st, 'kick', [(E + 22, 0, 'flat'), (E + 25, 1), (E + 28, 0.3), (E + 30, 0, 'flat')])

    # ---------------------------------------------------------------- down, dazed
    keys(st, 'p.z', [(E + 40, -0.379, 'flat'), (E + 44, -0.374), (E + 48, -0.379, 'flat'), (E + 56, -0.379, 'flat')])
    keys(st, 'p.pitch', [(E + 56, 84, 'flat')])
    keys(st, 'h.pitch', [(E + 34, -24, 'flat'), (E + 42, -56), (E + 45, -52, 'flat'), (E + 54, -52, 'flat')])
    keys(st, 'c.pitch', [(E + 36, -2, 'flat'), (E + 42, -14), (E + 54, -14, 'flat')])
    keys(st, 'h.yaw', [(E + 44, 0, 'flat'), (E + 46, 14), (E + 48, -14), (E + 50, 10), (E + 52, -5), (E + 54, 0, 'flat')])
    keys(st, 'h.roll', [(E + 44, 0, 'flat'), (E + 47, 6), (E + 50, -5), (E + 54, 0, 'flat')])

    # ---------------------------------------------------------------- push up to the knees, step up, stand
    keys(st, 'p.pitch', [(E + 64, 60), (E + 70, 32), (E + 76, 10), (E + 84, 12), (E + 90, 20), (E + 98, 0),
                         (E + 101, -3), (E + 105, 0, 'flat')])
    keys(st, 'p.z', [(E + 64, -0.336), (E + 70, -0.316), (E + 76, -0.306), (E + 84, -0.300, 'flat'), (E + 90, -0.262),
                     (E + 97, -0.192), (E + 100, -0.197, 'flat')])
    keys(st, 'p.zw', [(E + 98, 1, 'flat'), (E + 104, 0, 'flat')])
    px.key(E + 56, 0.43, 'flat').key(E + 68, 0.372).key(E + 84, 0.372, 'flat').key(E + 97, 0.43, 'flat')
    keys(st, 'c.pitch', [(E + 56, -12), (E + 62, -15), (E + 70, 5), (E + 76, -2), (E + 84, 6), (E + 92, 10),
                         (E + 99, 0, 'flat')])
    keys(st, 'h.pitch', [(E + 60, -40), (E + 70, -12), (E + 80, -5), (E + 98, 0, 'flat')])
    keys(st, 'leg.prone', [(E + 58, 1, 'flat'), (E + 67, 0, 'flat')])
    keys(st, 'knee.dx', [(E + 58, 0.0, 'flat'), (E + 67, 0.01, 'flat')])
    # Hands plant beside the chest for the push-up, then lift away once he is on his knees.
    for s in SIDES:
        keys(st, s + '.ik', [(E + 50, 0, 'flat'), (E + 56, 1, 'flat'), (E + 68, 1, 'flat'), (E + 74, 0, 'flat')])
        keys(st, s + '.fwd', [(E + 56, 148, 'flat'), (E + 70, 40), (E + 76, 14), (E + 90, 18), (E + 98, 4, 'flat')])
        keys(st, s + '.out', [(E + 56, 52, 'flat'), (E + 70, 14), (E + 78, 0), (E + 98, -10, 'flat')])
        keys(st, s + '.elbow', [(E + 56, 34, 'flat'), (E + 70, 40), (E + 78, 25), (E + 98, 14, 'flat')])
        keys(st, s + '.wrist', [(E + 56, -10, 'flat'), (E + 72, 0, 'flat')])
    # Out of the kneel: right foot forward (half kneel), then up, the left foot following beside it.
    stand_R = (0.372 + ANK_X + 0.13, -0.10, 0.0)
    stand_L = (0.43 + ANK_X - 0.01, 0.10, 0.0)
    st.feet.add(Step('R', E + 40, E + 41, cur['R'], stand_R))
    st.feet.add(Step('L', E + 40, E + 41, cur['L'], stand_L))
    cur['R'], cur['L'] = stand_R, stand_L
    keys(st, 'R.rise', [(E + 76, 0, 'flat'), (E + 84, 1, 'flat')])
    keys(st, 'L.rise', [(E + 91, 0, 'flat'), (E + 99, 1, 'flat')])
    keys(st, 'R.ov', [(E + 84, 1, 'flat'), (E + 85, 0, 'flat')])
    keys(st, 'L.ov', [(E + 99, 1, 'flat'), (E + 100, 0, 'flat')])

    # ---------------------------------------------------------------- brush off, look at the parcel
    keys(st, 'R.fwd', [(E + 100, 4, 'flat'), (E + 104, 42), (E + 113, 42, 'flat'), (E + 118, 4, 'flat')])
    keys(st, 'R.out', [(E + 100, -10, 'flat'), (E + 104, -34), (E + 113, -34, 'flat'), (E + 118, -10, 'flat')])
    keys(st, 'R.elbow', [(E + 100, 14, 'flat'), (E + 104, 96), (E + 106, 80), (E + 108, 100), (E + 110, 80),
                         (E + 112, 98), (E + 114, 90), (E + 118, 14, 'flat')])
    keys(st, 'R.wrist', [(E + 104, 0, 'flat'), (E + 106, 20), (E + 108, -10), (E + 110, 20), (E + 112, -5), (E + 114, 0, 'flat')])
    keys(st, 'c.pitch', [(E + 102, 0, 'flat'), (E + 106, 7), (E + 113, 7, 'flat'), (E + 117, 0, 'flat')])
    keys(st, 'h.pitch', [(E + 102, 0, 'flat'), (E + 106, 18), (E + 113, 18, 'flat'), (E + 118, -3), (E + 121, 4, 'flat')])
    keys(st, 'h.roll', [(E + 113, 0, 'flat'), (E + 116, 6), (E + 120, 0, 'flat')])
    keys(st, 'breath', [(E + 28, 0, 'flat'), (E + 32, 1.4, 'flat'), (E + 54, 1.4, 'flat'), (E + 58, 0, 'flat'),
                        (E + 100, 0, 'flat'), (E + 104, 1, 'flat'), (E + 118, 1, 'flat'), (E + 121, 0, 'flat')])

    # ---------------------------------------------------------------- leg overrides (fall, kneel, rise)
    def legs(s):
        def fn(f):
            hip = st.hip_world(f, s)
            Qw = st.pelvis_world_rot(f)
            K = Vector((hip.x + T['knee.dx'](f), hip.y, FLOOR + 0.035))
            ank_k = K + Vector((-0.105, 0.0, 0.014))
            rot_k = R('Y', 162)
            pole_k = Vector((1.0, 0.12 * SIGN[s], -0.6))
            kick = T['kick'](f)
            ank_p = hip + Qw @ Vector((-0.12 * kick, 0.0, -0.245 + 0.095 * kick))
            rot_p = Qw @ R('Y', 95 + 40 * kick)
            pole_p = Qw @ Vector((1.0, 0.1 * SIGN[s], 0.0))
            w = T['leg.prone'](f)
            ank, rot, pole = ank_k.lerp(ank_p, w), slerp3(rot_k, rot_p, w), pole_k.lerp(pole_p, w)
            rise = T[s + '.rise'](f)
            if rise > 0:
                a1, r1, _ = st.feet.state(s, f)
                ank = arc(ank, a1, rise, 0.08)
                rot = slerp3(rot, r1, smooth(rise))
                pole = pole.lerp(st.rig_matrix(f).to_3x3() @ (st.pelvis_rot(f) @ Vector((1, 0.12 * SIGN[s], 0))), rise)
            return ank, rot, pole
        return fn
    for s in SIDES:
        st.foot_override[s].append((E + 14, E + 100, legs(s)))

    # First pass, to find where the parcel leaves his hands.
    st.prepare(E + 40)
    rel = E + 7
    _, _, _, b0 = st.solve(rel - 1)
    _, _, _, b1 = st.solve(rel)
    p_rel = b1.translation.copy()
    O_rel = b1.to_3x3().normalized()
    O_land = R('Y', 90)
    z_rest = FLOOR + 0.1075 + 0.002
    SLIDE = 0.07
    # Land clear of where his head ends up when he lies flat, then slide a little further.
    _, _, pose_flat, _ = st.solve(E + 30)
    hd = st.rig_matrix(E + 30) @ pose_flat['head']
    tip = (hd @ Vector((0, 0.218, 0))).x + 0.25
    t_land = 13.0
    x_land = tip + 0.14
    # It lands square in his path (y = 0), so he can walk straight up to it.
    vel = Vector(((x_land - p_rel.x) / t_land, -p_rel.y / t_land,
                  (z_rest - p_rel.z + GRAVITY / 2 * t_land * t_land) / t_land))

    def parcel_flight(f):
        t = f - rel
        if t <= t_land:
            p = p_rel + vel * t
            p.z -= GRAVITY / 2 * t * t
            return Matrix.Translation(p) @ slerp3(O_rel, O_land, smooth(t / t_land) * 0.85 + 0.15 * (t / t_land)).to_4x4()
        u = t - t_land
        x = x_land + SLIDE * (1 - math.exp(-u / 3.0))
        hop = 0.02 * math.sin(math.pi * u / 4.5) if u < 4.5 else 0.0
        rock = 9.0 * math.exp(-u / 3.5) * math.sin(u * 1.3)
        return Matrix.Translation((x, 0.0, z_rest + hop)) @ (R('Y', -rock) @ O_land).to_4x4()
    box_floor = parcel_flight(rel + 80)
    B = box_floor.translation.x
    log('PARCEL release', rel, 'at', tuple(round(v, 3) for v in p_rel), 'vel', tuple(round(v, 4) for v in vel),
        'head tip', round(tip, 3), 'lands', round(t_land, 1), 'frames later at x', round(x_land, 3), 'rests at', round(B, 3))

    # Planted hands for the push-up: beside the shoulders where he lies.
    st.prepare(E + 60)
    _, _, pose_lie, _ = st.solve(E + 56)
    rig_lie = st.rig_matrix(E + 56)
    plant = {}
    for s in SIDES:
        sh = rig_lie @ pose_lie['upper_arm.' + s].translation
        plant[s] = Vector((sh.x + 0.02, sh.y + SIGN[s] * 0.07, FLOOR + 0.045))
    palm_down = {'L': Matrix(((0, 1, 0), (-1, 0, 0), (0, 0, 1))), 'R': Matrix(((0, 1, 0), (1, 0, 0), (0, 0, -1)))}

    def push_ik(s):
        def fn(f, rig, pose):
            return plant[s], palm_down[s], Vector((-1.0, 0.7 * SIGN[s], 0.3))
        return fn
    for s in SIDES:
        st.arm_ik[s].append((E + 48, E + 76, push_ik(s)))

    # ---------------------------------------------------------------- walk to the parcel
    x_stop = B - 0.26
    d = x_stop - stand_R[0]
    W0 = E + 118
    keys(st, 'ww', [(W0 - 2, 0, 'flat'), (W0 + 2, 1, 'flat')])
    keys(st, 'swingw', [(0, 0, 'flat'), (W0, 0, 'flat'), (W0 + 4, 1, 'flat')])
    keys(st, 'c.counter', [(W0, 1.6, 'flat')])
    # Steps of at most ~0.18 past the other foot, then the trailing foot closes beside the last one.
    m = max(1, math.ceil(d / 0.15))
    sl = d / m
    side, front = 'L', stand_R[0]
    px.key(W0, 0.43, 'flat')
    for i in range(m):
        b = (front + sl, SIGN[side] * 0.095, 0.0) if i < m - 1 else (x_stop, SIGN[side] * 0.11, 0.0)
        land = W0 + 2 + STEP_T * i + SWING_T + 1
        st.feet.add(Step(side, land - SWING_T - 1, land, cur[side], b, height=0.04))
        cur[side] = b
        other = cur['R' if side == 'L' else 'L'][0]
        px.key(land, (b[0] + other) / 2 - ANK_X + 0.02)
        front = b[0]
        side = 'R' if side == 'L' else 'L'
    close = (x_stop, SIGN[side] * 0.11, 0.0)
    land = W0 + 2 + STEP_T * m + SWING_T
    st.feet.add(Step(side, land - SWING_T, land, cur[side], close, height=0.025, off=14, strike=6))
    cur[side] = close
    W1 = land + 2                         # both feet down at the parcel
    keys(st, 'ww', [(W1 - 4, 1, 'flat'), (W1 + 2, 0, 'flat')])
    keys(st, 'swingw', [(W1 - 6, 1, 'flat'), (W1, 0, 'flat')])
    keys(st, 'c.counter', [(W1, 1.6, 'flat'), (W1 + 8, 1.0, 'flat')])
    px.key(W1, x_stop - ANK_X, 'flat')
    keys(st, 'h.pitch', [(W0 + 4, 4), (W1 - 10, 8), (W1, 12)])
    for s in SIDES:
        keys(st, s + '.fwd', [(W0, 4, 'flat'), (W1, 4, 'flat')])
        keys(st, s + '.out', [(W0, -10, 'flat'), (W1, -10, 'flat')])
        keys(st, s + '.elbow', [(W0, 14, 'flat'), (W1, 16, 'flat')])

    # ---------------------------------------------------------------- squat, grip, lift (turning it upright)
    P = W1 + 2
    keys(st, 'p.zw', [(P - 2, 0, 'flat'), (P + 1, 1, 'flat'), (P + 34, 1, 'flat'), (P + 38, 0, 'flat')])
    keys(st, 'p.z', [(P - 2, -0.196, 'flat'), (P + 10, -0.31), (P + 13, -0.316), (P + 15, -0.309), (P + 17, -0.313, 'flat'),
                     (P + 29, -0.190), (P + 32, -0.186), (P + 36, -0.194, 'flat')])
    keys(st, 'p.dx', [(P, 0, 'flat'), (P + 10, -0.025), (P + 17, -0.025, 'flat'), (P + 30, 0, 'flat')])
    keys(st, 'p.pitch', [(P - 2, 0, 'flat'), (P + 10, 34), (P + 14, 36), (P + 17, 37, 'flat'), (P + 28, 5), (P + 31, -2),
                         (P + 35, 2.5, 'flat')])
    keys(st, 'c.pitch', [(P - 2, 0, 'flat'), (P + 10, 22), (P + 17, 22, 'flat'), (P + 28, 2), (P + 32, -4), (P + 36, -3, 'flat')])
    keys(st, 'h.pitch', [(P - 2, 12), (P + 10, -36), (P + 17, -32, 'flat'), (P + 28, -2), (P + 31, 9), (P + 34, -2),
                         (P + 37, 0, 'flat')])
    for s in SIDES:
        keys(st, s + '.ik', [(P + 2, 0, 'flat'), (P + 9, 1, 'flat'), (P + 30, 1, 'flat'), (P + 35, 0, 'flat')])
        keys(st, s + '.carry', [(P + 28, 0, 'flat'), (P + 33, 1, 'flat')])
        keys(st, s + '.fwd', [(P - 2, 4, 'flat'), (P + 6, 40), (P + 12, 60, 'flat')])
        keys(st, s + '.out', [(P - 2, -10, 'flat'), (P + 6, 10, 'flat')])
        keys(st, s + '.elbow', [(P - 2, 16, 'flat'), (P + 6, 20, 'flat')])
    keys(st, 'c.counter', [(P, 1.0, 'flat')])

    # The parcel's carried pose at the end of the lift (he stands in the carry pose by then).
    st.prepare(P + 50)
    rig_c = st.rig_matrix(P + 36)
    _, _, pose_c, box_c = st.solve(P + 36)
    hand_c = {s: rig_c @ pose_c['hand.' + s] for s in SIDES}
    O_floor = box_floor.to_3x3().normalized()
    grip0 = {}
    for s in SIDES:
        wrist = box_floor.translation + Vector((0.0, SIGN[s] * 0.15, 0.035))
        # columns X, Y, Z: fingers down the parcel's side (Y), palm toward it (Z lateral), X forward
        Y = Vector((0.2, 0, -1)).normalized()
        Z = Vector((0, 1, 0))
        X = Y.cross(Z)
        hand = Matrix((X, Y, Z)).transposed()
        grip0[s] = Matrix.Translation(wrist) @ hand.to_4x4()
    box_carry = box_c
    rel0 = {s: box_floor.inverted() @ grip0[s] for s in SIDES}
    rel1 = {s: box_carry.inverted() @ hand_c[s] for s in SIDES}
    L0, L1 = P + 17, P + 30

    def parcel_lift(f):
        t = clamp((f - L0) / (L1 - L0))
        e = smooth(t)
        p = box_floor.translation.lerp(box_carry.translation, e)
        p.z = lerp(box_floor.translation.z, box_carry.translation.z, smooth(min(1.0, t * 1.15)))
        O = slerp3(O_floor, box_carry.to_3x3().normalized(), smooth(clamp((t - 0.15) / 0.85)))
        return Matrix.Translation(p) @ O.to_4x4()

    def box_path(f):
        return parcel_flight(f) if f < L0 else parcel_lift(f)
    st.box_world.append((rel, P + 40, box_path))
    keys(st, 'box.world', [(rel - 1, 0, 'lin'), (rel, 1, 'flat'), (L1, 1, 'flat'), (P + 34, 0, 'flat')])

    def grip_ik(s):
        def fn(f, rig, pose):
            t = clamp((f - L0) / (L1 - L0))
            bx = box_path(f)
            l0, r0, _ = rel0[s].decompose()
            l1, r1, _ = rel1[s].decompose()
            g = Matrix.LocRotScale(l0.lerp(l1, smooth(t)), r0.slerp(r1, smooth(t)), None)
            m = bx @ g
            return m.translation, m.to_3x3().normalized(), Vector((-0.6, 1.0 * SIGN[s], 0.2))
        return fn
    for s in SIDES:
        st.arm_ik[s].append((P, P + 36, grip_ik(s)))

    # ---------------------------------------------------------------- step-turn to the viewer, thumbs-up, turn back
    Q = P + 38
    TURN, RAISE, HOLD, LOWER = 12, 13, 22, 12
    centre = Vector((px(Q), 0.0, 0.0))

    def turned(p, yaw):
        v = R('Z', yaw) @ (Vector((p[0], p[1], 0)) - centre) + centre
        return (v.x, v.y, p[2] + yaw)
    tL, tR = turned(cur['L'], view_yaw), turned(cur['R'], view_yaw)
    st.feet.add(Step('R', Q + 1, Q + 7, cur['R'], tR, height=0.025, off=12, strike=6))
    st.feet.add(Step('L', Q + 5, Q + 11, cur['L'], tL, height=0.025, off=12, strike=6))
    keys(st, 'byaw', [(0, 0, 'flat'), (Q, 0, 'flat'), (Q + TURN, view_yaw, 'flat')])
    Hs = Q + TURN + RAISE
    Hl = Hs + HOLD
    U = Hl + LOWER
    keys(st, 'byaw', [(U, view_yaw, 'flat'), (U + TURN, 0, 'flat')])
    st.feet.add(Step('R', U + 1, U + 7, tR, cur['R'], height=0.025, off=12, strike=6))
    st.feet.add(Step('L', U + 5, U + 11, tL, cur['L'], height=0.025, off=12, strike=6))
    keys(st, 'fist', [(Q + TURN, 0, 'flat'), (Q + TURN + RAISE - 2, 1, 'flat'), (Hl, 1, 'flat'), (Hl + LOWER - 2, 0, 'flat')])
    keys(st, 'pump', [(Hs, 0, 'flat'), (Hs + 5, 1), (Hs + 10, 0, 'flat')])
    keys(st, 'R.fixed', [(Q + TURN, 0, 'flat'), (Hs, 1, 'flat'), (Hl, 1, 'flat'), (U, 0, 'flat')])
    keys(st, 'p.dz', [(Q + TURN, 0, 'flat'), (Q + TURN + 3, -0.012), (Q + TURN + 8, 0.003), (Hs, 0, 'flat'),
                      (Hs + 5, -0.006), (Hs + 10, 0, 'flat')])
    keys(st, 'h.roll', [(Q + TURN, 0, 'flat'), (Hs, 9), (Hl, 9, 'flat'), (U, 0, 'flat')])
    keys(st, 'h.pitch', [(Q, 0, 'flat'), (Hs + 5, 5), (Hs + 10, 0, 'flat')])
    keys(st, 'c.roll', [(Q + TURN, 0, 'flat'), (Hs, -3), (Hl, -3, 'flat'), (U, 0, 'flat')])
    keys(st, 'breath', [(Q, 0, 'flat'), (Q + 4, 1, 'flat'), (U + 6, 1, 'flat'), (U + 10, 0, 'flat')])

    # ---------------------------------------------------------------- walk out (carrying)
    S = U + TURN
    px.key(S, px(S), 'flat')
    x0 = px(S)
    px.key(S + 10, x0 + V * 5).key(S + 18, x0 + V * 13, 'lin').key(S + 200, x0 + V * 195, 'lin')
    keys(st, 'ww', [(S - 2, 0, 'flat'), (S + 2, 1, 'flat'), (S + 400, 1, 'flat')])
    walk_steps(st.feet, cur, 'L', S + 7, 20, px)
    keys(st, 'h.pitch', [(S, 0, 'flat')])
    n = S + 150
    st.prepare(n)

    # Thumbs-up arm, posed in armature space over the turned stand (as the source's), kept relative to the chest.
    rig_t = st.rig_matrix(Hs)
    basis_t, pose_t, _, _ = None, None, None, None
    _, basis_t, pose_t, _ = st.solve(Hs - RAISE)
    names = ['upper_arm.R', 'forearm.R', 'hand.R']

    def arm_pose(shoulder, elbow, wrist):
        pose = dict(pose_t)
        basis = dict(basis_t)
        for nme, q in zip(names, (R('Y', shoulder) @ R('X', -14), R('Y', elbow) @ R('X', -10), R('Y', wrist) @ R('X', -3))):
            body.orient(pose, basis, nme, q @ body.rest[nme].to_3x3())
        out = {nme: basis[nme] for nme in names}
        out['fingers.R'] = basis['fingers.R']
        return out
    THUMB = arm_pose(-32, -118, -92)
    PUMP = arm_pose(-34, -128, -96)
    st.arm_basis['R'].append((Q, U + 2, lambda f: blend_basis(THUMB, PUMP, T['pump'](f))))

    # ---------------------------------------------------------------- overlap: the head lags the chest, the parcel the hips
    raw = [st.solve(f) for f in range(n)]
    pitch, roll, zc = [], [], []
    for rig, basis, pose, box in raw:
        Y = pose['chest'].to_3x3().col[1]
        pitch.append(math.degrees(math.atan2(Y.x, Y.z)))
        roll.append(math.degrees(math.atan2(Y.y, Y.z)))
        zc.append(pose['pelvis'].translation.z)
    hp, hr, bb = [0.0] * n, [0.0] * n, [0.0] * n
    xp = vp = xr = vr = xb = vb = 0.0
    for f in range(1, n - 1):
        ap = pitch[f + 1] - 2 * pitch[f] + pitch[f - 1]
        ar = roll[f + 1] - 2 * roll[f] + roll[f - 1]
        az = zc[f + 1] - 2 * zc[f] + zc[f - 1]
        vp += -0.2 * xp - 0.45 * vp - 0.9 * ap
        xp = clamp(xp + vp, -12, 12)
        vr += -0.2 * xr - 0.45 * vr - 0.9 * ar
        xr = clamp(xr + vr, -8, 8)
        vb += -0.25 * xb - 0.5 * vb + 2600 * az
        xb = clamp(xb + vb, -4, 4)
        hp[f], hr[f], bb[f] = xp, xr, xb
    frames = []
    for f in range(n):
        carry_w = min(T['L.carry'](f), T['R.carry'](f)) * (1 - T['box.world'](f))
        rig, basis, pose, box = st.solve(f, head_extra=ypr(0, hp[f], hr[f]), box_lag=bb[f] * carry_w)
        frames.append({'rig': rig, 'pose': basis, 'box': rig.inverted() @ box, 'fist': clamp(T['fist'](f))})
    marks = {'E': E, 'trip': E + 5, 'stand': P + 36, 'thumbs': Q, 'still': Hs + 15, 'walkout': S, 'n': n,
             'box_rest_x': B}
    return frames, marks, st
