# Sugo Express: the selected Pack + Box rider

## Current visual direction: faceless chibi

The user's supplied `reference/chibi-style-reference.png` is now the primary proportion reference. It supersedes the earlier tall athletic silhouette: the head is a large smooth sphere, approximately 40% of full height, above a short soft body and compact limbs. Keep the blank white face, pink uniform, navy trousers, no headwear and front view. The flat white/pink app logo remains separate.

`build_mascot.py` runs reference import, clean surface refinement, then `refine_chibi_mascot.py` before exports. The existing carrying hierarchy and Pack + Box walk remain. The chibi step reshapes the head and proportions in shared rig coordinates so the parcel, pack and shoes move with the character. Open `kuya-sugo-chibi.blend` for the current editable model. Render frames are stored under ignored `chibi-pack-box-frames/`. Prior files are preserved under `scratch/kuya-sugo-blender/backups/pre-chibi-20261029/`.

The current master uses the user's model from:

`C:\Users\Capstone\Downloads\pink_express_athletic_delivery_rider.html`

The original download is unchanged. A source copy is preserved at `reference/pink_express_athletic_delivery_rider.html`; its source hash, geometry, hierarchy and sampled motion are stored in `reference/model-pack-box.json`. **Pack + Box** is selected, with the original thermal backpack and handheld parcel. Earlier faceless/front-view/no-cap requirements remain applied. The character has a pure-white body, pink uniform, dark-blue pants and the reference's dark athletic shoes.

## Right armpit fix (2026-11-01)

The Special Delivery rig weights the shirt side down to the hem to `upper_arm.R`, so a forward or raised right arm (the thumbs-up) dragged that side out into a lump under the armpit. `armpit_fix.py` (`fix_right_armpit`) hands that weight to the chest by surface distance, keeps the shoulder top as it was, and relaxes only the armhole band. Like `brand_colors.py`, it runs in memory after a render script opens the source; the source blend is never saved. `render_story_clip.py` calls it. `kuya-sugo-splash.blend` has the same weights baked in. The pre-fix story frames and assets are in `scratch/kuya-sugo-blender/backups/story-pre-armpit-2026-11-01/`.

## Onboarding story motion (2026-11-01)

The second onboarding clip is no longer sampled from the Special Delivery story, which moved him as a rigid block (no hip or head bob, feet lifting 3 mm), tipped the whole rig over like a plank for the trip, and pivoted him 45 degrees from the ankles with floating feet for the pickup. `story_choreography.py` now keys the performance and `story_motion.py` solves every frame on the same rig: two-bone IK onto footsteps that stay planted (heel strike, toe-off, swing arc), hips that bob with leg reach and sway toward the weighted foot, chest and head counter-rotation, arm swing that trails the legs, and springs that let the head and the carried parcel lag the body. The story: a quick chibi walk in (with a glance at the viewer), a stubbed toe and two scrambling steps while the parcel flies out of his hands, a belly-flop with a little leg kick, a dazed head shake, push-up to the knees, half-kneel, stand, brush off the shirt, walk to the parcel, squat and lift (turning it upright), a nod, a step-turn to the viewer for the thumbs-up, and a walk out. Only the source's carry pose of the arms is reused. `render_story_clip.py -- --preview --frames 80-110:2` renders quick half-size checks into `scratch/kuya-sugo-blender/story-preview`. The previous clip and frames are in `scratch/kuya-sugo-blender/backups/story-pre-motion-2026-11-01/`.

## Blender master and smoothing

The 2026-10-29 cleanup keeps the selected rider's source hierarchy, backpack, parcel and ten-second walk, and reshapes the unfinished body into continuous clothing. `refine_clean_mascot.py` adds a rounded blank head, fitted shirt with a fine zipper and white badge, compact sleeves, rounded hands, smooth joint weights through elbows/knees and simple navy/white sneakers. It runs after reference import through `build_mascot.py`. The previous master and runtime images are preserved in `scratch/kuya-sugo-blender/backups/pre-clean-20261029/`.

Open `kuya-sugo.blend` (or its descriptive copy `pink-express-pack-box-smooth.blend`) in Blender 5.2+. The model contains actual imported/reference geometry, named materials, a deformation armature matching the original HTML kinematic hierarchy, two front-facing cameras and baked actions.

The reference import preserves provenance and carrying mechanics. The cleanup replaces the blocky chest plates and separate knee/elbow shells with smooth garment and limb surfaces, using blended deformation weights at the joints. The blank head has no eyes, nose, mouth or headwear. Backpack straps follow the tailored shirt.

`KUYA_SUGO_RIG` preserves named source groups such as `pelvisGroup`, `chestGroup`, `headGroup`, `backpackGroup`, `deliveryBoxGroup`, shoulders, elbows, hips, knees and ankles. Select its actions in the Action Editor:

- `KuyaSugo_Wave`: Kuya Sugo raising his hand to wave energetically ("Like saying Hi") with friendly head tilt and settling seamlessly at frame 240 matching frame 1 (10 seconds, 24 fps).
- `KuyaSugo_Greeting`: alias of `KuyaSugo_Wave`.
- `KuyaSugo_PackBox`: the reference's original walking/carrying transform math sampled for ten seconds at 24 fps. There is no turntable or side-facing camera.
- `KuyaSugo_Idle`: a stationary Pack + Box carry pose.

The active mascot animation is `KuyaSugo_Wave`. Frames 1–240 are rendered as 240 PNG files, then encoded into a once-only ten-second transparent WebP `kuya-sugo-greeting.webp` with interactive tap-to-replay in the Customer App. No live 3D engine is bundled in the Customer App.

## Rebuild

Run from CustomerApp in PowerShell:

```powershell
node artwork/kuya-sugo/extract_reference.mjs
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python artwork/kuya-sugo/build_mascot.py -- --preview --export
python artwork/kuya-sugo/package_assets.py
python artwork/kuya-sugo/export_video_preview.py
```

`extract_reference.mjs` evaluates only the inspected model-building and motion math in a restricted Node VM; the original HTML's renderer, CDN loading, DOM handlers and camera UI are not executed. Three.js r128 is vendored with its license header. `build_mascot.py` delegates to `build_reference_mascot.py`; older builders remain historical source. Regeneration **overwrites manual Blender edits**.

When preserving manual edits, skip regeneration and render the saved master:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background artwork/kuya-sugo/kuya-sugo.blend --python-exit-code 1 --python artwork/kuya-sugo/render_mascot.py
```

`mascot_spec.json` specifies the source, Pack + Box action, front view, colors, 240 frames, 24 fps and 10000 ms. Blender EEVEE renders the animation with smooth surfaces and 16 temporal samples; posters use 64 samples. Cycles is also configured in the editable scene for studio renders. A continuous animation pass writes `render-0001.png` through `render-0240.png`, then normalizes them to `frame-000.png` through `frame-239.png` in ignored `scratch/kuya-sugo-blender/chibi-pack-box-frames/`.

The Pillow packager creates `assets/mascot/kuya-sugo-greeting.webp` and `kuya-sugo-frames.zip` (all 240 PNGs plus timing/carry-mode metadata). Encoded WebP frame durations sum to exactly 10000 ms. `export_video_preview.py` makes a white-background H.264 MP4 from those same PNGs, using `FFMPEG` from the environment or the portable encoder in ignored scratch. The portable npm encoder archive is checked against the registry's SHA-512 integrity value; it is not a runtime app dependency.

`verify_scene.py` checks source provenance, smooth normals, faceless/no-cap state, backpack/parcel presence, material colors, front camera, animation length and framing. `verify_assets.py` checks the actual WebP duration/count, GLB action timing, source-model nodes, Pack + Box metadata and the flat app logo.

## App logo: always flat white and pink

The app logo is separate from the 3D rider. **Never use a 3D portrait as the launcher icon.** `assets/mascot/sugo-app-logo.svg` is the flat white Sugo Tacurong scooter (rider leaning forward, top box with a bag, speed lines) on exact Sugo pink `#F62459`. It replaced the white cyclist on 2026-11-01: the user's line-art "Sugo Tacurong / Services on the go" logo was redrawn as a filled mark in `logo_concepts.mjs` (`sugo-scooter`), because its thin lines, text and coral reds do not survive icon sizes. The other concepts and their comparison sheets are in `logo-concepts/`; the cyclist assets, native mipmaps and the earlier splash are in `scratch/kuya-sugo-blender/backups/logo-bicycle-2026-11-01/`. Transparent, inverse and Android safe-area SVGs are included. `export_flat_logo.mjs` exports icons, notification mask and favicon from vector artwork only, and also rewrites the launcher mipmaps in `android/app/src/main/res`, because EAS builds that folder as-is. `splash_swap_logo.py` lays the same white mark over the splash's pink badge and re-renders `splash/sugo-splash-1080x2340.png`. The exporter also writes `assets/mascot/sugo-mark-white{,@2x,@3x}.png` (the login brand row), then hands `sugo-mark-white.svg` to the rider app (`../RiderMobileApp`) and the web portal (`C:\Capstone_Project_Web`) and runs their `scripts/export-brand-icons.mjs`, so one run changes the logo in all three: launcher icons, favicons, splash, login screens and headers. The rider app sets it on its own red `#DC2626`; the portal's favicons use this pink. `--only-customer` skips the hand-off. Native icons still need a new build of each app. No gradient, lighting, bevel or shadow enters this logo pipeline. The current model revision leaves this identity unchanged.

Both Customer onboarding screens keep using `KuyaSugoMascot.tsx` with the refreshed local assets. Reduced motion, inactive app/screen or decoder failure uses a still image. Existing permissions, authentication, navigation and legal actions are preserved. The native splash is unchanged.

Blender source, reference data, vendor tools and intermediates are excluded from EAS uploads. Earlier models and raw frames are preserved in ignored scratch backups. No app build, installation, OTA or publication is performed by this artwork pipeline; device playback and launcher masks still need native QA before release.

A stopped render can continue with `render_mascot.py -- --resume`. It reuses only contiguous raw frames newer than the saved master; posters are also cached by master modification time. EEVEE skips unused Cycles device discovery.
