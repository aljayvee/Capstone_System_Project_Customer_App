"""Enable Blender's official bundled authoring tools, without third-party downloads."""
import json
import bpy

for module in ('rigify', 'node_wrangler'):
    bpy.ops.preferences.addon_enable(module=module)
bpy.ops.wm.save_userpref()
print('SUGO_TOOLS', json.dumps({name: name in bpy.context.preferences.addons for name in ('rigify', 'node_wrangler')}))

if '--inspect-rig' in __import__('sys').argv:
    import runpy
    import rigify
    from pathlib import Path
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    arm = bpy.data.armatures.new('Sugo human metarig')
    meta = bpy.data.objects.new('Sugo human metarig', arm)
    bpy.context.collection.objects.link(meta)
    bpy.context.view_layer.objects.active = meta
    meta.select_set(True)
    runpy.run_path(str(Path(rigify.__file__).parent / 'metarigs/basic/basic_human.py'))['create'](meta)
    bpy.ops.object.mode_set(mode='OBJECT')
    print('SUGO_META', json.dumps({b.name: [list(b.head_local), list(b.tail_local)] for b in arm.bones}))
    bpy.ops.pose.rigify_generate()
    rig = bpy.context.object
    print('SUGO_CONTROLS', json.dumps([b.name for b in rig.pose.bones if not b.name.startswith(('ORG-', 'MCH-', 'DEF-'))]))
