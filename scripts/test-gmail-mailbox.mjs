// Gmail mailbox helpers against a closed provider-boundary fixture. No network, account or mail.
import assert from 'node:assert/strict';
import { CloudProtocolError } from '../apps/app/src/runtime/cloud-protocol.ts';
import { classifyGmailFailure, disconnectGmailAccount, setGmailReadState } from '../apps/app/src/runtime/gmail-mailbox.ts';
const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
const signal = () => new AbortController().signal;
function readStateClient({ state = 'succeeded', tamper = false, result } = {}) {
  const calls = { prepare: [], dispatch: [] };
  return { calls,
    async gmailPrepareOperation(grant, requestId, proposal) {
      calls.prepare.push({ grant, requestId, proposal });
      const review = { kind: proposal.kind, messageId: tamper ? 'other' : proposal.messageId, expectedHistoryId: proposal.expectedHistoryId, from: 'owner@example.invalid' };
      return { review, receipt: { requestId, kind: proposal.kind, state: 'prepared', reviewDigest: await digest(JSON.stringify(review)), providerResult: null, rejectionCode: null } };
    },
    async gmailDispatchOperation(grant, requestId, reviewDigest, proposal) {
      calls.dispatch.push({ grant, requestId, reviewDigest, proposal });
      return { requestId, kind: proposal.kind, state, reviewDigest, providerResult: state === 'succeeded' ? (result ?? { messageId: proposal.messageId, unread: proposal.kind === 'mark-unread', historyId: 'h2', labelIds: [] }) : null, rejectionCode: null };
    } };
}
for (const unread of [false, true]) {
  const client = readStateClient();
  assert.deepEqual(await setGmailReadState(client, 'grant', { messageId: 'm1', expectedHistoryId: 'h1', unread }, signal()), { unread, historyId: 'h2' });
  assert.deepEqual(client.calls.prepare[0].proposal, { kind: unread ? 'mark-unread' : 'mark-read', messageId: 'm1', expectedHistoryId: 'h1' });
  assert.equal(client.calls.dispatch.length, 1); assert.equal(client.calls.dispatch[0].requestId, client.calls.prepare[0].requestId);
}
{ const client = readStateClient({ tamper: true });
  await assert.rejects(setGmailReadState(client, 'grant', { messageId: 'm1', expectedHistoryId: 'h1', unread: false }, signal()), /does not match/);
  assert.equal(client.calls.dispatch.length, 0, 'a changed review is never dispatched'); }
for (const state of ['outcome-unknown', 'dispatched', 'rejected']) {
  const client = readStateClient({ state });
  assert.equal(await setGmailReadState(client, 'grant', { messageId: 'm1', expectedHistoryId: 'h1', unread: false }, signal()), null);
  assert.equal(client.calls.dispatch.length, 1, `${state} is reported, never repeated`);
}
{ const client = readStateClient({ result: { messageId: 'm1', unread: true } });
  assert.equal(await setGmailReadState(client, 'grant', { messageId: 'm1', expectedHistoryId: 'h1', unread: false }, signal()), null, 'contradicting readback is not reported as success'); }

const accounts = connected => [{ connectionId: 'grant', label: 'Mailbox', configured: true, connected, reason: '', grantedCapabilities: connected ? ['google.gmail.triage'] : [] }];
const disconnectClient = ({ fail = false, after = false, readFails = false } = {}) => { const calls = { disconnect: 0, reads: 0 }; return { calls,
  async disconnectGmail() { calls.disconnect++; if (fail) throw new CloudProtocolError('http', 502); },
  async gmailAccounts() { calls.reads++; if (readFails) throw new TypeError('Failed to fetch'); return accounts(after); } }; };
for (const [options, outcome] of [[{}, 'disconnected'], [{ after: true }, 'still-connected'], [{ readFails: true }, 'unconfirmed'], [{ fail: true, after: true }, 'unconfirmed'], [{ fail: true }, 'disconnected'], [{ fail: true, readFails: true }, 'unconfirmed']]) {
  const client = disconnectClient(options);
  assert.equal((await disconnectGmailAccount(client, 'grant', signal())).outcome, outcome, JSON.stringify(options));
  assert.equal(client.calls.disconnect, 1, 'disconnect is requested once, never retried');
}
assert.equal(classifyGmailFailure(new CloudProtocolError('http', 409), 'read').kind, 'revoked');
assert.equal(classifyGmailFailure(new CloudProtocolError('http', 409), 'operation').kind, 'stale');
assert.equal(classifyGmailFailure(new CloudProtocolError('http', 403), 'operation').kind, 'revoked');
assert.equal(classifyGmailFailure(new TypeError('Failed to fetch'), 'read').kind, 'offline');
assert.equal(classifyGmailFailure(new Error('Connection timed out'), 'read').kind, 'offline');
assert.equal(classifyGmailFailure(new CloudProtocolError('invalid-response'), 'read').kind, 'unavailable');
assert.equal(classifyGmailFailure(new CloudProtocolError('http', 500), 'read', false).kind, 'offline');
console.log('PASS: reviewed read-state dispatch once with digest/readback checks, confirmed disconnect outcomes without retry, and offline/revoked/stale classification. Fixture only.');
