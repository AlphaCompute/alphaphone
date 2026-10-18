import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const source=readFileSync('backend/cloud-inference-diagnostics.ts','utf8');
const {cloudFailureMetadata,cloudInferenceDiagnosticFetch}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'transform'})).toString('base64'));
const endpoint='https://api.eliza.app/api/v1/chat/completions';
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
test('failed Cloud metadata admits only fixed classifications and known parameter paths',()=>{
 const value=cloudFailureMetadata({error:{code:'invalid_json_schema',param:'response_format.json_schema.schema',message:'Invalid JSON schema PRIVATE_PROMPT',secret:'PRIVATE_KEY'},account:'PRIVATE_ID'});
 assert.deepEqual(value,{status:400,metadata:'available',code:'invalid_json_schema',parameter:'response_format.json_schema.schema',reason:'invalid_schema'});
 for(const privateValue of ['PRIVATE_KEY','messages[0].PRIVATE_TEXT','https://secret.invalid','messages[10000].content','123.456.789.012','messages.0.123.456']){
  assert.deepEqual(cloudFailureMetadata({error:{code:privateValue,param:privateValue,message:privateValue}}),{status:400,metadata:'available'});
 }
});
test('observer forwards request identities once, never inspects outbound secrets, and preserves exact response',async()=>{
 const input=new URL(endpoint),init={method:'POST'};
 for(const name of ['headers','body'])Object.defineProperty(init,name,{get(){throw Error('Outbound data was read');}});
 const response=Response.json({error:{code:'invalid_parameter',param:'max_tokens'}} ,{status:400});let calls=0;const reports=[];
 const wrapped=cloudInferenceDiagnosticFetch(async(i,o)=>{calls++;assert.equal(i,input);assert.equal(o,init);return response;},v=>reports.push(v),new AbortController().signal);
 assert.equal(await wrapped(input,init),response);assert.equal(calls,1);assert.deepEqual(await response.json(),{error:{code:'invalid_parameter',param:'max_tokens'}});
 await tick();assert.equal(reports.length,1);assert.equal(reports[0].parameter,'max_tokens');
});
test('only exact failure endpoint is observed; successful and unrelated responses are never cloned',async()=>{
 for(const [url,status,method] of [[endpoint,200,'POST'],[endpoint,400,'GET'],[endpoint+'?private=secret',400,'POST'],['https://other.invalid/api/v1/chat/completions',400,'POST'],['https://api.eliza.app/api/v1/embeddings',400,'POST']]){
  const response=new Response('original',{status});response.clone=()=>{throw Error('Must not clone');};const reports=[];
  assert.equal(await cloudInferenceDiagnosticFetch(async()=>response,v=>reports.push(v),new AbortController().signal)(url,{method}),response);await tick();assert.deepEqual(reports,[]);assert.equal(await response.text(),'original');
 }
});
test('oversized, malformed, unavailable clones and throwing reporters cannot change original failure',async()=>{
 for(const body of ['x'.repeat(17000),'not-json']){
  const response=new Response(body,{status:400}),reports=[];const wrapped=cloudInferenceDiagnosticFetch(async()=>response,v=>{reports.push(v);throw Error('Logger unavailable');},new AbortController().signal);
  assert.equal(await wrapped(endpoint,{method:'POST'}),response);await tick();assert.deepEqual(reports,[{status:400,metadata:'unavailable'}]);assert.equal(await response.text(),body);
 }
 const consumed=new Response('body',{status:400});await consumed.text();const reports=[];
 assert.equal(await cloudInferenceDiagnosticFetch(async()=>consumed,v=>reports.push(v),new AbortController().signal)(endpoint,{method:'POST'}),consumed);await tick();assert.deepEqual(reports,[{status:400,metadata:'unavailable'}]);
});
test('retiring owner cancels hanging diagnostic read without suppressing or cancelling original response',async()=>{
 const owner=new AbortController(),reports=[];let cancelled=false;
 const response=new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:400});
 const wrapped=cloudInferenceDiagnosticFetch(async()=>response,v=>reports.push(v),owner.signal);
 assert.equal(await wrapped(endpoint,{method:'POST'}),response);owner.abort();await tick();assert.deepEqual(reports,[]);assert.equal(response.bodyUsed,false);
 await response.body.cancel();await tick();assert.equal(cancelled,true);
});
test('hanging error metadata is time bounded and transport rejections remain unchanged without retry',async()=>{
 const response=new Response(new ReadableStream(),{status:400}),reports=[];
 assert.equal(await cloudInferenceDiagnosticFetch(async()=>response,v=>reports.push(v),new AbortController().signal)(endpoint,{method:'POST'}),response);
 await new Promise(resolve=>setTimeout(resolve,850));assert.deepEqual(reports,[{status:400,metadata:'unavailable'}]);assert.equal(response.bodyUsed,false);await response.body.cancel();
 const failure=new Error('Synthetic transport failure');let calls=0;
 await assert.rejects(cloudInferenceDiagnosticFetch(async()=>{calls++;throw failure;},()=>{throw Error('No report expected');},new AbortController().signal)(endpoint,{method:'POST'}),error=>error===failure);assert.equal(calls,1);
});
