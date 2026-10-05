#!/usr/bin/env python3
"""Delegate JNI stripping to the pinned Eliza source, with the qualified NDK only."""
from pathlib import Path
import subprocess
import sys
import speech_toolchain

root = Path(__file__).resolve().parents[2]
speech_toolchain.require_toolchain(speech_toolchain.option(sys.argv[1:], '--ndk'), cmake=False)
subprocess.run([sys.executable, str(root / 'vendor/eliza/packages/app/scripts/local-speech/run.py'),
                '--workspace', str(root / '.eliza/local-speech'), Path(__file__).stem, *sys.argv[1:]], check=True)
