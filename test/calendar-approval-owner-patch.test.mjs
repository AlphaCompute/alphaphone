import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,readFileSync,realpathSync,rmSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
test('the proposed API patch projects the runtime canonical owner rather than a session principal',async()=>{
 const relative='packages/agent/src/api/approval-routes.ts',source=resolve('vendor/eliza',relative),before=readFileSync(source,'utf8'),temp=mkdtempSync(join(tmpdir(),'alpha-approval-owner-'));
 try{const entry=join(temp,relative);mkdirSync(dirname(entry),{recursive:true});copyFileSync(source,entry);execFileSync('git',['apply',resolve('patches/eliza/calendar-approval-owner-projection.patch')],{cwd:temp});
 const bundle=await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'owning-route-contract',setup(b){b.onLoad({filter:/approval-routes\.ts$/},args=>args.path===realpathSync(entry)?{contents:readFileSync(entry,'utf8'),loader:'ts',resolveDir:dirname(source)}:undefined);b.onResolve({filter:/^@elizaos\/(core|plugin-assistant)$/},args=>({path:args.path,namespace:'ports'}));b.onLoad({filter:/.*/,namespace:'ports'},args=>({loader:'js',contents:args.path.endsWith('/core')?'export const PENDING_USER_ACTION_WEIGHT={};export const ServiceType={APPROVAL:"approval"};export const resolveOwnerEntityIdOrDefault=runtime=>runtime.getSetting("canonical-owner");':'export const APPROVAL_EXECUTION_CAPABILITY="approval";export const APPROVAL_EXECUTION_PROTOCOL_VERSION=1;export const APPROVAL_SERVICE="approval";export const PENDING_PROMPTS_SERVICE="prompts";'}));}}]});
 const {handleApprovalRoute}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));let result;
 const owner='11111111-2222-4333-8444-555555555555';await handleApprovalRoute({url:'/api/approvals?state=all&limit=500'}, {}, '/api/approvals','GET',{runtime:{agentId:'agent',getService:()=>null,getSetting:key=>{assert.equal(key,'canonical-owner');return owner;}}},{json:(_res,value)=>result=value,error:()=>assert.fail('unexpected route error')});assert.equal(result.ownerEntityId,owner);assert.deepEqual(result.approvals,[]);assert.equal(readFileSync(source,'utf8'),before);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
