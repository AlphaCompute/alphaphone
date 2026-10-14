import test from 'node:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
// Exercise the actual bounded browser-to-native host bridge, including cancellation.
for(const [name,script] of [['ASR','test-agent-speech-bridge.mjs'],['Paradee TTS','test-agent-tts-bridge.mjs']]){
 test(`browser native ${name} preserves owner, audio and cancellation boundaries`,async()=>{
  await run(process.execPath,[`scripts/${script}`],{timeout:60000});
 });
}
