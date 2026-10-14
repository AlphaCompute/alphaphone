import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {agentTtsEnvironment} from '../scripts/agent-tts.mjs';
test('native TTS requires explicit installed library and model paths',()=>{
 assert.deepEqual(agentTtsEnvironment({}),{});assert.deepEqual(agentTtsEnvironment({ALPHA_LOCAL_TTS:'off',ALPHA_TTS_LIBRARY:'relative'}),{});
 assert.throws(()=>agentTtsEnvironment({ALPHA_LOCAL_TTS:'required'}),/absolute/);assert.throws(()=>agentTtsEnvironment({ALPHA_LOCAL_TTS:'invalid'}),/auto, off or required/);assert.throws(()=>agentTtsEnvironment({ALPHA_TTS_LIBRARY:'relative'}),/absolute/);
});
test('native TTS rejects unverified assets before enabling the agent',()=>{
 const root=mkdtempSync(join(tmpdir(),'alpha-tts-config-'));try{const library=join(root,'native');writeFileSync(library,'fixture');writeFileSync(join(root,'paradee-8m-v1_0.gguf'),'unverified');assert.throws(()=>agentTtsEnvironment({ALPHA_INFERENCE_LIBRARY:library,ALPHA_TTS_MODEL_DIR:root}),/checksum/);}finally{rmSync(root,{recursive:true,force:true});}
});
test('Paradee model pins match the shared Android bundle',()=>{
 const pins=JSON.parse(readFileSync(new URL('../config/native-speech.json',import.meta.url))),upstream=JSON.parse(readFileSync(new URL('../vendor/eliza/packages/app/platforms/android/paradee-voice/inputs.json',import.meta.url)));
 for(const [index,key] of ['paradee','lexicon'].entries()){assert.equal(pins.tts[index].sha256,upstream[key].sha256);assert.equal(pins.tts[index].bytes,upstream[key].bytes);assert.equal('tts/paradee/'+pins.tts[index].path,upstream[key].path);}
});
