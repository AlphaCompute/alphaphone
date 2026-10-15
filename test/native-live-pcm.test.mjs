import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeSource,fixture,runJvm,jsonJarSkip} from './fixtures/jvm-tools.mjs';

test('native PCM transport bounds queued audio and fences cancellation/re-enrollment',{skip:jsonJarSkip},()=>{
 assert.match(runJvm(['NativeLiveVoicePipe.java','NativeVoiceBinding.java','VoiceEventAdmission.java','PluginWorkers.java'].map(nativeSource).concat(fixture('NativeLiveVoicePipeTest.java')),'ai.elizaresearch.alphaphone.NativeLiveVoicePipeTest',{json:true}),/^PASS native voice pipe/);
});

test('native IPC has its own cancellable deadline and bounded response',{skip:jsonJarSkip},()=>{
 assert.match(runJvm([nativeSource('NativeVoiceIpc.java'),fixture('NativeVoiceIpcTest.java')],'ai.elizaresearch.alphaphone.NativeVoiceIpcTest',{json:true}),/^PASS native voice IPC/);
});
