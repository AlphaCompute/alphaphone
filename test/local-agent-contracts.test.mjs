import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
test('local agent contracts (synthetic HTTP and durable development journal)',()=>{
 execFileSync(process.execPath,['--import','tsx','scripts/test-local-agent.mjs'],{cwd:new URL('..',import.meta.url),timeout:60000,stdio:'pipe'});
});
test('local agent streaming and cancellation contracts',()=>{
 execFileSync(process.execPath,['--import','tsx','scripts/test-local-agent-stream.mjs'],{cwd:new URL('..',import.meta.url),timeout:60000,stdio:'pipe'});
});

test('local browser digest persistence and recovery',()=>{
 execFileSync(process.execPath,['--import','tsx','scripts/test-local-digest-storage.mjs'],{cwd:new URL('..',import.meta.url),timeout:60000,stdio:'pipe'});
});

test('digest cancellation preserves replay recovery',()=>{
 execFileSync(process.execPath,['--import','tsx','scripts/test-digest-cancellation.mjs'],{cwd:new URL('..',import.meta.url),timeout:60000,stdio:'pipe'});
});

test('local agent speech bridge owns credentials, binary bounds and cancellation',()=>{
 execFileSync(process.execPath,['--import','tsx','scripts/test-agent-speech-bridge.mjs'],{cwd:new URL('..',import.meta.url),timeout:30000,stdio:'pipe'});
});
