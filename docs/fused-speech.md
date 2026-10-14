# Fused speech: libelizainference on the device and on the local agent

Alpha Phone has one local speech engine: **libelizainference**, the llama.cpp-based native
library from the elizaOS llama.cpp fork (decision P-42). At the pin `644d56c93d` (llama.cpp
gitlink `3f131ab9`, voice ABI 18) it contains ggml and mtmd (the audio-LLM path used for ASR),
the **Paradee-8M** speech graph on the shared kokoro layers (P-54), the native **misaki** English
G2P, **eSpeak NG 1.52.0** (statically linked, used only for words the misaki lexicon does not
know) and Silero VAD. It loads GGUF models only; no ONNX runtime or model ships anywhere
(`test/llama-cpp-only.test.mjs`, `scripts/audit-production-bundle.mjs`).

| Where | Engine | Route |
| --- | --- | --- |
| Android phone | The shared paradee-voice library (`:local-speech`, Java package `ai.eliza.voice`: `VoiceAssets`, `ParadeeVoice`, `NativeAsr`) and its `libparadeevoicejni.so` (RegisterNatives, only `JNI_OnLoad` exported), over the app's `libelizainference.so` | `AlphaVoiceCloud` local methods through `AlphaParadeeSpeech` / `AlphaLocalSpeechEngine`; provider `fused-paradee-asr`, execution `device` |
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
| `asr/eliza-1-asr.gguf`, `asr/eliza-1-asr-mmproj.gguf` | The ASR slot (today Qwen3-ASR-0.6B Q8_0 and its projector) | 805 MB + 214 MB | Apache-2.0 |
| `vad/silero-vad-v5.gguf` | Silero VAD v5 | 0.6 MB | MIT |
| `notices/*` | eSpeak NG, misaki and spaCy notices | small | as named |

The ASR pair is large (about 1 GB). The existing design ships it in the APK assets with the
verified first-run copy above; there is no network install path.

### The model-agnostic ASR slot (P-55)

libelizainference picks the ASR pair by the canonical names under `asr/`, so the slot does not
depend on the model. `android/paradee-voice/asr-inputs.json` pins the pair that fills it (paths,
sizes, SHA-256, sources) and records the intended model, **Phonon-2** (elizaOS/eliza#36212, open on
2026-10-14). When #36212 is merged and the pin moves to a develop commit that contains it, change
`asr-inputs.json` and the ASR rows of `android/voice-host/qualified-voice-host.json` to the
Phonon-2 files from that bundle record and restage; no code changes. Phonon-2 weights are
CC-BY-4.0 and will be flagged in the notices.

## Records

- `vendor/eliza/packages/app/platforms/android/paradee-voice/inputs.json` (upstream): the Paradee
  GGUF and misaki lexicon pins and the eSpeak NG source.
- `android/paradee-voice/asr-inputs.json`: the ASR slot pair.
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
   The engine bytes recorded today were built this way from eliza `4028a73e` (same llama.cpp
   gitlink `3f131ab9`).
2. Put the ASR slot pair and Silero VAD in a directory (their pinned sources are in the record).
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
without the bundle manifest, without the ASR slot pair or whose engine is not the recorded bytes
(`scripts/aosp-listener.mjs`). No listener APK with a voice bundle has been built, staged or booted.

## Evidence

Class B only. The engine and JNI libraries were built for both ABIs and symbol-checked (voice ABI
18, `paradee_supported()=1`, `asr_supported()=1`, 16 KiB alignment, only `JNI_OnLoad` exported).
Host gates on macOS arm64 with the same fork commit passed (Paradee parity SNR 58 to 76 dB; ASR WER
0.0257 on 100 LibriSpeech utterances; Paradee to ASR round-trip WER 0.0386). Those are host runs,
not Android execution. Nothing here has run on an emulator, an image or a device, and the hosted
`fused-speech` emulator suite refuses to start until hosted staging exists. On-device
qualification (`vendor/eliza/packages/app/scripts/paradee-voice/qualify`) and device acceptance are
still required.

## Upstream gaps

- Phonon-2 (elizaOS/eliza#36212) and streaming ASR are not merged; ASR is batch (`NativeAsr.transcribe`
  on a complete 16 kHz buffer) and Paradee returns a complete buffer.
- AOSP bootstrap passes no eSpeak data to `eliza_inference_paradee_load`, and the mobile voice
  catalog names `paradee-8m-v1.0.gguf` while the library expects `paradee-8m-v1_0.gguf`.
- The Paradee GGUF and misaki lexicon are not published for download; they come from the pinned
  conversion in the upstream builder.
- libespeak-ng accepts a data path of about 135 bytes; on-device bundle paths must stay short.
