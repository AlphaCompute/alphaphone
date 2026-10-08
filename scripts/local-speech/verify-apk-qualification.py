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


if __name__ == '__main__':
    record = Path(__file__).resolve().parents[2] / 'android/local-speech/qualified-runtime-manifest.json'
    print(json.dumps(qualify(sys.argv[1], json.loads(record.read_text()))))
