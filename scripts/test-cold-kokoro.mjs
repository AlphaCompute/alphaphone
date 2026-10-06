#!/usr/bin/env bun
/** Real fresh-process Kokoro qualification, with installed assets and no user text. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {developmentSpeechEnvironment} from './dev-speech-settings.mjs';
import {agentTtsEnvironment} from './agent-tts.mjs';
import {sourceDirectory,verifySource} from './local-agent-source.mjs';
assert.ok(process.versions.bun,'Run with Bun so speech workers use the supported host');
const root=resolve(import.meta.dirname,'..');
const source=process.env.ALPHA_ELIZA_SOURCE||sourceDirectory(root);
const lock=JSON.parse(readFileSync(join(root,'upstream.lock.json'),'utf8'));
verifySource(source,lock.commit);
const profile=process.env.ALPHA_REMOTE_PROFILE||join(homedir(),'.local/share/alphaphone/browser-agent');
const speech=agentTtsEnvironment(developmentSpeechEnvironment(profile));
assert.equal(speech.ELIZA_KOKORO_ENABLED,'1','Configure installed local speech assets first');
Object.assign(process.env,speech);
const {StandaloneKokoroService}=await import(pathToFileURL(join(source,'packages/app/src/api/standalone-kokoro-service.ts')));
const trials=[];
const report={revision:lock.commit,scope:'Fresh host workers; not disk-cache eviction, browser playback or Android acceptance',trials,passed:false};
try{
 for(let trial=0;trial<3;trial++){
  const service=new StandaloneKokoroService(),started=performance.now();
  try{
   // No initialize/status probe: the first request must own cold startup.
   assert.equal(service.initialized,false);
   const audio=await service.synthesize(crypto.randomUUID(),'Local speech is ready.',AbortSignal.timeout(45000));
   assert.equal(audio.toString('ascii',0,4),'RIFF');assert.equal(audio.toString('ascii',8,12),'WAVE');
   assert.equal(audio.readUInt32LE(4)+8,audio.length);assert.ok(audio.length>4800);
   assert.equal(service.initialized,true);
   trials.push({trial,elapsedMs:Math.round(performance.now()-started),bytes:audio.length});
  }finally{service.stop();assert.equal(service.initialized,false);}
 }
 const service=new StandaloneKokoroService();
 try{
  const controller=new AbortController();
  const pending=service.synthesize(crypto.randomUUID(),'Cancelled startup.',controller.signal);
  const rejected=assert.rejects(pending,/stopped|abort|cancel/i);
  controller.abort();await rejected;assert.equal(service.initialized,false);
  const audio=await service.synthesize(crypto.randomUUID(),'Speech recovers after cancellation.',AbortSignal.timeout(45000));
  assert.ok(audio.length>4800);assert.equal(service.initialized,true);
  report.cancelledColdStartRecovered=true;
 }finally{service.stop();}
 report.passed=true;
}finally{
 mkdirSync(join(root,'test-results/cold-kokoro'),{recursive:true});
 writeFileSync(join(root,'test-results/cold-kokoro/result.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}
