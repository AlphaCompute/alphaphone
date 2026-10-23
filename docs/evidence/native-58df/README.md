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
