import {developmentWorkflowRequest} from './development-workflows';
import {developmentIdentity,assertDevelopmentIdentity,type DevelopmentIdentity} from './development-identity';
import {developmentActionRequest} from './development-actions';
import {browserDevProfile} from './dev-profile';
import {editStore,readStore} from './store';
import type {LocalAgentBridge} from '../runtime/local-agent';
export const developmentProfiles=['local','cloud','remote'] as const;
export type DevelopmentProfile=typeof developmentProfiles[number];
export const developmentName=(profile:DevelopmentProfile)=>`${profile==='local'?'On-device':profile==='cloud'?'Cloud':'Remote'} agent · development`;
type Message={id:string;role:'user'|'assistant';text:string};
type Conversation={id:string;title:string;messages:Message[];receipts:Record<string,{input:string;text:string}>};
type State={version:1;reply:string;conversations:Conversation[]};
const initial=():State=>({version:1,reply:'Development reply. Edit this response in Agent connection.',conversations:[]});
const key=(identity:DevelopmentIdentity)=>`alpha.browser.agent.${identity.namespace}.v1`;
function allowed(profile:DevelopmentProfile){if(!browserDevProfile||!developmentProfiles.includes(profile))throw Error('Choose a development profile.');}
function validate(data:State){if(!data||data.version!==1||typeof data.reply!=='string'||!data.reply.trim()||data.reply.length>16000||!Array.isArray(data.conversations)||data.conversations.length>100||data.conversations.some(c=>typeof c.id!=='string'||typeof c.title!=='string'||!Array.isArray(c.messages)||c.messages.length>200||!c.receipts||typeof c.receipts!=='object'))throw Error('Development agent data needs recovery.');return data;}
export function developmentReply(profile:DevelopmentProfile){allowed(profile);return validate(readStore(key(developmentIdentity(profile)),initial)).reply;}
export async function saveDevelopmentReply(profile:DevelopmentProfile,reply:string,signal?:AbortSignal){allowed(profile);const identity=developmentIdentity(profile);if(typeof reply!=='string'||!reply.trim()||reply.length>16000)throw Error('Enter a reply between 1 and 16000 characters.');await editStore(key(identity),initial,data=>{assertDevelopmentIdentity(identity);validate(data);data.reply=reply;},signal);}
/** Local protocol fixture for explicit dev profiles. It has no network or credential APIs. */
export function developmentBridge(profile:DevelopmentProfile,identity=developmentIdentity(profile)):LocalAgentBridge{
 allowed(profile);const {ownerId,agentId}=identity;
 return {start:async()=>({state:'running'}),async request(input,signal){
  signal?.throwIfAborted();allowed(profile);assertDevelopmentIdentity(identity);const path=input.path,body=input.body===undefined?undefined:JSON.parse(input.body);let result:unknown;
  if(path==='/api/auth/me')result={identity:{id:ownerId,kind:'owner'},access:{role:'OWNER',mode:'local'}};
  else if(path==='/api/agents')result={agents:[{id:agentId,name:developmentName(profile),status:'running'}]};
  else{
   if(input.ownerId!==ownerId)throw Error('Development owner changed.');
   const check=()=>{signal?.throwIfAborted();assertDevelopmentIdentity(identity);const selected=JSON.parse(localStorage.getItem('alpha.connection.selection.v1')||'null');if(selected?.kind!=='development'||selected.profile!==profile)throw Error('Development selection changed.');};check();
   if(path.startsWith('/api/workflow/'))result=await developmentWorkflowRequest(identity,path,body,signal);
   else if(path.startsWith('/api/client-devices/'))result=await developmentActionRequest(profile,path,body,signal,identity);
   else if(path==='/api/conversations'&&input.method==='GET')result={conversations:validate(readStore(key(identity),initial)).conversations.map(({id,title})=>({id,title}))};
   else if(path==='/api/conversations'&&input.method==='POST')result=await editStore(key(identity),initial,data=>{check();validate(data);if(data.conversations.length>=100)throw Error('Development history is full.');const title=body?.title;if(typeof title!=='string'||title.length>256)throw Error('Choose a conversation title.');const row:Conversation={id:crypto.randomUUID(),title,messages:[],receipts:{}};data.conversations.push(row);return {conversation:{id:row.id,title}};},signal);
   else{const match=/^\/api\/conversations\/([a-zA-Z0-9_-]+)\/messages$/.exec(path);if(!match)throw Error('This development protocol operation is not configured.');
    if(input.method==='GET'){const row=validate(readStore(key(identity),initial)).conversations.find(c=>c.id===match[1]);if(!row)throw Error('Conversation not found.');result={messages:row.messages};}
    else result=await editStore(key(identity),initial,data=>{check();validate(data);const row=data.conversations.find(c=>c.id===match[1]);if(!row)throw Error('Conversation not found.');const text=body?.text,id=body?.clientMessageId;if(typeof text!=='string'||!text.trim()||text.length>200000||typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(id))throw Error('Choose a development message.');if(['__proto__','constructor','prototype'].includes(id))throw Error('Invalid message identity.');const prior=Object.hasOwn(row.receipts,id)?row.receipts[id]:undefined;if(prior){if(prior.input!==text)throw Error('Message identity changed.');return {text:prior.text,agentName:developmentName(profile)};}if(row.messages.length>=200)throw Error('Development conversation is full.');const reply=data.reply;row.messages.push({id:crypto.randomUUID(),role:'user',text},{id:crypto.randomUUID(),role:'assistant',text:reply});row.receipts[id]={input:text,text:reply};return {text:reply,agentName:developmentName(profile)};},signal);
   }
  }
  signal?.throwIfAborted();return {status:200,body:JSON.stringify(result)};
 }};
}
