"""Speech wrapper toolchain pin, workspace remap and qualified-record comparison."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('speech_toolchain', ROOT / 'scripts/local-speech/speech_toolchain.py')
toolchain = importlib.util.module_from_spec(spec)
spec.loader.exec_module(toolchain)
sha = lambda data: hashlib.sha256(data).hexdigest()


class SpeechToolchainTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name).resolve()

    def ndk(self, revision):
        ndk = self.dir / ('ndk-' + revision)
        ndk.mkdir()
        (ndk / 'source.properties').write_text(f'Pkg.Desc = Android NDK\nPkg.Revision = {revision}\n')
        return ndk

    def cmake(self, version):
        cmake = self.dir / ('cmake-' + version)
        cmake.write_text(f'#!/bin/sh\necho "cmake version {version}"\n')
        cmake.chmod(0o755)
        return str(cmake)

    def test_qualified_toolchain_is_accepted(self):
        ndk = self.ndk('28.2.13676358')
        self.assertEqual(toolchain.toolchain_problems(ndk, self.cmake('4.0.3')), [])
        toolchain.require_toolchain(ndk, self.dir / 'cmake-4.0.3')

    def test_toolchain_mismatches_name_the_fix(self):
        problems = toolchain.toolchain_problems(self.ndk('29.0.13113456'), self.cmake('3.22.1-g37088a8'))
        self.assertEqual(len(problems), 2)
        self.assertIn("sdkmanager 'ndk;28.2.13676358'", problems[0])
        self.assertIn('got 3.22.1-g37088a8', problems[1])
        self.assertIn('pip install cmake==4.0.3', problems[1])
        with self.assertRaises(SystemExit) as raised:
            toolchain.require_toolchain(self.dir / 'ndk-29.0.13113456', self.cmake('4.0.3'))
        self.assertIn('toolchain mismatch', str(raised.exception.code))
        self.assertIn('no --ndk argument', toolchain.toolchain_problems(None, False)[0])
        # Stripping needs only the NDK.
        self.assertEqual(toolchain.toolchain_problems(self.dir / 'ndk-29.0.13113456', False)[0][:28], 'Android NDK r28c 28.2.136763')

    def test_option_parsing(self):
        self.assertEqual(toolchain.option(['--abi', 'x86_64', '--ndk', '/n'], '--ndk'), '/n')
        self.assertEqual(toolchain.option(['--ndk=/m'], '--ndk'), '/m')
        self.assertIsNone(toolchain.option(['--abi', 'x86_64'], '--ndk'))

    def test_workspace_is_remapped_to_the_qualified_path(self):
        workspace = self.dir / 'ws'
        env = toolchain.remap_environment(workspace, {'PATH': '/bin'})
        self.assertEqual(env['CCC_OVERRIDE_OPTIONS'], f'#+-ffile-prefix-map={workspace}={toolchain.QUALIFIED_WORKSPACE}')
        self.assertEqual(env['PATH'], '/bin')
        with self.assertRaises(SystemExit):
            toolchain.remap_environment(workspace, {'CCC_OVERRIDE_OPTIONS': '+-O0'})
        with self.assertRaises(SystemExit):
            toolchain.remap_environment(self.dir / 'with space', {})

    def runtime(self, natives):
        """Write a generated workspace runtime plus a recorded repository manifest."""
        workspace, repository = self.dir / 'workspace', self.dir / 'repository'
        module = workspace / 'source/android/local-speech'
        (module / 'libs').mkdir(parents=True)
        (repository / 'android/local-speech').mkdir(parents=True)
        abis = []
        with zipfile.ZipFile(module / 'libs/sherpa-onnx-1.13.8-no-espeak.aar', 'w') as jar:
            for abi, data in natives.items():
                jar.writestr(f'jni/{abi}/libsherpa-onnx-jni.so', data)
                abis.append({'abi': abi, 'native': [{'file': 'libsherpa-onnx-jni.so', 'bytes': len(data), 'sha256': sha(data)}]})
        generated = {'noEspeak': True, 'aarSha256': 'local', 'qualifiedAbis': abis}
        (module / 'runtime-manifest.json').write_text(json.dumps(generated))
        return workspace, repository, generated

    def record(self, repository, manifest):
        (repository / 'android/local-speech/qualified-runtime-manifest.json').write_text(json.dumps(manifest))
        (repository / 'android/local-speech/runtime-manifest.json').write_text(json.dumps(manifest))

    def test_matching_natives_install_and_explain_the_container_hash(self):
        workspace, repository, generated = self.runtime({'arm64-v8a': b'arm', 'x86_64': b'x86'})
        self.record(repository, {**generated, 'aarSha256': 'recorded-container'})
        message = toolchain.check_against_record(workspace, repository, False)
        self.assertIn('match the qualified record', message)
        self.assertIn('do not commit', message)

    def test_differing_natives_are_refused_unless_explicitly_allowed(self):
        workspace, repository, generated = self.runtime({'arm64-v8a': b'arm', 'x86_64': b'x86'})
        recorded = json.loads(json.dumps(generated))
        recorded['qualifiedAbis'][0]['native'][0]['sha256'] = sha(b'qualified')
        self.record(repository, recorded)
        before = (repository / 'android/local-speech/runtime-manifest.json').read_bytes()
        with self.assertRaises(SystemExit) as raised:
            toolchain.check_against_record(workspace, repository, False)
        text = str(raised.exception.code)
        self.assertIn('arm64-v8a/libsherpa-onnx-jni.so', text)
        self.assertNotIn('x86_64/libsherpa-onnx-jni.so', text)
        self.assertIn('Nothing was installed', text)
        self.assertIn('--allow-unqualified-runtime', text)
        self.assertEqual((repository / 'android/local-speech/runtime-manifest.json').read_bytes(), before)
        warning = toolchain.check_against_record(workspace, repository, True)
        self.assertIn('UNQUALIFIED', warning)
        self.assertIn('arm64-v8a/libsherpa-onnx-jni.so', warning)

    def test_reinstall_cannot_promote_an_unqualified_local_manifest(self):
        workspace, repository, generated = self.runtime({'arm64-v8a': b'arm', 'x86_64': b'x86'})
        recorded = json.loads(json.dumps(generated))
        recorded['qualifiedAbis'][0]['native'][0]['sha256'] = sha(b'qualified')
        self.record(repository, recorded)
        # Installation replaces the local manifest, never the reviewed record.
        (repository / 'android/local-speech/runtime-manifest.json').write_text(json.dumps(generated))
        with self.assertRaises(SystemExit):
            toolchain.check_against_record(workspace, repository, False)

    def test_apk_qualification_checks_packaged_bytes_and_missing_abis(self):
        spec = importlib.util.spec_from_file_location('apk_qualification', ROOT / 'scripts/local-speech/verify-apk-qualification.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        _, _, record = self.runtime({'arm64-v8a': b'arm', 'x86_64': b'x86'})
        apk = self.dir / 'release.apk'
        def write(arm, x86):
            with zipfile.ZipFile(apk, 'w') as archive:
                archive.writestr('lib/arm64-v8a/libsherpa-onnx-jni.so', arm)
                if x86 is not None:
                    archive.writestr('lib/x86_64/libsherpa-onnx-jni.so', x86)
        write(b'arm', b'x86')
        self.assertTrue(module.qualify(apk, record)['qualified'])
        write(b'changed', b'x86')
        self.assertFalse(module.qualify(apk, record)['qualified'])
        write(b'arm', None)
        self.assertTrue(module.qualify(apk, record)['qualified'])  # Shipping release is ARM64 only.
        self.assertFalse(module.qualify(apk, record, ('arm64-v8a', 'x86_64'))['qualified'])
        write(b'changed', None)
        self.assertFalse(module.qualify(apk, record)['qualified'])

    def test_assembled_archive_must_match_its_generated_manifest(self):
        workspace, repository, generated = self.runtime({'arm64-v8a': b'arm', 'x86_64': b'x86'})
        self.record(repository, generated)
        generated['qualifiedAbis'][1]['native'][0]['sha256'] = sha(b'other')
        (workspace / 'source/android/local-speech/runtime-manifest.json').write_text(json.dumps(generated))
        with self.assertRaises(SystemExit) as raised:
            toolchain.check_against_record(workspace, repository, True)
        self.assertIn('rerun assemble-runtime', str(raised.exception.code))

    def test_build_wrapper_stops_before_delegating_on_a_wrong_ndk(self):
        ndk = self.ndk('29.0.13113456')
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/local-speech/build-no-espeak.py'),
                                 '--abi', 'arm64-v8a', '--ndk', str(ndk), '--jobs', '2'],
                                capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('toolchain mismatch', result.stderr)
        self.assertIn('28.2.13676358', result.stderr)
        self.assertNotIn('Traceback', result.stderr)


if __name__ == '__main__':
    unittest.main()
