import test from 'node:test';
import assert from 'node:assert/strict';
import {agentTtsEnvironment as configure} from '../scripts/agent-tts.mjs';
test('TTS is opt-in, off is authoritative, required refuses absent configuration',()=>{
 assert.deepEqual(configure({}),{}); assert.deepEqual(configure({ALPHA_LOCAL_TTS:'off',ELIZA_PARADEE_MODEL_DIR:'/missing'}),{});
 assert.throws(()=>configure({ALPHA_LOCAL_TTS:'required'}),/absolute/);
 assert.throws(()=>configure({ALPHA_LOCAL_TTS:'invalid'}),/must be/);
 assert.throws(()=>configure({ELIZA_PARADEE_MODEL_DIR:'/missing',ELIZA_INFERENCE_LIBRARY:'/missing'}),/reviewed SHA-256/);
 assert.throws(()=>configure({ALPHA_TTS_MODEL_DIR:'/missing'}),/Retired speech configuration/);
});
