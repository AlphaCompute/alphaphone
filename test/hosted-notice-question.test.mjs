import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
test('retained result Ask requires unchanged owner and content; cancel preserves the notice',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hosted-ask-')),previous=globalThis.window;globalThis.window=new EventTarget();
 const port={sensitive:false,review:null};globalThis.__hostedQuestionFixture=port;
 try{
  const bundle=await build({entryPoints:[resolve('apps/app/src/runtime/hosted-notice-question.ts')],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'ports',setup(b){b.onResolve({filter:/browser\/content-question$|alpha-client$|hosted-digests$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path.endsWith('content-question')?'export const reviewContentQuestion=input=>{globalThis.__hostedQuestionFixture.review=input;return ()=>input.closed(false)};':a.path.endsWith('alpha-client')?'export const alphaClient={getState:()=>({context:{sensitive:globalThis.__hostedQuestionFixture.sensitive}})};':'export const digestSummaryText=result=>result.output;'}));}}]});
  const file=join(dir,'question.mjs');writeFileSync(file,bundle.outputFiles[0].text);const {reviewHostedNoticeQuestion}=await import(pathToFileURL(file));
  const result={kind:'ready',question:true,token:'token-1',result:{runId:'run-1',output:'Your reviewed tasks are ready.'}};
  let current=true,consumed=0,discarded=0,composed=0,reported=0;
  const tick=()=>new Promise(r=>setImmediate(r));
  const options={result,current:()=>current,recheck:async()=>result,consume:async()=>{consumed++},discard:async()=>{discarded++},compose:()=>{composed++},report:()=>{reported++},closed:()=>{}};
  reviewHostedNoticeQuestion(options);port.review.closed(true);await tick();assert.equal(discarded,1);assert.equal(consumed,0);
  reviewHostedNoticeQuestion(options);port.review.compose('reviewed draft');await tick();assert.equal(consumed,1);assert.equal(composed,1);
  reviewHostedNoticeQuestion({...options,recheck:async()=>({...result,result:{...result.result,output:'changed'}})});port.review.compose('stale');await tick();assert.equal(consumed,1);assert.equal(composed,1);assert.equal(reported,1);
  reviewHostedNoticeQuestion({...options,recheck:async()=>{current=false;return result}});port.review.compose('wrong owner');await tick();assert.equal(consumed,1);assert.equal(composed,1);
  current=true;port.sensitive=true;assert.equal(reviewHostedNoticeQuestion(options),undefined);
 }finally{globalThis.window=previous;delete globalThis.__hostedQuestionFixture;rmSync(dir,{recursive:true,force:true});}
});
