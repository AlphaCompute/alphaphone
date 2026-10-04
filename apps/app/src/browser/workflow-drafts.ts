import {browserDevProfile} from './dev-profile';
import {assertDevelopmentIdentity,developmentIdentity} from './development-identity';
import {BrowserDomainDocument} from './domain-document';
import {browserDocuments} from './documents';
import {workflowSha} from '../runtime/workflow-device-contract';
import type {VerifiedSession} from '../runtime/alpha-client';
export async function browserWorkflowDraftStore(session:VerifiedSession){
 if(!browserDevProfile)throw Error('Development mode required.');
 const selected=JSON.parse(localStorage.getItem('alpha.connection.selection.v1')||'null');if(selected?.kind!=='development'||!['local','cloud','remote'].includes(selected.profile))throw Error('Choose a development connection.');
 const identity=developmentIdentity(selected.profile);if(identity.ownerId!==session.ownerId||identity.agentId!==session.agentId)throw Error('Workflow owner changed.');
 const slot='workflow-draft:v1:'+await workflowSha([session.origin,session.ownerId,session.agentId]),key='alpha.browser.'+slot;
 const document=new BrowserDomainDocument(browserDocuments,key,()=>localStorage.getItem(key));
 const check=(value:string)=>{assertDevelopmentIdentity(identity);const current=JSON.parse(localStorage.getItem('alpha.connection.selection.v1')||'null');if(value!==slot||current?.kind!=='development'||current.profile!==identity.profile)throw Error('Workflow draft owner changed.');};
 const read=async()=>{const state=await document.read<{value:string|null}>(()=>({value:null}));if(state.value!==null&&(typeof state.value!=='string'||new TextEncoder().encode(state.value).length>100000))throw Error('Workflow draft data needs recovery.');return state;};
 return {
  async secureRead(input:{slot:string}){check(input.slot);const state=await read();check(input.slot);return {value:state.value};},
  async secureCompareExchange(input:{slot:string;expectedValue:string|null;value:string|null}){check(input.slot);if(input.value!==null&&(typeof input.value!=='string'||new TextEncoder().encode(input.value).length>100000))throw Error('Workflow draft exceeds the recovery limit.');return document.edit(()=>({value:null as string|null}),data=>{check(input.slot);if(data.value!==input.expectedValue)return {status:'conflict'};data.value=input.value;return {status:'saved'};});},
 };
}
