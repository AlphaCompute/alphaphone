import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {agentAsrEnvironment} from '../scripts/agent-asr.mjs';
test('host ASR is optional unless requested and never accepts relative or missing configured assets',()=>{
 const home=mkdtempSync(join(tmpdir(),'alpha-asr-config-'));try{assert.deepEqual(agentAsrEnvironment({},home),{});assert.deepEqual(agentAsrEnvironment({ALPHA_LOCAL_ASR:'off',ALPHA_ASR_MODEL:'relative'},home),{});assert.throws(()=>agentAsrEnvironment({ALPHA_LOCAL_ASR:'yes'},home),/auto, off or required/);assert.throws(()=>agentAsrEnvironment({ALPHA_LOCAL_ASR:'required'},home),/missing/);assert.throws(()=>agentAsrEnvironment({ALPHA_ASR_MODEL:'relative'},home),/absolute/);assert.throws(()=>agentAsrEnvironment({ALPHA_ASR_MODEL:join(home,'missing')},home),/missing/);}finally{rmSync(home,{recursive:true,force:true});}
});
test('host ASR rejects an incompatible model before enabling its runtime provider',()=>{
 const home=mkdtempSync(join(tmpdir(),'alpha-asr-config-'));try{const binary=join(home,'whisper'),model=join(home,'model');writeFileSync(binary,'fixture',{mode:0o700});writeFileSync(model,'invalid');assert.throws(()=>agentAsrEnvironment({ALPHA_WHISPER_BIN:binary,ALPHA_ASR_MODEL:model}),/supported provider/);}finally{rmSync(home,{recursive:true,force:true});}
});
