# Local agent setup

Alpha uses a local Eliza runtime in both environments. Android runs the process in `ElizaAgentService` inside the app's sandbox and communicates over authenticated native socket IPC. Browser development runs the same composed Eliza source on the development computer, with a private Vite bridge. Neither path requires Nitro, enclave admission, or Cloud sign-in.

This first implementation uses **hosted Cerebras inference**. The agent, conversation database, approvals and receipts are local; prompts and selected context go to Cerebras. This is not an offline language model. Existing on-device speech is a separate integration.

## Browser development

Use Node 24 and Bun 1.4.2, then:

```sh
npm ci
npm run agent:prepare
npm run agent:test
npm run dev:local
```

Before starting, configure `CEREBRAS_API_KEY` in the host environment or the owner-only file `~/.config/alphaphone/cerebras-key`. Do not put it in a `VITE_` variable, checked-in file, browser field, URL or command-line argument. The existing private key file is supported. The current model defaults to `qwen-3.8-27b`.

Open `http://127.0.0.1:5317`, choose **Start local agent**, then chat normally. Reloading reconnects the selected local runtime. Conversation history comes from its local database. `npm run dev` remains the renderer-only development command; it does not silently start an agent.

`dev:local` owns the host and Vite child processes and stops them on Ctrl-C. It refuses an occupied agent port or a live process already using its profile. Its default profile is `~/.local/share/alphaphone/browser-agent`, with owner-only credentials, logs and browser action journal. `ALPHA_REMOTE_PROFILE` and `ALPHA_REMOTE_PORT` permit a separate profile/port. `ALPHA_ELIZA_SOURCE` is an explicit development override; evidence for one source snapshot does not qualify another.

The bridge accepts same-origin requests from the loopback development page only. It allows the conversation, device-action and workflow APIs, injects a host-owned machine session, and removes the upstream session ID because that ID is itself a bearer token. Credentials are not embedded in the web bundle. Device enrollment keys and durable action receipts are kept in the private development profile. Browser development advertises its implemented Notes capability, not Android Calendar/Reminders or native permission access.

The development host launches Bun with `--conditions=eliza-source` and `--no-install`, matching upstream's source-checkout resolution. Alpha explicitly opts into workflows within the lean chat plugin set using the tested `lean-chat-workflows.patch`; coding, terminal, browser automation and wallet exclusions remain in force. An explicit workflow disable in the private profile still takes precedence. `agent:test` checks those selection boundaries against the prepared source. Existing profiles and their schedule settings are preserved.

Workflow drafts in local browser development persist in the private host profile, separately scoped to the selected owner/agent. Atomic compare-and-exchange rejects stale-tab changes. These development drafts are not encrypted; the editor says so. Android continues to use its encrypted native draft store. Draft storage does not save or execute a workflow on the agent until the separate reviewed submission.

## Browser agent speech

With the real local agent selected, Notes recording transcription uses the host's standalone Whisper provider and transcript playback uses its standalone Kokoro provider. Captured bytes and text pass through the authenticated development bridge; credentials stay on the host. Playback stops on cancellation or connection changes. Failed agent synthesis is shown as an error without silently selecting another speech provider. Offline browser development retains explicit transcript review and installed local browser speech.

Whisper uses the installed assets described in the review ledger. Require both speech providers at startup with:

```sh
ALPHA_LOCAL_ASR=required \
ALPHA_LOCAL_TTS=required \
ALPHA_TTS_LIBRARY=/absolute/path/to/libelizainference.dylib \
ALPHA_TTS_MODEL_DIR=/absolute/path/to/kokoro \
npm run dev:local
```

The Kokoro directory must contain the pinned `kokoro-82m-v1_0.gguf` and `voices/af_bella.bin` assets. The launcher checks the model and voice hashes; the host service checks the native library and ABI and warms synthesis before readiness. This command uses already installed qualified assets; it does not download a model or build a native library. `ALPHA_LOCAL_TTS=auto` stays disabled unless a library is explicitly configured, and `off` disables synthesis. Browser phrases are bounded to 500 characters; the transcript player divides longer text into shorter phrases. Speech runs on the development computer; text-model inference still uses the configured hosted provider.

The real browser test can be repeated with `VITE_LOCAL_AGENT=1`, `ALPHA_LOCAL_AGENT_ORIGIN`, `ALPHA_LOCAL_AGENT_TOKEN_FILE`, and `ALPHA_SPEECH_FIXTURE` pointing to a locally generated synthetic WAV, then running `npx playwright test test/browser/browser-agent-recording.spec.ts`. It verifies capture, transcription, real audio playback, stop and connection retirement. Its host-dependent cases explicitly skip without the required environment. Native Android speech and physical-device acceptance remain separate.

## Android setup

Prepare the runtime and stage its mobile payload:

```sh
npm run agent:prepare
npm run agent:stage-android
```

The staging command builds the Android mobile agent bundle, runs upstream's host-Bun module initialization check, and stages pinned ARM64 and x86_64 Bun/musl/runtime artifacts. Executables are packaged as extracted JNI libraries for an ordinary APK; it does not require root, writable-directory execution or disabling SELinux. The upstream staging step includes its small embedding artifact, not an offline text-generation model. Generated assets and binaries are ignored by Git and reproducible from the checked-in scripts and manifests.

When an APK build is wanted, `npm run android:build:local` performs preparation, staging and the existing build/verification of both standalone and launcher variants. The ordinary `android:build` uses whatever payload has already been staged; an APK without the runtime payload reports that it must be staged rather than pretending a host-forwarded agent is running on the phone.

In the Android connection chooser, expand **Model provider**, enter a Cerebras key and model, and save. The native bridge stores the configuration encrypted with Android Keystore and injects it into the child process environment at startup. It never returns the provider key to the renderer. Then select **Start local agent**. **Stop local agent** requests native shutdown and waits for stopped process/service/socket status before reporting success; disconnecting the UI alone does not imply background execution has stopped. Changed provider settings take effect after a stop/start.

The native bridge enrolls and verifies its own local owner session. Conversation, workflow and device-action calls retain the existing review, selected-context, journal, receipt and reconciliation boundaries. Both environments select the upstream store capability policy, independently of build-channel selection. Browser development uses the lean plugin profile; Android uses the mobile allow-list. Desktop coding/PTY surfaces are excluded. Runtime location does not waive action approvals or provider consent.

## Reproducible source boundaries

- `vendor/eliza` stays pinned and unchanged at the repository's `upstream.lock.json` revision. Its Android lifecycle sources are generated into Gradle's ignored build directory with Alpha's identity and socket namespace. A generated SHA-256 manifest records inputs and outputs.
- The original 35-patch MVP series is preserved; patch36 advances the complete composed tree to qualified runtime `ab8f9a7110ae7ddc5edd6a1e323f77e0362ec9d3`. The series reproduces against `4573712ebf0466daa4dfadaa4482704c209d9b8c`, which differs from the vendor pin. `agent:prepare` creates an isolated checkout in `artifacts/local-agent-source`, checks every patch hash, applies the exact series, and checks all recorded output hashes. It then applies the Android secure-store socket and lean workflow patches listed in `android-local-runtime-source.json`, checking their recorded output hashes too.
- Cached preparations authenticate unchanged base files, candidate bytes/modes, deleted-path absence, and unexpected tracked or untracked source, including ignored files. Generated outputs are limited to authenticated workspace/Turbo declarations. Source stamps pin the manifests, patches, preparer and guard. Preparation never resets or overwrites a mismatched checkout. `ALPHA_RUNTIME_GIT_CACHE` may point to an existing Git repository containing the recorded base, avoiding a network fetch; it does not change the required commit.
For an existing preparation that no longer matches the source stamp, preserve it and select a fresh directory for every preparation, test, development and staging command:

```sh
export ALPHA_LOCAL_AGENT_SOURCE_DIR="$PWD/artifacts/local-agent-mobile-workflows-v3"
export ALPHA_WORKFLOW_WORKER_OUTPUT="$PWD/artifacts/mobile-workflow-worker-current"
npm run agent:prepare
npm run agent:build-workflow-worker
npm run agent:test-workflow-worker
npm run agent:test-workflow-compiler
npm run agent:test
npm run agent:stage-android
```

- Runtime preparation skips the unrelated fused local language-model engine setup. The mobile bundler and staged artifact manifest retain their own validation/provenance.

Worker builds require a fresh output directory. `agent:stage-workflow-worker` can independently validate and stage that artifact without a mobile bundle or APK build. `agent:stage-android` now checks the worker artifact's source/lock identity before staging the full runtime and includes its verified files. Native startup extracts the worker through a bounded hash-checked index before setting its runtime resource path. Android startup enables the workflow plugin when verified extraction includes its compiler resources; older worker-only payloads leave it disabled. Canonical approval receipts now use the packaged worker launch contract through `packaged-approval-receipts.patch`.

The consumer series now also includes `packaged-workflow-worker.patch`. It preserves browser workflow database paths, separates packaged Android resources from durable state, uses the native loader/Bun/library environment for worker and control launches, and repairs dependency links after installation moves. See the [worker packaging report](mobile-workflow-packaging.md) for artifact commands and remaining native staging/plugin requirements. Set `ALPHA_WORKFLOW_WORKER_OUTPUT` to an existing verified worker artifact when running `agent:test` to include its real packaged-executor integration case; without that artifact, the case is explicitly skipped.

## Verification and remaining acceptance

The implementation has a real browser/local Eliza/Cerebras chat result, synthetic HTTP security/lifecycle tests, durable development journal tests, a successful mobile bundle module-load smoke, and Java compilation for both Android distribution variants. These are different evidence classes.

A native APK installation and real on-device Bun process/chat run, process-death/reboot recovery, battery/thermal qualification and physical-device acceptance are still required. Android APK assembly/install was not performed in this browser-focused pass. Cancellation immediately detaches the UI and aborts browser transport; an already-dispatched native action may still complete and must be reconciled from receipts. Browser development streams chat through the private loopback bridge and exposes Stop reply. Only text is shown before the terminal event; action proposals still require the completed response and existing review flow. Interrupted partial replies are marked incomplete and cannot be played as completed speech. Android chat now has an authenticated native streaming adapter and an explicit hash-pinned service patch for request-scoped socket cancellation. Completion requires both the final reply and native successful termination. Stop, disconnect and lifecycle changes close the transport and suppress late events; they do not prove that runtime effects were cancelled. Build137 passes both distribution builds/lint and rendered controlled-native streaming/shutdown checks. Actual Android socket cancellation and live resident chat remain unverified.

Powered-off-phone execution is unavailable with a device-only executor. Persisted schedules, explicit missed-occurrence policy and catch-up need their own acceptance; no browser check proves them. Cloud-backed Inbox/account integrations still require separate sign-in and live acceptance. Moving the agent does not complete every item in the broader MVP report.

The Android bundle includes the workflow plugin and its routes, while native startup opts into it only with extracted compiler resources. Browser development retains its lean workflow opt-in. Isolated host bundle loading and worker/compiler checks pass; actual Android service initialization and workflow execution still require device qualification. Run `npm run agent:test-mobile-workflow-bundle` after building the mobile JavaScript bundle to verify its route registration outside the checkout.

Local evidence for this pass is retained in `test-results/local-agent-qualification/`: repository verification passed 39 tests; the clean browser suite passed 74 tests; both native Java variants compiled; mobile staging and its module-load smoke passed. The final live privacy copy was inspected separately after that browser suite. Against the prepared source, the real browser returned `72` for `8 × 9`, proposed and saved the synthetic **Local runtime check** note only after approval, and retained exactly one note plus its successful journal entry after reload. No provider credential is included in these evidence files.

Browser scheduled digests use the private host profile for results and pending mutations, with bounded compare-and-exchange and commit-before-ack recovery. This development storage is unencrypted. The consumer `hosted-digest-route-registration.patch` registers the implemented digest endpoints on the actual plugin router; `agent:test` checks those registrations and owner-bound dispatch. Use a fresh `ALPHA_LOCAL_AGENT_SOURCE_DIR` after changing the consumer manifest. Local schedules require the host/device agent process to remain running; browser result sync does not qualify real scheduled execution or Android lifecycle recovery.

Resident digest results now synchronize through the selected local workflow client into the existing encrypted Android connection store while the app is open. They no longer require the remote background-delivery session. Browser development uses the same inbox logic with its disclosed private-host store. Remote Android connections retain their native background inbox. Resident background result notifications and polling are not implemented; the panel says so. This transport selection is covered by persistence/recovery contract tests, not a new Android execution result.

The consumer `packaged-workflow-compiler.patch` now routes semantic checks through the packaged compiler and the shared Bun/native-loader configuration when a runtime resource directory is selected. Missing packaged compiler files fail explicitly; the checker does not fall back to source dependencies. Browser development retains its existing Node/TypeScript path. The 15-second deadline, source/output bounds, allowed imports and default-export contract remain enforced. Run `agent:test` with the worker artifact to include production-checker integration; the packaged case is explicitly skipped without it.

On Android, the scheduled-digest controller configures native result delivery after verifying the selected agent session. Successful setup enables the shared encrypted inbox and background/notification preferences for the resident agent. Setup failure shows a foreground-only fallback; reconnect to retry. Disconnect retires the native delivery binding, while closing the Activity alone allows configured background delivery to continue. Android may delay polling beyond 15 minutes. Host tests cover the binding logic; actual WorkManager, notification and restart behavior still require device qualification.

Browser development also supports Camera photo preview/capture and a local Photos library. Camera access requires the browser's permission and a secure context (localhost qualifies). Captures use this browser origin's IndexedDB, separate from the agent's private host profile and Android MediaStore; clearing site data removes them. Photos can be favorited, moved to trash/restored, explicitly deleted, downloaded as JPEG, or rotated/cropped/filtered into a new copy. Edited copies are capped at a 2048-pixel longest edge; originals stay unchanged, and pending copy outcomes recover when Photos reopens. This path does not upload pixels to the agent. Video capture, custom albums, multi-photo sharing and OCR remain unavailable in the browser port. Media-device support in a test harness is not proof of hardware-camera compatibility.


## Host model selection

The host launchers share the new-profile default `qwen-3.8-27b`. Set upstream `CEREBRAS_MODEL` to select a model for a new private profile; availability still depends on the configured provider. Existing direct Cerebras profiles retain their saved `serviceRouting.llmText.smallModel` and `largeModel`, and the child environment now matches those values. An explicit override that disagrees with either saved model is rejected before launch. Update the reviewed profile routing or select a separate profile instead of silently replacing it. The combined launcher retains its stricter full-profile equality check.

For the separate development-backend launcher, `ALPHA_DEV_MODEL` takes precedence over the shared default. This host configuration does not change Android's encrypted provider/model settings, load an offline LLM, or establish current provider availability. The launcher regression uses synthetic credentials and a recording child process; it does not call a provider.


## Egress redaction prerequisite

The composed source includes `egress-swap-control-objects.patch`. It preserves clean native cancellation signals while keeping forged/decorated objects inside the secret/PII data walkers, and supports host environment fallback for `ELIZA_SECRET_SWAP_ENABLED` and `ELIZA_PII_SWAP_ENABLED`. Explicit runtime settings take precedence. Fresh preparation is required after this manifest change; do not modify or reuse a differently stamped prepared checkout.

Source-level Node/Bun checks and full-series replay qualify this prerequisite. They do not establish that the running browser agent has redaction enabled or that every PII category/provider/action path is covered. Keep the current Privacy disclosure until enabled runtime and end-to-end restoration evidence support changing it. No Android build is needed to reproduce source preparation.


## Guarded host redaction qualification (October 2)

Setting both upstream switches `ELIZA_SECRET_SWAP_ENABLED=true` and `ELIZA_PII_SWAP_ENABLED=true` now opts the browser host launcher into both swap layers only after full composed-source verification. Invalid or partial selections and unqualified source fail before profile creation or child launch. The default remains off; process metadata records the requested mode, not a coverage claim.

Fresh pinned dependency installation and source re-verification succeeded. The isolated real host authenticated through the production Vite bridge and completed chat, but the synthetic email drafting probe returned a `__ELIZA_SECRET_…__` placeholder. A repeat request was also refused as a credential. This is a failed restoration acceptance check: the assistant reply boundary restores PII surrogates but does not restore secret-swap placeholders. Do not enable both layers in the user-facing session until safe reply restoration is implemented and tested, including protection against restoring actual provider credentials. Device enablement remains unqualified and was not included in this checkpoint.

Validation: five launcher tests pass, and product verification passes (93 tests, TypeScript and browser bundle). Evidence is in `test-results/redaction-boundary-review/launcher-verify.log`, `launcher-tests.log`, `install.log`, and `live-bridge.json`. No Android build or provider-wire capture was performed. The earlier pairing probe was unsuitable for this host's machine-session path; the production bridge was used for the decisive result.


## Personal-data reply restoration repair (October 2)

The new `egress-user-reply-restoration.patch` restores personal data captured by the secret detector at both the final assistant reply boundary and the visible stream boundary. Model-facing stream text remains substituted. Configured credentials, detected credential classes, overlapping credential values, and unresolved current-session placeholders remain redacted. Tool-parameter restoration remains separate. Secret classification takes precedence even when the same value was first recognized as contact data.

Evidence: 22 focused tests pass, including prior cancellation-control tests, session isolation, credential precedence and streamed placeholder splits. Fresh full-series preparation, pinned installation and source re-verification pass for `redaction-qualified-source-v4`. Product verification passes all 93 tests, TypeScript and the web bundle. The live production Vite bridge plus actual host/provider restored the synthetic email in streaming progress and terminal output. A buffered controlled prompt explicitly preserving opaque contact placeholders also restored correctly and persisted a two-message conversation.

Remaining: the ordinary buffered drafting probe had the model output `[secret omitted]` instead of retaining the contact placeholder. The patch cannot restore text the model discarded; contact-versus-credential placeholder semantics need further work before default enablement. The detection grammar is also not comprehensive: the initial lowercase unquoted `password=value` regression was outside the existing detector grammar; the precedence test uses its supported JSON credential form. Keep both swap layers off in the main development session pending broader model/action/restart qualification. Android enablement and physical-device acceptance remain unverified; no Android build was run.

Evidence: `test-results/redaction-boundary-review/reply-stream-tests.log`, `reply-product-verify.log`, `reply-prepare-v4.log`, `live-bridge-after-restoration.json` (ordinary buffered failure), `live-buffered-controlled-restoration.json` (controlled buffered pass), and `live-stream-after-restoration.json` (streamed pass). These are host/provider observations, not a capture of provider-bound traffic or proof of every PII category.

## Isolated digest process-recovery check

Run `ALPHA_ELIZA_SOURCE=/absolute/path/to/reproduced/source npm run agent:test-digest-restart` with that source's pinned dependencies installed and Bun available. The command verifies the consumer source manifest, creates its own temporary database and workflow state, and uses a synthetic read-only model without provider credentials. It kills only its own fixture process after inference begins, then checks restart recovery, concurrent duplicate admission, one retained result, and an overdue persisted task advancing without model inference. Logs and the result are retained in the printed temporary evidence directory. It does not stop or edit the live local-agent profile.

An admitted interrupted occurrence resumes under the same run ID; read-only inference may be attempted again. A never-admitted occurrence outside the two-minute schedule window produces an explicit missed result without executing backlog. These are host-process checks, not proof of Android background execution, physical power-loss durability, or exactly-once external provider calls.


## Contact placeholder semantics (October 3)

`egress-contact-references.patch` gives detected email/phone data session-nonced `__ELIZA_CONTACT_…__` references. Credentials retain `__ELIZA_SECRET_…__`. Both forms share session-scoped resolution, unresolved-reference checks and streaming boundaries. A contact later classified as a credential remains blocked at the user-reply boundary; configured credentials and overlapping credential values retain precedence. The local execution boundary can still restore authorized parameters.

Fresh full-series preparation and source verification pass with manifest `113b0e72f49f258d651529186c6d2a927164a62999f206018394a19b614f6fcf`. Thirty-one focused tests pass, including cancellation-control objects, credential precedence, forged/session-isolated references and every tested stream split. The initial broad-suite invocation failed to resolve a core subpath; an external harness alias fixed resolution without changing runtime source. All failed attempts are retained alongside the passing log. Product verification passes 157 tests with zero skips, TypeScript and the web bundle.

An isolated host with both swap layers enabled used the production Vite bridge and real configured Cerebras model. Two ordinary email-drafting requests restored the exact synthetic email without placeholder instructions; a synthetic password-repeat request did not return the password. The actual streamed request restored both progress and terminal text. After restarting that isolated host, retained history and a follow-up restored the same email. Fetch instrumentation captured provider request-body checks (booleans only, no credentials or raw request bodies): all nine requests observed through these checks excluded the synthetic raw email/password, and included the relevant contact/secret markers. This is bounded proof for these probes, not a general privacy guarantee.

Evidence: `artifacts/calendar-preferences-review/test-results/contact-references/` contains preparation, source tests, product verification, provider/stream/restart results and the instrumentation harness. The earlier lowercase-assignment finding is already repaired by `egress-credential-assignments.patch`; those regression tests pass here. Both swaps remain off in the user-facing host pending broader contact/phone, approved action, mixed-data and provider coverage. No Android build or device acceptance is claimed.
