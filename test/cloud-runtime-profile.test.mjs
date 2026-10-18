import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseBuildArgs,buildEnv,gradleFlagArgs} from '../scripts/build-android.mjs';
import {preparedRuntimeProblems,checkoutProblems} from '../scripts/android-build-preflight.mjs';
test('Cloud profile explicitly selects renderer and Gradle without mock switches',()=>{
 const options=parseBuildArgs(['--runtime-profile=cloud']);
 assert.equal(options.runtimeProfile,'cloud');
 const env=buildEnv({ELIZA_DEV_ALLOW_TEST_MOCKS:'1',VITE_ELIZA_RUNTIME_PROFILE:'native'},options);
 assert.equal(env.VITE_ELIZA_RUNTIME_PROFILE,'cloud');assert.equal(env.ELIZA_DEV_ALLOW_TEST_MOCKS,undefined);
 assert.ok(gradleFlagArgs(options).includes('-PELIZA_RUNTIME_PROFILE=cloud'));
 assert.equal(buildEnv({},parseBuildArgs([])).VITE_ELIZA_RUNTIME_PROFILE,'native');
});
test('Cloud profile cannot inherit the unpackaged or synthetic lane',()=>{
 for(const flag of ['--allow-unpackaged-runtime','--test-mocks'])assert.throws(()=>parseBuildArgs(['--runtime-profile=cloud',flag]),/genuine packaged resident/);
 assert.throws(()=>parseBuildArgs(['--runtime-profile=other']),/Unknown option/);
 for(const option of [{allowUnpackagedRuntime:true},{testMocks:true}])assert.match(preparedRuntimeProblems('/missing','/missing',{runtimeProfile:'cloud',...option})[0],/genuine packaged resident/);
});
test('Cloud profile checks the explicitly selected prepared source even when another runtime is staged',()=>{
 const missing=path.join(process.cwd(),'artifacts','missing-cloud-source-'+randomUUID());
 assert.notDeepEqual(preparedRuntimeProblems(process.cwd(),missing,{runtimeProfile:'cloud'}),[]);
});
test('Cloud profile keeps native speech and embeddings guards as default',()=>{
 const gradle=fs.readFileSync('android/app/build.gradle','utf8');
 assert.match(gradle,/ELIZA_RUNTIME_PROFILE.*native/);
 assert.match(gradle,/runtimeProfile == 'cloud'.*runtime-profile.mjs/);
 assert.match(fs.readFileSync('android/local-speech/build.gradle','utf8'),/unpackaged \|\| cloudProfile/);
 const host=fs.readFileSync('backend/native-cloud-runtime-config.ts','utf8');
 assert.match(host,/ELIZA_RUNTIME_PROFILE==='cloud'\?\{embeddings:/);
});
