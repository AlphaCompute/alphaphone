import { planLocalSpeech } from '../runtime/local-speech-text';
import { createOnDeviceVoice } from '../runtime/local-voice';
import { createCloudVoice, cloudVoiceFailure } from '../runtime/cloud-voice';
import { selectVoiceRoute } from '../runtime/voice-selection';

let cancelCurrent: (() => void) | undefined;
let cancelOwner: object | undefined;
export function stopLocalSpeechPlayback() { cancelCurrent?.(); cancelCurrent = undefined; cancelOwner = undefined; }
type Shell = any;
type Reading = { id: string; text: string; controller?: AbortController; message: string };
/** Adds an explicit, cancellable Listen action using the current speech route. */
export function installLocalSpeechPlayback(Component: Shell) {
  const p = Component.prototype, original = p.renderVals, update = p.componentDidUpdate, unmount = p.componentWillUnmount;
  const states = new WeakMap<object, Reading>();
  const refresh = (shell: Shell) => { if (shell.live !== false) shell.setState({ localSpeechRevision: Date.now() }); };
  const stop = (shell: Shell) => { const old = states.get(shell); old?.controller?.abort(); states.delete(shell); if (cancelOwner === shell) { cancelCurrent = undefined; cancelOwner = undefined; } };
  async function listen(shell: Shell, id: string, text: string) {
    const old = states.get(shell);
    if (old?.id === id && old.controller) { stop(shell); refresh(shell); return; }
    stopLocalSpeechPlayback(); stop(shell);
    const cloud = selectVoiceRoute() === 'cloud';
    const voice = cloud ? createCloudVoice() : createOnDeviceVoice(); if (!voice) return;
    const controller = new AbortController(), state: Reading = { id, text, controller, message: cloud ? 'Preparing Cloud voice using your account credits.' : 'Preparing speech on this phone. Nothing is uploaded.' };
    states.set(shell, state); cancelOwner = shell; cancelCurrent = () => { stop(shell); refresh(shell); }; refresh(shell);
    try {
      if ('ready' in voice) {
        planLocalSpeech(text);
        if (!await voice.ready(controller.signal)) throw new Error('On-device speech models are unavailable. The written message is still available.');
      }
      if (controller.signal.aborted || states.get(shell) !== state) return;
      state.message = cloud ? 'Reading with Cloud voice.' : 'Reading the complete message on this phone. Unfamiliar names are spelled; digits are read individually.'; refresh(shell);
      await voice.speak(text, controller.signal);
      if (states.get(shell) === state) { state.controller = undefined; state.message = cloud ? 'Finished reading with Cloud voice.' : 'Finished reading on this phone.'; refresh(shell); }
    } catch (error) {
      if (states.get(shell) !== state) return;
      state.controller = undefined;
      const recovery = cloud ? cloudVoiceFailure(error) : null;
      state.message = controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError') ? 'Reading stopped.' : recovery || (error instanceof Error ? error.message + ' The complete message may not have been read.' : 'Reading stopped before completion. The written message is still available.');
      refresh(shell);
    }
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
    return update?.apply(this, args);
  };
  p.componentWillUnmount = function (...args: unknown[]) { stop(this); return unmount?.apply(this, args); };
}
