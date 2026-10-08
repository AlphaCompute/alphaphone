#!/usr/bin/env python3
"""Requalify an independently rebuilt speech runtime (release-15).

A rebuild on another machine cannot reproduce the recorded JNI bytes (GNU build IDs, ZIP
times; see README.md), so install-generated refuses it. This tool is the reviewed path to
admit such a rebuild: it records the rebuild's source, toolchain and native identity, runs
the canonical functional test per ABI on a named disposable device, and only then writes a
new qualified-runtime-manifest.json, preserving the previous record under baselines/.

  record      --ndk NDK [--cmake CMAKE] [--workspace W]       candidate from the generated runtime
  run         --serial S --apk APP.apk --test-apk TEST.apk [--candidate C]
                                                              run LocalSpeechInstrumentedTest, ingest it
  ingest      --abi ABI --apk APP.apk --log LOG --evidence DIR [--candidate C]
                                                              ingest a run made elsewhere
  admit       --reviewer TEXT [--candidate C]                 write the reviewed record

The candidate lives in <workspace>/requalification/candidate.json. Nothing is admitted unless
every ABI in the rebuild has an executed, fully passing canonical run on its own ABI whose
APK carries exactly the candidate's native bytes. The canonical test file must be unchanged.
Admission is byte identity plus that functional run; it is not release or device acceptance.
"""
from pathlib import Path
import argparse
import datetime
import hashlib
import json
import platform
import re
import shutil
import subprocess
import sys
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import speech_toolchain  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CANONICAL_TEST = 'android/app/src/androidTest/java/ai/elizaresearch/alphaphone/LocalSpeechInstrumentedTest.java'
CANONICAL_CLASS = 'ai.elizaresearch.alphaphone.LocalSpeechInstrumentedTest'
CANONICAL_TESTS = ('nativeModelsTranscribeAndSynthesizeWithNoNetwork', 'modelHolderReusesAndReleasesOnItsWorker')
PACKAGE = 'ai.elizaresearch.alphaphone'
RUNNER = PACKAGE + '.test/androidx.test.runner.AndroidJUnitRunner'
EVIDENCE = f'/sdcard/Android/data/{PACKAGE}/files/local-speech-evidence'
TOOLING = 'vendor/eliza/packages/app/scripts/local-speech'


def sha_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def tree_sha(root, directory):
    """Hash of every regular file under directory, by relative path and content."""
    base = Path(root) / directory
    if not base.is_dir():
        return None
    digest = hashlib.sha256()
    for path in sorted(p for p in base.rglob('*') if p.is_file() and '__pycache__' not in p.parts):
        digest.update(str(path.relative_to(base)).encode() + b'\0' + sha_file(path).encode() + b'\n')
    return digest.hexdigest()


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def load(path):
    return json.loads(Path(path).read_text())


def save(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(path)


def candidate_path(args):
    return Path(args.candidate) if args.candidate else Path(args.workspace) / 'requalification/candidate.json'


def record(args):
    """Candidate record for the runtime the pinned tooling generated in the workspace."""
    workspace, repository = Path(args.workspace), Path(args.repository)
    speech_toolchain.require_toolchain(args.ndk, args.cmake)
    generated_path = workspace / 'source/android/local-speech/runtime-manifest.json'
    generated = load(generated_path)
    archive = generated_path.parent / 'libs/sherpa-onnx-1.13.8-no-espeak.aar'
    if not speech_toolchain.generated_matches_archive(generated, archive):
        raise SystemExit(f'{archive} does not match {generated_path}; rerun assemble-runtime.')
    if generated.get('noEspeak') is not True or any(abi.get('noEspeakSources') is not True or abi.get('noEspeakSymbols') is not True for abi in generated['qualifiedAbis']):
        raise SystemExit('The rebuilt runtime is not a verified no-eSpeak build; nothing recorded.')
    previous = load(repository / 'android/local-speech/qualified-runtime-manifest.json')
    differences = speech_toolchain.record_differences(generated, previous)
    cmake = args.cmake or shutil.which('cmake')
    lock = load(repository / 'upstream.lock.json')
    candidate = {
        'schemaVersion': 2,
        'admission': 'requalification-candidate',
        'recordedAt': now(),
        'noEspeak': True,
        'aarSha256': sha_file(archive),
        'qualifiedAbis': [{key: value for key, value in abi.items() if key != 'deviceExecuted'} | {'deviceExecuted': False} for abi in generated['qualifiedAbis']],
        'provenance': {
            'upstreamCommit': lock['commit'],
            'rebuild': 'independent',
            'toolingTreeSha256': tree_sha(repository, TOOLING),
            'wrapperTreeSha256': tree_sha(repository, 'scripts/local-speech'),
            'toolchain': {
                'host': f'{platform.system()} {platform.machine()}',
                'ndk': speech_toolchain.ndk_revision(args.ndk),
                'ndkSourcePropertiesSha256': sha_file(Path(args.ndk) / 'source.properties'),
                'cmake': (speech_toolchain.cmake_version(cmake) or '').split('-')[0],
                'cmakeExecutableSha256': sha_file(Path(cmake).resolve()) if cmake else None,
                'filePrefixRemap': speech_toolchain.QUALIFIED_WORKSPACE,
            },
            'canonicalTest': CANONICAL_TEST,
            'canonicalTestSha256': sha_file(repository / CANONICAL_TEST),
            'differsFromPreviousRecord': differences,
        },
        'functionalAcceptance': {
            'passed': False, 'state': 'not-executed', 'suite': 'LocalSpeechInstrumentedTest',
            'abis': {abi['abi']: {'passed': False, 'state': 'not-executed'} for abi in generated['qualifiedAbis']},
        },
    }
    save(candidate_path(args), candidate)
    print(f'Recorded candidate for {", ".join(candidate["functionalAcceptance"]["abis"])}: {candidate_path(args)}')
    return candidate


def parse_instrumentation(text):
    """Per-test status from `am instrument -r` raw output: 1 start, 0 ok, -1/-2 failure, -3/-4 skip/assumption."""
    results, current = {}, {}
    for line in text.splitlines():
        match = re.match(r'INSTRUMENTATION_STATUS: (class|test)=(.*)$', line)
        if match:
            current[match.group(1)] = match.group(2).strip()
            continue
        match = re.match(r'INSTRUMENTATION_STATUS_CODE: (-?\d+)$', line)
        if match:
            code = int(match.group(1))
            if code != 1 and current.get('class') == CANONICAL_CLASS and current.get('test'):
                results[current['test']] = {0: 'passed', -1: 'failed', -2: 'failed', -3: 'skipped', -4: 'skipped'}.get(code, 'unknown')
            current = {}
    complete = 'INSTRUMENTATION_CODE: -1' in text and 'FAILURES!!!' not in text
    return results, complete


def apk_natives(apk, abi):
    with zipfile.ZipFile(apk) as archive:
        names = archive.namelist()
        return {name.split('/')[-1]: (len(archive.read(name)), sha_bytes(archive.read(name))) for name in names if name.startswith(f'lib/{abi}/') and name.endswith('.so')}


def ingest(args, log_text=None):
    """Record one ABI's canonical run. Every condition must hold for that ABI to pass."""
    path = candidate_path(args)
    candidate = load(path)
    abi = args.abi
    entry = next((item for item in candidate['qualifiedAbis'] if item['abi'] == abi), None)
    if entry is None:
        raise SystemExit(f'{abi} is not part of this rebuild.')
    problems = []
    if sha_file(Path(args.repository) / CANONICAL_TEST) != candidate['provenance']['canonicalTestSha256']:
        problems.append('canonical test changed since the candidate was recorded')
    packaged = apk_natives(args.apk, abi)
    for native in entry['native']:
        if packaged.get(native['file']) != (native['bytes'], native['sha256']):
            problems.append(f'APK lib/{abi}/{native["file"]} differs from the rebuilt native bytes')
    log_text = Path(args.log).read_text() if log_text is None else log_text
    results, complete = parse_instrumentation(log_text)
    for name in CANONICAL_TESTS:
        if results.get(name) != 'passed':
            problems.append(f'{name}: {results.get(name, "not executed")}')
    if not complete:
        problems.append('instrumentation run did not complete without failures')
    evidence = Path(args.evidence)
    digests = {}
    for name, required in (('result.json', 'pass'), ('holder-result.json', 'pass')):
        file = evidence / name
        if not file.is_file():
            problems.append(f'missing evidence {name}')
            continue
        digests[name] = sha_file(file)
        value = json.loads(file.read_text())
        if value.get(required) is not True:
            problems.append(f'{name} does not record a pass')
        if value.get('execution') != 'android-process-cpu':
            problems.append(f'{name} does not record on-device CPU execution')
    if args.device_abi and args.device_abi != abi:
        problems.append(f'device ABI {args.device_abi} is not {abi}')
    digests['instrumentationLog'] = sha_bytes(log_text.encode())
    passed = not problems
    candidate['functionalAcceptance']['abis'][abi] = {
        'passed': passed, 'state': 'passed' if passed else 'failed', 'executedAt': now(),
        'testsExecuted': sum(1 for value in results.values() if value in ('passed', 'failed')),
        'testsPassed': sum(1 for value in results.values() if value == 'passed'),
        'appAPKSha256': sha_file(args.apk), 'evidenceDigests': digests,
        **({'problems': problems} if problems else {}),
    }
    if passed:
        entry['deviceExecuted'] = True
    states = candidate['functionalAcceptance']['abis'].values()
    candidate['functionalAcceptance']['passed'] = all(item['passed'] for item in states)
    candidate['functionalAcceptance']['state'] = 'passed' if candidate['functionalAcceptance']['passed'] else ('failed' if any(item['state'] == 'failed' for item in states) else 'incomplete')
    save(path, candidate)
    print(f'{abi}: {"passed" if passed else "failed"}' + ('' if passed else '\n  - ' + '\n  - '.join(problems)))
    return passed


def adb(serial, *arguments, capture=True):
    return subprocess.run(['adb', '-s', serial, *arguments], check=True, capture_output=capture, text=True).stdout


def run(args):
    """Install both APKs on the named device and run the canonical suite with networking off."""
    if not args.serial:
        raise SystemExit('Name the disposable test device with --serial; no default device is used.')
    abi = adb(args.serial, 'shell', 'getprop', 'ro.product.cpu.abi').strip()
    args.abi, args.device_abi = abi, abi
    adb(args.serial, 'install', '-r', '-t', args.apk)
    adb(args.serial, 'install', '-r', '-t', args.test_apk)
    adb(args.serial, 'shell', 'rm', '-rf', EVIDENCE)
    # The suite asserts that networking is unavailable; the operator disables it first.
    log = subprocess.run(['adb', '-s', args.serial, 'shell', 'am', 'instrument', '-w', '-r', '-e', 'localSpeech', '1', '-e', 'class', CANONICAL_CLASS, RUNNER], capture_output=True, text=True, check=False).stdout
    out = Path(args.workspace) / 'requalification' / abi
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    (out / 'instrumentation.log').write_text(log)
    subprocess.run(['adb', '-s', args.serial, 'pull', EVIDENCE, str(out)], check=False, capture_output=True)
    args.log, args.evidence = str(out / 'instrumentation.log'), str(out / 'local-speech-evidence')
    return ingest(args, log)


def admit(args):
    """Write the reviewed record. Refuses unless every rebuilt ABI passed on its own ABI."""
    candidate = load(candidate_path(args))
    acceptance = candidate['functionalAcceptance']
    missing = [abi['abi'] for abi in candidate['qualifiedAbis'] if acceptance['abis'].get(abi['abi'], {}).get('passed') is not True]
    if missing or acceptance.get('passed') is not True:
        raise SystemExit('Not admitted: canonical functional acceptance has not passed for ' + ', '.join(missing or ['every ABI']) + '.')
    if not args.reviewer or not args.reviewer.strip():
        raise SystemExit('Name the reviewer of this admission with --reviewer.')
    repository = Path(args.repository)
    if sha_file(repository / CANONICAL_TEST) != candidate['provenance']['canonicalTestSha256']:
        raise SystemExit('Not admitted: the canonical test changed after it ran.')
    target = repository / 'android/local-speech/qualified-runtime-manifest.json'
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    baseline = repository / f'android/local-speech/baselines/qualified-runtime-manifest-before-{stamp}.json'
    baseline.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(target, baseline)
    admitted = dict(candidate)
    admitted.update({
        'admission': 'requalified-independent-rebuild',
        'admittedAt': now(), 'reviewedBy': args.reviewer.strip(),
        'previousBaseline': {'path': str(baseline.relative_to(repository)), 'sha256': sha_file(baseline), 'bitEquivalentToRebuild': not candidate['provenance']['differsFromPreviousRecord']},
        'acceptanceLimits': [
            'Native byte identity of this rebuild plus the canonical LocalSpeechInstrumentedTest on each listed ABI only',
            'No microphone, speaker, perceptual or physical-device user acceptance',
            'Not a release decision',
        ],
    })
    acceptance['suite'] = 'LocalSpeechInstrumentedTest'
    save(target, admitted)
    print(f'Admitted {", ".join(acceptance["abis"])} into {target.relative_to(repository)}; previous record kept at {baseline.relative_to(repository)}.')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('command', choices=('record', 'run', 'ingest', 'admit'))
    parser.add_argument('--workspace', default=str(ROOT / '.eliza/local-speech'))
    parser.add_argument('--repository', default=str(ROOT))
    parser.add_argument('--candidate')
    parser.add_argument('--ndk')
    parser.add_argument('--cmake')
    parser.add_argument('--serial')
    parser.add_argument('--apk')
    parser.add_argument('--test-apk')
    parser.add_argument('--abi')
    parser.add_argument('--device-abi')
    parser.add_argument('--log')
    parser.add_argument('--evidence')
    parser.add_argument('--reviewer')
    args = parser.parse_args(argv)
    if args.command == 'record':
        record(args)
    elif args.command == 'run':
        sys.exit(0 if run(args) else 3)
    elif args.command == 'ingest':
        if not (args.abi and args.apk and args.log and args.evidence):
            parser.error('ingest needs --abi, --apk, --log and --evidence')
        sys.exit(0 if ingest(args) else 3)
    else:
        admit(args)


if __name__ == '__main__':
    main()
