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

The Android voice-host work (a separate change to `android/` and the Android build scripts)
extends this to the voice capabilities and writes the qualification record
`android/voice-host/qualified-voice-host.json`; the Android build preflight checks the staged
libraries against it. The x86_64 host is not yet qualified, so
emulator evidence (class E) for on-device speech needs an x86_64 build through the same path
first. These commands produce build evidence (class B) only. Intelligible speech, transcription
accuracy, memory and latency need emulator (E) and device (D) evidence, and decision A-24
stays open until they are re-run on this engine.

## Qualification record

`android/voice-host/qualified-voice-host.json` is the single input that the notices
(`scripts/generate-licenses.mjs`), the SBOM (`scripts/generate-sbom.mjs`) and their tests read.
Its schema is version 1:

```json
{
  "schemaVersion": 1,
  "pin": "<elizaOS commit, 40 hex>",
  "forkPin": "<fused llama.cpp fork commit, 40 hex>",
  "identity": "ai.elizaresearch.alphaphone",
  "provider": "libelizainference-cpu",
  "abis": [
    {"abi": "arm64-v8a", "libraries": [
      {"name": "libelizainference.so", "sha256": "<64 hex>", "bytes": 0},
      {"name": "libelizavoicejni.so", "sha256": "<64 hex>", "bytes": 0},
      {"name": "libc++_shared.so", "sha256": "<64 hex>", "bytes": 0}
    ]}
  ],
  "components": [
    {"name": "…", "version": "…", "license": "<SPDX or LicenseRef>", "source": "<url>",
     "licenseFile": "licenses/<file>", "licenseSha256": "<64 hex>"}
  ],
  "models": [
    {"name": "Kokoro-82M", "role": "tts", "revision": "<repo@revision>", "path": "<file>.gguf",
     "sha256": "<64 hex>", "bytes": 0, "license": "Apache-2.0", "source": "<url>"}
  ]
}
```

- `components` is optional. Without it the notices list the fused sources: llama.cpp, ggml and
  mtmd (MIT), the elizaOS voice sources (unverified, with a recorded reason), Silero VAD (MIT)
  and LLVM libc++.
- Every model must be GGUF. A model with no `license` is listed as `UNVERIFIED`. Terms that are
  not an open-source licence, such as the Gemma Terms of Use for an ASR pair, are flagged and
  never block a build (decision P-09). Name a `licenseFile` to ship its text; it must match
  `licenseSha256`. `licenses/cmudict-BSD-2-Clause.txt` is kept for the Kokoro lexicon.
- Until the record exists, the notices and the SBOM carry no speech entries.

## Upstream gaps

These are upstream (elizaOS) work. Alpha does not edit `vendor/eliza`; it consumes reviewed commits.

- Streaming ASR is a stub (`eliza_inference_asr_stream_supported()` returns 0). Only batch
  `nativeAsrTranscribe` exists, so partial transcripts and early stop are not possible.
- Running ASR cannot be cancelled, and Kokoro synthesis cannot be cancelled from JNI (Alpha
  cancels between phrases).
- There is no Android-native G2P. Kokoro needs en-US IPA; the only upstream phonemizer is the
  agent's GPL-3.0 espeak-ng WASM (to be flagged, not blocked).
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
