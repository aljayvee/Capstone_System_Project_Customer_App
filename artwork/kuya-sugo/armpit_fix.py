"""Stops the courier's shirt side from bulging out under his right arm when the arm comes up, in memory, for the render scripts.

The Special Delivery rig weights the shirt side down to the hem 55-70% to upper_arm.R (measured at the splash's
thumbs-up: z -0.11 to -0.05, y -0.14), so any forward or raised right arm drags that side of the shirt out with it into
a lump under the armpit. The torso and the sleeve are one surface, so the split between them is found along the mesh:
a vertex nearer the torso (centre front/back, lower shirt side) than the bare forearm/hand, measured over its edges,
hands its upper-arm weight to the chest. Nothing gains arm weight. Over the shoulder top (z above about -0.01) the
original weights stay, because moving them there left a compression fold from neck to sleeve. A corrective smooth
relaxes only the armhole band. render_chibi_wave_clip.py has its own shoulder rebuild for the arm raised beside the
head; that one tore the collar on the forward thumbs-up arm, so this is a separate, smaller fix.

Settled on the splash (kuya-sugo-splash.blend, source frame 310) against a before/after close-up. The source blend is
never saved; every render script calls fix_right_armpit after opening it.
"""
import bpy, heapq
import numpy as np


def _smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def _surface_distance(n, ptr, nbr, length, seeds):
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


def fix_right_armpit(char):
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
    F = W[:, gi['forearm.R']] + W[:, gi['hand.R']] + W[:, gi['fingers.R']]
    UA = W[:, gi['upper_arm.R']]
    arm = np.where((y < 0) & (F > .6))[0]
    torso = np.where(((np.abs(y) < .06) & (z < .05) & (z > -.17) & (W[:, gi['head']] < .05))
                     | ((z < -.11) & (y > -.16) & (y < 0) & (F < .05)))[0]
    nbr = b.tolist()
    # > 0: nearer the arm along the surface; < 0: nearer the torso.
    delta = _surface_distance(n, ptr, nbr, length, torso) - _surface_distance(n, ptr, nbr, length, arm)
    region = (y < -.03) & (z > -.22) & (z < .08) & (W[:, gi['head']] < .05) & (UA > 0)
    keep = _smoothstep(-.10, .09, delta)
    keep = keep + (1 - keep) * _smoothstep(-.07, -.01, z)
    moved = UA * (1 - keep)
    idx = np.where(region & (moved > 1e-4))[0]
    g_arm, g_chest = char.vertex_groups['upper_arm.R'], char.vertex_groups['chest']
    for i in map(int, idx):
        g_arm.add([i], float(UA[i] - moved[i]), 'REPLACE')
        g_chest.add([i], float(W[i, gi['chest']] + moved[i]), 'REPLACE')
    relax = np.exp(-((delta + .005) / .09) ** 2) * region * (1 - .7 * _smoothstep(-.04, .02, z))
    grp = char.vertex_groups.new(name='Relax armhole')
    for i in map(int, np.where(relax > .02)[0]):
        grp.add([i], float(relax[i]), 'REPLACE')
    cs = char.modifiers.new('Relax armhole', 'CORRECTIVE_SMOOTH')
    cs.rest_source, cs.smooth_type, cs.iterations, cs.factor, cs.vertex_group = 'ORCO', 'LENGTH_WEIGHTED', 90, 1, grp.name
    print('ARMPIT_FIXED', len(idx), 'verts', flush=True)
