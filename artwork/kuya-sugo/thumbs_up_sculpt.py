"""Sculpts hand shapes into the courier's own right glove as shape keys, so gestures morph on the real mesh.

sculpt_thumbs_up (screen 2's story) closes the mitten into a fist with the thumb raised; sculpt_open_palm (screen 1's
wave) runs the same strokes backwards into a flat, open mitten. Notes below describe the thumbs-up.

The source story faked the thumbs-up: a glove of separate spheres scaled up from nothing over the real hand while a
shape key shrank the real glove away, which reads as a lumpy pop. This shape key is sculpted instead, in rest space,
with three strokes and a relax pass:
- curl: the four fused fingers bend further about the knuckle line, more toward the tips, closing the mitten to a fist;
- thumb: the thumb swings up about its base, so it stands clear of the fist on the side a raised forearm turns upward;
- relax: the displacement field is smoothed across the mesh, so the strokes blend with no seam at their falloff edges.
Thumb membership follows surface distance from the thumb tip, because near its base the thumb and the mitten's front
edge sit within the same radius in space but are far apart along the surface.
"""
import heapq, math
import numpy as np
from mathutils import Matrix, Vector


def _smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def _rotate(points, pivot, axis, angles):
    """Rotate each point about axis through pivot by its own angle (radians)."""
    axis = np.asarray(axis, float) / np.linalg.norm(axis)
    p = points - pivot
    c, s = np.cos(angles)[:, None], np.sin(angles)[:, None]
    cross = np.cross(axis, p)
    dot = (p @ axis)[:, None] * axis
    return pivot + p * c + cross * s + dot * (1 - c)


def _surface_distance(n, ptr, nbr, length, seeds, limit):
    dist = np.full(n, np.inf)
    heap = [(0.0, int(v)) for v in seeds]
    for v in seeds:
        dist[v] = 0.0
    heapq.heapify(heap)
    while heap:
        dv, v = heapq.heappop(heap)
        if dv > dist[v] or dv > limit:
            continue
        for k in range(ptr[v], ptr[v + 1]):
            u, nd = nbr[k], dv + length[k]
            if nd < dist[u]:
                dist[u] = nd
                heapq.heappush(heap, (nd, u))
    return dist


def sculpt_thumbs_up(char, name='Thumbs up | sculpted fist', curl=32, thumb_lift=42, relax=40, thumb_core_x=.042, thumb_fade=.05,
                     thumb_pivot=(-.01, -.232, -.215)):
    """Defaults were settled in the live viewport: a stronger curl pushes the fingertips past the palm as a horn, and
    a pivot at the top of the thumb's base stretches the web below it into a fin, so the thumb swings from deep in
    the palm instead."""
    return sculpt_glove(char, name, curl, thumb_lift, .012, relax, thumb_core_x, thumb_fade, thumb_pivot)


def sculpt_open_palm(char, name='Wave | open palm', uncurl=62, thumb_lift=14, relax=40):
    """The same strokes run backwards for a waving hand: the curled fingers straighten into a flat mitten, more toward
    the tips, and lengthen a little instead of tucking; the thumb opens slightly from the palm."""
    return sculpt_glove(char, name, -uncurl, thumb_lift, -.01, relax, .042, .05, (-.01, -.232, -.215))


def sculpt_glove(char, name, curl, thumb_lift, tuck, relax, thumb_core_x, thumb_fade, thumb_pivot):
    me = char.data
    n = len(me.vertices)
    co = np.empty(n * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    ed = np.empty(len(me.edges) * 2, dtype=np.int64); me.edges.foreach_get('vertices', ed); ed = ed.reshape(-1, 2)
    a, b = np.concatenate([ed[:, 0], ed[:, 1]]), np.concatenate([ed[:, 1], ed[:, 0]])
    order = np.argsort(a, kind='stable'); a, b = a[order], b[order]
    ptr = np.searchsorted(a, np.arange(n + 1))
    gi = {g.name: g.index for g in char.vertex_groups}
    W = np.zeros((n, 3))
    for v in me.vertices:
        for g in v.groups:
            if g.group == gi['hand.R']: W[v.index, 0] = g.weight
            elif g.group == gi['fingers.R']: W[v.index, 1] = g.weight
            elif g.group == gi['forearm.R']: W[v.index, 2] = g.weight
    glove = (co[:, 1] < -.12) & (co[:, 2] < -.12) & (W[:, :2].sum(1) > .05)
    x, y, z = co[:, 0], co[:, 1], co[:, 2]

    # Thumb: surface distance from the digit's core (clear of the mitten), 1 there and fading out across its base and
    # the web below it, so the whole thumb, underside included, lifts as one piece.
    core_seed = np.where(glove & (x > thumb_core_x) & (z > -.27) & (z < -.17))[0]
    length = np.linalg.norm(co[a] - co[b], axis=1)
    from_core = _surface_distance(n, ptr.tolist(), b.tolist(), length.tolist(), core_seed, .1)
    thumb = _smoothstep(thumb_fade, 0, from_core) * glove
    # Fingers: everything below the knuckle line that is not thumb, bending more toward the tips.
    fingers = _smoothstep(-.228, -.305, z) * glove * (1 - _smoothstep(.0, .3, thumb))

    new = co.copy()
    bend = np.radians(curl) * fingers
    sel = fingers > 0
    new[sel] = _rotate(co[sel], np.array([0, -.262, -.232]), (1, 0, 0), bend[sel])
    # A curl swings the tips toward the palm and up, and a slight tuck toward the knuckles keeps the fist compact; an
    # uncurl gets a negative tuck, so the straightened fingers reach a little further.
    new[sel, 2] += tuck * fingers[sel] ** 2
    lift = -np.radians(thumb_lift) * thumb
    sel = thumb > 0
    new[sel] = _rotate(new[sel], np.array(thumb_pivot), (0, 1, 0), lift[sel])

    # Relax: average the displacement over neighbours inside the glove, holding the wrist edge still.
    disp = new - co
    nbr = b
    deg = np.diff(ptr).astype(float)
    region = glove & (W[:, 2] < .5)
    for _ in range(relax):
        summed = np.zeros_like(disp)
        np.add.at(summed, a, disp[nbr])
        avg = summed / np.maximum(deg, 1)[:, None]
        disp = np.where(region[:, None], .5 * disp + .5 * avg, disp)
    # Smoothing pulls rigid regions slightly; restore the cores so the curl and lift keep their full amount.
    core = np.maximum(fingers, thumb)[:, None] ** 2
    disp = core * (new - co) + (1 - core) * disp
    final = co + disp * glove[:, None]

    if not me.shape_keys:
        char.shape_key_add(name='Basis', from_mix=False)
    key = me.shape_keys.key_blocks.get(name) or char.shape_key_add(name=name, from_mix=False)
    flat = final.reshape(-1)
    key.data.foreach_set('co', flat)
    key.value = 0
    moved = int((np.linalg.norm(disp, axis=1) > 1e-5).sum())
    print('THUMBS_UP_SCULPTED', name, 'moved', moved, 'thumb verts', int((thumb > .5).sum()), 'finger verts', int((fingers > .5).sum()), flush=True)
    return key
