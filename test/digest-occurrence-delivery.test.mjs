import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
// MVP-38 at the source level: one retained record and one delivery per digest occurrence across
// reconnect, a lost acknowledgement, an interrupted notice and a restart, and an honest presentation
// of an occurrence the agent recorded without running it. This drives the app's own inbox and
// presentation code against a synthetic result stream. It is not resident-runtime, emulator or
// device evidence.
const root=resolve(import.meta.dirname,'..');
const run=script=>JSON.parse(execFileSync(process.execPath,['--import=tsx','--input-type=module','-e',script],{cwd:root,encoding:'utf8',timeout:120000}));
const prelude=`
const d=await import(${JSON.stringify(resolve(root,'apps/app/src/runtime/hosted-digests.ts'))});
const row=(cursor,runId,status,scheduledAt,extra={})=>({cursor,runId,workflowId:'loop-'+(extra.loop||'morning'),workflowVersionId:'v1',templateVersion:'t1',scheduledAt,source:{id:'s-'+(extra.loop||'morning'),revision:'r1',observedAt:'2026-10-01T06:00:00.000Z',expiresAt:'2026-10-08T06:00:00.000Z',type:'explicit_snapshot'},status,startedAt:scheduledAt,completedAt:extra.completedAt||scheduledAt,output:status==='missed'?{status:'missed',text:'The scheduled time was missed. No backlog was executed.'}:status==='overlap'?{status:'overlap',text:'An earlier occurrence is still active. This occurrence did not run.'}:'Brief '+runId,error:null});
const memory=()=>{const slots=new Map(),writes=[];return {slots,writes,read:async slot=>slots.has(slot)?structuredClone(slots.get(slot)):null,write:async(slot,value)=>{writes.push(slot);slots.set(slot,structuredClone(value));},remove:async slot=>{slots.delete(slot);}};};
// A result stream with per-client cursors, like /api/workflow/hosted/results and /results/ack.
const server=rows=>{const acks=new Map(),calls={results:0,ack:0};let failAck=0;return {calls,acks,failNextAck(){failAck++;},push(value){rows.push(value);},client:new d.HostedDigestProtocol(async(path,body)=>{
 if(path.startsWith('/api/workflow/hosted/results?clientId=')){calls.results++;const id=decodeURIComponent(path.split('=')[1]);return {entries:structuredClone(rows.filter(r=>r.cursor>(acks.get(id)||0)).slice(0,50))};}
 if(path==='/api/workflow/hosted/results/ack'){calls.ack++;if(failAck){failAck--;throw Error('connection lost');}acks.set(body.clientId,Math.max(acks.get(body.clientId)||0,body.cursor));return {};}
 throw Error('unexpected '+path);})};};
const signal=new AbortController().signal,out={};
`;

test('a missed, overlapping or unavailable occurrence is labelled as not run and never becomes the Home brief',()=>{
 const out=run(prelude+`
out.labels=['missed','overlap','unavailable','finished','failed','completed'].map(d.digestStatusLabel);
out.ran=['missed','overlap','unavailable','finished','failed','constructor','toString'].map(status=>d.digestRan({status}));
const ranRow=row(1,'run-a','finished','2026-10-06T06:00:00.000Z'),missedRow=row(2,'run-b','missed','2026-10-07T06:00:00.000Z');
out.missedText=d.digestSummaryText(missedRow);
d.rememberRetainedDigests([ranRow,missedRow],'Phone agent');out.home=d.latestRetainedDigest();
d.rememberRetainedDigests([missedRow],'Phone agent');out.onlyMissed=d.latestRetainedDigest();
d.rememberRetainedDigests([row(3,'run-c','overlap','2026-10-08T06:00:00.000Z'),row(4,'run-d','unavailable','2026-10-09T06:00:00.000Z')]);out.neverRan=d.latestRetainedDigest();
d.rememberRetainedDigests([ranRow,missedRow,row(5,'run-e','failed','2026-10-08T06:00:00.000Z')]);out.failed=d.latestRetainedDigest()?.status;
console.log(JSON.stringify(out));`);
 assert.deepEqual(out.labels,['Missed — not run','Skipped — an earlier run was still active','Not run — source unavailable','finished','failed','completed']);
 assert.deepEqual(out.ran,[false,false,false,true,true,true,true]);
 assert.equal(out.missedText,'The scheduled time was missed. No backlog was executed.');
 assert.deepEqual(out.home,{summary:'Brief run-a',ranAt:'2026-10-06T06:00:00.000Z',agent:'Phone agent',status:'finished'});
 assert.equal(out.onlyMissed,null);assert.equal(out.neverRan,null);assert.equal(out.failed,'failed');
});

test('a schedule keeps its reviewed time zone and says so when the device clock is in another zone',()=>{
 const out=run(prelude+`
const loop=(timeZone,extra={})=>({removed:false,...extra,spec:{version:1,template:'morning',sourceId:'s',sourceRevision:'r',timeZone,localTime:'08:00',enabled:true,...(extra.spec||{})}});
const winter=Date.parse('2026-01-15T12:00:00Z'),summer=Date.parse('2026-07-15T12:00:00Z');
out.same=d.digestZoneNote(loop('America/New_York'),'America/New_York',winter);
out.travel=d.digestZoneNote(loop('America/New_York'),'Europe/Paris',winter);
out.alias=d.digestZoneNote(loop('UTC'),'Etc/UTC',winter);
// London and Lisbon share an offset all year; Lagos (UTC+1 all year) matches London only during British Summer Time.
out.sameOffset=d.digestZoneNote(loop('Europe/London'),'Europe/Lisbon',summer);
out.summerEqual=d.digestZoneNote(loop('Europe/London'),'Africa/Lagos',summer);
out.winterDiffers=d.digestZoneNote(loop('Europe/London'),'Africa/Lagos',winter);
out.paused=d.digestZoneNote(loop('America/New_York',{spec:{enabled:false}}),'Europe/Paris',winter);
out.removed=d.digestZoneNote(loop('America/New_York',{removed:true}),'Europe/Paris',winter);
out.invalid=d.digestZoneNote(loop('Not/AZone'),'Europe/Paris',winter);
console.log(JSON.stringify(out));`);
 assert.equal(out.same,'');assert.equal(out.alias,'');assert.equal(out.sameOffset,'');assert.equal(out.summerEqual,'');assert.equal(out.paused,'');assert.equal(out.removed,'');assert.equal(out.invalid,'');
 assert.equal(out.travel,'Runs at 08:00 America/New_York time, not this device’s current time zone (Europe/Paris). Review the schedule to change it.');
 assert.match(out.winterDiffers,/^Runs at 08:00 Europe\/London time, not this device’s current time zone \(Africa\/Lagos\)\./);
});

test('each occurrence is retained and delivered once across a lost acknowledgement, an interrupted notice and a restart',()=>{
 const out=run(prelude+`
const rows=[row(1,'run-morning','finished','2026-10-06T06:00:00.000Z'),row(2,'run-evening','finished','2026-10-06T18:00:00.000Z',{loop:'evening'}),row(3,'run-missed','missed','2026-10-07T06:00:00.000Z')];
const s=server(rows),storage=memory(),delivered=[];let failNotice='run-evening';
// The notice ledger is idempotent per run (browser hostedResultsDocument, native HostedResultNotices).
const visible=new Set(),publish=async result=>{if(failNotice===result.runId){failNotice='';throw Error('notice channel unavailable');}delivered.push(result.runId);visible.add(result.runId);};
const inbox=()=>new d.DigestInbox(storage,'scope',publish);
// 1. The acknowledgement is lost after the local commit.
s.failNextAck();out.firstError=await inbox().sync(s.client,signal).then(()=>'',error=>error.message);
out.afterLostAck={retained:(await inbox().history()).map(r=>r.runId),delivered:[...delivered]};
// 2. Reconnect in a new process: the same IDs replay, nothing is stored or delivered twice.
out.second=(await inbox().sync(s.client,signal)).map(r=>[r.runId,r.status]);out.afterReconnect=[...delivered];
// 3. Further syncs, including two overlapping ones from two surfaces, deliver nothing more.
await Promise.all([inbox().sync(s.client,signal),inbox().sync(s.client,signal)]);await inbox().sync(s.client,signal);
out.final={delivered:[...delivered],visible:[...visible].sort(),acked:[...s.acks.values()],index:storage.slots.get('scope')};
// 4. A later occurrence is its own record and its own single delivery.
s.push(row(4,'run-next','finished','2026-10-08T06:00:00.000Z'));await inbox().sync(s.client,signal);await inbox().sync(s.client,signal);
out.next={delivered:[...delivered],history:(await inbox().history()).map(r=>r.runId)};
// 5. A crash after the notice posted but before that fact was saved may publish again; the ledger keeps one notice.
const crash=memory();let dropped=false;const flaky={...crash,write:async(slot,value)=>{if(slot==='scope'&&!dropped&&Array.isArray(value.pendingNotices)&&value.ids?.length===1&&value.pendingNotices.length===0){dropped=true;throw Error('process killed');}return crash.write(slot,value);}};
const one=server([row(1,'run-solo','finished','2026-10-06T06:00:00.000Z')]),published=[],ledger=new Set(),post=async result=>{published.push(result.runId);ledger.add(result.runId);};
out.crashError=await new d.DigestInbox(flaky,'scope',post).sync(one.client,signal).then(()=>'',error=>error.message);
await new d.DigestInbox(crash,'scope',post).sync(one.client,signal);
out.crash={published,visible:[...ledger],history:(await new d.DigestInbox(crash,'scope',post).history()).map(r=>r.runId)};
// 6. The same run ID arriving with different content is refused, not shown.
const changed=server([row(1,'run-solo','finished','2026-10-06T06:00:00.000Z')]);const tampered=server([{...row(1,'run-solo','finished','2026-10-06T06:00:00.000Z'),output:'Different brief'}]);
const fresh=memory();await new d.DigestInbox(fresh,'scope').sync(changed.client,signal);fresh.slots.get('scope').clientId='reader2';
out.tampered=await new d.DigestInbox(fresh,'scope').sync(tampered.client,signal).then(()=>'',error=>error.message);
console.log(JSON.stringify(out));`);
 assert.equal(out.firstError,'connection lost');
 // The interrupted notice (run-evening) stays pending; the others were delivered before the ack failed.
 assert.deepEqual(out.afterLostAck,{retained:['run-morning','run-evening','run-missed'],delivered:['run-morning','run-missed']});
 assert.deepEqual(out.second,[['run-morning','finished'],['run-evening','finished'],['run-missed','missed']]);
 assert.deepEqual(out.afterReconnect,['run-morning','run-missed','run-evening']);
 assert.deepEqual(out.final.delivered,['run-morning','run-missed','run-evening']);
 assert.deepEqual(out.final.visible,['run-evening','run-missed','run-morning']);
 assert.deepEqual(out.final.acked,[3]);
 assert.deepEqual(out.final.index.ids,['run-morning','run-evening','run-missed']);assert.deepEqual(out.final.index.pendingNotices,[]);assert.deepEqual(out.final.index.pendingRemoval,[]);
 assert.deepEqual(out.next,{delivered:['run-morning','run-missed','run-evening','run-next'],history:['run-morning','run-evening','run-missed','run-next']});
 assert.equal(out.crashError,'process killed');
 assert.deepEqual(out.crash,{published:['run-solo','run-solo'],visible:['run-solo'],history:['run-solo']});
 assert.equal(out.tampered,'Saved digest result changed');
});
