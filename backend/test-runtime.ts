/** Real provider + real pinned runtime integration; never substitutes model replies. */
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
const phase=process.argv.find(arg=>arg.startsWith('--phase='))?.slice(8);
if(phase!==undefined){
 if(!['seed','recover','proposal'].includes(phase))throw Error('Unknown live acceptance phase');
 const {loadPinnedRuntime}=await import('./loader');
 const {module,head,dataDir}=await loadPinnedRuntime();
 await run({module,head,dataDir,mode:phase});
}else{
const dataDir=await mkdtemp(join(tmpdir(),'alpha-eliza-live-'));
const reports=[];
for(const mode of ['seed','recover','proposal']){
 const proc=Bun.spawn([process.execPath,import.meta.filename,'--phase='+mode],{env:{...process.env,ALPHA_ELIZA_DATA_DIR:dataDir},stdout:'ignore',stderr:'ignore'});
 const exit=await proc.exited;
 if(exit!==0)throw new Error('Real runtime '+mode+' failed; retained private fixture '+dataDir);
 reports.push(JSON.parse(await readFile(join(dataDir,'report-'+mode+'.json'),'utf8')));
}
const out=resolve(import.meta.dir,'../test-results');await mkdir(out,{recursive:true});
await writeFile(join(out,'eliza-runtime.json'),JSON.stringify({testedAt:new Date().toISOString(),kind:'real-provider-pinned-runtime',reports},null,2));
console.log(JSON.stringify({passed:true,report:'test-results/eliza-runtime.json'}));
}
async function run({head,mode,dataDir,module}:{head:string;mode:string;dataDir:string;module:any}) {
 const backend=await module.createRuntimeBackend({head,dataDir});
 try{
  console.log(JSON.stringify({stage:'initialized',...backend.info}));
  const proofPath=resolve(dataDir,'test-proof.json');
  const reports:any[]=[];
  if(mode==='seed'){
   const proof='ALPHA-'+randomUUID();await writeFile(proofPath,JSON.stringify({proof}),{mode:0o600});
   const first=await backend.chat('Remember this parcel reference for our conversation: '+proof+'. Reply with only the reference.',AbortSignal.timeout(90000));
   if(first.outcome.status!=='completed'||!first.text.includes(proof))throw new Error('First real runtime turn did not echo the reference');
   const second=await backend.chat('What parcel reference did I just ask you to remember? Reply with only the reference.',AbortSignal.timeout(90000));
   if(second.outcome.status!=='completed'||!second.text.includes(proof))throw new Error('Real runtime second turn did not recall conversation');
   reports.push({test:'two-turn-memory',passed:true,first,second});
  }else if(mode==='recover'){
   const {proof}=JSON.parse(await readFile(proofPath,'utf8'));
   const restored=await backend.chat('What is the parcel reference I asked you to remember earlier in this conversation? Reply with only the reference.',AbortSignal.timeout(90000));
   if(restored.outcome.status!=='completed'||!restored.text.includes(proof))throw new Error('Real runtime did not restore persisted conversation');
   reports.push({test:'new-process-history',passed:true,restored});
   const controller=new AbortController(),start=Date.now();const timer=setTimeout(()=>controller.abort(),150);
   let cancelled:any, cancellationError:unknown;
   try{cancelled=await backend.chat('Write a detailed three thousand word essay about how gardens grow. Do not stop early.',controller.signal);}
   catch(error){cancellationError=error;}finally{clearTimeout(timer);}
   if(!controller.signal.aborted||cancelled?.outcome.status==='completed'||Date.now()-start>15000)throw new Error('Cancellation did not stop the runtime turn');
   if(!cancelled&&!cancellationError)throw new Error('Missing cancellation result');
   reports.push({test:'active-cancellation',passed:true,outcome:cancelled?.outcome,elapsedMs:Date.now()-start});
  }else if(mode==='proposal'){
   const result=await backend.chat('Create a note titled Runtime acceptance with the exact body Pinned runtime prepared this note.',AbortSignal.timeout(90000),{view:'notes',revision:7});
   if(result.proposals.length!==1||result.proposals[0].operation.type!=='create_note'||result.proposals[0].operation.body!=='Pinned runtime prepared this note.'||result.proposals[0].contextRevision!==7)throw new Error('Actual runtime action proposal did not match');
   reports.push({test:'real-runtime-proposal',passed:true,result});
   const navigation=await backend.chat('Open the calendar view in Alpha Phone.',AbortSignal.timeout(90000),{view:'notes',revision:8});
   if(navigation.proposals.length!==1||navigation.proposals[0].operation.type!=='open_view'||navigation.proposals[0].operation.view!=='calendar'||navigation.proposals[0].contextRevision!==8)throw new Error('Runtime navigation proposal mismatch');
   reports.push({test:'real-runtime-navigation-proposal',passed:true,result:navigation});
   const at=Math.ceil((Date.now()+3600000)/60000)*60000,local=new Date(at).toISOString().slice(0,16);
   const reminder=await backend.chat('Prepare a one-time reminder with exact title Runtime reminder acceptance, exact body Check the native receipt, at local time '+local+' in time zone UTC. Use CREATE_REMINDER and do not execute it.',AbortSignal.timeout(90000),{view:'calendar',revision:9});
   if(reminder.proposals.length!==1||reminder.proposals[0].operation.type!=='create_reminder'||reminder.proposals[0].operation.at!==at||reminder.proposals[0].operation.title!=='Runtime reminder acceptance'||reminder.proposals[0].operation.body!=='Check the native receipt'||reminder.proposals[0].contextRevision!==9)throw new Error('Runtime reminder proposal mismatch');
   reports.push({test:'real-runtime-reminder-proposal-only',passed:true,result:reminder,nativeSchedulingTested:false});
  }
  await writeFile(resolve(dataDir,'report-'+mode+'.json'),JSON.stringify({testedAt:new Date().toISOString(),...backend.info,reports},null,2),{mode:0o600});
  console.log(JSON.stringify({stage:'verified',mode,tests:reports.map(r=>r.test)}));
 }finally{await backend.close();}
}
