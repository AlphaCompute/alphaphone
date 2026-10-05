import {browserDocuments} from './documents';
import {BrowserDomainDocument} from './domain-document';
import {browserDevProfile} from './dev-profile';
import {assertDevelopmentIdentity,verifyDevelopmentIdentity,developmentDefaultReply,type DevelopmentIdentity} from './development-identity';
import {devSurfacesEnabled} from '../build-flags';
export type DevelopmentMessage={id:string;role:'user'|'assistant';text:string};
export type DevelopmentConversation={id:string;title:string;messages:DevelopmentMessage[];receipts:Record<string,{input:string;text:string}>};
export type DevelopmentAgentState={version:1;reply:string;conversations:DevelopmentConversation[]};
const initial=():DevelopmentAgentState=>({version:1,reply:developmentDefaultReply,conversations:[]});
function check(identity:DevelopmentIdentity,signal?:AbortSignal){
 signal?.throwIfAborted();
 if(!devSurfacesEnabled||!browserDevProfile||!/^(local|remote|cloud(?:\.(first|second))?)$/.test(identity.namespace))throw Error('Choose a development profile.');
 assertDevelopmentIdentity(identity);
}
export function validateDevelopmentAgent(data:DevelopmentAgentState){
 if(!data||data.version!==1||typeof data.reply!=='string'||!data.reply.trim()||data.reply.length>16000||!Array.isArray(data.conversations)||data.conversations.length>100||data.conversations.some(c=>!c||typeof c.id!=='string'||typeof c.title!=='string'||!Array.isArray(c.messages)||c.messages.length>200||!c.receipts||typeof c.receipts!=='object'))throw Error('Development agent data needs recovery.');return data;
}
/** Conversations, scripted reply and message receipts share one owner document. */
export function developmentAgentDocument(identity:DevelopmentIdentity){
 check(identity);const key=`alpha.browser.agent.${identity.namespace}.v1`;
 return new BrowserDomainDocument(browserDocuments,key,()=>{check(identity);return localStorage.getItem(key);});
}
export async function readDevelopmentAgent(identity:DevelopmentIdentity,signal?:AbortSignal){
 await verifyDevelopmentIdentity(identity,signal);check(identity,signal);const data=await developmentAgentDocument(identity).read(initial,signal);await verifyDevelopmentIdentity(identity,signal);check(identity,signal);return validateDevelopmentAgent(data);
}
export async function editDevelopmentAgent<R>(identity:DevelopmentIdentity,edit:(data:DevelopmentAgentState)=>R|Promise<R>,signal?:AbortSignal):Promise<R>{
 await verifyDevelopmentIdentity(identity,signal);check(identity,signal);return developmentAgentDocument(identity).edit(initial,async data=>{await verifyDevelopmentIdentity(identity,signal);check(identity,signal);const result=await edit(validateDevelopmentAgent(data));await verifyDevelopmentIdentity(identity,signal);check(identity,signal);return result;},signal);
}
