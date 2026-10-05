import {browserDocuments} from './documents';
import {BrowserDomainDocument,type DomainRecovery} from './domain-document';
import {browserDevProfile} from './dev-profile';
export type DigestAuthorization={mutationId:string;kinds:string[];phase:'start'|'review'|'complete';state?:string;expiresAt?:string};
const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('alpha.browser.documents.v1');
const initial=()=>({pending:null as DigestAuthorization|null});
function validate(data:ReturnType<typeof initial>){
 const invalid=()=>{throw Error('Saved authorization needs recovery.');};
 if(!data||!Object.hasOwn(data,'pending'))return invalid();
 const p=data.pending;
 if(p===null)return p;
 if(!p||typeof p.mutationId!=='string'||!/^[a-f0-9-]{36}$/.test(p.mutationId))return invalid();
 if(!Array.isArray(p.kinds)||!p.kinds.length||p.kinds.length>2||new Set(p.kinds).size!==p.kinds.length||p.kinds.some(kind=>!['email','calendar'].includes(kind)))return invalid();
 if(!['start','review','complete'].includes(p.phase))return invalid();
 if(p.phase!=='start'&&(typeof p.state!=='string'||!/^[a-f0-9]{64}$/.test(p.state)||!Number.isFinite(Date.parse(p.expiresAt||''))))return invalid();
 return p;
}

export function digestAuthorizationDocument(scope:string,current:()=>boolean,signal:AbortSignal){
 if(!browserDevProfile||!/^[a-f0-9]{64}$/.test(scope))throw Error('Choose a development digest connection.');
 const key='alpha.browser.cloud-delegation:'+scope,check=()=>{signal.throwIfAborted();if(!current())throw Error('Connection changed.');},domain=new BrowserDomainDocument(browserDocuments,key,()=>localStorage.getItem(key));
 return {
  async read(){check();const data=await domain.read(initial,signal);check();return validate(data);},
  async save(expected:DigestAuthorization|null,next:DigestAuthorization|null){check();validate({pending:next});await domain.edit(initial,data=>{check();const pending=validate(data);if(JSON.stringify(pending)!==JSON.stringify(expected))throw Error('Authorization changed in another tab.');data.pending=next;},signal);check();channel?.postMessage({key});},
  subscribe(listener:()=>void){const changed=(event:MessageEvent)=>{if(event.data?.key===key)listener();},legacy=(event:StorageEvent)=>{if(event.key===key||event.key===null)listener();};channel?.addEventListener('message',changed);window.addEventListener('storage',legacy);return()=>{channel?.removeEventListener('message',changed);window.removeEventListener('storage',legacy);};},
  async capture(request?:AbortSignal){check();const result=await domain.capture(request?AbortSignal.any([signal,request]):signal);check();return result;},
  async reset(expected:DomainRecovery,request?:AbortSignal){check();await domain.reset(expected,request?AbortSignal.any([signal,request]):signal);check();channel?.postMessage({key});},
 };
}
