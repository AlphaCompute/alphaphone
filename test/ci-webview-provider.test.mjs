import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { candidate, requireProviderFixture, stockPath, verifyMetadata } from '../scripts/prepare-ci-webview.mjs';

const env = { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted', ANDROID_SERIAL: 'emulator-5554' };
const responses = {
  'emu avd name': 'test\nOK', 'shell getprop ro.kernel.qemu': '1',
  'shell getprop ro.build.type': 'userdebug', 'shell am get-current-user': '0',
  'shell pm list users': 'Users:\nUserInfo{0:Owner:4c13}',
  'shell getprop ro.build.version.sdk': '35', 'shell getprop ro.product.cpu.abi': 'x86_64',
  'shell getprop ro.build.flavor': 'sdk_phone64_x86_64-userdebug',
  'shell pm list packages -3': '', 'shell pm list packages': 'package:com.android.webview',
  'shell dumpsys activity processes': 'ACTIVITY MANAGER RUNNING PROCESSES',
};
test('provider admission rejects wrong fixtures before any mutation', () => {
  for (const [key, value] of Object.entries({
    'emu avd name': 'personal', 'shell getprop ro.kernel.qemu': '0',
    'shell getprop ro.build.type': 'user', 'shell am get-current-user': '10',
    'shell pm list users': 'UserInfo{0:Owner:4c13}\nUserInfo{10:Other:4}',
    'shell getprop ro.build.version.sdk': '34', 'shell getprop ro.product.cpu.abi': 'arm64-v8a',
    'shell getprop ro.build.flavor': 'sdk_gphone_x86_64-userdebug',
    'shell pm list packages -3': 'package:personal.app',
    'shell pm list packages': 'package:com.google.android.gms',
    'shell dumpsys activity processes': 'ACTIVITY MANAGER ActiveInstrumentation{',
  })) {
    const observed = [];
    assert.throws(() => requireProviderFixture((...args) => { const command = args.join(' '); observed.push(command); assert.ok(command in responses, 'Unexpected device operation'); return command === key ? value : responses[command]; }, env));
    assert.ok(observed.length > 0);
  }
  assert.throws(() => requireProviderFixture(() => assert.fail('device access'), { ...env, RUNNER_ENVIRONMENT: 'self-hosted' }));
  requireProviderFixture((...args) => responses[args.join(' ')], env);
});
test('stock provider removal admits one known AOSP file only', () => {
  const dump = 'versionName=124.0.6367.219';
  assert.equal(stockPath('package:/product/app/webview/webview.apk', dump), '/product/app/webview/webview.apk');
  for (const paths of ['package:/data/app/webview.apk', 'package:/product/app/webview/../other.apk', 'package:/product/app/Chrome/Chrome.apk', 'package:/product/app/webview/a.apk\npackage:/product/app/webview/b.apk']) assert.throws(() => stockPath(paths, dump));
  assert.throws(() => stockPath('package:/product/app/webview/webview.apk', dump + ' UPDATED_SYSTEM_APP'));
});
test('provider provenance rejects altered signer ABI and dependency metadata', () => {
  const sig = `Verified using v2 scheme (APK Signature Scheme v2): true\nSigner #1 certificate SHA-256 digest: ${candidate.certificateSha256}`;
  const badge = `package: name='com.android.webview' versionCode='808300007' versionName='157.0.8083.0'\nsdkVersion:'29'\ntargetSdkVersion:'37'\nnative-code: 'x86' 'x86_64'`;
  const manifest = 'com.android.webview.WebViewLibrary libwebviewchromium.so';
  verifyMetadata(sig, badge, manifest);
  assert.throws(() => verifyMetadata(sig.replace(candidate.certificateSha256, '0'.repeat(64)), badge, manifest));
  assert.throws(() => verifyMetadata(sig, badge.replace('x86_64', 'arm64-v8a'), manifest));
  assert.throws(() => verifyMetadata(sig, badge, manifest + ' E: uses-static-library'));
  assert.match(candidate.archiveSha256, /^[a-f0-9]{64}$/); assert.match(candidate.apkSha256, /^[a-f0-9]{64}$/);
  const source = fs.readFileSync('scripts/prepare-ci-webview.mjs', 'utf8');
  assert.ok(!source.includes("run('shell', 'rm', '-r'"));
});

import os from 'node:os';
import path from 'node:path';
import { main } from '../scripts/prepare-ci-webview.mjs';

async function simulate({ drift, neverBoot = false, neverReady = false } = {}) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-provider-sequence-'));
  const output = path.join(parent, 'evidence'), calls = [];
  let elapsed = 0, installed = false, removed = false, stopped = false, rebooted = false, offline = 0, selectionReads = 0;
  const stock = '/product/app/webview/webview.apk', stockHash = 'a'.repeat(64);
  const signature = `Verified using v2 scheme (APK Signature Scheme v2): true\nSigner #1 certificate SHA-256 digest: ${candidate.certificateSha256}`;
  const badging = `package: name='com.android.webview' versionCode='808300007' versionName='157.0.8083.0'\nsdkVersion:'29'\ntargetSdkVersion:'37'\nnative-code: 'x86_64'`;
  const execute = (file, args) => {
    const name = path.basename(file);
    if (name === 'curl') { const fd = fs.openSync(args.at(-1), 'wx'); fs.ftruncateSync(fd, candidate.size); fs.closeSync(fd); return ''; }
    if (name === 'python3') { fs.writeFileSync(args.at(-1), 'candidate'); return ''; }
    if (name === 'apksigner') return signature;
    if (name === 'aapt') return args.includes('badging') ? badging : 'com.android.webview.WebViewLibrary libwebviewchromium.so';
    assert.equal(name, 'adb'); assert.deepEqual(args.slice(0, 2), ['-s', 'emulator-5554']);
    const a = args.slice(2), key = a.join(' '); calls.push(key);
    if (key === 'reboot') { rebooted = true; offline = 1; return ''; }
    if (key === 'shell getprop sys.boot_completed') {
      if (offline-- > 0 || neverBoot) throw Error('device offline');
      return '1';
    }
    if (key.startsWith('shell service check ')) return `Service ${a.at(-1)}: found`;
    if (key === 'remount') return drift === 'remount' ? 'reboot required' : 'remount succeeded';
    if (['root', 'wait-for-device', 'disable-verity'].includes(key)) return '';
    if (key === 'shell stop') { stopped = true; return ''; }
    if (key === 'shell start') { stopped = false; return ''; }
    if (key === `shell rm ${stock}`) { assert.equal(stopped, true); removed = true; return ''; }
    if (a[0] === 'pull') { fs.writeFileSync(a[2], 'stock'); return ''; }
    if (a[0] === 'install') { assert.equal(removed, true); assert.equal(stopped, false); installed = true; return 'Success'; }
    if (key === 'shell cmd webviewupdate set-webview-implementation com.android.webview') return 'Success';
    if (key === 'shell dumpsys webviewupdate') {
      selectionReads++;
      return `Current WebView package (name, version): (com.android.webview, 157.0.8083.0)\nWebView package dirty: ${neverReady || selectionReads < 2}\nNumber of relros started: 1\nNumber of relros finished: ${neverReady || selectionReads < 2 ? 0 : 1}\nis installed/enabled for all users`;
    }
    if (key === 'shell pm path com.android.webview') return installed ? 'package:/data/app/provider/base.apk' : `package:${stock}`;
    if (key === 'shell dumpsys package com.android.webview') return 'versionName=124.0.6367.219';
    if (key.startsWith('shell sha256sum ')) return `${installed ? candidate.apkSha256 : ((drift === 'stock' && rebooted) || (drift === 'stopped-stock' && stopped)) ? 'b'.repeat(64) : stockHash}  ${a.at(-1)}`;
    if (key === 'shell pm list packages com.android.webview') return removed ? '' : 'package:com.android.webview';
    if (key === 'shell pm list packages -3') return installed ? 'package:com.android.webview' : '';
    if (key === 'emu avd name' && drift === 'identity' && rebooted) return 'personal';
    assert.ok(key in responses, `Unexpected command: ${key}`);
    return responses[key];
  };
  let error;
  try {
    await main({ environment: { ...env, ALPHA_DISPOSABLE_WEBVIEW_FIXTURE: 'api35-default-x86_64' }, execute,
      sdkEnvironment: { ANDROID_HOME: '/sdk' }, outputDirectory: output,
      now: () => elapsed, sleep: async ms => { elapsed += ms; },
      fileDigest: f => path.basename(f) === 'chromium.zip' ? candidate.archiveSha256 : path.basename(f) === 'SystemWebView.apk' ? candidate.apkSha256 : stockHash });
  } catch (caught) { error = caught; }
  const result = JSON.parse(fs.readFileSync(path.join(output, 'result.json')));
  fs.rmSync(parent, { recursive: true, force: true });
  return { calls, result, error, stopped, removed, installed, selectionReads, elapsed };
}
test('full provider command sequence survives one offline reboot and delayed RELRO', async () => {
  const r = await simulate(); assert.ifError(r.error);
  assert.equal(r.result.status, 'PROVISIONED_RUNTIME_QUALIFICATION_PENDING');
  assert.equal(r.result.runtimeFeaturesQualified, false);
  assert.equal(r.selectionReads, 2); assert.equal(r.stopped, false);
  assert.ok(r.calls.indexOf('shell stop') < r.calls.indexOf('shell rm /product/app/webview/webview.apk'));
  assert.ok(r.calls.indexOf('shell rm /product/app/webview/webview.apk') < r.calls.indexOf('shell start'));
});
test('provider main refuses identity stock and remount drift before deletion/install', async () => {
  for (const drift of ['identity', 'stock', 'remount']) {
    const r = await simulate({ drift }); assert.ok(r.error); assert.equal(r.removed, false); assert.equal(r.installed, false);
    assert.equal(r.result.status, 'FAIL');
  }
});
test('offline boot and incomplete RELRO have fixed deadlines', async () => {
  const offline = await simulate({ neverBoot: true });
  assert.match(offline.error.message, /boot deadline/); assert.equal(offline.elapsed, 180000); assert.equal(offline.removed, false);
  const relro = await simulate({ neverReady: true });
  assert.match(relro.error.message, /RELRO readiness deadline/); assert.equal(relro.result.status, 'FAIL');
  assert.equal(relro.elapsed, 61000); assert.equal(relro.result.runtimeFeaturesQualified, false);
});

test('framework starts again when stopped-provider hash check refuses deletion', async () => {
  const r = await simulate({ drift: 'stopped-stock' });
  assert.match(r.error.message, /Stopped provider changed/);
  assert.equal(r.stopped, false); assert.equal(r.removed, false);
  assert.ok(r.calls.includes('shell start')); assert.equal(r.installed, false);
});
