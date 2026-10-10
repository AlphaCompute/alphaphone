import {Capacitor} from '@capacitor/core';
import type {BrowserDomainDocument} from '../browser/domain-document';
export type WorkflowIntentOwner={origin:string;ownerId:string;agentId:string};
type Archive={entries:Record<string,string>};
const empty=():Archive=>({entries:{}});
const prefix='alpha.workflow.pending.v1:';
export const workflowIntentKey=(owner:WorkflowIntentOwner,id:string)=>prefix+JSON.stringify([owner.origin,owner.ownerId,owner.agentId,id]);
/** Nonsecret pending requests, scoped to the captured agent account. */
export class WorkflowIntentStore {
 readonly documentKey:string;
 private readonly ownerPrefix:string;
 private epoch=0;
 private cached:Record<string,string>|null=null;
 private document?:Promise<BrowserDomainDocument>;
 constructor(owner:WorkflowIntentOwner){
  const parts=[owner.origin,owner.ownerId,owner.agentId];
  this.ownerPrefix=prefix+JSON.stringify(parts).slice(0,-1)+',';
  this.documentKey='alpha.browser.workflow-intents.v1:'+JSON.stringify(parts);
 }
 private check(key:string){if(!key.startsWith(this.ownerPrefix))throw Error('Workflow intent belongs to another agent');}
 private legacy():Archive{
  const entries:Record<string,string>={};
  for(const key of Object.keys(localStorage).sort())if(key.startsWith(this.ownerPrefix)){const raw=localStorage.getItem(key);if(raw!==null)entries[key]=raw;}
  return {entries};
 }
 private validate(value:Archive){
  if(!value||typeof value!=='object'||!value.entries||typeof value.entries!=='object'||Array.isArray(value.entries)||Object.keys(value).some(key=>key!=='entries'))throw Error('Workflow request history needs recovery');
  for(const [key,raw]of Object.entries(value.entries)){this.check(key);if(typeof raw!=='string')throw Error('Workflow request history needs recovery');}
  return value;
 }
 async recoveryDocument(){
  if(Capacitor.getPlatform()==='android')throw Error('Browser workflow recovery is unavailable on this device');
  return this.document??=Promise.all([import('../browser/domain-document'),import('../browser/documents')]).then(([{BrowserDomainDocument},{browserDocuments}])=>new BrowserDomainDocument(browserDocuments,this.documentKey,()=>{const value=this.legacy();return Object.keys(value.entries).length?JSON.stringify(value):null;}));
 }
 invalidate(){this.epoch++;this.cached=null;}
 /** True while no committed snapshot is held, when every key reads as locked. */
 get stale(){return this.cached===null;}
 locked(key:string){this.check(key);return this.cached===null||Object.hasOwn(this.cached,key);}
 pendingLifecycle(){return Object.keys(this.cached??{}).filter(key=>key.endsWith(':lifecycle')).flatMap(key=>{try{const parts=JSON.parse(key.slice(prefix.length,-':lifecycle'.length));return Array.isArray(parts)&&parts.length===4&&typeof parts[3]==='string'?[parts[3]]:[];}catch{return [];}});}
 async load(signal?:AbortSignal){
  const epoch=++this.epoch;signal?.throwIfAborted();const value=Capacitor.getPlatform()==='android'?this.legacy():await (await this.recoveryDocument()).read(empty,signal);
  signal?.throwIfAborted();const entries={...this.validate(value).entries};if(epoch===this.epoch)this.cached=entries;return entries;
 }
 async read(key:string,signal?:AbortSignal){this.check(key);return (await this.load(signal))[key]??null;}
 private async replace(key:string,expected:string|null,next:string|null,signal?:AbortSignal){
  this.check(key);signal?.throwIfAborted();
  let committed:Record<string,string>|null=null;
  const update=(value:Archive)=>{committed=null;const entries=this.validate(value).entries;if((entries[key]??null)!==expected)throw Error('Workflow request changed. Refresh its receipt before trying again.');if(next===null)delete entries[key];else entries[key]=next;committed={...entries};};
  try{
   if(Capacitor.getPlatform()==='android'){
    // Preserve the installed renderer slots; native durable storage is a separate gate.
    const value=this.legacy();update(value);if(next===null)localStorage.removeItem(key);else localStorage.setItem(key,next);if(localStorage.getItem(key)!==next)throw Error('Workflow intent save unconfirmed');
   }else await (await this.recoveryDocument()).edit(empty,update,signal);
  }catch(error){this.invalidate();throw error;}
  // The snapshot committed by this write is the current state. Dropping it here left every key reading as
  // locked whenever a reload raced the change notification, so unrelated actions were reported as unknown.
  this.epoch++;this.cached=committed;
  window.dispatchEvent(new Event('alpha:workflow-intents'));
  if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel('alpha.workflow-intents');channel.postMessage(this.documentKey);channel.close();}
 }
 async admit(key:string,intent:Record<string,unknown>,signal?:AbortSignal){
  const raw=JSON.stringify({...intent,intentRevision:crypto.randomUUID()});await this.replace(key,null,raw,signal);return raw;
 }
 async acknowledge(key:string,expected:string,signal?:AbortSignal){await this.replace(key,expected,null,signal);}
}
