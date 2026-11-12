"""Hand-authored motion for Kuya Sugo's onboarding story, solved on the Special Delivery rig without Blender operators.

The source story moved him as a rigid block: hips and head never bob, feet lift 3 mm, the trip tips the whole rig over
like a plank pivoting at the feet, and the pickup pivots him 45 degrees from the ankles with the feet floating. Here
every frame is posed from controls instead: the hips and spine are keyed, the legs are two-bone IK onto footsteps that
stay planted (heel strike, toe-off, a swing arc), the hips bob and sway with whichever foot carries the weight, and the
head and parcel lag a little behind the body. Pure mathutils, so render_story_clip.py can pose hundreds of frames fast.

Armature space: +X is where he faces, +Y his left, +Z up; the soles rest on z = FLOOR when the rig sits at z = 0.
Angles are degrees. pitch: + leans forward (about +Y); roll: + lifts the left side (about +X); yaw: + turns left.
"""
import math
from collections import defaultdict
from mathutils import Vector, Matrix, Quaternion

FLOOR = -0.49
ANKLE_Z = -0.435                     # ankle height with the shoe flat on the floor
HEEL = Vector((-0.05, 0.0, -0.05))   # heel-strike pivot, from the ankle
BALL = Vector((0.085, 0.0, -0.055))  # toe-off pivot (ball of the foot), from the ankle
FWD = Vector((1, 0, 0))
SIDES = ('L', 'R')
SIGN = {'L': 1.0, 'R': -1.0}


def R(axis, deg):
    return Matrix.Rotation(math.radians(deg), 3, axis)


def ypr(yaw=0.0, pitch=0.0, roll=0.0):
    return R('Z', yaw) @ R('Y', pitch) @ R('X', roll)


def clamp(v, a=0.0, b=1.0):
    return max(a, min(b, v))


def smooth(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def slerp3(a, b, t):
    return a.to_quaternion().slerp(b.to_quaternion(), t).to_matrix()


class Track:
    """A keyed float channel: cubic Hermite through the keys with Catmull-Rom slopes, so motion arcs and overshoots
    through its keys instead of stopping at each; 'flat' keys ease in and out (holds, contacts), 'lin' runs straight
    to the next key."""

    def __init__(self, default=0.0):
        self.default = default
        self.keys = []

    def key(self, f, v, mode='auto'):
        self.keys = [k for k in self.keys if k[0] != f] + [(float(f), float(v), mode)]
        self.keys.sort(key=lambda k: k[0])
        return self

    def __call__(self, f):
        k = self.keys
        if not k:
            return self.default
        if f <= k[0][0]:
            return k[0][1]
        if f >= k[-1][0]:
            return k[-1][1]
        lo, hi = 0, len(k) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if k[mid][0] <= f:
                lo = mid
            else:
                hi = mid
        (f0, v0, m0), (f1, v1, _) = k[lo], k[hi]
        h = f1 - f0
        t = (f - f0) / h
        if m0 == 'lin':
            return v0 + (v1 - v0) * t

        def slope(j):
            if k[j][2] == 'flat' or j == 0 or j == len(k) - 1:
                return 0.0
            if k[j][2] == 'lin':
                return (k[j + 1][1] - k[j][1]) / (k[j + 1][0] - k[j][0])
            if k[j - 1][2] == 'lin':
                return (k[j][1] - k[j - 1][1]) / (k[j][0] - k[j - 1][0])
            return (k[j + 1][1] - k[j - 1][1]) / (k[j + 1][0] - k[j - 1][0])
        a, b = slope(lo) * h, slope(hi) * h
        t2, t3 = t * t, t * t * t
        return (2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * a + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * b

    def keys_from(self, pairs, mode='auto'):
        for f, v in pairs:
            self.key(f, v, mode)
        return self


class Body:
    """Rest data of the Special Delivery rig and an FK/IK solver that turns controls into pose-bone matrix_basis."""

    def __init__(self, rig):
        bones = rig.data.bones
        depth = {}
        for b in bones:
            d, p = 0, b.parent
            while p:
                d, p = d + 1, p.parent
            depth[b.name] = d
        self.order = sorted((b.name for b in bones), key=lambda n: depth[n])
        self.rest = {b.name: b.matrix_local.copy() for b in bones}
        self.parent = {b.name: (b.parent.name if b.parent else None) for b in bones}
        self.rel = {n: (self.rest[p].inverted() @ self.rest[n] if p else self.rest[n]) for n, p in self.parent.items()}
        self.length = {b.name: b.length for b in bones}
        self.rest_head = {b.name: b.head_local.copy() for b in bones}
        self.thigh = (self.rest_head['shin.L'] - self.rest_head['thigh.L']).length
        self.shin = (self.rest_head['foot.L'] - self.rest_head['shin.L']).length
        self.upper = (self.rest_head['forearm.L'] - self.rest_head['upper_arm.L']).length
        self.fore = (self.rest_head['hand.L'] - self.rest_head['forearm.L']).length

    def fk(self, basis):
        pose = {}
        for n in self.order:
            p = self.parent[n]
            pose[n] = (pose[p] @ self.rel[n] if p else self.rel[n]) @ basis[n]
        return pose

    def default(self, pose, n):
        """Where bone n sits if its own basis is identity, given its parent's pose."""
        p = self.parent[n]
        return pose[p] @ self.rel[n] if p else self.rel[n]

    def orient(self, pose, basis, n, O):
        """Pose bone n with armature-space orientation O (3x3), keeping its head where its parent puts it."""
        D = self.default(pose, n)
        b = (D.to_3x3().inverted() @ O).to_4x4()
        basis[n] = b
        pose[n] = D @ b

    def local(self, pose, basis, n, M3):
        basis[n] = M3.to_4x4()
        pose[n] = self.default(pose, n) @ basis[n]

    def two_bone(self, pose, basis, upper, lower, target, pole, a, b):
        """Analytic two-bone IK: the end of `lower` reaches `target` (clamped to reach), bending toward `pole`."""
        H = self.default(pose, upper).translation
        d = target - H
        D = clamp(d.length, abs(a - b) + 1e-4, (a + b) * 0.9995)
        u = d.normalized()
        v = pole - u * pole.dot(u)
        if v.length < 1e-6:
            v = Vector((0, 0, 1)) - u * u.z
        v.normalize()
        cos_a = clamp((a * a + D * D - b * b) / (2 * a * D), -1.0, 1.0)
        K = H + u * (a * cos_a) + v * (a * math.sqrt(1 - cos_a * cos_a))
        T = H + u * D
        # The hinge is the bone's rest Z (lateral) axis; keep it on the side it starts on.
        restZ = self.default(pose, upper).to_3x3().col[2]
        n = v.cross(u)
        if n.dot(restZ) < 0:
            n = -n
        for bone, head, tail in ((upper, H, K), (lower, K, T)):
            Y = (tail - head).normalized()
            Z = (n - Y * n.dot(Y)).normalized()
            X = Y.cross(Z)
            self.orient(pose, basis, bone, Matrix((X, Y, Z)).transposed())
        return T

    def pose(self, c):
        """Controls -> (matrix_basis per bone, armature-space pose per bone). All targets are armature space."""
        basis = {n: Matrix.Identity(4) for n in self.order}
        pose = {}
        pose['root'] = self.rel['root']
        Rp = self.rest['pelvis'].to_3x3()
        Qp = c['pelvis_rot']
        basis['pelvis'] = Matrix.LocRotScale(Rp.inverted() @ c['pelvis_off'], (Rp.inverted() @ Qp @ Rp).to_quaternion(), None)
        pose['pelvis'] = self.default(pose, 'pelvis') @ basis['pelvis']
        for n, q in (('chest', c['chest']), ('head', c['head'])):
            Rb = self.rest[n].to_3x3()
            self.local(pose, basis, n, Rb.inverted() @ q @ Rb)
        for s in SIDES:
            foot = c['feet'][s]
            self.two_bone(pose, basis, 'thigh.' + s, 'shin.' + s, foot['ankle'], foot['pole'], self.thigh, self.shin)
            self.orient(pose, basis, 'foot.' + s, foot['rot'] @ self.rest['foot.' + s].to_3x3())
        for s in SIDES:
            arm = c['arms'][s]
            names = ['upper_arm.' + s, 'forearm.' + s, 'hand.' + s, 'fingers.' + s]
            if arm['mode'] == 'basis':
                for n in names:
                    self.local(pose, basis, n, arm['basis'][n].to_3x3())
            elif arm['mode'] == 'ik':
                self.two_bone(pose, basis, names[0], names[1], arm['wrist'], arm['pole'], self.upper, self.fore)
                self.orient(pose, basis, names[2], arm['hand'])
                self.local(pose, basis, names[3], arm.get('fingers', Matrix.Identity(3)))
        return basis, pose

    def swing_basis(self, s, fwd, out, elbow, wrist=0.0, twist=0.0):
        """Arm FK in each bone's own frame (X forward, Y along the bone, Z lateral): forward swing, out to the side,
        elbow and wrist flex. Same signs for both arms; `out` is mirrored here."""
        sg = SIGN[s]
        return {
            'upper_arm.' + s: (R('Y', twist * sg) @ R('X', out * sg) @ R('Z', -fwd)).to_4x4(),
            'forearm.' + s: R('Z', -elbow).to_4x4(),
            'hand.' + s: R('Z', -wrist).to_4x4(),
            'fingers.' + s: R('Z', -wrist * 0.4).to_4x4(),
        }


def blend_basis(a, b, w):
    if w <= 0:
        return a
    if w >= 1:
        return b
    out = {}
    for n in a:
        la, ra, _ = a[n].decompose()
        lb, rb, _ = b[n].decompose()
        out[n] = Matrix.LocRotScale(la.lerp(lb, w), ra.slerp(rb, w), None)
    return out


# ---------------------------------------------------------------------------------------------------------------------
# Footsteps

class Step:
    def __init__(self, side, lift, land, a, b, height=0.045, off=26.0, strike=14.0, land_pivot=None, settle=True):
        self.side, self.lift, self.land = side, lift, land
        self.a, self.b = a, b                      # (x, y, yaw) of the flat foot's ankle on the floor
        self.height, self.off, self.strike = height, off, strike
        # A normal step lands on the heel (toe up by `strike`) and rolls flat; a stubbed toe lands on the ball pitched
        # forward (negative strike) and stays there until the next lift (settle=False).
        self.land_pivot = land_pivot or HEEL
        self.settle = settle


ROLL_IN, ROLL_OUT = 5.0, 3.0                       # frames of heel rise before a lift, and heel-to-flat after a land


def foot_at(x, y, yaw, pitch, pivot):
    """Ankle position and foot rotation for a foot whose flat ankle sits at (x, y), pitched about a pivot."""
    Ry = R('Z', yaw)
    flat = Vector((x, y, ANKLE_Z))
    P = flat + Ry @ pivot
    rot = Ry @ R('Y', pitch)
    return P + rot @ (-pivot), rot


class Feet:
    def __init__(self, start):
        self.start = dict(start)                  # side -> (x, y, yaw)
        self.steps = {'L': [], 'R': []}

    def add(self, step):
        self.steps[step.side].append(step)
        self.steps[step.side].sort(key=lambda st: st.lift)
        return step

    def last_planted(self, side, f):
        pos, last, nxt = self.start[side], None, None
        for st in self.steps[side]:
            if st.land <= f:
                pos, last = st.b, st
            elif nxt is None:
                nxt = st
        return pos, last, nxt

    def state(self, side, f):
        """(ankle, rotation, planted weight 0..1) of one foot at frame f, in world space."""
        for st in self.steps[side]:
            if st.lift <= f < st.land:
                s = (f - st.lift) / (st.land - st.lift)
                a0, r0 = foot_at(*st.a, st.off, BALL)
                a1, r1 = foot_at(*st.b, -st.strike, st.land_pivot)
                e = s - math.sin(2 * math.pi * s) / (2 * math.pi)      # cycloid: slow off the floor, slow onto it
                ankle = a0.lerp(a1, e)
                ankle.z += st.height * math.sin(math.pi * min(1.0, s * 1.1)) ** 0.9
                pitch = lerp(st.off, -st.strike, smooth(s))
                yaw = lerp(st.a[2], st.b[2], smooth(s))
                return ankle, R('Z', yaw) @ R('Y', pitch), 0.0
        (x, y, yaw), last, nxt = self.last_planted(side, f)
        held = last is not None and not last.settle
        if nxt is not None and f > nxt.lift - ROLL_IN:
            t = smooth((f - (nxt.lift - ROLL_IN)) / ROLL_IN)
            p0 = -last.strike if held else 0.0
            ankle, rot = foot_at(x, y, yaw, lerp(p0, nxt.off, t), BALL)
            return ankle, rot, 1.0 - 0.7 * t
        if held:
            ankle, rot = foot_at(x, y, yaw, -last.strike, last.land_pivot)
            return ankle, rot, 0.5
        if last is not None and f < last.land + ROLL_OUT:
            t = smooth((f - last.land) / ROLL_OUT)
            ankle, rot = foot_at(x, y, yaw, -last.strike * (1 - t), last.land_pivot)
            return ankle, rot, 0.4 + 0.6 * t
        ankle, rot = foot_at(x, y, yaw, 0.0, BALL)
        return ankle, rot, 1.0


# ---------------------------------------------------------------------------------------------------------------------
# The story

class Story:
    """Channels for one continuous performance. Everything is evaluated per output frame by `controls`."""

    def __init__(self, body, carry_basis, box_in_hand):
        self.body = body
        self.T = defaultdict(Track)
        self.carry = carry_basis                  # source carry pose of both arms (matrix_basis per arm bone)
        self.box_in_hand = box_in_hand            # parcel relative to hand.L in that carry pose
        self.feet = None
        self.foot_override = {'L': [], 'R': []}   # (f0, f1, fn(f) -> (ankle, rot, pole)); weight track '<s>.ov'
        self.arm_ik = {'L': [], 'R': []}          # (f0, f1, fn(f, ctx) -> (wrist, hand_rot3, pole)); weight '<s>.ik'
        self.box_world = []                       # (f0, f1, fn(f) -> Matrix); weight track 'box.world'
        self.arm_basis = {'L': [], 'R': []}       # (f0, f1, fn(f) -> basis dict); weight track '<s>.fixed'
        self.n = 0
        self.zauto = {}

    # -- helpers for authoring
    def ch(self, name):
        return self.T[name]

    def rig_matrix(self, f):
        return Matrix.Translation((self.T['px'](f), 0, 0)) @ R('Z', self.T['byaw'](f)).to_4x4()

    def _walk_auto(self, f):
        """Hip yaw, roll and sway that come from which foot is ahead and which carries the weight."""
        st = {s: self.feet.state(s, f) for s in SIDES}
        inv = self.rig_matrix(f).inverted()
        xa = {s: (inv @ st[s][0]).x for s in SIDES}
        wL, wR = st['L'][2], st['R'][2]
        tot = max(1e-3, wL + wR)
        bal = (wL - wR) / tot                      # +1 all weight on the left foot
        ahead = clamp((xa['L'] - xa['R']) / 0.17, -1.0, 1.0)
        return {'yaw': -6.0 * ahead, 'roll': 2.5 * bal, 'sway': 0.009 * bal, 'ahead': ahead}

    def prepare(self, n):
        """Precompute what needs neighbouring frames: walk auto (smoothed), hip height from leg reach, arm-swing lag."""
        self.n = n
        raw = [self._walk_auto(f) for f in range(n)]
        sm = []
        for f in range(n):
            acc, wsum = defaultdict(float), 0.0
            for d, w in ((-2, 1), (-1, 2), (0, 3), (1, 2), (2, 1)):
                g = min(n - 1, max(0, f + d))
                for k, v in raw[g].items():
                    acc[k] += v * w
                wsum += w
            sm.append({k: v / wsum for k, v in acc.items()})
        self.auto = sm
        # Highest the hips can sit with every weighted foot still within reach (a straight-but-soft knee).
        reach = (self.body.thigh + self.body.shin) * 0.975
        hip_off = {s: self.body.rest_head['thigh.' + s] - self.body.rest_head['pelvis'] for s in SIDES}
        z = []
        for f in range(n):
            ww = self.T['ww'](f)
            rig = self.rig_matrix(f)
            inv = rig.inverted()
            Qp = self.pelvis_rot(f)
            off = self.pelvis_off_xy(f)
            ztop = self.body.rest_head['pelvis'].z - 0.004
            for s in SIDES:
                ankle, _, w = self.feet.state(s, f)
                if w < 0.3:
                    continue
                a = inv @ ankle
                hip = self.body.rest_head['pelvis'] + Vector((off.x, off.y, 0)) + Qp @ hip_off[s]
                dxy = math.hypot(hip.x - a.x, hip.y - a.y)
                dz = math.sqrt(max(0.0, reach * reach - dxy * dxy))
                ztop = min(ztop, a.z + dz - (Qp @ hip_off[s]).z)
            z.append(ztop)
        zs = []
        for f in range(n):
            acc = sum(z[min(n - 1, max(0, f + d))] * w for d, w in ((-2, 1), (-1, 2), (0, 3), (1, 2), (2, 1))) / 9
            zs.append(min(acc, z[f] + 0.002))
        self.zauto = zs

    def pelvis_rot(self, f):
        T, ww = self.T, self.T['ww'](f)
        a = self.auto[f] if self.auto else {'yaw': 0, 'roll': 0}
        return ypr(T['p.yaw'](f) + ww * a['yaw'], T['p.pitch'](f), T['p.roll'](f) + ww * a['roll'])

    def pelvis_off_xy(self, f):
        T, ww = self.T, self.T['ww'](f)
        sway = self.auto[f]['sway'] if self.auto else 0.0
        return Vector((T['p.dx'](f), T['p.dy'](f) + ww * sway, 0))

    def pelvis_z(self, f):
        return lerp(self.zauto[f] + self.T['p.dz'](f), self.T['p.z'](f), self.T['p.zw'](f))

    def hip_world(self, f, s):
        b = self.body
        off = self.pelvis_off_xy(f)
        off.z = self.pelvis_z(f) - b.rest_head['pelvis'].z
        Qp = self.pelvis_rot(f)
        local = b.rest_head['pelvis'] + off + Qp @ (b.rest_head['thigh.' + s] - b.rest_head['pelvis'])
        return self.rig_matrix(f) @ local

    def pelvis_world_rot(self, f):
        return self.rig_matrix(f).to_3x3() @ self.pelvis_rot(f)

    def controls(self, f, extra=None):
        """Controls for frame f (armature space), the rig matrix, and the parcel's world matrix maker."""
        b, T = self.body, self.T
        rig = self.rig_matrix(f)
        inv = rig.inverted()
        inv3 = inv.to_3x3()
        ww = T['ww'](f)
        a = self.auto[f]
        Qp = self.pelvis_rot(f)
        off = self.pelvis_off_xy(f)
        off.z = self.pelvis_z(f) - b.rest_head['pelvis'].z
        breath = T['breath'](f) * 1.3 * math.sin(2 * math.pi * f / 38.0)
        chest = ypr(T['c.yaw'](f) - ww * a['yaw'] * T['c.counter'](f), T['c.pitch'](f) + breath, T['c.roll'](f) - ww * a['roll'] * 0.6)
        head = ypr(T['h.yaw'](f) + ww * a['yaw'] * 0.3, T['h.pitch'](f), T['h.roll'](f) - ww * a['roll'] * 0.4)
        feet = {}
        for s in SIDES:
            ankle, rot, _ = self.feet.state(s, f)
            pole_w = rig.to_3x3() @ (Qp @ Vector((1, 0.12 * SIGN[s], 0)))
            ov = T[s + '.ov'](f)
            if ov > 0:
                for f0, f1, fn in self.foot_override[s]:
                    if f0 <= f <= f1:
                        oa, orot, opole = fn(f)
                        ankle = ankle.lerp(oa, ov)
                        rot = slerp3(rot, orot, ov)
                        if opole is not None:
                            pole_w = pole_w.lerp(opole, ov)
                        break
            feet[s] = {'ankle': inv @ ankle, 'rot': inv3 @ rot, 'pole': inv3 @ pole_w}
        c = {'pelvis_rot': Qp, 'pelvis_off': off, 'chest': chest, 'head': head, 'feet': feet,
             'arms': {s: {'mode': 'basis', 'basis': self.arm_fk(s, f)} for s in SIDES}}
        return c, rig

    def arm_fk(self, s, f):
        T = self.T
        a = self.auto[f]
        ww = T['ww'](f)
        g = max(0, f - 2)                          # arms trail the legs by a couple of frames
        ahead = self.auto[g]['ahead'] * ww * T['swingw'](f)
        fwd = T[s + '.fwd'](f) - SIGN[s] * 20.0 * ahead
        elbow = T[s + '.elbow'](f) + 12.0 * max(0.0, -SIGN[s] * ahead)
        swing = self.body.swing_basis(s, fwd, T[s + '.out'](f), elbow, T[s + '.wrist'](f), T[s + '.twist'](f))
        carry = {n: m for n, m in self.carry.items() if n.endswith('.' + s)}
        out = blend_basis(swing, carry, T[s + '.carry'](f))
        w = T[s + '.fixed'](f)
        if w > 0:
            for f0, f1, fn in self.arm_basis[s]:
                if f0 <= f <= f1:
                    out = blend_basis(out, fn(f), w)
                    break
        return out

    def solve(self, f, head_extra=None, box_lag=0.0):
        """Pose frame f: returns (rig matrix, basis, armature-space pose, parcel world matrix)."""
        b, T = self.body, self.T
        c, rig = self.controls(f)
        if head_extra is not None:
            c['head'] = c['head'] @ head_extra
        if box_lag:
            for s in SIDES:
                arm = c['arms'][s]['basis']
                arm = dict(arm)
                arm['upper_arm.' + s] = arm['upper_arm.' + s] @ R('Z', box_lag).to_4x4()
                c['arms'][s]['basis'] = arm
        basis, pose = b.pose(c)
        inv = rig.inverted()
        # Arm IK overrides, blended over the FK result per bone.
        for s in SIDES:
            w = T[s + '.ik'](f)
            if w <= 0:
                continue
            for f0, f1, fn in self.arm_ik[s]:
                if f0 <= f <= f1:
                    wrist, hand, pole = fn(f, rig, pose)
                    c2 = {'mode': 'ik', 'wrist': inv @ wrist, 'hand': inv.to_3x3() @ hand, 'pole': inv.to_3x3() @ pole}
                    c['arms'][s] = c2
                    basis_ik, _ = b.pose(c)
                    names = [n for n in basis if n.endswith('.' + s) and n.split('.')[0] in ('upper_arm', 'forearm', 'hand', 'fingers')]
                    mix = blend_basis({n: basis[n] for n in names}, {n: basis_ik[n] for n in names}, w)
                    basis.update(mix)
                    pose = b.fk(basis)
                    break
        box = rig @ pose['hand.L'] @ self.box_in_hand
        w = T['box.world'](f)
        if w > 0:
            for f0, f1, fn in self.box_world:
                if f0 <= f <= f1:
                    bw = fn(f)
                    if w >= 1:
                        box = bw
                    else:
                        l0, r0, _ = box.decompose()
                        l1, r1, _ = bw.decompose()
                        box = Matrix.LocRotScale(l0.lerp(l1, w), r0.slerp(r1, w), None)
                    break
        return rig, basis, pose, box
