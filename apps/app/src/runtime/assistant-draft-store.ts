import {Capacitor} from '@capacitor/core';
import {secureConnectionStore} from './native-connection';
import {readAssistantDraft,replaceAssistantDraft,type AssistantDraft} from './assistant-draft-record';

export async function assistantDraftStore(binding:string){
 if(!binding||binding.length>4096)throw Error('Invalid assistant draft identity.');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(binding))),n=>n.toString(16).padStart(2,'0')).join('');
 const slot='assistant-draft:v1:'+hash;
 const native=Capacitor.getPlatform()==='android';
 const domain=native?null:new (await import('../browser/json-domain-document')).BrowserJsonDomainDocument('alpha.browser.'+slot);
 return {
  recovery:domain?{
   capture:(signal?:AbortSignal)=>domain.capture(signal),
   reset:async(expected:import('../browser/domain-document').DomainRecovery,signal?:AbortSignal)=>{const empty=replaceAssistantDraft(null,null,binding,'',()=>crypto.randomUUID());await domain.restore(expected,JSON.stringify({raw:JSON.stringify(empty)}),signal);},
  }:undefined,
  async read(signal?:AbortSignal){signal?.throwIfAborted();const value=native?await secureConnectionStore.read(slot):await domain!.readJson(signal);signal?.throwIfAborted();return readAssistantDraft(value,binding);},
  async save(expected:AssistantDraft|null,text:string,signal?:AbortSignal):Promise<AssistantDraft>{
   signal?.throwIfAborted();let result:AssistantDraft|undefined;
   if(native){result=replaceAssistantDraft(expected,expected,binding,text,()=>crypto.randomUUID());const receipt=await secureConnectionStore.compareExchange(slot,expected,result);if(receipt.status!=='saved')throw Error('This draft changed in another view. Review the saved copy before replacing it.');}
   else await domain!.editJson(actual=>{signal?.throwIfAborted();result=replaceAssistantDraft(actual,expected,binding,text,()=>crypto.randomUUID());return result;},signal);
   signal?.throwIfAborted();return result!;
  },
 };
}
