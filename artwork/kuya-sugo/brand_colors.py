"""Recolours the courier's pale-pink cap and shirt to the Sugo Express brand colour, in memory, for the render scripts.

The Tripo character carries its colours in one baked 4096 px texture. The pink cloth sits at hue ~0.97 with linear
saturation 0.37-0.81; skin and gloves are near-grey (saturation under 0.1) and the only other saturated cluster is a
warm tan at hue 0.05-0.10. So a soft hue/saturation mask picks out the cloth alone, and the brand colour replaces it
scaled by the texture's own luminance, which keeps the baked folds, seams and ambient occlusion. The source blend is
never saved; every render script calls apply_brand_colors after opening it.

Settled in the live viewport against a #F62459 swatch: a looser mask (saturation from .18, value from .02) also caught
the pinkish shading baked under the cap brim and specks on the shoes, and AgX (the file's view transform) rolls the
brand red off to coral (212, 95, 109) at any gain, so apply_brand_look switches the render to Standard, where gain .75
lands the shirt near (218, 57, 90) and the lit cap crown near (255, 86, 120) while skin and gloves barely move.
"""
import bpy

BRAND = '#F62459'      # CustomerApp src/config/palette.ts "primary"
PINK_HUE = .97
PINK_LUMINANCE = .474  # median linear luminance of the pink cloth texels


def srgb_to_linear(hex_color):
    def channel(v):
        v /= 255
        return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
    h = hex_color.lstrip('#')
    return tuple(channel(int(h[i:i + 2], 16)) for i in (0, 2, 4))


def _math(nt, op, a, b=None, clamp=False):
    n = nt.nodes.new('ShaderNodeMath')
    n.operation = op
    n.use_clamp = clamp
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def _ramp(nt, value, lo, hi, rising=True):
    n = nt.nodes.new('ShaderNodeMapRange')
    n.interpolation_type = 'SMOOTHSTEP'
    nt.links.new(value, n.inputs['Value'])
    n.inputs['From Min'].default_value, n.inputs['From Max'].default_value = lo, hi
    n.inputs['To Min'].default_value, n.inputs['To Max'].default_value = (0, 1) if rising else (1, 0)
    return n.outputs['Result']


def apply_brand_look(scene):
    """AgX desaturates the brand red; Standard shows it as the app does."""
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'


def apply_brand_colors(char, hex_color=BRAND, gain=.75, sat=(.28, .42), val=(.10, .20)):
    """Insert the recolour between the base-colour texture and the Principled BSDF of the courier's material."""
    done = []
    for slot in char.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        nt = mat.node_tree
        bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        link = next((l for l in nt.links if bsdf and l.to_node == bsdf and l.to_socket.name == 'Base Color'), None)
        if not link or link.from_node.type != 'TEX_IMAGE':
            continue
        color = link.from_socket
        hsv = nt.nodes.new('ShaderNodeSeparateColor')
        hsv.mode = 'HSV'
        nt.links.new(color, hsv.inputs['Color'])
        # Hue distance from pink, wrapping at 1.0.
        off = _math(nt, 'ABSOLUTE', _math(nt, 'SUBTRACT', hsv.outputs['Red'], PINK_HUE))
        dist = _math(nt, 'MINIMUM', off, _math(nt, 'SUBTRACT', 1.0, off))
        mask = _math(nt, 'MULTIPLY', _ramp(nt, dist, .05, .09, rising=False), _ramp(nt, hsv.outputs['Green'], *sat))
        mask = _math(nt, 'MULTIPLY', mask, _ramp(nt, hsv.outputs['Blue'], *val), clamp=True)
        lum = nt.nodes.new('ShaderNodeRGBToBW')
        nt.links.new(color, lum.inputs['Color'])
        shade = _math(nt, 'MULTIPLY', lum.outputs['Val'], gain / PINK_LUMINANCE)
        brand = nt.nodes.new('ShaderNodeRGB')
        brand.outputs[0].default_value = (*srgb_to_linear(hex_color), 1)
        scaled = nt.nodes.new('ShaderNodeVectorMath')
        scaled.operation = 'SCALE'
        nt.links.new(brand.outputs[0], scaled.inputs[0])
        nt.links.new(shade, scaled.inputs['Scale'])
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        nt.links.new(mask, mix.inputs['Factor'])
        nt.links.new(color, mix.inputs[6])
        nt.links.new(scaled.outputs['Vector'], mix.inputs[7])
        nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
        done.append(mat.name)
    print('BRAND_COLORS', hex_color, done, flush=True)
    return done
