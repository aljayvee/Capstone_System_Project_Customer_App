"""Bake KuyaSugo_Wave (waving 'Like saying Hi') action onto KUYA_SUGO_RIG."""
import bpy
import math
import shutil
from pathlib import Path
from mathutils import Quaternion, Vector

SOURCE = Path(__file__).resolve().parent

def ease(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3.0 - 2.0 * t)

def rotate_bone(b, degrees, axis):
    basis = b.bone.matrix_local.to_quaternion()
    rot = basis.inverted() @ Quaternion(axis, math.radians(degrees)) @ basis
    b.rotation_quaternion = rot @ b.rotation_quaternion

def bake_action_for_file(blend_path):
    bpy.ops.wm.open_mainfile(filepath=str(blend_path))
    rig = bpy.data.objects['KUYA_SUGO_RIG']
    scene = bpy.context.scene

    idle = bpy.data.actions['KuyaSugo_Idle']
    rig.animation_data.action = idle
    scene.frame_set(1)

    base_transforms = {
        b.name: {
            'loc': b.location.copy(),
            'rot': b.rotation_quaternion.copy(),
            'scale': b.scale.copy(),
        } for b in rig.pose.bones
    }

    # Remove existing wave / greeting actions if re-running
    for name in ['KuyaSugo_Wave', 'KuyaSugo_Greeting']:
        if name in bpy.data.actions:
            bpy.data.actions.remove(bpy.data.actions[name])

    action = bpy.data.actions.new('KuyaSugo_Wave')
    action.use_fake_user = True
    rig.animation_data.action = action

    total_frames = 240
    for frame in range(1, total_frames + 2):
        t = (frame - 1) / 24.0 # time in seconds

        for b in rig.pose.bones:
            b.location = base_transforms[b.name]['loc'].copy()
            b.rotation_quaternion = base_transforms[b.name]['rot'].copy()
            b.scale = base_transforms[b.name]['scale'].copy()
            b.rotation_mode = 'QUATERNION'

        rise = ease((t - 0.2) / 0.8)
        fall = ease((t - 7.0) / 1.0)
        wave_amount = rise * (1.0 - fall)

        if wave_amount > 0.0001:
            # High arm raise beside the head
            rotate_bone(rig.pose.bones['leftShoulder'], 112 * wave_amount, (0, 1, 0))
            rotate_bone(rig.pose.bones['leftShoulder'], -16 * wave_amount, (1, 0, 0))

            if 0.9 <= t <= 7.2:
                # Friendly waving cycles (side-to-side oscillation at 1.5 Hz)
                phase = (t - 0.9) * math.tau * 1.5
                osc = math.sin(phase) * wave_amount
                rotate_bone(rig.pose.bones['leftElbow'], (64 * wave_amount) + (14 * osc), (0, 1, 0))
                rotate_bone(rig.pose.bones['leftElbow'], -10 * wave_amount, (1, 0, 0))
                rotate_bone(rig.pose.bones['leftElbow'], (12 * wave_amount) + (6 * osc), (0, 0, 1))

                rotate_bone(rig.pose.bones['leftHand'], (5 * wave_amount) + (18 * osc), (0, 1, 0))
                rotate_bone(rig.pose.bones['leftHand'], (-28 * wave_amount) + (8 * osc), (0, 0, 1))

                rotate_bone(rig.pose.bones['headGroup'], (-5 * wave_amount) + (2.5 * osc), (0, 1, 0))
            else:
                rotate_bone(rig.pose.bones['leftElbow'], 64 * wave_amount, (0, 1, 0))
                rotate_bone(rig.pose.bones['leftElbow'], -10 * wave_amount, (1, 0, 0))
                rotate_bone(rig.pose.bones['leftElbow'], 12 * wave_amount, (0, 0, 1))
                rotate_bone(rig.pose.bones['leftHand'], 5 * wave_amount, (0, 1, 0))
                rotate_bone(rig.pose.bones['leftHand'], -28 * wave_amount, (0, 0, 1))
                rotate_bone(rig.pose.bones['headGroup'], -5 * wave_amount, (0, 1, 0))

        breath = math.sin(t * math.tau * 0.4)
        rig.pose.bones['chestGroup'].scale = (1.0 + 0.003 * breath, 1.0 + 0.002 * breath, 1.0 + 0.004 * breath)

        for b in rig.pose.bones:
            b.keyframe_insert('location', frame=frame, group=b.name)
            b.keyframe_insert('rotation_quaternion', frame=frame, group=b.name)
            b.keyframe_insert('scale', frame=frame, group=b.name)

    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:
                        key.interpolation = 'LINEAR'

    greeting = action.copy()
    greeting.name = 'KuyaSugo_Greeting'
    greeting.use_fake_user = True

    rig.animation_data.action = bpy.data.actions['KuyaSugo_Wave']
    scene.frame_set(48)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), compress=True)
    print(f'Baked KuyaSugo_Wave and KuyaSugo_Greeting to {blend_path.name}', flush=True)

def main():
    bake_action_for_file(SOURCE / 'kuya-sugo.blend')
    shutil.copy2(SOURCE / 'kuya-sugo.blend', SOURCE / 'kuya-sugo-chibi.blend')
    shutil.copy2(SOURCE / 'kuya-sugo.blend', SOURCE / 'pink-express-pack-box-smooth.blend')
    print('BAKE_WAVE_COMPLETE', flush=True)

if __name__ == '__main__':
    main()
