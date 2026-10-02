import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
// Development only. Synchronous atomic mutations serialize all browser tabs in
// the owning Vite process. Production uses the native journal and Keystore.
export function localAgentStorage(directory:string,input:any):unknown {
 mkdirSync(directory,{recursive:true,mode:0o700});chmodSync(directory,0o700);
 const {operation}=input;
 const scoped=typeof input.scope==='string'&&/^[a-f0-9]{64}$/.test(input.scope);
 const identified=typeof input.proposalId==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(input.proposalId);
 const draftOperation=operation==='draftRead'||operation==='draftCompareExchange';
 const slot=operation==='read'||operation==='write'||draftOperation?input.slot:`journal:${input.scope}`;
 if(typeof slot!=='string'||!(draftOperation?/^workflow-draft:v1:[a-f0-9]{64}$/:/^(device|journal):[a-f0-9]{64}$/).test(slot))throw Error('Invalid local storage scope');
 const file=join(directory,createHash('sha256').update(slot).digest('hex')+'.json');
 const saved=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):null;
 const write=(value:unknown)=>{const bytes=JSON.stringify(value);if(Buffer.byteLength(bytes)>2*1024*1024)throw Error('Local storage limit');const temporary=file+'.'+randomUUID();writeFileSync(temporary,bytes,{mode:0o600,flag:'wx'});renameSync(temporary,file);};
 if(draftOperation){
  const valid=(value:unknown)=>value===null||(typeof value==='string'&&Buffer.byteLength(value)<=100000);
  if(!valid(saved))throw Error('Invalid saved workflow draft');
  if(operation==='draftRead')return {value:saved};
  if(!valid(input.expectedValue)||!valid(input.value))throw Error('Invalid workflow draft');
  if(saved!==input.expectedValue)return {status:'conflict'};
  write(input.value);return {status:'saved'};
 }
 if(operation==='read')return {value:saved};
 if(operation==='write'){
  if(!slot.startsWith('device:')||!input.value||!/^[a-f0-9]{64}$/.test(input.value.key)||!/^[a-f0-9-]{36}$/.test(input.value.installationId))throw Error('Invalid device credential');
  if(saved&&(saved.key!==input.value.key||saved.installationId!==input.value.installationId))throw Error('Device identity changed');
  write(input.value);return {};
 }
 if(!scoped)throw Error('Invalid journal scope');
 const entries=saved||{};
 if(operation==='list')return {entries:Object.values(entries)};
 if(!identified)throw Error('Invalid journal proposal');
 const previous=Object.hasOwn(entries,input.proposalId)?entries[input.proposalId]:null;
 if(operation==='get')return {entry:previous};
 if(operation==='reserve'){
  if(previous){if(previous.operationId!==input.operationId||previous.operationHash!==input.operationHash)throw Error('Journal identity conflict');return {created:false,entry:previous};}
  if(!/^[a-f0-9]{64}$/.test(input.operationHash)||typeof input.operationId!=='string'||!input.record||typeof input.record!=='object')throw Error('Invalid journal reservation');
  const entry={scope:input.scope,proposalId:input.proposalId,operationId:input.operationId,operationHash:input.operationHash,record:input.record,phase:'reserved'};
  entries[input.proposalId]=entry;write(entries);return {created:true,entry};
 }
 if(!previous)throw Error('Journal reservation missing');
 if(operation==='markApplying'){
  if(previous.phase==='applying'&&previous.attemptId===input.attemptId)return {};
  if(previous.phase!=='reserved'||typeof input.attemptId!=='string'||!input.attemptId)throw Error('Invalid journal transition');
  entries[input.proposalId]={...previous,phase:'applying',attemptId:input.attemptId};write(entries);return {};
 }
 if(operation==='finish'){
  if(!['succeeded','failed','unknown','cancelled'].includes(input.status)||typeof input.summary!=='string')throw Error('Invalid journal result');
  if(previous.phase==='terminal'){if(previous.status!==input.status||previous.summary!==input.summary||JSON.stringify(previous.result)!==JSON.stringify(input.result))throw Error('Terminal result conflict');return {};}
  if(input.status==='succeeded'&&previous.phase!=='applying')throw Error('Action was not admitted');
  entries[input.proposalId]={...previous,phase:'terminal',status:input.status,summary:input.summary,...(input.result?{result:input.result}:{})};write(entries);return {};
 }
 throw Error('Unsupported local storage operation');
}
