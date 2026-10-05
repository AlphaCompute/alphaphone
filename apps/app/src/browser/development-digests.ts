import {developmentDelegationRequest,grantAccount,type DevelopmentDelegation} from './digest-delegation';
import {devSurfacesEnabled} from '../build-flags';
import {browserDigestAccount,validateBrowserDigestSelection,readBrowserDigestSource} from './digest-live-sources';
import type {DigestResult,DigestSource,DigestLoop} from '../runtime/hosted-digests';
import {assertDevelopmentIdentity,developmentIdentity,developmentDefaultReply,type DevelopmentIdentity} from './development-identity';
import {editStore,revision} from './store';
type Source=DigestSource&{text:string};
type Loop=DigestLoop&{createdAt:number;lastOccurrence?:string};
type State={delegation?:DevelopmentDelegation;liveRevision?:string;sources:Source[];loops:Loop[];receipts:Array<{id:string;input:string;result:unknown}>;results:DigestResult[];cursor:number;acks:Record<string,number>};
const initial=():State=>({sources:[],loops:[],receipts:[],results:[],cursor:0,acks:{}});
const id=(v:unknown):string=>{if(typeof v!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(v))throw Error('Invalid digest identity.');return v;};
function wall(at:number,zone:string){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
/** Requests and periodic inbox checks advance only the current minute, never a backlog. */
export async function developmentDigestRequest(identity:DevelopmentIdentity,path:string,body:any,signal?:AbortSignal){
 if(!devSurfacesEnabled)throw Error('Development profiles are unavailable in this build.');
 const check=()=>{signal?.throwIfAborted();assertDevelopmentIdentity(identity);const selected=JSON.parse(localStorage.getItem('alpha.connection.selection.v1')||'null');if(selected?.kind!=='development'||selected.profile!==identity.profile)throw Error('Digest connection changed.');};check();
 return editStore(`alpha.browser.digests.${identity.namespace}.v1`,initial,async state=>{
  check();const now=Date.now(),minute=Math.floor(now/60000)*60000;
  const delegation=state.delegation??={requests:[],grants:[]};
  const liveAccount=(accountId:string)=>{if(accountId==='browser:'+identity.namespace)return browserDigestAccount(identity,state.liveRevision||'');const grant=delegation.grants.find(g=>'cloud:'+g.id===accountId&&!g.revoked&&Date.parse(g.expiresAt)>now);if(!grant)throw Error('Source access changed.');return grantAccount(grant);};
  const validateLive=(value:any)=>{const account=liveAccount(value?.accountId);return validateBrowserDigestSelection(value,identity,account.accountRevision,account);};
  if(path.startsWith('/api/workflow/hosted/cloud-delegation/')){const operation=path.slice('/api/workflow/hosted/cloud-delegation/'.length),result=developmentDelegationRequest(delegation,operation,body,now);if(operation==='revoke')for(const source of state.sources)if(source.live?.accountId==='cloud:'+body.grantId)source.revoked=true;return result;}
  const tick=async()=>{for(const loop of state.loops){if(!loop.active||loop.removed||loop.createdAt>minute)continue;const local=wall(minute,loop.spec.timeZone);if(local.slice(11)!==loop.spec.localTime||loop.lastOccurrence===local)continue;
   // Repeated civil times execute at their earlier instant. Gaps never match.
   let repeated=false;for(let delta=60000;delta<=3*3600000;delta+=60000)if(wall(minute-delta,loop.spec.timeZone)===local){repeated=true;break;}if(repeated)continue;
   loop.lastOccurrence=local;const source=state.sources.find(s=>s.id===loop.spec.sourceId&&s.revision===loop.spec.sourceRevision);if(!source||source.revoked||Date.parse(source.expiresAt)<=now)continue;
   let readError:string|null=null,liveInput:Awaited<ReturnType<typeof readBrowserDigestSource>>|undefined;if(source.live){try{validateLive(source.live);liveInput=await readBrowserDigestSource(source.live,now);}catch(error){readError=(error as Error).message;}check();}
   const configured=JSON.parse(localStorage.getItem(`alpha.browser.agent.${identity.namespace}.v1`)||'null'),output=configured?.reply??developmentDefaultReply;if(typeof output!=='string'||output.length>16000)throw Error('Digest output exceeds the development limit.');
   const time=new Date(now).toISOString();state.results.push({cursor:++state.cursor,runId:crypto.randomUUID(),workflowId:loop.id,workflowVersionId:loop.versionId,templateVersion:'development-v1',scheduledAt:new Date(minute).toISOString(),source:{id:source.id,revision:source.revision,observedAt:source.live?time:source.observedAt,expiresAt:source.expiresAt,...(source.live?{live:source.live}:{})},status:readError?'failed':'completed',startedAt:time,completedAt:time,output:readError?null:liveInput?{summary:output,...liveInput}:output,error:readError});if(state.results.length>100)state.results.shift();
  }};
  if(path==='/api/workflow/hosted/tick'){await tick();check();return {};}
  if(path==='/api/workflow/hosted/sources'&&body===undefined)return {sources:state.sources.map(({text,...source})=>source)};
  if(path==='/api/workflow/hosted/loops'&&body===undefined)return {loops:state.loops};
  if(path==='/api/workflow/hosted/live-accounts'){state.liveRevision??=revision();return {accounts:[browserDigestAccount(identity,state.liveRevision),...delegation.grants.filter(g=>!g.revoked&&Date.parse(g.expiresAt)>now).map(grantAccount)]};}
  if(path==='/api/workflow/hosted/live-calendars'){const account=liveAccount(body?.accountId);if(!account.kinds.includes('calendar'))throw Error('Calendar access is not granted.');if(body?.accountId!==account.accountId||body.accountRevision!==account.accountRevision)throw Error('Source access changed.');return {calendars:[{calendarId:'local',label:'Browser calendar',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}],truncated:false};}
    if(path.startsWith('/api/workflow/hosted/results?')){const client=id(new URL(path,location.origin).searchParams.get('clientId'));await tick();check();return {entries:state.results.filter(r=>r.cursor>(Object.hasOwn(state.acks,client)?state.acks[client]:0)).slice(0,50)};}
  if(path==='/api/workflow/hosted/results/ack'){const client=id(body?.clientId);if(!state.results.some(r=>r.cursor===body.cursor&&r.runId===body.runId))throw Error('Digest receipt changed.');if(!Object.hasOwn(state.acks,client)&&Object.keys(state.acks).length>=100)throw Error('Digest client history is full.');state.acks[client]=Math.max(Object.hasOwn(state.acks,client)?state.acks[client]:0,body.cursor);return {};}
  if(!body||body.confirmed!==true)throw Error('Review this digest change first.');
  if(path==='/api/workflow/hosted/sources/revoke'){const source=state.sources.find(s=>s.id===id(body.id));if(!source)throw Error('Source not found.');source.revoked=true;return {source};}
  const mutationId=id(path.endsWith('/sources')?body.id:body.mutationId),input=JSON.stringify([path,body]),prior=state.receipts.find(r=>r.id===mutationId);if(prior){if(prior.input!==input)throw Error('Digest mutation content changed.');return prior.result;}
  if(state.receipts.length>=500)throw Error('Digest mutation history is full.');let result:unknown;
  if(path==='/api/workflow/hosted/sources'){
   if(!['email','calendar','tasks','notes'].includes(body.kind)||typeof body.label!=='string'||!body.label.trim()||body.label.length>200||!body.live&&(typeof body.text!=='string'||!body.text.trim()||body.text.length>14000)||!Number.isFinite(Date.parse(body.observedAt))||!Number.isFinite(Date.parse(body.expiresAt))||Date.parse(body.expiresAt)<=now||Date.parse(body.expiresAt)>now+168*3600000||state.sources.length>=100)throw Error('Review a current bounded snapshot.');
   let live;try{if(body.live){live=validateLive(body.live);if(live.kind!==body.kind)throw Error('Source kind changed.');const account=liveAccount(live.accountId);if('expiresAt' in account&&typeof account.expiresAt==='string'&&Date.parse(body.expiresAt)>Date.parse(account.expiresAt))throw Error('Source outlives its grant.');}}catch{throw Object.assign(Error('Source access changed.'),{status:409,code:'HOSTED_SOURCE_NOT_SAVED',mutationId});}
   const source:Source={...(live?{live}:{}),id:mutationId,revision:revision(),kind:body.kind,label:body.label,text:live?'':body.text,observedAt:body.observedAt,expiresAt:body.expiresAt,revoked:false};state.sources.push(source);result={source};
  }else if(path==='/api/workflow/hosted/loops'){
   const spec=body.spec;if(!spec||spec.version!==1||!['morning','evening'].includes(spec.template)||typeof spec.enabled!=='boolean'||typeof spec.timeZone!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(spec.localTime))throw Error('Invalid digest schedule.');wall(now,spec.timeZone);
   const source=state.sources.find(s=>s.id===spec.sourceId&&s.revision===spec.sourceRevision);if(!source||spec.enabled&&(source.revoked||Date.parse(source.expiresAt)<=now))throw Error('Source access changed.');
   const old=body.id?state.loops.find(l=>l.id===id(body.id)):undefined;if(body.id&&(!old||old.versionId!==body.expectedVersionId))throw Error('Digest version changed.');if(!old&&state.loops.some(l=>!l.removed&&l.spec.template===spec.template))throw Error('Refresh the existing digest schedule.');if(!old&&state.loops.length>=100)throw Error('Digest schedule history is full.');
   const loop:Loop={id:old?.id||crypto.randomUUID(),versionId:crypto.randomUUID(),name:spec.template+' digest',active:spec.enabled,removed:false,spec:structuredClone(spec),createdAt:now,...(old?.lastOccurrence?{lastOccurrence:old.lastOccurrence}:{})};state.loops=state.loops.filter(l=>l.id!==loop.id);state.loops.push(loop);result={loop};
  }else throw Error('Unknown development digest request.');
  state.receipts.push({id:mutationId,input,result});return result;
 },signal);
}

/** Scheduling is independent of whether the inbox is currently polling delivery. */
export function startDevelopmentDigestScheduler(current:()=>boolean,signal:AbortSignal){
 if(!devSurfacesEnabled)return ()=>{};
 const selected=JSON.parse(localStorage.getItem('alpha.connection.selection.v1')||'null');if(selected?.kind!=='development')return ()=>{};
 const identity=developmentIdentity(selected.profile);let running=false;
 const tick=async()=>{if(running||signal.aborted||!current())return;running=true;try{await developmentDigestRequest(identity,'/api/workflow/hosted/tick',undefined,signal);}catch{}finally{running=false;}};
 const timer=setInterval(()=>void tick(),15000);void tick();return ()=>clearInterval(timer);
}
