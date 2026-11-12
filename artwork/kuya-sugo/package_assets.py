"""Package mascot motion and native resources; app logos come from SVG only.

Run node artwork/kuya-sugo/export_flat_logo.mjs first. No portrait render may
be composited into a launcher icon. White and pink are the logo's only colors.
"""
import json
import zipfile
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets" / "mascot"
WORK = ROOT / "scratch" / "kuya-sugo-blender"
icon = Image.open(ASSETS / "app-icon.png").convert("RGB")

foreground = Image.open(ASSETS / "android-icon-foreground.png").convert("RGBA")
mono = Image.open(ASSETS / "android-icon-monochrome.png").convert("RGBA")
white_mask = Image.new("RGBA", mono.size, (255, 255, 255, 0))
white_mask.putalpha(mono.getchannel("A"))
mono = white_mask
mono.save(ASSETS / "android-icon-monochrome.png", optimize=True)
mono.resize((96, 96), Image.Resampling.LANCZOS).save(ASSETS / "notification-icon.png", optimize=True)

manifest = json.loads((ASSETS / "mascot-manifest.json").read_text(encoding="utf-8"))
animation = manifest['animation']
frames = [Image.open(file).convert("RGBA") for file in sorted((WORK / animation['frameFolder']).glob("frame-*.png"))]
assert len(frames) == animation['frames'], f"Expected {animation['frames']} frames, found {len(frames)}"
durations = [round((i + 1) * animation['durationMs'] / len(frames)) - round(i * animation['durationMs'] / len(frames)) for i in range(len(frames))]
# A single greeting is enough for onboarding, then Kuya rests in the final pose.
frames[0].save(ASSETS / "kuya-sugo-greeting.webp", format="WEBP", save_all=True, append_images=frames[1:], duration=durations, loop=1, quality=84, method=3, allow_mixed=False)
archive = ROOT/'artwork/kuya-sugo/kuya-sugo-frames.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_STORED) as bundle:
    bundle.writestr('animation.json',json.dumps({**animation,'startIndex':0,'sourceFrameStart':1,'facing':'front','carryMode':manifest['character'].get('carryMode')},indent=2))
    for file in sorted((WORK / animation['frameFolder']).glob('frame-*.png')):
        bundle.write(file,'frames/'+file.name)

for name in ["app-icon.png", "android-icon-foreground.png", "android-icon-monochrome.png"]:
    image = Image.open(ASSETS / name)
    assert image.size == (1024, 1024)
assert icon.mode == "RGB"
bounds = foreground.getchannel("A").getbbox()
assert bounds and min(bounds[:2]) >= 150 and max(bounds[2:]) <= 874, f"Adaptive icon exceeds safe area: {bounds}"

# This checkout already has a generated Android project. Refresh its existing
# icon resources too, without running a prebuild over unrelated native edits.
native = ROOT / "android" / "app" / "src" / "main" / "res"
native_exports = []
for file in native.glob("mipmap-*/ic_launcher*.webp"):
    size = Image.open(file).size
    if file.stem == "ic_launcher_foreground":
        image = foreground.resize(size, Image.Resampling.LANCZOS)
    elif file.stem == "ic_launcher_monochrome":
        image = mono.resize(size, Image.Resampling.LANCZOS)
    elif file.stem == "ic_launcher_background":
        image = Image.new("RGB", size, "#F62459")
    else:
        image = icon.resize(size, Image.Resampling.LANCZOS).convert("RGBA")
        if file.stem == "ic_launcher_round":
            mask = Image.new("L", size, 0)
            ImageDraw.Draw(mask).ellipse((0, 0, size[0] - 1, size[1] - 1), fill=255)
            image.putalpha(mask)
    image.save(file, "WEBP", lossless=True, method=6)
    native_exports.append(str(file.relative_to(ROOT)))
manifest = json.loads((ASSETS / "mascot-manifest.json").read_text(encoding="utf-8"))
manifest["exports"] = {file.name: {"bytes": file.stat().st_size, "size": list(Image.open(file).size)} for file in ASSETS.iterdir() if file.suffix in (".png", ".webp")}
manifest["nativeAndroidExports"] = native_exports
spec = json.loads((ROOT/'artwork/kuya-sugo/mascot_spec.json').read_text(encoding='utf-8'))
manifest['designVersion'] = spec['version']
manifest['styleReference'] = spec.get('styleReference')
(ASSETS / "mascot-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(json.dumps(manifest["exports"], indent=2))
