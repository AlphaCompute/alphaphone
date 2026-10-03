import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { candidate } from '../scripts/prepare-ci-webview.mjs';
const smoke = path.resolve('scripts/android-smoke.mjs');
const app = 'ai.elizaresearch.alphaphone';
const methods = ['BrowserShareInstrumentedTest#exactCurrentPageChooserCancellationAndStalePageRejection', 'BrowserSensitiveReadingInstrumentedTest#sensitivePagesRejectBeforeReviewTokenOrOutboundSpeech', 'BrowserIsolatedReadingInstrumentedTest#pageWorldTamperingCannotForgeSafeReading', 'BrowserReadingNavigationInstrumentedTest#delayedSameOriginAndReloadReadyCannotAdoptOldDocument'];
function exercise(mode) {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-ci-provider-runner-'));
 try {
  fs.mkdirSync(path.join(dir, 'sdk/platform-tools'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'test-results/ci-webview-provider'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'bundle'));
  fs.writeFileSync(path.join(dir, 'app.config.json'), JSON.stringify({ appId: app }));
  fs.writeFileSync(path.join(dir, 'test-results/ci-webview-provider/result.json'), JSON.stringify({ status: 'PROVISIONED_RUNTIME_QUALIFICATION_PENDING', candidate }));
  const manifest = {};
  for (const variant of ['standalone', 'launcher']) for (const kind of ['debug', 'androidTest']) {
   const name = `${variant}-${kind}.apk`, bytes = Buffer.from(name);
   fs.writeFileSync(path.join(dir, 'bundle', name), bytes); manifest[name] = createHash('sha256').update(bytes).digest('hex');
  }
  fs.writeFileSync(path.join(dir, 'bundle/apk-manifest.json'), JSON.stringify(manifest));
  const rows = methods.map(method => [method, 0]);
  if (mode === 'skip') rows[0][1] = -4;
  if (mode === 'skip-sensitive') rows[1][1] = -4;
  if (mode === 'duplicate') rows[1] = rows[0];
  if (mode === 'wrong-count') rows.pop();
  const emit = items => items.flatMap(([selector,code]) => {
   const [cls,method] = selector.split('#');
   return [`INSTRUMENTATION_STATUS: class=${app}.${cls}`, `INSTRUMENTATION_STATUS: test=${method}`, `INSTRUMENTATION_STATUS_CODE: ${code}`];
  });
  // A shell-only fake avoids launching a new Node runtime for every readback.
  const fake = `#!/bin/sh
shift 2
printf '%s\\n' "$*" >> commands.jsonl
case "$*" in
 'emu avd name') printf 'test\\nOK\\n';;
 'shell getprop ro.kernel.qemu') echo 1;;
 'shell getprop ro.build.type') echo userdebug;;
 'shell am get-current-user') echo 0;;
 'shell pm list users') echo 'UserInfo{0:Owner:4c13}';;
 'shell dumpsys power') echo 'mWakefulness=Awake';;
 'shell dumpsys window policy') printf '%s\\n' KeyguardStateMonitor mCurrentUserId=0 showing=false mIsShowing=false inputRestricted=false mInputRestricted=false secure=false systemIsReady=true bootCompleted=true screenState=SCREEN_STATE_ON;;
 'shell dumpsys webviewupdate') echo 'Current WebView package (name, version): (${candidate.package}, ${candidate.version})';;
 'shell pm path ${candidate.package}') echo package:/data/app/fixture/base.apk;;
 'shell sha256sum '*) echo '${candidate.apkSha256} /data/app/fixture/base.apk';;
 'shell cmd role get-role-holders android.app.role.HOME') if test -f role; then cat role; else echo com.android.launcher3; fi;;
 'shell cmd package set-home-activity '*) echo '${app}' > role;;
 'shell am instrument '*browserIsolatedReading*)
  test "$*" = 'shell am instrument -w -r -e class ${methods.map(x => app+'.'+x.split('#')[0]).join(',')} -e browserIsolatedReading 1 -e browserSensitiveReading 1 -e browserShareLive 1 ${app}.test/androidx.test.runner.AndroidJUnitRunner' || exit 7
  printf '%s\\n' ${emit(rows).map(x => "'"+x+"'").join(' ')} 'OK (4 tests)';;
 'shell am instrument '*) printf '%s\\n' ${emit([['OrdinarySuite#case',0],['ClockHandoffInstrumentedTest#visibleReviewConstructsFourStandardClockIntentsWithoutDeliveringThem',1],['ClockHandoffInstrumentedTest#visibleReviewConstructsFourStandardClockIntentsWithoutDeliveringThem',0],['RealClockInstrumentedTest#realClockSetFireSnoozeDismissAndDelete',-4]]).map(x => "'"+x+"'").join(' ')} 'OK (3 tests)';;
 'shell dumpsys activity activities') echo 'mResumedActivity: ${app}';;
 'shell cat /sdcard/'*) echo '<nodes text="Open conversation" text="Calendar" text="Camera" text="Notes" text="Settings"/>';;
 install*|'shell am force-stop '*|'shell am start '*|'shell input '*|'shell uiautomator '*|'shell cmd role add-role-holder '*|'exec-out screencap -p') :;;
 *) echo 'Unexpected fake command' >&2; exit 9;;
esac
`;
  const adb = path.join(dir, 'sdk/platform-tools/adb'); fs.writeFileSync(adb, fake, { mode: 0o755 });
  const result = spawnSync(process.execPath, [smoke], { cwd: dir, env: { ...process.env, ANDROID_HOME: path.join(dir, 'sdk'), JAVA_HOME: dir, ANDROID_SERIAL: 'emulator-5554', GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted', ALPHA_BUILD_ARCHIVE: path.join(dir, 'bundle'), ALPHA_SMOKE_RESULTS: path.join(dir, 'output') }, encoding: 'utf8', timeout: 20000 });
  assert.equal(result.signal, null, result.stderr);
  const phases = ['standalone', 'launcher'].map(v => JSON.parse(fs.readFileSync(path.join(dir, `output/${v}-provider-qualification/result.json`))));
  const summary = JSON.parse(fs.readFileSync(path.join(dir, 'output/result.json')));
  const commands = fs.readFileSync(path.join(dir, 'commands.jsonl'), 'utf8').trim().split('\n').map(x=>x.split(' '));
  return { code: result.status, stderr: result.stderr, phases, summary, commands };
 } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
test('smoke invokes four actual opt-in classes before each unchanged ordinary suite', () => {
 const r=exercise('pass'); assert.equal(r.code,0,r.stderr);assert.equal(r.summary.status,'passed');
 assert.deepEqual(r.phases.map(p=>p.passed),[true,true]);
 for(const p of r.phases){assert.equal(p.cases.length,4);assert.deepEqual(p.providerBefore,p.providerAfter);assert.equal(Object.keys(p.artifactHashes).length,4);}
 const runs=r.commands.filter(a=>a.includes('instrument'));assert.equal(runs.length,4);assert.deepEqual(runs.map(a=>a.includes('browserIsolatedReading')),[true,false,true,false]);assert.deepEqual(runs.map(a=>a.includes('browserSensitiveReading')),[true,false,true,false]);assert.deepEqual(runs.map(a=>a.includes('browserShareLive')),[true,false,true,false]);assert.deepEqual(runs.map(a=>a.includes('clockHandoff')),[false,true,false,true]);assert.ok(runs.every(a=>!a.includes('realClock')&&!a.includes('clockExclusive')));
});
for(const mode of ['skip','skip-sensitive','duplicate','wrong-count'])test(`qualification rejects ${mode} while retaining both variant outcomes`,()=>{
 const r=exercise(mode);assert.notEqual(r.code,0);assert.equal(r.summary.status,'failed');assert.deepEqual(r.phases.map(p=>p.passed),[false,false]);
});
