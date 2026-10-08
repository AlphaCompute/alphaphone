import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

// The real recognizer source against a scripted worker: ownership, cancellation and late results.
function harness(idleMs = 200) {
  const workers = [];
  class FakeWorker { constructor() { this.posted = []; this.terminated = false; workers.push(this); } postMessage(message, transfer) { this.posted.push({message, transfer}); } terminate() { this.terminated = true; } emit(data) { if (!this.terminated) this.onmessage?.({data}); } }
  const protocol = readFileSync(new URL('../apps/app/src/browser/speech-protocol.ts', import.meta.url), 'utf8').replaceAll('export function', 'function');
  const source = readFileSync(new URL('../apps/app/src/browser/speech-recognizer.ts', import.meta.url), 'utf8').replace(/^import .*\n/gm, '').replace('export class', 'class').replace('import.meta.url', "'https://app.test/assets/'");
  const context = {DOMException, crypto, Float32Array, URL, Promise, Error, Object, setTimeout, clearTimeout};
  vm.runInNewContext(stripTypeScriptTypes(protocol, {mode: 'transform'}) + '\n' + stripTypeScriptTypes(source, {mode: 'transform'}) + '\nglobalThis.Recognizer=BrowserSpeechRecognizer;', context);
  const recognizer = new context.Recognizer(() => 'https://app.test/browser-speech/manifest.json', () => new FakeWorker(), idleMs);
  return {recognizer, workers};
}
const result = {text: 'Hello there', noSpeech: false, engine: 'whisper', model: 'whisper-tiny.en', modelRevision: 'r', runtime: 'ort', language: 'en'};
const settle = promise => promise.then(value => ({value}), error => ({error}));

test('a result is delivered once, progress is forwarded, and the loaded worker is reused', async () => {
  const {recognizer, workers} = harness(), progress = [], samples = new Float32Array([0.1, 0.2]);
  const pending = recognizer.transcribe(samples, new AbortController().signal, value => progress.push(value));
  const [{message, transfer}] = workers[0].posted;
  assert.equal(message.type, 'transcribe'); assert.equal(message.manifestUrl, 'https://app.test/browser-speech/manifest.json');
  assert.notEqual(message.samples, samples, 'the caller keeps its samples; a copy is transferred');
  assert.equal(transfer[0], message.samples.buffer);
  workers[0].emit({type: 'progress', id: 'someone-else', phase: 'initialize'});
  workers[0].emit({type: 'progress', id: message.id, phase: 'download', loaded: 5, total: 10});
  workers[0].emit({type: 'result', id: message.id, ...result});
  workers[0].emit({type: 'result', id: message.id, ...result, text: 'Second delivery'});
  assert.deepEqual(JSON.parse(JSON.stringify(await pending)), result);
  assert.deepEqual(JSON.parse(JSON.stringify(progress)), [{phase: 'download', loaded: 5, total: 10}]);
  assert.equal(recognizer.busy, false);
  const next = recognizer.transcribe(samples, new AbortController().signal);
  assert.equal(workers.length, 1, 'an idle model stays loaded');
  workers[0].emit({type: 'result', id: workers[0].posted[1].message.id, ...result, text: 'Again'});
  assert.equal((await next).text, 'Again');
});

test('abort terminates the worker at once; a late result cannot resolve or reach the next request', async () => {
  const {recognizer, workers} = harness(), controller = new AbortController();
  const pending = settle(recognizer.transcribe(new Float32Array(4), controller.signal));
  const first = workers[0], id = first.posted[0].message.id;
  controller.abort();
  const outcome = await pending;
  assert.equal(outcome.error.name, 'AbortError'); assert.equal(first.terminated, true);
  first.onmessage?.({data: {type: 'result', id, ...result}});
  const next = recognizer.transcribe(new Float32Array(4), new AbortController().signal);
  assert.equal(workers.length, 2, 'a cancelled worker is never reused');
  workers[1].emit({type: 'result', id: workers[1].posted[0].message.id, ...result, text: 'Fresh'});
  assert.equal((await next).text, 'Fresh');
  assert.equal((await settle(recognizer.transcribe(new Float32Array(1), AbortSignal.abort()))).error.name, 'AbortError');
});

test('a replacement request and stop() retire the active one; load failures discard the worker', async () => {
  const {recognizer, workers} = harness();
  const first = settle(recognizer.transcribe(new Float32Array(1), new AbortController().signal));
  const second = settle(recognizer.transcribe(new Float32Array(1), new AbortController().signal));
  assert.equal((await first).error.name, 'AbortError'); assert.equal(workers[0].terminated, true);
  workers[1].emit({type: 'error', id: workers[1].posted[0].message.id, code: 'model-load-failed', message: 'This build does not include the speech model'});
  const failed = (await second).error;
  assert.equal(failed.code, 'model-load-failed'); assert.equal(workers[1].terminated, true);
  const third = settle(recognizer.transcribe(new Float32Array(1), new AbortController().signal));
  workers[2].emit({type: 'error', id: workers[2].posted[0].message.id, code: 'recognition-failed', message: 'x'});
  assert.equal((await third).error.code, 'recognition-failed'); assert.equal(workers[2].terminated, false, 'a decoding failure keeps the verified model');
  recognizer.stop(); assert.equal(workers[2].terminated, false, 'stop() leaves an idle model loaded');
  const fourth = settle(recognizer.transcribe(new Float32Array(1), new AbortController().signal));
  recognizer.stop(); assert.equal((await fourth).error.name, 'AbortError'); assert.equal(workers[2].terminated, true);
  const fifth = settle(recognizer.transcribe(new Float32Array(1), new AbortController().signal));
  workers[3].emit({type: 'result', id: workers[3].posted[0].message.id, text: 7, noSpeech: false});
  assert.equal((await fifth).error.code, 'recognition-failed', 'malformed results are rejected');
});

test('an idle model is released after the idle period; a new request in time keeps it', async () => {
  const {recognizer, workers} = harness(40);
  const answer = worker => worker.emit({type: 'result', id: worker.posted.at(-1).message.id, ...result});
  const first = recognizer.transcribe(new Float32Array(1), new AbortController().signal); answer(workers[0]); await first;
  await new Promise(resolve => setTimeout(resolve, 15));
  const second = recognizer.transcribe(new Float32Array(1), new AbortController().signal);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(workers[0].terminated, false, 'an active request is never released as idle');
  answer(workers[0]); await second;
  assert.equal(workers.length, 1);
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(workers[0].terminated, true, 'the idle worker is terminated');
  const third = recognizer.transcribe(new Float32Array(1), new AbortController().signal);
  assert.equal(workers.length, 2, 'the next request starts a fresh worker'); answer(workers[1]); await third;
  recognizer.cancel();
});
