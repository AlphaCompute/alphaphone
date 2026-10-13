# Fused speech: libelizainference on the device and on the local agent

Alpha Phone has one local speech engine: **libelizainference**, the llama.cpp-based native
library from the elizaOS fused fork. It contains ggml and mtmd (the audio-LLM path used for
ASR), OmniVoice, `kokoro_lib` (Kokoro TTS) and Silero VAD, and it loads GGUF models only.
The owner removed every other local engine (decision P-10), because the earlier runtimes were
too slow and used too much memory on phones. No build ships another inference runtime, model
format or in-browser recognizer. `test/llama-cpp-only.test.mjs` and the bundle audit
(`scripts/audit-production-bundle.mjs`) enforce this.

| Where | Engine | Route |
| --- | --- | --- |
| Android phone | `libelizainference.so` + `libelizavoicejni.so` (JNI symbols relocated to `ai.elizaresearch.alphaphone`) + `libc++_shared.so`, staged per ABI | `AlphaVoiceCloud` reports provider `libelizainference-cpu` |
| Browser with the local agent | The agent's host workers load libelizainference from `ELIZA_INFERENCE_LIBRARY` | TTS: `/api/tts/kokoro` (upstream `host-tts-worker`). ASR, phase 1: `/api/asr/whisper` (provider `standalone-whisper.cpp`); phase 2: `/api/asr/local-inference` (provider `local-inference`) once upstream ships a standalone host ASR worker |
| Browser without the local agent | none | Local speech reports `local-agent-required`; there is no in-browser engine and no silent fallback to Cloud |
| Eliza Cloud | provider-side | The disclosed opt-in route (decision P-07) |

## Build, stage and verify

The voice host reuses the embedding-host build, which already produces the same three
libraries from the pinned fused fork:

```sh
# Build the fused engine and the relocated JNI host for one ABI into a new isolated directory.
node scripts/prepare-embedding-host.mjs --fork <pinned fused-fork checkout> --output <new directory> --abi arm64-v8a --build
# Stage the qualified libraries into the APK inputs (fails unless the hashes match the record).
node scripts/stage-embedding-host.mjs
```

`android/voice-host/qualified-voice-host.json` records the voice capabilities of those
libraries, and the Android build checks the staged bundle against it (`:app:verifyVoiceHost`,
`node scripts/stage-embedding-host.mjs --verify-voice`). The voice models are staged from a
directory of pinned files, never downloaded by the build:

```sh
# Admit the voice symbols of an already prepared host (arm64 bytes must equal the embedding host).
node scripts/stage-embedding-host.mjs --receipt-voice <PREPARATION.json>
# Generate the Kokoro lexicon from the pinned CMUdict and stage the pinned voice files.
node scripts/android-voice-lexicon.mjs
node scripts/android-stage-voice-models.mjs --from <directory of pinned voice models>
```

The bundle is staged at `android/app/src/main/assets/voice/v1` and installed on first use into
`noBackupFilesDir/voice/v1`. Without a bundle the build is valid: local speech then reports
unavailable and the disclosed Cloud route stays (decision P-07). The x86_64 host is not yet
built, so emulator evidence (class E) for on-device speech needs an x86_64 build through the
same path first. These commands produce build evidence (class B) only. Intelligible speech,
transcription accuracy, memory and latency need emulator (E) and device (D) evidence, and
decision A-24 stays open until they are re-run on this engine.

## Qualification record

`android/voice-host/qualified-voice-host.json` is the single record that the Android build gate
(`readVoiceHost` in `scripts/stage-embedding-host.mjs`), the notices
(`scripts/generate-licenses.mjs`, `voiceHostProblems`), the SBOM (`scripts/generate-sbom.mjs`)
and their tests read. There is one schema, version 1:

```json
{
  "schemaVersion": 1,
  "pin": "<elizaOS commit, 40 hex; must equal upstream.lock.json>",
  "forkPin": "<fused llama.cpp fork commit, 40 hex>",
  "identity": "ai.elizaresearch.alphaphone",
  "provider": "libelizainference-cpu",
  "bundle": {"format": "alpha-voice-bundle-v1", "assetRoot": "android/app/src/main/assets/voice/v1",
             "deviceDirectory": "noBackupFilesDir/voice/v1", "textModel": false},
  "abis": [
    {"abi": "arm64-v8a", "release": true, "variant": "cpu",
     "libraryRecord": "android/embedding-host/qualified-host.json",
     "libraries": [{"name": "libelizainference.so", "sha256": "<64 hex>", "bytes": 0, "alignment16KiB": true}],
     "requiredFusedSymbols": ["…"], "requiredJniSymbols": ["…"], "abiVersionMin": 16,
     "alignment16KiB": true, "voiceSymbolsVerified": false, "voiceQualificationReceiptSha256": null},
    {"abi": "x86_64", "release": false, "libraryRecord": null, "libraries": [], "…": "…"}
  ],
  "components": [
    {"name": "…", "version": "…", "license": "<SPDX or LicenseRef>", "source": "<url>",
     "licenseFile": "licenses/<file>", "licenseSha256": "<64 hex>"}
  ],
  "models": [
    {"name": "Kokoro-82M v1.0", "path": "tts/kokoro/kokoro-82m-v1_0.gguf", "role": "tts-model",
     "sha256": "<64 hex>", "bytes": 0, "license": "Apache-2.0", "source": "<url>",
     "revision": "<revision>", "status": "pinned (…)"},
    {"name": "Eliza-1 ASR text model", "path": "asr/eliza-1-asr.gguf", "role": "asr-model",
     "sha256": null, "bytes": null, "license": null, "source": null, "revision": null,
     "status": "open: …"}
  ],
  "lexicon": {"name": "…", "path": "g2p/en-us-lexicon.tsv", "role": "lexicon", "sha256": "<64 hex>",
              "bytes": 0, "license": "BSD-2-Clause", "generator": "scripts/android-voice-lexicon.mjs",
              "source": {"name": "CMU Pronouncing Dictionary", "url": "<url>", "revision": "<40 hex>",
                         "sha256": "<64 hex>", "bytes": 0, "notice": "licenses/cmudict-BSD-2-Clause.txt"}},
  "evidence": {"buildReceipt": null, "emulatorDeviceExecuted": false, "deviceExecuted": false,
               "functionalAcceptance": null}
}
```

- An ABI whose `libraries` is empty is not yet voice-qualified. The notices say so and name its
  `libraryRecord` (for arm64 the embedding-host bytes, which already ship for embeddings); the
  SBOM lists no voice library for it. Once `voiceSymbolsVerified` is true the libraries must be
  listed with their hashes and sizes.
- Model roles are `asr-model`, `asr-mmproj`, `tts-model`, `tts-voice` and `vad-model`. Every
  model is GGUF except the Kokoro voice preset (`tts-voice`), a `.bin` of style vectors that
  Kokoro reads as data. A row with `sha256: null` is open: its `status` starts with `open`, it
  cannot be staged, and the notices and SBOM do not list it.
- The lexicon is listed with the CMUdict notice it names. Its intelligibility is unqualified.
- `components` is optional. Without it the notices list the fused sources: llama.cpp, ggml and
  mtmd (MIT), the elizaOS voice sources (unverified, with a recorded reason), Silero VAD (MIT)
  and LLVM libc++.
- A model with no `license` is listed as `UNVERIFIED`. Terms that are not an open-source licence,
  such as the Gemma Terms of Use for an ASR pair, are flagged and never block a build (decision
  P-09). Name a `licenseFile` to ship its text; it must match `licenseSha256`. Without one the
  canonical SPDX text is used and the entry is flagged `licence-text-missing-from-package`.
- A pin bump must re-record this file before any voice-packaged build; `readVoiceHost` requires
  `pin` to equal `upstream.lock.json`.

## Upstream gaps

These are upstream (elizaOS) work. Alpha does not edit `vendor/eliza`; it consumes reviewed commits.

- Streaming ASR is a stub (`eliza_inference_asr_stream_supported()` returns 0). Only batch
  `nativeAsrTranscribe` exists, so partial transcripts and early stop are not possible.
- Running ASR cannot be cancelled, and Kokoro synthesis cannot be cancelled from JNI (Alpha
  cancels between phrases).
- There is no Android-native G2P upstream. Kokoro needs en-US IPA; the only upstream phonemizer
  is the agent's GPL-3.0 espeak-ng WASM (to be flagged, not blocked). Alpha works around it with a
  Java front end over a lexicon generated from the pinned CMUdict (`AlphaKokoroG2p`); its
  intelligibility is unqualified.
- Memory release is coarse: weights drop only when the whole context is destroyed.
- No product-qualified, mobile-sized ASR GGUF pair (text model plus `eliza-1-asr-mmproj.gguf`)
  with a licence, model card and RAM budget exists yet.
- There is no standalone host ASR worker like `host-tts-worker`, so the browser's local route
  still uses standalone whisper.cpp for ASR (phase 1 above).
- `ElizaBionicInferenceServer.asr()` logs transcript text; it should log sizes only.
- Capabilities must be probed through the `*_supported()` functions; exported symbols alone do
  not prove them. JNI identity relocation still relies on rewriting the JNI source text.
- Kokoro intelligibility and fused ASR accuracy have no upstream round-trip gate on Android.
- Upstream still ships the retired speech engines; an upstream PR should deprecate them. Alpha
  does not consume them.
