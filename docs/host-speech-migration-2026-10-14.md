# Host speech configuration after the shared runtime migration

The explicit development host uses authenticated `/api/tts/paradee` and
`/api/asr/libelizainference` routes. Their reported providers are
`libelizainference-paradee` and `local-inference`. This configuration does not
admit Android models or establish product/device qualification.

For `start-local-remote.mjs`, choose `ALPHA_LOCAL_TTS` and `ALPHA_LOCAL_ASR`
(`auto`, `off`, or `required`). Auto enables only an explicitly selected model
directory. Supply the absolute `ELIZA_INFERENCE_LIBRARY` and its independently
reviewed `ELIZA_INFERENCE_LIBRARY_SHA256`; the launcher never converts an
arbitrary installed library's current hash into a trusted hash. Supply
`ELIZA_PARADEE_MODEL_DIR` and/or `ELIZA_ASR_MODEL_DIR`. The private profile's
`local-speech.json` accepts these same nonsecret values, including the digest.
Explicit environment values override saved settings. Old Whisper executable,
backend, single-model, `ALPHA_TTS_LIBRARY`, `ALPHA_TTS_MODEL_DIR` and
`ALPHA_ASR_MODEL_DIR` selections are rejected.

The TTS directory contains the shared pinned Paradee GGUF and Misaki lexicon.
If `espeak-ng-data` is present its English data pins are checked too; without
that optional directory, the shared worker spells unknown words letter by
letter. ASR requires the shared pinned Qwen3-ASR GGUF pair under `asr/` and
Silero VAD under `vad/`, with no alternative VAD GGUF. Exact paths, sizes and
hashes are in `scripts/host-speech-assets.json`; a test compares them against
the checked-out shared workers. Assets are not downloaded by these launchers.

The direct voice and frozen combined launchers accept
`ELIZA_PARADEE_MODEL_DIR` and `ELIZA_ASR_MODEL_DIR` with the same library and
reviewed digest. The direct voice launcher enables ASR only when explicitly
requested by `ELIZA_ASR_ENABLED=1`; combined requires both sets. The launcher
checks assets before dispatch, and the shared worker checks them again before
loading native code. There is no Whisper CLI warmup. A launch configuration
receipt is not readiness: inspect the authenticated route status after native
worker initialization. Cancellation releases the HTTP caller while the worker
remains busy until its result or cancellation timeout retires that generation.

`fingerprint-voice-assets.mjs` admits both configured model directories before
recording their hashes and discoverable Mach-O dependencies. Unresolved and
system dependencies remain explicit limitations of that closure record.

The old cold-Kokoro, paired-Whisper, agent-ASR/TTS and combined voice-roundtrip
campaign entrypoints explicitly refuse to run. They embed retired model and
independent recognizer assumptions and cannot qualify this runtime. Their
historical source and existing evidence are retained. Current admission,
service lifecycle, protocol and proxy tests exercise source behavior with
synthetic inputs; new installed-asset, intelligibility, cold-start latency and
physical-device campaigns remain necessary. No new runtime qualification is
claimed by this migration.

The loopback development agent's `/transcribe` endpoint also uses the shared
ASR service. It requires Bun, canonical `ELIZA_ASR_MODEL_DIR` configuration,
and a prepared source tree verified against the product pin before importing
the service. WAV is validated directly by the shared parser; compressed audio
still uses bounded local ffmpeg conversion. `/health` reports local ASR ready
only after native worker initialization. Shutdown stops the worker, and
cancelled or late recognition cannot return a successful transcript. The Node
only diagnostic server does not advertise native ASR availability.
