# Fused speech: libelizainference on the device and on the local agent

Alpha Phone has one local speech engine: **libelizainference**, the llama.cpp-based native
library from the elizaOS llama.cpp fork (decision P-42). At the pin `c7a9a0d7e7` (llama.cpp
gitlink `5df17a66`, voice ABI 18, built with `LLAMA_BUILD_PARAKEET=ON`) it contains ggml, the
**Parakeet-TDT** decoder that runs **Phonon-2** ASR in batch and streaming mode (P-55), mtmd (the
Qwen3-ASR alternative, not shipped), the **Paradee-8M** speech graph on the shared kokoro layers
(P-54), the native **misaki** English G2P, **eSpeak NG 1.52.0** (statically linked, used only for
words the misaki lexicon does not know, data path limit raised to 1024 bytes) and Silero VAD. It
loads GGUF models only; no other neural runtime or model ships anywhere
(`test/llama-cpp-only.test.mjs`, `scripts/audit-production-bundle.mjs`).

| Where | Engine | Route |
| --- | --- | --- |
| Android phone | The shared paradee-voice library (`:local-speech`, Java package `ai.eliza.voice`: `VoiceAssets`, `ParadeeVoice`, `NativeAsr`) and its `libparadeevoicejni.so` (RegisterNatives, only `JNI_OnLoad` exported), over the app's `libelizainference.so` | `AlphaVoiceCloud` local methods through `AlphaParadeeSpeech` / `AlphaLocalSpeechEngine`; provider `fused-paradee-asr`, execution `device` |
| Android phone, live voice conversation | Silero VAD in the app process (`AlphaLiveVoiceCapture`, `ElizaVoiceNative`), Phonon-2 streaming decode in the resident agent's bionic host | The agent's `POST /api/asr/local-inference/live` through the owner-authenticated agent bridge (see Live voice below) |
| Browser with the local agent | The agent's host workers load libelizainference from `ELIZA_INFERENCE_LIBRARY` | TTS `POST /api/tts/paradee` (provider `libelizainference-paradee`); ASR `POST /api/asr/libelizainference` (provider `local-inference`) |
| Browser without the local agent | none | Local speech reports `local-agent-required`; replies are read as text. There is no Web Speech, no in-browser engine and no automatic network fallback |
| Eliza Cloud | provider-side | Test-mocks builds only; production speech stays on the device (P-43) |

The app's own `ElizaVoiceNative` (embeddings and the host natives) is built from the same
upstream `elizavoice-jni.cpp` with `-DELIZA_VOICE_JNI_CLASS=ai/elizaresearch/alphaphone/ElizaVoiceNative`
and no source rewrite (`scripts/embedding-native-contract.mjs`). The paradee-voice library links
the app's engine instead of packaging a second copy, so the two must be byte-identical
(`node scripts/paradee-runtime.mjs --app-linkage`, Gradle `:app:verifyParadeeAppLinkage`).

## The voice bundle

The bundle uses the libelizainference layout and ships **in the APK assets**
(`assets/paradee-voice/v1`). On first use `VoiceAssets.install` copies it to app storage
(`filesDir/paradee-voice-v1`) and checks every file against the SHA-256 in the bundle manifest;
nothing is downloaded.

| Path | Role | Size | Licence |
| --- | --- | --- | --- |
| `tts/paradee/paradee-8m-v1_0.gguf` | Paradee-8M F32 (converted from the pinned PyTorch files) | 32 MB | Apache-2.0 |
| `tts/paradee/misaki-en-us.lex` | misaki US lexicon (converted from the pinned misaki data) | 12.9 MB | Apache-2.0 |
| `tts/paradee/espeak-ng-data/*` (7 files) | eSpeak NG English data for out-of-lexicon words | 0.8 MB | GPL-3.0-or-later (flagged) |
| `asr/phonon-2-fv5.gguf` | The ASR slot: Phonon-2 (Parakeet-TDT 0.6B, five-value weights, `general.architecture=parakeet-tdt`) | 331 MB | CC-BY-4.0 (attribution and NOTICE shipped; training-data terms flagged) |
| `vad/silero-vad-v5.gguf` | Silero VAD v5 | 0.6 MB | MIT |
| `notices/*` | eSpeak NG, misaki, spaCy and Phonon-2 (Fermion NOTICE, CC-BY-4.0 text) notices | small | as named |

The Phonon-2 GGUF (330,632,256 bytes, sha256 `dc552eb7…`) replaces the Qwen3-ASR pair
(about 1 GB), so the bundle is about 380 MB. It ships in the APK assets with the verified first-run
copy above; there is no network install path. It is converted locally by
`tools/parakeet/convert_phonon2_to_gguf.py --verify` from `FermionResearch/Phonon-2@7e153e40`
(byte-reproducible; the upstream `mobile-voice@1.1.0` catalog row is `unpublished`, so nothing is
downloaded).

### The ASR slot (P-55)

libelizainference serves `eliza_inference_asr_*` and `asr_stream_*` from whatever sits under
`asr/`: a parakeet-tdt GGUF (one file) or the Qwen3-ASR text + mmproj pair (two files).
`android/paradee-voice/asr-inputs.json` (schema 2) names the backend (`parakeet`) and pins its
files; `scripts/paradee-runtime.mjs` admits exactly the files that backend needs (one for
parakeet, two for qwen3) and refuses any other file under `asr/`, because the library would load
a stray parakeet GGUF first. The voice host record carries the same rows
(`asrSlot.backend`, `scripts/voice-host.mjs`). The APK sets `ELIZA_ASR_BACKEND=parakeet` by
default (`BuildConfig.ELIZA_ASR_BACKEND`, exported before the library loads by the pinned
`ElizaVoiceNative`/`ElizaAsrNativeEnv` and by `AlphaParadeeSpeech`); a build environment value of
`auto`, `parakeet` or `qwen3` overrides it.

**Licence.** Phonon-2 by Fermion Research is CC-BY-4.0, derived from NVIDIA
parakeet-tdt-0.6b-v3 (CC-BY-4.0). The attribution, Fermion's NOTICE
(`licenses/Phonon-2-NOTICE.txt`, also in the bundle as `notices/Phonon-2-NOTICE.txt` and in the
GGUF as `parakeet.notice`) and the licence text (`licenses/Phonon-2-LICENSE-WEIGHTS-CC-BY-4.0.txt`)
are in the generated third-party notices that Settings shows under Open source licenses. The NOTICE lists
CHiME-6 (CC-BY-SA-4.0) and SPGISpeech (Kensho terms) training audio; the entry is flagged
`unverified` for review and never blocks a build (P-09).

## Live voice (Android): Transcribe and the voice assistant

Two separate controls use the native live capture when both halves are ready
(`apps/app/src/runtime/native-live-voice.ts`, `nativeLiveVoiceReady`); otherwise each falls back to
recording a clip on the device:

- **Transcribe** (composer "Transcribe into draft"): records until Stop and puts the transcript in
  an editable review, then into the unsent draft. Nothing is sent to the agent until Send.
- **Voice assistant** (composer "Talk", title "Voice assistant"): listens continuously, sends each
  finished spoken turn and speaks the reply (`apps/app/src/runtime/voice-assistant.ts`, #423).

1. **App process.** `AlphaVoiceCloud.startLiveCapture` opens `AudioRecord` (16 kHz mono PCM16)
   and runs Silero VAD on every 32 ms window through libelizainference
   (`AlphaLiveVoiceCapture`, `ElizaVoiceNative.nativeVadProcessBatch`). `LiveVadGate` opens a
   segment after two windows at P ≥ 0.5 and closes it after 16 windows (about 512 ms) below 0.35,
   with a 320 ms pre-roll. Only segment audio is forwarded; nothing is written to storage. The
   assistant asks for `echoCancel`: the communication source with the platform
   `AcousticEchoCanceler` (and `NoiseSuppressor`) when the device has one (`LiveCaptureSource`), so
   the microphone can stay open while the reply plays. Transcribe keeps the recognition source.
   Stopping flushes the frames of an open segment that were read before the stop.
2. **Renderer.** `live-segment-stream.ts` and `live-voice.ts` forward the frames (the upstream
   `AudioFrameEvent` wire format, base64 LE s16) and VAD edges in order to the resident agent's
   `POST /api/asr/local-inference/live` through the owner-authenticated agent bridge
   (`AlphaLocalAgentPlugin` admits exactly `/api/asr/local-inference/live` and `/live/status`).
   The transport refuses every request once the resident session changed, so audio never reaches
   another owner's agent. Each closed segment yields exactly one result.
3. **Agent.** The live route (elizaOS #36213, #36214) decodes with the Phonon-2 streaming decoder
   through the bionic host (`BionicAsrStreams`, staged from the pin) and returns
   `final.text` in the response to the request that carries `speech-end`.
4. **Stop reconciliation.** Stop (Transcribe), Mute and the end of a conversation cut the capture
   at the tap: frames (stamped with the end of their audio on the capture clock, start time plus
   samples read) later than the tap are dropped, an open segment is closed at the tap and its final
   is awaited, so a transcript holds the audio up to the stop at 32 ms window granularity. Cancel
   discards everything. A segment whose transcription fails (`502 ASR_FAILED`) yields no text and
   the capture continues; an unavailable route or transport failure ends it.
5. **Endpointing (assistant).** After the last segment's final, a short gap (300 ms) asks a
   semantic end-of-turn port and a long gap (1,200 ms) submits; both follow the VAD speech-end,
   which itself trails speech by the gate's ~512 ms hangover. These are engineering defaults
   (local-speech research), not measurements or owner-set constants. **Clef is not in the pin**
   (`c7a9a0d7e7`: no Clef model, loader or decision head; only the native EOT scorer for the
   Eliza-1 text model), so no semantic port is wired and the documented VAD long-gap fallback
   decides alone. New speech before submission cancels both timers and continues the utterance.
6. **Send.** The turn goes through the existing voice policy unchanged (`VOICE_SEND_POLICY`
   in `voice-selection.ts`, MVP-01/P-01). A reply carrying action proposals ends voice for review in
   the conversation: automatic submission never approves a side effect.
7. **Barge-in and heard content.** Speech that starts while a reply is pending or playing is
   tentative. Before playback it interrupts once the VAD segment has stayed open for 700 ms (longer
   than the gate's hangover, so a blip never confirms by time) or its transcript passes the
   disfluency and echo gate; during playback only the transcript gate confirms, since residual echo
   can hold the VAD open for a whole sentence. The gate is upstream `shouldRespondToVoiceTurn`,
   applied against every sentence of the reply that has started playing. A cough or the reply's own echo leaves the reply running. While a reply plays, voice
   interrupts only over a capture whose platform echo canceller is attached and enabled
   (`echoCancelled` from `startLiveCapture`); otherwise speech during playback is ignored and the
   Stop speaking button remains. Interrupting cancels that request or playback (generation ids drop
   its late callbacks) and the speech becomes the next turn; the earlier turn is never resent.
   Replies play one sentence at a time and only sentences whose playback completed count as heard:
   the conversation view keeps that text and marks the rest
   "(Interrupted. The rest of this reply was not played.)". Stop speaking does the same by button.
   **Gaps:** the marking is this session's conversation view only. The agent's own memory still
   holds the full reply (there is no route to record the heard portion), so reloading history shows
   it in full; a reply the agent completes after the user interrupted it while it was still being
   generated is not shown in the voice session but appears in full after a reload. The 700 ms hold
   and the sentence-by-sentence synthesis gap are engineering defaults to tune on a device.

Interim text: the agent publishes ephemeral `voice-transcript` events (`speech-start`, `partial`
with the full running text, `final`, `error`) on its WebSocket event stream. `live-voice.ts`
replaces the interim text on each newer partial of the current turn, drops other sessions and
stale turns, delivers each final once and shows the interim text in the conversation view
(`data-alpha-voice-interim`, "Heard so far, not sent"). It is never stored, logged, written to a
draft or sent. **Upstream gap:** the Android agent is port-free and its IPC carries only
`http_request`/`http_request_stream`, so no event stream reaches the phone and the phone shows the
final transcript only; interim text appears where a transport carries the event stream (the
browser spec's stub agent). An IPC event channel or partials in the live response would close it:
`residentLiveTransport()` passes a `subscribe` method of the resident connection straight through,
so the assistant's interim line lights up once the IPC carries events. Nothing synthesizes a
partial in the meantime.

Latency is recorded per turn as numbers only (`voice-timing.ts` `live`: ASR mode, partial count,
speech-start to first partial, speech-end to final on the client and the agent's own last-frame to
final) and appears in the diagnostics export. Evidence: class S (node tests
`test/live-voice.test.mjs` and `test/voice-assistant.test.mjs`, the Playwright specs
`test/browser/live-voice.spec.ts` with a stub agent and `test/browser/voice-assistant.production.spec.ts`
on the flag-off renderer with synthetic native ports) and Gradle compilation; not run on an emulator
or a device. Echo, barge-in timing, lock, calls and Bluetooth need device acceptance.

## Records

- `vendor/eliza/packages/app/platforms/android/paradee-voice/inputs.json` (upstream): the Paradee
  GGUF and misaki lexicon pins and the eSpeak NG source.
- `android/paradee-voice/asr-inputs.json`: the ASR slot (backend `parakeet`, the Phonon-2 GGUF).
- `android/voice-host/qualified-voice-host.json` (schema 2, `scripts/voice-host.mjs`): the exact
  engine library per ABI (`libelizainference.so`, `libc++_shared.so`), every bundle file, the
  components and their licences, the reference JNI builds and the evidence. `qualified` is
  **false** and stays false until on-device qualification on both ABIs and device acceptance are
  recorded; the schema refuses `qualified: true` without them. The notices
  (`scripts/generate-licenses.mjs`) and the SBOM (`scripts/generate-sbom.mjs`) read it.

## Build, stage and verify

1. Build the shared outputs at the pin with the upstream builder, outside `vendor/eliza`
   (NDK 28.2; it converts the Paradee GGUF and misaki lexicon from pinned sources and checks them):
   `node vendor/eliza/packages/app/scripts/paradee-voice/build-native.ts --workspace <dir> --out <dir>`.
   The bundle assets recorded today were built this way at eliza `c7a9a0d7e7` (llama.cpp
   `5df17a66`) on 2026-10-14; the engine bytes recorded for both ABIs come from
   `node scripts/prepare-embedding-host.mjs --build --remap-build-path` at the same source, so the
   voice host and the embedding host name the same, path-independent engine.
2. Put the Phonon-2 GGUF, its NOTICE and licence text, and Silero VAD in a directory (their
   pinned sources are in the record).
3. Stage: `node scripts/android-stage-voice-models.mjs --from <build-native output> --from <model directory>`.
   Every file is checked by size and SHA-256 against the record and written to
   `.eliza/paradee-voice/native` (`jniLibs/<abi>/libelizainference.so`, the bundle under
   `assets/paradee-voice/v1`, and `build-record.json`). `--plan` lists the rows. Changed bytes are
   refused, never repaired. `--unrecorded-engine` exists only for hosted developer-APK runs that
   rebuild the engine: it rewrites that workspace's record (never committed) and stays unqualified.
4. Gradle checks the staged outputs: `:local-speech:verifySpeechInputs`
   (`scripts/paradee-runtime.mjs`), `:app:verifyParadeeAppLinkage` and `:app:verifyVoiceHost`
   (`scripts/voice-host.mjs --verify`). A distribution build needs them; the explicit
   `--allow-unpackaged-runtime` developer lane may omit them, and local speech then reports
   unavailable.
5. `npm run android:build:inputs` lists "on-device voice outputs" and "on-device voice qualified"
   as inputs only a person can supply. `scripts/verify-apks.mjs` checks a packaged bundle and
   engine against the record and records a release distributable only with a qualified voice host
   (`scripts/release-blockers.mjs`).

The app's engine comes from the embedding host (`android/embedding-host/qualified-host.json`),
which needs requalification at this pin (RegisterNatives JNI and the new gitlink); the candidate
libraries are named in its `requalification` note.

## Development host (browser with the local agent)

Configuration uses the upstream names only (`scripts/speech-env.mjs`):
`ELIZA_INFERENCE_LIBRARY` with its independently reviewed `ELIZA_INFERENCE_LIBRARY_SHA256`,
`ELIZA_PARADEE_ENABLED` / `ELIZA_PARADEE_MODEL_DIR` for TTS and `ELIZA_ASR_ENABLED` /
`ELIZA_ASR_MODEL_DIR` for ASR (`1` requires, `0` turns off, unset enables only with a model
directory). The earlier Alpha-only names (`ALPHA_LOCAL_TTS`, `ALPHA_TTS_LIBRARY`,
`ALPHA_TTS_MODEL_DIR`, `ALPHA_LOCAL_ASR`, `ALPHA_ASR_MODEL_DIR`, `ALPHA_WHISPER_*`,
`ALPHA_ASR_MODEL`) are refused with their replacement; a saved `local-speech.json` is read with the
renamed keys and warns. Exact host asset paths and hashes are in `scripts/host-speech-assets.json`
([host speech migration](host-speech-migration-2026-10-14.md)).

## Always-on listener (`:sense`)

The AOSP-image-only listener APK uses the same library: `ListeningService` installs the bundle with
`VoiceAssets.install` and opens `NativeAsr` on the ASR slot. It packages its own copy of the staged
engine (`.eliza/paradee-voice/native/jniLibs`). `stage-aosp --production` refuses a listener APK
without the bundle manifest, without the Phonon-2 ASR file or whose engine is not the recorded bytes
(`scripts/aosp-listener.mjs`). No listener APK with a voice bundle has been built, staged or booted.

The listener only decides whether the user addressed Alpha: energy VAD (`SpeechGate`), batch
Phonon-2 recognition of the utterance in RAM, then `WakePhrase`. It has no network permission and
keeps no audio or transcript. On the wake phrase it opens `AlphaAssistActivity`, and the renderer
starts the voice assistant above (Silero VAD, streaming Phonon-2 through the resident agent on this
phone, Paradee replies, barge-in) when the invocation is the listener's, the phone is unlocked and
the surface is visible (`installListenerInvocation`, `listenerStartsVoice`). The listener releases
the microphone while Alpha records and ignores speech while Alpha speaks.

## Evidence

Class B only. At `c7a9a0d7e7` the engine and JNI libraries were built for both ABIs on
2026-10-14 and symbol-checked (voice ABI 18, `paradee_supported()=1`, `asr_supported()=1`, 83
`eliza_inference_*` exports including the six `asr_stream_*`, `parakeet_lib` and eSpeak NG linked,
16 KiB alignment, only `JNI_OnLoad` exported by the JNI bridges). The host gates were not rerun at
this pin; the earlier host runs of the same Phonon-2 GGUF (elizaOS/eliza#36212: batch and
streaming transcripts exact under `-Xcheck:jni`, Paradee to Phonon-2 round trip exact) and of
Paradee (parity SNR 58 to 76 dB) are host evidence, not Android execution. Nothing here has run on an emulator, an image or a device, and the hosted
`fused-speech` emulator suite refuses to start until hosted staging exists. On-device
qualification (`vendor/eliza/packages/app/scripts/paradee-voice/qualify`) and device acceptance are
still required.

## Upstream gaps

- Interim live transcripts do not reach the Android app: the agent publishes `voice-transcript`
  events only on its WebSocket, and the port-free agent IPC has no event channel (see Live voice).
- The app-process recorded-clip path (`NativeAsr.transcribe`, used by Notes dictation and when the
  live route is not ready) is batch; Paradee returns a complete buffer.
- The Paradee GGUF, the misaki lexicon and the Phonon-2 GGUF are not published for download; they
  come from the pinned, byte-reproducible conversions.
- Closed at this pin by elizaOS/eliza#36239 and elizaOS/llama.cpp#79: AOSP stages eSpeak NG data,
  the Paradee GGUF is named `v1_0` everywhere, and the eSpeak NG data path limit is 1024 bytes.
