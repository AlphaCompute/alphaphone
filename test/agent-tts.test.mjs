import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {agentTtsEnvironment} from '../scripts/agent-tts.mjs';
test('host TTS requires an explicit installed library and rejects ambiguous configuration',()=>{
 assert.deepEqual(agentTtsEnvironment({}),{});assert.deepEqual(agentTtsEnvironment({ALPHA_LOCAL_TTS:'off',ALPHA_TTS_LIBRARY:'relative'}),{});
 assert.throws(()=>agentTtsEnvironment({ALPHA_LOCAL_TTS:'required'}),/Configure/);assert.throws(()=>agentTtsEnvironment({ALPHA_LOCAL_TTS:'invalid'}),/auto, off or required/);assert.throws(()=>agentTtsEnvironment({ALPHA_TTS_LIBRARY:'relative'}),/absolute/);assert.throws(()=>agentTtsEnvironment({ALPHA_TTS_MODEL_DIR:'/tmp/unused'}),/Configure/);
});
test('host TTS rejects unverified voice assets before enabling the agent',()=>{
 const root=mkdtempSync(join(tmpdir(),'alpha-tts-config-'));try{const library=join(root,'native');writeFileSync(library,'fixture');mkdirSync(join(root,'voices'));writeFileSync(join(root,'kokoro-82m-v1_0.gguf'),'unverified');writeFileSync(join(root,'voices/af_bella.bin'),'unverified');assert.throws(()=>agentTtsEnvironment({ALPHA_TTS_LIBRARY:library,ALPHA_TTS_MODEL_DIR:root}),/checksum/);}finally{rmSync(root,{recursive:true,force:true});}
});
