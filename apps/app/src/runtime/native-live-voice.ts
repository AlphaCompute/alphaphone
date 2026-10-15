import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { registerPlugin } from '../platform-plugins';
import { connectionController } from './connection-ui';
import { LIVE_ASR_PATH, LIVE_ASR_STATUS_PATH, type LiveAudioFrame, type LiveVadEdge, type LiveVoiceLatency, type LiveVoiceTransport } from './live-voice';
import { createLiveSegmentStream } from './live-segment-stream';
import type { AssistantCapture, AssistantListenHandlers } from './voice-assistant';

/**
 * Continuous native live capture (AlphaVoiceCloud: app-process microphone with Silero VAD) feeding
 * the resident agent's on-device streaming ASR. Two consumers:
 *
 *  - the voice assistant (voice-assistant.ts) keeps one capture open for the conversation, with
 *    platform echo cancellation so the user can interrupt a spoken reply;
 *  - live dictation (Transcribe) records until Stop and returns exactly the audio up to Stop.
 *
 * Only VAD segment audio leaves the app process, and only to the on-device agent of the owner who
 * started the capture: the transport refuses every request once the resident session changed.
 * Nothing is stored or logged. Interim partials appear only when the agent transport carries an
 * event stream; Android uses an ephemeral voice-only feed bound to the resident owner.
 */
type FramesEvent = { captureId?: unknown; frames?: unknown; vad?: unknown; peak?: unknown };
type EndedEvent = { captureId?: unknown; error?: unknown };
const plugin = registerPlugin<{
  liveCaptureStatus(): Promise<{ available?: unknown }>;
  startLiveCapture(input: { captureId: string; echoCancel?: boolean }): Promise<{ captureId?: unknown; sampleRate?: unknown; echoCancelled?: unknown }>;
  stopLiveCapture(input: { captureId: string }): Promise<{ captureId?: unknown; durationMs?: unknown }>;
  addListener(event: 'liveCaptureFrames', callback: (event: FramesEvent) => void): Promise<PluginListenerHandle>;
  addListener(event: 'liveCaptureEnded', callback: (event: EndedEvent) => void): Promise<PluginListenerHandle>;
}>('AlphaVoiceCloud');

const isFrame = (value: unknown): value is LiveAudioFrame => {
  const row = value as Partial<LiveAudioFrame> | null;
  return !!row && typeof row.pcm16 === 'string' && row.pcm16.length <= 64 * 1024 && row.sampleRate === 16000 && row.channels === 1 && Number.isSafeInteger(row.samples) && (row.samples as number) > 0 && Number.isFinite(row.timestamp);
};
const isEdge = (value: unknown): value is LiveVadEdge => {
  const row = value as Partial<LiveVadEdge> | null;
  return !!row && (row.type === 'speech-start' || row.type === 'speech-end') && Number.isFinite(row.timestampMs);
};

/** The live route is usable: the native capture with VAD is present and the agent reports a streaming loader. */
export async function nativeLiveVoiceReady(signal: AbortSignal): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('AlphaVoiceCloud')) return false;
  const resident = connectionController.getResidentLiveVoice();
  if (!resident) return false;
  try {
    const status = await plugin.liveCaptureStatus();
    signal.throwIfAborted();
    if (status?.available !== true) return false;
    const agent = await resident.request(LIVE_ASR_STATUS_PATH, undefined, signal) as { ready?: unknown } | null;
    signal.throwIfAborted();
    return agent?.ready === true;
  } catch (error) {
    if (signal.aborted) throw error;
    return false;
  }
}

/**
 * The live ASR transport of the current owner's resident agent, or null. Requests after the
 * resident session changed are refused, so audio never reaches another owner's agent. When the
 * resident connection exposes an agent event stream (`subscribe`), interim partials flow through it.
 */
export function residentLiveTransport(): LiveVoiceTransport | null {
  const resident = connectionController.getResidentLiveVoice();
  if (!resident) return null;
  const owner = resident.sessionId;
  const same = () => connectionController.getResidentLiveVoice()?.sessionId === owner;
  return {
    post: (body, signal) => same() ? resident.request(LIVE_ASR_PATH, body, signal) : Promise.reject(Object.assign(Error('The agent session changed.'), { status: 409 })),
    ...(typeof resident.subscribe === 'function' ? { subscribe: (listener: (envelope: unknown) => void) => resident.subscribe!(envelope => { if (same()) listener(envelope); }) } : {}),
  };
}

export type NativeLiveStream = Awaited<ReturnType<typeof openNativeLiveStream>>;
/** Opens one native capture and its agent live session. */
export async function openNativeLiveStream(input: {
  signal: AbortSignal;
  /** Platform echo cancellation for full-duplex use (the assistant listens while it speaks). */
  echoCancel: boolean;
  roomId?: string;
  onSpeechStart?(atMs: number): void;
  onSpeechEnd?(atMs: number): void;
  onSegment(text: string | null, latency?: LiveVoiceLatency): void;
  onInterim?(text: string): void;
  onLevel?(peak: number): void;
  /** The capture or the agent route failed or stopped without being asked to. */
  onLost(error: unknown): void;
}) {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('AlphaVoiceCloud')) throw Error('Live voice is unavailable.');
  input.signal.throwIfAborted();
  const transport = residentLiveTransport();
  if (!transport) throw Error('The on-device agent is not connected.');
  let accepting = true, stopping = false, lost = false;
  const lose = (error: unknown) => { if (stopping || lost) return; lost = true; input.onLost(error); };
  const stream = createLiveSegmentStream({
    transport, ...(input.roomId ? { roomId: input.roomId } : {}),
    onSpeechStart: at => input.onSpeechStart?.(at),
    onSpeechEnd: at => input.onSpeechEnd?.(at),
    onSegment: (text, latency) => input.onSegment(text, latency),
    onInterim: text => input.onInterim?.(text),
    onFatal: code => lose(Object.assign(Error('On-device transcription is unavailable.'), { code: 'live-asr', reason: code })),
  });
  const captureId = crypto.randomUUID();
  const handles: PluginListenerHandle[] = [];
  let ended!: () => void;
  const endedPromise = new Promise<void>(resolve => { ended = resolve; });
  const detach = () => Promise.all(handles.splice(0).map(handle => handle.remove().catch(() => {})));
  try {
  handles.push(await plugin.addListener('liveCaptureFrames', event => {
    if (!accepting || event?.captureId !== captureId) return;
    const frames = Array.isArray(event.frames) ? event.frames.filter(isFrame) : [];
    const vad = Array.isArray(event.vad) ? event.vad.filter(isEdge) : [];
    if (typeof event.peak === 'number' && Number.isFinite(event.peak)) input.onLevel?.(Math.max(0, Math.min(1, event.peak)));
    void stream.accept(frames, vad);
  }));
  handles.push(await plugin.addListener('liveCaptureEnded', event => {
    if (event?.captureId !== captureId) return;
    ended();
    if (!stopping) { accepting = false; lose(Object.assign(Error('The microphone stopped.'), { code: 'capture', ...(typeof event.error === 'string' ? { reason: event.error } : {}) })); }
  }));
  } catch (error) { stream.cancel(); await detach(); throw error; }
  let stopped: Promise<void> | undefined;
  const stopNative = () => stopped ??= (async () => {
    stopping = true;
    try { await plugin.stopLiveCapture({ captureId }); } catch { /* Already stopped. */ }
    // The native thread flushes its last frames before it reports the end (its stop waits up to 1.5 s).
    await Promise.race([endedPromise, new Promise(resolve => setTimeout(resolve, 2000))]);
    accepting = false;
    await detach();
  })();
  const abort = () => { stream.cancel(); void stopNative(); };
  let echoCancelled = false;
  try {
    input.signal.throwIfAborted();
    const result = await plugin.startLiveCapture({ captureId, echoCancel: input.echoCancel });
    if (result?.captureId !== captureId || result.sampleRate !== 16000) throw Error('Live capture identity changed.');
    echoCancelled = input.echoCancel && result.echoCancelled === true;
    input.signal.throwIfAborted();
  } catch (error) { stream.cancel(); await stopNative(); throw error; }
  input.signal.addEventListener('abort', abort, { once: true });
  const startedAt = Date.now();
  return {
    startedAt,
    /** The platform echo canceller is active on this capture. */
    echoCancelled,
    speaking: () => stream.speaking(),
    /** Stop now and finalize: results for audio up to this moment arrive before this resolves. */
    async close(at = Date.now()) {
      input.signal.removeEventListener('abort', abort);
      stream.cutoff(at);
      await stopNative();
      await stream.close();
      return { durationMs: Math.max(0, at - startedAt) };
    },
    /** Stop now and discard. */
    async cancel() {
      input.signal.removeEventListener('abort', abort);
      stream.cancel();
      await stopNative();
    },
  };
}

/** The voice assistant's listen port over the native capture (echo-cancelled, full duplex). */
export function nativeAssistantListener(options: { roomId?: string; onInterim?: (text: string) => void; onLatency?: (latency: LiveVoiceLatency) => void } = {}) {
  return async (handlers: AssistantListenHandlers): Promise<AssistantCapture> => {
    const capture = await openNativeLiveStream({
      signal: handlers.signal, echoCancel: true, ...(options.roomId ? { roomId: options.roomId } : {}),
      onSpeechStart: handlers.onSpeechStart, onSpeechEnd: handlers.onSpeechEnd,
      onSegment: (text, latency) => { if (latency) options.onLatency?.(latency); handlers.onSegment(text); },
      onInterim: text => options.onInterim?.(text),
      onLevel: peak => handlers.onLevel?.(peak),
      onLost: error => handlers.onEnd(error),
    });
    // Voice may interrupt playback only when the device cancels its own speaker from the microphone.
    return { fullDuplex: capture.echoCancelled, close: async () => { await capture.close(); }, cancel: () => capture.cancel() };
  };
}

type Clip = { recordingId: string; durationMs: number };
/**
 * Transcribe (dictation) over the native live capture, shaped like the recorder driver it replaces:
 * Stop finalizes exactly the audio up to Stop and the transcript is ready when Stop resolves.
 * Cancel discards everything. The text only ever becomes an editable draft; nothing is sent.
 */
export function createNativeLiveDictation(options: { roomId?: string; onInterim?: (text: string) => void; onLatency?: (latency: LiveVoiceLatency) => void; maxDurationMs?: number } = {}) {
  const maxDurationMs = Math.max(1000, Math.min(options.maxDurationMs ?? 300_000, 600_000));
  type Recording = { id: string; capture?: NativeLiveStream; controller: AbortController; texts: string[]; clip?: Clip; timer?: ReturnType<typeof setTimeout>; stopping?: Promise<Clip> };
  let recording: Recording | undefined;
  const listeners = new Set<(clip: Clip) => void>();
  const emit = (clip: Clip) => { for (const listener of [...listeners]) listener(clip); };
  const finish = (current: Recording, at?: number) => current.stopping ??= (async () => {
    if (current.timer) clearTimeout(current.timer);
    const result = await current.capture!.close(at);
    const clip = { recordingId: current.id, durationMs: result.durationMs };
    current.clip = clip;
    return clip;
  })();
  return {
    live: true as const,
    async startRecording(): Promise<{ recordingId: string; maxDurationMs: number }> {
      if (recording && !recording.clip) throw Error('A transcription is already recording.');
      const current: Recording = { id: `live:${crypto.randomUUID()}`, controller: new AbortController(), texts: [] };
      recording = current;
      const owned = () => recording === current;
      try {
        current.capture = await openNativeLiveStream({
          signal: current.controller.signal, echoCancel: false, ...(options.roomId ? { roomId: options.roomId } : {}),
          onSegment: (text, latency) => { if (!owned()) return; if (latency) options.onLatency?.(latency); if (text) current.texts.push(text); },
          onInterim: text => { if (owned()) options.onInterim?.(text); },
          onLost: () => {
            if (!owned() || current.stopping) return;
            if (current.timer) clearTimeout(current.timer);
            current.controller.abort();
            // A lost capture leaves nothing to stop or transcribe; Transcribe can start again.
            recording = undefined; current.texts.length = 0;
            emit({ recordingId: current.id, durationMs: Number.NaN });
          },
        });
      } catch (error) { if (owned()) recording = undefined; throw error; }
      if (!owned()) { await current.capture.cancel(); throw new DOMException('Transcription cancelled', 'AbortError'); }
      current.timer = setTimeout(() => { if (owned() && !current.stopping) void finish(current).then(emit, () => emit({ recordingId: current.id, durationMs: Number.NaN })); }, maxDurationMs);
      return { recordingId: current.id, maxDurationMs };
    },
    /** Stop at this moment. Audio captured after the tap is never transcribed. */
    async stopRecording(): Promise<Clip> {
      const current = recording, at = Date.now();
      if (!current?.capture) throw Error('No transcription is recording.');
      return finish(current, at);
    },
    /** The transcript of a stopped recording ('' is reported as no speech). */
    async transcribe(recordingId: string, signal: AbortSignal): Promise<{ text: string; local: true }> {
      signal.throwIfAborted();
      const current = recording;
      if (!current || current.id !== recordingId || !current.stopping) throw Error('This transcription is no longer available.');
      await current.stopping;
      signal.throwIfAborted();
      if (recording !== current) throw new DOMException('Transcription cancelled', 'AbortError');
      const text = current.texts.join(' ').replace(/\s+/g, ' ').trim();
      if (!text) throw Object.assign(Error('No speech was detected.'), { code: 'no-speech' });
      return { text, local: true };
    },
    async cancelRecording() {
      const current = recording;
      recording = undefined;
      if (!current) return;
      if (current.timer) clearTimeout(current.timer);
      current.controller.abort();
      current.texts.length = 0;
      await current.capture?.cancel();
    },
    async cancel(_input: { requestId: string }) { /* Transcription completes with Stop; nothing is pending. */ },
    async addListener(_event: 'recordingStopped', callback: (clip: Clip) => void): Promise<PluginListenerHandle> {
      listeners.add(callback);
      return { remove: async () => { listeners.delete(callback); } };
    },
  };
}
export type NativeLiveDictation = ReturnType<typeof createNativeLiveDictation>;
