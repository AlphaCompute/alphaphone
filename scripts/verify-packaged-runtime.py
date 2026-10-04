"""Verify packaged runtime bytes; this does not execute or qualify a runtime."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def digest(stream):
    value = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b''):
        value.update(block)
    return value.hexdigest()


def file_hash(path):
    with path.open('rb') as stream:
        return digest(stream)


def verify(apk):
    staged = ROOT / 'android/app/src/main/assets/agent'
    stamp_file = staged / 'alpha-source.json'
    with zipfile.ZipFile(apk) as archive:
        names = archive.namelist()
        runtime_names = [name for name in names if name.startswith('assets/agent/') or name.endswith('/libeliza_bun.so')]
        if not stamp_file.exists():
            if runtime_names:
                raise ValueError('Packaged runtime has no authenticated staged source')
            return {'apk': str(apk), 'runtime': 'NOT_PACKAGED', 'runtimeExecution': False}
        if len(names) != len(set(names)):
            raise ValueError('Duplicate APK entries')
        stamp = json.loads(stamp_file.read_text())
        pin = json.loads((ROOT / 'upstream.lock.json').read_text())['commit']
        if stamp.get('base') != pin or stamp.get('patches') != []:
            raise ValueError('Staged runtime does not match patchless pin')
        for field, source in [('manifestSha256', 'runtime-source.json'), ('consumerManifestSha256', 'runtime-consumer.json')]:
            if stamp.get(field) != file_hash(ROOT / 'upstream' / source):
                raise ValueError('Staged source manifest mismatch')
        checks = {}

        def check(entry, local, expected=None):
            with archive.open(entry) as stream:
                observed = digest(stream)
            if observed != file_hash(local) or (expected is not None and observed != expected):
                raise ValueError(f'Packaged runtime mismatch: {entry}')
            checks[entry] = observed

        for name in ['alpha-source.json', 'agent-bundle.js', 'workflow-worker/files.sha256', 'workflow-worker/manifest.json']:
            check('assets/agent/' + name, staged / name)
        inventory = set()
        for line in (staged / 'workflow-worker/files.sha256').read_text().splitlines():
            expected, name = line.split('\t', 1)
            relative = PurePosixPath(name)
            if len(expected) != 64 or any(c not in '0123456789abcdef' for c in expected) or relative.is_absolute() or '..' in relative.parts or name in inventory:
                raise ValueError('Invalid worker inventory')
            inventory.add(name)
            check('assets/agent/workflow-worker/' + name, staged / 'workflow-worker' / name, expected)
        packaged_worker = {name.removeprefix('assets/agent/workflow-worker/') for name in names if name.startswith('assets/agent/workflow-worker/') and not name.endswith('/')}
        if packaged_worker != inventory | {'files.sha256', 'manifest.json'}:
            raise ValueError('Unexpected packaged worker inventory')
        for abi in ['arm64-v8a', 'x86_64']:
            name = f'lib/{abi}/libeliza_bun.so'
            check(name, ROOT / 'android/app/src/main/jniLibs' / abi / 'libeliza_bun.so')
        return {'apk': str(apk), 'upstreamCommit': pin, 'verifiedEntries': len(checks), 'runtimeExecution': False}


if __name__ == '__main__':
    print(json.dumps([verify(Path(apk)) for apk in sys.argv[1:]], indent=2))
