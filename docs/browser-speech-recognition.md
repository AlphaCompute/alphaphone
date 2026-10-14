# Browser speech: the local agent or Eliza Cloud

The web build has **no speech engine of its own**. It loads no speech model, no inference
runtime and no speech worker. Speech in a browser takes one of two routes:

- **Local agent (local-first).** The private local agent on the same computer runs speech
  natively on libelizainference, the llama.cpp-based engine ([fused speech](fused-speech.md)).
  Audio goes only to that agent, over the authenticated development bridge.
- **Eliza Cloud.** The disclosed opt-in route bound to the signed-in account (decision
  **P-07** in [decisions.md](decisions.md)). In a browser build it is available only on
  development surfaces; flag-off builds select Cloud as described in P-07.

Decision **P-42** removed the earlier in-browser recognizer: one local engine,
libelizainference, because the earlier runtimes were too slow and used too much memory. Chat
**Talk** opens voice inside the chat sheet and keeps the current app and draft. Notes uses the
same recorder with a Notes destination. A recording stays in the app until the user chooses to
transcribe it, and a reviewed transcript is sent only when the user presses Send.

**English only.** As with OCR (decision **P-08**), recognition is English-only for now.

## Without a local agent

`BrowserVoice.localSpeechStatus()` returns
`{ready: false, playback: true, execution: 'browser', route: 'local-agent', reason: 'local-agent-required'}`
and never names an engine or model. `ready` is recognition readiness; `playback` says read-aloud
can still use the browser's own local voices (`playback` is `false` where `speechSynthesis` is
missing). `transcribeLocalRecording()` rejects with code
`local-agent-required` ("Connect the local agent to transcribe on this computer."). The recorder
shows the `local-agent` failure state: the recording is kept, and the user can connect the
agent and transcribe again, or type the transcript. Nothing falls back to Cloud or to any other
engine on its own.

## With the local agent

| Step | What happens |
| --- | --- |
| Readiness | `speechRequest()` with no audio asks the agent whether ASR is ready. |
| Transcribe | The browser decodes the clip and resamples it to a 16 kHz mono PCM16 WAV (`apps/app/src/browser/recording-pcm.ts`). It posts the WAV to the agent: `/api/asr/whisper` today (phase 1, provider `standalone-whisper.cpp`). Phase 2 moves to `/api/asr/local-inference` (provider `local-inference`) once upstream ships a standalone libelizainference host ASR worker. |
| Read aloud | `synthesizeSpeech()` posts text to `/api/tts/kokoro`. The agent runs Kokoro on libelizainference through the upstream `host-tts-worker`. With no agent, read-aloud uses the browser's own Web Speech voices (`speechSynthesis`, local voices only). That is the operating system's speech, not an Alpha engine; the owner should confirm it is wanted. |
| Cancel | Cancel, a hidden page (`visibilitychange`), `pagehide` or a change of agent session aborts the request. The agent sees the abort, and a late result is discarded. |

| State (`data-voice-state` on the recorder) | Shown to the user |
| --- | --- |
| `denied` | Microphone access is blocked, with site-settings guidance. Start recording retries. |
| `no-microphone` | No usable microphone; connect or enable one. |
| `local-agent` | Local transcription needs the local agent on this computer. The recording is kept; connect the agent and transcribe again, or type the transcript. |
| `no-speech` | No speech detected. **Record again** or **Type transcript instead** (keeps the recording). |
| `recognition` | Recognition failed for this clip; retry or type instead. |

## Provenance

A saved voice note records how its transcript was produced, in `transcription.route`:
`local-agent` for the local agent on this computer (the route the browser facade reports),
`development-agent` for the development voice driver, and `eliza-cloud` for Cloud. Fields such
as `engine` and `model` are recorded only when the route reports them; they are never guessed
(`apps/app/src/runtime/voice-states.ts`).

## Tests

- `test/browser/browser-speech.spec.ts` (Playwright, Chromium): with no agent, status is
  `local-agent-required`, transcription rejects with that code, the clip is kept, and no worker,
  WebAssembly module or speech asset is loaded. With a stub agent, the agent receives a
  16 kHz mono WAV and the transcript reports the `local-agent` route. The Cloud cases are also
  covered here.
- `test/browser/browser-audio.spec.ts`: `pagehide` aborts a pending local-agent transcription.
- `test/browser/production-surface.spec.ts` (production project): the built bundle contains no
  `browser-speech/` assets, no inference runtime and no speech model.
- `test/llama-cpp-only.test.mjs`: no tracked path, lockfile package or web source names a
  removed engine, and the bundle audit rejects one even in a test-mocks bundle.

These tests are source and browser evidence (class S). They say nothing about real agent speech
quality; see [local agent voice validation](local-agent-voice-validation.md).
