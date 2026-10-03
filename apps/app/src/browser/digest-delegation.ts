import {revision} from './store';
export type DevelopmentGrant={id:string;revision:string;kinds:string[];expiresAt:string;revoked:boolean};
type Request={mutationId:string;state:string;kinds:string[];expiresAt:string;status:'waiting'|'complete'|'failed';grantId?:string};
export type DevelopmentDelegation={requests:Request[];grants:DevelopmentGrant[]};
const kinds=(value:unknown):string[]=>{if(!Array.isArray(value)||!value.length||value.length>2||new Set(value).size!==value.length||value.some(v=>!['email','calendar'].includes(v)))throw Error('Choose a read scope.');return [...value].sort();};
export function grantAccount(grant:DevelopmentGrant){return {accountId:'cloud:'+grant.id,accountRevision:grant.revision,label:'Browser Cloud read grant',kinds:grant.kinds,expiresAt:grant.expiresAt};}
/** Local grant state is committed in the same document as dependent sources and runs. */
export function developmentDelegationRequest(data:DevelopmentDelegation,path:string,body:any,now:number){
 if(path==='revocations')return {grants:[]};
 if(path==='start'){
  if(body?.confirmed!==true||typeof body.mutationId!=='string'||!/^[a-f0-9-]{36}$/.test(body.mutationId))throw Error('Review Cloud read access.');const selected=kinds(body.kinds),prior=data.requests.find(r=>r.mutationId===body.mutationId);if(prior){if(JSON.stringify(prior.kinds)!==JSON.stringify(selected))throw Error('Authorization request changed.');return prior;}
  if(data.requests.length>=100)throw Error('Authorization history is full.');const request:Request={mutationId:body.mutationId,state:revision(),kinds:selected,expiresAt:new Date(now+600000).toISOString(),status:'waiting'};data.requests.push(request);return request;
 }
 if(path==='revoke'){
  if(body?.confirmed!==true)throw Error('Review revocation.');const grant=data.grants.find(g=>g.id===body.grantId);if(!grant)throw Error('Grant not found.');grant.revoked=true;return {remoteRevocation:'confirmed'};
 }
 const request=data.requests.find(r=>r.state===body?.state);if(!request)throw Error('Authorization not found.');if(request.status==='waiting'&&Date.parse(request.expiresAt)<=now)request.status='failed';
 if(path==='status')return request;
 if(path==='cancel'){if(body.confirmed!==true)throw Error('Confirm cancellation.');if(request.status==='waiting')request.status='failed';return request;}
 if(path==='complete'){
  if(body.confirmed!==true)throw Error('Approve the requested read access.');if(request.status==='complete')return request;if(request.status!=='waiting')throw Error('Authorization expired or was cancelled.');if(data.grants.length>=100)throw Error('Grant history is full.');
  const grant:DevelopmentGrant={id:crypto.randomUUID(),revision:revision(),kinds:request.kinds,expiresAt:new Date(now+7*86400000).toISOString(),revoked:false};data.grants.push(grant);request.status='complete';request.grantId=grant.id;return request;
 }
 throw Error('Unknown authorization operation.');
}
