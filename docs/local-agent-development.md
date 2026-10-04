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

The development host launches Bun with `--conditions=eliza-source` and `--no-install`, matching upstream's source-checkout resolution. Alpha explicitly opts into workflows within the lean chat plugin set using the pinned upstream lean-chat workflow support; coding, terminal, browser automation and wallet exclusions remain in force. An explicit workflow disable in the private profile still takes precedence. `agent:test` checks those selection boundaries against the prepared source. Existing profiles and their schedule settings are preserved.

Workflow drafts in local browser development persist in the private host profile, separately scoped to the selected owner/agent. Atomic compare-and-exchange rejects stale-tab changes. These development drafts are not encrypted; the editor says so. Android continues to use its encrypted native draft store. Draft storage does not save or execute a workflow on the agent until the separate reviewed submission.

## Browser agent speech

With the real local agent selected, Notes recording transcription uses the host's standalone Whisper provider and transcript playback uses its standalone Kokoro provider. Captured bytes and text pass through the authenticated development bridge; credentials stay on the host. Playback stops on cancellation or connection changes. Failed agent synthesis is shown as an error without silently selecting another speech provider. Offline browser development retains explicit transcript review and installed local browser speech.

Whisper uses the installed assets described in the review ledger. On macOS, browser development selects the installed CLI's automatic compute backend and runs a private synthetic-silence warm-up before starting the agent. This moves first-use kernel compilation into startup. `ALPHA_WHISPER_BACKEND=cpu` explicitly retains CPU execution; other platforms default to CPU. Automatic selection requires the current reproduced runtime source, and a failed warm-up stops startup rather than reporting readiness. This is host acceleration, not Android speech qualification or a guarantee of the device latency target.

When host Kokoro is configured, the agent starts its native worker and loads the speech sanitizer during startup. The worker verifies assets and synthesizes its readiness phrase before reporting ready. The first Listen request shares an in-progress initialization instead of starting another worker. Failed initialization remains retryable, and cancellation still destroys the native context. Disabled host speech does not preload either component.


Require both speech providers at startup with:

```sh
ALPHA_LOCAL_ASR=required \
ALPHA_LOCAL_TTS=required \
ALPHA_TTS_LIBRARY=/absolute/path/to/libelizainference.dylib \
ALPHA_TTS_MODEL_DIR=/absolute/path/to/kokoro \
npm run dev:local
```

The Kokoro directory must contain the pinned `kokoro-82m-v1_0.gguf` and `voices/af_bella.bin` assets. The launcher checks the model and voice hashes; the host service checks the native library and ABI and warms synthesis before readiness. This command uses already installed qualified assets; it does not download a model or build a native library. `ALPHA_LOCAL_TTS=auto` stays disabled unless a library is explicitly configured, and `off` disables synthesis. Browser phrases are bounded to 500 characters; the transcript player divides longer text into shorter phrases. Speech runs on the development computer; text-model inference still uses the configured hosted provider.

The real browser test can be repeated with `VITE_LOCAL_AGENT=1`, `ALPHA_LOCAL_AGENT_ORIGIN`, `ALPHA_LOCAL_AGENT_TOKEN_FILE`, and `ALPHA_SPEECH_FIXTURE` pointing to a locally generated synthetic WAV, then running `npx playwright test test/browser/browser-agent-recording.spec.ts`. It verifies capture, transcription, real audio playback, stop and connection retirement. Its host-dependent cases explicitly skip without the required environment. Native Android speech and physical-device acceptance remain separate.

For a real arithmetic-only workflow check against a disposable local host, provide an owner-only paired session JSON file and run:

```sh
ALPHA_WORKFLOW_ORIGIN=http://127.0.0.1:47859 \
ALPHA_DEVICE_SESSION_FILE=/private/path/to/session.json \
node scripts/test-real-workflow.mjs
```

The helper loads TypeScript through the installed `tsx` loader, accepts only an exact IPv4 loopback HTTP origin, creates a paused synthetic workflow, executes it once, and leaves it paused. It requires one persisted output row for the matching run and task with value `56`, then checks that a second receipt read returns the same result. A finished status without that output fails qualification. It exercises the actual local workflow engine without model inference, tools or communications. Run it against an isolated test profile; it does not qualify native triggers or real-provider workflows.

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
- `agent:prepare` creates an isolated checkout in `artifacts/local-agent-resident-<commit>` from the same `upstream.lock.json` commit. It applies no patches. All relevant overlays have moved upstream; historical patch files and their old qualification evidence remain in Git history.
- Cached preparations authenticate every tracked source byte and executable mode, plus unexpected untracked files including ignored files. Generated outputs are limited to authenticated workspace/Turbo declarations. Source stamps pin the upstream lock, preparer and guard. Preparation never resets or overwrites a mismatched checkout. `ALPHA_RUNTIME_GIT_CACHE` may point to a repository containing the pinned commit; it does not change the required revision.

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

Run `ALPHA_ELIZA_SOURCE=/absolute/path/to/reproduced/source npm run agent:test-digest-restart` on a POSIX host with that source's pinned dependencies installed and Bun available. The command verifies the consumer source manifest and creates its own temporary working directory, database and workflow state. It kills only its own detached fixture process group after synthetic read-only inference begins. Logs and results remain in the printed temporary evidence directory; the live local-agent profile is untouched.

The current runtime preserves the interrupted run as `outcome-unknown`, with no finished result or repeated inference. Concurrent duplicate admissions return the same run ID. A separate never-admitted occurrence outside the two-minute schedule window produces an explicit missed result without executing backlog. This checks process-loss safety and overdue scheduling, not automatic recovery of an ambiguous worker outcome, Android background execution, physical power-loss durability or exactly-once provider calls.

## Contact placeholder semantics (October 3)

`egress-contact-references.patch` gives detected email/phone data session-nonced `__ELIZA_CONTACT_…__` references. Credentials retain `__ELIZA_SECRET_…__`. Both forms share session-scoped resolution, unresolved-reference checks and streaming boundaries. A contact later classified as a credential remains blocked at the user-reply boundary; configured credentials and overlapping credential values retain precedence. The local execution boundary can still restore authorized parameters.

Fresh full-series preparation and source verification pass with manifest `113b0e72f49f258d651529186c6d2a927164a62999f206018394a19b614f6fcf`. Thirty-one focused tests pass, including cancellation-control objects, credential precedence, forged/session-isolated references and every tested stream split. The initial broad-suite invocation failed to resolve a core subpath; an external harness alias fixed resolution without changing runtime source. All failed attempts are retained alongside the passing log. Product verification passes 157 tests with zero skips, TypeScript and the web bundle.

An isolated host with both swap layers enabled used the production Vite bridge and real configured Cerebras model. Two ordinary email-drafting requests restored the exact synthetic email without placeholder instructions; a synthetic password-repeat request did not return the password. The actual streamed request restored both progress and terminal text. After restarting that isolated host, retained history and a follow-up restored the same email. Fetch instrumentation captured provider request-body checks (booleans only, no credentials or raw request bodies): all nine requests observed through these checks excluded the synthetic raw email/password, and included the relevant contact/secret markers. This is bounded proof for these probes, not a general privacy guarantee.

Evidence: `artifacts/calendar-preferences-review/test-results/contact-references/` contains preparation, source tests, product verification, provider/stream/restart results and the instrumentation harness. The earlier lowercase-assignment finding is already repaired by `egress-credential-assignments.patch`; those regression tests pass here. Both swaps remain off in the user-facing host pending broader contact/phone, approved action, mixed-data and provider coverage. No Android build or device acceptance is claimed.


## Mixed contact and credential qualification (October 3)

The first mixed email/phone/password draft altered a phone reference, leaving it unrestored. `egress-contact-guidance.patch` now adds explicit exact-copy guidance to text model requests containing CONTACT references, preserves SECRET restrictions and existing approval requirements, and removes only an exact duplicate leading system message before extending the canonical system prompt. It never guesses a contact from a corrupted reference. The guidance is included in the provider budgeted request and is absent when swapping is disabled.

Fresh source manifest `856e543ec6f38041a056d32f2e3d8d6df4cb96881fea58189150a2fe85f82255` passes full-series preparation/reverification. All 32 focused runtime tests and 157 repository tests, TypeScript and build pass. The real isolated host/model passed six repeated contact drafts (three mixed with a synthetic password), followed by a contact-to-credential promotion that refused disclosure. Streamed progress and terminal output restored both email and phone. A real generated local-note proposal displayed restored details, saved nothing before approval, and retained exactly one approved note after reload. Fourteen captured provider request-body checks excluded the exact raw synthetic email, phone and password, and all contact requests carried the guidance.

Failed attempts are retained: the first guidance implementation produced duplicate system messages rejected by the provider; a subsequent test edit accidentally referenced a fixture flag outside its helper. Both were corrected before delivery; the final native-message regression proves one canonical system prompt. Evidence is `artifacts/calendar-preferences-review/test-results/contact-mixed-review/`, with final evidence in `qualified/`. The original unmodified-reference failure and first successful approval journey remain at the top level.

Enablement remains blocked by a newly reproduced defect: a named six-character password is left in model-facing and visible text because the generic swap threshold is eight characters. `short-credential-probe.json` records boolean leak checks using synthetic input. Fix named short credentials without globally replacing ordinary short words; then qualify short/overlapping values, structured action parameters, and broader contact formats before enabling defaults. These results do not establish universal model reliability or physical-device privacy acceptance. No Android build ran.


## Short credential repair (October 3)

`egress-short-credentials.patch` repairs the reproduced six-character password leak. Explicit credential captures no longer have an eight-character minimum. Capture spans handle short punctuation-only assignments; known short values use token boundaries, and existing opaque references are preserved. Structured explicit credential fields are learned from a bounded descriptor snapshot before substitution, so a later password field protects earlier references. Generic `key` metadata, token budgets and correlation identifiers are not treated as credential fields. Credential overlap checks also use short-value boundaries rather than suppressing unrelated contact text.

Manifest `d570c03df74303368ed3e9ffeae4f1dbde1c7529136d1c806ef54e5d03394e3a` reproduces and re-verifies. All 45 focused runtime tests and 157 repository tests/typecheck/build pass. Cases include one-character and punctuation values, JSON syntax, whole-word boundaries, known configured credentials, structured-field ordering, contact overlap, existing placeholders, cancellation and stream splits. An initial broad structured-field classifier incorrectly treated tool-schema `key` metadata as credentials and caused real provider rejection; the final narrower classifier and schema regression test repair that failure. Failed source/test/provider attempts remain recorded.

The real isolated host/model passes six repeated contact drafts (three containing the unrelated short test password), contact-to-credential promotion, streamed contact output without the short password, and an approved local note. The note is absent before approval and retained once after reload with exact contact data and no test password. Fifteen captured provider request-body checks contain none of the exact raw synthetic email, phone or password values. Evidence: `artifacts/calendar-preferences-review/test-results/short-credential-review/`, with passing final evidence in `final/`.

This closes the named short-string credential defect for the tested paths. It is not universal secret detection, an arbitrary-format guarantee or device acceptance. Default swaps remain off while the broader redaction enablement campaign, current-source restart and native integration gates are completed. No Android build ran.


## Stored and encoded credential qualification — October 3

The live user stack now uses `artifacts/calendar-preferences-review/artifacts/storage-credential-final`, consumer manifest `383de39c44aa5be6b99dffb91d285ca21b1055a86dff6ba4b70cf701998846ac`. It was restarted with the existing browser-agent profile; owner authentication, one agent, local workflows, Whisper and Kokoro all report ready. Both swap flags remain off by default. Explicitly select this verified source with `ALPHA_ELIZA_SOURCE` when restarting; source reproduction and the normal fresh dependency installation remain governed by the commands above.

An isolated redaction-on campaign on this source passes five real-provider credential formats, streaming, and owner/contact restoration after an actual host restart. All eleven captured outbound body checks exclude the synthetic raw contacts and credential suffix. Incoming storage now masks complete credentials before the model sees them; nested JSON text/fragments are also protected with exact source-span restoration and bounded decoding. All 97 selected runtime/security tests and all 157 repository tests/typecheck/build pass.

Failed live attempts led to this repair and remain recorded under `test-results/current-redaction-live/`; passing results are in its `storage/` directory. `test-results/encoded-credential-review/` contains source/test evidence. The broader stage-one invalid-native-source failure was subsequently traced to a stale fixture that omitted the intentional single repair attempt. The fixture correction and combined 485-case campaign pass; production runtime behavior is unchanged. Native integration, wider model reliability and current-head full hosted qualification remain open. No Android build ran.
