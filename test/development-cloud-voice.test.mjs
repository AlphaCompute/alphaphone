import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
if(!process.execArgv.includes('tsx')){const child=spawnSync(process.execPath,['--import','tsx',process.argv[1]],{stdio:'inherit',timeout:30000});process.exit(child.status??1);}
const {createLocalAgentDevHandler}=await import('../scripts/local-agent-dev-bridge.ts');
const owner=randomUUID(),root='1'.repeat(64),paired='fixture-private-owner';
async function fixture(enabled=true,moderation){
 const directory=await mkdtemp(join(tmpdir(),'alpha-cloud-speech-')),tokenFile=join(directory,'token');await writeFile(tokenFile,root,{mode:0o600});
 let mode='ok',signal;const calls=[];
 const request=async(url,input)=>{const path=new URL(url).pathname;calls.push({path,input});
  if(path==='/api/auth/status')return Response.json({instanceId:'fixture'});
  if(path==='/api/auth/pair-code')return Response.json({code:'fixture'});
  if(path==='/api/auth/pair')return Response.json({access:'owner',token:paired,instanceId:'fixture',identityId:owner});
  assert.equal(input.headers.Authorization,'Bearer '+paired);
  if(path==='/api/auth/me')return Response.json({identity:{id:owner},access:{role:'OWNER'},session:{id:paired,expiresAt:Date.now()+600000}});
  signal=input.signal;if(mode==='wait')return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  if(mode==='rotate')await writeFile(tokenFile,'2'.repeat(64),{mode:0o600});
  if(mode==='error')return Response.json({secret:'never-project-provider-error'},{status:402});
  const headers={'server-timing':mode==='timing'?'auth;dur=911, admission;dur=1497, synthesis;dur=195, private;desc=never-project-secret':'','x-eliza-speech-provider':mode==='wrong'?'paradee':'cartesia','x-eliza-speech-route':'cloud'};
  const receipt=response=>{if(moderation!==undefined){const get=response.headers.get.bind(response.headers);response.headers.get=name=>name.toLowerCase()==='x-eliza-tts-moderation'?moderation:get(name);}return response;};
  if(path==='/api/asr/cloud')return receipt(Response.json({text:'Heard exactly once',secret:'never-project-transcript-metadata'},{headers}));
  assert.deepEqual(JSON.parse(input.body),{text:'Hello'});
  headers['content-type']=mode==='type'?'audio/wav':'audio/mpeg';return receipt(new Response(mode==='large'?new Uint8Array(8*1024*1024+1):new Uint8Array([73,68,51,1]),{headers}));
 };
 const handler=createLocalAgentDevHandler({origin:'http://127.0.0.1:9',tokenFile,request,cloudVoiceEnabled:enabled}),server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const call=async(input,signal)=>{const response=await fetch(origin,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Alpha-Local-Agent':'1'},body:JSON.stringify({ownerId:owner,headers:{},...input}),signal});return {status:response.status,data:await response.json()};};
 return {call,calls,mode:value=>mode=value,signal:()=>signal,close:async()=>{handler.closeVoice();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}};
}
const tts=()=>({path:'/api/tts/cloud',method:'POST',requestId:randomUUID(),body:JSON.stringify({text:'Hello'})});
const asr=()=>({path:'/api/asr/cloud',method:'POST',requestId:randomUUID(),audioBase64:Buffer.from('RIFF fixture WAV').toString('base64')});
test('disabled Cloud speech never enrolls or calls the runtime',async()=>{const f=await fixture(false);try{assert.equal((await f.call(tts())).status,400);assert.equal(f.calls.length,0);}finally{await f.close();}});
test('owner-bound Cloud ASR/TTS project only verified Cartesia speech, not keys or vendor fields',async()=>{const f=await fixture();try{for(const input of [asr(),tts()]){const result=await f.call(input);assert.equal(result.status,200);assert.equal(result.data.status,200);const body=JSON.parse(result.data.body);assert.equal(body.provider,'cartesia');assert.equal(body.route,'cloud');assert.equal(body.requestId,input.requestId);assert.equal(body.secret,undefined);if(input.audioBase64)assert.equal(body.text,'Heard exactly once');else {assert.equal(body.contentType,'audio/mpeg');assert.deepEqual(Buffer.from(body.audioBase64,'base64'),Buffer.from([73,68,51,1]));}assert(!JSON.stringify(result).includes(paired));}assert.equal(f.calls.filter(x=>x.path==='/api/tts/cloud').length,1);assert.equal(f.calls.filter(x=>x.path==='/api/asr/cloud').length,1);}finally{await f.close();}});
test('wrong owner and unapproved synthesis fields never reach speech dispatch',async()=>{const f=await fixture();try{assert.equal((await f.call({...tts(),ownerId:'other'})).status,409);assert.equal((await f.call({...tts(),body:JSON.stringify({text:'Hi',modelId:'other',apiKey:'no'})})).status,400);assert.equal(f.calls.filter(x=>x.path==='/api/tts/cloud').length,0);}finally{await f.close();}});
test('non-Cartesia provider, wrong audio MIME and oversized audio fail closed',async()=>{for(const mode of ['wrong','type','large']){const f=await fixture();try{f.mode(mode);assert.notEqual((await f.call(tts())).data.status,200);}finally{await f.close();}}});
test('upstream billing errors are sanitized and root rotation retires the old voice response',async()=>{for(const mode of ['error','rotate']){const f=await fixture();try{f.mode(mode);const result=await f.call(tts());if(mode==='error'){assert.equal(result.data.status,402);assert(!JSON.stringify(result).includes('never-project'));}else assert.equal(result.status,409);}finally{await f.close();}}});
test('Stop aborts the in-flight proxy request without retry',async()=>{const f=await fixture();try{f.mode('wait');const controller=new AbortController(),pending=f.call(tts(),controller.signal);while(!f.signal())await new Promise(r=>setTimeout(r,5));controller.abort();await assert.rejects(pending);for(let i=0;i<50&&!f.signal().aborted;i++)await new Promise(r=>setTimeout(r,5));assert.equal(f.signal().aborted,true);assert.equal(f.calls.filter(x=>x.path==='/api/tts/cloud').length,1);}finally{await f.close();}});
test('frontend mode requires DEV, test-mock surfaces, non-native platform and explicit flag',async()=>{const source=await readFile(new URL('../apps/app/src/runtime/development-cloud-voice.ts',import.meta.url),'utf8');assert.match(source,/import\.meta\.env\.DEV===true&&import\.meta\.env\.VITE_ELIZA_DEV_ALLOW_TEST_MOCKS==='1'&&!Capacitor\.isNativePlatform\(\)&&import\.meta\.env\.VITE_ALPHA_DEV_CLOUD_VOICE==='1'/);const voice=await readFile(new URL('../apps/app/src/runtime/cloud-voice.ts',import.meta.url),'utf8');assert.match(voice,/native\.transcribeDevelopmentCloudRecording\(input\)/);assert.match(voice,/native\.synthesizeDevelopmentCloud/);assert.doesNotMatch(source,/API_KEY|credentialId|cartesia\.ai/);});

test('actual Cloud driver uses explicit paired gateway with no renderer Cloud account or double transcript send',async()=>{
 const {stripTypeScriptTypes}=await import('node:module'),vm=await import('node:vm');
 const source=(await readFile(new URL('../apps/app/src/runtime/cloud-voice.ts',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replaceAll('export async function','async function').replaceAll('export function','function').replaceAll('export type','type');
 let agent={session:{ownerId:'fixture-owner',sessionId:'fixture-session'}},uploads=0,synthesis=0,legacy=0,sends=0,release;
 const native={transcribeDevelopmentCloudRecording:async()=>{uploads++;if(release===true)await new Promise(r=>release=r);return {text:'hello',local:false};},synthesizeDevelopmentCloud:async input=>{synthesis++;assert.deepEqual(Object.keys(input).sort(),['requestId','text']);return {playbackId:'owned'};},transcribeRecording:async()=>{legacy++;},synthesize:async()=>{legacy++;}};
 const box={developmentCloudVoiceEnabled:true,registerPlugin:()=>native,connectionController:{getCloudEnvironment:()=>null,getCloudClient:()=>null,getBrowserSpeechAgent:()=>agent,getSnapshot:()=>({open:false}),subscribe:()=>()=>{},send:()=>sends++},document:{hidden:false,addEventListener(){},removeEventListener(){}},window:{addEventListener(){},removeEventListener(){}},AbortController,DOMException,markTtsPlaybackStarted(){},markTtsPlaybackEnded(){},playOwnedSpeech:async(_native,signal,prepare,current,started,strict)=>{assert.equal(strict,true);signal.throwIfAborted();current();await prepare('request');current();started();}};
 vm.runInNewContext('{'+stripTypeScriptTypes(source,{mode:'transform'})+';globalThis.create=createCloudVoice;}',box);
 const driver=box.create();assert.deepEqual(JSON.parse(JSON.stringify(await driver.transcribeRecording({recordingId:'clip',requestId:'request'}))),{text:'hello',local:false});await driver.speak('reply',new AbortController().signal);assert.equal(uploads,1);assert.equal(synthesis,1);assert.equal(legacy,0);assert.equal(sends,0);
 release=true;const stale=driver.transcribeRecording({recordingId:'clip',requestId:'request'});while(typeof release!=='function')await Promise.resolve();agent={session:{ownerId:'other',sessionId:'other'}};release();await assert.rejects(stale,/Voice agent changed/);
 box.developmentCloudVoiceEnabled=false;assert.throws(()=>box.create(),/Sign in/);box.developmentCloudVoiceEnabled=true;agent=null;assert.throws(()=>box.create(),/developer agent/);
});

test('Cloud bridge forwards numeric timing evidence without arbitrary header descriptions',async()=>{const f=await fixture();try{f.mode('timing');const result=await f.call(tts());assert.deepEqual(result.data.timings,[{name:'auth',durationMs:911},{name:'admission',durationMs:1497},{name:'synthesis',durationMs:195}]);assert.ok(!JSON.stringify(result).includes('never-project-secret'));}finally{await f.close();}});

test('Cloud bridge projects only exact reviewed/approved-hit TTS receipts and never adds them to ASR',async()=>{
 for(const receipt of ['reviewed','approved-hit']){const f=await fixture(true,receipt);try{const speech=await f.call(tts());assert.equal(speech.data.status,200);assert.equal(speech.data.moderationCache,receipt);const recognition=await f.call(asr());assert.equal(recognition.data.status,200);assert.equal(recognition.data.moderationCache,undefined);}finally{await f.close();}}
});
test('Cloud bridge drops invalid oversized and injected moderation evidence without exposing its bytes',async()=>{
 for(const value of ['hit','APPROVED-HIT','approved-hit, reviewed','approved-hit'.repeat(500),'reviewed\r\nX-Secret: never-project-secret']){const f=await fixture(true,value);try{const result=await f.call(tts());assert.equal(result.data.status,200);assert.equal(result.data.moderationCache,undefined);assert.ok(!JSON.stringify(result).includes('never-project-secret'));}finally{await f.close();}}
});
