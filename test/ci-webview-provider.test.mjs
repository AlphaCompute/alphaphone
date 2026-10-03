import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { candidate, requireProviderFixture, stockPath, verifyMetadata } from '../scripts/prepare-ci-webview.mjs';

const env = { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted', ANDROID_SERIAL: 'emulator-5554' };
const responses = {
  "shell cat /proc/bootconfig": "androidboot.boot_devices = \"pci0000:00/0000:00:03.0 pci0000:00/0000:00:05.0 pci0000:00/0000:00:06.0\"",
  "shell getprop ro.boot.boot_devices": "pci0000:00/0000:00:03.0 pci0000:00/0000:00:05.0 pci0000:00/0000:00:06.0",
  "shell readlink -f /dev/block/by-name/vdc": "/dev/block/vdc",
  "shell readlink -f /sys/class/block/vdc": "/sys/devices/pci0000:00/0000:00:05.0/virtio3/block/vdc",
  "shell readlink -f /sys/class/block/vda": "/sys/devices/pci0000:00/0000:00:03.0/virtio1/block/vda",
  "shell readlink -f /sys/class/block/vdd": "/sys/devices/pci0000:00/0000:00:06.0/virtio4/block/vdd",

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
import { main, collectOverlayFailureDiagnostics } from '../scripts/prepare-ci-webview.mjs';

async function simulate({ drift, neverBoot = false, neverReady = false, remountChannel = 'stdout', remountStatus = 0, remountSignal = null } = {}) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-provider-sequence-'));
  const output = path.join(parent, 'evidence'), calls = [];
  let elapsed = 0, installed = false, removed = false, stopped = false, rebooted = false, offline = 0, selectionReads = 0;
  const stock = '/product/app/webview/webview.apk', stockHash = 'a'.repeat(64);
  const signature = `Verified using v2 scheme (APK Signature Scheme v2): true\nSigner #1 certificate SHA-256 digest: ${candidate.certificateSha256}`;
  const badging = `package: name='com.android.webview' versionCode='808300007' versionName='157.0.8083.0'\nsdkVersion:'29'\ntargetSdkVersion:'37'\nnative-code: 'x86_64'`;
  let scratch = '', backingAlias = '/dev/block/vdc', remounts = 0, reboots = 0;
  const execute = (file, args, options) => {
    const name = path.basename(file);
    if (name === 'curl') { const fd = fs.openSync(args.at(-1), 'wx'); fs.ftruncateSync(fd, candidate.size); fs.closeSync(fd); return ''; }
    if (name === 'python3') { fs.writeFileSync(args.at(-1), 'candidate'); return ''; }
    if (name === 'apksigner') return signature;
    if (name === 'aapt') return args.includes('badging') ? badging : 'com.android.webview.WebViewLibrary libwebviewchromium.so';
    assert.equal(name, 'adb'); assert.deepEqual(args.slice(0, 2), ['-s', 'emulator-5554']);
    const a = args.slice(2), key = a.join(' '); calls.push(key);
    if (['shell cat /proc/bootconfig','shell getprop ro.boot.boot_devices','shell readlink -f /sys/class/block/vdc','shell readlink -f /sys/class/block/vda','shell readlink -f /sys/class/block/vdd'].includes(key)) { assert.ok(options.timeout > 0 && options.timeout <= 2000); if(drift==='boot-budget')elapsed+=4000; }
    if (key === 'reboot') { reboots++; rebooted = true; offline = 1; scratch = ''; backingAlias = '/dev/block/vdc'; return ''; }
    if (key === 'shell getprop sys.boot_completed') {
      if (offline-- > 0 || neverBoot || (drift==='overlay-never-boot'&&reboots>1)) throw Error('device offline');
      return '1';
    }
    if (key.startsWith('shell service check ')) return `Service ${a.at(-1)}: found`;
    if (key === 'shell dmctl list devices') return `Available Device Mapper Devices:\n${rebooted || drift === 'cached-scratch' ? 'scratch : 254:5\n' : ''}`;
    if (key === 'shell ls -1 /sys/dev/block/254:5/slaves') return drift === 'super-scratch' ? 'vda2' : 'vdc';
    if (key === 'shell cat /sys/dev/block/254:5/dm/name') return 'scratch';
    if (key === 'shell cat /sys/dev/block/254:5/size' && drift==='overlay-before-size')return '92280';
    if (key === 'shell cat /sys/dev/block/254:5/size' && drift==='overlay-size' && reboots>1)return '92280';
    if (key === 'shell cat /sys/dev/block/254:5/size') return drift === 'small-scratch' || drift === 'cached-scratch' ? '92280' : '1048576';
    if (key === 'shell getprop ro.build.fingerprint') return 'Android/sdk_phone64_x86_64/emu64x:15/AE3A.240806.019/12368160:userdebug/test-keys';
    if (key === 'shell cat /proc/mounts') return '/dev/block/dm-43 /data ext4 rw 0 0';
    if (key === 'shell cat /sys/class/block/dm-43/dm/name') return 'userdata';
    if (key === 'shell ls -1 /sys/class/block/dm-43/slaves') return drift === 'backing-device' ? 'vdd' : 'vdc';
    if (key === 'shell cat /sys/class/block/vdc/dev') return '253:32';
    if (key === 'shell stat -c %t:%T /dev/block/vdc') return 'fd:20';
    if (key === 'shell test -b /dev/block/vdc') return '';
    if (key.startsWith('shell sh -c ') && drift==='overlay-alias' && reboots>1)return '/dev/block/vdd';
    if (key.startsWith('shell sh -c ')) return drift === 'backing-alias' ? '/dev/block/vdd' : backingAlias;
    if (key === 'shell ln -sT /dev/block/vdc /dev/block/by-name/vdc') { assert.equal(backingAlias, 'MISSING'); backingAlias = '/dev/block/vdc'; return ''; }
    if (key === 'shell readlink -f /dev/block/by-name') return '/dev/block/by-name';
    if (key === 'shell readlink -f /dev/block/by-name/vdc') return drift==='boot-alias' || (drift==='boot-alias-after-reboot'&&rebooted) ? '/dev/block/by-name/vdc' : '/dev/block/vdc';
    if (key==='shell cat /proc/bootconfig' && drift==='boot-config') return 'androidboot.boot_devices = "wrong"';
    if (key === 'shell getprop fs_mgr.overlayfs.data_scratch_size_mb') return drift === 'scratch-existing' ? '2048' : drift === 'scratch-unapplied' ? '' : scratch;
    if (key === 'shell setprop fs_mgr.overlayfs.data_scratch_size_mb 512') { scratch = '512'; return ''; }
    if (['shell df -k /data /metadata /product', 'shell cat /proc/mounts', 'shell cat /proc/partitions', 'shell lpdump', 'shell dmesg'].includes(key)) return 'synthetic bounded storage diagnostics';
    if (key === 'remount' && drift === 'remount-failed') { const failure = new Error('remount failed'); failure.stderr = 'Failed to map scratch; make f2fs return=65280'; throw failure; }
    if (key === 'remount') {
      remounts++;
      if (['overlay-reboot','overlay-repeat','overlay-identity','overlay-stock','overlay-size','overlay-alias','overlay-before-size','overlay-never-boot'].includes(drift) && (remounts===1||drift==='overlay-repeat'))return fs.readFileSync('test/fixtures/remount-52ab-overlay-reboot.txt','utf8');
      if(drift==='overlay-unknown')return 'Remount succeeded\nNow reboot your device for settings to take effect\nAnother reboot is required\n';
      return drift === 'remount' ? 'reboot required' : 'remount succeeded';
    }
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
    if (key.startsWith('shell sha256sum ')) return `${installed ? candidate.apkSha256 : ((drift === 'stock' && rebooted) || (drift === 'overlay-stock' && reboots>1) || (drift === 'stopped-stock' && stopped)) ? 'b'.repeat(64) : stockHash}  ${a.at(-1)}`;
    if (key === 'shell pm list packages com.android.webview') return removed ? '' : 'package:com.android.webview';
    if (key === 'shell pm list packages -3') return installed ? 'package:com.android.webview' : '';
    if (key === 'emu avd name' && ((drift === 'identity' && rebooted)||(drift==='overlay-identity'&&reboots>1))) return 'personal';
    assert.ok(key in responses, `Unexpected command: ${key}`);
    return responses[key];
  };
  let error;
  try {
    await main({ environment: { ...env, ALPHA_DISPOSABLE_WEBVIEW_FIXTURE: 'api35-default-x86_64' }, execute, executeRemount: (file, args, options) => {
        const text = execute(file, args, options);
        return { status: remountStatus, signal: remountSignal, stdout: remountChannel === 'stdout' ? text : '', stderr: remountChannel === 'stderr' ? text : '' };
      },
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
  assert.ok(r.calls.indexOf('shell logcat -d -b all -t 400') < r.calls.indexOf('reboot'));
  assert.equal(r.calls.filter(c => c === 'shell setprop fs_mgr.overlayfs.data_scratch_size_mb 512').length, 2);
  assert.ok(r.calls.indexOf('shell setprop fs_mgr.overlayfs.data_scratch_size_mb 512') < r.calls.indexOf('disable-verity'));
  assert.equal(r.calls.filter(c => c === 'shell ln -sT /dev/block/vdc /dev/block/by-name/vdc').length, 0);
  assert.equal(r.result.bootDeviceAdmissions.length, 3);
  assert.equal(r.result.scratchBackingAliases.length, 2);
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

test('scratch policy refuses drift before verity or provider mutations', async () => {
  for (const drift of ['scratch-existing', 'scratch-unapplied']) {
    const r = await simulate({ drift });
    assert.match(r.error.message, /scratch size policy|Scratch size policy/);
    assert.equal(r.calls.includes('disable-verity'), false);
    assert.equal(r.removed, false); assert.equal(r.installed, false);
  }
});
test('remount failure preserves cause and collects bounded read-only storage evidence', async () => {
  const r = await simulate({ drift: 'remount-failed' });
  assert.match(r.error.message, /remount failed/);
  assert.equal(r.result.failedAt, 'preparing-overlay-storage');
  assert.equal(r.removed, false); assert.equal(r.installed, false);
  const failed = r.result.commands.find(c => !c.success && c.args.at(-1) === 'remount');
  assert.match(failed.stderr, /make f2fs return=65280/);
  assert.equal(r.calls.filter(c => c === 'shell dmesg').length, 2);
});


test('diagnostics re-admit every query with finite time and output bounds', () => {
 let elapsed=0, admissions=0;
 const result=collectOverlayFailureDiagnostics({environment:env,sdkEnvironment:{ANDROID_HOME:'/sdk'},now:()=>elapsed,hostPaths:{fixture:'/owned'},statfs:()=>({bavail:3,bfree:4,bsize:4096}),execute:(file,args,options)=>{
  assert.ok(options.timeout>0&&options.timeout<=2000);assert.equal(options.maxBuffer,256*1024);
  const key=args.slice(2).join(' ');
  if(key in responses){if(key==='shell dumpsys activity processes')admissions++;return responses[key];}
  assert.equal(admissions,1);admissions--;assert.ok(!/remount|setprop|reboot|mkfs| rm /.test(key));elapsed+=3000;return 'gsid scratch detail\n'.repeat(6000);
 }});
 assert.equal(result.host.fixture.availableBytes,12288);
 for(const v of Object.values(result.guest))if(typeof v==='string')assert.ok(v.length<=65536);
 assert.match(result.admissionStopped,/deadline/);assert.ok(elapsed<=21000);
});
test('diagnostics reject drift before device details and retain host errors',()=>{
 const result=collectOverlayFailureDiagnostics({environment:env,sdkEnvironment:{ANDROID_HOME:'/sdk'},hostPaths:{bad:'/absent'},statfs:()=>{throw Error('unavailable');},execute:(file,args)=>{assert.equal(args.slice(2).join(' '),'emu avd name');return 'personal';}});
 assert.ok(result.admissionStopped);assert.deepEqual(result.guest,{});assert.equal(result.host.bad.unavailable,'unavailable');
});

test('stock backup failure retains original error, provenance and bounded read-only evidence', async () => {
  for (const mode of ['normal', 'drift', 'expired']) {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-diagnostic-'));
    const output = path.join(parent, 'evidence'), calls = [];
    let failed = false, tick = 0;
    const original = Object.assign(new Error('pull failure'), { status: 1, signal: null, code: null, stdout: '', stderr: '' });
    const execute = (file, args, opts) => {
      assert.equal(path.basename(file), 'adb');
      const a = args.slice(2), key = a.join(' '); calls.push(key);
      if (a[0] === 'pull') {
        assert.equal(opts.timeout, 20000);
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, 'result.json'))).stock, { path: '/product/app/webview/webview.apk', sha256: 'a'.repeat(64) });
        fs.writeFileSync(a[2], 'partial'); failed = true; tick += 13; throw original;
      }
      if (failed) { assert.ok(opts.timeout > 0 && opts.timeout <= 2000); if (mode === 'drift' && key === 'emu avd name') return 'personal'; }
      if (key in responses) return responses[key];
      if (key === 'shell pm path com.android.webview') return 'package:/product/app/webview/webview.apk';
      if (key === 'shell dumpsys package com.android.webview') return 'versionName=124.0.6367.219';
      if (key === 'shell sha256sum /product/app/webview/webview.apk') return 'a'.repeat(64);
      assert.ok(['version', 'get-state', 'shell getprop ro.build.fingerprint', 'shell stat -c %s /product/app/webview/webview.apk', 'shell df -k /data /metadata /product'].includes(key), key);
      return 'readonly evidence';
    };
    try {
      await assert.rejects(main({ environment: { ...env, ALPHA_DISPOSABLE_WEBVIEW_FIXTURE: 'api35-default-x86_64' }, sdkEnvironment: { ANDROID_HOME: parent }, outputDirectory: output, execute, now: () => { if (failed && mode === 'expired') tick += 25000; return tick; } }), e => e === original);
      const r = JSON.parse(fs.readFileSync(path.join(output, 'result.json'))), d = JSON.parse(fs.readFileSync(path.join(output, 'stock-backup-failure-diagnostics.json')));
      assert.equal(r.status, 'FAIL'); assert.equal(r.failedAt, 'preflight');
      const pull = r.commands.find(c => c.args[2] === 'pull');
      assert.equal(pull.status, 1); assert.equal(pull.signal, null); assert.equal(pull.code, null); assert.ok(pull.durationMilliseconds >= 13);
      assert.equal(d.host.partialBackupBytes, 7); assert.equal(d.budgetMilliseconds, 20000); assert.ok(Object.hasOwn(d.host, 'imageSourceProperties'));
      assert.equal(calls.filter(c => c.startsWith('pull ')).length, 1);
      if (mode === 'normal') assert.deepEqual(Object.keys(d.guest), ['adbVersion', 'deviceState', 'fingerprint', 'stockStat', 'capacity']);
      else { assert.ok(d.admissionStopped); assert.deepEqual(d.guest, {}); }
      assert.ok(!calls.some(c => /^(root|remount|reboot|install|shell (rm|setprop|stop|start))\b/.test(c)));
    } finally { fs.rmSync(parent, { recursive: true, force: true }); }
  }
});

test('provider preparation refuses userdata or alias drift before verity/provider changes', async () => {
  for (const drift of ['backing-device', 'backing-alias']) {
    const r = await simulate({ drift });
    assert.ok(r.error);
    assert.equal(r.calls.includes('disable-verity'), false);
    assert.equal(r.calls.some(call => call.startsWith('shell ln ')), false);
    assert.equal(r.removed, false); assert.equal(r.installed, false);
  }
});

test('cached or undersized scratch never qualifies provider replacement', async () => {
  for (const drift of ['cached-scratch', 'small-scratch', 'super-scratch']) {
    const r = await simulate({ drift });
    assert.match(r.error.message, /Existing scratch|512MiB data scratch|proven userdata backing/);
    assert.equal(r.removed, false); assert.equal(r.installed, false);
    if (drift === 'cached-scratch') {
      assert.equal(r.calls.includes('disable-verity'), false);
      assert.equal(r.calls.some(call => call.startsWith('shell ln ')), false);
    }
  }
});

test('one authenticated requested overlay activation reboot completes provider flow', async()=>{
 const r=await simulate({drift:'overlay-reboot'});assert.ifError(r.error);assert.equal(r.result.status,'PROVISIONED_RUNTIME_QUALIFICATION_PENDING');assert.equal(r.calls.filter(c=>c==='reboot').length,2);assert.equal(r.calls.filter(c=>c==='remount').length,2);assert.equal(r.result.scratchBackingAliases.length,3);assert.equal(r.result.scratchBytes,512*1024*1024);assert.equal(r.installed,true);
});
test('requested overlay reboot refuses repeat, unknown wording, changed identity, stock, backing and size',async()=>{
 for(const drift of ['overlay-repeat','overlay-unknown','overlay-identity','overlay-stock','overlay-size','overlay-alias','overlay-before-size','overlay-never-boot']){
  const r=await simulate({drift});assert.ok(r.error,drift);assert.equal(r.installed,false,drift);assert.equal(r.removed,false,drift);assert.ok(r.calls.filter(c=>c==='reboot').length<=2,drift);
 }
});

test('stderr-only remount transcript follows the bounded overlay reboot flow', async () => {
 const r=await simulate({drift:'overlay-reboot',remountChannel:'stderr'});assert.ifError(r.error);
 assert.equal(r.calls.filter(c=>c==='reboot').length,2);assert.equal(r.calls.filter(c=>c==='remount').length,2);
 assert.match(r.result.overlayRemountOutputs[0],/Now reboot your device/);assert.equal(r.result.scratchBytes,512*1024*1024);assert.equal(r.installed,true);
});
test('successful-looking remount stderr never overrides failed exit or termination', async () => {
 for(const option of [{remountStatus:1},{remountStatus:null,remountSignal:'SIGTERM'}]){
  const r=await simulate({remountChannel:'stderr',...option});assert.match(r.error.message,/remount failed/);assert.equal(r.removed,false);assert.equal(r.installed,false);
  const failed=r.result.commands.find(c=>!c.success&&c.args.at(-1)==='remount');assert.match(failed.stderr,/remount succeeded/);
 }
});

test('boot identity drift refuses before provider effects and never creates a late alias',async()=>{
 for(const drift of ['boot-alias','boot-config','boot-alias-after-reboot','boot-budget']){
  const r=await simulate({drift});assert.ok(r.error);assert.equal(r.removed,false);assert.equal(r.installed,false);
  assert.ok(!r.calls.some(call=>call.startsWith('shell ln')));
  if(drift!=='boot-budget'){assert.ok(r.result.bootDeviceReadbacks.length>0);if(drift==='boot-config')assert.equal(r.result.bootDeviceReadbacks[0].bootconfig,'androidboot.boot_devices = "wrong"');}
  if(drift!=='boot-alias-after-reboot')assert.ok(!r.calls.includes('disable-verity'));
 }
});
