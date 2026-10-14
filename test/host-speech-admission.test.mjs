import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,symlinkSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {verifiedFile,speechAssets} from '../scripts/host-speech-admission.mjs';
test('admission verifies exact bytes and reviewed digest, rejecting links and oversized assets',t=>{
 const root=mkdtempSync(join(tmpdir(),'alpha-speech-admission-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const file=join(root,'fixture'),data=Buffer.from('synthetic admission fixture'),sha=createHash('sha256').update(data).digest('hex');writeFileSync(file,data);
 verifiedFile(file,sha,data.length,true);
 assert.throws(()=>verifiedFile(file,'0'.repeat(64),data.length),/checksum/);
 assert.throws(()=>verifiedFile(file,sha,data.length-1),/size/);
 assert.throws(()=>verifiedFile(file,sha,data.length+1,true),/size/);
 symlinkSync(file,join(root,'link'));assert.throws(()=>verifiedFile(join(root,'link'),sha,data.length));
});
test('host asset manifest matches the current shared worker pins, including optional G2P and required VAD',()=>{
 const source=file=>readFileSync(new URL('../vendor/eliza/plugins/plugin-local-inference/src/'+file,import.meta.url),'utf8');
 const parse=text=>[...text.matchAll(/path: "([^"]+)",\s+sha256: "([^"]+)",\s+bytes: ([\d_]+)/g)].map(([,path,sha256,bytes])=>({path,sha256,bytes:Number(bytes.replaceAll('_',''))}));
 const tts=source('host-tts-worker.ts'),asr=source('host-asr-worker.ts');
 assert.deepEqual(speechAssets.tts,parse(tts.split('PARADEE_ASSETS:')[1].split('];')[0]));
 assert.deepEqual(speechAssets.espeak,parse(tts.split('ESPEAK_DATA_ASSETS:')[1].split('];')[0]));
 assert.deepEqual(speechAssets.asr,[...parse(asr.split('ASR_ASSETS:')[1].split('];')[0]),...parse(asr.split('const VAD_ASSET')[1].split('};')[0])]);
});
test('historical proof entrypoints refuse before credentials, network or native assets',()=>{
 for(const name of ['test-cold-kokoro','test-paired-whisper','test-combined-voice-roundtrip','test-agent-asr','test-agent-tts']){
  assert.throws(()=>execFileSync(process.execPath,['--import','tsx','scripts/'+name+'.mjs'],{env:{PATH:process.env.PATH},stdio:'pipe'}),error=>error.stderr.toString().includes('Historical Kokoro/Whisper campaign is retired'));
 }
});
