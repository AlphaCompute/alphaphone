import {Capacitor} from '@capacitor/core';
import type {BrowserJsonDomainDocument} from '../browser/json-domain-document';

export const conversationSelectionKey='alpha.connection.conversations.v1';
type Choices=Record<string,string>;
let document:Promise<BrowserJsonDomainDocument>|undefined;
export function conversationSelectionDocument(){
 if(Capacitor.getPlatform()==='android')throw Error('Browser conversation recovery is unavailable on this device');
 return document??=import('../browser/json-domain-document').then(({BrowserJsonDomainDocument})=>new BrowserJsonDomainDocument(conversationSelectionKey));
}
function choices(value:unknown):Choices{
 if(value===null)return {};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.values(value).some(id=>typeof id!=='string'||!id))throw Error('Saved conversation choices need recovery. Open conversation selection recovery in Agent connection.');
 return value as Choices;
}
function nativeChoices():Choices{
 try{return choices(JSON.parse(localStorage.getItem(conversationSelectionKey)||'null'));}catch{return {};}
}
export async function readConversationChoice(owner:string,signal?:AbortSignal):Promise<string|undefined>{
 signal?.throwIfAborted();
 try{
  const saved=Capacitor.getPlatform()==='android'?nativeChoices():choices(await(await conversationSelectionDocument()).readJson(signal));
  signal?.throwIfAborted();return Object.hasOwn(saved,owner)?saved[owner]:undefined;
 }catch{signal?.throwIfAborted();throw Error('Saved conversation choices need recovery. Open conversation selection recovery in Agent connection.');}
}
/** Cache selection only: a saved ID grants no access and never replaces server ownership checks. */
export async function saveConversationChoice(owner:string,id:string,signal?:AbortSignal):Promise<void>{
 signal?.throwIfAborted();if(!owner||!id)throw Error('Invalid conversation selection');
 if(Capacitor.getPlatform()==='android'){
  // Native keeps its installed renderer format; read at completion, never before a provider await.
  const saved=nativeChoices();saved[owner]=id;const raw=JSON.stringify(saved);localStorage.setItem(conversationSelectionKey,raw);
  if(localStorage.getItem(conversationSelectionKey)!==raw)throw Error('Conversation selection could not be saved');
 }else await(await conversationSelectionDocument()).editJson<Choices>(value=>({...choices(value),[owner]:id}),signal);
}
