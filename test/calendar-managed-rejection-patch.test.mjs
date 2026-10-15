import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,readFileSync,realpathSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {createServer} from 'node:http';

// Apply the proposed upstream patch to one isolated source file. The pinned checkout is unchanged.
// Exercise the real managed transport and mutation port over bounded synthetic HTTP responses.
test('explicit Calendar rejection survives the private transport; uncertain replies stay blocked',async()=>{
 const upstream=resolve('vendor/eliza'),relative='plugins/plugin-calendar/src/mutations/managed.ts',original=join(upstream,relative);
 const before=readFileSync(original,'utf8'),temp=mkdtempSync(join(tmpdir(),'alpha-calendar-refusal-'));
 try{
  const entry=join(temp,relative);mkdirSync(dirname(entry),{recursive:true});copyFileSync(original,entry);
  execFileSync('git',['apply',resolve('patches/eliza/calendar-managed-rejection.patch')],{cwd:temp});
  const buildPort=contents=>build({stdin:{contents:`export {createManagedCalendarMutationPort} from ${JSON.stringify(entry)};export {CalendarMutationNotAcceptedError} from ${JSON.stringify(join(dirname(original),'types.ts'))};`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'upstream-patch-source',setup(b){
   b.onLoad({filter:/managed\.ts$/},args=>args.path===realpathSync(entry)?{contents,loader:'ts',resolveDir:dirname(original)}:undefined);
   b.onResolve({filter:/^@elizaos\/core$/},()=>({path:'core',namespace:'port'}));
   b.onResolve({filter:/^\.\/ledger\.js$/},()=>({path:'ledger',namespace:'port'}));
   b.onLoad({filter:/.*/,namespace:'port'},args=>({loader:'js',contents:args.path==='core'?'export class ElizaError extends Error{}':'export const calendarMutationApprovalSha256=()=>"hash";export const calendarMutationOperationKey=()=>"stable-key";'}));
  }}]});
  const [baselineBundle,bundle]=await Promise.all([buildPort(before),buildPort(readFileSync(entry,'utf8'))]);
  const baseline=await import('data:text/javascript;base64,'+Buffer.from(baselineBundle.outputFiles[0].text).toString('base64'));
  const {createManagedCalendarMutationPort,CalendarMutationNotAcceptedError}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const source='alpha-google:'+'a'.repeat(64),caps={grantId:source,calendarId:'calendar',accountId:'account',read:true,write:true,idempotentCreate:true,conditionalWrites:true,providerExactlyOnce:false};
  const approval={payload:{action:'schedule_event',side:'owner',grantId:source,calendarId:'calendar'}};
  const oldPort=baseline.createManagedCalendarMutationPort({ELIZA_MANAGED_CALENDAR_READ_BROKER:'http://127.0.0.1:12345/__alpha-owner-gmail',ELIZA_API_TOKEN:'b'.repeat(64)},async(_url,init)=>Response.json(JSON.parse(init.body).calendar.operation==='write-capabilities'?caps:{calendarFailure:{grantId:source,calendarId:'calendar',accountId:'account',code:'CALENDAR_SYNC_INVALID',outcome:'not_accepted'}}),'agent').port;
  const oldPreflight=await oldPort.preflight(approval);await assert.rejects(oldPort.execute(approval,oldPreflight),error=>!(error instanceof baseline.CalendarMutationNotAcceptedError),'before patch the explicit refusal loses its known outcome');
  for(const kind of ['not_accepted','precondition_failed','wrong-account','unknown','generic-http','timeout']){
   let mutations=0;
   const request=async(url,init)=>{
    assert.equal(String(url),'http://127.0.0.1:12345/__alpha-owner-gmail');assert.equal(init.headers.Authorization,'Bearer '+'b'.repeat(64));
    const {calendar}=JSON.parse(init.body);if(calendar.operation==='write-capabilities')return Response.json(caps);
    assert.equal(calendar.operation,'write-execute');mutations++;
    if(kind==='timeout')throw new TypeError('Network timeout');if(kind==='generic-http')return Response.json({error:'unverified'},{status:409});
    return Response.json({calendarFailure:{grantId:source,calendarId:'calendar',accountId:kind==='wrong-account'?'another-account':'account',code:'CALENDAR_SYNC_INVALID',outcome:kind}});
   };
   const {port}=createManagedCalendarMutationPort({ELIZA_MANAGED_CALENDAR_READ_BROKER:'http://127.0.0.1:12345/__alpha-owner-gmail',ELIZA_API_TOKEN:'b'.repeat(64)},request,'agent');
   const preflight=await port.preflight(approval);
   await assert.rejects(port.execute(approval,preflight),error=>['not_accepted','precondition_failed'].includes(kind)?error instanceof CalendarMutationNotAcceptedError:!(error instanceof CalendarMutationNotAcceptedError));
   assert.equal(mutations,1,'no automatic replay');
  }
  // Use the actual authenticated loopback broker for the regression that lost the refusal.
  const host=resolve('scripts/calendar-agent-write-host.ts');
  const brokerBundle=await build({entryPoints:['scripts/gmail-agent-dev-broker.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'synthetic-cloud-owner-port',setup(b){
   b.onResolve({filter:/^\.\/gmail-agent-read-host\.ts$/},()=>({path:'reader',namespace:'cloud-fixture'}));
   b.onLoad({filter:/.*/,namespace:'cloud-fixture'},()=>({loader:'js',resolveDir:process.cwd(),contents:`import {calendarAgentWrite} from ${JSON.stringify(host)};export const createGmailAgentReadHost=()=>({calendarWrite:(input,signal)=>calendarAgentWrite(globalThis.calendarRefusalFixture.client,'grant','a'.repeat(64),input,signal)});`}));
  }}]});
  const {createGmailAgentDevBroker}=await import('data:text/javascript;base64,'+Buffer.from(brokerBundle.outputFiles[0].text).toString('base64'));
  const tokenFile=join(temp,'token');writeFileSync(tokenFile,'b'.repeat(64),{mode:0o600});let writes=0;
  globalThis.calendarRefusalFixture={client:{googleCalendarSync:async input=>{if(input.kind==='capabilities')return caps;writes++;throw Object.assign(new Error('Synthetic authenticated Cloud rejection'),{name:'CloudProtocolError',code:'http',status:400,data:{code:'CALENDAR_SYNC_INVALID',outcome:'not_accepted'}});}}};
  const server=createServer(createGmailAgentDevBroker({profile:temp,tokenFile}));
  try{
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const endpoint=`http://127.0.0.1:${server.address().port}/__alpha-owner-gmail`;
   const {port}=createManagedCalendarMutationPort({ELIZA_MANAGED_CALENDAR_READ_BROKER:endpoint,ELIZA_API_TOKEN:'b'.repeat(64)},fetch,'agent');
   const preflight=await port.preflight(approval);await assert.rejects(port.execute(approval,preflight),error=>error instanceof CalendarMutationNotAcceptedError);assert.equal(writes,1);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));delete globalThis.calendarRefusalFixture;}
  assert.equal(readFileSync(original,'utf8'),before,'the pinned source is not edited by qualification');
 }finally{rmSync(temp,{recursive:true,force:true});}
});
