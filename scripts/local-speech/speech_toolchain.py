"""Toolchain pin and qualified-record checks for the product speech wrappers.

The qualified no-eSpeak runtime recorded in android/local-speech/runtime-manifest.json
was built on macOS with Android NDK r28c (28.2.13676358) and CMake 4.0.3, in the
workspace QUALIFIED_WORKSPACE. Its JNI library depends on the build path twice:
sherpa-onnx logging embeds __FILE__ paths in .rodata, and the GNU build ID that lld
writes (and llvm-strip keeps) hashes the unstripped output, whose ThinLTO
promoted-symbol names (".llvm.<hash>") derive from the absolute object paths.

The wrappers pin both tools and remap the workspace to the qualified path (clang's
CCC_OVERRIDE_OPTIONS adds -ffile-prefix-map; the NDK's legacy CMake toolchain file
ignores CFLAGS/CXXFLAGS). Stripped arm64-v8a libraries built this way in two
different directories differ only in the 20-byte build ID, and match the recorded
size exactly (4,042,512 bytes); the SHA-256 still differs from the record, most
likely through the build ID, which only a build in QUALIFIED_WORKSPACE itself could
reproduce. CMake 3.22.1 produces
a different library altogether. The AAR container hashes can never be reproduced:
the pinned tooling writes ZIP entries with the current time. install-generated
therefore compares the native members, and refuses a runtime that differs from the
record unless --allow-unqualified-runtime is given.
"""
from pathlib import Path
import hashlib
import json
import os
import re
import shutil
import subprocess
import zipfile

NDK_REVISION = '28.2.13676358'
CMAKE_VERSION = '4.0.3'
QUALIFIED_WORKSPACE = '/Users/shawwalters/Documents/alphaphone/test-results/mvp-local-speech-staging'
ALLOW_UNQUALIFIED = '--allow-unqualified-runtime'


class ToolchainMismatch(SystemExit):
    pass


def option(argv, name):
    """Value of --name VALUE or --name=VALUE in argv, else None."""
    for index, arg in enumerate(argv):
        if arg == name and index + 1 < len(argv):
            return argv[index + 1]
        if arg.startswith(name + '='):
            return arg.split('=', 1)[1]
    return None


def ndk_revision(ndk):
    properties = Path(ndk) / 'source.properties'
    if not properties.is_file():
        return None
    match = re.search(r'^Pkg\.Revision\s*=\s*(\S+)\s*$', properties.read_text(), re.M)
    return match.group(1) if match else None


def cmake_version(cmake=None):
    executable = cmake or shutil.which('cmake')
    if not executable:
        return None
    output = subprocess.run([executable, '--version'], capture_output=True, text=True, check=False).stdout
    match = re.match(r'cmake version (\S+)', output)
    return match.group(1) if match else None


def toolchain_problems(ndk, cmake=None):
    problems = []
    revision = ndk_revision(ndk) if ndk else None
    if revision != NDK_REVISION:
        found = f'{ndk} (revision {revision or "unknown"})' if ndk else 'no --ndk argument'
        problems.append(f'Android NDK r28c {NDK_REVISION} is required; got {found}. '
                        f"Install it with: sdkmanager 'ndk;{NDK_REVISION}' and pass --ndk \"$ANDROID_HOME/ndk/{NDK_REVISION}\".")
    if cmake is not False:
        version = cmake_version(cmake)
        # CMake reports e.g. "3.22.1-g37088a8" for the SDK build; compare the release.
        if (version or '').split('-')[0] != CMAKE_VERSION:
            problems.append(f'CMake {CMAKE_VERSION} must be first on PATH; got {version or "no cmake"}. '
                            f'Other CMake releases produce a different JNI library (3.22.1 adds about 227 KB). '
                            f'Install it with: python3 -m pip install cmake=={CMAKE_VERSION}')
    return problems


def require_toolchain(ndk, cmake=None):
    problems = toolchain_problems(ndk, cmake)
    if problems:
        raise ToolchainMismatch('Speech runtime toolchain mismatch; refusing to build an AAR that cannot match '
                                'android/local-speech/runtime-manifest.json:\n' + '\n'.join('  - ' + p for p in problems))


def remap_environment(workspace, env=None):
    """Child environment whose clang invocations map the workspace to the qualified path."""
    env = dict(os.environ if env is None else env)
    workspace = str(Path(workspace).resolve())
    if any(ch.isspace() for ch in workspace):
        raise ToolchainMismatch(f'Speech workspace path must not contain whitespace: {workspace}')
    # A leading '#' keeps clang from echoing the override on every invocation.
    override = f'#+-ffile-prefix-map={workspace}={QUALIFIED_WORKSPACE}'
    previous = env.get('CCC_OVERRIDE_OPTIONS')
    if previous and previous != override:
        raise ToolchainMismatch('CCC_OVERRIDE_OPTIONS is already set; unset it so the qualified path remap is exact.')
    env['CCC_OVERRIDE_OPTIONS'] = override
    return env


def native_members(manifest):
    return {(abi['abi'], native['file']): (native['bytes'], native['sha256'])
            for abi in manifest['qualifiedAbis'] for native in abi['native']}


def record_differences(generated, recorded):
    """Native member differences between a generated and the recorded runtime manifest."""
    differences = []
    built, qualified = native_members(generated), native_members(recorded)
    for key in sorted(set(built) | set(qualified)):
        if built.get(key) != qualified.get(key):
            abi, name = key
            have = built.get(key)
            want = qualified.get(key)
            differences.append(f'{abi}/{name}: built {have[1] + f" ({have[0]} bytes)" if have else "missing"}, '
                               f'recorded {want[1] + f" ({want[0]} bytes)" if want else "missing"}')
    for field in ('noEspeak',):
        if generated.get(field) != recorded.get(field):
            differences.append(f'{field}: built {generated.get(field)!r}, recorded {recorded.get(field)!r}')
    return differences


def generated_matches_archive(manifest, archive):
    """The generated manifest describes exactly the native members of the assembled AAR."""
    with zipfile.ZipFile(archive) as jar:
        for (abi, name), (size, digest) in native_members(manifest).items():
            data = jar.read(f'jni/{abi}/{name}')
            if len(data) != size or hashlib.sha256(data).hexdigest() != digest:
                return False
    return True


def check_against_record(workspace, repository, allow_unqualified):
    """Return a message for the installer; raise unless the natives match or the caller opted in."""
    generated_path = Path(workspace) / 'source/android/local-speech/runtime-manifest.json'
    recorded_path = Path(repository) / 'android/local-speech/runtime-manifest.json'
    generated = json.loads(generated_path.read_text())
    recorded = json.loads(recorded_path.read_text())
    archive = generated_path.parent / 'libs/sherpa-onnx-1.13.8-no-espeak.aar'
    if not generated_matches_archive(generated, archive):
        raise ToolchainMismatch(f'{archive} does not match {generated_path}; rerun assemble-runtime.')
    differences = record_differences(generated, recorded)
    if not differences:
        return ('Native libraries match the qualified record. The AAR container hash still differs '
                '(ZIP entry times), so the installed runtime-manifest.json records the local container '
                'hash: do not commit that change.')
    summary = '\n'.join('  - ' + line for line in differences)
    if not allow_unqualified:
        raise ToolchainMismatch(
            'The locally built speech runtime differs from the qualified record in '
            f'android/local-speech/runtime-manifest.json:\n{summary}\n'
            'Nothing was installed. Reproducing the record needs macOS, Android NDK r28c '
            f'{NDK_REVISION}, CMake {CMAKE_VERSION} and the qualified workspace path (the wrappers '
            'pin and remap these); see scripts/local-speech/README.md. To build non-release APKs with this '
            f'runtime anyway, rerun install-generated with {ALLOW_UNQUALIFIED}; never commit the '
            'runtime-manifest.json it writes.')
    return ('WARNING: installing an UNQUALIFIED speech runtime (' + ALLOW_UNQUALIFIED + '). '
            'APKs built with it are build evidence only, not release candidates. It differs from the record:\n'
            + summary + '\nandroid/local-speech/runtime-manifest.json now describes this local build: do not commit it.')
