import {browserDevProfile} from './dev-profile';
import {assertDevelopmentIdentity,developmentIdentity} from './development-identity';
import {editStore,readStore} from './store';
import {developmentDigestStore} from '../runtime/local-agent-storage';
import {actionScope} from '../runtime/device-actions';
import type {VerifiedSession} from '../runtime/alpha-client';
/** The production inbox keeps its CAS/recovery semantics in browser development. */
export async function browserDigestStore(session:VerifiedSession,current:()=>boolean){
 if(!browserDevProfile)throw Error('Development mode required.');
 const selected=JSON.parse(localStorage.getItem('alpha.connection.selection.v1')||'null');
 if(selected?.kind!=='development'||!['local','cloud','remote'].includes(selected.profile))throw Error('Choose a development connection.');
 const identity=developmentIdentity(selected.profile);
 if(identity.ownerId!==session.ownerId||identity.agentId!==session.agentId)throw Error('Digest owner changed.');
 const prefix='hosted-digests:v1:'+await actionScope(JSON.stringify([session.origin,session.ownerId,session.agentId]));
 const check=(slot:unknown)=>{
  assertDevelopmentIdentity(identity);
  const selection=JSON.parse(localStorage.getItem('alpha.connection.selection.v1')||'null');
  if(!current()||selection?.kind!=='development'||selection.profile!==identity.profile)throw Error('Digest connection changed.');
  if(typeof slot!=='string'||slot.length>300||(slot!==prefix&&!slot.startsWith(prefix+':')))throw Error('Digest storage scope changed.');
 };
 return developmentDigestStore(async input=>{
  check(input.slot);const key='alpha.browser.'+input.slot,initial=()=>({value:null as string|null});
  if(input.operation==='digestRead')return readStore(key,initial);
  if(input.operation!=='digestCompareExchange')throw Error('Unknown digest storage operation.');
  if(input.value!==null&&(typeof input.value!=='string'||new TextEncoder().encode(input.value).length>250000))throw Error('Digest storage exceeds the recovery limit.');
  return editStore(key,initial,data=>{check(input.slot);if(data.value!==input.expectedValue)return {status:'conflict'};data.value=input.value as string|null;return {status:'saved'};});
 });
}
