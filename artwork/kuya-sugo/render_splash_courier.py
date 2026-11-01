"""Renders only the splash courier (with his contact shadow) on a transparent background, for the in-app splash.

AnimatedSplashScreen draws the badge, lettering and blush disc itself, so they follow dark mode and the screen size;
this layer is the part React Native cannot draw. The crop is the disc's square in sugo-splash-1080x2340.png
(x 60..1020, y 960..2010 of 2340), so the disc behind it lines up by proportion. The blend is not saved. Run from
CustomerApp:
blender -b artwork/kuya-sugo/kuya-sugo-splash.blend --factory-startup --python-exit-code 1 --python artwork/kuya-sugo/render_splash_courier.py
"""
import bpy, os

here = os.path.dirname(os.path.abspath(__file__))
s = bpy.context.scene
for o in s.objects:
    if o.name.startswith('SPLASH | ') and o.name not in ('SPLASH | camera', 'SPLASH | contact shadow'):
        o.hide_render = True
s.render.film_transparent = True
W, H = s.render.resolution_x, s.render.resolution_y
x0, x1, y0, y1 = 60, 1020, 960, 2010
s.render.use_border, s.render.use_crop_to_border = True, True
s.render.border_min_x, s.render.border_max_x = x0 / W, x1 / W
s.render.border_min_y, s.render.border_max_y = 1 - y1 / H, 1 - y0 / H
s.render.image_settings.file_format = 'PNG'
s.render.image_settings.color_mode = 'RGBA'
s.render.filepath = os.path.join(here, 'splash', 'splash-courier-transparent.png')
bpy.ops.render.render(write_still=True)
print('SPLASH_COURIER', s.render.filepath, flush=True)
