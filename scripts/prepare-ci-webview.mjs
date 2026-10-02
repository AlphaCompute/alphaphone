// Development snapshot provisioning for a fresh, disposable GitHub-hosted AOSP
// fixture only. This is not a production provider or a retail-device installer.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { androidEnv } from './toolchain.mjs';
import { requireHostedFixtureEnvironment, assertFixtureIdentity } from './ci-emulator-display.mjs';

export const candidate = Object.freeze({
  url: 'https://commondatastorage.googleapis.com/chromium-browser-snapshots/AndroidDesktop_x64/1709176/chrome-android-desktop.zip?generation=1790879561205229',
  source: 'b1bde56dbc71dd73916cb44c9270c37086379bdf',
  size: 495801966,
  archiveSha256: '77405c260640243a0f741f0419fe8b19dc1b798f2954fefddf64dfe23e2da1fc',
  apkSha256: '1fc4f0dbcd52fb6f1141f56df0ec31927e1e0a54d927da70023d4961eebf47ed',
  certificateSha256: '32a2fc74d731105859e5a85df16d95f102d85b22099b8064c5d8915c61dad1e0',
  version: '157.0.8083.0', versionCode: '808300007', package: 'com.android.webview',
});
const require = (condition, message) => { if (!condition) throw new Error(message); };
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
// Exit 255 with a partial process dump is an unavailable observation, never
// proof of no instrumentation. Retry only that failure; refresh every read-only
// identity/package check each time. command() retains all failed observations.
export function requireProviderFixture(run, env, options = {}, wait = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return providerFixtureAttempt(run, env, options); }
    catch (error) {
      if (!error.providerInventoryUnavailable || error.status !== 255 || error.signal != null || attempt === 2) throw error;
      wait();
    }
  }
}
function providerFixtureAttempt(run, env, { installed = false } = {}) {
  requireHostedFixtureEnvironment(env, env.ANDROID_SERIAL);
  assertFixtureIdentity(run);
  for (const [key, value] of [['ro.build.version.sdk', '35'], ['ro.product.cpu.abi', 'x86_64']])
    require(run('shell', 'getprop', key).trim() === value, `Wrong provider fixture ${key}`);
  require(/^sdk_phone(?:64)?_x86_64-userdebug$/.test(run('shell', 'getprop', 'ro.build.flavor').trim()), 'Wrong AOSP system image flavor');
  const packages = run('shell', 'pm', 'list', 'packages', '-3').trim().split(/\r?\n/).filter(Boolean);
  require(packages.every(p => installed && p === 'package:com.android.webview'), 'Unexpected fixture applications');
  const all = run('shell', 'pm', 'list', 'packages');
  require(!/package:(?:com\.google\.android\.(?:gms|webview)|com\.android\.chrome|ai\.elizaresearch\.)/.test(all), 'Not a fresh default AOSP provider fixture');
  let processes;
  try { processes = run('shell', 'dumpsys', 'activity', 'processes'); }
  catch (error) { error.providerInventoryUnavailable = true; throw error; }
  require(processes.includes('ACTIVITY MANAGER') && !/ActiveInstrumentation\{|InstrumentationRecord\{|mInstr=(?!null\b)/.test(processes), 'Active or unknown instrumentation');
}
export function stockPath(paths, dump) {
  const entries = paths.trim().split(/\r?\n/);
  require(entries.length === 1 && /^package:\/product\/app\/webview\/[A-Za-z0-9_.-]+\.apk$/.test(entries[0]), 'Unexpected stock provider path');
  require(/\bversionName=124\.0\.6367\.219\b/.test(dump) && !dump.includes('UPDATED_SYSTEM_APP'), 'Unexpected stock provider identity');
  return entries[0].slice(8);
}
export function verifyMetadata(signature, badging, manifest) {
  require(signature.includes('Verified using v2 scheme (APK Signature Scheme v2): true') && signature.includes(`Signer #1 certificate SHA-256 digest: ${candidate.certificateSha256}`), 'Unexpected developer signature');
  require(badging.includes(`package: name='${candidate.package}' versionCode='${candidate.versionCode}' versionName='${candidate.version}'`) && badging.includes("sdkVersion:'29'") && badging.includes("targetSdkVersion:'37'") && /native-code:.*'x86_64'/.test(badging), 'Unexpected provider metadata');
  require(manifest.includes('com.android.webview.WebViewLibrary') && manifest.includes('libwebviewchromium.so') && !manifest.includes('E: uses-static-library'), 'Unexpected external provider dependency');
}

// Failure evidence only: one shared budget, no retries, mutations or guessed block targets.
export function collectOverlayFailureDiagnostics({ environment, sdkEnvironment, execute, now = Date.now, hostPaths = { workspace: process.cwd(), androidSdk: sdkEnvironment.ANDROID_HOME, home: process.env.HOME }, statfs = fs.statfsSync, userspaceOnly = false }) {
  const deadline = now() + 20000;
  const evidence = { host: {}, guest: {}, budgetMilliseconds: 20000 };
  for (const [name, location] of Object.entries(hostPaths)) {
    try { const value = statfs(location); evidence.host[name] = { availableBytes: value.bavail * value.bsize, freeBytes: value.bfree * value.bsize }; }
    catch (error) { evidence.host[name] = { unavailable: String(error.message).slice(0, 512) }; }
  }
  let sourceFd;
  try {
    const source = path.join(sdkEnvironment.ANDROID_HOME, 'system-images/android-35/default/x86_64/source.properties');
    sourceFd = fs.openSync(source, 'r');
    const bytes = Buffer.alloc(8192);
    evidence.host.imageSourceProperties = bytes.subarray(0, fs.readSync(sourceFd, bytes, 0, bytes.length, 0)).toString('utf8');
  } catch (error) { evidence.host.imageSourceProperties = { unavailable: String(error.message).slice(0, 512) }; }
  finally { if (sourceFd !== undefined) fs.closeSync(sourceFd); }
  const read = (...args) => {
    const remaining = deadline - now();
    require(remaining > 0, 'Failure diagnostic deadline exceeded');
    return execute(path.join(sdkEnvironment.ANDROID_HOME, 'platform-tools/adb'), ['-s', environment.ANDROID_SERIAL, ...args], {
      env: sdkEnvironment, encoding: 'utf8', timeout: Math.min(2000, remaining), maxBuffer: 256 * 1024,
    });
  };
  for (const [name, args] of [
    ['userspaceStorageLog', ['shell', 'logcat', '-d', '-b', 'all', '-t', '400']],
    ['fingerprint', ['shell', 'getprop', 'ro.build.fingerprint']],
    ['deviceMapperNames', ['shell', 'dmctl', 'list', 'devices']],
    ['blockNames', ['shell', 'ls', '-l', '/dev/block/by-name']],
    ['superMetadata', ['shell', 'lpdump', '/dev/block/by-name/super']],
    ['capacity', ['shell', 'df', '-k', '/data', '/metadata', '/product']],
    ['partitions', ['shell', 'cat', '/proc/partitions']],
    ['kernel', ['shell', 'dmesg']],
  ]) {
    if (userspaceOnly && name !== 'userspaceStorageLog') continue;
    // Admission uses the same bounded executor and performs one complete attempt.
    try { requireProviderFixture(read, environment, {}, () => { throw Error('Failure diagnostic admission unavailable'); }); }
    catch (error) { evidence.admissionStopped = String(error.message).slice(0, 512); break; }
    try {
      const result = read(...args);
      evidence.guest[name] = (['userspaceStorageLog', 'kernel'].includes(name) ? result.split('\n').filter(line => /gsid|fiemap|scratch|overlay|mkfs|f2fs|ext4|device.mapper/i.test(line)).join('\n') : result).slice(-65536);
    } catch (error) {
      evidence.guest[name] = { unavailable: String(error.message).slice(0, 512), status: error.status ?? null, signal: error.signal ?? null, code: error.code ?? null, stdout: String(error.stdout ?? '').slice(-4096), stderr: String(error.stderr ?? '').slice(-4096) };
    }
  }
  return evidence;
}

export async function main({ environment = process.env, execute = execFileSync, sdkEnvironment, outputDirectory, sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)), now = Date.now, fileDigest = sha } = {}) {
  const serial = environment.ANDROID_SERIAL;
  requireHostedFixtureEnvironment(environment, serial); // Before download or device access.
  require(environment.ALPHA_DISPOSABLE_WEBVIEW_FIXTURE === 'api35-default-x86_64', 'Explicit disposable provider fixture required');
  const env = sdkEnvironment ?? androidEnv(), sdk = env.ANDROID_HOME;
  const output = path.resolve(outputDirectory ?? 'test-results/ci-webview-provider');
  require(!fs.existsSync(output), 'Fresh provider evidence directory required');
  fs.mkdirSync(output, { recursive: true });
  const state = { status: 'preflight', candidate, productionApproved: false, runtimeFeaturesQualified: false, commands: [] };
  const save = () => fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(state, null, 2) + '\n');
  const command = (file, args, timeout = 20000) => {
    try { const result = execute(file, args, { env, encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024 }); state.commands.push({ file, args, success: true }); save(); return result; }
    catch (error) { state.commands.push({ file, args, success: false, status: error.status ?? null, signal: error.signal ?? null, code: error.code ?? null, stdout: String(error.stdout ?? '').slice(-65536), stderr: String(error.stderr ?? '').slice(-65536) }); save(); throw error; }
  };
  const run = (...args) => command(path.join(sdk, 'platform-tools/adb'), ['-s', serial, ...args]);
  const safe = (installed = false) => requireProviderFixture(run, environment, { installed });
  const scratchProperty = 'fs_mgr.overlayfs.data_scratch_size_mb';
  const configureScratch = () => {
    safe(); // Every property mutation is confined to the fresh hosted fixture.
    const previous = run('shell', 'getprop', scratchProperty).trim();
    require(previous === '' || previous === '512', 'Unexpected existing scratch size policy');
    run('shell', 'setprop', scratchProperty, '512');
    require(run('shell', 'getprop', scratchProperty).trim() === '512', 'Scratch size policy did not apply');
    state.scratchPolicy = { property: scratchProperty, previous, megabytes: 512 }; save();
  };
  const captureStorage = label => {
    const details = {};
    // Fixed read-only commands; never run a formatter or infer a target dm-N device.
    for (const [name, args] of [
      ['capacity', ['shell', 'df', '-k', '/data', '/metadata', '/product']],
      ['mounts', ['shell', 'cat', '/proc/mounts']],
      ['partitions', ['shell', 'cat', '/proc/partitions']],
      ['logicalPartitions', ['shell', 'lpdump']],
      ['kernel', ['shell', 'dmesg']],
    ]) {
      try {
        const value = run(...args);
        details[name] = (name === 'kernel' ? value.split('\n').filter(line => /fiemap|f2fs|ext4|device.mapper|dm-|scratch|overlay|gsid/i.test(line)).join('\n') : value).slice(-65536);
      } catch (error) { details[name] = { unavailable: error.message.slice(0, 512) }; }
    }
    fs.writeFileSync(path.join(output, `storage-${label}.json`), JSON.stringify(details, null, 2) + '\n');
  };
  const boot = async () => {
    const end = now() + 180000;
    while (now() < end) {
      try {
        if (run('shell', 'getprop', 'sys.boot_completed').trim() === '1' &&
            /Service package: found/.test(run('shell', 'service', 'check', 'package')) &&
            /Service activity: found/.test(run('shell', 'service', 'check', 'activity'))) return;
      } catch (error) {
        // Offline and unavailable binder services are expected during reboot.
        // The timeout never extends; normal fixture admission follows readiness.
        state.lastBootReadError = error.message;
      }
      await sleep(1000);
    }
    throw new Error('Provider fixture boot deadline exceeded');
  };
  save();
  try {
    safe();
    const stock = stockPath(run('shell', 'pm', 'path', candidate.package), run('shell', 'dumpsys', 'package', candidate.package));
    const stockHash = run('shell', 'sha256sum', stock).trim().split(/\s+/)[0];
    require(/^[a-f0-9]{64}$/.test(stockHash), 'Invalid stock hash');
    const backup = path.join(output, 'stock-webview.apk');
    run('pull', stock, backup); require(fileDigest(backup) === stockHash, 'Stock backup mismatch');
    state.stock = { path: stock, sha256: stockHash };
    const archive = path.join(output, 'chromium.zip'), apk = path.join(output, 'SystemWebView.apk');
    command('curl', ['--fail', '--location', '--silent', '--show-error', '--connect-timeout', '20', '--max-time', '600', candidate.url, '--output', archive], 610000);
    require(fs.statSync(archive).size === candidate.size && fileDigest(archive) === candidate.archiveSha256, 'Official archive bytes changed');
    command('python3', ['scripts/extract-ci-webview.py', archive, apk]);
    require(fileDigest(apk) === candidate.apkSha256, 'Extracted APK bytes changed');
    const tools = path.join(sdk, 'build-tools/36.0.0');
    const signature = command(path.join(tools, 'apksigner'), ['verify', '--verbose', '--print-certs', apk]);
    const badging = command(path.join(tools, 'aapt'), ['dump', 'badging', apk]);
    const manifest = command(path.join(tools, 'aapt'), ['dump', 'xmltree', apk, 'AndroidManifest.xml']);
    verifyMetadata(signature, badging, manifest);
    for (const [name, value] of Object.entries({ signature, badging, manifest })) fs.writeFileSync(path.join(output, name + '.txt'), value);
    // Chromium's Q+ removal helper targets Google/Trichrome and Chrome. We do
    // not execute it: only the single verified AOSP file below may be removed.
    safe(); run('root'); run('wait-for-device'); safe();
    state.status = 'preparing-overlay-storage'; save();
    captureStorage('before');
    configureScratch();
    run('disable-verity');
    // disable-verity can report overlay failure with exit zero; retain its logs before reboot.
    try {
      const diagnostics = collectOverlayFailureDiagnostics({ environment, sdkEnvironment: env, execute, now, userspaceOnly: true });
      fs.writeFileSync(path.join(output, 'overlay-pre-reboot-diagnostics.json'), JSON.stringify(diagnostics, null, 2) + '\n');
    } catch (diagnosticError) { state.preRebootDiagnosticError = String(diagnosticError.message).slice(0, 512); }
    safe(); run('reboot'); run('wait-for-device'); await boot();
    run('root'); run('wait-for-device'); safe();
    configureScratch(); // Non-persistent property is reset by reboot.
    const remount = run('remount');
    require(/remount succeeded/i.test(remount) && !/reboot/i.test(remount), 'Remount requires manual review');
    captureStorage('remounted');
    safe();
    require(stockPath(run('shell', 'pm', 'path', candidate.package), run('shell', 'dumpsys', 'package', candidate.package)) === stock, 'Stock path changed');
    require(run('shell', 'sha256sum', stock).trim().split(/\s+/)[0] === stockHash && fileDigest(backup) === stockHash && fileDigest(apk) === candidate.apkSha256, 'Provider bytes changed before removal');
    state.status = 'removing-exact-stock-file'; save();
    run('shell', 'stop');
    try {
      require(run('emu', 'avd', 'name').trim().split(/\r?\n/)[0] === 'test' && run('shell', 'getprop', 'ro.kernel.qemu').trim() === '1', 'Fixture changed while stopped');
      require(run('shell', 'sha256sum', stock).trim().split(/\s+/)[0] === stockHash, 'Stopped provider changed');
      run('shell', 'rm', stock);
    } finally { run('shell', 'start'); }
    await boot(); safe();
    require(!run('shell', 'pm', 'list', 'packages', candidate.package).trim(), 'Conflicting provider remains');
    command(path.join(sdk, 'platform-tools/adb'), ['-s', serial, 'install', '--no-incremental', apk], 120000);
    safe(true);
    run('shell', 'cmd', 'webviewupdate', 'set-webview-implementation', candidate.package);
    const selectionDeadline = now() + 60000;
    let selected = '', ready = false;
    while (now() < selectionDeadline) {
      safe(true); // Drift is never treated as a transient readiness failure.
      selected = run('shell', 'dumpsys', 'webviewupdate');
      fs.writeFileSync(path.join(output, 'provider-selected.txt'), selected);
      const relro = [...selected.matchAll(/Number of relros (?:started|finished): (\d+)/g)].map(m => Number(m[1]));
      ready = selected.includes(`Current WebView package (name, version): (${candidate.package}, ${candidate.version})`) &&
        selected.includes('WebView package dirty: false') && /is\s+installed\/enabled for all users/.test(selected) &&
        relro.length === 2 && relro[0] > 0 && relro[0] === relro[1];
      if (ready) break;
      await sleep(500);
    }
    require(ready, 'Provider selection/RELRO readiness deadline exceeded');
    const installed = run('shell', 'pm', 'path', candidate.package).trim();
    require(/^package:\/data\/app\/[A-Za-z0-9_./+=~-]+\.apk$/.test(installed), 'Unexpected installed provider path');
    require(run('shell', 'sha256sum', installed.slice(8)).trim().split(/\s+/)[0] === candidate.apkSha256, 'Installed provider bytes changed');
    state.status = 'PROVISIONED_RUNTIME_QUALIFICATION_PENDING'; save();
    // APKs are reproducible via pinned URL/hash; keep compact provenance in CI artifacts.
    fs.unlinkSync(archive); fs.unlinkSync(apk);
  } catch (error) {
    if (state.status === 'preparing-overlay-storage') {
      try {
        const diagnostics = collectOverlayFailureDiagnostics({ environment, sdkEnvironment: env, execute, now });
        fs.writeFileSync(path.join(output, 'overlay-failure-diagnostics.json'), JSON.stringify(diagnostics, null, 2) + '\n');
      } catch (diagnosticError) { state.diagnosticError = String(diagnosticError.message).slice(0, 512); }
    }
    state.failedAt = state.status; state.status = 'FAIL'; state.error = error.message; try { save(); } catch { /* Evidence failure must not replace the original provisioning error. */ } throw error; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
