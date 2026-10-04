#!/usr/bin/env python3
"""Delegate shared speech tooling to the pinned Eliza source."""
from pathlib import Path
import subprocess
import sys
root = Path(__file__).resolve().parents[2]
subprocess.run([sys.executable, str(root / 'vendor/eliza/packages/app/scripts/local-speech/run.py'),
                '--workspace', str(root / '.eliza/local-speech'), Path(__file__).stem, *sys.argv[1:]], check=True)
