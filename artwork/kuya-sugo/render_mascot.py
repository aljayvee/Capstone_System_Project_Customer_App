"""Render brand exports from kuya-sugo.blend. No external assets or downloads."""
import json
import struct
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets" / "mascot"
WORK = ROOT / "scratch" / "kuya-sugo-blender"
ASSETS.mkdir(parents=True, exist_ok=True)
WORK.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
spec = json.loads((ROOT / 'artwork/kuya-sugo/mascot_spec.json').read_text(encoding='utf-8'))
sys.path.insert(0,str(ROOT/'artwork/kuya-sugo'))
from build_faceless_mascot import configure_render
if spec.get('renderEngine','CYCLES')=='CYCLES':
    configure_render(scene)
else:
    # EEVEE does not need Cycles CUDA/OptiX device discovery.
    scene.render.use_persistent_data=True
    scene['Render device']='EEVEE'
scene.render.engine=spec.get('renderEngine','CYCLES')
if scene.render.engine=='BLENDER_EEVEE' and hasattr(scene.eevee,'taa_render_samples'):
    scene.eevee.taa_render_samples=64
rig = bpy.data.objects["KUYA_SUGO_RIG"]
rig.animation_data.action = bpy.data.actions[spec.get('action','KuyaSugo_Greeting')]
scene.render.threads_mode, scene.render.threads = "FIXED", 8
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"


def render(name, width, height, camera, frame, samples=32):
    scene.camera = bpy.data.objects[camera]
    scene.frame_set(frame)
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.cycles.samples = samples
    if scene.render.engine == 'BLENDER_EEVEE' and hasattr(scene.eevee, 'taa_render_samples'):
        scene.eevee.taa_render_samples = samples
    scene.render.filepath = str(name)
    try:
        bpy.ops.render.render(write_still=True)
    except RuntimeError:
        if scene.cycles.device != 'GPU':
            raise
        scene.cycles.device = 'CPU'
        scene['Render device'] = 'CPU fallback'
        bpy.ops.render.render(write_still=True)
    print("KUYA_RENDER", str(name), flush=True)


source_time = (ROOT/'artwork/kuya-sugo/kuya-sugo.blend').stat().st_mtime_ns
def poster(path, width, height, camera, frame, samples):
    if not path.exists() or path.stat().st_mtime_ns < source_time:
        render(path,width,height,camera,frame,samples)

poster(ASSETS / "kuya-sugo-welcome.png", 768, 896, "CAM_Onboarding", 48, 40)
rig.animation_data.action = bpy.data.actions['KuyaSugo_Idle']
poster(ASSETS / "kuya-sugo-standing.png", 768, 896, "CAM_Onboarding", 1, 48)

# The portrait is a character reference only. Launcher artwork is always 2D SVG.
poster(ASSETS / "kuya-sugo-portrait.png", 768, 768, "CAM_Portrait", 1, 48)

# The model stays editable; rendering does not overwrite the source scene.
rig.animation_data.action = bpy.data.actions[spec.get('action','KuyaSugo_Greeting')]
frames = WORK / spec['frameFolder']
frames.mkdir(exist_ok=True)
scene.camera=bpy.data.objects['CAM_Onboarding']
scene.render.resolution_x,scene.render.resolution_y=spec['size']
scene.frame_start,scene.frame_end=1,spec['frameCount']
scene.render.fps=spec['fps']
if scene.render.engine=='BLENDER_EEVEE':
    scene.eevee.taa_render_samples=16
scene.render.filepath=str(frames/'render-####')
# Recover a stopped export only from contiguous frames newer than this master.
if '--resume' in sys.argv:
    first=1
    while first<=spec['frameCount']:
        frame_path=frames/f'render-{first:04d}.png'
        if not frame_path.exists() or frame_path.stat().st_mtime_ns < source_time:
            break
        first+=1
    scene.frame_start=min(first,spec['frameCount'])
    print('RESUME_RENDER_FROM',scene.frame_start,flush=True)
# A continuous animation render retains the renderer between frames.
bpy.ops.render.render(animation=True)
scene.frame_start=1
for index in range(spec['frameCount']):
    (frames/f'render-{index+1:04d}.png').replace(frames/f'frame-{index:03d}.png')

manifest = {
    "name": "Kuya Sugo", "brand": "Sugo Express", "source": "artwork/kuya-sugo/kuya-sugo.blend",
    "blender": bpy.app.version_string,
    "actions": [{"name": action.name, "frames": list(action.frame_range)} for action in bpy.data.actions if action.name.startswith("KuyaSugo_")],
    "animation": {"frames": spec['frameCount'], "fps": spec['fps'], "durationMs": spec['durationMs'], "size": spec['size'], "frameFolder": spec['frameFolder'], "loop": "once"},
    "character": {"style": spec['style'], "facing": "front", "faceFeatures": False, "headwear": False, "carryMode": spec.get('carryMode')},
    "source": spec.get('source'),
    "palette": {"primary": spec['uniform'], "strong": "#C41B47", "white": spec['body'], "pants": spec['pants']},
    "logo": {"style": "flat 2D vector", "source": "assets/mascot/sugo-app-logo.svg", "colors": ["#FFFFFF", "#F62459"], "neverUse3DPortrait": True},
    "tools": ["Blender surface smoothing", "Original HTML kinematic hierarchy"],
    "provenance": "Imported from the user's pink_express_athletic_delivery_rider.html, using Pack + Box mode, smoothed in Blender and baked from its original walk. Separate flat cyclist app logo.",
    "renderDevice": scene.get('Render device','CPU'),
    "renderEngine": scene.render.engine,
}
(ASSETS / "mascot-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

# Interchange source for future native 3D scenes; .blend remains the master.
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
for obj in scene.objects:
    if obj.type == "MESH" and obj.vertex_groups:
        obj.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(ROOT / "artwork" / "kuya-sugo" / "kuya-sugo.glb"), export_format="GLB", use_selection=True, export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True, export_def_bones=True, export_anim_slide_to_zero=True, export_frame_range=False)
print("KUYA_ASSETS_COMPLETE", flush=True)
