import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {developmentSpeechEnvironment} from '../scripts/dev-speech-settings.mjs';
function profile(t,raw){const directory=mkdtempSync(join(tmpdir(),'alpha-dev-speech-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));if(raw!==undefined)writeFileSync(join(directory,'local-speech.json'),typeof raw==='string'?raw:JSON.stringify(raw),{mode:0o600});return directory;}
test('a profile without saved speech settings retains the supplied environment',t=>{
 const env={PATH:'/usr/bin',ALPHA_LOCAL_TTS:'off'};assert.deepEqual(developmentSpeechEnvironment(profile(t),env),env);
});
test('saved speech paths survive an ordinary restart without shell overrides',t=>{
 const saved={ALPHA_LOCAL_ASR:'required',ALPHA_LOCAL_TTS:'required',ALPHA_WHISPER_BACKEND:'auto',ALPHA_WHISPER_BIN:'/tools/whisper',ALPHA_ASR_MODEL:'/models/asr.bin',ALPHA_TTS_LIBRARY:'/tools/libinference.dylib',ALPHA_TTS_MODEL_DIR:'/models/kokoro'};
 const directory=profile(t,saved);assert.deepEqual(developmentSpeechEnvironment(directory,{PATH:'/usr/bin'}),{...saved,PATH:'/usr/bin'});assert.deepEqual(developmentSpeechEnvironment(directory,{}),saved);
});
test('explicit environment choices including voice off override saved defaults without mutation',t=>{
 const directory=profile(t,{ALPHA_LOCAL_TTS:'required',ALPHA_TTS_LIBRARY:'/saved/library'}),env={ALPHA_LOCAL_TTS:'off',ALPHA_TTS_LIBRARY:'/override/library'};
 assert.deepEqual(developmentSpeechEnvironment(directory,env),env);assert.equal(developmentSpeechEnvironment(directory,{}).ALPHA_LOCAL_TTS,'required');
});
for(const raw of ['{broken',null,[],{ALPHA_LOCAL_TTS:'silent'},{ALPHA_TTS_LIBRARY:'relative/library'},{ALPHA_TTS_MODEL_DIR:'/path\0bad'},{CEREBRAS_API_KEY:'synthetic-do-not-echo'},{NODE_OPTIONS:'--inspect'}])test(`invalid saved speech settings fail closed: ${JSON.stringify(raw)}`,t=>{
 assert.throws(()=>developmentSpeechEnvironment(profile(t,raw),{}),error=>!error.message.includes('synthetic-do-not-echo'));
});
test('saved settings reject shared access and symlinks instead of reading an alternate file',t=>{
 const directory=profile(t,{ALPHA_LOCAL_TTS:'required'}),file=join(directory,'local-speech.json');chmodSync(file,0o644);assert.throws(()=>developmentSpeechEnvironment(directory,{}),/owner-only/);
 rmSync(file);const target=join(directory,'target.json');writeFileSync(target,'{}',{mode:0o600});symlinkSync(target,file);assert.throws(()=>developmentSpeechEnvironment(directory,{}));
});
test('oversized saved settings are rejected before parsing',t=>{
 assert.throws(()=>developmentSpeechEnvironment(profile(t,' '.repeat(16385)),{}),/too large/);
});
