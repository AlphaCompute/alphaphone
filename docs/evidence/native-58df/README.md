# Native component qualification — 2026-10-23

Eliza source: `58dfddf87ee5adec414746a86a23dada124fbbae`.
Native engine: `6003a10368d8a6d5fb1f70fe9c63a70866e8bcff`, FFI ABI 19.
Fresh engines were built with NDK 28.2.13676358 from clean isolated checkouts;
all 21 outputs in `voice-build-record.json` were checked by size and SHA-256.
No vendor source was edited.

The canonical Paradee v1.1 model is 31,275,232 bytes, SHA-256
`f205ab055f0120d571aa6fda2deadde1e6fbc88e8d8bd56a592917fd0e50892e`.
Its reproduction succeeded in [workflow run 39920314121](https://github.com/AlphaCompute/alphaphone/actions/runs/39920314121).
The Linux conversion candidates with different hashes were not admitted.

## Component results

| Test | Pixel ARM64, API 37 | Emulator x86_64, API 35 | Gate |
| --- | --- | --- | --- |
| Recognition: 101 utterances, 2,064 words | 40 errors, 1.938% WER | 44 errors, 2.132% WER | ≤6% |
| Synthesis round trip: 230 sentences, 3,753 words | 169 errors, 4.503% WER | 166 errors, 4.423% WER | ≤8% |
| Silence recognition | Empty | Empty | Empty |
| Full Alpha JNI BGE embedding | Pass, two open/close cycles | Pass, two open/close cycles | 384 finite dimensions; repeat, semantic, Unicode and NUL checks |

The speech tests use pinned corpus audio and synthesis-to-recognition round trips,
without sample limits or threshold overrides. They do not test microphones or speakers.
The embedding harness uses the full Alpha RegisterNatives bridge, the current engine,
and pinned BGE weights. Its Java normalization matches the Alpha session; the test
does not claim raw native vectors have unit norm.

The JNI bridge was built at `b322e38de25a2c2ff26a137552e4470ec2ccc0cc`.
Its native/generated inputs were verified equivalent to the current source pin.
The admission receipt preserves that original revision and separately records the
fresh engine, rather than relabeling the older JNI build. APK/input receipts and
raw component reports are retained alongside this document. The exact embedding
harness test, Gradle configuration and preparation script are retained in
`embedding-harness/`; its absolute paths describe this run and must be adapted
when reproducing it elsewhere. Absolute paths in
receipts identify the original build workspace, not portable prerequisites.
All temporary qualification packages were removed from both devices after testing.

## Acceptance still required

`qualified` remains **false**. Current streaming/cancellation, installed Alpha
capture/playback, signed release delivery, real provider login and inference,
maps coverage/navigation, browser workflows, and user acceptance remain separate
checks. These component reports prove neither an AOSP image boot nor production
rollout. No existing Alpha app or HOME role was changed by these qualification runs.

## Repository and APK checks

`npm run verify` passed (1,797 tests passed, five skipped, zero failures),
including type checking, the renderer build and bundle audit. `npm run android:build`
passed for standalone and launcher debug/release variants, with test mocks disabled
and the resident runtime packaged. The APK verifier reports both releases
`distributable: false` because voice device acceptance and release signing remain
open. Building the APKs did not run their installed-app acceptance tests.

## Packaged Alpha speech bridge

The standalone and launcher app APKs passed the offline Capacitor bridge
test on the API 35 x86_64 emulator. It covers fixture AAC transcription, streamed
synthesis, playback completion, explicit stop, queued cancellation and recovery.
See `packaged-bridge/results.json` for exact app/test APK hashes and raw class logs
alongside it. This does not prove physical microphone/speaker or signed-in workflows.

The initial test submitted speech during resident startup. A temporary debug trace
identified `releaseLocalSpeech` stopping that utterance when the selected connection
changed. The test now waits for the production sign-in page to finish connection
work, while retaining the account/session cancellation guard. Temporary product
tracing was removed, and the bridge run's standalone APK matches the original pre-trace
SHA-256 `2418a1cd0341721a042b1e11a1cfc055eb4b92f5317d364d809d6ac5dff81e27`.
The startup wait applies only to production builds; test-mocks builds keep their
existing readiness path.

The final combined run passed **12 tests, zero failures and zero skips**: six
each in standalone and launcher. It includes native transcription/synthesis,
model reuse and reopen, the Capacitor bridge, note read-aloud and stop, Silero VAD,
and sentence cancellation/recovery. `packaged-speech/results.json` binds the run
to both app APKs and instrumentation APKs; its class logs are retained beside it.
Those are rebuilt APKs (standalone `bb74f35a…`, launcher `c037cac1…`), not the
bridge run's `2418a1cd…`/`87bc73c3…`. Both runs record a dirty tree at
`5122983778`, before the committed test wait, so neither binds to committed source.
Networking was disabled during execution, restored afterwards, and both temporary
Alpha packages were removed. Final `npm run verify` and `npm run android:build`
passed before this run. Physical audio and user acceptance remain open.
