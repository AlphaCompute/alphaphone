import { pauseHostedBackground } from './hosted-background';
import {developmentDeviceStore,developmentActionJournal} from './local-agent-storage';
import { stopLocalAgent, configureLocalProvider, LocalAgentProtocol, localAgentPackaged, browserLocalAgentEnabled } from './local-agent';
import type {DeviceRecovery} from "./device-actions";
import type { WorkflowPhoneReview } from './workflow-device-contract';
import { AlphaClientError } from './alpha-client';
import { WorkflowProtocol, WorkflowHttpError } from './workflow-protocol';
import { registerPlugin } from '@capacitor/core';
import { DeviceActions, actionScope, type DeviceCredential, type DeviceExecutor, type ActionJournal } from './device-actions';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isAndroid } from '../native';
import type { ActionProposal, OperationReceipt, ContextEnvelope, VerifiedSession } from './alpha-client';
import { CloudProtocol, CloudProtocolError, CloudProvisionAcceptedError, type CloudAgent, type CloudEnvironment, type CloudPhoneTarget } from './cloud-protocol';
import { RemoteProtocol } from './remote-protocol';
import { phoneContextMessage } from './phone-context';
import { cloudCredentialStore, remoteCredentialStore, nativeCloudRequest, nativeRemoteRequest, openConnectionBrowser, secureConnectionStore } from './native-connection';
import './connection-ui.css';

type Selection = { kind: 'resident' } | { kind: 'offline' } | { kind: 'none' } | { kind: 'mock' } | { kind: 'remote' | 'local'; origin: string } | { kind: 'cloud'; environment: CloudEnvironment; agentId: string; ownerId?: string };
export interface CloudServiceSession { environment: CloudEnvironment; userId: string; organizationId?: string; sessionId: string; credentialId: string }
export interface RestoredMessage { id: string; from: 'user' | 'agent'; text: string }
export interface ConnectionSnapshot {
  phoneActionsAvailable: boolean; phoneCapabilityReason: string;
  conversations: Array<{ id: string; title: string }>;
  history: { sessionId: string; conversationId: string; revision: number; messages: RestoredMessage[] } | null;
  actionHistory: Array<{ id: string; state: string; description: string }>;
  cloudAccount: CloudServiceSession | null;
  open: boolean; busy: boolean; message: string; error: string;
  kind: 'offline' | 'remote' | 'local' | 'resident' | 'cloud'; name: string;
  session: VerifiedSession | null; agents: CloudAgent[];
}
type Active = { kind: 'resident'; remote: LocalAgentProtocol; origin: string; actions?: DeviceActions } | { kind: 'remote' | 'local'; remote: RemoteProtocol; origin: string; actions?: DeviceActions } | { kind: 'cloud'; cloud: CloudProtocol; agentId: string; actions?: DeviceActions; phoneTarget?: CloudPhoneTarget; voiceExpiresAt?: number };
const SELECTION = 'alpha.connection.selection.v1';
const CLOUD_SERVICE = 'alpha.connection.cloud-service.v1';
const CONVERSATIONS = 'alpha.connection.conversations.v1';
const listeners = new Set<() => void>();
let state: ConnectionSnapshot = { phoneActionsAvailable:false, phoneCapabilityReason:'', actionHistory: [], conversations: [], history: null, cloudAccount: null, open: false, busy: false, message: '', error: '', kind: 'offline', name: 'Offline', session: null, agents: [] };
let active: Active | null = null, operation: AbortController | null = null;
let startup: Promise<void> | null = null, epoch = 0;
let sending: AbortController | null = null;
const conversationMemory = new Map<string, string>();
const actionReceipts = new Map<string, { sessionId: string; result: Promise<OperationReceipt> }>();
let deviceRecovery: DeviceRecovery | undefined;
let deviceExecutor: DeviceExecutor = async () => ({ status: 'failed', summary: 'Device action executor is unavailable.' });
const actionJournal = registerPlugin<ActionJournal>('AlphaActionJournal');
let cloud = makeCloud('production');
let service: { client: CloudProtocol; identity: CloudServiceSession } | null = null;
function detachService() { service = null; update({ cloudAccount: null }); }
async function verifyService(client: CloudProtocol, signal: AbortSignal) {
  const credential = await cloudCredentialStore.read(client.environment); signal.throwIfAborted();
  if (!credential?.credentialId) throw new Error('Cloud credentials are unavailable. Sign in again.');
  const identity = await client.identity(signal); signal.throwIfAborted();
  if ((await cloudCredentialStore.read(client.environment))?.credentialId !== credential.credentialId) throw new Error('Cloud account changed. Try again.');
  signal.throwIfAborted();
  const same = service?.identity.environment === client.environment && service.identity.userId === identity.userId && service.identity.credentialId === credential.credentialId;
  const account = { ...identity, credentialId: credential.credentialId, environment: client.environment, sessionId: same ? service!.identity.sessionId : crypto.randomUUID() };
  localStorage.setItem(CLOUD_SERVICE, client.environment);
  service = { client, identity: account }; update({ cloudAccount: account });
  return identity;
}
function detachCloudTarget() { if (active?.kind === 'cloud') retire(); }
function makeCloud(environment: CloudEnvironment) { return new CloudProtocol(environment, nativeCloudRequest, cloudCredentialStore, openConnectionBrowser); }
function update(patch: Partial<ConnectionSnapshot>) { state = { ...state, ...patch }; listeners.forEach(listener => listener()); }
function save(selection: Selection) { localStorage.setItem(SELECTION, JSON.stringify(selection)); }
function retire(name = 'Offline') {
  const retirement=state.session?pauseHostedBackground(state.session.sessionId):Promise.resolve();
  void retirement.catch(()=>update({error:'Background delivery could not be retired. Reconnect to reset it.'}));
  if (active?.kind === 'cloud') { active.cloud.setPhoneTarget(null); if (state.session) void secureConnectionStore.remove(`cloud-runtime:${state.session.sessionId}`).catch(()=>{}); }
  actionReceipts.clear();
  epoch++;
  sending?.abort(new DOMException('The connection changed.', 'AbortError'));
  sending = null;
  active = null;
  update({ phoneActionsAvailable:false, phoneCapabilityReason:'', session: null, kind: 'offline', name, conversations: [], history: null, actionHistory: [] });
  return retirement;
}
function persistOffline(): string {
  try { save({ kind: 'offline' }); return ''; }
  catch {
    try { localStorage.removeItem(SELECTION); } catch { /* The visible error explains restart uncertainty. */ }
    return 'Offline now, but this preference could not be saved. Check the connection again after restarting the app.';
  }
}
function expired(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return ('status' in error && error.status === 401) || ('code' in error && ['expired', 'credentials-missing', 'session_expired', 'not_connected'].includes(String(error.code)));
}
function selection(): Selection | null {
  try {
    const value = JSON.parse(localStorage.getItem(SELECTION) || 'null');
    if (value?.kind === 'resident' || value?.kind === 'offline' || value?.kind === 'mock' || value?.kind === 'none') return value;
    if ((value?.kind === 'remote' || value?.kind === 'local') && typeof value.origin === 'string') return value;
    if (value?.kind === 'cloud' && ['production', 'staging'].includes(value.environment) && typeof value.agentId === 'string') return value;
  } catch { /* Invalid nonsecret preferences do not authenticate a connection. */ }
  return null;
}
function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === 'expired') return 'This sign-in link has expired. Close the old browser tab and select Sign in with Eliza Cloud to open a fresh link.';
    if (error.code === 'credential-consumed') return 'This sign-in link has already been used. Close the old browser tab and start a fresh Eliza Cloud sign-in.';
    if (error.code === 'credentials-missing') return 'Sign in with Eliza Cloud to reconnect your account.';
  }
  if (error instanceof DOMException && error.name === 'AbortError') return 'Connection cancelled.';
  if (error && typeof error === 'object' && 'status' in error && error.status === 401) return 'Your session has expired. Sign in or pair again.';
  if (error && typeof error === 'object' && 'status' in error && error.status === 503) return 'The agent is starting or temporarily unavailable. Try again shortly.';
  return error instanceof Error ? error.message : 'The connection could not be completed.';
}
async function work(message: string, action: (signal: AbortSignal) => Promise<void>) {
  if (operation) return;
  const controller = new AbortController(); operation = controller;
  update({ busy: true, open: true, message, error: '' });
  try { await action(controller.signal); }
  catch (error) {
    if (expired(error) && active?.kind === 'cloud' && active.cloud.environment === cloud.environment) {
      const previous = active; retire('Sign-in required'); detachService();
      try { await previous.cloud.disconnect(); }
      catch { update({ error: 'The expired connection is detached, but its stored credential could not be removed.', open: true, message: '' }); return; }
    }
    update({ error: errorMessage(error), open: true, message: '' });
  }
  finally { if (operation === controller) operation = null; update({ busy: false }); }
}
function activate(next: Active, session: VerifiedSession, name: string) {
  actionReceipts.clear();
  epoch++; sending?.abort(new DOMException('The connection changed.', 'AbortError')); sending = null; active = next;
  update({ phoneActionsAvailable:!!next.actions, conversations: [], history: null, kind: next.kind, name, session, open: false, message: 'Connected', error: '' });
}
async function remoteIdentity(remote: RemoteProtocol, signal: AbortSignal) {
  const credential = await remoteCredentialStore.read(remote.origin);
  if (!credential || !remote.session) throw new Error('Pair this agent before connecting.');
  const response = await nativeRemoteRequest({ url: remote.origin + '/api/agents', method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${credential.token}` }, signal });
  if (response.status !== 200) {
    if (response.status === 401) await remote.disconnect();
    throw new Error('The agent identity could not be verified. Pair again if its session was revoked.');
  }
  const agents = (response.body as { agents?: unknown })?.agents;
  if (!Array.isArray(agents) || agents.length !== 1) throw new Error('Choose an endpoint serving one agent.');
  const agent = agents[0];
  if (typeof agent?.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(agent.id) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(agent.id)) throw new Error('The agent has not published a valid identity.');
  if (agent.status !== 'running') throw new Error('The agent is not running yet. Try again when it is ready.');
  return { id: agent.id, name: typeof agent.name === 'string' ? agent.name : 'Remote agent' };
}
async function connectRemote(kind: 'remote' | 'local', origin: string, code: string, signal: AbortSignal) {
  let deviceHeaders: Record<string, string> = {};
  const remote = new RemoteProtocol(origin.trim(), input => nativeRemoteRequest({ ...input, headers: { ...input.headers, ...deviceHeaders } }), remoteCredentialStore, { developmentOrigins: kind === 'local' ? [new URL(origin).origin] : [] });
  if (code.trim()) await remote.pair(code.trim(), signal);
  else if (!await remote.restore(signal)) throw new Error('Enter the pairing code displayed by your agent.');
  const agent = await remoteIdentity(remote, signal); signal.throwIfAborted();
  const verified = remote.session!;
  const session = { ownerId: verified.identityId, agentId: agent.id, sessionId: crypto.randomUUID(), origin: remote.origin };
  let actions: DeviceActions | undefined;
  try {
    const baseScope = await actionScope(JSON.stringify([remote.origin, session.ownerId, session.agentId]));
    const slot = `device:${baseScope}`;
    let credential = await secureConnectionStore.read<DeviceCredential>(slot);
    if (!credential) {
      credential = { installationId: crypto.randomUUID(), key: Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('') };
      await secureConnectionStore.write(slot, credential);
    }
    if (!/^[a-f0-9]{64}$/.test(credential.key) || !/^[a-f0-9-]{36}$/.test(credential.installationId)) throw new Error('Invalid saved device identity');
    const headers = { 'X-Eliza-Device-Id': credential.installationId, 'X-Eliza-Device-Key': credential.key, 'X-Eliza-Device-Capabilities': 'calendar.local-event.v1,notes.local-record.v1' };
    const request = async (path: string, body: unknown | undefined, requestSignal: AbortSignal) => {
      requestSignal.throwIfAborted();
      const auth = await remoteCredentialStore.read(remote.origin);
      if (!auth || auth.identityId !== session.ownerId || !remote.session || auth.expiresAt <= Date.now()) throw new Error('Device session changed');
      const response = await nativeRemoteRequest({ url: remote.origin + path, method: body === undefined ? 'GET' : 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}`, ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: requestSignal });
      if (response.status < 200 || response.status >= 300) throw Object.assign(new Error('Device action request failed'), { status: response.status });
      return response.body;
    };
    const registered = await request('/api/client-devices/register', { label: 'Alpha Phone', workflowProtocol: 1 }, signal) as { installationId: string; enrollmentId: string; capabilities?: string[] };
    if (registered.installationId !== credential.installationId || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(registered.enrollmentId)) throw new Error('Device registration was not verified');
    if(Array.isArray(registered.capabilities)&&registered.capabilities.includes("reminders.local-record.v1"))headers["X-Eliza-Device-Capabilities"]+=",reminders.local-record.v1";
    if(Array.isArray(registered.capabilities)&&registered.capabilities.includes("maps.selected-read.v1"))headers["X-Eliza-Device-Capabilities"]+=",maps.selected-read.v1";
    credential.enrollmentId = registered.enrollmentId;
    await secureConnectionStore.write(slot, credential); signal.throwIfAborted();
    deviceHeaders = headers;
    actions = new DeviceActions(session, credential, await actionScope(JSON.stringify([baseScope, credential.installationId])), request, actionJournal, (op, id, context, effectSignal, bindingHash) => deviceExecutor(op, id, context, effectSignal, bindingHash),(op,id,binding,signal)=>deviceRecovery?deviceRecovery(op,id,binding,signal):Promise.resolve({status:"unknown"}));
  } catch { signal.throwIfAborted(); /* Older hosts still support typed chat, without phone action authority. */ }
  save({ kind, origin: remote.origin });
  activate({ kind, remote, origin: remote.origin, actions }, session, agent.name);

}
async function connectResident(signal: AbortSignal) {
  if (!await localAgentPackaged()) throw new Error('The local agent is unavailable here. Connect a remote agent, use Eliza Cloud, or continue in mock mode.');
  signal.throwIfAborted();
  const client = new LocalAgentProtocol();
  const { session, name } = await client.connect(signal);
  signal.throwIfAborted();
  let actions:DeviceActions|undefined;
  let reason='';
  try {
    const store=isAndroid?secureConnectionStore:developmentDeviceStore;
    const journal=isAndroid?actionJournal:developmentActionJournal;
    const baseScope=await actionScope(JSON.stringify([client.origin,session.ownerId,session.agentId]));
    const slot=`device:${baseScope}`;
    let credential=await store.read<DeviceCredential>(slot);
    if(!credential){credential={installationId:crypto.randomUUID(),key:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')};await store.write(slot,credential);}
    if(!/^[a-f0-9]{64}$/.test(credential.key)||!/^[a-f0-9-]{36}$/.test(credential.installationId))throw Error('Invalid device identity');
    // Browser development advertises its real Notes implementation only.
    const headers={'X-Eliza-Device-Id':credential.installationId,'X-Eliza-Device-Key':credential.key,'X-Eliza-Device-Capabilities':isAndroid?'calendar.local-event.v1,notes.local-record.v1':'notes.local-record.v1'};
    const request=(path:string,body:unknown|undefined,requestSignal:AbortSignal)=>client.request(path,body,requestSignal,headers);
    const registered=await request('/api/client-devices/register',{label:isAndroid?'Alpha Phone':'Alpha browser development',workflowProtocol:1},signal);
    if(registered.installationId!==credential.installationId||typeof registered.enrollmentId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(registered.enrollmentId))throw Error('Device registration was not verified');
    if(isAndroid&&registered.capabilities?.includes('reminders.local-record.v1'))headers['X-Eliza-Device-Capabilities']+=',reminders.local-record.v1';
    if(isAndroid&&registered.capabilities?.includes('maps.selected-read.v1'))headers['X-Eliza-Device-Capabilities']+=',maps.selected-read.v1';
    credential.enrollmentId=registered.enrollmentId;await store.write(slot,credential);signal.throwIfAborted();
    client.deviceHeaders=headers;
    actions=new DeviceActions(session,credential,await actionScope(JSON.stringify([baseScope,credential.installationId])),request,journal,(op,id,context,effectSignal,bindingHash)=>deviceExecutor(op,id,context,effectSignal,bindingHash),(op,id,binding,recoverySignal)=>deviceRecovery?deviceRecovery(op,id,binding,recoverySignal):Promise.resolve({status:'unknown'}));
  } catch(error) {signal.throwIfAborted();reason='Local chat connected. Device actions are unavailable: '+(error instanceof Error?error.message:'Enrollment failed.');}
  save({kind:'resident'});
  activate({kind:'resident',remote:client,origin:client.origin,actions},session,name);
  if(reason)update({phoneCapabilityReason:reason});
}
async function connectCloud(agentId: string, signal: AbortSignal, expectedOwner?: string) {
  const client=cloud;
  client.setPhoneTarget(null);
  const identity = await verifyService(cloud, signal); signal.throwIfAborted();
  if (expectedOwner && identity.userId !== expectedOwner) throw new Error('The Cloud account has changed. Refresh agents and choose an agent for this account.');
  const agent = await cloud.agentDetail(agentId, signal);
  if (agent.status !== 'running' || !agent.runtimeUrl) throw new Error('This agent is not ready. Start it and refresh its status.');
  const session = {ownerId:identity.userId,agentId,sessionId:crypto.randomUUID(),origin:new URL(agent.runtimeUrl).origin};
  const next: Extract<Active,{kind:'cloud'}> = {kind:'cloud',cloud,agentId};
  let attached = false;
  let reason = 'This Cloud runtime has not enabled verified phone actions, workflows or paired speech.';
  try {
    const auth = await cloudCredentialStore.read(cloud.environment);
    if (!auth?.credentialId || !identity.organizationId) throw new Error('Cloud owner configuration unavailable');
    const baseScope = await actionScope(JSON.stringify(['cloud',session.origin,identity.userId,agentId]));
    const slot = `device:${baseScope}`;
    let credential = await secureConnectionStore.read<DeviceCredential>(slot);
    if (!credential) { credential={installationId:crypto.randomUUID(),key:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')}; await secureConnectionStore.write(slot,credential); }
    if (!/^[a-f0-9]{64}$/.test(credential.key) || !/^[a-f0-9-]{36}$/.test(credential.installationId)) throw new Error('Invalid saved device identity');
    const target: CloudPhoneTarget = {agentId,origin:session.origin,userId:identity.userId,organizationId:identity.organizationId,credentialId:auth.credentialId,headers:{'X-Eliza-Device-Id':credential.installationId,'X-Eliza-Device-Key':credential.key,'X-Eliza-Device-Capabilities':'calendar.local-event.v1,notes.local-record.v1'}};
    const request = async (path:string,body:unknown|undefined,requestSignal:AbortSignal) => {
      if(attached && state.session?.sessionId!==session.sessionId)throw new Error('Cloud agent changed');
      const result=await client.phoneRequest(target,path,requestSignal,body);
      if(attached && state.session?.sessionId!==session.sessionId)throw new Error('Cloud agent changed');
      return result;
    };
    const capability = await request('/api/client-devices/capabilities',undefined,signal);
    const external=capability.externalIdentity as Record<string,unknown>|undefined,device=capability.deviceActions as Record<string,unknown>|undefined;
    if (capability.protocol!==1 || capability.agentId!==agentId || typeof capability.identityId!=='string' || !/^[a-f0-9-]{36}$/.test(capability.identityId) || external?.subject!==identity.userId || external?.organizationId!==identity.organizationId || typeof external?.issuer!=='string' || !external.issuer.startsWith('https://') || device?.protocol!==1 || !Array.isArray(device.capabilities) || !device.capabilities.includes('calendar.local-event.v1')) throw new Error('Cloud runtime owner capability was not verified');
    if(Array.isArray(device?.capabilities)&&device.capabilities.includes("reminders.local-record.v1"))target.headers["X-Eliza-Device-Capabilities"]+=",reminders.local-record.v1";
    if(Array.isArray(device?.capabilities)&&device.capabilities.includes("maps.selected-read.v1"))target.headers["X-Eliza-Device-Capabilities"]+=",maps.selected-read.v1";
    session.ownerId=capability.identityId;
    const registered=await request('/api/client-devices/register',{label:'Alpha Phone',workflowProtocol:1},signal);
    if (registered.installationId!==credential.installationId || typeof registered.enrollmentId!=='string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(registered.enrollmentId)) throw new Error('Cloud device registration was not verified');
    credential.enrollmentId=registered.enrollmentId; await secureConnectionStore.write(slot,credential); signal.throwIfAborted();
    next.actions=new DeviceActions(session,credential,await actionScope(JSON.stringify([baseScope,credential.installationId])),request,actionJournal,(op,id,context,effectSignal,bindingHash)=>deviceExecutor(op,id,context,effectSignal,bindingHash),(op,id,binding,signal)=>deviceRecovery?deviceRecovery(op,id,binding,signal):Promise.resolve({status:"unknown"}));
    next.phoneTarget=target; next.voiceExpiresAt=Math.min(auth.expiresAt ?? Infinity,Date.now()+30*60*1000);
    await secureConnectionStore.write(`cloud-runtime:${session.sessionId}`,{environment:cloud.environment,credentialId:auth.credentialId,origin:session.origin,agentId,ownerId:session.ownerId,userId:identity.userId,organizationId:identity.organizationId,sessionId:session.sessionId,expiresAt:next.voiceExpiresAt});
    signal.throwIfAborted(); cloud.setPhoneTarget(target); reason='';
  } catch (error) {
    signal.throwIfAborted();
    if (expired(error)) throw error;
    next.actions=undefined;next.phoneTarget=undefined;next.voiceExpiresAt=undefined;session.ownerId=identity.userId;
  }
  save({ kind:'cloud',environment:cloud.environment,agentId,ownerId:identity.userId });
  activate(next,session,agent.name || 'Eliza Cloud agent'); attached=true; update({phoneCapabilityReason:reason});
}

function conversationKey(session: VerifiedSession) { return JSON.stringify([session.origin, session.ownerId, session.agentId]); }
function conversations(): Record<string, string> {
  try { const value = JSON.parse(localStorage.getItem(CONVERSATIONS) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
}

/** Only remove an exact Alpha-generated prefix from restored user prose. */
function restoredText(text: string): string {
  const marker = '\n[/CURRENT-TURN CLIENT OBSERVATION]\n[USER MESSAGE]\n';
  const end = text.indexOf(marker);
  if (!text.startsWith('[CURRENT-TURN CLIENT OBSERVATION]\n') || end < 0) return text;
  try {
    const lastLine = text.slice(0, end).split('\n').at(-1)!;
    const { source, ...context } = JSON.parse(lastLine);
    const prose = text.slice(end + marker.length);
    if (source === 'Alpha Phone client' && phoneContextMessage(prose, context).text === text) return prose;
  } catch { /* Unrecognized text remains authored text. */ }
  return text;
}
async function conversationList(selected: Active, signal: AbortSignal) {
  const list = selected.kind === 'cloud' ? await selected.cloud.listConversations(selected.agentId, signal) : await selected.remote.listConversations(signal);
  return list.map(item => ({ id: item.id, title: typeof item.title === 'string' && item.title ? item.title : 'Conversation' }));
}

/** Shared controller for the chat adapter. Snapshot contains no credentials.
 * subscribe/getSnapshot expose connection changes; send uses server-bound identity
 * and one persisted conversation per origin+owner+agent. It never executes proposals.
 */
export const connectionController = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot() { return state; },
  setDeviceRecovery(recovery: DeviceRecovery) { deviceRecovery=recovery; },
  setDeviceExecutor(executor: DeviceExecutor) { deviceExecutor = executor; },
  async execute(proposal: ActionProposal, context: ContextEnvelope, signal: AbortSignal): Promise<OperationReceipt> {
    const selected = active;
    if (!selected || !selected.actions) return { proposalId: proposal.id, status: 'denied', summary: 'This connection does not support verified phone actions.' };
    const sessionId = state.session!.sessionId;
    const prior = actionReceipts.get(proposal.id);
    if (prior?.sessionId === sessionId) return prior.result;
    const result = selected.actions.approve(proposal.id, context, signal);
    actionReceipts.set(proposal.id, { sessionId, result });
    return result;
  },
  getWorkflowDeviceTarget(){const selected=active;if(!selected||!selected.actions||!selected.actions.credential.enrollmentId)return null;return {installationId:selected.actions.credential.installationId,enrollmentId:selected.actions.credential.enrollmentId};},
  async workflowPhoneActions(review:WorkflowPhoneReview,context:ContextEnvelope,signal:AbortSignal){
    const selected=active,generation=epoch,sessionId=state.session?.sessionId;
    if(!selected||!selected.actions||state.open||document.hidden||context.sensitive)throw new Error('Open this workflow on the selected phone agent');
    const result=await selected.actions.pendingForWorkflow(review,context,signal);signal.throwIfAborted();
    if(generation!==epoch||sessionId!==state.session?.sessionId||state.open||document.hidden)throw new Error('Workflow agent changed');return result;
  },
  async rejectWorkflowPhoneAction(id:string,review:WorkflowPhoneReview,context:ContextEnvelope,signal:AbortSignal){
    const selected=active;if(!selected||!selected.actions||state.open||document.hidden||context.sensitive)throw new Error('Open this workflow to deny its phone step');
    const proposals=await selected.actions.pendingForWorkflow(review,context,signal);if(!proposals.some(p=>p.id===id))throw new Error('Phone step is no longer pending');signal.throwIfAborted();await selected.actions.reject(id,signal);
  },
  async syncWorkflowPhoneReceipts(review:WorkflowPhoneReview,signal:AbortSignal){
    const selected=active,generation=epoch;
    if(!selected||!selected.actions||state.open||document.hidden)throw new Error('Open this workflow to reconcile its phone receipts');
    await selected.actions.syncReceipts(signal,{runId:review.runId,versionId:review.versionId,specDigest:review.specDigest});signal.throwIfAborted();if(generation!==epoch||state.open||document.hidden)throw new Error('Workflow agent changed');
  },
  async actionReceipt(proposalId: string, sessionId: string | undefined): Promise<OperationReceipt | null> {
    const tracked = actionReceipts.get(proposalId);
    if (!sessionId || state.session?.sessionId !== sessionId || tracked?.sessionId !== sessionId) return null;
    const receipt = await tracked.result;
    return state.session?.sessionId === sessionId ? receipt : null;
  },
  async actionHistory(sync = false) {
    await work('Reading phone action history…', async signal => {
      const selected = active, generation = epoch;
      if (!selected || !selected.actions) throw new Error('Verified phone actions are unavailable on this connection.');
      if (sync) await selected.actions.syncReceipts(signal);
      const entries = await selected.actions.history(signal);
      if (generation !== epoch) return;
      update({ actionHistory: entries.map(entry => ({ id: entry.id, state: entry.state, description: `${JSON.stringify(entry.operation)} · ${entry.local?.status || entry.local?.phase || 'not dispatched by this phone'}` })), message: 'Review local effects before resolving an uncertain action. No action is repeated here.' });
    });
  },
  async rejectAction(id: string) {
    await work('Rejecting phone action…', async signal => {
      if (!active || !active.actions) throw new Error('Device action connection unavailable');
      await active.actions.reject(id, signal);
      update({ actionHistory: [], message: 'Proposal rejected. No device action was performed.' });
    });
  },
  async reconcileAction(id: string, outcome: 'applied' | 'not_applied') {
    await work('Recording your action review…', async signal => {
      if (!active || !active.actions) throw new Error('Device action connection unavailable');
      await active.actions.reconcile(id, outcome, signal);
      update({ actionHistory: [], message: 'Review recorded. Refresh action history; no action was repeated.' });
    });
  },
  getWorkflowClient(): { client: WorkflowProtocol; sessionId: string } | null {
    const selected = active, session = state.session;
    if (!selected || !session || (selected.kind==='cloud' && !selected.phoneTarget)) return null;
    const generation = epoch;
    return { sessionId: session.sessionId, client: new WorkflowProtocol(async (path, body, signal) => {
      signal.throwIfAborted();
      if (generation !== epoch) throw new Error('Agent changed');
      if (selected.kind==='cloud') { try { const response=await selected.cloud.phoneRequest(selected.phoneTarget!,path,signal,body); if(generation!==epoch)throw new Error('Agent changed');return response; } catch(error) { if(error instanceof CloudProtocolError && error.status)throw new WorkflowHttpError(error.status,error.data); throw error; } }
      if(selected.kind==='resident'){try{const response=await selected.remote.request(path,body,signal);if(generation!==epoch)throw Error('Agent changed');return response;}catch(error){if(error&&typeof error==='object'&&'status' in error&&typeof error.status==='number')throw new WorkflowHttpError(error.status,'data' in error?error.data:undefined);throw error;}}
      const credential = await remoteCredentialStore.read(selected.origin);
      if (!credential || credential.identityId !== session.ownerId || credential.expiresAt <= Date.now()) throw new Error('Pair the agent again');
      const response = await nativeRemoteRequest({ url: selected.origin + path, method: body === undefined ? 'GET' : 'POST', headers: { Accept: 'application/json', 'Content-Type':'application/json', Authorization: `Bearer ${credential.token}` }, ...(body===undefined?{}:{body:JSON.stringify(body)}), signal });
      if (generation !== epoch) throw new Error('Agent changed');
      if (response.status<200||response.status>=300) throw new WorkflowHttpError(response.status, response.body);
      return response.body;
    }) };
  },
  getPairedVoiceBinding(): { origin: string; ownerId: string; expiresAt: number; sessionId: string } | null {
    if (active?.kind==='cloud' && state.session && active.phoneTarget && active.voiceExpiresAt && active.voiceExpiresAt>Date.now()) return {origin:state.session.origin,ownerId:state.session.ownerId,expiresAt:active.voiceExpiresAt,sessionId:state.session.sessionId};
    if (!active || active.kind === 'cloud' || active.kind === 'resident' || !state.session || !active.remote.session || active.remote.session.expiresAt <= Date.now()) return null;
    return { origin: active.origin, ownerId: state.session.ownerId, expiresAt: active.remote.session.expiresAt, sessionId: state.session.sessionId };
  },
  getCloudEnvironment(): CloudEnvironment | null { return service?.identity.environment ?? null; },
  getCloudClient(): { client: CloudProtocol; sessionId: string; credentialId: string } | null { return service ? { client: service.client, sessionId: service.identity.sessionId, credentialId: service.identity.credentialId } : null; },
  rejectCloudSession(sessionId: string, error: unknown) {
    if (!expired(error) || service?.identity.sessionId !== sessionId) return false;
    const environment = service.identity.environment;
    if (active?.kind === 'cloud' && active.cloud.environment === environment) retire('Sign-in required');
    detachService();
    update({ error: 'Eliza Cloud sign-in has expired. Sign in again; remote agent pairing is unchanged.' });
    return true;
  },
  open() { update({ open: true, error: '' }); },
  close() { if (!state.busy) update({ open: false }); },
  cancel() { operation?.abort(new DOMException('Cancelled', 'AbortError')); cloud.cancelLogin(); },
  async initialize() {
    if (startup) return startup;
    startup = (async () => {
      if ((!isAndroid && !browserLocalAgentEnabled) || new URLSearchParams(location.search).get('mode') === 'mock') return;
      const saved = selection();
      if (saved?.kind === 'offline') return;
      if (saved?.kind === 'mock') { const url = new URL(location.href); url.searchParams.set('mode', 'mock'); location.replace(url.href); return; }
      await work('Restoring your connection…', async signal => {
        const environment = localStorage.getItem(CLOUD_SERVICE);
        if (environment === 'production' || environment === 'staging') {
          try { await verifyService(makeCloud(environment), signal); }
          catch (error) { signal.throwIfAborted(); detachService(); update({ message: 'Cloud services need sign-in or retry. Your agent connection is independent.' }); }
        }
        if (saved?.kind === 'resident') { await connectResident(signal); return; }
        if (!saved || saved.kind === 'none') { update({ open: !service, message: 'Choose where to run your agent.' }); return; }
        if (saved.kind === 'cloud') {
          cloud = makeCloud(saved.environment);
          if (!saved.ownerId) { await verifyService(cloud, signal); update({ agents: await cloud.listAgents(signal), message: 'Choose your Cloud agent to confirm this saved connection.' }); return; }
          await connectCloud(saved.agentId, signal, saved.ownerId);
        }
        else await connectRemote(saved.kind, saved.origin, '', signal);
      });
    })();
    return startup;
  },
  async offline() {
    if (operation) return;
    retire(); detachService();
    const error = persistOffline();
    update({ open: Boolean(error), error, message: '' });
  },
  async stopLocal() { await work('Stopping the local agent…',async()=>{await stopLocalAgent();retire();save({kind:'none'});update({message:'Local agent stopped.'});}); },
  async configureLocal(apiKey:string,model:string) { await work('Saving provider securely…',async()=>{await configureLocalProvider(apiKey,model);update({message:'Provider saved. Start or restart the local agent to use it.'});}); },
  async startLocal() { await work('Starting the local agent…', signal => { retire(); return connectResident(signal); }); },
  async pair(kind: 'remote' | 'local', origin: string, code: string) {
    await work('Verifying your agent…', signal => { retire(); return connectRemote(kind, origin, code, signal); });
  },
  async cloudLogin(environment: CloudEnvironment) {
    await work('Opening Eliza Cloud sign-in…', async signal => {
      // A login can replace the environment's secure token with a different
      // account. Detach the old identity before any token can be replaced.
      const replacingCloud = active?.kind === 'cloud' || selection()?.kind === 'cloud';
      detachCloudTarget(); detachService(); if (replacingCloud) save({ kind: 'none' }); update({ agents: [] });
      cloud = makeCloud(environment);
      await cloud.login(signal, () => update({ message: 'Use the newly opened browser tab to sign in and approve this phone. If the link expires, cancel here and start a fresh sign-in.' }));
      await verifyService(cloud, signal);
      if (!active) save({ kind: 'none' });
      update({ agents: await cloud.listAgents(signal), message: 'Cloud services connected. Choose an agent, or keep your current agent.' });
    });
  },
  async cloudList(environment: CloudEnvironment) {
    await work('Loading your agents…', async signal => { cloud = makeCloud(environment);
      if (service && service.identity.environment !== environment) { detachCloudTarget(); detachService(); }
      const previous = service?.identity.sessionId;
      try { await verifyService(cloud, signal); }
      catch (error) { if (previous) connectionController.rejectCloudSession(previous, error); throw error; }
      if (!active) save({ kind: 'none' });
      update({ agents: await cloud.listAgents(signal), message: 'Choose an agent.' }); });
  },
  cloudEnvironment(environment: CloudEnvironment) {
    if (operation) return;
    cloud = makeCloud(environment); update({ agents: [], message: '', error: '' });
  },
  async cloudChoose(id: string) { await work('Verifying your Cloud agent…', signal => { retire(); return connectCloud(id, signal); }); },
  async cloudCreate(name: string) {
    await work('Creating your agent…', async signal => {
      const agent = await cloud.createAgent(name, signal);
      update({ agents: [...state.agents.filter(item => item.id !== agent.id), agent], message: `${agent.name || 'Agent'} created. Start it when you are ready.` });
      try { update({ agents: await cloud.listAgents(signal) }); }
      catch { update({ message: `${agent.name || 'Agent'} was created. Refresh to update its status; do not create it again.` }); }
    });
  },
  async cloudProvision(id: string) {
    await work('Starting your agent…', async signal => {
      try { await cloud.provisionAgent(id, signal); }
      catch (error) { if (!(error instanceof CloudProvisionAcceptedError)) throw error; }
      update({ agents: state.agents.map(agent => agent.id === id ? { ...agent, status: 'starting', runtimeUrl: null } : agent), message: 'Start accepted. Refresh to check status before requesting another start.' });
      try { update({ agents: await cloud.listAgents(signal) }); }
      catch { /* The accepted write remains visible even when status refresh fails. */ }
    });
  },
  async disconnect() {
    await work('Disconnecting…', async () => {
      const previous = active; const retirement=retire();
      save({ kind: 'none' });
      await retirement;
      if (previous && previous.kind !== 'cloud') await previous.remote.disconnect();
      update({ message: 'Agent disconnected. Cloud services keep their separate sign-in.', error: '', agents: [] });
    });
  },
  async cloudSignOut() {
    await work('Signing out of Cloud services…', async () => {
      const previous = service; detachCloudTarget(); detachService();
      localStorage.removeItem(CLOUD_SERVICE);
      if (!active) save({ kind: 'none' });
      await (previous?.client ?? cloud).disconnect();
      update({ agents: [], message: 'Signed out of Eliza Cloud on this phone.' });
    });
  },
  async mock() {
    await work('Pausing live notification collection…', async signal => {
      if (isAndroid) await registerPlugin<{pauseNotificationCollection():Promise<void>}>('AlphaConnection').pauseNotificationCollection();
      signal.throwIfAborted();
      save({ kind: 'mock' });
      retire(); detachService(); const url = new URL(location.href); url.searchParams.set('mode', 'mock'); location.assign(url.href);
    });
  },
  async listHistory() {
    if (sending) { update({ error: 'Wait for the current reply before loading conversations.' }); return; }
    await work('Loading conversations from your selected agent…', async signal => {
      const selected = active, session = state.session, generation = epoch;
      if (!selected || !session) throw new Error('Connect an agent first.');
      const list = await conversationList(selected, signal); signal.throwIfAborted();
      if (generation !== epoch) throw new Error('The agent changed.');
      update({ conversations: list, message: list.length ? 'Choose a conversation to replace the visible chat. Your draft will be cleared.' : 'No saved conversations were returned.' });
    });
  },
  async restoreHistory(id: string) {
    if (sending) { update({ error: 'Wait for the current reply before restoring history.' }); return; }
    await work('Verifying and restoring conversation…', async signal => {
      const selected = active, session = state.session, generation = epoch;
      if (!selected || !session) throw new Error('Connect an agent first.');
      const list = await conversationList(selected, signal);
      if (!list.some(item => item.id === id)) throw new Error('This conversation is no longer available to this agent.');
      const result = selected.kind === 'cloud' ? await selected.cloud.messages(selected.agentId, id, signal) : await selected.remote.messages(id, signal);
      signal.throwIfAborted();
      if (generation !== epoch) throw new Error('The agent changed.');
      if (result.messages.length > 2000) throw new Error('This history is too large to display safely.');
      const messages: RestoredMessage[] = result.messages.filter(item => item.role === 'user' || item.role === 'assistant').map(item => {
        if (typeof item.id !== 'string' || !item.id || typeof item.text !== 'string' || item.text.length > 200000) throw new Error('The agent returned invalid history.');
        return { id: item.id, from: item.role === 'user' ? 'user' : 'agent', text: item.role === 'user' ? restoredText(item.text) : item.text };
      });
      const key = conversationKey(session), cached = conversations();
      cached[key] = id; conversationMemory.set(key, id);
      let saved = true;
      try { localStorage.setItem(CONVERSATIONS, JSON.stringify(cached)); } catch { saved = false; }
      update({ history: { sessionId: session.sessionId, conversationId: id, revision: (state.history?.revision || 0) + 1, messages }, open: false,
        message: saved ? 'Returned history restored. Older messages may remain on the agent.' : 'History restored for this session; restart selection could not be saved.' });
    });
  },
  async send(text: string, context: ContextEnvelope, requestId: string, signal: AbortSignal, onText?:(text:string)=>void): Promise<{ text: string; proposals?: ActionProposal[] }> {
    if (operation) throw new Error('Finish the connection or history operation before sending.');
    const message = phoneContextMessage(text, context);
    if (sending) throw new Error('Wait for the current reply before sending another message.');
    const selected = active, session = state.session, generation = epoch;
    if (!selected || !session) throw new Error('Connect an agent in Settings to send a message.');
    const controller = new AbortController();
    const cancel = () => controller.abort(signal.reason);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
    sending = controller;
    const requestSignal = controller.signal;
    try {
      requestSignal.throwIfAborted();
      if (selected.kind === 'remote' || selected.kind === 'local') {
        if (!selected.remote.session || selected.remote.session.expiresAt <= Date.now()) throw Object.assign(new Error('Your session has expired. Pair again.'), { code: 'session_expired' });
      }
      const key = conversationKey(session), cached = conversations();
      let id = conversationMemory.get(key) || cached[key];
      if (typeof id !== 'string' || !id) {
        const created = selected.kind === 'cloud' ? await selected.cloud.createConversation(selected.agentId, 'Alpha Phone', requestSignal) : await selected.remote.createConversation('Alpha Phone', requestSignal);
        requestSignal.throwIfAborted();
        if (generation !== epoch) throw new Error('The connection changed.');
        id = created.id; conversationMemory.set(key, id); cached[key] = id;
        try { localStorage.setItem(CONVERSATIONS, JSON.stringify(cached)); }
        catch { update({ message: 'Conversation is connected for this session. Its selection could not be saved for restart.' }); }
      }
      // Generic clients report an observation, never authority or permission.
      // Retain the legacy field while older runtime deployments are supported.
      const options = { signal: requestSignal, clientMessageId: requestId, metadata: { clientDevice: { context: message.context }, alphaPhone: { context: message.context } } };
      const progress=(value:string)=>{requestSignal.throwIfAborted();if(generation!==epoch||selected!==active||state.session?.sessionId!==session.sessionId)throw Error('The connection changed.');onText?.(value);};
      const reply = selected.kind === 'cloud' ? await selected.cloud.send(selected.agentId, id, message.text, options) : selected.kind==='resident'?await selected.remote.send(id,message.text,{...options,onText:progress}):await selected.remote.send(id, message.text, options);
      requestSignal.throwIfAborted();
      if (generation !== epoch) throw new Error('The connection changed.');
      let responseFailure: Error | undefined;
      if (('failureKind' in reply && reply.failureKind) || ('terminalFailure' in reply && reply.terminalFailure)) {
        const terminal = 'terminalFailure' in reply && reply.terminalFailure;
        const rateLimited = ('failureKind' in reply && reply.failureKind === 'rate_limited') ||
          (terminal && typeof terminal === 'object' && 'kind' in terminal && terminal.kind === 'rate_limited');
        responseFailure = rateLimited
          ? new AlphaClientError('transport-failed', 'The agent provider is rate-limiting requests. Wait before sending again. Alpha Phone did not retry your message.')
          : new Error('The agent could not complete this response.');
      }
      if (typeof reply.text !== 'string') throw new Error('The agent returned an invalid response.');
      let proposals: ActionProposal[] | undefined;
      if (selected.actions) {
        try { proposals = await selected.actions.pending(message.context, requestSignal); }
        catch { update({ message: 'Reply received. Phone action proposals could not be checked; use action history.' }); }
      }
      requestSignal.throwIfAborted();
      if (generation !== epoch || selected !== active || state.session?.sessionId !== session.sessionId) throw new Error('The connection changed.');
      // A failed reply can follow a durably recorded proposal. Recover only the
      // existing identity/context-bound review; never retry chat or execute it.
      if (responseFailure && !proposals?.length) throw responseFailure;
      return { text: responseFailure
        ? `${responseFailure.message} Pending phone actions are available for separate review. Nothing has been approved or performed automatically.`
        : reply.text, ...(proposals ? { proposals } : {}) };
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && error.status === 429) {
        throw new AlphaClientError('transport-failed', 'The agent provider is rate-limiting requests. Wait before sending again. Alpha Phone did not retry your message.');
      }
      if (expired(error) && generation === epoch) {
        retire('Sign-in required');
        update({ error: 'Sign in or pair again.', open: true });
        try {
          if (selected.kind === 'cloud') { detachService(); await selected.cloud.disconnect(); }
          else await selected.remote.disconnect();
        } catch {
          update({ error: 'The expired connection is detached, but its stored credential could not be removed.', open: true });
        }
      }
      throw error;
    } finally { signal.removeEventListener('abort', cancel); if (sending === controller) sending = null; }
  },
};

export function ConnectionChooser() {
  const snapshot = useSyncExternalStore(connectionController.subscribe, connectionController.getSnapshot);
  const [localPackaging,setLocalPackaging]=useState<'checking'|'available'|'unavailable'>('checking');
  useEffect(()=>{if(!snapshot.open)return;let current=true;setLocalPackaging('checking');void localAgentPackaged().then(available=>{if(current)setLocalPackaging(available?'available':'unavailable');});return()=>{current=false;};},[snapshot.open]);
  const providerKey=useRef<HTMLInputElement>(null), providerModel=useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const remoteOrigin = useRef<HTMLInputElement>(null), remoteCode = useRef<HTMLInputElement>(null);
  const localOrigin = useRef<HTMLInputElement>(null), localCode = useRef<HTMLInputElement>(null);
  const name = useRef<HTMLInputElement>(null), environment = useRef<HTMLSelectElement>(null);
  useEffect(() => { void connectionController.initialize(); }, []);
  useEffect(() => {
    if (!snapshot.open) return;
    const previous = document.activeElement as HTMLElement | null;
    const phone = document.querySelector<HTMLElement>('.os');
    const previousInert = phone?.inert ?? false;
    if (phone) phone.inert = true;
    if (phone && panel.current) {
      const theme = getComputedStyle(phone);
      for (const key of ['bg', 'fg', 's2', 'line', 'mut', 'acc']) panel.current.style.setProperty(`--connection-${key}`, theme.getPropertyValue(`--${key}`));
    }
    panel.current?.focus();
    const back = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); if (snapshot.busy) connectionController.cancel(); else connectionController.close(); };
    window.addEventListener('alpha-back', back, true);
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (snapshot.busy) connectionController.cancel(); else connectionController.close(); }
      if (event.key === 'Tab' && panel.current) {
        const items = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary')).filter(item => item.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); window.removeEventListener('alpha-back', back, true); if (phone) phone.inert = previousInert; previous?.focus(); };
  }, [snapshot.open, snapshot.busy]);
  if (!snapshot.open) return null;
  const env = () => environment.current?.value === 'staging' ? 'staging' : 'production';
  return <div className="alpha-connection-scrim"><div className="alpha-connection" role="dialog" aria-modal="true" aria-labelledby="connection-title" tabIndex={-1} ref={panel}>
    <header><span className="alpha-connection-logo serif">a</span><button aria-label="Close connection settings" disabled={snapshot.busy} onClick={() => connectionController.close()}>×</button></header>
    <h1 id="connection-title" className="serif">Your agent.<br />Your phone.</h1>
    <p>Run your agent locally, or connect an optional remote agent. Model inference uses the provider configured for that agent.</p>
    <section><h3>{isAndroid ? 'On-device agent' : 'Agent on this computer'}</h3>
      <p>{isAndroid ? 'Agent execution and state stay on this Android device. Hosted inference, when configured, receives your prompts and selected context.' : 'The agent runs on your development computer. This browser is its interface; Android uses the native runtime instead.'}</p>
      {isAndroid && localPackaging==='available' && <details><summary>Model provider</summary><p>Cerebras receives prompts and selected context for inference. Your key is stored using Android Keystore. Saving a new key takes effect after the agent restarts.</p><form onSubmit={event=>{event.preventDefault();const key=providerKey.current?.value||'';const model=providerModel.current?.value||'';if(providerKey.current)providerKey.current.value='';void connectionController.configureLocal(key,model);}}><label>Cerebras API key<input ref={providerKey} type="password" autoComplete="off" required disabled={snapshot.busy}/></label><label>Model<input ref={providerModel} defaultValue="qwen-3.8-27b" required disabled={snapshot.busy}/></label><button disabled={snapshot.busy}>Save provider</button></form></details>}
      <button disabled={snapshot.busy || localPackaging!=='available'} onClick={() => void connectionController.startLocal()}>Start local agent</button>
      {localPackaging==='checking' && <p role="status">Checking local agent availability…</p>}
      {localPackaging==='unavailable' && <p>The local agent is unavailable in this version. Connect a remote agent, use Eliza Cloud, or continue in mock mode.</p>}
    </section>
    {snapshot.session && <section className="alpha-connection-current"><strong>{snapshot.name}</strong><span>Connected · {snapshot.kind === 'cloud' ? 'Eliza Cloud' : snapshot.kind === 'resident' ? (isAndroid ? 'On this device' : 'On this computer · development') : snapshot.kind === 'local' ? 'Local development' : 'Remote agent'}</span><button disabled={snapshot.busy} onClick={() => void connectionController.disconnect()}>Disconnect agent</button>{isAndroid && snapshot.kind==='resident' && <button disabled={snapshot.busy} onClick={()=>void connectionController.stopLocal()}>Stop local agent</button>}</section>}
    {snapshot.session && <details><summary>Conversation history</summary><p>Load from this agent only. Restoring replaces the visible chat and draft; it does not run past actions.</p><button disabled={snapshot.busy} onClick={() => void connectionController.listHistory()}>Load conversations</button>{snapshot.conversations.map(item => <section key={item.id} className="alpha-connection-agent"><strong>{item.title}</strong><button disabled={snapshot.busy} onClick={() => void connectionController.restoreHistory(item.id)}>Restore conversation</button></section>)}</details>}
    {snapshot.session && snapshot.phoneCapabilityReason && <p role="status">{snapshot.phoneCapabilityReason}</p>}
    {snapshot.session && snapshot.phoneActionsAvailable && <details><summary>Phone action history</summary><button disabled={snapshot.busy} onClick={() => void connectionController.actionHistory()}>Refresh actions</button><button disabled={snapshot.busy} onClick={() => void connectionController.actionHistory(true)}>Sync recorded receipts</button>{snapshot.actionHistory.map(item => <section key={item.id} className="alpha-connection-agent"><strong>{item.description}</strong><span>{item.state}</span>{item.state === 'pending' && <button disabled={snapshot.busy} onClick={() => void connectionController.rejectAction(item.id)}>Reject proposal</button>}{['executing','reconciliation_required'].includes(item.state) && <><p>After checking this phone, confirm whether this exact action happened.</p><button disabled={snapshot.busy} onClick={() => void connectionController.reconcileAction(item.id, 'applied')}>I verified it happened</button><button disabled={snapshot.busy} onClick={() => void connectionController.reconcileAction(item.id, 'not_applied')}>I verified it did not happen</button></>}</section>)}</details>}
    <div role="status" aria-live="polite">{snapshot.message}</div>
    {snapshot.error && <p role="alert" className="alpha-connection-error">{snapshot.error}</p>}
    {snapshot.busy && <button className="alpha-connection-cancel" onClick={() => connectionController.cancel()}>Cancel</button>}
    <details><summary>Eliza Cloud</summary><p>Use your existing account and agent, or create an agent after signing in.</p>
      {snapshot.cloudAccount && <section className="alpha-connection-current"><strong>Cloud services connected</strong><span>{snapshot.cloudAccount.environment} · verified account {snapshot.cloudAccount.userId.slice(0, 8)}</span><p>Gmail and speech use this account independently of your agent.</p><button disabled={snapshot.busy} onClick={() => void connectionController.cloudSignOut()}>Sign out of Eliza Cloud</button></section>}
      <label>Environment<select ref={environment} disabled={snapshot.busy} defaultValue="production" onChange={() => connectionController.cloudEnvironment(env())}><option value="production">Production</option><option value="staging">Staging</option></select></label>
      <div className="alpha-connection-actions"><button disabled={snapshot.busy} onClick={() => void connectionController.cloudLogin(env())}>Sign in with Eliza Cloud</button><button disabled={snapshot.busy} onClick={() => void connectionController.cloudList(env())}>Refresh agents</button></div>
      {snapshot.agents.map(agent => <section className="alpha-connection-agent" key={agent.id}><strong>{agent.name || 'Unnamed agent'}</strong><span>{agent.status}</span><button disabled={snapshot.busy || agent.status !== 'running' || !agent.runtimeUrl} onClick={() => void connectionController.cloudChoose(agent.id)}>Use this agent</button>{agent.status !== 'running' && <button disabled={snapshot.busy || ['provisioning', 'starting', 'pending'].includes(agent.status)} onClick={() => void connectionController.cloudProvision(agent.id)}>Start agent</button>}</section>)}
      <form onSubmit={event => { event.preventDefault(); void connectionController.cloudCreate(name.current?.value || ''); }}><label>New agent name<input ref={name} maxLength={100} placeholder="My Alpha agent" required disabled={snapshot.busy} /></label><button disabled={snapshot.busy}>Create agent</button></form>
    </details>
    <details><summary>Remote agent</summary><form onSubmit={event => { event.preventDefault(); void connectionController.pair('remote', remoteOrigin.current?.value || '', remoteCode.current?.value || ''); if (remoteCode.current) remoteCode.current.value = ''; }}>
      <label>Agent HTTPS address<input ref={remoteOrigin} type="url" autoCapitalize="none" spellCheck={false} placeholder="https://your-agent.example" required disabled={snapshot.busy} /></label>
      <label>Pairing code<input ref={remoteCode} autoComplete="off" autoCapitalize="characters" placeholder="XXXX-XXXX-XXXX" disabled={snapshot.busy} /></label><p>Use the code shown by your agent. Leave it empty to restore this phone’s saved session.</p><button disabled={snapshot.busy}>Connect remote agent</button>
    </form></details>
    <details><summary>Local development agent</summary><p>For a development build connected to your computer. Inference still runs on your agent’s configured provider.</p><form onSubmit={event => { event.preventDefault(); void connectionController.pair('local', localOrigin.current?.value || '', localCode.current?.value || ''); if (localCode.current) localCode.current.value = ''; }}>
      <label>Local agent address<input ref={localOrigin} type="url" defaultValue="http://10.0.2.2:2138" autoCapitalize="none" spellCheck={false} required disabled={snapshot.busy} /></label>
      <label>Pairing code<input ref={localCode} autoComplete="off" autoCapitalize="characters" disabled={snapshot.busy} /></label><button disabled={snapshot.busy}>Connect local agent</button>
    </form></details>
    <details><summary>Mock mode</summary><p>Explore the prototype with simulated data and actions. No live agent connection is used.</p><button disabled={snapshot.busy} onClick={() => connectionController.mock()}>Enter mock mode</button></details>
    <button className="alpha-connection-offline" disabled={snapshot.busy} onClick={() => void connectionController.offline()}>Continue offline</button>
  </div></div>;
}
