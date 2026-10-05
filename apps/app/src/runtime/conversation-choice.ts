import {Capacitor} from '@capacitor/core';
import type {BrowserJsonDomainDocument} from '../browser/json-domain-document';

export const conversationChoiceKey='alpha.connection.conversations.v1';
export type ConversationChoice={id:string;revision?:string};
type Choices=Record<string,string|ConversationChoice>;
function validate(value:unknown):Choices{
 if(value===null)return {};
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Conversation selections need recovery.');
 for(const [key,item] of Object.entries(value)){
  let parts;try{parts=JSON.parse(key);}catch{throw Error('Conversation selection owner is invalid.');}
  if(!Array.isArray(parts)||parts.length!==3||parts.some(v=>typeof v!=='string'||!v))throw Error('Conversation selection owner is invalid.');
  const choice=typeof item==='string'?{id:item}:item;
  if(!choice||typeof choice!=='object'||typeof choice.id!=='string'||!choice.id||Object.keys(choice).some(k=>!['id','revision'].includes(k))||choice.revision!==undefined&&(typeof choice.revision!=='string'||!choice.revision))throw Error('Conversation selections need recovery.');
 }
 return value as Choices;
}
const choice=(values:Choices,key:string):ConversationChoice|null=>{const item=values[key];return item===undefined?null:typeof item==='string'?{id:item}:{...item};};
let document:Promise<BrowserJsonDomainDocument>|undefined;
export async function conversationChoiceDocument(){
 if(Capacitor.getPlatform()==='android')throw Error('Browser conversation recovery is unavailable on this device.');
 return document??=import('../browser/json-domain-document').then(({BrowserJsonDomainDocument})=>new BrowserJsonDomainDocument(conversationChoiceKey));
}
export async function readConversationChoice(key:string,signal?:AbortSignal){
 signal?.throwIfAborted();
 const values=Capacitor.getPlatform()==='android'?JSON.parse(localStorage.getItem(conversationChoiceKey)||'null'):await(await conversationChoiceDocument()).readJson(signal);
 signal?.throwIfAborted();return choice(validate(values),key);
}
/** Update one captured owner's restart choice. Visible chats remain tab-local. */
export async function saveConversationChoice(key:string,expected:ConversationChoice|null,id:string,signal:AbortSignal,assertCurrent:()=>void){
 const native=Capacitor.getPlatform()==='android';
 const update=(raw:unknown)=>{
  signal.throwIfAborted();assertCurrent();const values=validate(raw);
  if(JSON.stringify(choice(values,key))!==JSON.stringify(expected))throw Error('Another view changed this conversation selection.');
  const next={...values,[key]:native?id:{id,revision:crypto.randomUUID()}};validate(next);return next;
 };
 signal.throwIfAborted();
 if(native){const next=JSON.stringify(update(JSON.parse(localStorage.getItem(conversationChoiceKey)||'null')));localStorage.setItem(conversationChoiceKey,next);if(localStorage.getItem(conversationChoiceKey)!==next)throw Error('Conversation selection could not be confirmed.');}
 else await(await conversationChoiceDocument()).editJson(update,signal);
}
