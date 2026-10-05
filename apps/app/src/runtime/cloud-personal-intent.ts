import {Capacitor} from '@capacitor/core';
import type {PersonalOwner} from './cloud-personal-protocol';
import type {BrowserJsonDomainDocument} from '../browser/json-domain-document';
export type PersonalIntent={version:1;revision?:string;credentialId:string;phase:'activation'|'cutover';personalElizaId:string;dedicatedAgentId?:string;state:'attempting'|'accepted'};
export type PersonalIntentInput=Omit<PersonalIntent,'version'|'revision'|'credentialId'>;
export const personalIntentKey=(owner:PersonalOwner)=>'alpha.cloud.personal-setup.v1:'+JSON.stringify([owner.environment,owner.userId,owner.organizationId]);
function decode(value:any):PersonalIntent|null{
 if(value===null)return null;
 if(!value||value.version!==1||typeof value.credentialId!=='string'||!['activation','cutover'].includes(value.phase)||!['attempting','accepted'].includes(value.state)||typeof value.personalElizaId!=='string'||value.dedicatedAgentId!==undefined&&typeof value.dedicatedAgentId!=='string'||value.revision!==undefined&&(typeof value.revision!=='string'||!/^[a-f0-9-]{36}$/.test(value.revision)))throw Error('Saved Cloud setup needs review. No setup request was sent.');return value;
}
export async function personalIntentDocument(owner:PersonalOwner):Promise<BrowserJsonDomainDocument>{
 if(Capacitor.getPlatform()==='android')throw Error('Browser Cloud setup recovery is unavailable on this device.');
 const {BrowserJsonDomainDocument}=await import('../browser/json-domain-document');
 return new BrowserJsonDomainDocument(personalIntentKey(owner));
}
/** Nonsecret owner-scoped intent. Credentials and quote authority are never stored here. */
export async function personalIntent(owner:PersonalOwner,signal?:AbortSignal):Promise<PersonalIntent|null>{
 signal?.throwIfAborted();if(Capacitor.getPlatform()==='android')return decode(JSON.parse(localStorage.getItem(personalIntentKey(owner))??'null'));
 return decode(await (await personalIntentDocument(owner)).readJson(signal));
}
async function replace(owner:PersonalOwner,expected:PersonalIntent|null,next:PersonalIntent|null,signal?:AbortSignal){
 const update=(before:PersonalIntent|null)=>{if(JSON.stringify(decode(before))!==JSON.stringify(expected))throw Error('Cloud setup changed in another view. Refresh its status.');return next;};signal?.throwIfAborted();
 if(Capacitor.getPlatform()==='android'){
  // Preserve the installed renderer slot. One synchronous compare/write segment;
  // native secure-intent migration is separate from the browser qualification.
  const key=personalIntentKey(owner),nextValue=update(JSON.parse(localStorage.getItem(key)??'null')),value=nextValue===null?null:JSON.stringify(nextValue);if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);if(localStorage.getItem(key)!==value)throw Error('Cloud setup persistence could not be confirmed.');
 }else await (await personalIntentDocument(owner)).editJson<PersonalIntent>(update,signal);
 return next;
}
export async function savePersonalIntent(owner:PersonalOwner,intent:PersonalIntentInput,expected:PersonalIntent|null,signal?:AbortSignal):Promise<PersonalIntent>{
 const next:PersonalIntent={...intent,version:1,revision:crypto.randomUUID(),credentialId:owner.credentialId};decode(next);await replace(owner,expected,next,signal);return next;
}
export async function clearPersonalIntent(owner:PersonalOwner,expected:PersonalIntent,signal?:AbortSignal){await replace(owner,expected,null,signal);}
