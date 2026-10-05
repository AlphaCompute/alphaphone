#!/usr/bin/env python3
"""Install generated speech inputs through the pinned Eliza tooling.

Before anything is installed, the generated native libraries are compared with the
qualified record in android/local-speech/runtime-manifest.json. A differing runtime
is refused unless --allow-unqualified-runtime is passed (see speech_toolchain.py).
"""
from pathlib import Path
import subprocess
import sys
import speech_toolchain

root = Path(__file__).resolve().parents[2]
workspace = root / '.eliza/local-speech'
arguments = [arg for arg in sys.argv[1:] if arg != speech_toolchain.ALLOW_UNQUALIFIED]
message = speech_toolchain.check_against_record(workspace, root, speech_toolchain.ALLOW_UNQUALIFIED in sys.argv[1:])
subprocess.run([sys.executable, str(root / 'vendor/eliza/packages/app/scripts/local-speech/run.py'),
                '--workspace', str(workspace), Path(__file__).stem, *arguments], check=True)
print(message, file=sys.stderr)
