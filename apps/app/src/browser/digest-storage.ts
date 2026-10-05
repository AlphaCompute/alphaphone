import {browserDevProfile} from './dev-profile';
import {assertDevelopmentIdentity,developmentIdentity} from './development-identity';
import {BrowserDomainDocument,type DomainRecovery} from './domain-document';
import {browserDocuments} from './documents';
import {developmentDigestStore} from '../runtime/local-agent-storage';
import {actionScope} from '../runtime/device-actions';
import type {VerifiedSession} from '../runtime/alpha-client';
/** The production inbox keeps its CAS/recovery semantics in browser development. */
export async function browserDigestStore(session:VerifiedSession,current:()=>boolean,signal?:AbortSignal){
 if(!browserDevProfile)throw Error('Development mode required.');
 const selected=JSON.parse(localStorage.getItem('alpha.connection.selection.v1')||'null');
 if(selected?.kind!=='development'||!['local','cloud','remote'].includes(selected.profile))throw Error('Choose a development connection.');
 const identity=developmentIdentity(selected.profile);
 if(identity.ownerId!==session.ownerId||identity.agentId!==session.agentId)throw Error('Digest owner changed.');
 const prefix='hosted-digests:v1:'+await actionScope(JSON.stringify([session.origin,session.ownerId,session.agentId]));
 const check=(slot:unknown)=>{
  signal?.throwIfAborted();assertDevelopmentIdentity(identity);
  const selection=JSON.parse(localStorage.getItem('alpha.connection.selection.v1')||'null');
  if(!current()||selection?.kind!=='development'||selection.profile!==identity.profile)throw Error('Digest connection changed.');
  if(typeof slot!=='string'||slot.length>300||(slot!==prefix&&!slot.startsWith(prefix+':')))throw Error('Digest storage scope changed.');
 };
 // All inbox slots migrate together; the backup retains each original slot's exact
 // bytes, even when an individual slot is malformed. Never update the old keys.
 const legacyPrefix='alpha.browser.'+prefix;
 const belongs=(key:string)=>key===legacyPrefix||key.startsWith(legacyPrefix+':');
 type State={slots:Record<string,string>};
 const initial=():State=>({slots:{}});
 const domain=new BrowserDomainDocument(browserDocuments,legacyPrefix+'.document.v1',()=>{
  check(prefix);const keys=Object.keys(localStorage).filter(belongs).sort();
  if(!keys.length)return null;
  const slots:Record<string,string>={};
  for(const key of keys){const raw=localStorage.getItem(key);if(raw!==null)slots[key.slice('alpha.browser.'.length)]=raw;}
  return JSON.stringify({slots});
 });
 const validate=(state:State)=>{
  if(!state||!state.slots||typeof state.slots!=='object'||Array.isArray(state.slots)||Object.entries(state.slots).some(([slot,raw])=>{try{check(slot);return typeof raw!=='string';}catch{return true;}}))throw Error('Digest inbox needs recovery.');
  return state;
 };
 const value=(state:State,slot:string):string|null=>{
  validate(state);if(!Object.hasOwn(state.slots,slot))return null;
  const row=JSON.parse(state.slots[slot]);
  if(!row||typeof row!=='object'||Array.isArray(row)||!Object.hasOwn(row,'value')||row.value!==null&&typeof row.value!=='string')throw Error('Digest inbox needs recovery.');
  return row.value;
 };
 const storage=developmentDigestStore(async input=>{
  check(input.slot);const slot=input.slot as string;
  if(input.operation==='digestRead'){const state=await domain.read(initial,signal);check(slot);return {value:value(state,slot)};}
  if(input.operation!=='digestCompareExchange')throw Error('Unknown digest storage operation.');
  if(input.value!==null&&(typeof input.value!=='string'||new TextEncoder().encode(input.value).length>250000))throw Error('Digest storage exceeds the recovery limit.');
  return domain.edit(initial,data=>{check(slot);if(value(data,slot)!==input.expectedValue)return {status:'conflict'};data.slots[slot]=JSON.stringify({value:input.value});return {status:'saved'};},signal);
 });
 const recoverySignal=(request?:AbortSignal)=>signal&&request?AbortSignal.any([signal,request]):signal??request;
 return {...storage,recovery:{
  async capture(request?:AbortSignal){check(prefix);const result=await domain.capture(recoverySignal(request));check(prefix);return result;},
  async reset(expected:DomainRecovery,request?:AbortSignal){check(prefix);await domain.reset(expected,recoverySignal(request));check(prefix);},
 }};
}
