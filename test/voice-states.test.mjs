import {test} from 'node:test';
import assert from 'node:assert/strict';
const {voiceFailure, speechProgressMessage, transcriptProvenance} = await import('../apps/app/src/runtime/voice-states.ts');

const named = name => Object.assign(new Error(name), {name});
const coded = code => Object.assign(new Error(code), {code});
test('each recorder failure has its own state; cancellation and unknown errors are not misreported', () => {
  const browser = {transcribing: false, browser: true};
  assert.equal(voiceFailure(new DOMException('x', 'NotAllowedError'), browser).kind, 'denied');
  assert.match(voiceFailure(named('NotAllowedError'), browser).message, /site settings/);
  assert.match(voiceFailure(named('NotAllowedError'), {transcribing: false, browser: false}).message, /Android settings/);
  assert.equal(voiceFailure(named('SecurityError'), browser).kind, 'denied');
  assert.equal(voiceFailure(named('NotFoundError'), browser).kind, 'no-microphone');
  // A transcription-time NotAllowedError is not a microphone permission problem.
  assert.equal(voiceFailure(named('NotAllowedError'), {transcribing: true, browser: true}), null);
  assert.equal(voiceFailure(coded('no-speech'), {transcribing: true, browser: true}).kind, 'no-speech');
  assert.match(voiceFailure(coded('no-speech'), {transcribing: true, browser: true}).message, /type the transcript instead/);
  assert.equal(voiceFailure(coded('model-load-failed'), {transcribing: true, browser: true}).kind, 'model');
  assert.equal(voiceFailure(coded('recognition-failed'), {transcribing: true, browser: true}).kind, 'recognition');
  assert.equal(voiceFailure(new DOMException('x', 'AbortError'), {transcribing: true, browser: true}), null);
  assert.equal(voiceFailure(new Error('other'), browser), null);
  assert.equal(voiceFailure(undefined, browser), null);
  assert.equal(voiceFailure('NotAllowedError', browser), null);
});

test('model progress is reported in whole megabytes and phases never claim an upload', () => {
  assert.equal(speechProgressMessage({phase: 'download', loaded: 12_400_000, total: 56_117_349}), 'Loading the speech model from this app: 12 of 56 MB. Nothing is uploaded.');
  assert.equal(speechProgressMessage({phase: 'download', loaded: 0, total: 0}), 'Loading the speech model from this app. Nothing is uploaded.');
  assert.match(speechProgressMessage({phase: 'initialize'}), /Starting the speech model/);
  assert.match(speechProgressMessage({phase: 'transcribe'}), /Transcribing in this browser/);
  assert.match(speechProgressMessage(undefined), /Transcribing in this browser/);
});

test('transcript provenance records only reported engine facts and the route actually used', () => {
  const browser = {text: 'x', local: true, route: 'browser', engine: 'whisper', model: 'whisper-tiny.en', modelRevision: 'Xenova/whisper-tiny.en@79fb', runtime: 'onnxruntime-web 1.30.0', language: 'en', extra: 'ignored'};
  assert.deepEqual(transcriptProvenance(browser, {onDevice: true, native: false, paired: false, cloud: false}), {route: 'browser', engine: 'whisper', model: 'whisper-tiny.en', modelRevision: 'Xenova/whisper-tiny.en@79fb', runtime: 'onnxruntime-web 1.30.0', language: 'en'});
  assert.deepEqual(transcriptProvenance({text: 'x', route: 'local-agent', language: 'en'}, {onDevice: true, native: false, paired: false, cloud: false}), {route: 'local-agent', language: 'en'});
  assert.deepEqual(transcriptProvenance({text: 'x', execution: 'device'}, {onDevice: true, native: true, paired: false, cloud: false}), {route: 'on-device'});
  assert.deepEqual(transcriptProvenance({text: 'x'}, {onDevice: false, native: true, paired: true, cloud: false}), {route: 'paired-agent'});
  assert.deepEqual(transcriptProvenance({text: 'x', engine: 7, model: 'm'.repeat(200)}, {onDevice: false, native: true, paired: false, cloud: true}), {route: 'eliza-cloud'});
});

test('Android permission-denied is the denied state with settings and keyboard guidance', () => {
  const android = {transcribing: false, browser: false};
  const denied = voiceFailure(Object.assign(new Error('Microphone permission denied'), {code: 'permission-denied'}), android);
  assert.equal(denied.kind, 'denied');
  assert.match(denied.message, /Open app settings/);
  assert.match(denied.message, /keyboard/);
  assert.match(denied.message, /Nothing was recorded/);
  assert.match(voiceFailure(named('NotAllowedError'), {transcribing: false, browser: true}).message, /keyboard/);
  // A code from a transcription request is not a microphone permission problem.
  assert.equal(voiceFailure(Object.assign(new Error('x'), {code: 'permission-denied'}), {transcribing: true, browser: false}), null);
});
