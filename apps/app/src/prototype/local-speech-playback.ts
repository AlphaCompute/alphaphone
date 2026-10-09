import { connectionController } from '../runtime/connection-ui';
import { planLocalSpeech } from '../runtime/local-speech-text';
import { createOnDeviceVoice } from '../runtime/local-voice';
import { createCloudVoice, cloudVoiceFailure } from '../runtime/cloud-voice';
import { selectVoiceRoute } from '../runtime/voice-selection';

let cancelCurrent: (() => Promise<void>|void) | undefined;
let cancelOwner: object | undefined;
let speechRetirement:Promise<void>|undefined;
function retainSpeechRetirement(pending:Promise<void>){
 const previous=speechRetirement;
 const drain=Promise.all([previous,pending.catch(error=>{if(error?.code==='speech-cleanup-unconfirmed')throw error;})]).then(()=>{});
 speechRetirement=drain;void drain.then(()=>{if(speechRetirement===drain)speechRetirement=undefined;},()=>{});return drain;
}
export function stopLocalSpeechPlayback() { const pending=cancelCurrent?.(); cancelCurrent = undefined; cancelOwner = undefined;return pending?retainSpeechRetirement(Promise.resolve(pending)):speechRetirement; }
type Shell = any;
type Reading = { id: string; text: string; pending?:Promise<void>;controller?: AbortController; message: string };
/** Message actions use the existing speech route; playback always requires a user gesture. */
export function installLocalSpeechPlayback(Component: Shell) {
  const p = Component.prototype, original = p.renderVals, mount = p.componentDidMount, update = p.componentDidUpdate, unmount = p.componentWillUnmount;
  const states = new WeakMap<object, Reading>();
  const menus = new WeakMap<object, { id: string; text: string; trigger?: HTMLElement; notice: string; focus: boolean; binding: string }>();
  const holds = new WeakMap<object, { timer?: ReturnType<typeof setTimeout>; x: number; y: number; opened?:boolean; selecting?:boolean; start?:{node:Node;offset:number} }>();
  const suppressedClicks = new WeakMap<object, string>();
  const listeners = new WeakMap<object, () => void>();
  const cancelHold = (shell: Shell) => { const hold = holds.get(shell); if (hold) clearTimeout(hold.timer); holds.delete(shell); };
  const caret=(x:number,y:number)=>{
    const point=document.caretPositionFromPoint?.(x,y),range=point?null:document.caretRangeFromPoint?.(x,y);
    const node=point?.offsetNode??range?.startContainer,offset=point?.offset??range?.startOffset;
    return node&&offset!==undefined&&(node instanceof Element?node:node.parentElement)?.closest('[data-alpha-message-text]')?{node,offset}:undefined;
  };
  const closeMenu = (shell: Shell, focus = false) => { const menu = menus.get(shell); if (!menu) return; menus.delete(shell); if (focus) menu.trigger?.focus({preventScroll:true}); refresh(shell); };
  function openMenu(shell: Shell, id: string, text: string, event: Event) {
    event.preventDefault(); event.stopPropagation();
    if(event.type!=='contextmenu'&&menus.get(shell)?.id===id){closeMenu(shell);return;}
    menus.set(shell, { id, text, trigger: event.currentTarget as HTMLElement, notice: '', focus: event.type==='keydown', binding: JSON.stringify(connectionController.getSnapshot().session) }); refresh(shell);
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
  const stop = (shell: Shell) => { const old = states.get(shell); old?.controller?.abort(); if(old?.pending)retainSpeechRetirement(old.pending);states.delete(shell); if (cancelOwner === shell) { cancelCurrent = undefined; cancelOwner = undefined; } };
  async function listen(shell: Shell, id: string, text: string) {
    const old = states.get(shell);
    if (old?.id === id && old.controller) { stop(shell); refresh(shell); return; }
    try{const retiring=shell.stopVoiceConversation?.();if(retiring)await retiring;const previousSpeech=stopLocalSpeechPlayback();if(previousSpeech)await previousSpeech;}catch{shell.toast('Audio retirement could not be confirmed. Close the app before starting audio again.');return;}
    stop(shell);
    const cloud = selectVoiceRoute() === 'cloud';
    if (cloud && (!connectionController.getCloudEnvironment() || !connectionController.getCloudClient()?.credentialId)) { connectionController.openCloudAccount(); return; }
    const voice = cloud ? createCloudVoice() : createOnDeviceVoice(); if (!voice) return;
    const controller = new AbortController(), state: Reading = { id, text, controller, message: cloud ? 'Preparing audio…' : 'Preparing audio on this phone…' };
    states.set(shell, state); cancelOwner = shell; cancelCurrent = () => { stop(shell); refresh(shell);return state.pending; }; refresh(shell);
    try {
      if ('ready' in voice) {
        planLocalSpeech(text);
        if (!await voice.ready(controller.signal)) throw new Error('On-device speech models are unavailable. The written message is still available.');
      }
      if (controller.signal.aborted || states.get(shell) !== state) return;
      state.message = 'Reading aloud…'; refresh(shell);
      const pending=state.pending=voice.speak(text, controller.signal);await pending;
      if (states.get(shell) === state) { state.controller = undefined; state.message = 'Finished reading.'; refresh(shell); }
    } catch (error) {
      if((error as {code?:string})?.code==='speech-cleanup-unconfirmed'&&state.pending)retainSpeechRetirement(state.pending);
      if (states.get(shell) !== state) return;
      state.controller = undefined;
      const recovery = cloud ? cloudVoiceFailure(error) : null;
      state.message = controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError') ? 'Reading stopped.' : recovery || (error instanceof Error ? error.message + ' The complete message may not have been read.' : 'Reading stopped before completion. The written message is still available.');
      refresh(shell);
    }
  }
  p.renderVals = function () {
    const out = original.call(this), source = this.S().msgs || [], state = states.get(this);
    const cloud = selectVoiceRoute() === 'cloud';
    const available = cloud || createOnDeviceVoice() !== null;
    out.msgs = (out.msgs || []).map((message: Shell, index: number) => {
      const entry = source[index];
      if (!entry || entry.streaming || entry.interrupted || !entry.text || entry.text !== message.text || typeof entry.id !== 'string') return message;
      const selected = state?.id === entry.id;
      const menu = menus.get(this), opened = menu?.id === entry.id;
      return { ...message, messageActionsOpen: opened, messageActionsRole: 'button', messageActionsTabIndex: 0, messageActionsLabel: 'Message actions: ' + entry.text, messageActionsPopup: 'menu',
        openMessageActions: (event: MouseEvent) => { if(suppressedClicks.get(this)===entry.id){suppressedClicks.delete(this);event.preventDefault();event.stopPropagation();return;}if (window.getSelection()?.isCollapsed!==false) openMenu(this, entry.id, entry.text, event); },
        messageActionsKey: (event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') openMenu(this, entry.id, entry.text, event); },
        messageActionsContext: (event: MouseEvent) => {if(window.getSelection()?.isCollapsed===false)return;suppressedClicks.set(this,entry.id);openMenu(this, entry.id, entry.text, event);},
        messageActionsDown: (event: PointerEvent) => {
          suppressedClicks.delete(this);cancelHold(this);
          if(event.pointerType==='mouse'){holds.set(this,{x:event.clientX,y:event.clientY});return;}
          if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
          const target = event.currentTarget as HTMLElement, binding = JSON.stringify(connectionController.getSnapshot().session);
          holds.set(this, { x: event.clientX, y: event.clientY,start:caret(event.clientX,event.clientY), timer: setTimeout(() => {
            const hold=holds.get(this);if(!hold)return;hold.timer=undefined;
            if (this.live === false || window.getSelection()?.isCollapsed===false || binding !== JSON.stringify(connectionController.getSnapshot().session) || !['sheet', 'full'].includes(this.S().chat) || !this.S().msgs?.some((m: Shell) => m.id === entry.id && m.text === entry.text)) {cancelHold(this);return;}hold.opened=true;suppressedClicks.set(this,entry.id);menus.set(this, { id: entry.id, text: entry.text, trigger: target, notice: '', focus: false, binding: JSON.stringify(connectionController.getSnapshot().session) }); refresh(this);
          }, 500) });
        },
        messageActionsMove: (event: PointerEvent) => {
          const hold=holds.get(this);if(!hold||Math.hypot(event.clientX-hold.x,event.clientY-hold.y)<=8)return;
          if(hold.opened&&hold.start?.node.isConnected){const end=caret(event.clientX,event.clientY);if(end){hold.selecting=true;window.getSelection()?.setBaseAndExtent(hold.start.node,hold.start.offset,end.node,end.offset);closeMenu(this);}return;}
          cancelHold(this);suppressedClicks.set(this,entry.id);closeMenu(this);
        },
        messageActionsCancel: () => cancelHold(this),
        canReplyMessage: this.canReplyMessage?.(entry)===true, canEditMessage: this.canEditMessage?.(entry)===true,
        replyMessage: () => { closeMenu(this); this.replyToMessage?.(entry); }, editMessage: () => { closeMenu(this); this.editMessage?.(entry); },
        closeMessageActions: (event: MouseEvent) => closeMenu(this, event.detail===0), menuKey: (event: KeyboardEvent) => menuKey(this, event),
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
    const selection=()=>{if(window.getSelection()?.isCollapsed===false){if(!holds.get(this)?.selecting)cancelHold(this);closeMenu(this);}};
    const touchMove=(event:TouchEvent)=>{if(holds.get(this)?.opened)event.preventDefault();};
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('selectionchange',selection);
    document.addEventListener('touchmove',touchMove,{passive:false});
    listeners.set(this, () => {document.removeEventListener('pointerdown', outside, true);document.removeEventListener('selectionchange',selection);document.removeEventListener('touchmove',touchMove);});
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
