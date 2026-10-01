# Local service read-only health snapshot

Observed2026-09-30T12:26:45Z while the broad Build69 native suite was running.
Evidence: `test-results/local-service-health/read-only.json`. Requests were
GET-only with short bounds; no model calls, speech decoding/synthesis, pairing
code generation, auth-session changes, service restarts or native interactions.

| Port / service | Fresh observation | Limit |
|---|---|---|
|47840 primary local agent | Reachable; forwarded unauthenticated status/capability401; saved owner session `/auth/me`200; Smithers capability200/ready | No new conversation, action or workflow execution |
|47844 paired TTS | Reachable; unauthenticated401; saved owner session200; TTS ready=true, provider local-inference | No audio generated or played |
|47846 standalone Whisper | Reachable; unauthenticated401 | No existing client paired-session fixture file is available; authenticated provider readiness was not rechecked and no replacement session was created |
|47848 reviewed workflows | Reachable; unauthenticated401; saved owner session200; Smithers ready and manualSubmissionProtocol1 | No run, cancellation or database mutation |
|47850 regional maps | Public capabilities200, Monaco regional OSM descriptor | No route/search/render acceptance rerun |

These are liveness/auth/capability observations, not replacements for the
archived native TTS63, paired ASR65, cancellation67, submission-reconciliation68,
or regional-map flow evidence. A401 proves an HTTP responder and auth refusal;
it does not by itself prove that every downstream service is ready. Nothing
here qualifies Cloud, the enclave deployment or physical-device acceptance.
