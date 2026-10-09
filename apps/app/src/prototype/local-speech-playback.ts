import { Capacitor } from '@capacitor/core';
import { planLocalSpeech } from '../runtime/local-speech-text';
import { speakLocalText } from '../local-speech-playback';
import { createOnDeviceVoice } from '../runtime/local-voice';
import { createCloudVoice, cloudVoiceFailure } from '../runtime/cloud-voice';
import { selectVoiceRoute, speakRepliesEnabled } from '../runtime/voice-selection';
import { markVoiceTiming, finishVoiceTurn, abandonVoiceTurn } from '../runtime/voice-timing';
import { connectionController } from '../runtime/connection-ui';

let cancelCurrent: (() => void) | undefined;
let cancelOwner: object | undefined;
/** Stops message Listen, a spoken reply and note read-aloud. */
export function stopLocalSpeechPlayback() { cancelCurrent?.(); cancelCurrent = undefined; cancelOwner = undefined; stopSpeaking(); }
type Shell = any;
type Reading = { id: string; text: string; controller?: AbortController; message: string; users: Set<string> };

const speechBinding = () => JSON.stringify([connectionController.getSnapshot().session?.sessionId, connectionController.getCloudClient()?.sessionId, document.documentElement.dataset.connectionMode]);
/**
 * The qualified local speech route (Android CPU engine, or this browser's local voice),
 * with an explicit start callback. Leaving the foreground, opening the connection chooser
 * or changing the selected agent or Cloud account cancels it.
 */
async function speakOnDevice(text: string, signal: AbortSignal, onStarted?: () => void) {
  const selected = speechBinding();
  const owned = new AbortController(), abort = () => owned.abort(signal.reason ?? new DOMException('Speech cancelled', 'AbortError'));
  const check = () => { if (document.hidden || connectionController.getSnapshot().open || speechBinding() !== selected) throw new DOMException('Speech cancelled', 'AbortError'); };
  const visibility = () => { if (document.hidden) owned.abort(new DOMException('Speech cancelled', 'AbortError')); };
  const unsubscribe = connectionController.subscribe(() => { try { check(); } catch (reason) { owned.abort(reason); } });
  signal.addEventListener('abort', abort, { once: true }); document.addEventListener('visibilitychange', visibility);
  try { if (signal.aborted) abort(); check(); await speakLocalText(text, owned.signal, onStarted, false, { execution: Capacitor.isNativePlatform() ? 'device' : 'browser', assertCurrent: check }); check(); }
  finally { unsubscribe(); signal.removeEventListener('abort', abort); document.removeEventListener('visibilitychange', visibility); }
}

/* ---- Note read-aloud ---- */
type NoteReading = { noteId?: string; text: string; controller: AbortController; state: 'preparing' | 'reading' };
let noteReading: NoteReading | undefined;
const noteReadingChanged = () => { try { window.dispatchEvent(new Event('alpha:note-reading')); } catch { /* No renderer. */ } };
/** The note being read aloud, if any. Text is the exact passage being read. */
export function currentNoteReading() { return noteReading ? { noteId: noteReading.noteId, text: noteReading.text, state: noteReading.state } : null; }
/** Stop note read-aloud. Safe to call at any time. */
export function stopSpeaking() {
  const active = noteReading; if (!active) return;
  noteReading = undefined; active.controller.abort(new DOMException('Speech cancelled', 'AbortError')); noteReadingChanged();
}
/**
 * Read note text aloud on the qualified local speech route only: nothing is uploaded and
 * no Cloud or agent voice is used. Leaving the note or editing it cancels the reading
 * (the Notes adapter calls stopSpeaking). Resolves with the outcome; never throws.
 */
export function speakNote(text: string, owner: { noteId?: string } = {}) { return readNote(text, owner); }
async function readNote(text: string, owner: { noteId?: string }): Promise<'finished' | 'stopped' | 'unavailable' | 'unsupported' | 'failed'> {
  stopLocalSpeechPlayback();
  const passage = typeof text === 'string' ? text.trim() : '';
  if (!passage || passage.length > 16000) return 'unsupported';
  // Native local speech admits only supported English text; refuse before any audio.
  if (Capacitor.isNativePlatform()) { try { planLocalSpeech(passage); } catch { return 'unsupported'; } }
  const voice = createOnDeviceVoice(); if (!voice) return 'unavailable';
  const reading: NoteReading = { noteId: owner.noteId, text: passage, controller: new AbortController(), state: 'preparing' };
  noteReading = reading; noteReadingChanged();
  const signal = reading.controller.signal;
  try {
    if (!await voice.ready(signal)) { if (noteReading === reading) { noteReading = undefined; noteReadingChanged(); } return 'unavailable'; }
    if (noteReading !== reading || signal.aborted) return 'stopped';
    await speakOnDevice(passage, signal, () => { if (noteReading === reading) { reading.state = 'reading'; noteReadingChanged(); } });
    return noteReading === reading && !signal.aborted ? 'finished' : 'stopped';
  } catch { return noteReading !== reading || signal.aborted ? 'stopped' : 'failed'; }
  finally { if (noteReading === reading) { noteReading = undefined; noteReadingChanged(); } }
}

/* ---- Spoken replies to voice-originated turns ---- */
type VoiceTurn = { draft: string; known: Set<string>; binding: string; userId?: string; sentAt?: number; firstToken?: boolean };
let voiceTurn: VoiceTurn | undefined;
const conversationBinding = () => JSON.stringify([connectionController.getSnapshot().session?.sessionId, connectionController.getSnapshot().history?.conversationId, connectionController.getCloudClient()?.sessionId]);
/**
 * The reviewed transcript was placed in the composer. If the user sends exactly that text,
 * the turn is voice-originated: its reply can be spoken (opt-in) and its timing recorded.
 */
export function noteVoiceDraft(text: string, messages: { id?: unknown }[] = []) {
  const draft = String(text || '').trim();
  voiceTurn = draft ? { draft, known: new Set(messages.map(m => String(m.id))), binding: conversationBinding() } : undefined;
}
/** A reply older than this, or for an earlier turn, is stale and is never spoken. */
const replyDeadlineMs = 5 * 60 * 1000;

/** Adds an explicit, cancellable Listen action using the current speech route. */
export function installLocalSpeechPlayback(Component: Shell) {
  const p = Component.prototype, original = p.renderVals, update = p.componentDidUpdate, unmount = p.componentWillUnmount;
  const states = new WeakMap<object, Reading>();
  const refresh = (shell: Shell) => { if (shell.live !== false) shell.setState({ localSpeechRevision: Date.now() }); };
  const stop = (shell: Shell) => { const old = states.get(shell); old?.controller?.abort(); states.delete(shell); if (cancelOwner === shell) { cancelCurrent = undefined; cancelOwner = undefined; } };
  async function listen(shell: Shell, id: string, text: string, onStarted?: () => void) {
    const old = states.get(shell);
    if (old?.id === id && old.controller) { stop(shell); refresh(shell); return; }
    stopLocalSpeechPlayback(); stop(shell);
    const cloud = selectVoiceRoute() === 'cloud';
    const voice = cloud ? createCloudVoice() : createOnDeviceVoice(); if (!voice) return;
    // User messages already present; only a user message sent after this reading began stops it.
    const users = new Set<string>((shell.S().msgs || []).filter((m: Shell) => m.from === 'user').map((m: Shell) => String(m.id)));
    const controller = new AbortController(), state: Reading = { id, text, controller, users, message: cloud ? 'Preparing Cloud voice using your account credits.' : 'Preparing speech on this phone. Nothing is uploaded.' };
    states.set(shell, state); cancelOwner = shell; cancelCurrent = () => { stop(shell); refresh(shell); }; refresh(shell);
    try {
      if ('ready' in voice) {
        planLocalSpeech(text);
        if (!await voice.ready(controller.signal)) throw new Error('On-device speech models are unavailable. The written message is still available.');
      }
      if (controller.signal.aborted || states.get(shell) !== state) return;
      state.message = cloud ? 'Reading with Cloud voice.' : 'Reading the complete message on this phone. Unfamiliar names are spelled; digits are read individually.'; refresh(shell);
      if (cloud) await voice.speak(text, controller.signal);
      else await speakOnDevice(text, controller.signal, onStarted);
      if (states.get(shell) === state) { state.controller = undefined; state.message = cloud ? 'Finished reading with Cloud voice.' : 'Finished reading on this phone.'; refresh(shell); }
    } catch (error) {
      if (states.get(shell) !== state) return;
      state.controller = undefined;
      const recovery = cloud ? cloudVoiceFailure(error) : null;
      state.message = controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError') ? 'Reading stopped.' : recovery || (error instanceof Error ? error.message + ' The complete message may not have been read.' : 'Reading stopped before completion. The written message is still available.');
      refresh(shell);
    }
  }
  /** Observe the conversation for the voice-originated turn: send, first token, final reply. */
  function followVoiceTurn(shell: Shell) {
    const turn = voiceTurn; if (!turn) return;
    const msgs: Shell[] = shell.S().msgs || [];
    if (turn.binding !== conversationBinding()) { voiceTurn = undefined; abandonVoiceTurn(); return; }
    if (!turn.userId) {
      const sent = msgs.filter(m => m.from === 'user' && !turn.known.has(String(m.id)));
      if (!sent.length) return;
      // Only an unchanged reviewed transcript makes the turn voice-originated.
      if (sent.length !== 1 || String(sent[0].text || '').trim() !== turn.draft || typeof sent[0].id !== 'string') { voiceTurn = undefined; abandonVoiceTurn(); return; }
      turn.userId = sent[0].id; turn.sentAt = Date.now(); markVoiceTiming('send');
    }
    const at = msgs.findIndex(m => m.id === turn.userId);
    if (at < 0) { voiceTurn = undefined; abandonVoiceTurn(); return; }
    const later = msgs.slice(at + 1);
    // A newer user message makes any reply to this turn stale.
    if (later.some(m => m.from === 'user')) { voiceTurn = undefined; abandonVoiceTurn(); return; }
    const reply = later.find(m => m.from === 'agent');
    if (!reply) return;
    if (!turn.firstToken) { turn.firstToken = true; markVoiceTiming('first-token'); }
    if (reply.streaming) return;
    voiceTurn = undefined;
    if (reply.interrupted || typeof reply.id !== 'string' || typeof reply.text !== 'string' || !reply.text.trim()) { abandonVoiceTurn(); return; }
    markVoiceTiming('final-reply');
    const fresh = Date.now() - (turn.sentAt || 0) <= replyDeadlineMs && ['sheet', 'full'].includes(shell.S().chat) && !document.hidden && shell.live !== false;
    if (!speakRepliesEnabled() || !fresh) { finishVoiceTurn(); return; }
    void listen(shell, reply.id, reply.text, () => { markVoiceTiming('first-audio'); });
  }
  p.renderVals = function () {
    const out = original.call(this), source = [...(this.S().msgs || [])].reverse(), state = states.get(this);
    const cloud = selectVoiceRoute() === 'cloud';
    const available = cloud || createOnDeviceVoice() !== null;
    out.msgs = (out.msgs || []).map((message: Shell, index: number) => {
      const entry = source[index];
      if (!available || !entry || entry.streaming || entry.interrupted || entry.from !== 'agent' || entry.text !== message.text || typeof entry.id !== 'string') return message;
      const selected = state?.id === entry.id;
      return { ...message, localSpeechAvailable: true, localSpeechLabel: selected && state?.controller ? 'Stop reading' : cloud ? 'Listen with Cloud' : 'Listen on phone', localSpeechMessage: selected ? state?.message : '', localSpeechNotice: !!selected, localSpeech: () => { void listen(this, entry.id, entry.text); } };
    });
    return out;
  };
  p.componentDidUpdate = function (...args: unknown[]) {
    const state = states.get(this), value = this.S();
    if (state && (!['sheet', 'full'].includes(value.chat) || !(value.msgs || []).some((m: Shell) => m.id === state.id && m.text === state.text))) { stop(this); refresh(this); }
    // A user message sent after the reading began stops it; earlier messages never do.
    if (state?.controller && (value.msgs || []).some((m: Shell) => m.from === 'user' && !state.users.has(String(m.id)))) { stop(this); refresh(this); }
    followVoiceTurn(this);
    return update?.apply(this, args);
  };
  p.componentWillUnmount = function (...args: unknown[]) { stop(this); stopSpeaking(); voiceTurn = undefined; return unmount?.apply(this, args); };
}
