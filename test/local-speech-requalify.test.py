"""Requalification of an independently rebuilt speech runtime: record, ingest, admit."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/local-speech'))


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


requalify = module('requalify_runtime', ROOT / 'scripts/local-speech/requalify-runtime.py')
apk_check = module('verify_apk_qualification', ROOT / 'scripts/local-speech/verify-apk-qualification.py')
sha = lambda data: hashlib.sha256(data).hexdigest()
ABIS = ('arm64-v8a', 'x86_64')
NATIVES = {abi: {'libsherpa-onnx-jni.so': f'rebuilt jni {abi}'.encode(), 'libonnxruntime.so': f'rebuilt ort {abi}'.encode()} for abi in ABIS}


def log(results, complete=True):
    lines = []
    for test, code in results.items():
        for status in (1, code):
            lines += [f'INSTRUMENTATION_STATUS: class={requalify.CANONICAL_CLASS}', f'INSTRUMENTATION_STATUS: test={test}', f'INSTRUMENTATION_STATUS_CODE: {status}']
    lines += ['INSTRUMENTATION_RESULT: stream=', 'OK (2 tests)' if complete else 'FAILURES!!!', 'INSTRUMENTATION_CODE: -1']
    return '\n'.join(lines) + '\n'


class RequalifyTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.dir = Path(temp.name).resolve()
        repo = self.repo = self.dir / 'repo'
        (repo / 'android/local-speech/baselines').mkdir(parents=True)
        test_file = repo / requalify.CANONICAL_TEST
        test_file.parent.mkdir(parents=True)
        shutil.copyfile(ROOT / requalify.CANONICAL_TEST, test_file)
        (repo / 'upstream.lock.json').write_text(json.dumps({'commit': 'a' * 40}))
        (repo / 'scripts/local-speech').mkdir(parents=True)
        (repo / 'scripts/local-speech/wrapper.py').write_text('# wrapper\n')
        previous = {'schemaVersion': 2, 'noEspeak': True, 'qualifiedAbis': [
            {'abi': abi, 'native': [{'file': name, 'bytes': 1, 'sha256': '0' * 64} for name in NATIVES[abi]]} for abi in ABIS]}
        self.previous = json.dumps(previous)
        (repo / 'android/local-speech/qualified-runtime-manifest.json').write_text(self.previous)
        generated_dir = self.dir / 'workspace/source/android/local-speech'
        (generated_dir / 'libs').mkdir(parents=True)
        with zipfile.ZipFile(generated_dir / 'libs/sherpa-onnx-1.13.8-no-espeak.aar', 'w') as aar:
            for abi in ABIS:
                for name, data in NATIVES[abi].items():
                    aar.writestr(f'jni/{abi}/{name}', data)
        generated = {'noEspeak': True, 'qualifiedAbis': [
            {'abi': abi, 'noEspeakSources': True, 'noEspeakSymbols': True, 'deviceExecuted': False,
             'native': [{'file': name, 'bytes': len(data), 'sha256': sha(data)} for name, data in NATIVES[abi].items()]} for abi in ABIS]}
        (generated_dir / 'runtime-manifest.json').write_text(json.dumps(generated))
        ndk = self.ndk = self.dir / 'ndk'
        ndk.mkdir()
        (ndk / 'source.properties').write_text(f'Pkg.Revision = {requalify.speech_toolchain.NDK_REVISION}\n')
        cmake = self.cmake = self.dir / 'cmake'
        cmake.write_text(f'#!/bin/sh\necho "cmake version {requalify.speech_toolchain.CMAKE_VERSION}"\n')
        cmake.chmod(0o755)
        self.common = ['--workspace', str(self.dir / 'workspace'), '--repository', str(repo)]

    def apk(self, abi, natives=None):
        path = self.dir / f'app-{abi}-{"other" if natives else "rebuilt"}.apk'
        with zipfile.ZipFile(path, 'w') as apk:
            for name, data in (natives or NATIVES[abi]).items():
                apk.writestr(f'lib/{abi}/{name}', data)
            apk.writestr('classes.dex', b'dex')
        return path

    def evidence(self, abi, passed=True):
        folder = self.dir / f'evidence-{abi}'
        folder.mkdir(exist_ok=True)
        for name in ('result.json', 'holder-result.json'):
            (folder / name).write_text(json.dumps({'pass': passed, 'execution': 'android-process-cpu'}))
        return folder

    def ingest(self, abi, results, apk=None, passed=True, complete=True):
        log_file = self.dir / f'{abi}.log'
        log_file.write_text(log(results, complete))
        try:
            requalify.main(['ingest', *self.common, '--abi', abi, '--apk', str(apk or self.apk(abi)), '--log', str(log_file), '--evidence', str(self.evidence(abi, passed))])
        except SystemExit as exit:
            return exit.code
        return 0

    def record(self):
        requalify.main(['record', *self.common, '--ndk', str(self.ndk), '--cmake', str(self.cmake)])
        return json.loads((self.dir / 'workspace/requalification/candidate.json').read_text())

    def test_record_hashes_source_and_toolchain_and_starts_unaccepted(self):
        candidate = self.record()
        provenance = candidate['provenance']
        self.assertEqual(provenance['upstreamCommit'], 'a' * 40)
        self.assertEqual(provenance['toolchain']['ndk'], requalify.speech_toolchain.NDK_REVISION)
        self.assertEqual(provenance['toolchain']['cmake'], requalify.speech_toolchain.CMAKE_VERSION)
        self.assertEqual(len(provenance['toolchain']['cmakeExecutableSha256']), 64)
        self.assertEqual(len(provenance['wrapperTreeSha256']), 64)
        self.assertEqual(provenance['canonicalTestSha256'], requalify.sha_file(ROOT / requalify.CANONICAL_TEST))
        self.assertTrue(provenance['differsFromPreviousRecord'])
        self.assertFalse(candidate['functionalAcceptance']['passed'])
        self.assertTrue(all(abi['deviceExecuted'] is False for abi in candidate['qualifiedAbis']))

    def test_wrong_toolchain_is_refused(self):
        (self.ndk / 'source.properties').write_text('Pkg.Revision = 27.0.0\n')
        with self.assertRaises(SystemExit):
            self.record()

    def test_admission_requires_every_abi_to_pass_the_unchanged_canonical_test(self):
        self.record()
        both = {name: 0 for name in requalify.CANONICAL_TESTS}
        with self.assertRaises(SystemExit):
            requalify.main(['admit', *self.common, '--reviewer', 'release reviewer'])
        self.assertEqual(self.ingest('arm64-v8a', both), 0)
        # One ABI is not enough.
        with self.assertRaises(SystemExit):
            requalify.main(['admit', *self.common, '--reviewer', 'release reviewer'])
        # A failed keyword, a skipped test, an incomplete run, failed evidence, or other natives fail that ABI.
        failing = dict(both, nativeModelsTranscribeAndSynthesizeWithNoNetwork=-2)
        self.assertEqual(self.ingest('x86_64', failing), 3)
        self.assertEqual(self.ingest('x86_64', dict(both, modelHolderReusesAndReleasesOnItsWorker=-3)), 3)
        self.assertEqual(self.ingest('x86_64', both, complete=False), 3)
        self.assertEqual(self.ingest('x86_64', both, passed=False), 3)
        other = self.apk('x86_64', {'libsherpa-onnx-jni.so': b'other', 'libonnxruntime.so': NATIVES['x86_64']['libonnxruntime.so']})
        self.assertEqual(self.ingest('x86_64', both, apk=other), 3)
        candidate = json.loads((self.dir / 'workspace/requalification/candidate.json').read_text())
        self.assertEqual(candidate['functionalAcceptance']['abis']['x86_64']['state'], 'failed')
        self.assertFalse(candidate['functionalAcceptance']['passed'])
        with self.assertRaises(SystemExit):
            requalify.main(['admit', *self.common, '--reviewer', 'release reviewer'])
        self.assertEqual((self.repo / 'android/local-speech/qualified-runtime-manifest.json').read_text(), self.previous)
        # A complete passing rerun admits the rebuild and keeps the previous record.
        self.assertEqual(self.ingest('x86_64', both), 0)
        with self.assertRaises(SystemExit):
            requalify.main(['admit', *self.common, '--reviewer', ' '])
        requalify.main(['admit', *self.common, '--reviewer', 'release reviewer'])
        admitted = json.loads((self.repo / 'android/local-speech/qualified-runtime-manifest.json').read_text())
        self.assertEqual(admitted['admission'], 'requalified-independent-rebuild')
        self.assertTrue(admitted['functionalAcceptance']['passed'])
        self.assertTrue(all(abi['deviceExecuted'] for abi in admitted['qualifiedAbis']))
        baseline = self.repo / admitted['previousBaseline']['path']
        self.assertEqual(baseline.read_text(), self.previous)
        # The APK gate now accepts exactly these natives, on both ABIs, and nothing else.
        for abi in ABIS:
            self.assertTrue(apk_check.qualify(self.apk(abi), admitted, required_abis=(abi,))['qualified'])
        self.assertFalse(apk_check.qualify(other, admitted, required_abis=('x86_64',))['qualified'])

    def test_a_changed_canonical_test_blocks_ingest_and_admission(self):
        self.record()
        both = {name: 0 for name in requalify.CANONICAL_TESTS}
        self.assertEqual(self.ingest('arm64-v8a', both), 0)
        self.assertEqual(self.ingest('x86_64', both), 0)
        with open(self.repo / requalify.CANONICAL_TEST, 'a') as handle:
            handle.write('// weakened\n')
        with self.assertRaises(SystemExit):
            requalify.main(['admit', *self.common, '--reviewer', 'release reviewer'])
        self.assertEqual(self.ingest('x86_64', both), 3)

    def test_parse_instrumentation_reads_per_test_codes(self):
        results, complete = requalify.parse_instrumentation(log({'a': 0, 'b': -2}, complete=False))
        self.assertEqual(results, {'a': 'passed', 'b': 'failed'})
        self.assertFalse(complete)


if __name__ == '__main__':
    unittest.main()
