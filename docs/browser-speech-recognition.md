# In-browser speech recognition (web build)

The browser build recognizes speech locally with **Whisper tiny.en** running on **ONNX Runtime
Web (WebAssembly)** in a dedicated worker. Recorded audio never leaves the device; the only
network traffic is the one-time download of the model files from this app's own origin. This
matches Android, which runs Whisper tiny.en on the device through sherpa-onnx.

**English only.** Like OCR, recognition is English-only for now; the recorder states this before
recording. Other languages are a separate model and product decision.

## Flow (no auto-send)

Notes **Record and transcribe**, Notes **Dictate**, chat **Talk** and every other entry that opens
the Notes recorder use the same states:

Ready → Start recording → Stop recording (nothing loaded or uploaded) → **Transcribe in this
browser** → model download/start-up progress → **Review transcript** (editable) → Save note /
Apply transcript / Use in conversation. The transcript is a draft. A conversation message is
only sent when the user presses Send in the composer. **Record without transcription** keeps the
manual path.

| State (`data-voice-state` on the recorder) | Shown to the user |
| --- | --- |
| `denied` | Microphone access is blocked, with site-settings guidance. Start recording retries. |
| `no-microphone` | No usable microphone; connect or enable one. |
| `transcribing` | `Loading the speech model from this app: N of 56 MB`, then `Starting the speech model`, then `Transcribing in this browser`. Cancel transcription is available throughout. |
| `no-speech` | No speech detected. **Record again** or **Type transcript instead** (keeps the recording). Silence is detected before any model download. |
| `model` | The speech model could not be loaded (missing, failed verification, network). Transcribe retries; **Type transcript instead** keeps the recording. |
| `recognition` | Recognition failed for this clip; retry or type instead. |

Cancellation, a hidden page (`visibilitychange`) or `pagehide` terminate the worker immediately,
which stops the download and inference. The recorder's generation token rejects any late result,
and returning to the foreground prepares the same route again. A finished transcription leaves
the verified model loaded in the worker for the next recording.

## Provenance

A saved voice note records how its transcript was produced in `transcription`:

```json
{"route":"browser","engine":"whisper","model":"whisper-tiny.en",
 "modelRevision":"Xenova/whisper-tiny.en@79fb389fc764e7c395bd330e9531d9d32ada7049",
 "runtime":"onnxruntime-web 1.30.0 (WebAssembly, single thread)","language":"en","edited":true}
```

`edited` is true when the saved text differs from the recognized text. Manually typed
transcripts record `{"route":"manual"}`; other routes record only what their engine reports
(`on-device`, `paired-agent`, `eliza-cloud`, `local-agent`).

## Assets, bundle size and licensing

Pins live in `config/browser-speech.json`:

| Published file (`web-dist/browser-speech/…`) | Source | Bytes |
| --- | --- | --- |
| `whisper-tiny.en/encoder_model_quantized.onnx` | `Xenova/whisper-tiny.en` @ `79fb389f…` | 10,124,913 |
| `whisper-tiny.en/decoder_model_merged_quantized.onnx` | same | 30,727,382 |
| `whisper-tiny.en/vocab.json`, `generation_config.json` | same | 1,000,776 |
| `ort/ort-wasm-simd-threaded.wasm`, `.mjs` | npm `onnxruntime-web@1.30.0` | 14,264,278 |
| `manifest.json` | generated: roles, sizes, SHA-256 | <1 KB |

Total ≈ 56.1 MB (≈ 28.9 MB if the server compresses it), fetched lazily on the first
transcription only and then served from the HTTP cache. Measured against `main` at
`2f18158a`: `web-dist` grows from 25.7 MB to 82.7 MB (the model, the 57 KB worker chunk loaded
on first use, and longer license notices); the start-up chunk grows by 2.4 KB (1.1 KB gzip).
APK web payloads do not grow by the model. The worker verifies every file's size and SHA-256 against the
build manifest before use.

- `npm run browser-speech:prepare` (run automatically before `build`, `build:test-mocks`, `dev`,
  `dev:ui` and `dev:maps`) downloads missing model files once from the pinned Hugging Face
  revision into `.eliza/browser-speech/<revision>/` and verifies them. Set
  `ELIZA_BROWSER_SPEECH_DIR` to use a pre-provisioned directory (verified, never written).
  A production build fails if any file is missing or does not match its pin. The development
  server serves the files from the same verified sources.
- The browser never contacts a third party: no CDN, model hub or runtime fetch outside the app.
- **Android omits these assets.** `npm run android:sync` prunes `browser-speech/` from the synced
  web payload and APK verification fails if it is packaged; Android uses its native recognizer.
- Notices: the model entry (OpenAI Whisper MIT, and the conversion's Apache-2.0 model card pinned
  in `licenses/whisper-tiny.en-onnx-MODEL_CARD.md`) and ONNX Runtime's pinned
  `licenses/onnxruntime-web/ThirdPartyNotices.txt` for the libraries statically linked into the
  WebAssembly (allowlisted as `license unverified` pending legal review), plus every new npm
  package, are generated by `scripts/generate-licenses.mjs`.

### Why this engine

- **Whisper tiny.en ONNX int8 on onnxruntime-web** was chosen: the same model family as Android,
  MIT runtime from an exactly pinned npm package (no native toolchain or committed binaries),
  56 MB total and lazy, and about a second per short clip single-threaded on a desktop CPU.
- The sherpa-onnx int8 export used on Android is 103 MB (its decoder alone is 90 MB) and its WASM
  build would have to be compiled and committed; whisper.cpp WASM (31–42 MB models) likewise
  needs an Emscripten build that is not reproducible from the lockfile.
- The browser Web Speech API was not used: in most browsers it sends audio to the vendor's cloud
  service, which conflicts with on-device speech. No opt-in to it exists.

## Verification

- `test/browser-speech-engine.test.mjs`: mel filters/features, token decoding, suppression,
  no-speech policy, and an **accuracy check** on three repository narration clips with known
  scripts (`design-assets/video/narration`, word error rate ≤ 0.2) using the pinned model and
  runtime in Node. It is skipped, with the reason, when the assets are not prepared.
- `test/browser-speech-recognizer.test.mjs`, `test/voice-states.test.mjs`,
  `test/browser-speech-assets.test.mjs`: worker ownership, cancellation and late results; state
  classification, progress and provenance; pins, verification and Android pruning.
- `test/browser/browser-speech.spec.ts` (Playwright, Chromium): a synthetic WAV played through a
  fake `getUserMedia` stream into the real MediaRecorder, recognized by the real model (WER ≤ 0.25),
  edited and saved with provenance; silence, denial, model load failure, cancel and background
  during the model download; chat Talk into the composer without sending.

This is browser evidence only. It does not establish physical-microphone quality, latency on
low-end devices or any Android behavior.
