import test from 'node:test';
import assert from 'node:assert/strict';
test('worker termination persistence admits only missing-result fixed process metadata',async()=>{
 const {workerTerminationFromError:project}=await import('../vendor/eliza/plugins/plugin-workflow/src/services/workflow-worker-termination.ts');
  const error={code:'SMTHRS_RESULT_MISSING',message:'PRIVATE_SENTINEL',context:{workerTermination:{exitCode:7,signal:'SIGTERM',output:'PRIVATE_SENTINEL'},secret:'PRIVATE_SENTINEL'}};
  assert.deepEqual(project(error),{exitCode:7,signal:'SIGTERM'});
  assert.equal(project({...error,code:'UNRELATED'}),undefined);
  for(const value of [null,{},new Error('PRIVATE_SENTINEL'),{code:'SMTHRS_RESULT_MISSING',context:{workerTermination:'PRIVATE_SENTINEL'}}])assert.equal(project(value),undefined);
  for(const exitCode of [-1,256,NaN,Infinity,'7',{},null])assert.deepEqual(project({...error,context:{workerTermination:{exitCode,signal:'PRIVATE_SENTINEL'}}}),{exitCode:null,signal:'unrecognized'});
  assert.deepEqual(project({...error,context:{workerTermination:{exitCode:0,signal:null}}}),{exitCode:0,signal:null});
});
