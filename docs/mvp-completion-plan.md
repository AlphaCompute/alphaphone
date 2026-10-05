# Alpha Phone MVP completion plan

## Current plan — October 4, production surfaces

Mock mode, prototype fixtures, the development profile, device controls, simulated apps, the local development agent option and the debug-only native hooks are now flag-only: they exist only in builds with `ELIZA_DEV_ALLOW_TEST_MOCKS=1` (`npm run dev`, Playwright, `ELIZA_DEV_ALLOW_TEST_MOCKS=1 npm run build`, `npm run android:build -- --test-mocks`). The production web build and all four distribution APKs exclude them, and the production bundle audit, production browser lane and APK verification enforce it. Mentions of mock mode in older checkpoints below describe their recorded builds. See the [production readiness record](production-readiness-2026-10-04.md) and [current status](mvp-current-status.md).

## Resident agent and browser development

The [architecture](architecture.md) defines product and shared platform ownership.

Use the [current requirement/evidence matrix](mvp-current-status.md) and [browser implementation review](mvp-browser-review.md) for the active plan. The primary agent is Android-resident, with the same real agent hosted locally for browser development. Cloud/remote services are optional; Nitro admission is not a prerequisite. Local scheduling requires honest missed-occurrence/restart recovery, not a claim that a powered-off phone runs code. Hosted Cerebras text inference remains distinct from local orchestration and speech.

Qualification covers notification receipt recovery, speech ownership, local digest/reconnect behavior, redaction and current-source browser/design coverage. APK builds, native execution, physical-device and real-provider acceptance remain separate gates; use source-bound terminal results rather than historical test totals.

## Applicability of the implementation requirements

The [accepted Android-resident architecture](on-device-agent-plan.md) supersedes the earlier requirement for Nitro as the primary agent host. Apply steps 3–10 below to the resident runtime and its native authenticated transport; preserve optional Cloud/remote adapters and qualify them separately when used. Step 14's signing and identity requirements still apply to shipped app/runtime artifacts, while Nitro attestation and KMS apply only to an optional enclave deployment. Do not revive enclave hosting as a prerequisite for resident chat.

The powered-off hosted-loop journey cannot be satisfied by a powered-off resident process. Local durable scheduling with explicit missed-occurrence handling is implemented work, but it is not equivalent evidence; retain the unresolved scope amendment described in the on-device plan. On-device STT/TTS, both APK distributions, current native tools, signed-image/OTA and physical pilot acceptance remain required. Historical qualification is retained in Git and source-bound test artifacts; it does not establish current completion.

## Scope freeze and deferred code

The initial MVP feature profile is implemented in `apps/app/src/prototype/mvp-features.ts`: Phone, SMS, Contacts and Wallet enabled entries are commented out with sources and restoration gates. Production/offline and mock render checks cover hidden entry points, direct navigation, `keepStack`, presets and saved-state recovery. Contacts adapter installation and agent route execution are guarded. Original design templates/styles and user data are retained.

Complete the remaining profile coverage in remote agent capability discovery and native acceptance. The same profile must govern route registration, home icons, voice/text navigation, suggestions, deep links and (in test-mocks builds only) mock mode. Retain their implementations and the original design reference; do not delete user data or Android's stock dialer/emergency functionality. Disable adapter installation for deferred functions. A hidden icon alone is insufficient.

After the messaging answer, apply the same profile to Telegram/Discord or retain their work explicitly. Do not silently remove Email while it remains a prior direct requirement. Mock mode is now flag-only (`ELIZA_DEV_ALLOW_TEST_MOCKS=1`): the local-development connection and mock mode remain available for diagnostics in development and test-mocks builds, isolated from effects, and are absent from production builds and all distribution APKs. Advanced photo editing, global/offline navigation, autonomous booking/purchasing and a general workflow IDE are recommended later work; record a disposition before removing their controls. Basic selected files/capture can remain as supporting functions without making an entire media suite the critical path.

Use comments such as `MVP-DEFERRED: <feature>; reason/source; restore only after <acceptance gate>` next to commented registration/import entries. Also document native permissions, background services, scheduled jobs and remote capabilities that must be inactive. Existing saved references to disabled routes should return Home with a clear message. Back, process restore, `keepStack`, direct URLs and agent proposals must not bypass the profile. Do not comment out tests that prove required MVP behavior merely to make the suite green.

## Implementation order and ownership

| Step | Concrete work and owner | Prerequisite | Exit evidence |
| --- | --- | --- | --- |
| 1. MVP source reconciliation | Product/engineering: approve feature profile, messaging choice, speech/local-inference distinction, Pixel substitution record and P0/P1 definitions | Supplied docs plus user's answers | Scope table linked to every retained/deferred entry; suggestions and unresolved decisions remain identifiable |
| 2. Stable target and native test environment | Android/release: identify actual Pixel SKU/image and restore emulator health; retain all failed traces; establish boot/HOME/basic UI smoke before app campaigns | Current APKs and device access | No System UI error blocking tests; actual app ready, permission/role baseline restored after tests; physical device identified separately |
| 3. Generic session and capability contract | elizaOS agent/client/Cloud owners: publish auth, conversations, actions, workflows, voice and result capabilities; remove tier/URL heuristics through validated deployment config | Step1 | Clean external client uses same typed protocol; wrong origin/owner/audience/capability refused; no embedded provider keys |
| 4. Real Cloud and remote onboarding | Cloud/mobile: fix expired-session lifecycle and deployed Gmail exchange diagnosis; discover or create owner agent with durable provisioning receipt; expose enrolled-device actions/workflows in Cloud | Step3 and normal service access | One real account through both Cloud and private remote choices; same-owner restart and revocation tests; no duplicate agent after lost provisioning response |
| 5. Reliable conversation and context | Agent/mobile: durable message admission, stream/cancel, history cursor, selected-view context and reconnect; enabled feature policy in tool discovery | Steps3–4 | Full phone journey with background/network/process interruptions and zero duplicate effects or cross-owner history |
| 6. Speech engine and latency | Native/runtime: qualify required on-device STT/TTS, route capabilities, recording/playback lifecycle, transcript review | Step2; change this requirement only through an explicit DoD amendment | Physical microphone and playback, permission/offline/interruption cases, measured simple-query latency and documented engine/model provenance |
| 7. Generic Notes and native CRUD | Agent/native/mobile: stable records/revisions, secure durable draft policy, text/audio association, read/edit/delete actions and exact recovery | Steps3,5 | UI and voice/text create/read/edit/delete, transcription/save/read-aloud, restart and stale-edit tests on native storage |
| 8. Calendar, reminders and Clock | Agent/native/mobile: complete direct CRUD or clearly approved handoff, recurring/all-day/account selection, task state and native alarm integration | Steps3,5,7 | Native provider readback; actual reminder delivery; real alarm set/ring/snooze/dismiss; denied access and reboot/time-zone cases |
| 9. Hosted schedules and result outbox | elizaOS core/workflow/personal-assistant: reusable morning/evening templates, occurrence admission, lease/restart handling, durable outputs and delivery cursors | Steps3–5; server-readable data grants | Two distinct actual loops complete while phone is powered off, survive host interruption, deliver each result once after reconnect |
| 10. Notification and approval delivery | Native/agent/mobile: own channels, result inbox, scoped tap actions, cancellation/expiry; optional cross-app collector separately gated | Steps8–9 | Real permission/channel/locked/background/restart tests; missed push recovered from history; notification clear does not erase task outcome |
| 11. Browser and password provider | Browser/native/release: supported Chromium/WebView distribution, isolated surface, explicit page assistance, real Proton setup/autofill; passkey capability if required | Steps2–5 | Test-owned account login/save/fill/lock/cancel/origin checks on release-signed image; real passkey gate separately recorded |
| 12. Email if retained | Cloud/mobile: owner scopes, full threads, reviewed provider mutations, durable native pending intent, attachment policy, result recovery | Steps3–5 and confirmed scope/grants | Real Gmail account reads/drafts/reply/send where authorized; response-loss retains unknown; no automatic duplicate mail; source-account isolation |
| 13. Upstream consolidation | elizaOS maintainers: land reviewed generic changes, remove product forks after consumer checks, update source pin/lock, preserve licenses | Owning flow checks from Steps3–12 | Public upstream commits/PR evidence; clean clone builds; Alpha client consumes generic APIs without brand/private config leaks |
| 14. Private deployment and metering | Runtime/release: generic hosted-backend adapter, client-specific deployment config, signed measured release, durable identity/usage events | Qualified runtime, authorized signing/KMS path | Exact deployed source/image identity, auth negative cases, attestation where required, provisioning guide and metering duplicate recovery |
| 15. Pilot handoff | Product/QA/release: four physical units, independent reproducibility, issue closure, unedited demo and stakeholder session | All required flow exits | Per-unit manifest and paired-agent evidence, at least five-minute video, reviewed P0/P1 list, source/setup/deployment guides and handoff record |

Parallelize source review, upstream contracts and physical-device preparation. Serialize edits/builds/device campaigns with one owner. Do not run several heavy emulator/Gradle campaigns on the same host and interpret resource-starvation timeouts as feature evidence. Each new failure must change the next diagnostic action.

## Required end-to-end journeys

### A. Boot, authenticate and keep a conversation

1. Cold boot the target device into Alpha HOME. Verify voice-first startup: the first usable screen exposes an accessible talk control, a returning configured user can speak without traversing setup, and first-use, denied-microphone and unavailable-engine states offer clear recovery and typing. Voice-first does not imply automatic microphone capture. Confirm stock recovery/emergency routes remain available.
2. Choose Cloud, authenticate with the intended account, select an existing agent, then separately verify explicit new-agent provisioning and unknown-result recovery. Complete remote pairing to the private host as a second approach; local-development mode is a third diagnostic path.
3. Type a request, speak another, switch Notes/Calendar/Browser and retain the intended conversation. Confirm source context and actual owner/agent identity without showing credentials.
4. Cancel a stream and a pending action; switch networks; background and kill/restart the app; expire/revoke a token. Recover one result per accepted request and no old-owner output after account change.
5. On the distribution APK, prove no mock choice or mock entry point exists. Separately, on a test-mocks APK only, enter mock mode and prove no provider/native side effect, then exit and restore a deliberate real/offline selection.

### B. Voice to note to calendar or reminder

Record a physical spoken note, review/correct the transcript, save, reopen and read aloud. Edit and delete the exact selected note; exercise full storage and interrupted-save recovery. Ask the agent to create a calendar event, inspect account/time zone/attendees and confirm; read actual provider state, then edit and delete the same event. Repeat via direct UI. Add a reminder/to-do, edit its time, deliver, snooze, complete, reopen/cancel and reboot. Concurrent changes invalidate stale proposals rather than editing another object. Data reads and destructive changes require the intended scope, not a broad cached approval.

### C. Alarms

Recommended first MVP approach: a reviewed Android Clock handoff for set/show/snooze/dismiss, with visible handoff status and actual ringing verification. If Alpha must own the alarm UI, implement exact-alarm authorization, ringing service/UI, sound/vibration and DND semantics instead; treat this as additional explicit work. Either approach must handle no handler, denied access, reboot, DST/time-zone changes, duplicate edits, late delivery and cancellation. Do not claim `setAndAllowWhileIdle` reminder delivery is an alarm-clock guarantee.

### D. Two hosted loops with the phone powered off

Use parameterized morning/evening digest templates on the selected real hosted agent. Each has owner, selected source grants, IANA zone, local schedule, immutable template version and enabled revision. Collect server-accessible tasks/calendar/email, or clearly identify an authorized synchronized snapshot and its freshness. Phone-only data is unavailable while powered off; no implied continuous upload.

Power the phone completely off before scheduled admission. Verify two distinct server run IDs, scheduled instants, input provenance and persisted terminal outputs while it remains off. Restart a host worker at an admission/execution boundary; duplicates must not create an additional result. Revoke a source, edit/disable a schedule and exercise an overlap/missed time case. Power the phone on, reconnect and display each exact output once, then restart again and verify history/acknowledgements. Native actions that could not execute while off remain waiting/expired; they must never acquire fabricated success receipts.

Proposed scheduler policy: unique owner/workflow/version/occurrence identity; one active occurrence per template unless expressly configured otherwise; no replay of a backlog on reconnect; explicit missed/overlap records; DST gap skipped and repeated local time admitted once at the earlier offset. These are proposed digest semantics. They are intentionally distinct from local reminders, which currently advance an invalid local time and re-arm overdue records. Review before changing existing user schedules.

### E. Browser and provider-backed credentials

Navigate, search, switch tabs, use Back/Forward, upload/download a test-owned file and return from an external handoff. Review a selected page excerpt for summarization/read-aloud; navigate during approval and verify rejection of the old target. Malicious page content cannot invoke the privileged native bridge or authorize another action.

On each release-signed demo device, sign into the real selected password provider, enable autofill through Android, create/save/fill a test-owned password, lock/unlock, cancel the picker and disable/re-enable the provider. Verify wrong-origin rejection, iframe boundaries, multi-tab transitions, process death and provider/browser update. Passkey registration/authentication is a separate test only after the provider recognizes the browser identity and the WebView feature is available. Exclude vault pages, credentials, cookies, OTPs and passkey material from agent context and evidence captures. Known sensitive URLs and credential/OTP/recovery patterns in ordinary visible text are rejected before creating a review token or dispatching speech; whole-document, normalized-text, bounds and manual-edit cases are covered by the owning browser/native fixtures. This conservative local heuristic is not a universal detector of arbitrary secrets. Continue release-device qualification of these boundaries. Exercise password-vault, recovery-code and OTP pages with secrets in plain div/article nodes, not only inputs; neither summarization nor read-aloud may transmit them.

### F. Email and reconnect notifications

If Email remains MVP, authorize only required managed scopes, select an account, fetch full thread context and explicitly open permitted attachments. Preserve a local draft independently from provider draft state. Review exact From/To/Cc/Bcc, body and attachments before any send/reply. Use the same durable mutation identity across app recreation; a lost response is unknown, never automatic resend. Test grant revocation, changed draft, incorrect returned provider ID, pagination revision changes and archive/trash/undo. Real external sends require the user's specific recipient/message authorization; use synthetic provider tests until authorized live fixtures are available.

Deliver a hosted result/reminder while backgrounded, tap it after process restart, and reach the exact result/task. Disable the channel and verify the in-app history still receives the result. Distinguish notification seen/dismissed from task completed. Cross-app notification access, if retained, requires separately selected packages/previews and mock pause; it is not needed to prove server execution while the device is off.

## Upstream implementation contracts

Use existing elizaOS services rather than duplicate schedulers or approval stores. Extract/version these interfaces with external-consumer checks:

- `RuntimeCapabilities`: authenticated deployment/agent identity, supported protocol revisions, conversation/device/workflow/voice/result/meter capabilities and explicit unavailable reasons. Trust configured authorities, not arbitrary returned URLs.
- `DeviceOperation`: owner/session/device enrollment, operation type, target object revision, expiry, review binding and canonical approval identity. Journal local execution before receipt upload; retain unknown outcomes.
- `NoteRecord` and `CalendarOperation`: stable ID, source/account, revision, typed data and attachment references; generic CRUD actions separated from provider/native adapters.
- `SpeechCapabilities`: capture/playback versus engine location, language/model/voice support, format/size bounds, cancellation and route provenance. Do not make a provider-specific URL the portable API.
- `ScheduledOccurrence` and `AgentResult`: stable trigger/run/output IDs, template version, source freshness, terminal status, delivery cursor and acknowledgement. Cloud and remote clients consume the same semantics.
- `HostedBackend`: provision/status/resume/stop, owner/agent binding, deployed artifact identity, auth and optional attestation capability. Client-specific credentials/endpoints remain deployment configuration.
- `UsageEvent`: stable event ID, owner/agent/run/request, provider/model, measured units, status and retry identity. Unlimited billing policy does not remove accounting or meter hooks.

Keep constants that enforce resource/security limits explicit and versioned. Move product-specific namespaces into configuration with migration support; do not rename secure-store keys and lose existing credentials. Use the reviewed upstream Android implementations through the product adapters described in [architecture](architecture.md); preserve installed storage identities when changing them. Reuse current reviewed upstream DST fixes rather than maintaining another cron parser.

## Validation and delivery discipline

Use the [physical pilot acceptance runbook](pilot-acceptance-runbook.md) for per-unit manifests, native/physical journeys, performance samples, signed update recovery and independent handoff. Its initial four-unit table is unexecuted; it supplies the procedure, not passing evidence.

For each implementation change, run the owning full-flow integration tests, `npm run verify`, `npm run android:build`, both standalone/HOME variants, configured/unconfigured artifacts where relevant, and the corresponding native journeys. Preserve immutable APK/test pairs and source hashes. Unit-test counts are not the acceptance criterion. Synthetic transports should cover error races; real service/native/physical journeys must separately prove the production path.

Proposed performance protocol: a fixed set of simple typed/spoken tasks; at least 20 warm and 5 cold observations per target device and route, with raw timings and failure counts. Measure end-of-speech to first audible response, transcription time, model first-token time and playback completion separately. The DoD target is six seconds for a simple Wi-Fi voice round-trip; agree the percentile/statistical acceptance method before signoff. A long successful transcription does not meet the latency target. Do not replace failed physical samples with synthetic audio samples.

Maintain a small agreed P0/P1 list tied to user journeys. Suggested P0: cross-owner data/action, credential exposure, unrecoverable user-data loss or duplicate external effect. Suggested P1: required flow cannot finish, wrong scheduled occurrence, unrecoverable login/session, inaccessible primary control or persistent crash/ANR. These definitions need stakeholder agreement; CI alone cannot close them.

Deliver: source and reviewed upstream references; dependency/license inventory; reproducible app and OS build instructions; provisioning and private-backend guide; model/voice/browser/provider versions; per-device signed artifact manifest; rollback/recovery procedure; exact flow evidence; unedited physical demonstration; four paired units; final issue dispositions and stakeholder review record. Keep credentials, private endpoints, client brand assets and non-public business content out of public upstream releases.
