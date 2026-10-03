import {test,expect} from '@playwright/test';
test('development digest storage preserves pending recovery, rejects conflicts and retires with its connection',async({page})=>{
 await page.goto('/?mode=dev');
 const result=await page.evaluate(async()=>{
  const {browserDigestStore}=await import('/src/browser/digest-storage.ts');
  const {developmentIdentity}=await import('/src/browser/development-identity.ts');
  const {actionScope}=await import('/src/runtime/device-actions.ts');
  localStorage.setItem('alpha.connection.selection.v1',JSON.stringify({kind:'development',profile:'local'}));
  const owner=developmentIdentity('local'),session={origin:location.origin,ownerId:owner.ownerId,agentId:owner.agentId,sessionId:'test'},slot='hosted-digests:v1:'+await actionScope(JSON.stringify([session.origin,session.ownerId,session.agentId]));
  let current=true;const a=await browserDigestStore(session as any,()=>current),b=await browserDigestStore(session as any,()=>current);
  await a.read(slot);await b.read(slot);await a.write(slot,{ids:['original']});let conflict=false,pending=false,scope=false,retired=false;
  try{await b.write(slot,{ids:['stale']});}catch{conflict=true;}
  await a.write(slot+':pending',{id:'reviewed'});try{await a.write(slot+':pending',{id:'replacement'});}catch{pending=true;}
  try{await a.write(slot+'-other',{ids:[]});}catch{scope=true;}
  const fresh=await browserDigestStore(session as any,()=>current),saved=await fresh.read(slot),recovery=await fresh.read(slot+':pending');
  current=false;try{await a.remove(slot);}catch{retired=true;}
  return {conflict,pending,scope,retired,saved,recovery};
 });
 expect(result).toEqual({conflict:true,pending:true,scope:true,retired:true,saved:{ids:['original']},recovery:{id:'reviewed'}});
});
