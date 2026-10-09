import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPreparedBatchVoice} from './fixtures/shared-batch-voice.mjs';

test('Alpha resolves the real public voice imports from authenticated prepared source without broad host modules',()=>{
 const box={crypto,AbortController,DOMException,Date,setTimeout,clearTimeout,performance};
 const loaded=loadPreparedBatchVoice(box);
 for(const file of ['packages/core/src/speech.ts','packages/voice/src/turn.ts','packages/ui/src/voice/batch-conversation.ts'])assert.ok(loaded.inputs.includes(file));
 assert.equal(loaded.inputs.some(file=>/(?:voice-protocol|batch-protocol|protocol|index)\.ts$/.test(file)),false);
 for(const name of ['BatchVoiceConversation','ElizaError','sanitizeSpeechText','scoreEndOfTurnHeuristic','markTtsPlaybackStarted'])assert.equal(typeof box[name],'function');
 assert.equal(box.sanitizeSpeechText('<think>Internal.</think>Hello.'),'Hello.');
 assert.equal(box.scoreEndOfTurnHeuristic('What time is it?')>.5,true);
});
