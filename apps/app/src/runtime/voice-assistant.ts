/**
 * Voice assistant turn controller (#423): a spoken turn goes to the agent and the reply is spoken
 * back, with speech-driven endpointing, barge-in and heard-content accounting. Dictation is a
 * separate control (the chat recorder's Transcribe mode) and never uses this controller.
 *
 * One continuous capture stays open for the whole conversation (the native app-process Silero
 * VAD stream on Android, live-segment-stream.ts). Every VAD segment yields one final transcript
 * from the agent's on-device streaming ASR. The controller joins the segments of one utterance and
 * decides when the user has finished:
 *
 *  - After the last segment closes and its final is in, a short gap (`shortGapMs`) asks the
 *    optional semantic `endpoint` port (Clef when one is admitted; none exists at the current
 *    pin, so the documented VAD fallback applies) with a bounded deadline. `finished` submits now.
 *  - A long gap (`longGapMs`) always submits. Both gaps are measured from the VAD speech-end.
 *  - New speech before submission cancels both timers (and any pending endpoint call) and the
 *    utterance continues.
 *
 * Generations: each submission and each interruption bumps `turn`. Every asynchronous callback
 * (endpoint decision, agent reply, playback progress) checks the generation it started under and
 * is dropped when it has changed. The controller never resubmits a turn it already handed to
 * `send`: speech after submission interrupts the in-flight reply or playback and becomes the
 * next turn, so the earlier turn is never committed twice.
 *
 * Barge-in and heard content: speech that starts while a reply is pending or playing aborts that
 * reply (the native request and playback are cancelled through the port's AbortSignal). Replies
 * are played one sentence at a time; only sentences whose playback completed count as heard. The
 * sentence playing when the user interrupted is reported as unheard: the playback engine reports
 * completion per utterance, not a position, so a partial sentence is never claimed as spoken.
 * `onHeard` reports the heard/unheard split for the host to keep in conversation state.
 *
 * Side effects: an automatic voice submission is never approval. A reply that carries action
 * proposals ends the voice session (the host shows the review); a Notes read-reply pause waits for
 * the host to deliver the separately approved result through `resume`.
 *
 * Pure module (no Capacitor, DOM or upstream imports): Node contract tests evaluate it directly.
 */

export type AssistantPhase = 'idle' | 'starting' | 'listening' | 'thinking' | 'awaiting-user-input' | 'speaking' | 'error';
export type AssistantAwaitingInput = { proposalId: string; digest: string; requestId: string; conversationId: string; userMessageId: string; assistantMessageId: string };
export interface AssistantState {
  phase: AssistantPhase;
  /** The user is speaking now (a VAD segment is open). */
  hearing?: boolean;
  /** An utterance is waiting for the endpoint gap before it is sent. */
  pendingText?: string;
  muted?: boolean;
  transcript?: string;
  replyId?: string;
  error?: unknown;
  awaitingUserInput?: AssistantAwaitingInput;
}
export interface AssistantReply {
  requestId: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  text: string;
  complete: boolean;
  interrupted?: boolean;
  awaitingUserInput?: { proposalId: string; digest: string };
}
export type EndpointDecision = 'finished' | 'continue';
export interface AssistantHeard {
  turnId: string;
  replyId: string;
  /** Sentences whose playback completed, in order. */
  heard: string;
  /** Everything not played to the end, including the sentence that was interrupted. */
  unheard: string;
  interrupted: boolean;
}
export interface AssistantCapture {
  /** Finalize: segments closed by this call still deliver their final before it resolves. */
  close(): Promise<void>;
  /** Discard: no further segment results are delivered. */
  cancel(): void | Promise<void>;
}
export interface AssistantListenHandlers {
  signal: AbortSignal;
  onSpeechStart(atMs: number): void;
  onSpeechEnd(atMs: number): void;
  /** One result per closed segment, in order; null when the segment produced no transcript. */
  onSegment(text: string | null): void;
  /** The capture ended by itself (microphone lost, transport failure). */
  onEnd(error?: unknown): void;
  /** Microphone level in [0, 1], display only. */
  onLevel?(peak: number): void;
}
export interface AssistantPorts {
  readonly conversationId: string;
  /** Throws when the owner, account, agent session, view or draft binding changed. */
  assertCurrent(): void;
  listen(handlers: AssistantListenHandlers): Promise<AssistantCapture>;
  /** A new utterance began: the host pins the context the turn will be sent with. Throws when stale. */
  beginUtterance?(): void;
  /** Semantic end-of-turn (Clef). Omitted: the VAD long-gap fallback decides alone. */
  endpoint?(text: string, signal: AbortSignal): Promise<EndpointDecision>;
  /** Disfluency and self-echo gate for one segment (upstream shouldRespondToVoiceTurn). */
  shouldRespond?(text: string, context: { recentAgentReply: string; replyAgeMs: number; agentSpeaking: boolean }): boolean;
  /** Turn signal metadata for the agent (upstream buildVoiceTurnSignal). */
  turnSignal?(text: string): unknown;
  send(input: { turnId: string; text: string; voiceTurnSignal: unknown; signal: AbortSignal }): Promise<AssistantReply>;
  /** Text the speaker can say ('' to stay silent). */
  speakable?(text: string): string;
  /** Plays one sentence; settles after its playback ended (or rejects when aborted/failed). */
  speak(input: { turnId: string; replyId: string; text: string; signal: AbortSignal; onStarted: () => void }): Promise<void>;
  onHeard?(heard: AssistantHeard): void;
  onState?(state: AssistantState): void;
  /** Microphone level in [0, 1], display only. */
  onLevel?(peak: number): void;
  /** Diagnostics hooks: numbers and ids only. */
  onTurn?(event: 'submitted' | 'first-audio' | 'finished' | 'interrupted', turnId: string): void;
}
export interface AssistantTiming {
  shortGapMs: number;
  longGapMs: number;
  endpointDeadlineMs: number;
}
/**
 * Engineering defaults from docs/local-speech-research-2026-10-12.md, not accepted measurements or
 * owner-set constants. Gaps follow the VAD speech-end, which itself trails the last voiced window
 * by the native gate's hangover (LiveVadGate, about 512 ms).
 */
export const ASSISTANT_TIMING_DEFAULTS: AssistantTiming = Object.freeze({ shortGapMs: 300, longGapMs: 1200, endpointDeadlineMs: 250 });
export interface AssistantClock {
  now(): number;
  setTimer(callback: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}
const systemClock: AssistantClock = {
  now: () => Date.now(),
  setTimer: (callback, ms) => setTimeout(callback, ms),
  clearTimer: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class VoiceAssistantError extends Error {
  readonly code: 'binding' | 'capture' | 'reply' | 'speech';
  constructor(code: 'binding' | 'capture' | 'reply' | 'speech', message: string) { super(message); this.code = code; this.name = 'VoiceAssistantError'; }
}
const stopped = () => new DOMException('Voice assistant stopped', 'AbortError');

/**
 * Split a reply into sentence-sized pieces for playback accounting. Joining the pieces with
 * single spaces gives the whitespace-collapsed reply back.
 */
export function splitSpokenSentences(text: string): string[] {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return [];
  const out: string[] = [];
  let rest = value;
  while (rest) {
    let boundary = -1;
    for (const match of rest.matchAll(/[.!?;:]["')\]]?\s/g)) {
      // Short fragments (initials, "Dr.") stay with the next words.
      if (match.index! + match[0].length - 1 >= 20) { boundary = match.index! + match[0].length - 1; break; }
    }
    if (boundary < 0) { out.push(rest); break; }
    out.push(rest.slice(0, boundary).trim());
    rest = rest.slice(boundary).trim();
  }
  return out.filter(Boolean);
}

type Segment = { closed: boolean; done: boolean; text: string };
type Response = {
  turnId: string;
  controller: AbortController;
  replyId?: string;
  sentences: string[];
  played: number;
  started: boolean;
  /** Echo context for segments that started during this reply's playback. */
  spoken: string;
};

/** One voice assistant conversation. Owned by the chat shell; stopped on any binding change. */
export class VoiceAssistantSession {
  private readonly timing: AssistantTiming;
  private readonly clock: AssistantClock;
  private session = 0;
  private turn = 0;
  private utteranceEpoch = 0;
  private active = false;
  private controller?: AbortController;
  private capture?: AssistantCapture;
  private opening?: Promise<AssistantCapture | undefined>;
  private segments: Segment[] = [];
  private lastSpeechEndAt = 0;
  private shortTimer: unknown;
  private longTimer: unknown;
  private endpointController?: AbortController;
  private response?: Response;
  private inflight: Promise<unknown> = Promise.resolve();
  private speech = new Set<Promise<unknown>>();
  private lastSpoken = { text: '', at: Number.NEGATIVE_INFINITY };
  private awaiting?: { pause: AssistantAwaitingInput; resolve: (reply: AssistantReply) => void; resolved: boolean };
  private state: AssistantState = { phase: 'idle' };
  private mutedValue = false;

  private readonly ports: AssistantPorts;
  constructor(ports: AssistantPorts, options: { timing?: Partial<AssistantTiming>; clock?: AssistantClock } = {}) {
    this.ports = ports;
    const timing = { ...ASSISTANT_TIMING_DEFAULTS, ...options.timing };
    for (const value of Object.values(timing)) if (!Number.isFinite(value) || value < 0) throw new RangeError('Invalid voice assistant timing');
    if (timing.longGapMs < timing.shortGapMs) throw new RangeError('The long gap must not be shorter than the short gap');
    this.timing = timing;
    this.clock = options.clock ?? systemClock;
    if (!ports.conversationId?.trim()) throw new VoiceAssistantError('binding', 'A current conversation is required.');
  }

  get muted() { return this.mutedValue; }
  getSnapshot(): AssistantState { return { ...this.state, ...(this.state.awaitingUserInput ? { awaitingUserInput: { ...this.state.awaitingUserInput } } : {}) }; }

  private publish(state: AssistantState) {
    this.state = { ...state, ...(this.mutedValue ? { muted: true } : {}) };
    this.ports.onState?.(this.getSnapshot());
  }
  private listeningState(): AssistantState {
    const open = this.segments.some(segment => !segment.closed);
    const text = this.utteranceText();
    return { phase: 'listening', ...(open ? { hearing: true } : {}), ...(text ? { pendingText: text } : {}) };
  }
  private current(session: number) { return this.active && this.session === session; }
  private check(session: number) {
    if (!this.current(session)) throw stopped();
    this.ports.assertCurrent();
  }

  async start(): Promise<void> {
    if (this.active) return;
    this.ports.assertCurrent();
    this.active = true;
    const session = ++this.session;
    this.controller = new AbortController();
    this.publish({ phase: 'starting' });
    try {
      await this.open(session);
      this.check(session);
      this.publish(this.listeningState());
    } catch (error) {
      if (this.current(session)) await this.fail(session, error);
      throw error;
    }
  }

  /** Called on host lifecycle/account changes: a changed binding stops the conversation. */
  recheck() {
    if (!this.active) return;
    try { this.ports.assertCurrent(); } catch { void this.stop(); }
  }

  async stop(): Promise<void> {
    if (!this.active) { await this.drainSpeech(); return; }
    this.active = false;
    ++this.session; ++this.turn; ++this.utteranceEpoch;
    this.controller?.abort(stopped());
    this.clearTimers();
    this.endpointController?.abort();
    const response = this.response;
    this.response = undefined;
    if (response) { response.controller.abort(stopped()); this.reportInterrupted(response); }
    this.awaiting = undefined;
    this.segments = [];
    const capture = this.capture, opening = this.opening;
    this.capture = undefined; this.opening = undefined;
    this.publish({ phase: 'idle' });
    // Discard: an utterance that was not submitted is not sent after Stop.
    await Promise.all([
      Promise.resolve(capture?.cancel()).catch(() => {}),
      opening?.then(late => late?.cancel()).catch(() => {}),
      this.drainSpeech(),
    ]);
  }

  /** Microphone off/on. Muting finalizes speech up to now; the reply in progress continues. */
  async setMuted(muted: boolean): Promise<void> {
    if (!this.active || muted === this.mutedValue) return;
    const session = this.session;
    this.mutedValue = muted;
    if (muted) {
      const capture = this.capture;
      this.capture = undefined;
      this.publish(this.response ? { ...this.state } : this.listeningState());
      await capture?.close();
      if (this.current(session)) this.schedule();
      return;
    }
    if (this.state.phase === 'awaiting-user-input') { this.publish({ ...this.state }); return; }
    try { await this.open(session); this.check(session); this.publish(this.response ? { ...this.state } : this.listeningState()); }
    catch (error) { if (this.current(session)) await this.fail(session, error); }
  }

  /** Stop speaking now (the accessible counterpart of barge-in). Returns true when a reply was cut. */
  interruptSpeech(): boolean {
    const response = this.response;
    if (!this.active || !response?.started) return false;
    this.interrupt();
    this.publish(this.listeningState());
    return true;
  }

  /** Deliver the separately approved result of the paused turn. No send or approval happens here. */
  resume(input: { pause: AssistantAwaitingInput; reply: AssistantReply }): boolean {
    const held = this.awaiting;
    if (!this.active || !held || held.resolved || !input || typeof input !== 'object') return false;
    try { this.ports.assertCurrent(); } catch { this.recheck(); return false; }
    const { pause, reply } = input, original = held.pause;
    if (!pause || !reply
      || pause.proposalId !== original.proposalId || pause.digest !== original.digest || pause.requestId !== original.requestId
      || pause.conversationId !== original.conversationId || pause.userMessageId !== original.userMessageId || pause.assistantMessageId !== original.assistantMessageId
      || reply.requestId !== original.requestId || reply.conversationId !== original.conversationId || reply.userMessageId !== original.userMessageId
      || typeof reply.assistantMessageId !== 'string' || !reply.assistantMessageId.trim() || reply.assistantMessageId === original.assistantMessageId
      || reply.complete !== true || reply.interrupted || reply.awaitingUserInput !== undefined || typeof reply.text !== 'string') return false;
    held.resolved = true;
    held.resolve({ requestId: reply.requestId, conversationId: reply.conversationId, userMessageId: reply.userMessageId, assistantMessageId: reply.assistantMessageId, text: reply.text, complete: true });
    return true;
  }

  private async open(session: number) {
    if (this.capture || this.opening) return;
    this.check(session);
    const signal = this.controller!.signal;
    const pending = this.ports.listen({
      signal,
      onSpeechStart: at => { if (this.current(session) && !this.mutedValue) this.speechStarted(at); },
      onSpeechEnd: at => { if (this.current(session)) this.speechEnded(at); },
      onSegment: text => { if (this.current(session)) this.segmentResult(text); },
      onEnd: error => { if (this.current(session)) void this.captureEnded(session, error); },
      onLevel: peak => { if (this.current(session)) this.ports.onLevel?.(peak); },
    }).then(capture => {
      if (this.opening !== pending || !this.current(session)) { void Promise.resolve(capture.cancel()).catch(() => {}); return undefined; }
      this.opening = undefined; this.capture = capture; return capture;
    }, error => { if (this.opening === pending) this.opening = undefined; throw error; });
    this.opening = pending;
    await pending;
  }

  private async captureEnded(session: number, error?: unknown) {
    this.capture = undefined;
    if (this.mutedValue) return;
    await this.fail(session, error ?? new VoiceAssistantError('capture', 'The microphone stopped.'));
  }

  private async fail(session: number, error: unknown) {
    if (!this.current(session)) return;
    await this.stop();
    if (this.session === session + 1) this.publish({ phase: 'error', error });
  }

  // --- Endpointing --------------------------------------------------------------------------

  private utteranceText() { return this.segments.filter(segment => segment.done && segment.text).map(segment => segment.text).join(' ').trim(); }
  private clearTimers() {
    if (this.shortTimer !== undefined) this.clock.clearTimer(this.shortTimer);
    if (this.longTimer !== undefined) this.clock.clearTimer(this.longTimer);
    this.shortTimer = this.longTimer = undefined;
  }

  private speechStarted(_at: number) {
    // Speech always wins over a racing timer or endpoint decision.
    ++this.utteranceEpoch;
    this.clearTimers();
    this.endpointController?.abort();
    this.endpointController = undefined;
    if (this.response) this.interrupt();
    if (!this.segments.length && this.ports.beginUtterance) {
      try { this.ports.beginUtterance(); } catch { void this.stop(); return; }
    }
    this.segments.push({ closed: false, done: false, text: '' });
    this.publish(this.listeningState());
  }

  private speechEnded(at: number) {
    const open = this.segments.find(segment => !segment.closed);
    if (!open) return;
    open.closed = true;
    this.lastSpeechEndAt = Number.isFinite(at) ? Math.min(at, this.clock.now()) : this.clock.now();
    this.publish(this.listeningState());
    this.schedule();
  }

  private segmentResult(text: string | null) {
    const segment = this.segments.find(item => item.closed && !item.done);
    if (!segment) return; // A result for a discarded utterance.
    segment.done = true;
    const value = typeof text === 'string' ? text.trim() : '';
    if (value) {
      const echo = this.response?.started ? this.response.spoken : this.lastSpoken.text;
      const context = { recentAgentReply: echo, replyAgeMs: this.response?.started ? 0 : Math.max(0, this.clock.now() - this.lastSpoken.at), agentSpeaking: !!this.response?.started };
      if (!this.ports.shouldRespond || this.ports.shouldRespond(value, context)) segment.text = value;
    }
    this.publish(this.response ? { ...this.state } : this.listeningState());
    this.schedule();
  }

  private schedule() {
    if (!this.active || this.response) return;
    if (this.segments.some(segment => !segment.closed || !segment.done)) return;
    const text = this.utteranceText();
    if (!text) { this.segments = []; this.publish(this.listeningState()); return; }
    this.clearTimers();
    const epoch = this.utteranceEpoch, session = this.session;
    const elapsed = Math.max(0, this.clock.now() - this.lastSpeechEndAt);
    const owns = () => this.current(session) && this.utteranceEpoch === epoch && !this.response;
    if (this.ports.endpoint) this.shortTimer = this.clock.setTimer(() => {
      this.shortTimer = undefined;
      if (!owns()) return;
      const controller = new AbortController();
      this.endpointController = controller;
      let deadline: unknown;
      const expired = new Promise<EndpointDecision>(resolve => { deadline = this.clock.setTimer(() => resolve('continue'), this.timing.endpointDeadlineMs); });
      // A slow, failing or absent decision never blocks: the long gap still submits.
      void Promise.race([Promise.resolve().then(() => this.ports.endpoint!(text, controller.signal)).catch((): EndpointDecision => 'continue'), expired]).then(decision => {
        this.clock.clearTimer(deadline);
        if (this.endpointController === controller) this.endpointController = undefined;
        controller.abort();
        if (decision === 'finished' && owns()) this.submit(session);
      });
    }, Math.max(0, this.timing.shortGapMs - elapsed));
    this.longTimer = this.clock.setTimer(() => { this.longTimer = undefined; if (owns()) this.submit(session); }, Math.max(0, this.timing.longGapMs - elapsed));
  }

  // --- Turns --------------------------------------------------------------------------------

  private submit(session: number) {
    if (!this.current(session) || this.response) return;
    const text = this.utteranceText();
    this.clearTimers();
    this.endpointController?.abort();
    this.segments = [];
    ++this.utteranceEpoch;
    if (!text) return;
    const turn = ++this.turn;
    const response: Response = { turnId: crypto.randomUUID(), controller: new AbortController(), sentences: [], played: 0, started: false, spoken: '' };
    this.response = response;
    this.publish({ phase: 'thinking', transcript: text });
    this.ports.onTurn?.('submitted', response.turnId);
    const previous = this.inflight;
    const run = this.respond(session, turn, response, text, previous);
    this.inflight = run.catch(() => {});
  }

  private owned(session: number, turn: number, response: Response) {
    return this.current(session) && this.turn === turn && this.response === response && !response.controller.signal.aborted;
  }

  private async respond(session: number, turn: number, response: Response, text: string, previous: Promise<unknown>) {
    const guard = () => { if (!this.owned(session, turn, response)) throw stopped(); this.ports.assertCurrent(); };
    try {
      // One request at a time: an interrupted request settles before the next turn is sent.
      await previous;
      guard();
      let reply = await this.ports.send({ turnId: response.turnId, text, voiceTurnSignal: this.ports.turnSignal?.(text), signal: response.controller.signal });
      guard();
      if (!reply || reply.requestId !== response.turnId || reply.conversationId !== this.ports.conversationId || !reply.userMessageId?.trim() || !reply.assistantMessageId?.trim() || reply.interrupted || typeof reply.text !== 'string')
        throw new VoiceAssistantError('reply', 'The voice reply was not confirmed for this turn.');
      if (reply.awaitingUserInput !== undefined) {
        const { proposalId, digest } = reply.awaitingUserInput ?? {} as { proposalId?: unknown; digest?: unknown };
        if (reply.complete !== false || typeof proposalId !== 'string' || !proposalId.trim() || typeof digest !== 'string' || !digest.trim())
          throw new VoiceAssistantError('reply', 'The owner-input pause was not confirmed for this turn.');
        const pause: AssistantAwaitingInput = { proposalId, digest, requestId: response.turnId, conversationId: this.ports.conversationId, userMessageId: reply.userMessageId, assistantMessageId: reply.assistantMessageId };
        // The microphone is off while the owner reviews; nothing heard meanwhile is sent.
        const capture = this.capture; this.capture = undefined;
        await Promise.resolve(capture?.cancel()).catch(() => {});
        this.segments = [];
        guard();
        reply = await new Promise<AssistantReply>((resolve, reject) => {
          this.awaiting = { pause, resolve, resolved: false };
          response.controller.signal.addEventListener('abort', () => reject(stopped()), { once: true });
          this.publish({ phase: 'awaiting-user-input', transcript: text, replyId: reply.assistantMessageId, awaitingUserInput: { ...pause } });
        });
        this.awaiting = undefined;
        guard();
        if (!this.mutedValue) await this.open(session);
        guard();
      }
      // Proposals need explicit review in the conversation: voice never approves them.
      if (reply.complete !== true) throw new VoiceAssistantError('reply', 'The voice reply was not confirmed for this turn.');
      response.replyId = reply.assistantMessageId;
      const spoken = this.ports.speakable ? this.ports.speakable(reply.text) : reply.text;
      response.sentences = splitSpokenSentences(spoken);
      if (!response.sentences.length) { this.finishResponse(response); return; }
      for (const sentence of response.sentences) {
        guard();
        const playback = this.ports.speak({
          turnId: response.turnId, replyId: reply.assistantMessageId, text: sentence, signal: response.controller.signal,
          onStarted: () => {
            if (!this.owned(session, turn, response)) return;
            response.spoken = sentence;
            if (response.started) return;
            response.started = true;
            this.ports.onTurn?.('first-audio', response.turnId);
            this.publish({ phase: 'speaking', replyId: reply.assistantMessageId });
          },
        });
        this.speech.add(playback);
        void playback.catch(() => {}).finally(() => this.speech.delete(playback));
        await playback;
        guard();
        response.played++;
      }
      this.lastSpoken = { text: response.sentences.join(' '), at: this.clock.now() };
      this.ports.onHeard?.({ turnId: response.turnId, replyId: reply.assistantMessageId, heard: response.sentences.join(' '), unheard: '', interrupted: false });
      this.finishResponse(response);
    } catch (error) {
      if (!this.owned(session, turn, response)) return; // Interrupted or stopped: already accounted.
      if ((error as { name?: unknown })?.name === 'AbortError') return;
      if (response.replyId) this.reportInterrupted(response);
      this.response = undefined;
      await this.fail(session, error);
    }
  }

  private finishResponse(response: Response) {
    if (this.response !== response) return;
    this.response = undefined;
    this.ports.onTurn?.('finished', response.turnId);
    this.publish(this.listeningState());
    // Speech that arrived while the reply played becomes the next turn.
    this.schedule();
  }

  /** Barge-in: abort the reply in flight and keep only what was played. */
  private interrupt() {
    const response = this.response;
    if (!response) return;
    ++this.turn;
    this.response = undefined;
    response.controller.abort(new DOMException('Voice reply interrupted', 'AbortError'));
    if (response.started) this.lastSpoken = { text: response.spoken, at: this.clock.now() };
    this.reportInterrupted(response);
    this.ports.onTurn?.('interrupted', response.turnId);
  }

  private reportInterrupted(response: Response) {
    if (!response.replyId) return;
    const heard = response.sentences.slice(0, response.played).join(' ');
    const unheard = response.sentences.slice(response.played).join(' ');
    this.ports.onHeard?.({ turnId: response.turnId, replyId: response.replyId, heard, unheard, interrupted: true });
  }

  private async drainSpeech() {
    await Promise.all([...this.speech].map(pending => pending.catch(() => {})));
  }
}
