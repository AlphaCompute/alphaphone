import {Capacitor} from '@capacitor/core';
import type {BrowserJsonDomainDocument} from '../browser/json-domain-document';

export const conversationSelectionKey='alpha.connection.conversations.v1';
export type ConversationChoice={id:string;revision?:string};
type Choices=Record<string,string|ConversationChoice>;
function validate(value:unknown):Choices{
 if(value===null)return {};
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Conversation selections need recovery.');
 for(const [key,item] of Object.entries(value)){
  if(!key)throw Error('Conversation selection owner is invalid.');
  const choice=typeof item==='string'?{id:item}:item;
  if(!choice||typeof choice!=='object'||typeof choice.id!=='string'||!choice.id||Object.keys(choice).some(k=>!['id','revision'].includes(k))||choice.revision!==undefined&&(typeof choice.revision!=='string'||!choice.revision))throw Error('Conversation selections need recovery.');
 }
 return value as Choices;
}
const choice=(values:Choices,key:string):ConversationChoice|null=>{const item=Object.hasOwn(values,key)?values[key]:undefined;return item===undefined?null:typeof item==='string'?{id:item}:{...item};};
let document:Promise<BrowserJsonDomainDocument>|undefined;
export async function conversationSelectionDocument(){
 if(Capacitor.getPlatform()==='android')throw Error('Browser conversation recovery is unavailable on this device.');
 return document??=import('../browser/json-domain-document').then(({BrowserJsonDomainDocument})=>new BrowserJsonDomainDocument(conversationSelectionKey));
}
export async function captureConversationChoice(key:string,signal?:AbortSignal){
 signal?.throwIfAborted();
 const values=Capacitor.getPlatform()==='android'?JSON.parse(localStorage.getItem(conversationSelectionKey)||'null'):await(await conversationSelectionDocument()).readJson(signal);
 signal?.throwIfAborted();return choice(validate(values),key);
}
/** Update one captured owner's restart choice. Visible chats remain tab-local. */
export async function selectConversation(key:string,expected:ConversationChoice|null,id:string,signal:AbortSignal,assertCurrent:()=>void){
 const native=Capacitor.getPlatform()==='android';
 const update=(raw:unknown)=>{
  signal.throwIfAborted();assertCurrent();const values=validate(raw);
  if(JSON.stringify(choice(values,key))!==JSON.stringify(expected))throw Error('Another view changed this conversation selection.');
  const next={...values,[key]:native?id:{id,revision:crypto.randomUUID()}};validate(next);return next;
 };
 signal.throwIfAborted();
 if(native){const next=JSON.stringify(update(JSON.parse(localStorage.getItem(conversationSelectionKey)||'null')));localStorage.setItem(conversationSelectionKey,next);if(localStorage.getItem(conversationSelectionKey)!==next)throw Error('Conversation selection could not be confirmed.');}
 else await(await conversationSelectionDocument()).editJson(update,signal);
}

/** Convenience API for a choice made now; delayed operations use captured revisions. */
export async function readConversationChoice(owner:string,signal?:AbortSignal){return (await captureConversationChoice(owner,signal))?.id;}
export async function saveConversationChoice(owner:string,id:string,signal:AbortSignal=new AbortController().signal){
 const expected=await captureConversationChoice(owner,signal);await selectConversation(owner,expected,id,signal,()=>{});
}
