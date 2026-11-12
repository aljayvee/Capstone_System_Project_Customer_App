"""Packs the chibi courier's rendered frames into the onboarding runtime assets.

Run with `py -I artwork/kuya-sugo/package_chibi_clips.py [--clip hello|story|walk|delivery]` (all by default) after
render_chibi_wave_clip.py, render_story_clip.py, render_walk_cycle_clip.py and/or render_delivery_clip.py. Each clip
becomes an animated WebP plus one still for reduced motion and decode failure:

- hello (first onboarding screen): the wave, played once and ending at rest; its still is the raised-hand frame.
- story (second onboarding screen): the whole screen-wide crossing (walk in, trip, pick up, thumbs-up facing the
  viewer, walk out) at 20 fps, looping forever; its still is the thumbs-up hold.
- walk and delivery (no longer used by the app): the in-place walk cycle the app used to slide across the screen, and
  the old in-place trip-and-recover story that held on the scaled-in glove.
"""
import json
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets/mascot"
SOURCE = "C:/Capstone_Server/character_animation/smooth_fix/Chibi_Special_Delivery.blend"
FPS = 24
CLIPS = {
    "hello": {
        # Full render size: screen 1 shows him up to 300 dp tall, about 900 px on a 3x phone.
        "frames": "chibi-hello-frames", "count": 120, "size": (576, 672), "still_frame": 40,
        "webp": "kuya-sugo-chibi-hello.webp", "still": "kuya-sugo-chibi-hello-wave.png",
        "manifest": {"screen": "OnboardingLocationScreen (first onboarding screen)", "source": SOURCE + ", authored wave",
                     "story": "hand rises in front, opens and waves beside the head about three and a half times at 1.5 Hz, comes back down in front, smile", "loop": "once, ends at rest"},
    },
    "story": {
        "frames": "story-frames", "pattern": "frame-%04d.png", "count": 367, "size": (880, 400), "still_frame": 258, "fps": 20, "loop": 0,
        "webp": "kuya-sugo-story.webp", "still": "kuya-sugo-story-thumbs-up.png",
        "manifest": {"screen": "OnboardingAuthChoiceScreen (second onboarding screen)", "source": SOURCE + " rig and carry pose; motion keyed in story_choreography.py",
                     "story": "walk in from the left edge, stub a toe and stumble as the parcel flies ahead, belly-flop, shake it off, get up, squat-lift the parcel, step-turn for a sculpted thumbs-up, walk out past the right edge",
                     "loop": "forever"},
    },
    "walk": {
        # Cropped to the courier's own width (the render is wider), so he re-enters soon after he leaves.
        "frames": "walk-frames", "count": 24, "crop": (96, 0, 456, 600), "size": (300, 500), "still_frame": 0, "fps": 30, "loop": 0,
        "webp": "kuya-sugo-walk.webp", "still": "kuya-sugo-walk-still.png",
        "manifest": {"screen": "OnboardingAuthChoiceScreen (second onboarding screen)", "source": SOURCE + ", frames 24-47 on the spot",
                     "story": "walk carrying the parcel; KuyaSugoMascot moves it across the screen at 0.2993 frame heights per second",
                     "loop": "forever"},
    },
    "delivery": {
        "frames": "delivery-frames", "count": 306, "size": (480, 432), "still_frame": 305,
        "webp": "kuya-sugo-delivery.webp", "still": "kuya-sugo-delivery-thumbs-up.png",
        "manifest": {"screen": "OnboardingAuthChoiceScreen (second onboarding screen)", "source": SOURCE + ", frames 0-305",
                     "story": "walk with parcel, trip, recover, pick up, smile and thumbs-up", "loop": "once, holds on thumbs-up"},
    },
}
args = sys.argv[1:]
names = [args[args.index("--clip") + 1]] if "--clip" in args else list(CLIPS)

manifest_path = ASSETS / "mascot-manifest.json"
raw = manifest_path.read_bytes().decode("utf-8")
manifest = json.loads(raw)
for name in names:
    clip = dict(CLIPS[name])
    meta = ROOT / "scratch/kuya-sugo-blender" / clip["frames"] / "story.json"
    if name == "story" and meta.exists():
        timeline = json.loads(meta.read_text())
        clip.update(count=timeline["count"], still_frame=timeline["still"])
    paths = sorted((ROOT / "scratch/kuya-sugo-blender" / clip["frames"]).glob("frame-*.png"))
    last = clip.get("pattern", "frame-%03d.png") % (clip["count"] - 1)
    assert len(paths) == clip["count"] and paths[-1].name == last, f"{name}: expected {clip['count']} frames ending {last}, found {len(paths)}"
    frames = [Image.open(p).convert("RGBA") for p in paths]
    if "crop" in clip:
        frames = [f.crop(clip["crop"]) for f in frames]
    frames = [f.resize(clip["size"], Image.Resampling.LANCZOS) for f in frames]
    fps = clip.get("fps", FPS)
    # Integer frame times that still sum to the exact clip length.
    ends = [round((i + 1) * 1000 / fps) for i in range(len(frames))]
    durations = [b - a for a, b in zip([0] + ends[:-1], ends)]
    webp = ASSETS / clip["webp"]
    # WebP loop count 0 repeats forever; 1 plays once.
    frames[0].save(webp, format="WEBP", save_all=True, append_images=frames[1:], duration=durations, loop=clip.get("loop", 1), quality=82, method=4, allow_mixed=False)
    still = ASSETS / clip["still"]
    frames[clip["still_frame"]].save(still, optimize=True)
    manifest[name] = {**clip["manifest"], "frames": len(frames), "fps": fps, "durationMs": sum(durations), "size": list(clip["size"]), "stillFrame": clip["still_frame"]}
    for f in (webp, still):
        manifest.setdefault("exports", {})[f.name] = {"bytes": f.stat().st_size, "size": list(Image.open(f).size)}
    check = Image.open(webp)
    print(name.upper(), "webp", check.n_frames, "frames", sum(durations), "ms", webp.stat().st_size, "bytes", "loop", check.info.get("loop"), "| still", still.stat().st_size, "bytes")

# Keep the file's own line endings and final-newline choice so the diff is only the new entries.
text = json.dumps(manifest, indent=2)
if "\r\n" in raw:
    text = text.replace("\n", "\r\n")
if raw.endswith(("\n", "\r\n")):
    text += "\r\n" if "\r\n" in raw else "\n"
manifest_path.write_bytes(text.encode("utf-8"))
