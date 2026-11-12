"""Compatibility entry point: every icon now comes from flat vector artwork."""
import subprocess
from pathlib import Path

source = Path(__file__).resolve().parent
subprocess.run(['node', str(source/'export_flat_logo.mjs')], cwd=source.parents[1], check=True)
