"""Exercise the APK provenance boundary with real ZIP payloads."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import warnings
import zipfile

spec = importlib.util.spec_from_file_location('packaged_runtime', Path(__file__).resolve().parents[1] / 'scripts/verify-packaged-runtime.py')
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)
sha = lambda data: hashlib.sha256(data).hexdigest()


class PackagedRuntimeTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.previous = verifier.ROOT
        verifier.ROOT = self.root
        self.addCleanup(setattr, verifier, 'ROOT', self.previous)
        self.pin = 'a' * 40
        sources = {'upstream.lock.json': json.dumps({'commit': self.pin}).encode(),
                   'scripts/prepare-local-agent.mjs': b'prepare',
                   'scripts/local-agent-source.mjs': b'guard'}
        for name, data in sources.items():
            self.write(name, data)
        stamp = {'base': self.pin, 'patches': []}
        for key, name in zip(['lockSha256', 'preparerSha256', 'guardSha256'], sources):
            stamp[key] = sha(sources[name])
        stamp_bytes = json.dumps(stamp).encode()
        worker = b'worker payload'
        manifest = json.dumps({'version': 1, 'sourceStampSha256': sha(stamp_bytes), 'files': {'worker.js': sha(worker)}}).encode()
        index = f'{sha(worker)}\tworker.js\n{sha(manifest)}\tmanifest.json\n'.encode()
        self.entries = {'assets/agent/alpha-source.json': stamp_bytes,
                        'assets/agent/agent-bundle.js': b'agent payload',
                        'assets/agent/workflow-worker/worker.js': worker,
                        'assets/agent/workflow-worker/manifest.json': manifest,
                        'assets/agent/workflow-worker/files.sha256': index,
                        'lib/arm64-v8a/libeliza_bun.so': b'arm64 runtime',
                        'lib/x86_64/libeliza_bun.so': b'x86 runtime'}
        for name, data in self.entries.items():
            local = name.replace('assets/', 'android/app/src/main/assets/', 1) if name.startswith('assets/') else name.replace('lib/', 'android/app/src/main/jniLibs/', 1)
            self.write(local, data)
        self.apk = self.root / 'candidate.apk'

    def write(self, name, data):
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

    def package(self, entries=None):
        with zipfile.ZipFile(self.apk, 'w') as archive:
            for name, data in (self.entries if entries is None else entries).items():
                archive.writestr(name, data)
        return self.apk

    def test_valid_payload_is_byte_verified_without_execution_claim(self):
        result = verifier.verify(self.package())
        self.assertEqual(result['upstreamCommit'], self.pin)
        self.assertEqual(result['verifiedEntries'], 7)
        self.assertFalse(result['runtimeExecution'])

    def test_each_payload_byte_and_required_entry_is_checked(self):
        for name in self.entries:
            for mutation in ['alter', 'remove']:
                with self.subTest(name=name, mutation=mutation):
                    entries = dict(self.entries)
                    if mutation == 'alter':
                        entries[name] += b'altered'
                    else:
                        del entries[name]
                    with self.assertRaises((ValueError, KeyError)):
                        verifier.verify(self.package(entries))

    def test_extra_worker_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Unexpected packaged worker'):
            verifier.verify(self.package({**self.entries, 'assets/agent/workflow-worker/extra.js': b'extra'}))

    def test_changed_source_guard_rejects_otherwise_identical_apk(self):
        self.write('scripts/local-agent-source.mjs', b'new guard')
        with self.assertRaisesRegex(ValueError, 'manifest mismatch'):
            verifier.verify(self.package())

    def test_worker_from_different_source_rejected_even_when_staging_matches(self):
        name = 'assets/agent/workflow-worker/manifest.json'
        manifest = json.loads(self.entries[name])
        manifest['sourceStampSha256'] = 'b' * 64
        self.entries[name] = json.dumps(manifest).encode()
        self.write('android/app/src/main/' + name, self.entries[name])
        with self.assertRaisesRegex(ValueError, 'different prepared runtime'):
            verifier.verify(self.package())

    def test_unstaged_runtime_is_rejected_but_empty_runtime_is_reported(self):
        (self.root / 'android/app/src/main/assets/agent/alpha-source.json').unlink()
        with self.assertRaisesRegex(ValueError, 'no authenticated staged source'):
            verifier.verify(self.package())
        result = verifier.verify(self.package({'classes.dex': b'ordinary app'}))
        self.assertEqual(result['runtime'], 'NOT_PACKAGED')
        self.assertFalse(result['runtimeExecution'])

    def test_duplicate_zip_entries_rejected(self):
        self.package()
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', UserWarning)
            with zipfile.ZipFile(self.apk, 'a') as archive:
                archive.writestr('assets/agent/agent-bundle.js', b'duplicate')
        with self.assertRaisesRegex(ValueError, 'Duplicate APK entries'):
            verifier.verify(self.apk)


if __name__ == '__main__':
    unittest.main()
