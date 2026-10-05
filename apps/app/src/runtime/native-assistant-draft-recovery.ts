import type {DomainRecovery} from '../browser/domain-document';
import {replaceAssistantDraft} from './assistant-draft-record';
type RawDraftSlot={read():Promise<string|null>;compareExchange(expected:string|null,value:string):Promise<{status:'saved'|'conflict'}>};
/** Recover readable JSON with an invalid draft schema, without reserializing its receipt. */
export function nativeAssistantDraftRecovery(binding:string,slot:RawDraftSlot){
 const captures=new WeakMap<object,string|null>();
 return {
  async capture(signal?:AbortSignal):Promise<DomainRecovery>{
   signal?.throwIfAborted();const raw=await slot.read();signal?.throwIfAborted();
   // A failed native read (including ciphertext damage) never produces reset authority.
   const snapshot={revision:crypto.randomUUID(),raw};captures.set(snapshot,raw);
   return {snapshot,raw,legacy:null,format:'domain',legacyChanged:false};
  },
  async reset(expected:DomainRecovery,signal?:AbortSignal):Promise<void>{
   signal?.throwIfAborted();const snapshot=expected.snapshot;
   if(!snapshot||!captures.has(snapshot))throw Error('Read the saved draft again before resetting.');
   const raw=captures.get(snapshot)!;
   const empty=replaceAssistantDraft(null,null,binding,'',()=>crypto.randomUUID());
   const receipt=await slot.compareExchange(raw,JSON.stringify(empty));
   signal?.throwIfAborted();
   if(receipt.status!=='saved')throw Error('This draft changed in another view. Close recovery and review the saved copy.');
   captures.delete(snapshot);
  },
 };
}
