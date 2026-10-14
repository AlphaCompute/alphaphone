import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {agentAsrEnvironment,warmAgentAsr} from '../scripts/agent-asr.mjs';
import {PHONON_ASR_ASSETS,QWEN3_ASR_ASSETS} from '../vendor/eliza/plugins/plugin-local-inference/src/host-asr-assets.ts';
test('host ASR requires explicit native configuration and rejects retired providers',()=>{
 assert.deepEqual(agentAsrEnvironment({}),{});
 assert.deepEqual(agentAsrEnvironment({ALPHA_LOCAL_ASR:'off',ALPHA_ASR_MODEL:'old'}),{});
 assert.throws(()=>agentAsrEnvironment({ALPHA_LOCAL_ASR:'yes'}),/auto, off or required/);
 assert.throws(()=>agentAsrEnvironment({ALPHA_LOCAL_ASR:'required'}),/absolute/);
 assert.throws(()=>agentAsrEnvironment({ALPHA_WHISPER_BIN:'/old/whisper'}),/fused native ASR/);
 assert.throws(()=>agentAsrEnvironment({ALPHA_INFERENCE_LIBRARY:'relative',ALPHA_ASR_MODEL_DIR:'/models'}),/absolute/);
});
test('host ASR rejects unverified or ambiguous model inputs before enabling the provider',()=>{
 const root=mkdtempSync(join(tmpdir(),'alpha-asr-config-'));try{
  const library=join(root,'native');writeFileSync(library,'fixture');mkdirSync(join(root,'asr'));
  const env={ALPHA_INFERENCE_LIBRARY:library,ALPHA_ASR_MODEL_DIR:root};
  assert.throws(()=>agentAsrEnvironment(env),/Ambiguous/);
  for(const name of ['eliza-1-asr.gguf','eliza-1-asr-mmproj.gguf'])writeFileSync(join(root,'asr',name),'invalid');
  assert.throws(()=>agentAsrEnvironment(env),/checksum/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('native ASR pins match the shared loader exactly',()=>{
 const pins=JSON.parse(readFileSync(new URL('../config/native-speech.json',import.meta.url)));
 assert.deepEqual(pins.asr.parakeet,PHONON_ASR_ASSETS);assert.deepEqual(pins.asr.qwen3,QWEN3_ASR_ASSETS);
});
test('native warm-up stays host-owned and respects cancellation',async()=>{
 let ran=false;assert.deepEqual(await warmAgentAsr({ELIZA_ASR_ENABLED:'1'},{run:async()=>{ran=true;}}),{warmed:false});assert.equal(ran,false);
 const controller=new AbortController();controller.abort();await assert.rejects(warmAgentAsr({}, {signal:controller.signal}),{name:'AbortError'});
});
