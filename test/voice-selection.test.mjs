import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

// Real voice-selection source with a synthetic Cloud session and an in-memory Storage.
// "Restart" evaluates the source again in a fresh context over the same stored bytes.
function storage(bytes = new Map()) {
  return {bytes, getItem: key => bytes.has(key) ? bytes.get(key) : null, setItem: (key, value) => { bytes.set(key, String(value)); }, removeItem: key => { bytes.delete(key); }};
}
function load(store, mocks = false) {
  const events = [];
  const box = {
    testMocksEnabled: mocks, localStorage: store, Date, JSON, Number, Event: class { constructor(type) { this.type = type; } },
    window: {dispatchEvent: event => { events.push(event.type); return true; }},
  };
  const source = fs.readFileSync('apps/app/src/runtime/voice-selection.ts', 'utf8').replace(/^import .*;\n/gm, '').replaceAll('export function', 'function').replaceAll('export type', 'type');
  vm.runInNewContext('{' + stripTypeScriptTypes(source, {mode: 'transform'}) + '\nglobalThis.api={selectVoiceRoute,speakRepliesEnabled,setSpeakReplies,voiceSendPolicy,setVoiceSendPolicyForTests};}', box);
  return {...box.api, events};
}

test('production preserves the Cloud route regardless of legacy preferences or requested fallback', () => {
  const store = storage();
  // A retained legacy route record (the removed route chooser wrote this shape) selects nothing.
  store.bytes.set('alphaphone:voice-route:v1', JSON.stringify({version: 1, route: 'device', chosenAt: 1}));
  const v = load(store);
  for (const requested of ['default', 'device', 'manual', 'agent']) assert.equal(v.selectVoiceRoute(requested), 'cloud');
  const mocks = load(store, true);
  assert.equal(mocks.selectVoiceRoute('device'), 'device');
  assert.equal(mocks.selectVoiceRoute('agent'), 'cloud');
});

test('the voice send policy defaults to auto-send and only test-mocks builds can exercise review', () => {
  const production = load(storage());
  assert.equal(production.voiceSendPolicy(), 'auto-send');
  assert.equal(production.setVoiceSendPolicyForTests('review'), false);
  assert.equal(production.voiceSendPolicy(), 'auto-send');
  const mocks = load(storage(), true);
  assert.equal(mocks.voiceSendPolicy(), 'auto-send');
  assert.equal(mocks.setVoiceSendPolicyForTests('review'), true);
  assert.equal(mocks.voiceSendPolicy(), 'review');
  assert.equal(mocks.setVoiceSendPolicyForTests('anything'), true);
  assert.equal(mocks.voiceSendPolicy(), 'auto-send', 'an unknown policy falls back to the constant');
});

test('removed exports stay removed until MVP-01 decides their control', () => {
  const source = fs.readFileSync('apps/app/src/runtime/voice-selection.ts', 'utf8');
  for (const name of ['cloudSpeechDisclosure', 'chooseVoiceRoute', 'voiceRoutePreference', 'cloudVoiceAvailable', 'voicePreferenceKeys'])
    assert.doesNotMatch(source, new RegExp('export function ' + name + '\\b'), name);
});

test('Speak replies is opt-in, persisted and off for anything but an explicit enable', () => {
  const store = storage(), v = load(store);
  assert.equal(v.speakRepliesEnabled(), false);
  assert.equal(v.setSpeakReplies(true), true);
  assert.equal(load(store).speakRepliesEnabled(), true);
  assert.equal(v.setSpeakReplies(false), true);
  assert.equal(load(store).speakRepliesEnabled(), false);
  store.bytes.set('alphaphone:speak-replies:v1', '{"version":1,"enabled":"yes"}');
  assert.equal(load(store).speakRepliesEnabled(), false);
});
