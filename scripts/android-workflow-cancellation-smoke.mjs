/** Explicit real patched-backend/Android UI run. Run only on a disposable emulator. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { androidEnv } from './toolchain.mjs';
const env=androidEnv(), serial=process.env.ANDROID_SERIAL;
if(!/^emulator-\d+$/.test(serial||''))throw new Error('Set ANDROID_SERIAL to the disposable phone emulator');
// Explicit reviewed identity only: never pick a workflow by title or silently
// reuse a historical ID belonging to another runtime/profile.
const fixtureId=process.env.ALPHA_WORKFLOW_FIXTURE_ID;
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fixtureId||''))throw new Error('Set ALPHA_WORKFLOW_FIXTURE_ID to the reviewed disposable arithmetic workflow UUID');
// Exact source emitted by test-real-workflow.mjs. Substring checks alone allow
// arbitrary side effects hidden beside the harmless arithmetic expression.
const reviewedSource=`/** @jsxImportSource smthrs */
import {createSmithers} from "smthrs/create";
import {z} from "zod";
const {Workflow,Task,smithers,outputs}=createSmithers({answer:z.object({value:z.number()})},{dbPath:process.env.ELIZA_SMTHRS_DB_PATH});
await new Promise(resolve=>setTimeout(resolve,180000));
export default smithers(()=><Workflow name="alpha-held-arithmetic"><Task id="answer" output={outputs.answer}>{{value:7*8}}</Task></Workflow>);`;
const sourceHash=crypto.createHash('sha256').update(reviewedSource).digest('hex');
function verifiedFixture(listed,detail){
 const fixture=Array.isArray(listed.workflows)?listed.workflows.find(w=>w.id===fixtureId):null;
 const valid=w=>w&&w.id===fixtureId&&w.active===false&&!w.schedule&&typeof w.name==='string'&&w.name.trim()&&typeof w.versionId==='string'&&w.versionId&&typeof w.source==='string'&&w.source.replaceAll('\r\n','\n').trim()===reviewedSource;
 if(!valid(fixture)||!valid(detail)||fixture.versionId!==detail.versionId||fixture.name!==detail.name)throw new Error('Reviewed inactive arithmetic-only workflow identity/version required');
 // The native test selects its card by title. Reject ambiguous substring matches.
 if(listed.workflows.filter(w=>typeof w.name==='string'&&w.name.includes(fixture.name)).length!==1)throw new Error('Workflow fixture title is ambiguous');
 return detail;
}
const origin='http://127.0.0.1:47840';
const sessionFile=process.env.ALPHA_DEVICE_SESSION_FILE||path.join(os.homedir(),'.local/share/alphaphone/local-device-actions/paired-session.json');
if((fs.statSync(sessionFile).mode&0o077)!==0)throw new Error('Owner-only session file required');
const session=JSON.parse(fs.readFileSync(sessionFile,'utf8'));
const headers={Authorization:`Bearer ${session.token}`,'X-Forwarded-For':'192.0.2.1'};
const request=async(endpoint,authenticated=false)=>{const response=await fetch(origin+endpoint,{headers:authenticated?headers:undefined,redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Private fixture setup failed');return response.json();};
const me=await request('/api/auth/me',true), agents=await request('/api/agents',true);
if(me.access?.role!=='OWNER'||me.access?.mode!=='session'||typeof me.identity?.id!=='string'||!me.identity.id||agents.agents?.length!==1||typeof agents.agents[0]?.id!=='string')throw new Error('Verified owner and one running agent required');
const capability=await request('/api/workflow/status',true);
if(capability.engine!=='smthrs'||capability.status!=='ready')throw new Error('Ready Smithers workflow capability required');
const adb=path.join(env.ANDROID_HOME,'platform-tools/adb'),appId=JSON.parse(fs.readFileSync('app.config.json')).appId;
const out=process.env.ALPHA_DEVICE_RESULTS||'test-results/android-workflow-cancellation';fs.mkdirSync(out,{recursive:true});
const archive=process.env.ALPHA_BUILD_ARCHIVE;if(!archive)throw Error('Archived matching APKs required');
const manifest=JSON.parse(fs.readFileSync(path.join(archive,'apk-manifest.json')));
const run=(args,input)=>execFileSync(adb,['-s',serial,...args],{env,encoding:'utf8',timeout:420000,input});
const results=[];
for(const variant of ['standalone','launcher']) {
 const apk=path.join(archive,`${variant}-debug.apk`),testApk=path.join(archive,`${variant}-androidTest.apk`),testSha256=crypto.createHash('sha256').update(fs.readFileSync(testApk)).digest('hex'),sha256=crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex');
 if(manifest[`${variant}-debug.apk`]!==sha256||manifest[`${variant}-androidTest.apk`]!==testSha256)throw new Error('APK differs from manifest');
 let passed=false;
 try {
  run(['install','--no-incremental','-r',apk]);
  run(['install','--no-incremental','-r',testApk]);run(['shell','am','force-stop',appId]);
  const listed=await request('/api/workflow/workflows',true);
  const detail=await request(`/api/workflow/workflows/${encodeURIComponent(fixtureId)}`,true);
  const fixture=verifiedFixture(listed,detail);
  const pairing=await request('/api/auth/pair-code');if(typeof pairing.code!=='string')throw new Error('Pairing code unavailable');
  const before=await request(`/api/workflow/workflows/${encodeURIComponent(fixtureId)}/executions`,true);const known=new Set(before.executions.map(r=>r.id));
  const title=fixture.name;
  run(['shell',`run-as ${appId} sh -c 'umask 077; mkdir -p files; cat > files/workflow-cancellation-pairing.json'`],JSON.stringify({code:pairing.code,origin:'http://10.0.2.2:47840',ownerId:me.identity.id,agentId:agents.agents[0].id,workflowId:fixtureId,versionId:fixture.versionId,sourceHash,title}));
  const output=run(['shell','am','instrument','-w','-e','workflowCancellation','true','-e','class',`${appId}.WorkflowCancellationInstrumentedTest`,`${appId}.test/androidx.test.runner.AndroidJUnitRunner`]);
  fs.writeFileSync(path.join(out,`${variant}.txt`),output);
  passed=/OK \(1 test\)/.test(output)&&!/FAILURES|INSTRUMENTATION_FAILED|Process crashed/.test(output);
  const after=await request(`/api/workflow/workflows/${encodeURIComponent(fixtureId)}/executions`,true);const fresh=after.executions.filter(r=>!known.has(r.id));passed=passed&&fresh.length===1&&fresh[0].status==='cancelled'&&fresh[0].finished===true&&fresh[0].workflowVersionId===fixture.versionId;
  if(!passed&&fresh.some(r=>!r.finished))console.log('Fixture has an unresolved execution; inspect its receipt before any further run.');
 }catch { /* Do not dump commands containing private pairing inputs. */ }
 results.push({variant,sha256,testSha256,passed});
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({serial,fixtureId,reviewedSourceSha256:sourceHash,createdAt:new Date().toISOString(),scope:'Real local held arithmetic workflow: reviewed manual run, separate explicit cancellation and terminal receipt. No completed-effect rollback, Cloud or phone-trigger claim',results},null,2)+'\n');
 console.log(`${variant}: ${passed?'passed':'failed'}`);
}
if(results.some(row=>!row.passed))process.exitCode=1;
