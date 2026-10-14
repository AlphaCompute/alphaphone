import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Voice assistant controller (apps/app/src/runtime/voice-assistant.ts, #423): endpointing,
// generations, barge-in, heard-content accounting, account change, and the live segment stream
// it listens through (live-segment-stream.ts). Fake clock, capture, agent and speaker.
const {VoiceAssistantSession, splitSpokenSentences, ASSISTANT_TIMING_DEFAULTS} = await import('../apps/app/src/runtime/voice-assistant.ts');
const {createLiveSegmentStream} = await import('../apps/app/src/runtime/live-segment-stream.ts');

function fakeClock() {
  let now = 0, id = 0;
  const timers = new Map();
  return {
    now: () => now,
    setTimer: (callback, ms) => { const handle = ++id; timers.set(handle, {at: now + ms, callback}); return handle; },
    clearTimer: handle => { timers.delete(handle); },
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]); now = next[1].at; next[1].callback();
        await flush();
      }
      now = end; await flush();
    },
  };
}
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); promise.catch(() => {}); return {promise, resolve, reject}; }

function harness(options = {}) {
  const clock = fakeClock();
  const log = {sends: [], spoken: [], heard: [], states: [], turns: [], captures: 0, cancelled: 0, closed: 0};
  let mic, current = true;
  const replies = [];
  const speeches = [];
  const ports = {
    conversationId: 'room-1',
    assertCurrent: () => { if (!current) throw new DOMException('binding changed', 'AbortError'); },
    listen: async handlers => {
      log.captures++; mic = handlers;
      return {close: async () => { log.closed++; }, cancel: () => { log.cancelled++; }};
    },
    shouldRespond: options.shouldRespond,
    endpoint: options.endpoint,
    send: input => {
      log.sends.push({turnId: input.turnId, text: input.text});
      const reply = deferred();
      replies.push({input, reply});
      input.signal.addEventListener('abort', () => reply.reject(new DOMException('cancelled', 'AbortError')), {once: true});
      return reply.promise;
    },
    speak: input => {
      const done = deferred();
      speeches.push({input, done});
      input.signal.addEventListener('abort', () => done.reject(new DOMException('stopped', 'AbortError')), {once: true});
      return done.promise;
    },
    onHeard: value => log.heard.push(value),
    onState: value => log.states.push(value),
    onTurn: (event, turnId) => log.turns.push([event, turnId]),
  };
  const session = new VoiceAssistantSession(ports, {clock, ...(options.timing ? {timing: options.timing} : {})});
  const answer = (index, text, extra = {}) => {
    const {input, reply} = replies[index];
    reply.resolve({requestId: input.turnId, conversationId: 'room-1', userMessageId: `u-${index}`, assistantMessageId: `a-${index}`, text, complete: true, ...extra});
  };
  return {
    clock, log, session, replies, speeches, answer,
    get mic() { return mic; },
    setCurrent(value) { current = value; },
    async say(text, durationMs = 400) {
      mic.onSpeechStart(clock.now()); await flush();
      await clock.advance(durationMs);
      mic.onSpeechEnd(clock.now()); await flush();
      mic.onSegment(text); await flush();
    },
    phase: () => session.getSnapshot().phase,
  };
}

test('VAD fallback: an utterance is sent once after the long gap, and resumed speech before it continues the same turn', async () => {
  const h = harness();
  await h.session.start();
  assert.equal(h.phase(), 'listening');
  await h.say('remind me to call');
  await h.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs - 100);
  assert.equal(h.log.sends.length, 0, 'nothing is sent before the long gap');
  // Hesitation: the user continues; the pending submit is cancelled and the text is appended.
  await h.say('Sam at five');
  await h.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs - 1);
  assert.equal(h.log.sends.length, 0);
  await h.clock.advance(1);
  assert.deepEqual(h.log.sends.map(send => send.text), ['remind me to call Sam at five'], 'one committed turn, no duplicate');
  assert.equal(h.phase(), 'thinking');
});

test('semantic endpoint: finished submits at the short gap; a slow or failing detector never blocks the long gap; speech wins a racing decision', async () => {
  const finished = harness({endpoint: async () => 'finished'});
  await finished.session.start();
  await finished.say('what is the weather');
  await finished.clock.advance(ASSISTANT_TIMING_DEFAULTS.shortGapMs);
  assert.equal(finished.log.sends.length, 1);

  const never = harness({endpoint: () => new Promise(() => {})});
  await never.session.start();
  await never.say('what is the weather');
  await never.clock.advance(ASSISTANT_TIMING_DEFAULTS.shortGapMs + ASSISTANT_TIMING_DEFAULTS.endpointDeadlineMs);
  assert.equal(never.log.sends.length, 0, 'an expired decision is continue');
  await never.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs);
  assert.equal(never.log.sends.length, 1, 'the long gap submits regardless');

  const failing = harness({endpoint: async () => { throw Error('model unavailable'); }});
  await failing.session.start();
  await failing.say('hello there');
  await failing.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs);
  assert.equal(failing.log.sends.length, 1);

  const decision = deferred();
  const racing = harness({endpoint: () => decision.promise});
  await racing.session.start();
  await racing.say('turn on the');
  await racing.clock.advance(ASSISTANT_TIMING_DEFAULTS.shortGapMs);
  racing.mic.onSpeechStart(racing.clock.now()); await flush();
  decision.resolve('finished'); await flush();
  assert.equal(racing.log.sends.length, 0, 'resumed speech beats a late finished decision');
  await racing.clock.advance(300); racing.mic.onSpeechEnd(racing.clock.now()); racing.mic.onSegment('kitchen lights'); await flush();
  await racing.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs);
  assert.deepEqual(racing.log.sends.map(send => send.text), ['turn on the kitchen lights']);
});

test('barge-in during inference cancels the request, drops its late reply and sends the new speech as the next turn after the first settles', async () => {
  const h = harness();
  await h.session.start();
  await h.say('book a table');
  await h.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs);
  assert.equal(h.log.sends.length, 1);
  const first = h.replies[0];
  h.mic.onSpeechStart(h.clock.now()); await flush();
  assert.equal(first.input.signal.aborted, true, 'the in-flight request is cancelled');
  assert.deepEqual(h.log.turns.map(([event]) => event), ['submitted', 'interrupted']);
  await h.clock.advance(300); h.mic.onSpeechEnd(h.clock.now()); h.mic.onSegment('for four people'); await flush();
  await h.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs);
  assert.deepEqual(h.log.sends.map(send => send.text), ['book a table', 'for four people'], 'the earlier turn is never resent');
  assert.notEqual(h.log.sends[1].turnId, h.log.sends[0].turnId);
  // A reply racing in for the cancelled turn is never spoken.
  h.answer(0, 'Which restaurant?'); await flush();
  assert.equal(h.speeches.length, 0);
  h.answer(1, 'Booked for four.'); await flush();
  assert.equal(h.speeches.length, 1);
  assert.equal(h.speeches[0].input.text, 'Booked for four.');
});

test('barge-in during playback stops it and keeps only the sentences that finished playing', async () => {
  const h = harness();
  await h.session.start();
  await h.say('tell me about my day');
  await h.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs);
  h.answer(0, 'You have three meetings today. The first starts at nine with Priya. Then lunch with Sam at noon.'); await flush();
  assert.equal(h.speeches.length, 1);
  h.speeches[0].input.onStarted(); await flush();
  assert.equal(h.phase(), 'speaking');
  h.speeches[0].done.resolve(); await flush();
  assert.equal(h.speeches.length, 2);
  h.speeches[1].input.onStarted(); await flush();
  // The user talks over the second sentence.
  h.mic.onSpeechStart(h.clock.now()); await flush();
  assert.equal(h.speeches[1].input.signal.aborted, true, 'playback is aborted at speech start');
  assert.equal(h.speeches.length, 2, 'no further sentence starts');
  assert.deepEqual(h.log.heard, [{turnId: h.log.sends[0].turnId, replyId: 'a-0', heard: 'You have three meetings today.', unheard: 'The first starts at nine with Priya. Then lunch with Sam at noon.', interrupted: true}]);
  assert.equal(h.phase(), 'listening');
  // A late playback callback from the interrupted reply changes nothing.
  h.speeches[1].input.onStarted(); await flush();
  assert.equal(h.phase(), 'listening');
});

test('Stop speaking interrupts like barge-in; a reply that plays to the end is heard in full', async () => {
  const h = harness();
  await h.session.start();
  await h.say('what time is it');
  await h.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs);
  h.answer(0, 'It is nine thirty in the morning.'); await flush();
  assert.equal(h.session.interruptSpeech(), false, 'nothing to stop before playback starts');
  h.speeches[0].input.onStarted(); await flush();
  assert.equal(h.session.interruptSpeech(), true);
  assert.equal(h.log.heard.at(-1).heard, '', 'the interrupted first sentence is not claimed as heard');
  assert.equal(h.log.heard.at(-1).interrupted, true);

  await h.say('and tomorrow');
  await h.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs);
  h.answer(1, 'Tomorrow is Thursday.'); await flush();
  h.speeches[1].input.onStarted(); h.speeches[1].done.resolve(); await flush();
  assert.deepEqual(h.log.heard.at(-1), {turnId: h.log.sends[1].turnId, replyId: 'a-1', heard: 'Tomorrow is Thursday.', unheard: '', interrupted: false});
  assert.deepEqual(h.log.turns.map(([event]) => event), ['submitted', 'first-audio', 'interrupted', 'submitted', 'first-audio', 'finished']);
});

test('echo of the reply heard while it plays is not sent as a turn', async () => {
  const echo = (text, context) => !(context.agentSpeaking || context.replyAgeMs < 9000) || !context.recentAgentReply.toLowerCase().includes(text.toLowerCase());
  const h = harness({shouldRespond: echo});
  await h.session.start();
  await h.say('read my reminder');
  await h.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs);
  h.answer(0, 'Your reminder says to water the plants before you leave.'); await flush();
  h.speeches[0].input.onStarted(); await flush();
  // The speaker leaks into the microphone: VAD opens, playback stops, the transcript is the reply.
  await h.say('water the plants');
  await h.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs * 2);
  assert.equal(h.log.sends.length, 1, 'the echo is discarded');
  assert.equal(h.phase(), 'listening');
});

test('account or binding change stops the conversation: capture cancelled, nothing sent, late callbacks ignored', async () => {
  const h = harness();
  await h.session.start();
  await h.say('send a message to');
  h.setCurrent(false);
  h.session.recheck(); await flush();
  assert.equal(h.phase(), 'idle');
  assert.equal(h.log.cancelled, 1, 'the capture is discarded, not finalized');
  // Late events from the old owner's capture and timers do nothing.
  h.mic.onSegment('Alex'); h.mic.onSpeechStart(h.clock.now());
  await h.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs * 3);
  assert.equal(h.log.sends.length, 0);

  // Mid-reply: the request is aborted and its reply never reaches the speaker.
  const g = harness();
  await g.session.start();
  await g.say('what is on my calendar');
  await g.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs);
  g.setCurrent(false);
  g.session.recheck(); await flush();
  assert.equal(g.replies[0].input.signal.aborted, true);
  g.answer(0, 'You are free all day.'); await flush();
  assert.equal(g.speeches.length, 0);
});

test('Stop discards an unsent utterance; Mute finalizes speech up to the mute and Unmute reopens the microphone', async () => {
  const h = harness();
  await h.session.start();
  await h.say('cancel my');
  await h.session.stop();
  await h.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs * 2);
  assert.equal(h.log.sends.length, 0, 'Stop never sends what was not submitted');

  const m = harness();
  await m.session.start();
  m.mic.onSpeechStart(m.clock.now()); await flush();
  const muting = m.session.setMuted(true);
  // The capture stops at the mute: its open segment is closed and its final delivered before close resolves.
  m.mic.onSpeechEnd(m.clock.now()); m.mic.onSegment('turn off the alarm');
  await muting;
  assert.equal(m.log.closed, 1);
  assert.equal(m.session.muted, true);
  await m.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs);
  assert.deepEqual(m.log.sends.map(send => send.text), ['turn off the alarm']);
  m.mic.onSpeechStart(m.clock.now()); await flush();
  assert.equal(m.replies[0].input.signal.aborted, false, 'a muted microphone cannot barge in');
  await m.session.setMuted(false);
  assert.equal(m.log.captures, 2);
});

test('an automatic voice turn never approves: a reply with proposals ends voice without speaking it', async () => {
  const h = harness();
  await h.session.start();
  await h.say('delete my dentist appointment');
  await h.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs);
  h.answer(0, 'Review the deletion below.', {complete: false}); await flush();
  assert.equal(h.speeches.length, 0);
  assert.equal(h.phase(), 'error');
  assert.equal(h.log.cancelled, 1, 'the microphone is released');
});

test('a Notes read-reply pause turns the microphone off until the exact approved result is resumed', async () => {
  const h = harness();
  await h.session.start();
  await h.say('summarize my packing note');
  await h.clock.advance(ASSISTANT_TIMING_DEFAULTS.longGapMs);
  h.answer(0, 'Share the note?', {complete: false, awaitingUserInput: {proposalId: 'p-1', digest: 'd-1'}}); await flush();
  const state = h.session.getSnapshot();
  assert.equal(state.phase, 'awaiting-user-input');
  assert.equal(h.log.cancelled, 1, 'microphone off while the owner reviews');
  const pause = state.awaitingUserInput;
  assert.equal(h.session.resume({pause: {...pause, digest: 'other'}, reply: {requestId: pause.requestId, conversationId: 'room-1', userMessageId: pause.userMessageId, assistantMessageId: 'a-2', text: 'x', complete: true}}), false);
  assert.equal(h.session.resume({pause, reply: {requestId: pause.requestId, conversationId: 'room-1', userMessageId: pause.userMessageId, assistantMessageId: 'a-2', text: 'Passport, charger and boots.', complete: true}}), true);
  await flush();
  assert.equal(h.log.captures, 2, 'listening resumes');
  assert.equal(h.speeches[0].input.text, 'Passport, charger and boots.');
});

test('sentence splitting keeps the reply text and avoids tiny fragments', () => {
  assert.deepEqual(splitSpokenSentences('  Dr. Smith is in. The visit is at 9:30 on Tuesday. Bring your card!  '), ['Dr. Smith is in. The visit is at 9:30 on Tuesday.', 'Bring your card!']);
  assert.deepEqual(splitSpokenSentences(''), []);
  const text = 'One sentence that is long enough. Another one that is long enough? Last.';
  assert.equal(splitSpokenSentences(text).join(' '), text);
  assert.throws(() => new VoiceAssistantSession({conversationId: 'r', assertCurrent() {}, listen: async () => ({close: async () => {}, cancel() {}}), send: async () => ({}), speak: async () => {}}, {timing: {shortGapMs: 900, longGapMs: 300}}), RangeError);
});

// --- Live segment stream --------------------------------------------------------------------

function stubTransport() {
  const posts = [];let reply = () => ({ok: true, mode: 'stream', framesReceived: 0});let turn = 0;
  return {
    posts,
    set reply(fn) { reply = fn; },
    transport: {post: async body => { posts.push(structuredClone(body)); return reply(body, () => `t${++turn}`); }},
  };
}
const frame = timestamp => ({pcm16: 'AAAA', sampleRate: 16000, channels: 1, samples: 2, timestamp});
const finalOn = (body, next) => body.vad?.some(edge => edge.type === 'speech-end') ? {ok: true, mode: 'stream', framesReceived: 1, final: {turnId: next(), text: `heard ${body.frames?.length ?? 0} frames`, mode: 'stream', asrFinalFromSpeechEndMs: 20}} : {ok: true, mode: 'stream', framesReceived: 1};

test('stop reconciliation: frames after the stop are never forwarded and the open segment ends at the stop', async () => {
  const agent = stubTransport();agent.reply = finalOn;
  const segments = [], ends = [];
  const stream = createLiveSegmentStream({transport: agent.transport, onSegment: text => segments.push(text), onSpeechEnd: at => ends.push(at)});
  await stream.accept([frame(100), frame(132)], [{type: 'speech-start', timestampMs: 100}]);
  assert.equal(stream.speaking(), true);
  stream.cutoff(150);
  // In flight from the native thread: one frame before the stop, one after, and a late VAD edge.
  await stream.accept([frame(140), frame(170)], [{type: 'speech-end', timestampMs: 180}]);
  await stream.close();
  assert.deepEqual(ends, [150], 'the open segment closes at the stop');
  const forwarded = agent.posts.flatMap(body => body.frames ?? []).map(f => f.timestamp);
  assert.deepEqual(forwarded, [100, 132, 140]);
  assert.equal(segments.length, 1, 'the final arrives before close resolves');
  assert.equal(agent.posts.at(-1).close, true, 'the agent session is released');
  assert.equal(agent.posts.filter(body => body.vad?.some(edge => edge.type === 'speech-end')).length, 1);
});

test('one result per closed segment: ASR failure is null, transport failure is fatal, cancel discards', async () => {
  const agent = stubTransport();
  agent.reply = (body, next) => body.vad?.some(edge => edge.type === 'speech-end') ? Promise.reject(Object.assign(Error('down'), {status: 503})) : {ok: true, mode: 'stream', framesReceived: 1};
  const segments = [], fatal = [];
  const stream = createLiveSegmentStream({transport: agent.transport, onSegment: text => segments.push(text), onFatal: code => fatal.push(code)});
  await stream.accept([frame(1)], [{type: 'speech-start', timestampMs: 1}]);
  await stream.accept([frame(2)], [{type: 'speech-end', timestampMs: 2}]);
  assert.deepEqual(segments, [null]);
  assert.deepEqual(fatal, ['LIVE_ASR_UNAVAILABLE']);

  const quiet = stubTransport();quiet.reply = finalOn;
  const results = [];
  const discarded = createLiveSegmentStream({transport: quiet.transport, onSegment: text => results.push(text)});
  await discarded.accept([frame(1)], [{type: 'speech-start', timestampMs: 1}]);
  discarded.cancel();
  await discarded.accept([frame(2)], [{type: 'speech-end', timestampMs: 2}]);
  await flush();
  assert.deepEqual(results, [], 'nothing is delivered after cancel');
  assert.ok(quiet.posts.every(body => !(body.frames ?? []).some(f => f.timestamp === 2)), 'audio after cancel is never forwarded');
});

test('sources: no Web Speech, storage or logging in the assistant path; the adapter wires both controls separately', () => {
  const files = ['apps/app/src/runtime/voice-assistant.ts', 'apps/app/src/runtime/live-segment-stream.ts', 'apps/app/src/runtime/native-live-voice.ts'];
  for (const file of files) {
    const source = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    assert.doesNotMatch(source, /console\.|localStorage|sessionStorage|indexedDB|speechSynthesis|SpeechRecognition|onnx/i, file);
  }
  const adapter = fs.readFileSync(new URL('../apps/app/src/prototype/voice-adapter.ts', import.meta.url), 'utf8');
  // Dictation (Transcribe) uses the live capture without echo cancellation and only fills an editable draft.
  assert.match(adapter, /chat\?\.mode === 'dictation' && await nativeLiveVoiceReady/);
  assert.match(adapter, /liveDictation = createNativeLiveDictation\(/);
  // The assistant uses its own controller and the same send policy boundary as the recorded loop.
  assert.match(adapter, /new VoiceAssistantSession\(\{/);
  const native = fs.readFileSync(new URL('../apps/app/src/runtime/native-live-voice.ts', import.meta.url), 'utf8');
  assert.match(native, /nativeAssistantListener[\s\S]{0,300}echoCancel: true/);
  assert.match(native, /createNativeLiveDictation[\s\S]{0,1500}echoCancel: false/);
  const template = fs.readFileSync(new URL('../apps/app/src/prototype/template.html', import.meta.url), 'utf8');
  assert.match(template, /aria-label="Transcribe" title="Transcribe into draft" onClick="\{\{startTranscription\}\}"/);
  assert.match(template, /title="Voice assistant" aria-label="Talk" onClick="\{\{startVoice\}\}"/);
  assert.match(template, /chatRecorder\.canInterrupt[\s\S]{0,200}Stop speaking/);
  assert.match(template, /aria-pressed="\{\{chatRecorder\.muted\}\}"/);
});

test('the capture source policy picks the echo-cancelled source only for full duplex with a canceller (host JVM)', async () => {
  const {nativeSource, fixture, runJvm} = await import('./fixtures/jvm-tools.mjs');
  assert.match(runJvm([nativeSource('LiveCaptureSource.java'), fixture('LiveCaptureSourceTest.java')], 'ai.elizaresearch.alphaphone.LiveCaptureSourceTest'), /^PASS live capture source/);
  const capture = fs.readFileSync(new URL('../android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLiveVoiceCapture.java', import.meta.url), 'utf8');
  assert.match(capture, /LiveCaptureSource\.select\(echoCancel,AcousticEchoCanceler\.isAvailable\(\)/);
  assert.match(capture, /if\(frames\.length\(\)>0\|\|edges\.length\(\)>0\)sink\.frames/, 'the stop flushes the last frames read before it');
});
