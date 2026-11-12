"""Validate actual encoded artwork and protect the always-flat logo rule."""
import json
import re
import struct
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
assets = root/'assets/mascot'
svg = (assets/'sugo-app-logo.svg').read_text(encoding='utf-8')
assert not re.search(r'<(?:image|filter|linearGradient|radialGradient|foreignObject)\b',svg)
assert set(re.findall(r'#[0-9A-Fa-f]{6}',svg)) == {'#FFFFFF','#F62459'}
icon = Image.open(assets/'app-icon.png')
assert icon.mode == 'RGB' and icon.size == (1024,1024)
assert icon.getpixel((0,0)) == (246,36,89)
assert icon.getpixel((1023,1023)) == (246,36,89)
assert icon.getpixel((793,265)) == (255,255,255)  # scooter rider's helmet
assert all(r>=246 and g>=36 and b>=89 for r,g,b in icon.getdata())
foreground = Image.open(assets/'android-icon-foreground.png').convert('RGBA')
bounds = foreground.getchannel('A').getbbox()
assert bounds and min(bounds[:2])>=150 and max(bounds[2:])<=874, bounds
for name in ('android-icon-foreground.png','android-icon-monochrome.png','notification-icon.png'):
    mask = Image.open(assets/name).convert('RGBA')
    assert mask.getchannel('A').getextrema() == (0,255)
    assert all(pixel[:3] == (255,255,255) for pixel in mask.getdata() if pixel[3])
clip = Image.open(assets/'kuya-sugo-greeting.webp')
assert clip.n_frames == 240 and clip.info.get('loop') == 1
duration = 0
for i in range(clip.n_frames):
    clip.seek(i)
    clip.load()
    duration += clip.info['duration']
assert duration == 10000
model = (root/'artwork/kuya-sugo/kuya-sugo.glb').read_bytes()
magic,version,length = struct.unpack_from('<III',model)
assert magic == 0x46546C67 and version == 2 and length == len(model)
chunk_length,chunk_type = struct.unpack_from('<II',model,12)
assert chunk_type == 0x4E4F534A
doc = json.loads(model[20:20+chunk_length])
actions = [action['name'] for action in doc.get('animations',[])]
assert {'KuyaSugo_Wave', 'KuyaSugo_Idle'} <= set(actions)
assert len(doc['skins']) == 1
names = {node.get('name','') for node in doc['nodes']}
assert 'headGroup / whiteSharpSkin' in names
assert {'backpackGroup','deliveryBoxGroup'} <= names
assert not any(name.startswith(('Eye ','Iris ','Pupil ','Cap ','hatGroup','brimGroup','DEF-eye_blink')) for name in names)
assert any(a['name'] in ('KuyaSugo_Wave', 'KuyaSugo_PackBox') for a in doc['animations'])
manifest = json.loads((assets/'mascot-manifest.json').read_text(encoding='utf-8'))
assert manifest['logo']['neverUse3DPortrait'] is True
assert manifest['designVersion']==7
assert manifest['styleReference']=='reference/chibi-style-reference.png'
assert (root/'artwork/kuya-sugo'/manifest['styleReference']).is_file()
assert manifest['character'] == {'style':'faceless chibi courier','facing':'front','faceFeatures':False,'headwear':False,'carryMode':'Pack + Box'}
assert manifest['palette']['white'] == '#FFFFFF' and manifest['palette']['pants'] == '#172554'
print(json.dumps({'logo':'flat white/pink SVG', 'iconSize':icon.size,
    'adaptiveBounds':bounds, 'frames':clip.n_frames, 'durationMs':duration,
    'actions':actions, 'skins':len(doc['skins']), 'faceless':True, 'facing':'front', 'carryMode':'Pack + Box',
    'glbBytes':len(model), 'greetingBytes':(assets/'kuya-sugo-greeting.webp').stat().st_size},indent=2))
