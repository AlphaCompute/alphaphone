import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {AVD,READING_CLASSES,READING_TEST_MOCKS_CLASSES,SERIAL,SPEECH_WORKSPACE,disableEmulatorNetwork,runSuite,suitePlan,summarize} from '../scripts/ci/emulator-suite.mjs';
import {CANONICAL_TEST,candidateProblems,packageSpeechRun} from '../scripts/ci/speech-candidate.mjs';
import {CLASS_REGISTRY,DEFAULT_CLASSES,parseInstrumentationArgs} from '../scripts/android-instrumentation.mjs';
import {affected} from '../scripts/ci/affected.mjs';

const read=file=>fs.readFileSync(file,'utf8');
const WORKFLOW='.github/workflows/android-emulator.yml';
const workflow=read(WORKFLOW);
/** Top-level jobs of a workflow file, by name, as their source text. */
function jobs(text){
 const body=text.slice(text.indexOf('\njobs:\n')+6),names=[...body.matchAll(/^  ([a-z][a-z0-9-]*):\n/gm)];
 return Object.fromEntries(names.map((match,index)=>[match[1],body.slice(match.index,names[index+1]?.index??body.length)]));
}
const job=jobs(workflow);
const emulatorJobs=['instrumentation','browser-reading','local-speech'];
const hosted={GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'7'};

test('emulator evidence workflow has no trigger but a dispatch that names a suite',()=>{
 const on=/^on:\n((?:  .*\n|\n)+)/m.exec(workflow)[1];
 assert.deepEqual([...on.matchAll(/^  ([a-z_]+):/gm)].map(match=>match[1]),['workflow_dispatch'],'never on push, pull_request, schedule or workflow_call');
 assert.doesNotMatch(workflow,/^\s+(push|pull_request|pull_request_target|schedule|workflow_call|workflow_run):/m);
 const options=/suite:\n(?:        .*\n)+?        options:\n((?:          - .*\n)+)/.exec(on)[1].trim().split('\n').map(line=>line.trim().slice(2));
 assert.deepEqual(options,[...emulatorJobs,'all']);
 assert.match(on,/suite:\n(?:        .*\n)*?        required: true/);
 // Nothing else starts it: no other workflow calls or dispatches this file.
 for(const file of fs.readdirSync('.github/workflows').filter(name=>name!=='android-emulator.yml'))assert.doesNotMatch(read(path.join('.github/workflows',file)),/android-emulator\.yml|Android emulator evidence/,file);
 assert.match(workflow,/^permissions:\n  contents: read\n/m);
 assert.match(workflow,/group: android-emulator-\$\{\{ github\.ref \}\}-\$\{\{ inputs\.suite \}\}\n  cancel-in-progress: true/);
});

test('every emulator job is selected by the suite input, needs the build, and its emulator step runs its suite',()=>{
 assert.deepEqual(Object.keys(job),['build',...emulatorJobs]);
 for(const name of emulatorJobs){
  const text=job[name];
  assert.match(text,/\n    needs: build\n/,name);
  assert.ok(text.includes(`\n    if: inputs.suite == '${name}' || inputs.suite == 'all'\n`),`${name} runs only when selected`);
  assert.match(text,/\n    timeout-minutes: \d+\n/,name);
  assert.equal((text.match(/reactivecircus\/android-emulator-runner@/g)??[]).length,1,name);
  assert.ok(text.includes(`\n          script: node scripts/ci/emulator-suite.mjs ${name}\n`),`${name} runs its own suite`);
  // API 35 default x86_64 is the fixture the preparation scripts admit (AVD "test", emulator-5554).
  assert.match(text,/api-level: 35\n          target: default\n          arch: x86_64\n/,name);
  // The APKs are the build job's, proven by the manifest hash, at the build job's commit.
  assert.match(text,/ref: \$\{\{ needs\.build\.outputs\.source_sha \}\}/,name);
  assert.match(text,/artifact-ids: \$\{\{ needs\.build\.outputs\.artifact_id \}\}/,name);
  assert.match(text,/test "\$\(sha256sum artifacts\/apk-manifest\.json \| cut -d' ' -f1\)" = "\$EXPECTED_MANIFEST_SHA256"/,name);
  assert.match(text,/EXPECTED_MANIFEST_SHA256: \$\{\{ needs\.build\.outputs\.manifest_sha256 \}\}/,name);
 }
 assert.doesNotMatch(job.build,/android-emulator-runner/,'the build job boots nothing');
 assert.doesNotMatch(job.build,/\n    if: /,'every suite needs the build');
});

test('every emulator job uploads its result directory, also after a failure',()=>{
 for(const name of emulatorJobs){
  const uploads=[...job[name].matchAll(/      - uses: actions\/upload-artifact@[0-9a-f]{40} # v[\d.]+\n((?:        .*\n|          .*\n)+)/g)].map(match=>match[1]);
  assert.equal(uploads.length,1,name);
  assert.match(uploads[0],/^        if: always\(\)\n/,`${name} uploads when the suite failed`);
  assert.match(uploads[0],/if-no-files-found: error/,name);
  assert.match(uploads[0],/retention-days: 3/,name);
  assert.match(uploads[0],/\n            test-results\/emulator-suite\/\n/,name);
  assert.match(uploads[0],/name: [a-z0-9_-]+-\$\{\{ github\.sha \}\}-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/,`${name} artifact is named by commit and run`);
  // The emulator step comes before the upload and is not allowed to fail quietly.
  assert.ok(job[name].indexOf('android-emulator-runner@')<job[name].indexOf('actions/upload-artifact@'),name);
  assert.doesNotMatch(job[name],/continue-on-error/,name);
 }
 for(const name of ['instrumentation','browser-reading'])assert.match(job[name],/\n            test-results\/android-instrumentation\/\n/,name);
 assert.match(job['local-speech'],/\n            test-results\/local-speech-x86_64\/\n/);
 // The provider archive is reproduced from its pin, not uploaded again.
 assert.match(job['browser-reading'],/!test-results\/ci-webview-provider\/chromium\.zip\n            !test-results\/ci-webview-provider\/SystemWebView\.apk/);
});

test('every action in the emulator evidence workflow is pinned to an exact commit with its release named',()=>{
 const uses=[...workflow.matchAll(/^\s+(?:- )?uses: (\S+)(.*)$/gm)];
 assert.ok(uses.length>=20);
 for(const [line,target,rest] of uses){
  assert.match(target,/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.\/-]+@[0-9a-f]{40}$/,`${line.trim()} must name a 40-character commit`);
  assert.match(rest,/^ # v\d+\.\d+\.\d+$/,`${line.trim()} must name the release that commit is`);
 }
 // One commit per action across the file, and the first-party pins are the ones the other workflows use.
 const pins=new Map();for(const [,target] of uses){const [name,commit]=target.split('@');assert.equal(pins.get(name)??commit,commit,name);pins.set(name,commit);}
 const others=['android.yml','browser.yml','resident-android.yml'].map(file=>read(path.join('.github/workflows',file))).join('\n');
 for(const [name,commit] of pins)if(name.startsWith('actions/'))assert.ok(others.includes(`${name}@${commit}`),`${name} is pinned to a commit no other workflow uses`);
 assert.deepEqual([...pins.keys()].filter(name=>!name.startsWith('actions/')).sort(),['android-actions/setup-android','gradle/actions/setup-gradle','reactivecircus/android-emulator-runner']);
});

test('every action in every workflow is pinned to an exact commit, one commit per action',()=>{
 // A tag can be moved to other code after review; a commit cannot. Before round 8 four
 // third-party actions in the older workflows were referenced by their major tag.
 const pins=new Map(),files=fs.readdirSync('.github/workflows').filter(name=>/\.ya?ml$/.test(name)).sort();
 assert.ok(files.length>=7);
 for(const file of files){
  const uses=[...read(path.join('.github/workflows',file)).matchAll(/^\s+(?:- )?uses:\s*(\S+)(.*)$/gm)];
  assert.ok(uses.length>0,file);
  for(const [line,target,rest] of uses){
   // A reusable workflow of this repository runs at the calling commit.
   if(target.startsWith('./')){assert.match(target,/^\.\/\.github\/workflows\/[a-z0-9-]+\.yml$/,`${file}: ${line.trim()}`);assert.ok(fs.existsSync(target),target);continue;}
   assert.match(target,/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.\/-]+@[0-9a-f]{40}$/,`${file}: ${line.trim()} must name a 40-character commit`);
   assert.match(rest,/^ # v\d+\.\d+\.\d+$/,`${file}: ${line.trim()} must name the release that commit is`);
   const [name,commit]=target.split('@');assert.equal(pins.get(name)??commit,commit,`${name} is pinned to two different commits (${file})`);pins.set(name,commit);
  }
 }
 assert.deepEqual([...pins.keys()].filter(name=>!name.startsWith('actions/')).sort(),['android-actions/setup-android','gradle/actions/setup-gradle','oven-sh/setup-bun','reactivecircus/android-emulator-runner'],'a new third-party action needs its own review');
 // No step runs from a container image reference (which a commit pin does not cover), and no workflow grants a write permission.
 for(const file of files){const text=read(path.join('.github/workflows',file));assert.doesNotMatch(text,/\bdocker:\/\//,file);assert.doesNotMatch(text,/^\s+[a-z-]+: write\s*$/m,`${file} grants a write permission`);}
});

test('a change to the emulator evidence workflow selects no automatic lane of its own',()=>{
 assert.deepEqual(affected([WORKFLOW]),{verify:true,browser:false,android:false,prepare:false});
 const policy=read('docs/ci-cost-policy.md');
 assert.match(policy,/android-emulator\.yml/);
 for(const suite of [...emulatorJobs,'all'])assert.ok(policy.includes(`gh workflow run android-emulator.yml --ref <branch> -f suite=${suite}`),suite);
});

test('the build job records the speech candidate from the runtime it builds and hands over hash-anchored APKs',()=>{
 const build=job.build;
 const order=['scripts/local-speech/build-no-espeak.py','scripts/local-speech/verify-source.py','scripts/local-speech/assemble-runtime.py','scripts/local-speech/requalify-runtime.py record','scripts/local-speech/install-generated.py','npm run android:build -- --allow-unpackaged-runtime','npm run android:build -- --test-mocks','actions/upload-artifact@'].map(text=>build.indexOf(text));
 assert.ok(order.every(index=>index>0),'every build step is present');assert.deepEqual([...order].sort((a,b)=>a-b),order,'in this order');
 assert.match(build,/for abi in arm64-v8a x86_64; do/,'the candidate is one rebuild of both ABIs');
 assert.match(build,/requalify-runtime\.py record --ndk "\$ANDROID_NDK_HOME" \\\n\s+--candidate test-results\/local-speech-ci\/requalification\/candidate\.json/);
 assert.match(build,/install-generated\.py --repository "\$GITHUB_WORKSPACE" --allow-unqualified-runtime/);
 assert.doesNotMatch(workflow,/requalify-runtime\.py admit|--reviewer/,'admission needs a reviewer named by a person; no job admits');
 // The instrumentation APKs are built (no --skip-instrumentation) and the flag-off pair stays flag-off.
 assert.doesNotMatch(build,/--skip-instrumentation/);
 assert.match(build,/ELIZA_DEV_ALLOW_TEST_MOCKS: ""\n          VITE_ELIZA_DEV_ALLOW_TEST_MOCKS: ""\n        run: npm run android:build -- --allow-unpackaged-runtime\n/);
 assert.match(build,/if: inputs\.suite == 'browser-reading' \|\| inputs\.suite == 'all'\n        run: \|\n          before=/,'the test-mocks pair is built only for the suite that needs it');
 for(const file of ['artifacts/apk-manifest.json','artifacts/standalone-debug.apk','artifacts/launcher-debug.apk','artifacts/instrumentation/*.apk','artifacts/test-mocks/apk-manifest.json','test-results/local-speech-ci/requalification/candidate.json'])
  assert.ok(build.includes(`\n            ${file}\n`),`${file} is handed to the emulator jobs`);
 for(const output of ['manifest_sha256','test_mocks_manifest_sha256','candidate_sha256','artifact_id','source_sha'])assert.match(build,new RegExp(`\\n      ${output}: \\$\\{\\{ `),output);
});

test('the reading job provisions the pinned WebView on the fixture its provisioner admits',()=>{
 const text=job['browser-reading'];
 assert.match(text,/emulator-options: .*-writable-system .*androidboot\.boot_devices=/);
 assert.match(text,/-feature -Vulkan/);
 assert.match(text,/EXPECTED_TEST_MOCKS_MANIFEST_SHA256: \$\{\{ needs\.build\.outputs\.test_mocks_manifest_sha256 \}\}/);
 assert.match(text,/test -n "\$EXPECTED_TEST_MOCKS_MANIFEST_SHA256"\n\s+test "\$\(sha256sum artifacts\/test-mocks\/apk-manifest\.json/);
 // The other jobs keep the image's own provider: no writable system partition.
 for(const name of ['instrumentation','local-speech'])assert.doesNotMatch(job[name],/-writable-system/,name);
});

test('suite plans: default classes; reading classes with the builds and gates they need; the canonical speech run',()=>{
 const instrumentation=suitePlan('instrumentation');
 assert.deepEqual(instrumentation.map(step=>[step.name,step.kind]),[['prepare-emulator','preparation'],['ci-default','evidence']]);
 // `npm run test:android:instrumentation` with no --classes: the runner's own default list, both distributions.
 assert.deepEqual(instrumentation[1].command,['npm','run','test:android:instrumentation','--','--owned-emulator','--avd','test','--serial','emulator-5554','--output','test-results/android-instrumentation/ci-default']);
 const parsed=parseInstrumentationArgs(instrumentation[1].command.slice(4));
 assert.deepEqual(parsed.variants,['standalone','launcher']);assert.equal(parsed.classes.length,DEFAULT_CLASSES.length);assert.equal(parsed.testMocks,false);

 const reading=suitePlan('browser-reading');
 assert.deepEqual(reading.map(step=>step.name),['prepare-emulator','prepare-webview','ci-reading','ci-reading-test-mocks']);
 assert.deepEqual(reading[1].command.slice(1),['scripts/prepare-ci-webview.mjs']);
 assert.deepEqual(reading[1].env,{ANDROID_SERIAL:'emulator-5554',ALPHA_DISPOSABLE_WEBVIEW_FIXTURE:'api35-default-x86_64'});
 assert.deepEqual(reading[0].command.slice(1),['scripts/prepare-ci-emulator.mjs']);
 assert.deepEqual([...READING_CLASSES,...READING_TEST_MOCKS_CLASSES].sort(),['BrowserIsolatedReading','BrowserPageQuestion','BrowserReading','BrowserReadingNavigation','BrowserSensitiveReading']);
 // The runner itself accepts both invocations, on both distributions, with each class's own gate.
 const flagOff=parseInstrumentationArgs(reading[2].command.slice(4)),mocks=parseInstrumentationArgs(reading[3].command.slice(4));
 assert.equal(flagOff.testMocks,false);assert.equal(mocks.testMocks,true);assert.equal(mocks.apkDir,'artifacts/test-mocks');
 assert.deepEqual(flagOff.classes.map(name=>name.split('.').at(-1)),READING_CLASSES.map(name=>name+'InstrumentedTest'));
 assert.deepEqual(mocks.classes.map(name=>name.split('.').at(-1)),READING_TEST_MOCKS_CLASSES.map(name=>name+'InstrumentedTest'));
 for(const name of READING_TEST_MOCKS_CLASSES)assert.equal(CLASS_REGISTRY[name].requiresTestMocksBuild,true,name);
 for(const name of READING_CLASSES)assert.notEqual(CLASS_REGISTRY[name].requiresTestMocksBuild,true,name);
 assert.deepEqual(Object.fromEntries([...READING_CLASSES,...READING_TEST_MOCKS_CLASSES].map(name=>[name,CLASS_REGISTRY[name].args])),{BrowserReadingNavigation:{browserIsolatedReading:'1'},BrowserPageQuestion:{browserPageQuestion:'1'},BrowserReading:{browserReading:'1'},BrowserSensitiveReading:{browserSensitiveReading:'1'},BrowserIsolatedReading:{browserIsolatedReading:'1'}});
 // The negative class needs a provider WITHOUT isolated worlds; it must not share this fixture.
 assert.ok(![...READING_CLASSES,...READING_TEST_MOCKS_CLASSES].includes('BrowserUnsupportedReading'));

 const speech=suitePlan('local-speech');
 assert.deepEqual(speech.map(step=>[step.name,step.kind]),[['prepare-emulator','preparation'],['network-off','preparation'],['canonical-speech-x86_64','evidence']]);
 assert.deepEqual(speech[2].command,['python3','scripts/local-speech/requalify-runtime.py','run','--serial','emulator-5554','--workspace','test-results/local-speech-ci','--apk','artifacts/standalone-debug.apk','--test-apk','artifacts/instrumentation/standalone-androidTest.apk']);
 assert.equal(speech[2].results,`${SPEECH_WORKSPACE}/requalification/candidate.json`);
 // The tool runs the canonical class itself, with its own gate; nothing here selects methods or edits the test.
 const tool=read('scripts/local-speech/requalify-runtime.py');
 assert.match(tool,/'-e', 'localSpeech', '1', '-e', 'class', CANONICAL_CLASS, RUNNER/);
 assert.ok(tool.includes(`CANONICAL_TEST = '${CANONICAL_TEST}'`));
 assert.throws(()=>suitePlan('all'),/Unknown suite/);assert.throws(()=>suitePlan('resident'),/Unknown suite/);
 assert.equal(SERIAL,'emulator-5554');assert.equal(AVD,'test');
});

test('a default class can run on the flag-off build it is run on',()=>{
 const dir='android/app/src/androidTest/java/ai/elizaresearch/alphaphone/';
 for(const name of DEFAULT_CLASSES){
  const spec=CLASS_REGISTRY[name];assert.ok(spec,name);
  for(const key of ['testMocks','requiresTestMocksBuild','secondaryUser','homeRole','campaign','requires'])assert.equal(spec[key],undefined,`${name}.${key} needs an option a default run does not pass`);
  // At least one @Test method is not gated on a test-mocks app build.
  const methods=read(dir+name+'InstrumentedTest.java').split(/@Test\b/).slice(1);
  assert.ok(methods.some(body=>!/assumeTrue\([^;]*BuildConfig\.ELIZA_DEV_ALLOW_TEST_MOCKS\)/.test(body.split(/\n @|\n\s*@Test/)[0])),`${name} would only be skipped on a flag-off build`);
 }
 // BrowserDownload's one method is gated that way, so the default run could never pass with it.
 const download=read(dir+'BrowserDownloadInstrumentedTest.java').split(/@Test\b/).slice(1);
 assert.equal(download.length,1);assert.match(download[0],/assumeTrue\([^;]*BuildConfig\.ELIZA_DEV_ALLOW_TEST_MOCKS\)/);
 assert.ok(!DEFAULT_CLASSES.includes('BrowserDownload'));assert.ok(CLASS_REGISTRY.BrowserDownload,'still runnable by name with --test-mocks');
});

/** A results.json as the instrumentation runner writes it, at the path a step names. */
function results(root,step,statuses){
 const file=path.join(root,step.results);fs.mkdirSync(path.dirname(file),{recursive:true});
 const classes=Object.entries(statuses).map(([name,status])=>({variant:'standalone',class:`ai.elizaresearch.alphaphone.${name}InstrumentedTest`,status,failed:status==='failed'?['m']:[]}));
 fs.writeFileSync(file,JSON.stringify({passed:classes.every(row=>row.status==='passed'),classes}));
}
function inDirectory(t){const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'emulator-suite-')));const previous=process.cwd();process.chdir(root);t.after(()=>{process.chdir(previous);fs.rmSync(root,{recursive:true,force:true});});return root;}

test('suite run: preparation failure stops it; evidence steps are independent; any class that did not pass fails it',t=>{
 const root=inDirectory(t);
 // Both evidence runs execute although the first has a failed class.
 let calls=[];
 const failing=runSuite('browser-reading',{environment:hosted,execute:(command,env)=>{calls.push([command,env]);const step=suitePlan('browser-reading').find(row=>row.command===command||JSON.stringify(row.command)===JSON.stringify(command));
  if(step.name==='ci-reading'){results(root,step,{BrowserReadingNavigation:'failed',BrowserPageQuestion:'passed'});return 1;}
  if(step.name==='ci-reading-test-mocks'){results(root,step,{BrowserReading:'passed',BrowserSensitiveReading:'passed',BrowserIsolatedReading:'passed'});return 0;}
  return 0;}});
 assert.equal(calls.length,4);assert.deepEqual(calls[1][1],{ANDROID_SERIAL:'emulator-5554',ALPHA_DISPOSABLE_WEBVIEW_FIXTURE:'api35-default-x86_64'});
 assert.deepEqual(failing.steps.map(row=>row.status),['passed','passed','failed','passed']);assert.equal(failing.passed,false);
 assert.deepEqual(failing.steps[2].evidence.classes[0],{variant:'standalone',class:'BrowserReadingNavigation',status:'failed',failed:['m']});
 assert.equal(failing.evidenceClass,'E');assert.equal(failing.commit,'a'.repeat(40));
 const summary=summarize(failing);assert.match(summary,/`browser-reading`: FAILED/);assert.match(summary,/\| standalone \| BrowserReadingNavigation \| failed \|/);assert.match(summary,/Not a distributable build/);

 // A provider that cannot be installed stops the suite: the reading classes are not run on WebView 124.
 fs.rmSync(path.join(root,'test-results'),{recursive:true,force:true});calls=[];
 const stopped=runSuite('browser-reading',{environment:hosted,execute:command=>{calls.push(command);return command.includes('scripts/prepare-ci-webview.mjs')?1:0;}});
 assert.equal(calls.length,2);assert.deepEqual(stopped.steps.map(row=>row.status),['passed','failed','not-run','not-run']);assert.equal(stopped.passed,false);

 // A skipped or missing class is not a pass, whatever the exit status says; neither is a run that left no record.
 for(const [status,exit] of [['skipped',0],['missing',0],['passed',1]]){
  fs.rmSync(path.join(root,'test-results'),{recursive:true,force:true});
  const report=runSuite('instrumentation',{environment:hosted,execute:command=>{const step=suitePlan('instrumentation')[1];if(command[0]==='npm'){results(root,step,{Shell:'passed',TextScale:status});return exit;}return 0;}});
  assert.equal(report.passed,false,`${status}/${exit}`);assert.equal(report.steps[1].status,'failed',`${status}/${exit}`);
 }
 fs.rmSync(path.join(root,'test-results'),{recursive:true,force:true});
 const silent=runSuite('instrumentation',{environment:hosted,execute:()=>0});
 assert.equal(silent.passed,false);assert.match(silent.steps[1].error,/results\.json was not written/);

 fs.rmSync(path.join(root,'test-results'),{recursive:true,force:true});
 const records=[];
 const passing=runSuite('instrumentation',{environment:hosted,record:value=>records.push(JSON.parse(JSON.stringify(value))),execute:command=>{if(command[0]==='npm')results(root,suitePlan('instrumentation')[1],Object.fromEntries(DEFAULT_CLASSES.map(name=>[name,'passed'])));return 0;}});
 assert.equal(passing.passed,true);assert.match(summarize(passing),/`instrumentation`: passed/);
 assert.equal(records.at(-1).passed,true);assert.equal(records[0].passed,false,'the record is written after every step and is not a pass until the end');
 // Outside a hosted runner emulator-5554 may be someone's emulator.
 assert.throws(()=>runSuite('instrumentation',{environment:{},execute:()=>{throw new Error('must not run');}}),/only on a GitHub-hosted runner/);
});

test('speech suite: networking is proven off before the canonical test, and only the candidate decides the result',t=>{
 const root=inDirectory(t);
 const candidate=(state)=>{const file=path.join(root,SPEECH_WORKSPACE,'requalification/candidate.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({functionalAcceptance:{passed:false,abis:{'arm64-v8a':{passed:false,state:'not-executed'},x86_64:state}}}));};
 const log=[];
 const adb=online=>args=>{log.push(args.join(' '));if(args.includes('dumpsys'))return `Idle timers:\nActive default network: ${online.shift()??'none'}\n`;if(args.at(-1)==='airplane-mode')return 'enabled\n';return '';};
 candidate({passed:false,state:'not-executed'});
 const passed=runSuite('local-speech',{environment:hosted,network:{sleep:()=>{}},adb:adb(['100','none']),execute:command=>{if(command[0]==='python3')candidate({passed:true,state:'passed',testsPassed:2});return 0;}});
 assert.deepEqual(passed.steps.map(row=>row.status),['passed','passed','passed']);assert.equal(passed.passed,true);
 assert.deepEqual(passed.steps[1].observed,{airplaneMode:'enabled',activeDefaultNetwork:'none'});
 assert.deepEqual(log.slice(0,3),['shell cmd connectivity airplane-mode enable','shell svc wifi disable','shell svc data disable']);
 assert.equal(log.filter(line=>line==='shell dumpsys connectivity').length,2,'polled until Android reported no default network');
 assert.match(summarize(passed),/x86_64 passed, 2 of 2 canonical tests passed\. The other ABI and a named reviewer are still required before admission\./);
 assert.ok(passed.notEvidenceFor.includes('speech runtime admission'));

 // The tool exits 3 and records the failure: reported as failed with its problems.
 candidate({passed:false,state:'not-executed'});
 const failed=runSuite('local-speech',{environment:hosted,adb:adb([]),execute:command=>{if(command[0]==='python3'){candidate({passed:false,state:'failed',testsPassed:1,problems:['nativeModelsTranscribeAndSynthesizeWithNoNetwork: failed']});return 3;}return 0;}});
 assert.equal(failed.passed,false);assert.equal(failed.steps[2].evidence.speech.state,'failed');assert.match(summarize(failed),/nativeModelsTranscribeAndSynthesizeWithNoNetwork: failed/);
 // Exit 0 without a recorded pass (the tool crashed before ingest) is not a pass.
 candidate({passed:false,state:'not-executed'});
 const unrecorded=runSuite('local-speech',{environment:hosted,adb:adb([]),execute:()=>0});
 assert.equal(unrecorded.passed,false);assert.equal(unrecorded.steps[2].status,'failed');
 // A network that stays up stops the suite before the test is started.
 let ran=false;
 const online=runSuite('local-speech',{environment:hosted,network:{attempts:3,sleep:()=>{}},adb:args=>args.includes('dumpsys')?'Active default network: 100\n':'',execute:command=>{if(command[0]==='python3')ran=true;return 0;}});
 assert.equal(ran,false);assert.deepEqual(online.steps.map(row=>row.status),['passed','failed','not-run']);
 assert.throws(()=>disableEmulatorNetwork(()=>'no such line',{attempts:2,sleep:()=>{}}),/still has a default network \(not reported\)/);
});

const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
test('speech candidate check refuses another test, another pin, a missing ABI and a candidate that already ran',()=>{
 const bound={canonicalTestSha256:'c'.repeat(64),upstreamCommit:'d'.repeat(40)};
 const good=()=>({admission:'requalification-candidate',provenance:{canonicalTestSha256:bound.canonicalTestSha256,upstreamCommit:bound.upstreamCommit},qualifiedAbis:[{abi:'arm64-v8a',native:[{file:'a.so'}]},{abi:'x86_64',native:[{file:'a.so'}]}],functionalAcceptance:{passed:false,abis:{'arm64-v8a':{state:'not-executed'},x86_64:{state:'not-executed'}}}});
 assert.deepEqual(candidateProblems(good(),bound),[]);
 const cases=[[c=>{c.provenance.canonicalTestSha256='e'.repeat(64);},/canonical test differs/],[c=>{c.provenance.upstreamCommit='f'.repeat(40);},/another upstream pin/],[c=>{c.qualifiedAbis.pop();},/x86_64 is not part of this rebuild/],
  [c=>{c.functionalAcceptance.abis.x86_64.state='passed';},/already recorded as passed/],[c=>{c.functionalAcceptance.passed=true;},/cannot arrive already passed/],[c=>{c.admission='requalified-independent-rebuild';},/not a requalification candidate/]];
 for(const [change,expected] of cases){const candidate=good();change(candidate);assert.match(candidateProblems(candidate,bound).join('; '),expected);}
 assert.ok(candidateProblems(null,bound).length>=4);
 // The command binds to this checkout's canonical test and pin.
 assert.ok(fs.existsSync(CANONICAL_TEST));
 const committed=JSON.parse(read('android/local-speech/requalification/candidate-20261009.json'));
 const run=spawnSync(process.execPath,['scripts/ci/speech-candidate.mjs','check','android/local-speech/requalification/candidate-20261009.json'],{encoding:'utf8'});
 assert.equal(run.status,1,'the committed candidate is from an earlier pin and already ran arm64; it is not this run\'s candidate');
 assert.match(run.stderr,/Speech candidate refused/);
 assert.equal(committed.provenance.canonicalTestSha256,sha(CANONICAL_TEST),'the canonical test is unchanged since that candidate');
});

test('speech package holds what ingest reads and reports only what the candidate records',t=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'speech-package-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const put=(name,text)=>{fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),text);};
 const candidate=x86=>JSON.stringify({aarSha256:'a'.repeat(64),provenance:{upstreamCommit:'d'.repeat(40)},functionalAcceptance:{passed:false,abis:{'arm64-v8a':{passed:false,state:'not-executed'},x86_64:x86}}});
 put('ws/requalification/candidate.json',candidate({passed:true,state:'passed',testsPassed:2,appAPKSha256:'b'.repeat(64)}));
 put('ws/candidate-before-run.json',candidate({passed:false,state:'not-executed'}));
 put('ws/requalification/x86_64/instrumentation.log','OK (2 tests)\n');put('ws/requalification/x86_64/local-speech-evidence/result.json','{"pass":true}');put('ws/requalification/x86_64/local-speech-evidence/holder-result.json','{"pass":true}');
 put('artifacts/standalone-debug.apk','app');put('artifacts/instrumentation/standalone-androidTest.apk','test');
 const result=packageSpeechRun({workspace:'ws',output:'out',repository:root,environment:{GITHUB_SHA:'9'.repeat(40),GITHUB_RUN_ID:'12'}});
 assert.equal(result.passed,true);assert.equal(result.state,'passed');assert.deepEqual(result.missing,[]);assert.deepEqual(result.otherAbis,{'arm64-v8a':'not-executed'});
 assert.match(result.admission,/^not admitted/);assert.ok(result.notEvidenceFor.includes('arm64-v8a'));
 assert.deepEqual(Object.keys(result.files).sort(),['candidate-before-run.json','candidate.json','standalone-androidTest.apk','standalone-debug.apk','x86_64/instrumentation.log','x86_64/local-speech-evidence/holder-result.json','x86_64/local-speech-evidence/result.json']);
 assert.equal(result.files['standalone-debug.apk'],sha(path.join(root,'artifacts/standalone-debug.apk')));
 // The ingest command names exactly the options the tool requires, and files that are in the package.
 for(const option of ['--abi x86_64','--device-abi x86_64','--apk DIR/standalone-debug.apk','--log DIR/x86_64/instrumentation.log','--evidence DIR/x86_64/local-speech-evidence','--candidate DIR/candidate-ingest.json'])assert.ok(result.ingest.includes(option),option);
 assert.match(read('scripts/local-speech/requalify-runtime.py'),/ingest needs --abi, --device-abi, --apk, --log and --evidence/);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'out/result.json'),'utf8')),result);
 assert.throws(()=>packageSpeechRun({workspace:'ws',output:'out',repository:root}),/already exists/);

 // A run that never produced its log is packaged as incomplete, never as a pass.
 fs.rmSync(path.join(root,'ws/requalification/x86_64'),{recursive:true});
 const partial=packageSpeechRun({workspace:'ws',output:'out-partial',repository:root});
 assert.equal(partial.passed,false);assert.deepEqual(partial.missing,['x86_64/instrumentation.log','x86_64/local-speech-evidence']);
 put('ws/requalification/candidate.json',candidate({passed:false,state:'failed',problems:['modelHolderReusesAndReleasesOnItsWorker: failed']}));
 const failed=packageSpeechRun({workspace:'ws',output:'out-failed',repository:root});
 assert.equal(failed.passed,false);assert.equal(failed.state,'failed');assert.deepEqual(failed.recorded.problems,['modelHolderReusesAndReleasesOnItsWorker: failed']);
 fs.rmSync(path.join(root,'ws'),{recursive:true});
 const empty=packageSpeechRun({workspace:'ws',output:'out-empty',repository:root});
 assert.equal(empty.passed,false);assert.equal(empty.state,'no-candidate');
});

test('the suite command refuses to start, and writes nothing, outside a hosted runner',t=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'emulator-suite-cli-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const env={PATH:process.env.PATH,HOME:process.env.HOME};
 for(const suite of emulatorJobs){
  const run=spawnSync(process.execPath,[path.resolve('scripts/ci/emulator-suite.mjs'),suite],{cwd:root,env,encoding:'utf8'});
  assert.notEqual(run.status,0,suite);assert.match(run.stderr,/only on a GitHub-hosted runner/,suite);
 }
 const unknown=spawnSync(process.execPath,[path.resolve('scripts/ci/emulator-suite.mjs'),'all'],{cwd:root,env:{...env,GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted'},encoding:'utf8'});
 assert.notEqual(unknown.status,0);assert.match(unknown.stderr,/Unknown suite/);
 assert.deepEqual(fs.readdirSync(root),[]);
});
