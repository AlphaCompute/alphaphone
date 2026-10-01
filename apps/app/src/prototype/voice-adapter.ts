import { installLocalSpeechPlayback, stopLocalSpeechPlayback } from './local-speech-playback';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { createOnDeviceVoice } from '../runtime/local-voice';
import { createPairedVoice } from '../runtime/paired-voice';
import { createCloudVoice } from '../runtime/cloud-voice';
import { connectionController } from '../runtime/connection-ui';
type Bag = Record<string, any>;
type Clip = { recordingId: string; durationMs: number };
const voice = registerPlugin<{
  startRecording(input?: { maxDurationMs: 29000 | 59000 }): Promise<{ recordingId: string; maxDurationMs: number }>;
  stopRecording(): Promise<Clip>;
  transcribeRecording(options: { recordingId: string; requestId: string }): Promise<{ text: string; local: boolean }>;
  cancelRecording(): Promise<unknown>;
  cancel(options: { requestId: string }): Promise<unknown>;
  addListener(event: 'recordingStopped', callback: (clip: Clip) => void): Promise<PluginListenerHandle>;
}>('DevelopmentAgent');
const deviceVoice = registerPlugin<typeof voice>('AlphaVoiceCloud');

type SavedAudio = { audioId: string; noteId: string; durationMs: number; transcript: string };
const cloudRecorder = registerPlugin<{ saveRecording(input: { recordingId: string; noteId: string; transcript: string }): Promise<SavedAudio> }>('AlphaVoiceCloud');
const localRecorder = registerPlugin<{ saveRecording(input: { recordingId: string; noteId: string; transcript: string }): Promise<SavedAudio> }>('DevelopmentAgent');
const noteAudio = registerPlugin<{
  play(input: { audioId: string }): Promise<void>; stop(): Promise<void>;
  state(): Promise<{ playing: boolean; audioId?: string; positionMs: number }>;
  remove(input: { audioId: string; noteId: string }): Promise<void>;
  restore(input: { audioId: string; noteId: string }): Promise<void>;
}>('AlphaNoteAudio');

/** Real voice state presented in the prototype Notes recording canvas. */
export function installPrototypeVoiceAdapter(Component: any, views: Record<string, Bag>) {
  installLocalSpeechPlayback(Component);
  const notes = views.notes, render = notes.render, back = notes.back, leave = notes.onLeave;
  const originalApi = Component.prototype.api;
  Component.prototype.api = function (key: string) {
    const value = originalApi.call(this, key);
    // The prototype setView callback discards vset's persistence receipt.
    if (key === 'notes') value.saveVoiceNote = async (patch: Bag) => await this.vset('notes', patch) === true;
    return value;
  };
  let api: Bag | undefined, stage = 'closed', generation = 0, busy = false;
  let clip: Clip | undefined, recordingId: string | undefined, started = 0;
  let error = '', draft = '', requestId: string | undefined, saveId = '';
  let savedPlaying: string | undefined, savedPosition = 0, savedEpoch = 0, savedTick: ReturnType<typeof setInterval> | undefined;
  const stopSaved = () => { const owned = savedPlaying !== undefined; ++savedEpoch; savedPlaying = undefined; savedPosition = 0; if (savedTick) clearInterval(savedTick); savedTick = undefined; if (owned) void noteAudio.stop().catch(() => {}); };
  async function playSaved(note: Bag) {
    if (savedPlaying === note.audio.audioId) { stopSaved(); refresh(); return; }
    stopSaved(); const epoch = savedEpoch; savedPlaying = note.audio.audioId; refresh();
    try {
      await noteAudio.play({ audioId: note.audio.audioId });
      if (epoch !== savedEpoch) return;
      savedTick = setInterval(() => { void noteAudio.state().then(value => { if (epoch !== savedEpoch) return; if (!value.playing || value.audioId !== savedPlaying) { stopSaved(); refresh(); return; } savedPosition = value.positionMs; refresh(); }).catch(() => { if (epoch === savedEpoch) { stopSaved(); refresh(); } }); }, 250);
    } catch { if (epoch === savedEpoch) { stopSaved(); api?.toast('This saved recording could not be played. The transcript is still available.'); refresh(); } }
  }
  type DictationTarget = { id: string; body: string; revision: string; start: number; end: number };
  let destination: DictationTarget | undefined;
  let listener: PluginListenerHandle | undefined, tick: ReturnType<typeof setInterval> | undefined;
  let stopping = Promise.resolve();
  type Driver = typeof voice | ReturnType<typeof createCloudVoice>;
  let driver: Driver = voice, cloudMode = false, deviceOnly = false;
  let pairedVoice: ReturnType<typeof createPairedVoice> = null, pairedReady = false, pairedAsrReady = false;
  let selectedRoute: 'device' | 'agent' = 'device', preparingPaired = false;
  let onDeviceVoice: ReturnType<typeof createOnDeviceVoice> = null, onDeviceReady = false, preparingLocal = false;
  let transcription: AbortController | undefined;
  let readiness: AbortController | undefined;
  let playback: AbortController | undefined, playing = false;
  let chatDestination: { shell: any; view: string | null } | undefined;
  const refresh = () => api?.setView('notes', { nativeVoiceRevision: Date.now() });
  const stopClock = () => { if (tick) clearInterval(tick); tick = undefined; };
  function cleanup(close = true) {
    ++generation; readiness?.abort(); readiness = undefined; transcription?.abort(); transcription = undefined; pairedVoice = null; onDeviceVoice = null; onDeviceReady = false; preparingLocal = false; preparingPaired = false; pairedReady = false; pairedAsrReady = false; busy = false; stopClock(); stopSaved();
    if (requestId) void driver.cancel({ requestId }).catch(() => {});
    playback?.abort(); playback = undefined; playing = false;
    requestId = undefined;
    if (listener) void listener.remove(); listener = undefined;
    const previous = driver;
    stopping = stopping.then(async () => { try { await previous.cancelRecording(); } catch {} });
    clip = undefined; recordingId = undefined;
    if (close) { stage = 'closed'; draft = ''; destination = undefined; chatDestination = undefined; }
    refresh();
  }
  function enter(target?: DictationTarget, preparedLocal?: ReturnType<typeof createOnDeviceVoice>, route: 'device' | 'agent' = 'device') {
    stopLocalSpeechPlayback(); cleanup(); destination = target; saveId = target?.id || crypto.randomUUID(); stage = 'ready'; error = ''; draft = ''; selectedRoute = route;
    cloudMode = connectionController.getCloudEnvironment() !== null;
    deviceOnly = !cloudMode && (localStorage.getItem('alpha.connection.selection.v1') !== null || !Capacitor.isPluginAvailable('DevelopmentAgent'));
    driver = cloudMode ? createCloudVoice() : deviceOnly ? deviceVoice : voice;
    onDeviceVoice = route === 'device' ? preparedLocal || createOnDeviceVoice() : null;
    if (route === 'device') { cloudMode = false; deviceOnly = true; driver = deviceVoice; if (!onDeviceVoice) error = 'On-device speech is unavailable. Choose another voice service explicitly or use the keyboard.'; }
    if (preparedLocal) { onDeviceReady = true; cloudMode = false; deviceOnly = true; driver = deviceVoice; }
    else if (onDeviceVoice) {
      preparingLocal = true;
      const local = onDeviceVoice, token = generation, controller = new AbortController(); readiness = controller;
      void stopping.then(() => {
        if (token !== generation || controller.signal.aborted) return false;
        return local.ready(controller.signal);
      }).then(ready => {
        if (token !== generation || controller.signal.aborted) return;
        preparingLocal = false;
        if (!ready || stage !== 'ready') { if (!ready) error = 'On-device speech is unavailable. Choose another voice service explicitly or use the keyboard.'; refresh(); return; }
        onDeviceReady = true; cloudMode = false; deviceOnly = true; driver = deviceVoice;
        pairedReady = false; pairedAsrReady = false; refresh();
      }).catch(() => { if (token === generation) { preparingLocal = false; error = 'On-device speech is unavailable. Choose another voice service explicitly or use the keyboard.'; refresh(); } });
    }
    if (route === 'agent' && !cloudMode && deviceOnly) {
      pairedVoice = createPairedVoice();
      if (pairedVoice) {
        preparingPaired = true;
        const token = generation, controller = new AbortController(); readiness = controller;
        const selected = pairedVoice;
        void (async () => {
          await stopping;
          if (token !== generation || controller.signal.aborted) return;
          try { const ready = await selected.ready(controller.signal); if (token === generation && !controller.signal.aborted) { pairedReady = ready; refresh(); } } catch { /* TTS and ASR are separate capabilities. */ }
          if (token !== generation || controller.signal.aborted) return;
          try { const ready = await selected.transcriptionReady(controller.signal); if (token === generation && !controller.signal.aborted) { pairedAsrReady = ready; refresh(); } } catch { /* Manual recording remains available. */ }
          if (token === generation && !controller.signal.aborted) { preparingPaired = false; refresh(); }
        })();
      }
    }
    refresh();
  }
  async function act(task: (token: number) => Promise<void>) {
    if (busy) return;
    busy = true; error = ''; const token = generation;
    try { await task(token); }
    catch { if (token === generation) { error = onDeviceReady ? 'On-device speech unavailable. Keep recordings under 30 seconds and use English text under 500 characters for playback. Your recording is retained.' : pairedAsrReady ? 'Agent Whisper transcription unavailable. Your recording is retained; check the selected agent and retry explicitly.' : deviceOnly ? 'Recording unavailable. Check microphone access and available device storage, then retry.' : cloudMode ? 'Cloud voice unavailable. Check microphone access, your Cloud account and the connection, then retry.' : 'Voice unavailable. Check microphone access and the local development service, then retry.'; stage = stage === 'review' ? 'review' : clip ? 'recorded' : 'ready'; stopClock(); } }
    finally { if (token === generation) { busy = false; refresh(); } }
  }
  async function start(token: number) {
    if (selectedRoute === 'device' && !onDeviceReady) throw new Error('On-device speech is not ready');
    if (!Capacitor.isPluginAvailable(cloudMode || deviceOnly ? 'AlphaVoiceCloud' : 'DevelopmentAgent')) throw new Error('Voice unavailable');
    stage = 'starting'; refresh(); await stopping;
    if (token !== generation) return;
    if (listener) await listener.remove(); listener = undefined;
    const handle = await driver.addListener('recordingStopped', value => {
      if (token !== generation || (recordingId && value.recordingId !== recordingId)) return;
      stopClock();
      if (!value.recordingId || !Number.isFinite(value.durationMs)) { clip = undefined; stage = 'ready'; error = 'Recording ended without usable audio.'; }
      else { clip = value; stage = 'recorded'; }
      refresh();
    });
    if (token !== generation) { await handle.remove(); return; }
    listener = handle;
    const result = onDeviceReady ? await deviceVoice.startRecording({ maxDurationMs: 29000 }) : await driver.startRecording();
    if (token !== generation) return;
    recordingId = result.recordingId;
    if (stage === 'recorded') return; // Automatic-stop event can race promise delivery.
    started = Date.now(); stage = 'recording'; tick = setInterval(refresh, 250); refresh();
  }
  async function primary() {
    if (stage === 'transcribing') { cleanup(false); stage = 'ready'; error = 'Transcription cancelled. Record again to continue.'; refresh(); return; }
    if (stage === 'review') {
      if (!api || !draft.trim()) return;
      if (chatDestination) {
        const { shell, view } = chatDestination, text = draft;
        cleanup();
        if (view) shell.openView(view); else shell.goHome();
        shell.setState({ chat: 'sheet', draft: text, voice: 'off' });
        return;
      }
      if(api.storageReady?.()===false){error='Notes has a pending or unconfirmed save. Wait or reopen Notes to inspect before saving again.';refresh();return;}
      const current = api.get('notes').list || [];
      const target = destination && current.find((n: Bag) => n.id === destination!.id);
      if (destination && (!target || JSON.stringify(target) !== destination.revision)) { error = 'The original note changed. Cancel and reopen recording before applying this transcript.'; refresh(); return; }
      if (!clip || busy) return;
      if (destination && target) {
        const text = destination.body.slice(0, destination.start) + draft + destination.body.slice(destination.end);
        const id = target.id, caret = destination.start + draft.length;
        const next = current.map((n: Bag) => n.id === id ? { ...n, body: text, when: 'Now' } : n);
        if (await api.saveVoiceNote({ list: next, open: id }) !== true) { error = 'The note save is unconfirmed. Your transcript is retained; inspect saved Notes before applying again.'; refresh(); return; }
        cleanup();
        window.requestAnimationFrame?.(() => {
          if (api?.get('notes').open !== id) return;
          const editor = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Note"]');
          if (editor?.value === text) { editor.focus(); editor.setSelectionRange(caret, caret); }
        });
        return;
      }
      await act(async token => {
        const id = target?.id || saveId;
        const text = [target?.body, draft].filter(Boolean).join('\n');
        const recording = clip!;
        const audio = await (cloudMode || deviceOnly ? cloudRecorder : localRecorder).saveRecording({ recordingId: recording.recordingId, noteId: id, transcript: text });
        if (token !== generation) return;
        if (audio.noteId !== id || audio.audioId !== recording.recordingId || !Number.isFinite(audio.durationMs)) throw new Error('Invalid saved recording');
        const note = { ...(target || {}), id, kind: 'voice', title: target?.title || 'Voice note', body: text, audio, dur: audio.durationMs / 1000, summary: [], actions: [], lines: [{ s: 'me', at: 0, t: text }], pinned: target?.pinned || false, when: 'Now' };
        // Native retention can outlive unrelated editor commits. Merge into the latest collection.
        if(api!.storageReady?.()===false)throw new Error('Notes has an unconfirmed save. Reopen before applying this recording.');
        const latest = api!.get('notes').list || [];
        const latestTarget = latest.find((n: Bag) => n.id === id);
        if(target ? JSON.stringify(latestTarget)!==JSON.stringify(target) : !!latestTarget)throw new Error('The note changed while saving audio. Recording retained; reopen before applying.');
        const next = target ? latest.map((n: Bag) => n.id === id ? note : n) : [note, ...latest];
        if (await api!.saveVoiceNote({ list: next, open: id }) !== true) { error = 'The note save is unconfirmed. The recording and transcript are retained; inspect saved Notes before saving again.'; refresh(); return; }
        cleanup();
      });
      return;
    }
    await act(async token => {
      if (stage === 'ready') return start(token);
      if (stage === 'recording') {
        const value = await driver.stopRecording(); if (token !== generation) return;
        if (!value.recordingId || !Number.isFinite(value.durationMs)) throw new Error('Bad clip');
        clip = value; stage = 'recorded'; stopClock(); return;
      }
      if (stage === 'recorded' && clip) {
        if(deviceOnly && !pairedAsrReady && !onDeviceReady) {draft = ''; stage = 'review'; return;}
        stage = 'transcribing'; requestId = crypto.randomUUID(); refresh();
        transcription = new AbortController();
        const result = onDeviceReady && onDeviceVoice ? await onDeviceVoice.transcribe(clip.recordingId, transcription.signal) : pairedAsrReady && pairedVoice ? await pairedVoice.transcribe(clip.recordingId, transcription.signal) : await driver.transcribeRecording({ recordingId: clip.recordingId, requestId });
        transcription = undefined;
        if (token !== generation) return;
        requestId = undefined;
        if (typeof result.text !== 'string' || !result.text.trim() || result.local !== !cloudMode) throw new Error('Invalid transcript');
        draft = result.text; stage = 'review';
      }
    });
  }
  async function listen() {
    if (playing) { playback?.abort(); return; }
    const speaker = onDeviceReady ? onDeviceVoice : cloudMode && 'speak' in driver ? driver : pairedReady ? pairedVoice : null;
    if (!speaker || !draft.trim()) return;
    const token = generation, controller = new AbortController();
    playback = controller; playing = true; error = ''; refresh();
    try { await speaker.speak(draft, controller.signal); }
    catch { if (token === generation && !controller.signal.aborted) error = 'Audio could not be played by the selected voice service. Your transcript is still available.'; }
    finally { if (token === generation) { playback = undefined; playing = false; refresh(); } }
  }
  const originalStartVoice = Component.prototype.startVoice;
  let composerProbe = 0;
  Component.prototype.startVoice = async function (...args: any[]) {
    const probe = ++composerProbe, view = this.S().view || null;
    const local = createOnDeviceVoice();
    if (local) {
      const session = connectionController.getSnapshot().session?.sessionId;
      try {
        this.toast('Preparing on-device speech.');
        const ready = await local.ready(new AbortController().signal);
        if (probe !== composerProbe || session !== connectionController.getSnapshot().session?.sessionId || (this.S().view || null) !== view || document.hidden) return;
        if (ready) { this.openView('notes'); enter(undefined, local); onDeviceVoice = local; onDeviceReady = true; cloudMode = false; deviceOnly = true; driver = deviceVoice; chatDestination = { shell: this, view }; refresh(); return; }
      } catch { /* Keep the existing explicitly labelled voice choice. */ }
    }
    if (connectionController.getCloudEnvironment() === null) {
      const paired = createPairedVoice();
      if (paired) {
        const session = connectionController.getSnapshot().session?.sessionId;
        try {
          const ready = await paired.transcriptionReady(new AbortController().signal);
          if (probe !== composerProbe || session !== connectionController.getSnapshot().session?.sessionId || (this.S().view || null) !== view || document.hidden) return;
          if (!ready) { this.toast('Standalone Whisper transcription is unavailable on this agent. Use the keyboard or record a note with a manual transcript.'); return; }
          this.openView('notes'); enter(); pairedAsrReady = true; chatDestination = { shell: this, view }; refresh(); return;
        } catch { if (probe === composerProbe) this.toast('Agent transcription is unavailable. Check this connection or use the keyboard.'); return; }
      }
      if (localStorage.getItem('alpha.connection.selection.v1') !== null) { this.toast('Sign in to Eliza Cloud to use voice with this agent, or use the keyboard.'); return; }
      return originalStartVoice?.apply(this, args);
    }
    this.openView('notes'); enter(); chatDestination = { shell: this, view }; refresh();
  };
  notes.render = (state: Bag, current: Bag) => {
    api = current;
    const selected = (current.get('notes').list || []).find((n: Bag) => n.id === state.open);
    if (savedPlaying && selected?.audio?.audioId !== savedPlaying) stopSaved();
    const result = render({ ...state, record: false, rec: null, ...(selected?.audio ? { playing: false, pos: savedPosition / 1000 } : {}) }, current);
    for (const card of [...(result.colL || []), ...(result.colR || [])]) if ((current.get('notes').list || []).some((n: Bag) => n.id === card.id && n.audio)) card.bars = card.bars.map(() => 4);
    if (selected?.audio && result.vo) {
      const vo = result.vo;
      vo.playLabel = savedPlaying ? 'Stop recording playback' : 'Play recording';
      vo.playIcon = savedPlaying ? current.ic.stop : current.ic.play;
      vo.play = () => { void playSaved(selected); };
      vo.lines = [{ ini: 'You', who: 'You', t: selected.body || selected.audio.transcript, at: '0:00', chip: 'background:var(--acc);color:#fff', css: '', seek: () => { void playSaved(selected); } }];
      vo.bars = vo.bars.map((bar: Bag) => ({ ...bar, h: 4 })); // No invented amplitude analysis.
      vo.share = () => current.toast('Audio stays on this phone. Sharing recordings is not available yet.');
      vo.del = () => { void (async () => {
        stopSaved();
        try {
          await noteAudio.remove({ audioId: selected.audio.audioId, noteId: selected.id });
          const list = current.get('notes').list;
          if (await current.saveVoiceNote({ list: list.filter((n: Bag) => n.id !== selected.id), open: null }) !== true) { await noteAudio.restore({ audioId: selected.audio.audioId, noteId: selected.id }); throw new Error('Note write failed'); }
          current.toast('Voice note deleted', { undo: () => { void (async () => { try { await noteAudio.restore({ audioId: selected.audio.audioId, noteId: selected.id }); const now = current.get('notes').list; if (!now.some((n: Bag) => n.id === selected.id) && !await current.saveVoiceNote({ list: [selected, ...now] })) throw new Error('Restore commit unconfirmed'); } catch { current.toast('Voice note could not be restored.'); } })(); } });
        } catch { current.toast('Voice note could not be deleted. Your recording has been retained.'); }
      })(); };
    }
    result.record = () => enter();
    if (result.ed) result.ed.dictate = () => {
      const n = (current.get('notes').list || []).find((item: Bag) => item.id === state.open);
      if (n?.kind === 'list') { current.toast('Convert this checklist to text before dictating.'); return; }
      if (!n) return;
      const body = n.body || '', editor = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Note"]');
      const start = editor && editor.value === body ? editor.selectionStart : body.length;
      const end = editor && editor.value === body ? editor.selectionEnd : body.length;
      enter({ id: n.id, body, revision: JSON.stringify(n), start, end });
    };
    if (stage === 'closed') return result;
    const seconds = stage === 'recording' ? (Date.now() - started) / 1000 : (clip?.durationMs || 0) / 1000;
    const labels: Bag = { ready: 'Start recording', starting: 'Starting microphone', recording: 'Stop recording', recorded: onDeviceReady ? 'Transcribe on this phone' : pairedAsrReady ? 'Transcribe with agent Whisper' : deviceOnly ? 'Review recording' : cloudMode ? 'Transcribe with Eliza Cloud' : 'Transcribe locally', transcribing: 'Cancel transcription', review: chatDestination ? 'Use in conversation' : destination ? 'Apply transcript' : 'Save note' };
    const messages: Bag = { ready: deviceOnly ? 'Record up to 59 seconds on this phone. You can add a transcript manually and save without signing in. Nothing is uploaded.' : cloudMode ? 'Record up to 59 seconds. Audio stays on this phone until you choose Transcribe with Eliza Cloud.' : 'Development voice: record up to 59 seconds. Audio goes to this computer only after you choose Transcribe locally.', starting: 'Waiting for microphone access.', recording: 'Recording. Waveform levels are unavailable. Stop does not upload audio.', recorded: deviceOnly ? 'Microphone is off. Review the recording and enter a transcript manually. Cloud transcription is not connected; nothing is uploaded.' : cloudMode ? 'Microphone is off. Choose Transcribe with Eliza Cloud to upload this recording to your selected Cloud account.' : 'Microphone is off. Choose Transcribe locally to process this clip on the connected development computer.', transcribing: cloudMode ? 'Transcribing with Eliza Cloud. Nothing has been saved.' : 'Transcribing on the local computer. Nothing has been saved.', review: deviceOnly ? 'Enter a transcript manually, then save it with this recording on the phone. Nothing is uploaded or sent to an agent.' : chatDestination ? 'Review the transcript, then use it in the conversation. Press Send there to send it to your agent.' : 'Review and edit the transcript, then save the recording and transcript on this phone. Nothing is sent to the agent.' };
    if (pairedAsrReady) { messages.ready = 'Record up to 59 seconds. English transcription uses your selected agent. Audio stays on this phone until you choose Transcribe with agent Whisper.'; messages.recorded = 'Microphone is off. Transcribe with agent Whisper uploads this recording to your selected agent for English speech recognition.'; messages.transcribing = 'Transcribing with your selected agent. Nothing has been saved.'; messages.review = chatDestination ? 'Review the agent transcript, then use it in the conversation. Press Send there to send the message.' : 'Review and edit the agent transcript, then save it with the recording on this phone. Nothing is sent as a chat message.'; }
    if (onDeviceReady) {
      messages.ready = 'Record up to 29 seconds. English transcription runs on this phone. Nothing is uploaded.';
      messages.recorded = 'Microphone is off. Transcribe on this phone processes this recording without uploading audio.';
      messages.transcribing = 'Transcribing on this phone. Nothing has been saved or uploaded.';
      messages.review = chatDestination ? 'Review the transcript, then use it in the conversation. Press Send there to send it to your agent.' : 'Review and edit the transcript, then save it on this phone. Nothing is uploaded.';
      if (stage === 'review') messages.review += ' Listen also runs on this phone. Unfamiliar English names are spelled; numbers are read digit by digit. Unsupported symbols require editing.';
    }
    if (destination) messages.review = 'Review the transcript, then insert it at your saved selection. This keeps your text note; the recording is discarded after applying. ' + (onDeviceReady ? 'Nothing was uploaded.' : cloudMode ? 'Eliza Cloud processed the audio. No chat message was sent.' : pairedAsrReady ? 'Your selected agent processed the audio. No chat message was sent.' : 'No chat message was sent.');
    if (pairedReady && stage === 'review' && !destination) messages.review = playing ? 'Playing selected-agent audio. Tap Stop audio to stop. Your recording remains on this phone.' : 'Save keeps this recording and transcript on the phone. Listen to transcript sends only this text to your selected agent for audio playback.';
    if (cloudMode && stage === 'review') messages.review += playing ? ' Playing Cloud audio. Tap Stop audio to stop.' : ' Listen to transcript sends this text to Eliza Cloud for audio playback.';
    if (selectedRoute === 'device' && !onDeviceReady && !preparingLocal && stage === 'ready') labels.ready = 'On-device speech unavailable';
    if (preparingPaired && stage === 'ready') { labels.ready = 'Checking selected agent voice'; messages.ready = 'Checking transcription and playback on your selected agent. No audio is uploaded.'; }
    if (preparingLocal && stage === 'ready') { labels.ready = 'Preparing on-device speech'; messages.ready = 'Loading and checking speech models on this phone. Nothing is uploaded.'; }
    result.recording = true;
    result.rec = {
      routeChoice: stage === 'ready' && !busy && document.documentElement.dataset.connectionMode !== 'mock' && (!!connectionController.getPairedVoiceBinding() || connectionController.getCloudEnvironment() !== null),
      routeLabel: selectedRoute === 'device' ? (connectionController.getCloudEnvironment() !== null ? 'Use Eliza Cloud voice' : 'Use selected agent voice') : 'Use on-device voice',
      changeRoute: () => { if (stage !== 'ready' || busy) return; const target = destination, chat = chatDestination; enter(target, undefined, selectedRoute === 'device' ? 'agent' : 'device'); chatDestination = chat; refresh(); },
      clock: `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`, clockCss: '', live: stage === 'recording', paused: stage !== 'recording', dotCss: `background:${stage === 'recording' ? '#E53935' : 'var(--mut)'}`,
      levels: Array.from({ length: 44 }, () => ({ h: 4 })),
      lines: [{ ini: error ? '!' : 'i', t: error || messages[stage], chip: 'background:var(--s2);color:var(--fg)', css: '' }],
      review: stage === 'review', transcript: draft, onTranscript: (e: Event) => { draft = (e.target as HTMLTextAreaElement).value; refresh(); },
      primaryLabel: labels[stage], primaryIcon: stage === 'review' ? current.ic.check : stage === 'recording' || stage === 'transcribing' ? current.ic.stop : current.ic.mic,
      primaryDisabled: (selectedRoute === 'device' && !onDeviceReady) || preparingLocal || preparingPaired || stage === 'starting' || (busy && stage !== 'transcribing') || (stage === 'review' && !draft.trim()),
      pauseLabel: (onDeviceReady || cloudMode || pairedReady) && stage === 'review' ? playing ? 'Stop audio' : 'Listen to transcript' : ['recorded', 'review'].includes(stage) ? 'Record again' : 'Cancel recording', pauseIcon: (onDeviceReady || cloudMode || pairedReady) && stage === 'review' ? playing ? current.ic.stop : current.ic.play : ['recorded', 'review'].includes(stage) ? current.ic.mic : current.ic.x,
      stop: () => { void primary(); }, discard: () => cleanup(), toggle: () => { if ((onDeviceReady || cloudMode || pairedReady) && stage === 'review') { void listen(); } else if (['recorded', 'review'].includes(stage)) { const target = destination, chat = chatDestination; enter(target, undefined, selectedRoute); chatDestination = chat; } else cleanup(); },
    };
    return result;
  };
  const immersive = notes.immersive;
  notes.immersive = (state: Bag, current: Bag) => stage !== 'closed' ? { noPill: true } : immersive?.(state, current);
  notes.back = (state: Bag, current: Bag) => { if (stage !== 'closed') { cleanup(); return true; } return back?.(state, current); };
  notes.onLeave = (current: Bag) => { cleanup(); leave?.(current); };
  const visibility = () => {
    if (!document.hidden) return;
    stopSaved();
    if (playing) { playback?.abort(); playing = false; refresh(); }
    if (['recording', 'transcribing'].includes(stage)) { cleanup(false); stage = 'ready'; error = 'Voice stopped when the app left the foreground. Record again to continue.'; refresh(); }
  };
  const pagehide = () => { if (stage !== 'closed') cleanup(); };
  const binding = () => [connectionController.getCloudClient()?.sessionId, connectionController.getSnapshot().session?.sessionId].join(':');
  let account = binding();
  const unsubscribe = connectionController.subscribe(() => {
    const next = binding();
    if (connectionController.getSnapshot().open && stage !== 'closed') { cleanup(); }
    if (next !== account) { account = next; stopSaved(); if (stage !== 'closed') cleanup(); }
  });
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', pagehide);
  const unmount = Component.prototype.componentWillUnmount;
  Component.prototype.componentWillUnmount = function () { api = undefined; cleanup(); unsubscribe(); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pagehide); unmount?.call(this); };
}
