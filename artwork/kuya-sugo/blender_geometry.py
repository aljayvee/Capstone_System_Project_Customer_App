"""Shared original Blender geometry and material authoring helpers."""
import math
import bpy
from mathutils import Vector
PARTS = []

def linear(hex_value):
    return tuple(v / 12.92 if v < .04045 else ((v + .055) / 1.055) ** 2.4
                 for v in (int(hex_value[i:i+2], 16) / 255 for i in (1, 3, 5)))


def material(name, color, rough=.5, subsurface=0, sheen=0, metal=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*linear(color), 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Subsurface Weight'].default_value = subsurface
    bsdf.inputs['Subsurface Radius'].default_value = (.8, .38, .22)
    bsdf.inputs['Sheen Weight'].default_value = sheen
    mat.diffuse_color = (*linear(color), 1)
    # Named and arranged nodes remain easy to work with in Node Wrangler.
    bsdf.label, bsdf.location = name, (0, 0)
    mat.node_tree.nodes.get('Material Output').location = (340, 0)
    return mat


def finish(obj, name, mat, bone=None):
    obj.name = name
    obj.data.materials.append(mat)
    if obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    if bone:
        PARTS.append((obj, bone))
    return obj


def sphere(name, position, scale, mat, bone=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=28, location=position)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bone)


def rounded(name, pos, size, mat, radius=.05, bone=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new('Manufactured edge radius', 'BEVEL')
    bevel.width, bevel.segments = radius, 5
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    normals = obj.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    normals.keep_sharp = True
    return finish(obj, name, mat, bone)


def tube(name, points, radius, mat, bone=None, cyclic=False):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 16
    data.bevel_depth, data.bevel_resolution = radius, 4
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    spline.use_cyclic_u = cyclic
    for p, co in zip(spline.bezier_points, points):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    obj.select_set(False)
    return finish(obj, name, mat, bone)


def capsule(name, start, end, radius, mat, bone=None, width=None):
    a, b = Vector(start), Vector(end)
    obj = sphere(name, (a+b)/2, (width or radius, radius, (b-a).length/2+radius*.65), mat, bone)
    obj.rotation_euler = (b-a).to_track_quat('Z','Y').to_euler()
    return obj


def loft(name, rings, mat, bone=None, x=0, subdivisions=2):
    vertices, faces, steps = [], [], 48
    for z, rx, ry, cy in rings:
        for i in range(steps):
            t = math.tau*i/steps
            vertices.append((x+rx*math.cos(t), cy+ry*math.sin(t), z))
    for j in range(len(rings)-1):
        for i in range(steps):
            a, b = j*steps+i, j*steps+(i+1)%steps
            faces.append((a,b,b+steps,a+steps))
    faces.extend([tuple(reversed(range(steps))), tuple(range((len(rings)-1)*steps,len(rings)*steps))])
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices,[],faces)
    data.update()
    obj = bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    finish(obj,name,mat,bone)
    mod = obj.modifiers.new('Tailored subdivision surface','SUBSURF')
    mod.levels = mod.render_levels = subdivisions
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def sculpt_union(name, objects, voxel=.018):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    remesh = obj.modifiers.new('Continuous sculpted volume','REMESH')
    remesh.mode, remesh.voxel_size = 'VOXEL', voxel
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = obj.modifiers.new('Relaxed sculpt surface','SMOOTH')
    smooth.factor, smooth.iterations = 1.05, 5
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    sub = obj.modifiers.new('Sculpt finish','SUBSURF')
    sub.levels = sub.render_levels = 1
    bpy.ops.object.modifier_apply(modifier=sub.name)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def letter(name, text, loc, size, mat, bone='head'):
    data = bpy.data.curves.new(name,'FONT')
    data.body, data.align_x, data.align_y = text, 'CENTER','CENTER'
    data.size, data.extrude, data.bevel_depth = size, .0005, .0003
    obj = bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.location, obj.rotation_euler = loc, (math.pi/2,0,0)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    obj.select_set(False)
    return finish(obj,name,mat,bone)
