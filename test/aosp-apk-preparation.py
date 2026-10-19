"""ZIP transformation tests; real SDK alignment is checked separately on built APKs."""
import importlib.util
import json
from pathlib import Path
import shutil
import struct
import tempfile
import unittest
from unittest.mock import patch
import warnings
import zipfile

spec = importlib.util.spec_from_file_location('prepare', Path(__file__).resolve().parents[1] / 'scripts/prepare-aosp-apk.py')
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)

class Preparation(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source, self.output = self.root / 'input.apk', self.root / 'output'

    def archive(self, extra=()):
        entries = [('AndroidManifest.xml', b'debug manifest with extractNativeLibs=true'),
                   ('classes.dex', b'dex'), ('lib/arm64-v8a/libeliza_bun.so', b'native'),
                   ('assets/agent/alpha-source.json', b'source receipt'), *extra]
        with warnings.catch_warnings(), zipfile.ZipFile(self.source, 'w', compression=zipfile.ZIP_DEFLATED) as z:
            warnings.simplefilter('ignore')
            for name, data in entries:
                z.writestr(name, data)

    @staticmethod
    def align(args, **kwargs):
        if '-c' not in args:
            shutil.copyfile(args[-2], args[-1])

    def test_preserves_every_payload_and_stores_native_and_dex(self):
        self.archive()
        with patch.object(prepare.subprocess, 'run', side_effect=self.align) as run:
            result = prepare.prepare(self.source, self.output, Path('/sdk/zipalign'))
        self.assertEqual(run.call_args_list[0].args[0][1:4], ['-P', '16', '4'])
        self.assertEqual(run.call_args_list[1].args[0][1:5], ['-c', '-P', '16', '4'])
        with zipfile.ZipFile(self.source) as before, zipfile.ZipFile(result) as after:
            self.assertEqual({n: before.read(n) for n in before.namelist()}, {n: after.read(n) for n in after.namelist()})
            self.assertTrue(all(e.compress_type == zipfile.ZIP_STORED for e in after.infolist() if e.filename.endswith(('.so', '.dex'))))
        report = json.loads((self.output / 'preparation.json').read_text())
        self.assertTrue(report['payloadUnchanged'])
        self.assertFalse(report['signed'])
        self.assertFalse(report['deployReady'])

    def test_rejects_v1_signed_duplicate_and_unsafe_entries_before_output(self):
        for extra in [[('META-INF/CERT.RSA', b'signature')], [('classes.dex', b'duplicate')], [('../outside', b'bad')]]:
            with self.subTest(extra=extra):
                self.archive(extra)
                with self.assertRaises(ValueError):
                    prepare.prepare(self.source, self.output, Path('/unused'))
                self.assertFalse(self.output.exists())

    def test_rejects_apk_signing_block_before_output(self):
        self.archive()
        data = self.source.read_bytes()
        with zipfile.ZipFile(self.source) as z:
            central = z.start_dir
        block = b'APK Sig Block 42'
        data = bytearray(data[:central] + block + data[central:])
        eocd = data.rfind(b'PK\x05\x06')
        struct.pack_into('<I', data, eocd + 16, central + len(block))
        self.source.write_bytes(data)
        with self.assertRaisesRegex(ValueError, 'signing block'):
            prepare.prepare(self.source, self.output, Path('/unused'))
        self.assertFalse(self.output.exists())

    def test_aligner_corruption_does_not_publish_receipt(self):
        self.archive()
        def corrupt(args, **kwargs):
            if '-c' in args:
                return
            with zipfile.ZipFile(args[-2]) as before, zipfile.ZipFile(args[-1], 'w') as after:
                for entry in before.infolist():
                    data = before.read(entry)
                    after.writestr(entry, data + b'changed' if entry.filename == 'classes.dex' else data)
        with patch.object(prepare.subprocess, 'run', side_effect=corrupt), self.assertRaisesRegex(ValueError, 'payload changed'):
            prepare.prepare(self.source, self.output, Path('/stub'))
        self.assertFalse((self.output / 'preparation.json').exists())

    def test_existing_output_is_preserved(self):
        self.archive()
        self.output.mkdir()
        marker = self.output / 'owner.txt'
        marker.write_text('preserve')
        with self.assertRaises(FileExistsError):
            prepare.prepare(self.source, self.output, Path('/unused'))
        self.assertEqual(marker.read_text(), 'preserve')

if __name__ == '__main__':
    unittest.main()
