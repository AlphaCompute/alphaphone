#!/usr/bin/env python3
"""Report native byte admission separately from reviewed speech functional acceptance."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile


def qualify(apk, record, required_abis=('arm64-v8a',)):
    differences = []
    with zipfile.ZipFile(apk) as archive:
        recorded_abis = {abi['abi'] for abi in record['qualifiedAbis']}
        packaged_abis = {name.split('/')[1] for name in archive.namelist() if name.startswith('lib/') and name.endswith('.so')}
        for abi in set(required_abis) - packaged_abis:
            differences.append(abi + ': missing required ABI')
        for abi in packaged_abis - recorded_abis:
            differences.append(abi + ': no reviewed native baseline')
        for abi in record['qualifiedAbis']:
            if abi['abi'] not in packaged_abis:
                continue
            for native in abi['native']:
                name = f"lib/{abi['abi']}/{native['file']}"
                if archive.namelist().count(name) != 1:
                    differences.append(name + ': missing or duplicate')
                    continue
                data = archive.read(name)
                if len(data) != native['bytes'] or hashlib.sha256(data).hexdigest() != native['sha256']:
                    differences.append(name + ': differs from reviewed native bytes')
    byte_match = not differences
    functional = record.get('functionalAcceptance')
    functional_differences = []
    if record.get('schemaVersion') != 2:
        functional_differences.append('No supported reviewed functional-acceptance record')
    if not isinstance(functional, dict) or functional.get('passed') is not True:
        functional_differences.append('Speech functional acceptance is not passed')
    accepted_abis = functional.get('abis') if isinstance(functional, dict) else None
    for abi in sorted(packaged_abis):
        accepted = accepted_abis.get(abi) if isinstance(accepted_abis, dict) else None
        if not isinstance(accepted, dict) or accepted.get('passed') is not True:
            functional_differences.append(abi + ': speech functional acceptance is not passed')
    functional_passed = not functional_differences
    return {
        'byteMatch': byte_match,
        'functionalPassed': functional_passed,
        'qualified': byte_match and functional_passed,
        'differences': differences,
        'functionalDifferences': functional_differences,
    }


def qualify_native(apk, record, source_commit, build_record_digest):
    result = qualify(apk, record)
    differences = result['differences']
    if record.get('sourceCommit') != source_commit:
        differences.append('Native speech qualification uses another source revision')
    if not build_record_digest or record.get('buildRecordSha256') != build_record_digest:
        differences.append('Native speech build record is not the qualified record')
    assets = record.get('assets', [])
    if not assets or not any(row.get('path') == 'assets/paradee-voice/v1/manifest.json' for row in assets):
        differences.append('Native speech has no qualified model inventory')
    with zipfile.ZipFile(apk) as archive:
        manifest_name = 'assets/paradee-voice/v1/manifest.json'
        try:
            manifest = json.loads(archive.read(manifest_name))
            inventory = manifest['files']
            if not isinstance(inventory, list) or not inventory:
                raise ValueError('empty model inventory')
            qualified_assets = {row['path']: row for row in assets}
            for entry in inventory:
                relative = entry['path']
                if not isinstance(relative, str) or any(part in ('', '.', '..') for part in relative.split('/')) or '\\' in relative:
                    raise ValueError('invalid model path')
                expected = {'path': 'assets/paradee-voice/v1/' + relative, 'bytes': entry['bytes'], 'sha256': entry['sha256']}
                if qualified_assets.get(expected['path']) != expected:
                    differences.append(expected['path'] + ': absent from qualified model inventory')
        except (KeyError, ValueError, TypeError, zipfile.BadZipFile):
            differences.append('Native speech model manifest is missing or invalid')
        for row in assets:
            name = row.get('path', '')
            if not name.startswith('assets/paradee-voice/v1/') or archive.namelist().count(name) != 1:
                differences.append(name + ': missing or invalid qualified asset')
                continue
            digest = hashlib.sha256()
            size = 0
            with archive.open(name) as stream:
                while chunk := stream.read(65536):
                    size += len(chunk)
                    digest.update(chunk)
            if size != row.get('bytes') or digest.hexdigest() != row.get('sha256'):
                differences.append(name + ': differs from qualified model bytes')
    result['byteMatch'] = not differences
    result['qualified'] = result['byteMatch'] and result['functionalPassed']
    return result


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[2]
    record = root / 'android/local-speech/native-qualification.json'
    baseline = json.loads(record.read_text()) if record.is_file() else {'schemaVersion': 2, 'qualifiedAbis': [], 'functionalAcceptance': {'passed': False, 'abis': {}}}
    pin = json.loads((root / 'upstream.lock.json').read_text())['commit']
    build = root / 'artifacts/native-voice/build-record.json'
    digest = hashlib.sha256(build.read_bytes()).hexdigest() if build.is_file() else None
    print(json.dumps(qualify_native(sys.argv[1], baseline, pin, digest)))
