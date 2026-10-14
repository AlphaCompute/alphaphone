import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { registerPlugin } from '../platform-plugins';
import { connectionController } from './connection-ui';
import { createLiveVoiceSession, LIVE_ASR_PATH, LIVE_ASR_STATUS_PATH, type LiveAudioFrame, type LiveFinal, type LiveVadEdge, type LiveVoiceLatency, type LiveVoiceTransport } from './live-voice';

/**
 * Android live voice: AlphaVoiceCloudPlugin captures 16 kHz mono PCM in the app process and runs
 * Silero VAD (libelizainference, the pinned ElizaVoiceNative bridge) on it; this module forwards
 * the frames and VAD edges to the resident agent's live ASR route (Phonon-2 streaming decode on
 * this device). One capture is one utterance of a voice conversation; the agent session lives for
 * the conversation. Interim text needs the agent's event stream, which the Android agent IPC does
 * not carry (docs/fused-speech.md, live voice), so on the phone the conversation shows the final
 * transcript only. Nothing here is stored or logged.
 */
type FramesEvent = { captureId?: unknown; frames?: unknown; vad?: unknown; peak?: unknown };
type EndedEvent = { captureId?: unknown; error?: unknown };
const plugin = registerPlugin<{
  liveCaptureStatus(): Promise<{ available?: unknown }>;
  startLiveCapture(input: { captureId: string }): Promise<{ captureId?: unknown; sampleRate?: unknown }>;
  stopLiveCapture(input: { captureId: string }): Promise<{ captureId?: unknown; durationMs?: unknown }>;
  addListener(event: 'liveCaptureFrames', callback: (event: FramesEvent) => void): Promise<PluginListenerHandle>;
  addListener(event: 'liveCaptureEnded', callback: (event: EndedEvent) => void): Promise<PluginListenerHandle>;
}>('AlphaVoiceCloud');

const frame = (value: unknown): value is LiveAudioFrame => {
  const row = value as Partial<LiveAudioFrame> | null;
  return !!row && typeof row.pcm16 === 'string' && row.pcm16.length <= 64 * 1024 && row.sampleRate === 16000 && row.channels === 1 && Number.isSafeInteger(row.samples) && (row.samples as number) > 0 && Number.isFinite(row.timestamp);
};
const edge = (value: unknown): value is LiveVadEdge => {
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

/** `heard` is false when the VAD never opened a segment: no final will come for it. */
export type LiveClip = { recordingId: string; durationMs: number; live: true; heard: boolean };

/**
 * A live voice conversation over the native capture. `capture` has the BatchVoiceConversation
 * capture shape; `transcribe` returns the agent's final transcript for that utterance.
 */
export function createNativeLiveConversation(input: { roomId?: string; onInterim?: (text: string) => void }) {
  const resident = connectionController.getResidentLiveVoice();
  if (!resident) throw Error('The on-device agent is not connected.');
  const transport: LiveVoiceTransport = { post: (body, signal) => resident.request(LIVE_ASR_PATH, body, signal) };
  type Heard = { final: LiveFinal; latency: LiveVoiceLatency } | null;
  const finals: Heard[] = [];
  const waiters: Array<(value: Heard) => void> = [];
  const settle = (value: Heard) => { const next = waiters.shift(); if (next) next(value); else finals.push(value); };
  // The capture whose closed segment the next final answers. A cancelled utterance's final (the
  // agent still finalizes its segment) answers nobody; requests are serialized, so it always
  // lands before a later utterance can close.
  let epoch = 0, expecting: number | undefined;
  const answer = (value: Heard) => { if (expecting === undefined) return; expecting = undefined; settle(value); };
  const session = createLiveVoiceSession({
    transport, ...(input.roomId ? { roomId: input.roomId } : {}),
    onInterim: text => input.onInterim?.(text),
    onFinal: (final, latency) => answer({ final, latency }),
    onError: () => answer(null),
  });
  const takeFinal = (signal: AbortSignal) => new Promise<Heard>((resolve, reject) => {
    if (finals.length) { resolve(finals.shift()!); return; }
    const done = (value: Heard) => { signal.removeEventListener('abort', abort); resolve(value); };
    const abort = () => { const index = waiters.indexOf(done); if (index >= 0) waiters.splice(index, 1); reject(signal.reason ?? new DOMException('Live voice cancelled', 'AbortError')); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    waiters.push(done);
  });

  async function capture(port: { signal: AbortSignal; onActivity: (metrics: { peak: number }) => void; onEnd: (error?: unknown) => void }) {
    port.signal.throwIfAborted();
    // Finals left from an earlier utterance never answer this one.
    finals.length = 0;
    const mine = ++epoch;
    const captureId = crypto.randomUUID();
    let open = true, spoke = false, ended = false, started = 0;
    const handles: PluginListenerHandle[] = [];
    const detach = async () => { open = false; await Promise.all(handles.splice(0).map(handle => handle.remove().catch(() => {}))); };
    handles.push(await plugin.addListener('liveCaptureFrames', event => {
      if (!open || event?.captureId !== captureId) return;
      const frames = Array.isArray(event.frames) ? event.frames.filter(frame) : [];
      const vad = Array.isArray(event.vad) ? event.vad.filter(edge) : [];
      const peak = typeof event.peak === 'number' && Number.isFinite(event.peak) ? Math.max(0, Math.min(1, event.peak)) : 0;
      port.onActivity({ peak });
      if (vad.some(row => row.type === 'speech-start')) spoke = true;
      const closes = spoke && !ended && vad.some(row => row.type === 'speech-end');
      if (closes) { ended = true; expecting = mine; }
      void session.push(frames, vad);
      if (closes) port.onEnd();
    }));
    handles.push(await plugin.addListener('liveCaptureEnded', event => {
      if (!open || event?.captureId !== captureId) return;
      open = false;
      port.onEnd(typeof event.error === 'string' ? Object.assign(Error('The microphone stopped.'), { code: 'capture' }) : undefined);
    }));
    try {
      port.signal.throwIfAborted();
      const result = await plugin.startLiveCapture({ captureId });
      if (result?.captureId !== captureId || result.sampleRate !== 16000) throw Error('Live capture identity changed.');
      started = Date.now();
    } catch (error) { await detach(); throw error; }
    const stopNative = async () => { try { await plugin.stopLiveCapture({ captureId }); } catch { /* Already stopped. */ } };
    return {
      async stop(): Promise<LiveClip> {
        await stopNative(); await detach();
        // The conversation ended the utterance before the VAD did: close the segment now.
        if (spoke && !ended) { ended = true; expecting = mine; await session.endTurn(); }
        return { recordingId: `live:${captureId}`, durationMs: Math.max(0, Date.now() - started), live: true, heard: spoke };
      },
      async cancel() {
        await stopNative(); await detach();
        // Close the agent's open segment; its final is not this conversation's message.
        if (spoke && !ended) { ended = true; if (expecting === mine) expecting = undefined; void session.endTurn(); }
        else if (expecting === mine && !finals.length && !waiters.length) expecting = undefined;
      },
    };
  }

  return {
    sessionId: session.sessionId,
    capture,
    /** The agent's final transcript for the utterance just captured ('' when none was heard) and its latency numbers. */
    async transcribe(clip: LiveClip, signal: AbortSignal): Promise<{ text: string; latency?: LiveVoiceLatency }> {
      if (!clip.heard) return { text: '' };
      const heard = await takeFinal(signal);
      if (!heard) throw Object.assign(Error('On-device transcription failed. Nothing was sent.'), { code: 'live-asr' });
      return { text: heard.final.text, latency: heard.latency };
    },
    close: () => session.close().catch(() => {}),
  };
}
