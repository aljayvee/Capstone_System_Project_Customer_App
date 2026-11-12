"""Encode the actual Blender PNG frames as a white-background H.264 preview."""
import json
import os
from pathlib import Path
import subprocess

source=Path(__file__).resolve().parent
root=source.parents[1]
spec=json.loads((source/'mascot_spec.json').read_text(encoding='utf-8'))
folder=root/'scratch/kuya-sugo-blender'/spec['frameFolder']
assert len(list(folder.glob('frame-*.png')))==spec['frameCount']
encoder=Path(os.environ.get('FFMPEG',str(root/'scratch/kuya-sugo-blender/encoder/package/ffmpeg.exe')))
assert encoder.is_file(),'Set FFMPEG to a local FFmpeg executable'
target=source/'kuya-sugo-10-seconds.mp4'
subprocess.run([str(encoder),'-y','-framerate',str(spec['fps']),'-i',str(folder/'frame-%03d.png'),
    '-f','lavfi','-i',f"color=c=white:s={spec['size'][0]}x{spec['size'][1]}:r={spec['fps']}",
    '-filter_complex','[1:v][0:v]overlay=shortest=1:format=auto,format=yuv420p',
    '-t','10','-c:v','libx264','-preset','fast','-crf','18','-movflags','+faststart','-an',str(target)],check=True)
print('SUGO_VIDEO_COMPLETE',str(target),flush=True)
