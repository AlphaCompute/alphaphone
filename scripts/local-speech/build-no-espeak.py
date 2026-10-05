#!/usr/bin/env python3
"""Delegate the native speech build to the pinned Eliza source with the qualified toolchain.

Refuses to start unless the NDK and CMake match the qualified record, and remaps
this workspace to the qualified build path (see speech_toolchain.py).
"""
from pathlib import Path
import subprocess
import sys
import speech_toolchain

root = Path(__file__).resolve().parents[2]
workspace = root / '.eliza/local-speech'
speech_toolchain.require_toolchain(speech_toolchain.option(sys.argv[1:], '--ndk'))
subprocess.run([sys.executable, str(root / 'vendor/eliza/packages/app/scripts/local-speech/run.py'),
                '--workspace', str(workspace), Path(__file__).stem, *sys.argv[1:]],
               env=speech_toolchain.remap_environment(workspace), check=True)
