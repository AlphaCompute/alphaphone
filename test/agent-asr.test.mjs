import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync,statSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {agentAsrEnvironment,warmAgentAsr} from '../scripts/agent-asr.mjs';
test('host ASR is optional unless requested and never accepts relative or missing configured assets',()=>{
 const home=mkdtempSync(join(tmpdir(),'alpha-asr-config-'));try{assert.deepEqual(agentAsrEnvironment({},home),{});assert.deepEqual(agentAsrEnvironment({ALPHA_LOCAL_ASR:'off',ALPHA_ASR_MODEL:'relative'},home),{});assert.throws(()=>agentAsrEnvironment({ALPHA_LOCAL_ASR:'yes'},home),/auto, off or required/);assert.throws(()=>agentAsrEnvironment({ALPHA_LOCAL_ASR:'required'},home),/missing/);assert.throws(()=>agentAsrEnvironment({ALPHA_ASR_MODEL:'relative'},home),/absolute/);assert.throws(()=>agentAsrEnvironment({ALPHA_ASR_MODEL:join(home,'missing')},home),/missing/);}finally{rmSync(home,{recursive:true,force:true});}
});
test('host ASR rejects an incompatible model before enabling its runtime provider',()=>{
 const home=mkdtempSync(join(tmpdir(),'alpha-asr-config-'));try{const binary=join(home,'whisper'),model=join(home,'model');writeFileSync(binary,'fixture',{mode:0o700});writeFileSync(model,'invalid');assert.throws(()=>agentAsrEnvironment({ALPHA_WHISPER_BIN:binary,ALPHA_ASR_MODEL:model}),/supported provider/);}finally{rmSync(home,{recursive:true,force:true});}
});
test('automatic ASR warm-up uses private synthetic silence and removes it after success',async()=>{
 let directory;const controller=new AbortController();
 const result=await warmAgentAsr({ELIZA_WHISPER_ENABLED:'1',ELIZA_WHISPER_BACKEND:'auto',ELIZA_WHISPER_BINARY:'/reviewed/whisper',ELIZA_WHISPER_MODEL:'/reviewed/model'}, {signal:controller.signal,run:async(binary,args,options)=>{
  directory=options.cwd;assert.equal(binary,'/reviewed/whisper');assert.equal(args.includes('-ng'),false);
  const input=args[args.indexOf('-f')+1],wav=readFileSync(input);
  assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(24),16000);assert.equal(wav.length,32044);assert.ok(wav.subarray(44).every(value=>value===0));
  assert.equal(statSync(directory).mode&0o777,0o700);assert.equal(statSync(input).mode&0o777,0o600);
  assert.deepEqual(Object.keys(options.env).sort(),['LANG','PATH']);assert.equal(options.signal,controller.signal);assert.equal(options.killSignal,'SIGKILL');
 }});
 assert.equal(result.warmed,true);assert.equal(existsSync(directory),false);
});
test('ASR warm-up cleans failed work and does not silently substitute a CPU backend',async()=>{
 let directory;await assert.rejects(warmAgentAsr({ELIZA_WHISPER_ENABLED:'1',ELIZA_WHISPER_BACKEND:'auto'},{run:async(_binary,_args,options)=>{directory=options.cwd;throw Error('backend failure');}}),/warm-up failed/);assert.equal(existsSync(directory),false);
 let ran=false;assert.deepEqual(await warmAgentAsr({ELIZA_WHISPER_ENABLED:'1',ELIZA_WHISPER_BACKEND:'cpu'},{run:async()=>{ran=true;}}),{warmed:false});assert.equal(ran,false);
 const controller=new AbortController();controller.abort();await assert.rejects(warmAgentAsr({ELIZA_WHISPER_ENABLED:'1',ELIZA_WHISPER_BACKEND:'auto'},{signal:controller.signal,run:async()=>{ran=true;}}),{name:'AbortError'});assert.equal(ran,false);
});
