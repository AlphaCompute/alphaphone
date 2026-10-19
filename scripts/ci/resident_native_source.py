"""Verify generated Java provenance; resident JS source remains patchless."""
import hashlib
import json
import subprocess
from pathlib import Path


def verify_generated_native(generated, frozen, root=Path('.')):
    root = Path(root).resolve()
    digest = lambda value: hashlib.sha256(value).hexdigest()
    for relative in ('scripts/prepare-patched-native.mjs', 'scripts/upstream-native-source.mjs',
                     'scripts/stage-local-agent-sources.mjs', 'patches/eliza/resident-native-manifest.json',
                     'patches/eliza/resident-ipc-recovery.patch'):
        assert frozen[relative] == digest((root / relative).read_bytes()), 'Native patch build input drift'
    lock = json.loads((root / 'upstream.lock.json').read_text())
    assert generated['runtimeSource'] == {'commit': lock['commit']}
    # Re-run the existing strict producer: source blobs, patch, complete output inventory,
    # cache bytes, and receipt must all match the exact reviewed manifest and preparer.
    receipt = json.loads(subprocess.check_output([
        'node', '--input-type=module', '-e',
        "import {preparePatchedNative,nativePatchReceipt} from './scripts/prepare-patched-native.mjs';"
        "console.log(JSON.stringify(nativePatchReceipt(preparePatchedNative({manifestFile:'resident-native-manifest.json'}))));"
    ], cwd=root, text=True))
    assert generated['patches'] == [receipt], 'Resident native patch receipt mismatch'
    seen = set()
    for row in generated['files']:
        origin = row['path']
        assert not origin.startswith('/') and '..' not in Path(origin).parts and origin not in seen
        seen.add(origin)
        committed = subprocess.check_output(['git', '-C', 'vendor/eliza', 'show', lock['commit'] + ':' + origin], cwd=root)
        original = digest(committed)
        assert row['sourceSha256'] == original, 'Native original source drift'
        assert row['sha256'] == receipt['files'].get(origin, original), 'Native admitted source drift'
        if origin.endswith('.java'):
            target = row['generatedPath']
            assert target.startswith('android/app/build/generated/local-agent/java/') and '..' not in Path(target).parts
            assert frozen[target] == row['generatedSha256'], 'Generated native source drift'
    assert set(receipt['files']).issubset(seen), 'Missing reviewed resident source'
    return receipt
