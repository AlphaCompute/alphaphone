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
function load(store, f = {account: true, dev: false}) {
  const events = [];
  const box = {
    localStorage: store, Date, JSON, Number, Event: class { constructor(type) { this.type = type; } },
    window: {dispatchEvent: event => { events.push(event.type); return true; }},
    get browserDevProfile() { return f.dev; },
    connectionController: {getCloudEnvironment: () => f.account ? 'production' : null, getCloudClient: () => f.account ? {sessionId: 'synthetic-session', credentialId: 'synthetic-credential'} : null},
  };
  const source = fs.readFileSync('apps/app/src/runtime/voice-selection.ts', 'utf8').replace(/^import .*;\n/gm, '').replaceAll('export function', 'function').replaceAll('export type', 'type');
  vm.runInNewContext('{' + stripTypeScriptTypes(source, {mode: 'transform'}) + '\nglobalThis.api={selectVoiceRoute,chooseVoiceRoute,voiceRoutePreference,speakRepliesEnabled,setSpeakReplies,cloudVoiceAvailable,voicePreferenceKeys,cloudSpeechDisclosure};}', box);
  return {...box.api, events, f};
}

test('on-device is the default even with a signed-in Cloud account', () => {
  const v = load(storage());
  assert.equal(v.cloudVoiceAvailable(), true);
  assert.equal(v.selectVoiceRoute(), 'device');
  assert.equal(v.voiceRoutePreference(), 'device');
  // Explicit in-session requests keep their meaning.
  assert.equal(v.selectVoiceRoute('device'), 'device');
  assert.equal(v.selectVoiceRoute('manual'), 'manual');
  assert.equal(v.selectVoiceRoute('agent'), 'cloud');
});

test('Cloud is selected only by a disclosed, persisted choice that survives restart', () => {
  const store = storage(), first = load(store);
  assert.equal(first.chooseVoiceRoute('cloud'), false, 'an undisclosed Cloud choice is refused');
  assert.equal(first.selectVoiceRoute(), 'device');
  assert.equal(first.chooseVoiceRoute('cloud', {disclosed: 'cloud-speech-uses-credits'}), true);
  assert.equal(first.selectVoiceRoute(), 'cloud');
  assert.deepEqual(first.events, ['alpha:voice-preferences']);
  assert.match(first.cloudSpeechDisclosure(), /uses its credits/);
  const key = first.voicePreferenceKeys().route;
  assert.equal(key, 'alphaphone:voice-route:v1');
  assert.deepEqual(Object.keys(JSON.parse(store.bytes.get(key))).sort(), ['chosenAt', 'disclosed', 'route', 'version']);
  // A fresh renderer over the same storage keeps the choice.
  const restarted = load(store);
  assert.equal(restarted.selectVoiceRoute(), 'cloud');
  // Signed out: the stored choice cannot select Cloud.
  restarted.f.account = false;
  assert.equal(restarted.selectVoiceRoute(), 'device');
  assert.equal(restarted.selectVoiceRoute('agent'), 'agent');
  restarted.f.account = true;
  // The development browser profile never routes to Cloud.
  restarted.f.dev = true;
  assert.equal(restarted.selectVoiceRoute(), 'device');
  restarted.f.dev = false;
  // Choosing on-device again persists too.
  assert.equal(restarted.chooseVoiceRoute('device'), true);
  assert.equal(load(store).selectVoiceRoute(), 'device');
});

test('malformed, foreign or unconfirmed preference bytes read as on-device', () => {
  for (const raw of ['not json', 'null', '[]', '{"kind":"remote"}', '{"version":1,"route":"cloud"}', '{"version":2,"route":"cloud","disclosed":"cloud-speech-uses-credits","chosenAt":1}', '{"version":1,"route":"cloud","disclosed":true,"chosenAt":1}']) {
    const store = storage(new Map([['alphaphone:voice-route:v1', raw]]));
    assert.equal(load(store).selectVoiceRoute(), 'device', raw);
  }
  // Storage that drops writes cannot confirm Cloud.
  const dropping = {getItem: () => null, setItem: () => {}};
  const v = load(dropping);
  assert.equal(v.chooseVoiceRoute('cloud', {disclosed: 'cloud-speech-uses-credits'}), false);
  assert.equal(v.selectVoiceRoute(), 'device');
  // Storage that throws is handled.
  const throwing = {getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); }};
  const t = load(throwing);
  assert.equal(t.chooseVoiceRoute('cloud', {disclosed: 'cloud-speech-uses-credits'}), false);
  assert.equal(t.selectVoiceRoute(), 'device');
  assert.equal(t.speakRepliesEnabled(), false);
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
