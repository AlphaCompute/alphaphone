// Actual typed client over loopback HTTP plus a durable-journal contract fixture.
// Android journal persistence is verified separately by native instrumentation.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
if (!process.execArgv.includes('--experimental-transform-types')) process.exit(spawnSync(process.execPath, ['--experimental-transform-types', process.argv[1]], { stdio: 'inherit' }).status ?? 1);
const { DeviceActions } = await import('../apps/app/src/runtime/device-actions.ts');
const session = { ownerId: 'owner', agentId: 'agent', origin: 'https://agent.example', sessionId: 'session' };
const credential = { installationId: 'device', enrollmentId: 'enrollment', key: 'a'.repeat(64) };
let state = 'pending', attemptId, effects = 0, mode = 'ok', claims = 0;
const digest = 'b'.repeat(64), records = new Map();
const proposal = () => ({ id: 'proposal', digest, state, subjectUserId: 'owner', requestedBy: 'agent', action: 'device_action', expiresAt: new Date(Date.now()+600000).toISOString(), payload: { action: 'device_action', version: 1, installationId: 'device', enrollmentId: 'enrollment', operation: { type: 'create_note', title: 'Fixture note', body: 'Explicit reviewed body' } }, execution: attemptId ? { attemptId } : null });
const server = http.createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  const data = body ? JSON.parse(body) : null;
  let status = 200;
  if (req.url.endsWith('/decision')) { assert.equal(data.digest, digest); state = data.decision === 'approve' ? 'approved' : 'rejected'; }
  if (req.url.endsWith('/claim')) { claims++; assert.equal(state, 'approved'); state = 'executing'; attemptId = 'attempt'; if (mode === 'lost-claim') status = 503; }
  if (req.url.endsWith('/receipt')) { assert.equal(data.attemptId, 'attempt'); if (mode === 'receipt-outage') status=503; else state=data.receipt.outcome === 'applied' ? 'done' : 'reconciliation_required'; }
  if (req.url.endsWith('/reconciliation')) { assert.equal(data.resolution.confirmed,true); state = data.resolution.outcome === 'applied' ? 'done' : 'retryable'; }
  res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(req.method === 'GET' ? { proposals: [proposal()] } : { proposal: proposal(), digest }));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const request = async (path, body, signal) => { const res=await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method:body===undefined?'GET':'POST', body:body===undefined?undefined:JSON.stringify(body), signal }); if(!res.ok) throw new Error('Synthetic outage'); return res.json(); };
const journal = {
 reserve: async input => { const existing=records.get(input.proposalId); if(existing) return {created:false,entry:existing}; const entry={...input,phase:'reserved'};records.set(input.proposalId,entry);return {created:true,entry}; },
 markApplying: async input => { const e=records.get(input.proposalId);assert.equal(e.phase,'reserved');Object.assign(e,{phase:'applying',attemptId:input.attemptId}); },
 finish: async input => { const e=records.get(input.proposalId);assert.equal(e.phase,'applying');Object.assign(e,input,{phase:'terminal'}); },
 list: async () => ({entries:[...records.values()]}), get:async input=>({entry:records.get(input.proposalId)||null}),
};
const make=()=>new DeviceActions(session,credential,'c'.repeat(64),request,journal,async()=>{assert.equal(records.get('proposal').phase,'applying');effects++;return {status:'succeeded',summary:'Saved fixture note'};});
const context={view:'notes',revision:2,sensitive:false}, reordered={view:'notes',sensitive:false,revision:2};
const signal=()=>new AbortController().signal;
try {
 const client=make();const cards=await client.pending(context,signal());assert.equal(cards[0].title,'Create note');assert.equal(cards[0].description,'Create note\n“Fixture note”\nExplicit reviewed body');mode='receipt-outage';
 assert.equal((await client.approve('proposal',reordered,signal())).status,'succeeded');assert.equal(effects,1);assert.equal(state,'executing');
 mode='ok';await make().syncReceipts(signal());assert.equal(state,'done');assert.equal(effects,1);
 // Even a stale server pending response after restart cannot repeat a journaled effect.
 state='pending';const restarted=make();await restarted.pending(context,signal());assert.equal((await restarted.approve('proposal',context,signal())).status,'unknown');assert.equal(effects,1);
 records.clear();state='pending';attemptId=undefined;mode='lost-claim';const lost=make();await lost.pending(context,signal());await lost.approve('proposal',context,signal());assert.equal(effects,1);assert.equal(records.get('proposal').phase,'reserved');assert.equal(state,'executing');
 mode='ok';await make().reconcile('proposal','not_applied',signal());assert.equal(state,'retryable');assert.equal(effects,1);
 records.clear();state='pending';const stale=make();await stale.pending(context,signal());await assert.rejects(stale.approve('proposal',{...context,revision:3},signal()));assert.equal(records.size,0);
 await stale.reject('proposal',signal());assert.equal(state,'rejected');assert.equal(claims,2);
 console.log('PASS: device HTTP decision/claim/receipt, journal-before-effect, receipt recovery across client restart, no duplicate effect, lost-claim reconciliation, context property-order equality/stale rejection, explicit rejection. Synthetic only.');
} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
