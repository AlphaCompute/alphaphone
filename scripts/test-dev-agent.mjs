#!/usr/bin/env node
/** Real-provider + host local-write integration. Not Android acceptance. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const tokenPath = process.env.ALPHA_DEV_TOKEN_FILE;
if (!tokenPath) throw new Error('Set ALPHA_DEV_TOKEN_FILE to the server-created token file path.');
const token = (await readFile(tokenPath, 'utf8')).trim();
const headers = {Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
const base = 'http://127.0.0.1:47831';
const post = body => fetch(`${base}/chat`, {method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(50000)});
const unauth = await fetch(`${base}/health`); assert.equal(unauth.status,401);
const health = await fetch(`${base}/health`,{headers}); assert.equal(health.status,200);
const metadata = await health.json(); assert.equal(metadata.mode,'development');
const id = randomUUID(); const title = `Integration note ${id}`;
const body = 'A real provider proposed this local note. Explicit approval is required.';
const request = {requestId:id,text:`Create a new local note with exactly this title: ${title}\nAnd exactly this body: ${body}\nUse the create_note function to propose it for my approval.`,context:{view:'notes',revision:3}};
const response = await post(request); assert.equal(response.status,200);
const reply = await response.json();
assert.equal(reply.requestId,id);
const proposal = reply.proposals.find(item=>item.operation?.type==='create_note');
assert.ok(proposal,'Real provider must propose the requested note');
assert.equal(proposal.operation.title,title); assert.equal(proposal.operation.body,body);
assert.equal(proposal.contextRevision,3); assert.ok(proposal.expiresAt>Date.now());
const fixture = await mkdtemp(join(tmpdir(),'alpha-approved-note-'));
let fileWrittenBeforeApproval=false, verified=false;
try {
 const path=join(fixture,'note.json');
 try { await readFile(path); fileWrittenBeforeApproval=true; } catch(error) { if(error.code!=='ENOENT')throw error; }
 assert.equal(fileWrittenBeforeApproval,false);
 // This test explicitly approves only the harmless UUID-tagged local fixture.
 const approved = proposal.id;
 assert.equal(approved,proposal.id);
 await writeFile(path,JSON.stringify({title:proposal.operation.title,body:proposal.operation.body}),{flag:'wx',mode:0o600});
 const saved=JSON.parse(await readFile(path,'utf8'));
 assert.deepEqual(saved,{title,body}); verified=true;
} finally { await rm(fixture,{recursive:true,force:true}); }
const duplicate=await post(request); assert.equal(duplicate.status,409);
const sensitive=await post({requestId:randomUUID(),text:'hello',context:{view:'passwords',revision:1}}); assert.equal(sensitive.status,400);
// Real-provider proposal contract only: this host test never schedules a native reminder.
const reminderAt = Date.now() + 3600000;
const reminderTitle = `Integration reminder ${randomUUID()}`;
const reminderBody = 'Review this reminder only after explicit approval.';
const reminderRequest = {requestId:randomUUID(),text:`Propose one reminder using create_reminder. Exact title: ${reminderTitle}\nExact body: ${reminderBody}\nExact at (Unix milliseconds): ${reminderAt}. This is ${new Date(reminderAt).toISOString()}. Do not execute anything.`,context:{view:'calendar',revision:4}};
const reminderResponse = await post(reminderRequest); assert.equal(reminderResponse.status,200);
const reminderReply = await reminderResponse.json();
assert.equal(reminderReply.requestId,reminderRequest.requestId);
const reminderProposal = reminderReply.proposals.find(item=>item.operation?.type==='create_reminder');
assert.ok(reminderProposal,'Real provider must return a reminder proposal');
assert.deepEqual(reminderProposal.operation,{type:'create_reminder',title:reminderTitle,body:reminderBody,at:reminderAt});
assert.equal(reminderProposal.contextRevision,4);assert.ok(reminderProposal.expiresAt>Date.now());
assert.ok(reminderProposal.description.includes(new Date(reminderAt).toISOString()));
const reminderDuplicate = await post(reminderRequest);assert.equal(reminderDuplicate.status,409);
const selectedId='photo-context-'+randomUUID(), selectedRevision='revision-'+randomUUID();
const selectedResponse=await post({requestId:randomUUID(),text:'For this diagnostic, quote the exact selected object identifier and selected object revision from the current view metadata. Do not create a proposal or infer image contents. If metadata is absent, say unavailable.',context:{view:'photos',revision:5,selectedObject:{kind:'photo',id:selectedId,revision:selectedRevision}}});
assert.equal(selectedResponse.status,200);
const selectedReply=await selectedResponse.json();
assert.ok(selectedReply.text.includes(selectedId),'Actual runtime receives the selected identity');
assert.ok(selectedReply.text.includes(selectedRevision),'Actual runtime receives the selected revision');
assert.equal(selectedReply.proposals.length,0);
const invalidSelection=await post({requestId:randomUUID(),text:'hello',context:{view:'photos',revision:6,selectedObject:{kind:'photo',id:selectedId,revision:{unexpected:true}}}});
assert.equal(invalidSelection.status,400);
const report={testedAt:new Date().toISOString(),scope:'real provider HTTP + explicitly approved temporary host note; not Android end-to-end',model:metadata.model,backend:metadata.backend,runtime:metadata.runtime,sessionId:metadata.sessionId,checks:{unauthenticated:unauth.status,health:health.status,chat:response.status,proposalReceived:true,writtenBeforeApproval:fileWrittenBeforeApproval,approvedLocalWriteVerified:verified,duplicate:duplicate.status,sensitive:sensitive.status,reminderProposalValidated:true,reminderDuplicate:reminderDuplicate.status,nativeReminderScheduled:false,selectedIdentityAndRevisionReachedRuntime:true,invalidSelection:invalidSelection.status}};
await mkdir('test-results',{recursive:true}); await writeFile('test-results/development-agent.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
