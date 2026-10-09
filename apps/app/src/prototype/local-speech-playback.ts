import { connectionController } from '../runtime/connection-ui';
import { planLocalSpeech } from '../runtime/local-speech-text';
import { createOnDeviceVoice } from '../runtime/local-voice';
import { createCloudVoice, cloudVoiceFailure } from '../runtime/cloud-voice';
import { selectVoiceRoute } from '../runtime/voice-selection';

let cancelCurrent: (() => void) | undefined;
let cancelOwner: object | undefined;
export function stopLocalSpeechPlayback() { cancelCurrent?.(); cancelCurrent = undefined; cancelOwner = undefined; }
type Shell = any;
type Reading = { id: string; text: string; controller?: AbortController; message: string };
/** Message actions use the existing speech route; playback always requires a user gesture. */
export function installLocalSpeechPlayback(Component: Shell) {
  const p = Component.prototype, original = p.renderVals, mount = p.componentDidMount, update = p.componentDidUpdate, unmount = p.componentWillUnmount;
  const states = new WeakMap<object, Reading>();
  const menus = new WeakMap<object, { id: string; text: string; trigger?: HTMLElement; notice: string; focus: boolean; binding: string }>();
  const holds = new WeakMap<object, { timer: ReturnType<typeof setTimeout>; x: number; y: number }>();
  const listeners = new WeakMap<object, () => void>();
  const cancelHold = (shell: Shell) => { const hold = holds.get(shell); if (hold) clearTimeout(hold.timer); holds.delete(shell); };
  const closeMenu = (shell: Shell, focus = false) => { const menu = menus.get(shell); if (!menu) return; menus.delete(shell); if (focus) menu?.trigger?.focus(); refresh(shell); };
  function openMenu(shell: Shell, id: string, text: string, event: Event) {
    event.preventDefault(); event.stopPropagation();
    menus.set(shell, { id, text, trigger: event.currentTarget as HTMLElement, notice: '', focus: true, binding: JSON.stringify(connectionController.getSnapshot().session) }); refresh(shell);
  }
  function menuKey(shell: Shell, event: KeyboardEvent) {
    if (event.key === 'Tab') { closeMenu(shell, true); return; }
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(shell, true); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (at + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) + items.length) % items.length;
    items[next]?.focus();
  }
  const refresh = (shell: Shell) => { if (shell.live !== false) shell.setState({ localSpeechRevision: Date.now() }); };
  const stop = (shell: Shell) => { const old = states.get(shell); old?.controller?.abort(); states.delete(shell); if (cancelOwner === shell) { cancelCurrent = undefined; cancelOwner = undefined; } };
  async function listen(shell: Shell, id: string, text: string) {
    const old = states.get(shell);
    if (old?.id === id && old.controller) { stop(shell); refresh(shell); return; }
    stopLocalSpeechPlayback(); stop(shell);
    const cloud = selectVoiceRoute() === 'cloud';
    const voice = cloud ? createCloudVoice() : createOnDeviceVoice(); if (!voice) return;
    const controller = new AbortController(), state: Reading = { id, text, controller, message: cloud ? 'Preparing audio…' : 'Preparing audio on this phone…' };
    states.set(shell, state); cancelOwner = shell; cancelCurrent = () => { stop(shell); refresh(shell); }; refresh(shell);
    try {
      if ('ready' in voice) {
        planLocalSpeech(text);
        if (!await voice.ready(controller.signal)) throw new Error('On-device speech models are unavailable. The written message is still available.');
      }
      if (controller.signal.aborted || states.get(shell) !== state) return;
      state.message = 'Reading aloud…'; refresh(shell);
      await voice.speak(text, controller.signal);
      if (states.get(shell) === state) { state.controller = undefined; state.message = 'Finished reading.'; refresh(shell); }
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
      if (!entry || entry.streaming || entry.interrupted || !entry.text || entry.text !== message.text || typeof entry.id !== 'string') return message;
      const selected = state?.id === entry.id;
      const menu = menus.get(this), opened = menu?.id === entry.id;
      return { ...message, messageActionsOpen: opened, messageActionsRole: 'button', messageActionsTabIndex: 0, messageActionsLabel: 'Message actions: ' + entry.text, messageActionsPopup: 'menu',
        openMessageActions: (event: MouseEvent) => { if (!window.getSelection()?.toString()) openMenu(this, entry.id, entry.text, event); },
        messageActionsKey: (event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') openMenu(this, entry.id, entry.text, event); },
        messageActionsContext: (event: MouseEvent) => openMenu(this, entry.id, entry.text, event),
        messageActionsDown: (event: PointerEvent) => {
          if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
          cancelHold(this); const target = event.currentTarget as HTMLElement, binding = JSON.stringify(connectionController.getSnapshot().session);
          holds.set(this, { x: event.clientX, y: event.clientY, timer: setTimeout(() => {
            holds.delete(this); if (this.live === false || binding !== JSON.stringify(connectionController.getSnapshot().session) || !['sheet', 'full'].includes(this.S().chat) || !this.S().msgs?.some((m: Shell) => m.id === entry.id && m.text === entry.text)) return; menus.set(this, { id: entry.id, text: entry.text, trigger: target, notice: '', focus: true, binding: JSON.stringify(connectionController.getSnapshot().session) }); refresh(this);
          }, 500) });
        },
        messageActionsMove: (event: PointerEvent) => { const hold = holds.get(this); if (hold && Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > 8) cancelHold(this); },
        messageActionsCancel: () => cancelHold(this),
        canReplyMessage: this.canReplyMessage?.(entry)===true, canEditMessage: this.canEditMessage?.(entry)===true,
        replyMessage: () => { closeMenu(this); this.replyToMessage?.(entry); }, editMessage: () => { closeMenu(this); this.editMessage?.(entry); },
        closeMessageActions: () => closeMenu(this, true), menuKey: (event: KeyboardEvent) => menuKey(this, event),
        copyMessage: async () => {
          if (!menu || menus.get(this) !== menu || menu.binding !== JSON.stringify(connectionController.getSnapshot().session)) return;
          try { await navigator.clipboard.writeText(entry.text); if (menus.get(this) === menu) { menu.notice = 'Copied.'; refresh(this); } }
          catch { if (menus.get(this) === menu) { menu.notice = 'Copy unavailable. Select the message text to copy it.'; refresh(this); } }
        },
        messageActionsNotice: opened && menu ? menu.notice : '',
        localSpeechAvailable: available && entry.from === 'agent', localSpeechLabel: selected && state?.controller ? 'Stop reading' : 'Read aloud',
        localSpeechMessage: selected ? state?.message : '',
        localSpeech: () => { void listen(this, entry.id, entry.text); }
      };
    });
    return out;
  };
  p.componentDidMount = function (...args: unknown[]) {
    const outside = (event: PointerEvent) => { if (!(event.target as Element)?.closest('[data-alpha-message-actions], [data-alpha-message-text]')) closeMenu(this); };
    document.addEventListener('pointerdown', outside, true);
    listeners.set(this, () => document.removeEventListener('pointerdown', outside, true));
    return mount?.apply(this, args);
  };
  p.componentDidUpdate = function (...args: unknown[]) {
    const state = states.get(this), value = this.S(), menu = menus.get(this);
    if (!['sheet', 'full'].includes(value.chat)) cancelHold(this);
    if (menu && (menu.binding !== JSON.stringify(connectionController.getSnapshot().session) || !['sheet', 'full'].includes(value.chat) || !(value.msgs || []).some((m: Shell) => m.id === menu.id && m.text === menu.text))) { cancelHold(this); closeMenu(this); }
    else if (menu?.focus) { menu.focus = false; document.querySelector<HTMLElement>('[data-alpha-message-actions] [role="menuitem"]')?.focus(); }
    if (state && (!['sheet', 'full'].includes(value.chat) || !(value.msgs || []).some((m: Shell) => m.id === state.id && m.text === state.text))) { stop(this); refresh(this); }
    return update?.apply(this, args);
  };
  p.componentWillUnmount = function (...args: unknown[]) { cancelHold(this); menus.delete(this); listeners.get(this)?.(); listeners.delete(this); stop(this); return unmount?.apply(this, args); };
}
