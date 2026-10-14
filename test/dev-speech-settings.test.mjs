import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {developmentSpeechEnvironment} from '../scripts/dev-speech-settings.mjs';
function profile(t,raw){const directory=mkdtempSync(join(tmpdir(),'alpha-dev-speech-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));if(raw!==undefined)writeFileSync(join(directory,'local-speech.json'),typeof raw==='string'?raw:JSON.stringify(raw),{mode:0o600});return directory;}
test('a profile without saved speech settings retains the supplied environment',t=>{
 const env={PATH:'/usr/bin',ELIZA_PARADEE_ENABLED:'0'};assert.deepEqual(developmentSpeechEnvironment(profile(t),env),env);
});
test('saved speech paths survive an ordinary restart without shell overrides',t=>{
 const saved={ELIZA_ASR_ENABLED:'1',ELIZA_PARADEE_ENABLED:'1',ELIZA_INFERENCE_LIBRARY_SHA256:'a'.repeat(64),ELIZA_ASR_MODEL_DIR:'/models/asr',ELIZA_INFERENCE_LIBRARY:'/tools/libinference.dylib',ELIZA_PARADEE_MODEL_DIR:'/models/paradee'};
 const directory=profile(t,saved);assert.deepEqual(developmentSpeechEnvironment(directory,{PATH:'/usr/bin'}),{...saved,PATH:'/usr/bin'});assert.deepEqual(developmentSpeechEnvironment(directory,{}),saved);
});
test('a saved file with the earlier Alpha-only keys is read as the upstream ELIZA_* names',t=>{
 const warn=console.warn,warnings=[];console.warn=message=>warnings.push(message);
 try{
  assert.deepEqual(developmentSpeechEnvironment(profile(t,{ALPHA_LOCAL_TTS:'required',ALPHA_TTS_MODEL_DIR:'/models/paradee',ALPHA_LOCAL_ASR:'off',ALPHA_ASR_MODEL_DIR:'/models/asr'}),{}),
   {ELIZA_PARADEE_ENABLED:'1',ELIZA_PARADEE_MODEL_DIR:'/models/paradee',ELIZA_ASR_ENABLED:'0',ELIZA_ASR_MODEL_DIR:'/models/asr'});
  // 'auto' becomes unset; the upstream key wins over a stale earlier one.
  assert.deepEqual(developmentSpeechEnvironment(profile(t,{ALPHA_LOCAL_TTS:'auto',ALPHA_TTS_MODEL_DIR:'/old',ELIZA_PARADEE_MODEL_DIR:'/new'}),{}),{ELIZA_PARADEE_MODEL_DIR:'/new'});
  assert.throws(()=>developmentSpeechEnvironment(profile(t,{ALPHA_TTS_MODEL_DIR:'relative'}),{}),/absolute asset paths/);
  for(const name of ['ALPHA_WHISPER_BIN','ALPHA_ASR_MODEL','ELIZA_KOKORO_MODEL_DIR'])assert.deepEqual(developmentSpeechEnvironment(profile(t,{[name]:'/x'}),{}),{},`${name} is ignored, never applied`);
 }finally{console.warn=warn;}
 assert.equal(warnings.filter(message=>/ALPHA_[A-Z_]+ is read as ELIZA_[A-Z_]+/.test(message)).length,7);
 assert.equal(warnings.filter(message=>/is retired and ignored/.test(message)).length,3);
});
test('explicit environment choices including voice off override saved defaults without mutation',t=>{
 const directory=profile(t,{ELIZA_PARADEE_ENABLED:'1',ELIZA_INFERENCE_LIBRARY:'/saved/library'}),env={ELIZA_PARADEE_ENABLED:'0',ELIZA_INFERENCE_LIBRARY:'/override/library'};
 assert.deepEqual(developmentSpeechEnvironment(directory,env),env);assert.equal(developmentSpeechEnvironment(directory,{}).ELIZA_PARADEE_ENABLED,'1');
});
for(const raw of ['{broken',null,[],{ELIZA_PARADEE_ENABLED:'silent'},{ALPHA_LOCAL_TTS:'silent'},{ELIZA_INFERENCE_LIBRARY:'relative/library'},{ELIZA_PARADEE_MODEL_DIR:'/path\0bad'},{CEREBRAS_API_KEY:'synthetic-do-not-echo'},{NODE_OPTIONS:'--inspect'}])test(`invalid saved speech settings fail closed: ${JSON.stringify(raw)}`,t=>{
 assert.throws(()=>developmentSpeechEnvironment(profile(t,raw),{}),error=>!error.message.includes('synthetic-do-not-echo'));
});
test('saved settings reject shared access and symlinks instead of reading an alternate file',t=>{
 const directory=profile(t,{ELIZA_PARADEE_ENABLED:'1'}),file=join(directory,'local-speech.json');chmodSync(file,0o644);assert.throws(()=>developmentSpeechEnvironment(directory,{}),/owner-only/);
 rmSync(file);const target=join(directory,'target.json');writeFileSync(target,'{}',{mode:0o600});symlinkSync(target,file);assert.throws(()=>developmentSpeechEnvironment(directory,{}));
});
test('oversized saved settings are rejected before parsing',t=>{
 assert.throws(()=>developmentSpeechEnvironment(profile(t,' '.repeat(16385)),{}),/too large/);
});
