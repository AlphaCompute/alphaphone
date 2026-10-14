import test from 'node:test';
import assert from 'node:assert/strict';
import {agentAsrEnvironment as configure} from '../scripts/agent-asr.mjs';
test('ASR is opt-in, off is authoritative, required refuses absent configuration',()=>{
 assert.deepEqual(configure({}),{}); assert.deepEqual(configure({ALPHA_LOCAL_ASR:'off',ALPHA_ASR_MODEL_DIR:'/missing'}),{});
 assert.throws(()=>configure({ALPHA_LOCAL_ASR:'required'}),/absolute/);
 assert.throws(()=>configure({ALPHA_LOCAL_ASR:'invalid'}),/must be/);
 assert.throws(()=>configure({ALPHA_ASR_MODEL_DIR:'/missing',ELIZA_INFERENCE_LIBRARY:'/missing'}),/reviewed SHA-256/);
});
