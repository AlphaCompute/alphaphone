import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

// Real voice adapter, playback, selection and timing sources. The shell switches views like
// model.js: leaving a view runs that view's onLeave. The Cloud transcription boundary is a fixture;
// nothing is uploaded or sent.
function load(file, globals, box) {
  const source = fs.readFileSync('apps/app/src/' + file, 'utf8').replace(/^import .*;\n/gm, '').replaceAll('export function', 'function').replaceAll('export type', 'type');
  vm.runInNewContext('{' + stripTypeScriptTypes(source, {mode: 'transform'}) + '\n' + globals.map(name => `globalThis.${name}=${name};`).join('') + '}', box);
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function fixture(startView) {
  const store = new Map([['alpha.connection.selection.v1', JSON.stringify({kind: 'remote'})]]);
  const driver = {startRecording: async () => ({recordingId: 'clip', maxDurationMs: 59000}), stopRecording: async () => ({recordingId: 'clip', durationMs: 1000}),
    transcribeRecording: async () => ({text: 'What is next today', local: false}), cancelRecording: async () => {}, cancel: async () => {}, stop: async () => {},
    addListener: async () => ({remove: async () => {}}), speak: async () => {}, saveRecording: async () => { throw Error('No save expected'); }};
  const controller = {getPairedVoiceBinding: () => null, getCloudEnvironment: () => 'production', getCloudClient: () => ({sessionId: 'cloud-session'}),
    getSnapshot: () => ({kind: 'remote', session: {sessionId: 'agent-session'}}), getBrowserSpeechAgent: () => null, subscribe: () => () => {}};
  const box = {browserDevProfile: false, testMocksEnabled: false, connectionController: controller, createOnDeviceVoice: () => null, createPairedVoice: () => null,
    createCloudVoice: () => driver, registerPlugin: () => driver, Capacitor: {isNativePlatform: () => true, isPluginAvailable: () => true, getPlatform: () => 'android'},
    localStorage: {getItem: key => store.has(key) ? store.get(key) : null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key)},
    document: {hidden: false, documentElement: {dataset: {}}, querySelector: () => null, addEventListener() {}, removeEventListener() {}},
    window: {addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true}, Event: class { constructor(type) { this.type = type; } },
    setInterval, clearInterval, setTimeout, clearTimeout, Date, JSON, crypto, performance, AbortController, DOMException, console};
  load('runtime/voice-selection.ts', ['selectVoiceRoute'], box);
  load('runtime/cloud-voice.ts', ['cloudVoiceFailure'], box);
  load('runtime/voice-timing.ts', ['markVoiceTiming'], box);
  load('runtime/voice-states.ts', ['voiceFailure', 'transcriptProvenance', 'speechProgressMessage'], box);
  box.createCloudVoice = () => driver;
  load('prototype/local-speech-playback.ts', ['installLocalSpeechPlayback', 'stopLocalSpeechPlayback', 'noteVoiceDraft', 'speakNote', 'stopSpeaking', 'currentNoteReading'], box);
  load('prototype/voice-adapter.ts', ['installPrototypeVoiceAdapter'], box);
  const views = {notes: {render: () => ({ed: {}}), back: () => false, onLeave: () => {}}, calendar: {render: () => ({})}};
  class Shell {
    constructor() { this.state = {view: startView, draft: '', msgs: [], chat: 'input'}; this.notes = {list: []}; }
    S() { return this.state; }
    setState(patch) { Object.assign(this.state, patch); }
    // Like model.js: switching away from a view runs its onLeave.
    leave() { const view = this.state.view; if (view) views[view]?.onLeave?.(this.api(view)); }
    openView(view) { if (this.state.view !== view) this.leave(); this.state.view = view; }
    goHome() { this.leave(); this.state.view = null; }
    toast() {}
    vset(_view, patch) { Object.assign(this.notes, patch); return true; }
    api() { return {get: () => this.notes, setView: (_view, patch) => Object.assign(this.notes, patch)}; }
    startVoice() { throw Error('legacy voice'); }
    componentWillUnmount() {}
  }
  box.installPrototypeVoiceAdapter(Shell, views);
  const shell = new Shell();
  const api = () => ({...shell.api('notes'), ic: {check: '', mic: '', stop: '', play: '', x: ''}, set: patch => Object.assign(shell.notes, patch), toast() {}});
  const render = () => views.notes.render(shell.notes, api());
  render();
  return {box, shell, render};
}

for (const startView of [null, 'calendar', 'notes']) {
  test(`a recognized voice turn survives returning to ${startView ?? 'Home'} and records send`, async () => {
    const {box, shell, render} = fixture(startView);
    // The explicit, disclosed choice selects Cloud for this fixture's transcription.
    assert.equal(box.chooseVoiceRoute('cloud', {disclosed: 'cloud-speech-uses-credits'}), true);
    await shell.startVoice();
    assert.equal(shell.state.view, 'notes');
    render().rec.stop(); await tick(); // start recording
    render().rec.stop(); await tick(); // stop recording: recording-end
    const turn = box.activeVoiceTurn();
    assert.equal(typeof turn, 'string');
    render().rec.stop(); await tick(); // transcribe: transcript-ready
    assert.equal(render().rec.transcript, 'What is next today');
    render().rec.stop(); await tick(); // Use in conversation
    assert.equal(shell.state.view, startView);
    assert.equal(shell.state.draft, 'What is next today');
    assert.equal(box.activeVoiceTurn(), turn, 'returning to the original view does not abandon the handed-off turn');
    assert.equal(box.markVoiceTiming('send'), true);
    const row = box.voiceTimingRecords().at(-1);
    assert.equal(row.outcome, undefined);
    assert.deepEqual(Object.keys(row.marks), ['recording-end', 'transcript-ready', 'send']);
  });
}

test('discarding a recorded voice turn abandons it', async () => {
  const {box, shell, render} = fixture(null);
  box.chooseVoiceRoute('cloud', {disclosed: 'cloud-speech-uses-credits'});
  await shell.startVoice();
  render().rec.stop(); await tick();
  render().rec.stop(); await tick();
  assert.equal(typeof box.activeVoiceTurn(), 'string');
  render().rec.discard(); await tick();
  assert.equal(box.activeVoiceTurn(), undefined);
  assert.equal(box.voiceTimingRecords().at(-1).outcome, 'abandoned');
});
