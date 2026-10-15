import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
if(!process.execArgv.includes('tsx')){const child=spawnSync(process.execPath,['--import','tsx',process.argv[1]],{stdio:'inherit',timeout:60000});if(child.error)throw child.error;process.exit(child.status??1);}
const {createGmailAgentReadHost}=await import('../scripts/gmail-agent-read-host.ts');
const owner='11111111-1111-4111-8111-111111111111',org='22222222-2222-4222-8222-222222222222',grant='33333333-3333-4333-8333-333333333333';
const account={configured:true,connected:true,reason:'connected',connectionId:grant,grantedCapabilities:['google.gmail.triage']};
const message={externalId:'mail1',threadId:'thread1',subject:'A &amp; B',from:'Sender',to:[],snippet:'Hello',receivedAt:'2026-10-15T00:00:00Z',isUnread:true};
async function fixture(){
 const profile=await mkdtemp(join(tmpdir(),'alpha-gmail-reader-'));
 const credential={credentialReference:'browser-cloud-reference:44444444-4444-4444-8444-444444444444',credentialId:grant,userId:owner,organizationId:org,token:'synthetic-only'};
 const save=()=>writeFile(join(profile,'credentials.json'),JSON.stringify({production:credential}),{mode:0o600});await save();
 const calls=[];let accounts=()=>[account],afterRead=async()=>{},pages=()=>({messages:[message],syncedAt:message.receivedAt});
 const original=globalThis.fetch;globalThis.fetch=async(url)=>{
  const u=new URL(url);calls.push(u);
  if(u.pathname==='/api/v1/user')return Response.json({success:true,data:{id:owner,organization_id:org}});
  if(u.pathname.endsWith('/accounts'))return Response.json(accounts());
  if(u.pathname.endsWith('/search')){const data=pages(u);await afterRead();return Response.json(data);}
  if(u.pathname.endsWith('/read')){await afterRead();return Response.json({message,bodyText:'Exact synthetic body'});}
  throw Error('Unexpected route');
 };
 let reader;try{reader=createGmailAgentReadHost(profile);}finally{globalThis.fetch=original;}
 return {reader,calls,credential,save,setAccounts:fn=>accounts=fn,setAfterRead:fn=>afterRead=fn,setPages:fn=>pages=fn,close:()=>rm(profile,{recursive:true,force:true})};
}
test('owner-scoped Gmail IDs read exact bodies and cannot cross credential generations',async()=>{
 const f=await fixture();try{const rows=await f.reader.list({});assert.equal(rows[0].threadTopic,'A & B');assert.equal((await f.reader.message(rows[0].id)).bodyText,'Exact synthetic body');
 f.credential.credentialReference='browser-cloud-reference:55555555-5555-4555-8555-555555555555';await f.save();const before=f.calls.filter(u=>u.pathname.endsWith('/read')).length;
 await assert.rejects(f.reader.message(rows[0].id),/current owner/);assert.equal(f.calls.filter(u=>u.pathname.endsWith('/read')).length,before);
 }finally{await f.close();}
});
test('Gmail grant revocation during a read prevents content delivery',async()=>{
 const f=await fixture();try{f.setAfterRead(async()=>f.setAccounts(()=>[]));await assert.rejects(f.reader.list({}),/permission changed/);}finally{await f.close();}
});
test('multiple readable Gmail accounts refuse before any mailbox read',async()=>{
 const f=await fixture();try{f.setAccounts(()=>[account,{...account,connectionId:owner}]);await assert.rejects(f.reader.list({}),/More than one/);assert.equal(f.calls.some(u=>u.pathname.endsWith('/search')),false);}finally{await f.close();}
});
test('paged Gmail reads reject a mailbox revision change',async()=>{
 const f=await fixture();try{f.setPages(u=>({messages:[message],syncedAt:message.receivedAt,mailboxHistoryId:u.searchParams.has('pageToken')?'2':'1',nextPageToken:u.searchParams.has('pageToken')?null:'next'}));await assert.rejects(f.reader.list({limit:25}),/mailbox changed/);}finally{await f.close();}
});
