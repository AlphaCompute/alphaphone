import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {build} from 'esbuild';

// Actual protocol/adapter over closed ports. No native/provider/personal data reads.
const bundle=await build({entryPoints:['apps/app/src/runtime/automations-protocol.ts'],bundle:true,write:false,format:'esm',platform:'neutral',logLevel:'silent'});
const protocol=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const transformed=file=>stripTypeScriptTypes(fs.readFileSync(file,'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,''),{mode:'transform'});
const fixtureSource=fs.readFileSync('test/automations-unified.test.mjs','utf8');
const makeFixture=vm.runInNewContext('('+fixtureSource.slice(fixtureSource.indexOf('function adapterFixture('),fixtureSource.indexOf('const wait=async fn=>'))+')',{protocol,transformed,fs,vm,stripTypeScriptTypes,queueMicrotask,AbortController,Date,crypto,Event,console});
const wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,5));}throw Error('Capability fixture did not settle.');};
function setup(status,automationStatus=0){
 const calls=[],storage={};let reminderStatus=status;
 const request=async(path,method,body)=>{calls.push({path,method,body});if(method!=='GET')return {definition:{id:'created'}};if(path==='/api/automations'){if(automationStatus)throw Object.assign(Error('Synthetic automation response'),{status:automationStatus});return {automations:[]};}if(path.includes('scheduled-tasks'))return {tasks:[{taskId:'schedule',kind:'recap',ownerVisible:true,trigger:{kind:'manual'},state:{status:'scheduled'},metadata:{recordKey:'weekly-review'}}]};if(reminderStatus)throw Object.assign(Error('Synthetic source response'),{status:reminderStatus});return {reminders:[]};};
 const app=makeFixture(request,storage);return {app,calls,storage,status:value=>{reminderStatus=value;},ready:async()=>{app.render();await wait(()=>!app.render().automation.loading&&app.render().cards.length===2);}};
}
for(const status of [404,501])test(`known HTTP ${status} reminder absence cannot open an editor, write or lock the journal`,async()=>{
 const f=setup(status);try{await f.ready();const before=JSON.stringify(f.app.home().homeWorkflowRows);assert.equal(f.app.home().homeWorkflowTime,'View automations');f.app.render().newFlow();const stale=f.app.render().automation;assert.equal(stale.agentReminderUnavailable,true);assert.match(stale.agentReminderDescription,/not available/);assert.equal(stale.agentUnavailable,false);stale.createReminder();f.app.render().automation.save();await new Promise(resolve=>setTimeout(resolve,10));assert.equal(f.app.render().automation.editing,false);assert.equal(f.calls.filter(call=>call.method!=='GET').length,0);assert.deepEqual(Object.keys(f.storage),[]);assert.equal(JSON.stringify(f.app.home().homeWorkflowRows),before);assert.equal(f.app.render().cards.length,2);f.app.render().automation.createDeviceReminder();assert.equal(f.app.deviceOpened,'new-draft');}finally{f.app.close();}
});
for(const status of [403,503])test(`HTTP ${status} keeps its real source error and requires a successful refresh before reminder creation`,async()=>{
 const f=setup(status);try{await f.ready();const issue=f.app.render().automation.issues.find(issue=>issue.source==='reminders');assert.equal(issue.unavailable,false);assert.match(issue.message,status===403?/owner/:/could not refresh/);assert.equal(f.app.home().homeWorkflowTime,'Some items unavailable');f.app.render().newFlow();assert.equal(f.app.render().automation.agentReminderUnavailable,true);f.app.render().automation.createReminder();assert.equal(f.app.render().automation.editing,false);f.status(0);f.app.render().automation.refresh();await wait(()=>!f.app.render().automation.busy);assert.equal(f.app.render().automation.agentReminderUnavailable,false);f.app.render().automation.createReminder();assert.equal(f.app.render().automation.editing,true);}finally{f.app.close();}
});
test('successful reminder source permits explicit existing definition creation and clears its journal',async()=>{
 const f=setup(0);try{await f.ready();f.app.render().newFlow();f.app.render().automation.createReminder();f.app.render().automation.fields.find(field=>field.name==='message').change({target:{value:'Synthetic one-time review'}});f.app.render().automation.save();await wait(()=>f.calls.some(call=>call.method==='POST')&&!f.app.render().automation.busy);const write=f.calls.find(call=>call.method==='POST');assert.equal(write.path,'/api/lifeops/definitions');assert.equal(write.body.metadata.nativeProjection,'in_app_only');assert.equal(write.body.cadence.kind,'once');assert.deepEqual(Object.keys(f.storage),[]);}finally{f.app.close();}
});
test('an editor callback captured before a failed capability refresh cannot admit a later write',async()=>{
 const f=setup(0);try{await f.ready();f.app.render().newFlow();f.app.render().automation.createReminder();const save=f.app.render().automation.save;f.app.render().automation.fields.find(field=>field.name==='message').change({target:{value:'Synthetic old editor'}});f.status(501);f.app.render().automation.refresh();await wait(()=>!f.app.render().automation.busy);save();await new Promise(resolve=>setTimeout(resolve,10));assert.equal(f.calls.filter(call=>call.method!=='GET').length,0);assert.deepEqual(Object.keys(f.storage),[]);}finally{f.app.close();}
});
test('the same known missing automation source blocks new prompt and workflow without affecting phone or schedules',async()=>{
 const f=setup(0,404);try{await f.ready();f.app.render().newFlow();const choices=f.app.render().automation;assert.equal(choices.agentUnavailable,true);assert.match(choices.workflowDescription,/not available/);choices.createWorkflow();choices.createPrompt();assert.equal(f.app.newWorkflow,0);assert.equal(f.app.render().automation.editing,false);assert.equal(f.calls.filter(call=>call.method!=='GET').length,0);assert.deepEqual(Object.keys(f.storage),[]);assert.equal(f.app.render().cards.length,2);assert.equal(f.app.home().homeWorkflowTime,'View automations');assert.equal(choices.agentReminderUnavailable,false);}finally{f.app.close();}
});
