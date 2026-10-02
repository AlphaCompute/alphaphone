# Alpha agent integration contract

Updated 2026-09-29. `apps/app/src/runtime/alpha-client.ts` remains the browser-safe integration boundary. The current source adds an explicit startup/Settings connection chooser, Eliza Cloud account flow, remote/local pairing and isolated mock mode. These additions are not yet accepted as working live integrations. Read [the current integration checkpoint](#current-four-mode-integration-checkpoint) below for source, test and deployment boundaries. Earlier sections retain the development-transport design and historical evidence; statements about its former automatic connection trigger do not describe the new chooser.

## Why upstream cannot yet be dropped into this renderer

The pinned `vendor/eliza/packages/ui/src/android-cloud/android-cloud-client.ts` has fixed `MOBILE_APP_AUTH_CLIENT_ID = "ai.elizaos.app"` and `MOBILE_APP_AUTH_REDIRECT_URI = "https://eliza.app/auth/callback"`. Alpha's package is `ai.elizaresearch.alphaphone`. Its options allow API base, device name, fetch implementation and storage adapters, but do not parameterize the registered app identity or callback. Reusing the canonical app identity does not establish that Alpha is an authorized native client.

The same file imports the steward-session client, direct-cloud endpoints, UI logger and shell-local-storage implementation. `android-cloud-auth.ts` registers `ElizaSecureCredentials` for PKCE pending state; Alpha's initial MainActivity registers only `SystemPlugin` and `DeviceAppsPlugin`. Consequently an import that appears browser-safe at the method level still has a significant package/native/authentication dependency closure. `plugin-native-secure-store` and `ElizaSecureCredentials` must not be assumed to be the same registered API.

The actual upstream protocol has `restoreSession`, `beginLogin`, `completeLogin`, `sendChat`, `createConversation`, `getConversationMessages` and `signOut`. `sendChat` posts to the verified session's `/api/conversations/{id}/messages`, and conversation creation posts to `/api/conversations`; neither path authorizes inventing a new `/agent` endpoint. Managed runtime authorities are validated against the canonical cloud service or an explicit managed-runtime UUID hostname pattern. The cloud result carries a token, and that token must remain behind the product's native credential adapter.

Required upstream work is a reviewed consumer authentication registration (client ID, callback, verified app link and signer), portable browser-safe exports, native protected pending/staged/active credential stores, and a source-correct adapter to the approved deployment. Updating the submodule/lock follows repository rules; never edit vendor as a shortcut.

## Product API

- `alphaClient.getState()` returns `unconfigured` or `ready`, pending status, non-secret session identity and the current view context.
- `alphaClient.subscribe(listener)` notifies UI state changes and returns an unsubscribe callback. Call `getState()` inside the listener; it returns copies.
- `alphaClient.setViewContext({ view, selectedObject?, sensitive? })` is called by every route and selection change. `view` covers home, assistant, apps, maps, camera, photos, notes, calendar, notifications, reminders, workflows, files, inbox, browser and settings. Selection is opaque `{kind, id, accountId?}`; it must not contain file bodies or credential values.
- `alphaClient.send(text)` sends a request through the verified adapter and returns real text plus validated action proposals. Keep typed draft on errors. It rejects immediately while unconfigured, on sensitive screens, or if another operation is pending.
- `alphaClient.approve(proposalId)` is called only after presenting the exact proposal title/description and explicit user approval. The adapter/server revalidates ownership, selection, expiry, permissions and target preconditions. Agent text alone must never invoke this method.
- `alphaClient.cancel()` aborts the active request, invalidates pending proposals and returns the UI to idle. Already dispatched effects may still happen; consult provider history rather than retrying automatically.
- `alphaClient.disconnect()` invalidates the connection epoch, aborts outstanding work, removes proposals and invokes optional adapter cleanup. It does not remotely revoke credentials; the authenticating adapter must supply revocation/account-lifecycle logic.
- `alphaClient.attachVerifiedTransport(transport)` is a trusted composition-root API for the future real integration. It is not a login form, does not accept passwords, and must not be exposed on `window` or to third-party web content. HTTPS metadata validation is a structural check, not proof of authentication. The caller is responsible for supplying a genuinely server-verified transport/session.

The transport receives request IDs, AbortSignals, and copied versioned context, with no renderer-level endpoint selection. `send` returns `{ text, proposals? }`; `execute` returns `{ proposalId, status, summary }`. Status is succeeded, denied, cancelled, failed or unknown. Client validation is defense in depth; the server must persist approval/idempotency receipts and verify account ownership on every operation. The client cannot make an untrusted adapter safe.

## Lifecycle and safety behavior

Changing views/selected objects/sensitive state increments context revision, invalidates proposals and aborts current work. Switching transport increments session epoch. Late callbacks are rejected; an ignored AbortSignal cannot install a response into a different context. Cancellation races the transport promise so a stuck adapter does not leave the UI permanently busy. One operation is active at a time.

Each accepted proposal is copied and bound to context revision and expiration. Approving removes it and marks its ID consumed before calling the adapter. A failed, cancelled or ambiguous write cannot be retried with that proposal. Reconciliation requires fresh server history and a new proposal when safe. These in-memory protections are not durable execution deduplication: restart recovery, backend receipts and cross-device idempotency remain mandatory for real operations.

Credential-entry and provider unlock screens set `sensitive: true`. This blocks send and approval. The transport must independently apply redaction and avoid capturing sensitive screenshots or fields; the context flag alone is not a complete redaction system. Agent input/output should render as plain text, never executable HTML.

## Required acceptance before connected status is a product claim

1. Register Alpha's actual package/signer/callback in the approved auth deployment; prove callback origin/state/PKCE validation and replay rejection.
2. Native secure-store staging/acknowledgment survives interrupted login; no token, password or code appears in logs, localStorage, model context or screenshots.
3. Real owner pairs a real agent; conversation creation and message readback work using the upstream protocol; wrong owner/account and revoked sessions are rejected.
4. Every view sends the correct opaque selection context. A response arriving after view/account switch is discarded. Sensitive screens never transmit context.
5. Cancel a slow real request and recover; kill/relaunch resumes exactly once from durable server history. Demonstrate interrupted external-write reconciliation without duplicate effects.
6. Approve an actual harmless test operation only after a concrete review screen; verify server receipt and provider readback. Expired/stale/repeated approvals fail.
7. Exercise both distribution variants in the Pixel-class phone emulator, then owned AOSP browser and physical hardware. A typecheck or injected adapter demonstration does not establish live integration.

Validation for this scoped change: product TypeScript check passed. Live endpoint, registered Alpha client, real auth, streaming, durable reconnect, actual actions and emulator flows are not established by this module.

## Implemented emulator development connection

The user confirmed that no Alpha production backend is known and authorized an emulator development backend using the existing environment provider secret. `scripts/dev-agent.mjs` is that separate development path. It requires `CEREBRAS_API_KEY` and `CEREBRAS_BASE_URL`, discovers actual models from the configured provider's `/models`, and selects `qwen-3.8-27b` when available. `ALPHA_DEV_MODEL` can explicitly select another model returned by discovery. Provider credentials are never printed, written into the repository, or sent to Android.

The host binds **only** `127.0.0.1:47831`. Each start creates a fresh random bearer in a mode-0600 file inside a mode-0700 temporary directory. It prints the file path, session ID and model, never the bearer. Every request, including health checks, needs that bearer; comparison is constant-time for equal-length input. Chat has a 32 KiB body limit, 12,000-character message limit, 45-second upstream timeout, at most two active requests and per-session duplicate-request rejection. Disconnect aborts the provider fetch. Server shutdown removes the token file. Requests, provider replies and headers are not logged.

`apps/app/src/runtime/development-transport.ts` talks only to the debug native `DevelopmentAgent` bridge. `createDevelopmentTransport(dispatch?)` authenticates via bridge status and exposes explicit development owner/agent metadata, never production login. `developmentAgentStatus()` reports configuration without reading secrets into JavaScript. Status includes the real provider origin solely as session metadata; renderer requests do not target that origin. The native bridge uses a fixed loopback address and its app-private bearer file. It is absent from release variants.

### Start and configure

1. Install Bun (verified with 1.4.2), run `npm ci --prefix backend --ignore-scripts --legacy-peer-deps`, then run `npm run agent:dev` in an environment that already has the authorized provider variables. This runs the pinned Eliza runtime. Keep it running; note the printed token file path. `npm run agent:diagnostic` is the explicit direct-model diagnostic alternative.
2. Install the debug APK in a disposable Android emulator. Set `ANDROID_SERIAL` to its `emulator-NNNN` ID, `ALPHA_DEV_TOKEN_FILE` to the printed file path and optionally `ADB` to the SDK executable.
3. Run `node scripts/configure-dev-agent.mjs`. It sets adb reverse for port 47831 and copies the random bearer through stdin into the debug app's private `files/development-agent-token`, mode 0600. It refuses physical-device serials and never echoes subprocess data.
4. Open the prototype's assistant input and send a request. `prototype/agent-adapter.ts` calls `connectAgent()` from `send()` when the client is not ready, then sends through the verified development transport. A connection toast identifies the development agent. No Settings connect button or separate auto-connect-on-launch exists in the current renderer; sending is the trigger. This must not be presented as production account pairing.
5. On server restart the token rotates. Repeat provisioning and reload the app if an old ready session remains, then send again. A missing token, stopped server or unavailable provider returns a visible request error; release builds lack this debug bridge. Production reconnect/recovery remains separate work.

### Bounded local action proposals

The real Eliza runtime exposes only approval-oriented CREATE_NOTE, CREATE_REMINDER and OPEN_VIEW product actions alongside its reply actions. Their handlers prepare `create_note`, `create_reminder` and `open_view` operations; they do not perform the requested changes. The diagnostic backend converts direct provider function calls into the same wire format. Both paths validate at most four proposals, each with a random ID, two-minute expiry and exact context revision. There are no server execution endpoints, connector tokens, browser actuators, calendar writes, email sends or payment operations.

The development adapter validates the operation again and constructs the review text from the exact normalized payload. It keeps the operation privately mapped to the opaque proposal ID and returns only the standard proposal to the UI. Explicit `alphaClient.approve(id)` must match the retained proposal, revision and expiry; the adapter consumes its ID before calling the supplied local dispatcher. An injected `DevelopmentLocalDispatcher` handles only `{type:'create_note',title,body}`, `{type:'create_reminder',title,body,at}` or `{type:'open_view',view}` and returns `{status:'succeeded'|'failed',summary}` after actual local persistence, a matching native reminder scheduling receipt or navigation. It must preserve unsaved edits and report failure when storage fails. No dispatcher means no execution. Host/adapter process restart invalidates proposals rather than replaying them.

Navigation can invalidate the active request's context. The product must reconcile the actual navigation result and avoid interpreting an intentional view change as proof that a local write failed. Local note creation should save/read back before returning success; it need not navigate automatically.

### Verification evidence and remaining limits

`node --check scripts/dev-agent.mjs` and product typecheck pass. The real configured provider's discovery returned `qwen-3.8-27b`. A real chat returned HTTP 200 with model-generated text; unauthenticated health returned 401, repeated request ID 409, and password-screen context 400.

Run `ALPHA_DEV_TOKEN_FILE=<server token file> node scripts/test-dev-agent.mjs` for real-provider integration. It requests an exact UUID-tagged note, verifies the returned proposal, verifies no file exists before explicit test approval, writes only a temporary host fixture after approval, reads its exact contents and removes it. The result is saved to `test-results/development-agent.json` without secrets. This passed with real `qwen-3.8-27b` output on 2026-09-29. It proves host/provider/proposal plus an explicitly approved host fixture write, **not Android UI execution**.

Android connection, a real Eliza proposal, explicit approval, exact note persistence and Activity recreation passed in `LiveAgentInstrumentedTest` on 2026-09-29 (one test, 5.785 seconds). `test-results/phone-manual/live-eliza-first.json` binds this evidence to standalone-debug APK SHA-256 `fbaf3ea8d8cac2764688215f92210bd389eaa4debac7f7a42915b4dba264e197`; the corresponding `.txt` records the test output. This does not certify later APKs, all flows, cancellation on Android, or release exclusion.

This development path does not solve production account registration, verified ownership, secure mobile login, cloud history, streaming, durable effect receipts, connector execution or AOSP/device acceptance. The Eliza mode persists the local development conversation and supplies relevant conversation history to the configured provider. The renderer sends only the current user message and minimal view metadata; it does not read or upload note/file contents or credentials. The direct diagnostic mode has no conversation memory.

## Implemented host-local development transcription

`scripts/local-asr.mjs` runs already-installed `ffprobe`, `ffmpeg`, and `whisper-cli` on the host. Audio is never forwarded to Cerebras or another external transcription provider. This is a separate debug capability and adds no inference runtime or model to the production Android APK.

The default host configuration is `/opt/homebrew/bin/whisper-cli`, `/opt/homebrew/bin/ffmpeg`, `/opt/homebrew/bin/ffprobe`, and `~/.cache/alphaphone-asr/tiny.en/ggml-model.bin`. Override with `ALPHA_WHISPER_BIN`, `ALPHA_FFMPEG_BIN`, `ALPHA_FFPROBE_BIN`, or `ALPHA_ASR_MODEL` when starting the host. The implementation does not download anything. The authenticated `/health` response includes `localAsr`, which checks executable/model availability; it is not a transcription test.

### Model preparation evidence

The host already held official Whisper `tiny.en.pt`, `base.en.pt`, and `small.en.pt` caches. Their SHA-256 hashes matched the installed official Whisper model manifest. The existing converter at `~/.cache/eliza-whisper-cpp/whisper.cpp/models/convert-pt-to-ggml.py` converted `tiny.en.pt` using `/opt/miniconda3/bin/python` and the installed Whisper asset directory at `/opt/miniconda3/lib/python3.13/site-packages`. No model download was needed.

- Source tiny.en SHA-256: `d3dd57d32accea0b295c96e26691aa14d8822fac7d9d27d5dc00b4ca2826dd03`.
- Converted GGML SHA-256: `4baf807ea95de42a7f9df96e24a36fe835ac8fb5b6ca20d7539ef521c42e6a2b`.
- Tested whisper.cpp installation: Homebrew 1.9.2, CPU inference (`-ng`), four threads.
- Python Whisper itself cannot currently import because its Numba dependency rejects the installed NumPy version. The converter imports PyTorch directly and does not depend on that broken import path.

Whisper and whisper.cpp publish MIT licenses. Preserve notices and record the exact model/source provenance if distributing the host tooling. The cached source converter and model are host prerequisites, not files in this repository. [Whisper source](https://github.com/openai/whisper), [whisper.cpp source and model conversion documentation](https://github.com/ggml-org/whisper.cpp).

### Native-to-host protocol

`POST /transcribe` uses the same loopback bearer and `X-Request-Id` containing a fresh request ID. The body is raw audio, with `Content-Type: audio/mp4` for Android AAC/M4A capture or `audio/wav` for the test fixture. Supported additional types are `audio/x-wav`, `audio/m4a`, `audio/aac`, and `audio/webm`.

The endpoint enforces a 4 MiB body maximum, rejects duplicate IDs, shares the two-active-request limit, checks decoded audio duration at no more than 60 seconds, and validates an audio stream exists. FFmpeg is limited to local file/pipe protocols and converts to mono 16 kHz PCM. Subprocesses have deadlines; disconnect aborts them. The request writes into a private temporary directory, removes audio/transcript files on success or failure, and never logs media, transcripts, subprocess diagnostics or credentials.

Success is `{requestId,text,language:"en",engine:"whisper.cpp",local:true,durationSeconds}`. Failure has a sanitized error code: unauthenticated 401, invalid headers 400, duplicate 409, oversized 413, unreadable/unavailable transcription 422, or cancellation/timeout 504. The client must never turn failure into a fabricated transcript.

The Android debug flow must keep recording, stopping, uploading and applying transcript separate: microphone permission → visible recording and stop → explicit host transcription → user reviews draft → user saves note or sends message. Stop or cancel must release the microphone; cancellation must remove temporary recordings. Recording completion itself must not silently upload. A transcript is model output and can be wrong, especially for silence/noise; retain review and typed-input fallback. English-only `tiny.en` is a development limitation.

### Repeatable tests and evidence boundaries

- `node scripts/test-local-asr.mjs` synthesizes a known phrase locally with the installed macOS voice, decodes it through real whisper.cpp, verifies the words, and removes the fixture. Report: `test-results/local-asr.json`.
- With the host running and `ALPHA_DEV_TOKEN_FILE` set, `node scripts/test-local-asr.mjs --http` exercises the authenticated upload endpoint and tests missing auth, duplicate IDs and invalid audio. Report: `test-results/local-asr-http.json`.
- Re-run `node scripts/test-dev-agent.mjs` with that token to verify chat and proposal behavior remains intact after adding ASR.

On 2026-09-29, actual transcription of “Please remember to water the plants tomorrow morning.” matched exactly. The 2.645-second audio fixture took about 2.18 seconds through the HTTP path. HTTP success was 200; missing auth 401; duplicate request 409; invalid audio 422. The real-provider chat/proposal suite also passed on the same running server.

These results use **synthetic audio processed by a real ASR engine**. They prove neither emulator microphone capture nor spoken-user accuracy. Android acceptance still requires actual capture/permission/stop/upload/review/save, denial, cancel, silence/noise, interruption, maximum duration, process recreation and both distribution variants. Physical microphone acoustics, accents, languages, battery behavior and production ASR service choice remain separate gates.

## Pinned Eliza development composition

`backend/loader.ts` builds the source at `upstream.lock.json.commit` with Bun. Every
`@elizaos/*` import resolves through that pinned checkout's `eliza-source` export;
private exports, unknown packages and `dist` artifacts are rejected. A generated
`.generated/source-map.json` records each imported upstream package/subpath and its
source path. External npm packages are explicitly declared and locked in
`backend/package-lock.json`; `npm ci --prefix backend --ignore-scripts
--legacy-peer-deps` installs only this product-owned backend closure. No vendor
files or global dependencies are modified.

The composition uses core `AgentRuntime`, SQL/PGLite, the OpenAI-compatible plugin
configured for the authorized Cerebras environment, and `createAssistantPlugin`
for the actual `DefaultMessageService`. It retains REPLY/IGNORE/NONE and two
product-owned actions, CREATE_NOTE and OPEN_VIEW. These actions only prepare
bounded proposals. They cannot write a note or open a native activity. Existing
app approval, canonical payload binding, context revision and one-use dispatcher
remain the execution boundary. An AsyncLocalStorage scope binds each action to
its originating request and cancellation signal; overlapping conversation turns
are rejected. An aborted response cannot deliver proposals.

The development world/entity/room identity and PGLite conversation persist under
`backend/state` (gitignored), with a stable private encryption salt. The isolated
loopback entity receives only an explicit session-sourced USER role. It is not a
production account, OWNER grant, deployment login or arbitrary entity supplied by
the browser. The current adapter is one local development conversation, not a
multi-user tenancy implementation. Clear or select another `ALPHA_ELIZA_DATA_DIR`
when changing the development principal. Treat the stored conversation as private.

Launch the actual runtime using `npm run agent:dev` (which sets
`ALPHA_AGENT_BACKEND=eliza` and runs Bun). The direct provider implementation is
available as `npm run agent:diagnostic`; it is a
model/transport diagnostic, not Eliza runtime acceptance. `/health` reports the
selected backend and the real runtime's source commit and embedding limitation.
The native bearer/provisioning and `/chat` wire contract remain unchanged. Local
ASR remains independently authenticated and never sends audio to the model API.

Cerebras supplies text generation but no embeddings. The upstream plugin reports
`EMBEDDING_PROVIDER_UNAVAILABLE`; semantic retrieval is degraded. There are no
zero-vector substitutes or invented embedding success. Recent chronological
conversation and PGLite restoration still work. An explicit embedding provider
or a separately tested local embedding runtime is needed for semantic recall.

`bun run backend/test-runtime.ts` runs live model turns through the real runtime,
checks a random reference over two turns, starts a new process to recover it,
cancels an active turn, and checks exact note/navigation proposals. This is a
real-provider integration suite; it neither mocks model output nor proves Android
approval. Android UI approval/persisted-note readback is verified separately by
`LiveAgentInstrumentedTest` after provisioning the current server token.

Verified on 2026-09-29 against pinned commit
`760ad0f18ad6e34581f696642434215e397ccbc5`: the consolidated live suite passed
all five checks (two-turn memory, fresh-process recovery, active cancellation,
exact note proposal, exact calendar navigation proposal). Report:
`test-results/eliza-runtime.json`. The initial proposal trial correctly exposed
that an ungranted development entity is GUEST; the explicit session USER grant
makes product proposal actions eligible without granting owner privileges.

The explicit Eliza host mode also passed authenticated `/health` and `/chat`
HTTP 200, a real runtime-generated note proposal, no preapproval host write,
approved temporary host-note readback, duplicate-request HTTP 409 and
password-context rejection HTTP 400. The same running host passed local ASR
HTTP 200 with the exact synthesized phrase, unauthorized HTTP 401, duplicate
HTTP 409 and malformed-audio HTTP 422. These reports are
`test-results/development-agent.json` (`backend: eliza`) and
`test-results/local-asr-http.json`. Android testing remains a separate layer.

## Current prototype adapter boundary

The authoritative presentation is now the extracted fourteen-app prototype. `prototype/agent-adapter.ts` owns real send/approval dispatch and local note persistence; selected-document, camera and reminder adapters supply narrower real native slices. View context covers every view name plus selected notes, picker file/photo capabilities, owned captured photos, native calendar events/reminders, contacts, and browser tab/document revisions. Selected email and place identities remain gaps. Selection identity does not include document text, photo pixels or browser-page content. Wallet is temporarily mapped to the existing passwords context and marked sensitive. See [current implementation gap ledger](prototype-implementation-gaps.md) for per-flow source status. Earlier renderer test evidence does not establish coverage of this replacement renderer.

### One-time reminder proposals (source candidate)

`CREATE_REMINDER` now prepares `{type: 'create_reminder', title, body, at}` where `at` is an exact future Unix millisecond timestamp. Backend, Android debug bridge and renderer independently validate title (200 characters), body (4,000 characters) and timestamp. The approval view derives its text from validated fields, including local date/time/timezone, ISO instant, complete title/body, notification permission and approximate-delivery notice. It does not trust model prose as the action description.

Only the existing explicitly approved transport execution path calls `DailyApps.scheduleReminder`; retained proposal identity, context revision, expiry and consume-before-dispatch protections are unchanged. Execution checks that the time is still future. A permission denial or past time is a failed receipt; a thrown/unrecognized result reports scheduling as unconfirmed and is never automatically replayed. A confirmed matching native scheduling receipt triggers a Calendar refresh. Scheduling success does not establish notification delivery. No recurring reminders, mail/calendar-account writes or production authentication are added.

Frontend typecheck, JavaScript syntax checks and backend parse/bundle checks passed for these source additions. The real-provider host scenarios now include exact reminder proposal validation and duplicate-request rejection, but have not been run against the new source yet. Android proposal approval, denial, scheduling/delivery and notification tap remain pending end-to-end tests. The current running development server must be deliberately restarted/reprovisioned by its owner before testing the new action.

### Text-only development runtime verification (2026-09-29)

The product wrapper now excludes unsupported embedding model handlers from a cloned OpenAI plugin registration when using the configured Cerebras text service. Startup asserts that neither single nor batch text-embedding handlers are registered. This prevents the upstream dimension probe from starting a queue that cannot process real embeddings. No upstream checkout was edited. Conversation history remains stored; semantic recall is explicitly unavailable.

The restarted real Eliza backend passed the HTTP proposal integration test for exact note and reminder fields, authentication rejection, sensitive-context rejection and duplicate-request rejection. Evidence: `test-results/prototype-build10/host-agent.json`. This host test does not schedule an Android reminder and does not establish production identity acceptance.

## Repeatable connected phone matrix

After building both variants and starting the development Eliza service, run:

```sh
ANDROID_SERIAL=emulator-5554 \
ALPHA_DEV_TOKEN_FILE=/absolute/path/from/development-service-readiness \
node scripts/android-connected-smoke.mjs
```

The script validates each debug APK against `artifacts/apk-manifest.json`, installs
both variants in sequence, privately configures the existing per-run bearer, and
runs the four opt-in real-agent/camera-denial cases. It creates synthetic local
notes/reminders through the test flows; it does not connect production accounts.
Results include the tested APK hashes in `test-results/android-connected/` (or
`ALPHA_CONNECTED_RESULTS`). A failed variant is recorded and does not hide the
other variant's result. This matrix supplements the full `android:smoke` run.

## Current four-mode integration checkpoint

This checkpoint records inspected source and read-only deployment evidence on
2026-09-29. Build 29 was in progress when this report was written; its outcome
belongs in [the verification ledger](flow-verification.md). No account, credit,
Railway deployment, enclave deployment or database record was changed by this
investigation. A source implementation, synthetic protocol fixture, APK build,
emulator flow, public health response and authenticated production acceptance
are distinct evidence levels.

### Source provenance and ownership

| Source | Inspected revision / responsibility |
| --- | --- |
| Alpha Phone checkout | HEAD `799929863e5df1f26cf4731fa93edeb594cdd139` plus uncommitted implementation; HEAD alone does not identify the candidate APK |
| Pinned `vendor/eliza` | `760ad0f18ad6e34581f696642434215e397ccbc5`; not edited |
| `/Users/shawwalters/v3` | HEAD `6c6fddb6f65e2a88c7852810f1cacc06b4012511`; inspected working source, not a claim of a clean tree or deployed revision |
| `/Users/shawwalters/eliza-workspace/milady/eliza` | HEAD `995f73e830abf3b6340bf651c16757dbc16650ae`; inspected working source and existing authorized deployment access |
| `apps/app/src/runtime/cloud-protocol.ts` | SHA-256 `4e87924e8201d435fff1232724aec95af64b5ae31c115c0e4add30625a8ba545` at this inspection |
| `apps/app/src/runtime/remote-protocol.ts` | SHA-256 `26ac90d48866e0fd5a45027562b6f6fcedc23b8810a940b863a4ba6062c03208` at this inspection |
| `apps/app/src/runtime/cloud-voice.ts` | SHA-256 `a4d1295699e819a329bee7dc1fb59e6915731d0aa957f6708916a119ec4e93db` at this inspection |

The protocol source paths upstream are:

- `packages/ui/src/api/client-cloud.ts`, `direct-cloud-endpoints.ts` and
  `packages/cloud/api/auth/cli-session/{route.ts,[sessionId]/route.ts}`.
- `packages/cloud/api/v1/user/route.ts`, `eliza/agents/route.ts`,
  `eliza/agents/[agentId]/{route.ts,provision/route.ts}` and its
  `api/conversations` route family.
- `packages/agent/src/api/conversation-routes.ts` and
  `packages/app/src/api/auth-{pairing,session}-routes.ts` for host pairing/chat.
- `packages/cloud/api/v1/eliza/google/` and
  `packages/cloud/shared/src/lib/services/agent-google-connector/` for managed
  Google identity, capabilities and data access.
- `packages/cloud/api/v1/voice/{stt,tts,session}/` for cloud audio.

Alpha owns the small product adapters, native packaging, permissions and
presentation. These source references are not permission to copy the upstream
app identity or modify the pinned checkout.

### Current architecture

`connection-ui.tsx` supplies the chooser and controller. `native-connection.ts`
adapts native HTTP and serialized credential operations. `AlphaConnectionPlugin`
uses Android-backed encrypted storage and constrained HTTP. Public selection
preferences and conversation IDs are separate from credentials: localStorage
contains the selected mode/environment/origin/agent and conversation mapping,
while bearer credentials use native secure slots. Renderer protocol code can
read a credential through the injected store to attach it to native HTTP; this
is not a claim that credentials never enter JavaScript memory.

The active session is public owner/agent/origin metadata plus a local connection
epoch. Mode/account switches detach it and abort pending work. Conversation
selection is keyed by origin, owner and agent. Restoring a selection requires
fresh authenticated checks; preference data is not an authorization proof.
The new transport deliberately returns chat text without executing model-supplied
proposals. Existing development-only local note/reminder proposals are a separate
path and do not establish Cloud or enclave action execution.

| Mode | Authority and transport | Present boundary |
| --- | --- | --- |
| Eliza Cloud | Canonical production/staging API, native external login browser, native credential slot, authenticated user and selected agent | Source implemented; no completed live login/agent flow established |
| Remote enclave/host | User-selected HTTPS origin; status, instance-bound pairing, owner machine session, conversations | Protocol source and synthetic fixtures; public enclave health alone does not prove authenticated use or latest deployment |
| Direct local host | Explicit development loopback target, otherwise the same pairing/conversation protocol | Distinct from the older fixed-port development bridge; real end-to-end pairing on this new path remains required |
| Mock | Explicit `mode=mock` or saved mock selection; prototype fixture data; live adapters not installed | Visible simulation banner and exit action in source; device isolation/restart acceptance still required |

The user-specified model is resolved to the provider's actual API identifier
`qwen-3.8-27b`. Live provider discovery and a completion succeeded, recorded in
`test-results/cloud-connection/cerebras-live.json`. The provider key stays outside
this repository and APK. For a managed runtime using direct Cerebras,
`ELIZAOS_CLOUD_USE_INFERENCE=false` prevents upstream boot topology repair from
switching it back to Cloud inference. Model role/environment aliases must be
configured on the server, not accepted from phone chat. Relevant implementation:
`packages/agent/src/runtime/eliza.ts` and
`packages/cloud/shared/src/lib/services/local-docker-sandbox-provider.ts`.
Cloud authentication and Cerebras inference are independent capabilities.

### Startup, settings and recovery PRD

| Flow | Required behavior | Current source / remaining acceptance |
| --- | --- | --- |
| First Android launch | Show Cloud, remote, local development, mock and offline choices before claiming an agent connection | Chooser exists. Device navigation, accessibility, visual fit and both distribution variants need acceptance |
| Continue offline | Local apps remain usable, no fake assistant success; Settings reopens connection controls | Controller persists offline selection and detaches transport. Full native app regression remains |
| Saved Cloud startup | Read secure credential, authenticate user, resolve selected agent, verify runtime and recover same conversation | Source checks user and agent `running` status/validated URL. It does not yet prove runtime readiness with a successful authenticated conversation probe |
| Saved remote/local startup | Restore machine session, confirm owner identity/expiry and selected runtime, preserve transient outage for retry | Protocol distinguishes 401 from 503. Actual process-death/network-change verification remains |
| Settings change mode/account | Cancel in-flight work, retire old identity and proposals, attach only verified new identity; stale replies cannot cross accounts | Connection epochs and abort controllers exist. Adversarial races with real network/native storage remain unverified |
| Cancel login/pair/send | Return to usable UI without late credential installation or reply; do not automatically repeat writes | Single Cloud poller, abort/expiry, serialized native storage and epoch checks exist. Server may already have completed a write; cancellation is not rollback |
| Expired/revoked credential | Detach identity, show reauthentication, remove invalid saved credential; never switch to mock automatically | Source handling exists. Live revocation/refresh is not accepted; automatic session refresh is not implemented |
| Disconnect this phone | Remove local selected credentials and active connection, persist offline choice | Local disconnect exists. It does not claim server-side session revocation or deletion of the account/agent |
| Conversation recovery | Reuse origin+owner+agent conversation; read server history, avoid duplicate sends after unknown outcome | Conversation ID persistence exists. Full history rehydration, missed-message reconciliation and durable write outcome recovery remain incomplete |
| Mock entry/cold restart/exit | Persistent simulation label, separate fixture state, no live provider/native external side effects; exit returns to offline/live setup | Source resolves mock before installing native adapters. Full network-negative and storage-isolation tests on Android remain |

### Cloud login and agent lifecycle PRD

The API origins are `https://api.eliza.app` and
`https://api-staging.eliza.app`. Source constructs external login on `eliza.app`
and `staging.eliza.app`. `POST /api/auth/cli-session` returns the server-issued
UUID, status and expiration. The server ignores a client-selected session ID.
The external browser completes login/consent; the phone polls the matching
session. The credential is single-consumption: an authenticated response without
a credential is a consumed/lost claim, not a successful phone login. Restart a
fresh login rather than silently replaying that claim. Prefer session/token
fields over legacy `apiKey` when both exist.

After secure storage, `GET /api/v1/user` supplies server identity.
`GET /api/v1/eliza/agents` lists available agents. Creating an agent uses
`POST /api/v1/eliza/agents` with `forceCreate:true, autoProvision:false` and a
validated name. Explicit Start calls `POST /api/v1/eliza/agents/:id/provision`.
Creation and provisioning are separate visible actions; neither retries
automatically after ambiguous failure. Re-list before another attempt. Current
UI asks the user to refresh status; automatic bounded readiness polling remains
to be completed.

A dedicated agent uses its validated, server-returned per-agent Cloud
`webUiUrl` plus `/api/conversations`. Shared agents use the canonical API base
`/api/v1/eliza/agents/:id/api/conversations`. The latter route is not the general
production transport for dedicated agents. `bridgeUrl` may be a JSON-RPC
transport and is not substituted for REST. Conversation create/list/send are
source implemented and covered by explicitly synthetic HTTP fixtures. The
request sends `clientMessageId` and `metadata.alphaPhone.context`; the inspected
shared-runtime handler ignores metadata. **Shared-agent contextual assistance
is therefore incomplete**, even if its text chat works. Dedicated metadata
acceptance also needs actual agent/provider evidence.

A live API call successfully created a CLI login session, but browser inspection
showed a blank page. No login success or live Cloud chat is claimed. Read-only
hosting inspection found identical index JavaScript on both `eliza.app` and
`cloud.eliza.app`: SHA-256
`d15cfc1a7a53e635af6661b959e5067f4a7aa93a65e93eef334c4e616a4952d3`.
It loads `public-web-entry-BwZkQ1jX.js`, whose public registration references
`cli-login-page-CfRcmZRR.js`. That CLI chunk and all 26 directly referenced
registration chunks returned HTTP 200 JavaScript. This rules out the observed
basic chunk absence, not runtime exceptions or deeper dependency failures.
Upstream explicitly registers `auth/cli-login` as a hosted public route; simply
changing the login hostname is not currently justified. Capture browser runtime
errors, failed nested requests and session-auth state to resolve the blank page.

### Account and deployed database qualification

Read-only investigation used existing authorized Railway/Cloudflare access.
The current production Worker is named `eliza-cloud-api-prod`. Its deployed
`HYPERDRIVE` binding matches the configured production resource and resolves to
Railway database `eliza_cloud_prod_fresh_20260826`. `DATABASE_URL` is an opaque
Worker secret; upstream code can bypass Hyperdrive when it selects Neon. Thus
binding metadata identifies a configured origin, not proof of every live query's
executed database branch.

The default database of the initially inspected `eliza-cloud` Railway Postgres
service contains a verified identity for the requested test email, but is not
the current Steward service's configured database. The old local
`.env.production` Neon database contains a matching Cloud account and a finite
`100000.000000` credit balance; its linked Steward identity differs and its schema
lacks the current balance revision column. **Neither record is accepted as the
current production identity or credit balance.** Do not copy these IDs into a
new account or perform a grant against them.

The currently configured Steward service points to
`steward_prod_fresh_20260826`. A read-only connection attempt failed certificate
validation before the exact-email query. TLS validation was not disabled.
Current identity/org/credit verification requires resolving the active database
authority or authenticating through the working live API.

No supported unlimited-credit switch was found in inspected credit/schema code.
`creditsService.addCredits` accepts a finite exact-decimal amount, organization,
description and metadata, and handles ledger/cache updates. The database numeric
balance is finite. An admin role is not a billing bypass. Account creation must
establish the real authentication identity; inserting only an application row
would not do that. Any authorized test grant must target the verified current
organization and use the supported ledger path, then verify readback. No such
grant, role change, account creation or manual SQL write has occurred here.

### Gmail and Inbox PRD

Cloud login does not authorize Gmail. Begin with
`POST /api/v1/eliza/google/connect/initiate` using `side:"owner"` and only
`google.basic_identity` plus `google.gmail.triage`. Open the returned validated
Google authorization URL externally. Re-read
`GET /api/v1/eliza/google/status?side=owner` after return, and show the actual
configured/connected/reason/capability state. The protocol exposes these calls;
the production Inbox data flow and full Google authorization UI are not yet
complete.

Then list accounts and read Inbox through the managed connector's
`accounts`, `gmail/search` and `gmail/read` routes. Carry the selected account or
grant ID through every request. Pagination, empty inbox, offline/stale state,
provider revocation and account switching must preserve provenance. Search
results are not proof of complete synchronization. Request `google.gmail.send`
only for an explicit send/reply flow; show recipient, account, subject and body
before dispatch. Do not send prototype sample messages. Calendar read/write
capabilities are separate opt-ins. Refresh credentials remain on the managed
backend; the phone must not request raw Google tokens.

### Voice PRD and current native implementation

Cloud voice now has source implementation in `runtime/cloud-voice.ts`,
`AlphaVoiceCloudPlugin.java` and the Notes `prototype/voice-adapter.ts` integration.
This supersedes the earlier finding that the JSON-only `AlphaConnection.request`
could not carry audio. That JSON method remains JSON-only; the dedicated
`AlphaVoiceCloud` bridge owns recording, multipart upload, binary download and
playback. This source is **not yet verified by a complete live microphone →
transcript → note/chat → synthesized playback flow**.

- Start asks microphone permission at use and records in app-private storage.
  Stop retains an opaque recording handle. Cancel/background/destroy invalidate
  recording/request epochs and stop playback. Verify denial, permission-dialog
  return, interruptions and file cleanup on the actual phone build.
- STT calls canonical `POST /api/v1/voice/stt` using multipart `audio`; optional
  upstream `languageCode` is supported by the service. Reply is
  `{transcript,duration_ms,segments?,words?}`. Provider branches may report
  processing elapsed time in `duration_ms`, so it is not a recording-length proof.
  Upstream file and default multipart limits are 25 MiB; native product limits
  are smaller. Never interpret empty/failed transcription as successful note save.
- TTS calls `POST /api/v1/voice/tts` with text and requested WAV format. Upstream
  supports `{text,voiceId?,modelId?,format?:"mp3"|"wav"}`, maximum 5,000 text
  characters. Native code bounds binary audio, saves a private temporary file,
  returns an opaque playback handle and uses Android playback. No provider key
  or audio file path needs to enter the renderer.
- The voice adapter captures selected Cloud environment/session and rejects
  stale callbacks after account switch. Native requests read the Cloud credential
  slot and use canonical endpoints. Test the actual switch race during recording,
  upload, synthesis and playback; source guards are not acceptance evidence.
- The deployed Worker reports `VOICE_REALTIME_WS_ENABLED=true`. Realtime still
  needs visible consent → `/api/v1/voice/session/consent` nonce → scoped
  `/api/v1/voice/session` mint → authenticated socket. Flag presence does not
  prove signing, nonce storage, provider service or audio operation. Realtime
  streaming/barge-in is not implemented by the new batch bridge.
- Remote enclave voice is not supplied by Cloud batch mode. Upstream host
  `/api/asr/cloud` uses raw WAV and backend Cloud configuration; connecting the
  remote origin must not silently attach another Cloud account. The local debug
  recorder/ASR lane is also distinct and does not qualify enclave voice.

### Acceptance remaining

The synthetic `scripts/test-cloud-protocol.mjs` and
`scripts/test-remote-protocol.mjs` exercise real loopback HTTP with fabricated
identity/provider responses. They verify protocol lifecycle behavior, not live
accounts, secure Android storage, model execution, Gmail or voice. Existing
Cerebras and older development-bridge tests retain their narrower scope.

Required remaining evidence includes: successful live Cloud login and secure
restart; actual current account/org/billing readback; existing and new agent
selection/provisioning; authenticated Cloud and enclave conversation round trips;
latest enclave deployed revision/EIF identity; direct local pairing independently;
real Cerebras routing in each live runtime; owner/account/environment isolation;
credential expiry/revocation/refresh; complete conversation history/recovery and
unknown-write reconciliation; every-view agent context including shared runtime;
real approved native/connector actions; Gmail consent/data/send/revoke workflows;
full voice permission/capture/transcription/persistence/playback/interruption;
mock no-network/no-native-side-effect isolation; chooser and recovery visual
fidelity; both APK distribution variants, launcher HOME behavior, Pixel-class
emulator Computer Use, owned AOSP image and physical-device/user acceptance.
The broader app-flow gaps in the PRD and verification ledger remain in scope.

### Chosen next architecture: Cloud services independent of the agent

This is a required migration, **not implemented or accepted by build 30**.
Source review at AlphaPhone HEAD
`799929863e5df1f26cf4731fa93edeb594cdd139` plus its current working changes
finds that `runtime/connection-ui.tsx` exposes `getCloudClient()` and
`getCloudEnvironment()` only while `active.kind === 'cloud'`. Both
`prototype/inbox-cloud-adapter.ts` and `runtime/cloud-voice.ts` therefore lose
Cloud service access when a separately paired remote/local agent is selected.
A retained secure credential alone is not a verified service session.

Keep two independently verified identities, with separate cancellation epochs:

| Domain | Verified state and purpose | Invalidation |
| --- | --- | --- |
| Cloud services account | Environment, `/api/v1/user` user/org identity, opaque credential reference, service-session ID, verification/expiry state; Gmail and Cloud speech | Sign-out, account/environment replacement, authentication rejection, explicit offline/mock mode |
| Agent target | Cloud agent or paired remote/local origin, owner, agent ID and conversation binding; messages and approved agent actions | Target change, disconnect, pairing/authentication rejection, explicit offline/mock mode |

The public snapshots contain neither credentials nor provider tokens. On startup,
restore and verify the Cloud account separately from the selected agent. A Cloud
service outage must leave independently authenticated remote typed chat usable;
a remote outage must leave authenticated Gmail usable. Never show Connected
from a saved preference or token's presence. Choosing an agent does not replace
the Cloud service account. Choosing a different Cloud account invalidates any
Cloud agent belonging to the previous account, while preserving a separately
paired remote target. Cancel cross-service operations before publishing either
identity change; reject late results against both captured epochs where needed.

Preserve the prototype's layout and distinguish these controls and states:

- **Agent connection:** select/verify Cloud, remote or local target, or disconnect
  the agent. Disconnecting a Cloud agent retains the Cloud service login.
- **Eliza Cloud account:** sign in, verify identity, show service availability,
  switch account/environment, or explicitly sign out. Sign-out clears that
  environment's secure credential, account-derived state, mail and temporary
  audio, and disconnects a Cloud target using it. A remote pairing is independent.
- **Gmail:** show verified connected accounts and granted capabilities under the
  Cloud account. Request OAuth only from Connect Gmail; cancellation, denied
  scope, expired login and retry remain visible. Loading/searching/reading mail
  remains a user action. Account creation stays in Cloud's existing external
  login flow; it does not imply an agent was provisioned or Gmail was granted.
- **Voice:** identify Eliza Cloud as the transcription/synthesis provider even
  when the agent is remote. Microphone action authorizes the selected recording
  upload; ASR produces an editable local draft, never an automatic message to a
  different agent. Explicit Send binds the current target. Read-aloud is a
  deliberate action/opt-in disclosing that the selected reply text goes to Cloud
  TTS; do not include history, hidden context or mailbox data automatically.
- **Mock:** disable both real-service and real-agent effects and use fixtures.
  Exit revalidates saved identities without replaying operations. Distinguish
  Continue without an agent (Cloud services may remain available) from explicit
  Offline (all network effects disabled; retained credentials remain inert).

Opening Gmail while connected to a remote agent must not forward mail content
to that agent. Keep displayed mailbox data ephemeral and clear agent-observation
selection on target changes. Any deliberate Send to agent operation must name
its destination and disclose the exact selected content; consent to OAuth is not
consent to send mail to every agent. Existing view-context metadata must remain
bounded and exclude mail bodies/provider tokens. Cloud voice is a separate
service disclosure, not an implied property of an enclave's confidentiality.

Migration order:

1. Extract verified Cloud-account lifecycle from the target union into a
   service-session controller. Retain environment-specific native secure storage;
   verify server identity before issuing account-bound helpers. Separate persisted
   service choice from target choice without persisting identity claims as proof.
2. Expose a credential-free service capability helper bound to service-session
   ID/epoch. Migrate Inbox and speech from the current target-session helper.
   Native audio must bind the verified credential generation at request start,
   rather than rereading a possibly replaced account slot after recording.
3. Split disconnect and sign-out controls, cancellation, expiry recovery and
   status subscriptions. Project verified service/target states into Settings
   and the home attention card. Replace inaccurate fixture capability labels.
4. Exercise HTTP lifecycle fixtures and full Android flows for Cloud-account +
   Cloud/remote/local/no-agent combinations; change each identity during Gmail
   search/read, ASR, TTS and chat. Verify late results are discarded, remote chat
   survives Cloud failure, account sign-out retains remote pairing, and mock/
   offline emit no live effects. Then perform live login, Gmail and microphone/
   playback acceptance on both Pixel-class APK variants. Synthetic success is
   not evidence of live Cloud consent or enclave isolation.

### Settings source audit accompanying this migration

`prototype/native-adapter.ts` already replaces the top **Privacy & Enclave**
value and **Sealed** hero with **Not verified**, removes the fake attestation
subtitle, and replaces Nothing leaves/on-device-model claims. Do not count the
unmodified `prototype/model.js` fixture as the live rendering. Keep a regression
check for the fully wrapped production view and label mock output clearly.

Remaining necessary fixes, intentionally not changed during the build freeze:

- `prototype/data-adapter.ts` empties Accounts and Connections fixture state,
  but `prototype/settings-adapter.ts` never projects Cloud/Gmail identity into
  those sections. Thus zero accounts can be shown after a real Cloud login.
  The home attention card also remains Accounts are not connected. Populate
  both from verified service state, with explicit loading/error/revoked states.
- `prototype/model.js` Connections still renders the fixed Slack/GitHub/Notion/
  Linear/Figma/Spotify catalog and consent-like scope sheets. Native `ok` guards
  route to Android Settings, so this does not establish real connector OAuth.
  Replace these affordances with supported service capabilities or explicit
  unavailable rows; do not imply Android Settings connects a Cloud provider.
- Accounts Add account currently hands off to Android Settings. Provide a
  distinct Cloud sign-in/Gmail action and label device-account management as
  such. Do not collect provider passwords in prototype forms.
- Models is fixed to Remote agent, while Character retains fixture voice,
  proactivity and wake-word labels. Render actual target/provider capability
  state; unavailable controls must not look enabled. Never infer an enclave
  attestation or exact inference model from the selected target's name.
- The model's `persist` array retains selected fields across in-memory view
  resets; `vreset` itself does not write localStorage. The empty production
  initial state is therefore not proof of durable fixture contamination, nor
  does it supply real account synchronization. Test cold start and mock exit
  explicitly rather than assuming either behavior from that array's name.

### Conversation restoration and bounded Gmail loading follow-up

The chooser now offers explicit conversation list/restore for the verified Cloud
or remote/local target. Restore verifies the returned conversation list before
reading messages, rejects stale target results, replaces the visible draft/chat,
and binds the next send to that conversation. Only user/assistant text becomes
chat bubbles: historical cards, attachments, action proposals and tool records do
not become executable UI. User text loses its observation prefix only if it
exactly reconstructs the current Alpha Phone envelope. No automatic history read
or transfer to another agent occurs. Returned history is a bounded server window;
older-message pagination and complete archival recovery remain unimplemented.
The controller rejects histories above 2,000 visible/input records rather than
silently truncating them. The shared runtime returns persisted user/assistant
history; dedicated hosts may return a recent window, so an empty/short response
is not proof of complete account history.

Gmail now offers an explicit 25 → 50 result expansion, with account/query binding
and cancellation when the search changes. This is **bounded search expansion,
not mailbox pagination**. The inspected upstream
`packages/cloud/api/v1/eliza/google/gmail/search/route.ts` accepts `query` and
`maxResults`; `packages/cloud/shared/src/lib/services/agent-google-connector/gmail.ts`
clamps to 50 and discards Gmail's provider page token. True pagination needs a
reviewed upstream extension forwarding/returning an opaque cursor bound to the
same user, grant and query, followed by a client append/deduplication flow. Until
then, the UI labels the cap and asks users to refine their search. Account changes,
query changes and service sign-out discard stale results. No external grants or
mail were modified to implement or test this flow.

The same upstream Gmail service checks body-read scope (`gmail.readonly`,
`gmail.modify` or the full mail scope) and rejects metadata-only full-mailbox
search. Separate `gmail/message-send` and `gmail/reply-send` routes exist with
server authentication, recipient/body validation and managed connector transport.
Their existence does not make a read grant a send grant; draft/reply confirmation,
exact account binding, sent receipts, ambiguous-send recovery and revocation
acceptance remain required before product send controls are enabled.

`scripts/test-connection-history.mjs` runs the current controller and actual Cloud
protocol against loopback HTTP, checking conversation membership, exact context
prefix removal, exclusion of historical actions, next-send conversation binding,
independent service lifetime and stale-session rejection. The Cloud HTTP fixture
also checks dedicated/shared history reads, bounded search and accepted provision
writes whose status fetch fails. These are synthetic flow evidence, not live
provider or Android UI acceptance.

### Structured remote phone-action client follow-up

`runtime/device-actions.ts` now consumes only the reviewed upstream device-action
contract in `patches/eliza/README.md`; it never interprets chat prose as a command.
A verified remote/local connection attempts enrollment using a securely stored
installation UUID and 256-bit device key, scoped to origin + owner + agent.
Device headers are attached to conversation traffic only after enrollment
succeeds. Older/unsupported hosts retain ordinary chat without device authority.
Cloud chat currently retains its separate no-device-actions behavior.

After a reply, authenticated pending proposals can render exact review cards.
The client checks owner, agent, installation, enrollment, digest, expiry and a
closed operation union. Approval additionally checks the current local context
revision and selected object; the server contract does not persist or attest
that phone context. A native journal reserve precedes decision/claim. The server
claim is persisted as applying before any effect. Duplicate journal entries,
lost claim replies and interrupted effects never trigger automatic execution.
A terminal local receipt is recorded before server acknowledgment; explicit
Sync recorded receipts repeats only the same receipt, not its effect. History
also provides explicit rejection and user-confirmed happened/did-not-happen
reconciliation. Local terminal history remains immutable after a server review.

The renderer executor creates notes with the journal operation ID, schedules
native reminders using that ID, opens a supported view, or navigates a new native
browser tab to an explicitly approved HTTPS URL. Browser navigation acceptance
is not page-load success or browser-content observation. Navigation can cancel
the current chat's context-bound wait; local journal completion is retained
independently and can be checked in action history. Reminder receipt confirms
scheduling rather than delivery. Permission errors, disconnected providers and
missing native journal support do not become successful effects.

`scripts/test-device-actions.mjs` runs the actual typed client against loopback
HTTP and a journal-contract fixture: decision/claim/receipt, journal-before-effect,
receipt recovery after client restart, no duplicate effects, lost-claim manual
reconciliation, stale-context rejection and explicit decline all pass. This
fixture does not establish native disk durability or real runtime enrollment;
those require native instrumentation and the patched deployed/local runtime.
The journal is owned by the Android implementation, not renderer persistence.

### Remote workflow management checkpoint

`runtime/workflow-protocol.ts` uses the source-verified remote OWNER-session
`/api/workflow` contract. The Workflows view now lists actual remote definitions,
opens human-readable metadata/steps, pauses a workflow, explicitly reviews a
manual run, and retrieves accepted/terminal execution receipts. It does not run
prototype timers or translate prototype trigger objects into executable code.
Manual Run now requires a second tap after review; the client rechecks the
workflow version before dispatch. The upstream run endpoint has no atomic
expected-version/idempotency contract, so concurrent remote changes and ambiguous
POST outcomes still require execution-history reconciliation rather than replay.
Pause does not cancel an already-running execution. A queued receipt is not a
successful run. Receipt refresh never starts another execution.

Creation/editing/activation and phone triggers remain unavailable in this narrow
adapter. Real definitions are Smithers TSX/TypeScript, while the prototype builder
uses a different human-step model. A reviewed compiler/generation contract is
needed before the builder can safely control executable definitions. Cloud has
two workflow proxy families with different backend assumptions; this adapter
explicitly limits support to the verified direct remote/local agent contract.

Validation: `scripts/test-workflow-protocol.mjs` passes loopback HTTP capability,
list, pause, version-change refusal, explicit manual dispatch and terminal receipt
checks. `scripts/test-real-workflow.mjs` passed against the actual patched local
host at port 47840: inactive disposable workflow
`9a53d1be-5100-45e6-afcb-78e7651da219`, execution
`22c0862a-8430-4a50-bec6-d969774ec533`, terminal status `finished`, then confirmed
paused. Its sole static task computes 7 × 8; no model, communications, network
calls or private-file inputs occur inside it. This verifies local runtime
execution, not Android workflow UI, provider workflows, phone triggers or Cloud
workflow support.


### Explicit arithmetic workflow fixture selection

The native workflow smoke runner no longer defaults to its historical fixture ID. Review the disposable arithmetic workflow returned by `scripts/test-real-workflow.mjs`, then run:

```sh
ANDROID_SERIAL=emulator-N ALPHA_WORKFLOW_FIXTURE_ID=REVIEWED_UUID ALPHA_DEVICE_SESSION_FILE=/owner-only/session.json ALPHA_DEVICE_RESULTS=test-results/workflows-final node scripts/android-workflows-smoke.mjs
```

The session is never passed as a token argument. The runner requires a verified OWNER session, one running agent, ready Smithers capability, and authenticated list/detail agreement on the explicit workflow ID, name and version. The inactive, unscheduled workflow source must exactly match the reviewed arithmetic-only source in `test-real-workflow.mjs`; line endings/outer whitespace may differ, but appended statements or other expressions are rejected. Duplicate/substring-ambiguous titles are rejected because the existing native test selects the rendered card by title. The output records the fixture UUID and canonical source hash. No runtime call or phone execution was performed while adding this parameter; actual rerun remains required. Keep this disposable fixture free from concurrent edits during execution.
