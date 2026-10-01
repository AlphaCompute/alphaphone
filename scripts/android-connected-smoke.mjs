/** Explicit opt-in matrix: real development agent plus camera denial/recovery. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { androidEnv } from './toolchain.mjs';

const env = androidEnv();
const serial = process.env.ANDROID_SERIAL;
if (!/^emulator-\d+$/.test(serial || '')) throw new Error('Set ANDROID_SERIAL to the disposable phone emulator.');
if (!process.env.ALPHA_DEV_TOKEN_FILE || !fs.statSync(process.env.ALPHA_DEV_TOKEN_FILE).isFile())
  throw new Error('Set ALPHA_DEV_TOKEN_FILE to the running development agent token file.');
const adb = path.join(env.ANDROID_HOME, 'platform-tools/adb');
const appId = JSON.parse(fs.readFileSync('app.config.json')).appId;
const out = process.env.ALPHA_CONNECTED_RESULTS || 'test-results/android-connected';
fs.mkdirSync(out, {recursive:true});
const manifest = JSON.parse(fs.readFileSync('artifacts/apk-manifest.json'));
const classes = [
  `${appId}.CameraFlowInstrumentedTest#denyingCameraAllowsExplicitRetryWithoutFakePreview`,
  `${appId}.LiveAgentInstrumentedTest`,
  `${appId}.PrototypeFlowInstrumentedTest#realAgentProposalRequiresApprovalInReferenceConversation`,
].join(',');
const results = [];
const run = (...args) => execFileSync(adb, ['-s', serial, ...args], {env,encoding:'utf8',timeout:300000});
for (const variant of ['standalone','launcher']) {
  const apk = `artifacts/${variant}-debug.apk`;
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex');
  if (!manifest.results.some(row => row.file === apk && row.sha256 === sha256))
    throw new Error(`APK does not match build manifest: ${variant}`);
  let passed = false, error;
  try {
    run('install','-r',apk);
    run('install','-r',`android/app/build/outputs/apk/androidTest/${variant}/debug/app-${variant}-debug-androidTest.apk`);
    execFileSync(process.execPath,['scripts/configure-dev-agent.mjs'], {
      env:{...env,...process.env,ADB:adb,ANDROID_SERIAL:serial},stdio:'ignore',timeout:30000,
    });
    run('shell','pm','revoke',appId,'android.permission.CAMERA');
    run('shell','pm','clear-permission-flags',appId,'android.permission.CAMERA','user-set','user-fixed');
    const output = run('shell','am','instrument','-w','-e','liveAgent','true',
      '-e','cameraPermissionTest','true','-e','class',classes,
      `${appId}.test/androidx.test.runner.AndroidJUnitRunner`);
    fs.writeFileSync(path.join(out,`${variant}-instrumentation.txt`),output);
    passed = /OK \(4 tests\)/.test(output) && !/FAILURES|INSTRUMENTATION_FAILED|Process crashed/.test(output);
    if (!passed) error = 'Connected instrumentation did not pass all four cases.';
  } catch {
    // Never print child-process args/environment: the configuration receives a
    // private token file path, and diagnostic output is not needed to expose it.
    error = 'Install, development configuration, or instrumentation failed or timed out.';
  }
  results.push({variant,sha256,passed,...(error?{error}:{})});
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({serial,createdAt:new Date().toISOString(),results},null,2)+'\n');
  console.log(`${variant}: ${passed?'passed':'failed'}`);
}
if (results.some(result=>!result.passed)) process.exitCode=1;
