"""Stable entry point for Kuya Sugo's faceless athletic Blender master.

The superseded Gemini scene is backed up under scratch/kuya-sugo-blender/backups/.
Launcher artwork is exclusively 2D: run export_flat_logo.mjs separately.
"""
from pathlib import Path
import runpy
import sys

requested=list(sys.argv)
sys.argv=[arg for arg in sys.argv if arg not in ('--preview','--export')]
sys.argv.append('--no-preview')
if '--preview' in requested:
    sys.argv.append('--chibi-preview')
runpy.run_path(str(Path(__file__).with_name('build_reference_mascot.py')), run_name='__main__')
runpy.run_path(str(Path(__file__).with_name('refine_clean_mascot.py')), run_name='__main__')
runpy.run_path(str(Path(__file__).with_name('refine_chibi_mascot.py')), run_name='__main__')
runpy.run_path(str(Path(__file__).with_name('bake_wave_action.py')), run_name='__main__')
sys.argv=requested
if '--export' in requested:
    runpy.run_path(str(Path(__file__).with_name('render_mascot.py')), run_name='__main__')
