# Core loop audit (round 4)

Independent audit of the round-3 claim that each of the ten core MVP loops (completion
plan journeys A–F, flow audit J01–J05) completes end to end in the browser build. Audited
source: branch `claude/r4-audit`, based on `claude/r3-integration` at `5f52c23d`.

**Finding.** The narrow claim holds: all ten journey specs pass at this source (16 tests,
run in this audit), and each drives its loop through rendered controls. The claim does not
extend further than that sentence. Every journey runs the development profile; 9 of the 10
depend on a development-only agent, mailbox, vault, scheduler or device control that is
absent from the flag-off build, and no native instrumentation result is bound to this
source. Measured against the governing requirement text, the loops are between 47% and
88% evidenced among the steps this repository, an emulator or CI can close, and 36 further
steps wait on a person or a phone.

Evidence classes follow [verification](verification.md): source/test (S), APK build (B),
emulator (E), AOSP image, real integration, physical device (D). Nothing in this document
is evidence above class S. No APK was built and no emulator was started for this audit
(the working rules for this host ruled out large builds, and emulators not started by
this package are off limits).

## How to read the tables

Each loop's governing requirement text was split into atomic steps and negative cases.
Each step has exactly one class:

- **EVIDENCED**: a test on this branch exercises the step through the shipped renderer
  logic, and the step names nothing that only a native component, provider or device can
  show. The cell says where the evidence is weak (a fixture standing in for the thing
  under test, state written or read through `page.evaluate`, or evidence that sits in
  another spec and not in the journey).
- **SOFTWARE**: can be implemented or tested from this repository now.
- **EMULATOR**: needs a disposable-emulator run of the named instrumentation. "No run"
  means no result bound to this source exists; the last recorded class-E result is six
  journal/photo cases at `d3dc9977`, 55 commits behind this branch.
- **CI**: needs a GitHub-hosted runner. `scripts/ci/pending-recovery-ui.py` and
  `scripts/ci/resident-native.py` refuse to run anywhere else, and the second requires an
  x86_64 emulator. This host is arm64.
- **HUMAN**: sign-in, key, account or owner decision.
- **DEVICE**: physical hardware.
- **UPSTREAM**: needs an elizaOS change.

A step blocked by more than one thing is classed by the first blocker.

**Percentage** = EVIDENCED ÷ (EVIDENCED + SOFTWARE + EMULATOR + CI). HUMAN, DEVICE and
UPSTREAM steps are counted separately and are not in the denominator. A percentage here
measures class-S evidence against closable steps. It is not a completion percentage for
the product on a phone.

| Loop | Steps | Evidenced | SOFTWARE | EMULATOR | CI | Closable total | Percentage | HUMAN | DEVICE | UPSTREAM |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 31 | 15 | 0 | 4 | 2 | 21 | 71% | 6 | 4 | 0 |
| B | 28 | 14 | 3 | 6 | 0 | 23 | 61% | 3 | 2 | 0 |
| C | 15 | 7 | 0 | 2 | 1 | 10 | 70% | 2 | 3 | 0 |
| D | 20 | 14 | 0 | 1 | 1 | 16 | 88% | 3 | 1 | 0 |
| E | 21 | 8 | 0 | 9 | 0 | 17 | 47% | 3 | 1 | 0 |
| F | 22 | 10 | 5 | 3 | 1 | 19 | 53% | 3 | 0 | 0 |
| J01 | 10 | 6 | 0 | 3 | 0 | 9 | 67% | 0 | 1 | 0 |
| J03 | 10 | 7 | 1 | 1 | 0 | 9 | 78% | 1 | 0 | 0 |
| J04 | 10 | 6 | 2 | 0 | 0 | 8 | 75% | 1 | 1 | 0 |
| J05 | 9 | 7 | 0 | 1 | 0 | 8 | 88% | 1 | 0 | 0 |
| All | 176 | 94 | 11 | 30 | 5 | 140 | 67% | 23 | 13 | 0 |

The A, D and All rows include the round-5 runner package (see "Round 5: native-runner
gaps"): A-6 moved from SOFTWARE to EMULATOR, and D-8 from SOFTWARE to EVIDENCED on a
recorded host-runtime run. No other count changed; in particular nothing moved to
EVIDENCED on the strength of instrumentation, because none of it has been run.

UPSTREAM is zero because this audit established no step that certainly needs an elizaOS
change. Two failures could turn out to be upstream once someone runs them: the on-device
speech functional failure on arm64 (B-7) and the integrated password manager's native
flow, which current status records as failing before save/unlock (E-14).

## What a production Android user gets today

The persona is a flag-off Android build, signed in to Eliza Cloud with credits, with the
resident agent. Checked on the flag-off bundle with the Android bridge stubbed
(`test/browser/journey-core-loops.production.spec.ts`, 11 tests, added in this audit) and
by reading the adapters. The stub is not the native plugins.

| Loop | Development-only parts the journey depends on | Flag-off path |
| --- | --- | --- |
| A | Development agent profile, scripted reply, "Load conversations → Restore conversation". | Real path. The Welcome dialog signs in to Eliza Cloud; a funded account configures and starts the resident agent; chat streams over native IPC; Stop is honest and one check follows; the saved conversation is restored automatically after a restart. Cloud agent selection, provisioning and remote pairing are not offered on Android (A-16; pairing is retired). The flag-off web build cannot sign in to Cloud and says so; it offers remote pairing and offline use. |
| B | Development agent and "Action JSON" proposals, Cloud transcription fixture, speech fixture. | Real path for each part, never exercised together: the native recorder with Cloud transcription and playback (P-07; signed out it says "Sign in to Eliza Cloud to use voice" and captures nothing), encrypted native Notes, Android CalendarProvider and native reminders. Agent proposals need a real model to make them. |
| C | The alarm list, "Alarm saved.", ringing, snooze and dismiss in the journey belong to the browser build's own Clock. | Different product. On Android every request is a reviewed handoff to the installed Clock app: one `clockHandoff`, then "Check Clock; Alpha cannot confirm an alarm was changed." No alarm list, no ringing screen. With no Clock app the native message is shown and nothing is claimed. The browser Clock is not development-only: the flag-off web build has it. |
| D | The whole journey: development scheduler, typed snapshot, scripted output. | Real path that depends on the resident runtime advertising digest support. The panel says "Your agent runs schedules on this phone. It cannot run while the phone is off." Hosted execution while the phone is off does not exist (A-09). Signed out, the panel names the missing agent and offers no schedule controls. |
| E | Development vault, development "Proton Pass · development" provider, sample sign-in, speech fixture. | Browsing is real (isolated native WebView on Android, sandboxed frames in the web build). The password manager is the native integrated vault; the flag-off web build says "Saved passwords: Available in the Android app" and offers no vault. Native save/fill is recorded as failing before save/unlock. |
| F | Development mailbox (test 1); a synthetic provider injected at the Cloud client boundary on the flag-on server (tests 2–4); development "Device controls" shade (test 5). | Blocked for a real user: Gmail needs a Google grant through Eliza Cloud and the code exchange returns 401. Without a grant the Android Inbox says "Gmail access was revoked or needs authorization again" and offers Connect Gmail; signed out it says "Connect Eliza Cloud to use Gmail" and Compose says "Connect a Gmail account first." Notifications use the native plugins. |
| J01 | None. The development profile is incidental. | Real path. The whole loop passes on the flag-off web bundle with a synthetic camera. On Android the camera and CalendarProvider are native. |
| J03 | Development incoming-email simulator and development agent. | The attachment half is blocked with F. Files, the reviewed question and the source-linked note are real; with no agent the question is not sent and nothing is saved. |
| J04 | Synthetic Maps provider; development "Device controls → Back". | Honest unavailable state. No Maps provider is configured in a flag-off build, so the address reaches Maps and the user reads "Connect a Maps provider to search places and plan routes." No route can be produced. |
| J05 | Development agent. | Real path up to Send. The page review works flag-off; without an agent the draft is kept and the connection choices open. On Android the excerpt comes from the native WebView; `BrowserPageQuestionInstrumentedTest` (round 5) covers that path up to Send and has not been run. |

## Per-loop step tables

### A. Boot, authenticate and keep a conversation

Governing text: Completion plan journey A (1–5); flow audit F01, F03; runbook rows "Boot and design", "Resident startup and chat", "Lifecycle and recovery", "Distribution has no mock surfaces", "Test-mocks isolation"; AP-01, AP-02, AP-05.

Journey spec: `test/browser/journey-a-conversation.spec.ts` (passed in this audit).

| # | Required step or negative case | Evidence on this branch | Class |
| --- | --- | --- | --- |
| A-1 | Alpha is the HOME app and HOME returns to it (launcher variant) | `LauncherHomeInstrumentedTest` (drawer, Settings, stock dialer, three installed apps with HOME returning each time, Settings and the default-Home chooser still reachable), `SettingsRolesInstrumentedTest` (role removed, declined and accepted in Android's dialog), `ShellInstrumentedTest`. Round 5 added the runner's `--home-role` phase, which selects the launcher APK as HOME, requires a cold start through the HOME key and restores the original holder; without it both classes are refused, so they can no longer skip. `npm run test:android:instrumentation -- --owned-emulator --avd <avd> --serial emulator-NNNN --variants launcher --home-role --classes SettingsRoles,LauncherHome`. No run recorded. | EMULATOR |
| A-2 | Cold boot of the target phone image into Alpha HOME | None. No SKU is chosen (A-01) and no image has been booted. | DEVICE |
| A-3 | First usable screen has an accessible Talk control and typed entry | Journey A step 1. Flag-off Android: `journey-core-loops.production.spec.ts` loop A. | EVIDENCED |
| A-4 | A configured returning user can speak without passing setup (record, review, user sends; P-01) | `chat-voice-mode.spec.ts` ("ongoing Cloud conversation … sends only new speech"). Transcription is a closed fixture. Journey A has no spoken request. | EVIDENCED |
| A-5 | Signed-out and unavailable-voice states offer recovery and typing and capture nothing | `production-surface.spec.ts` ("signed-out voice requires Cloud without capture, upload or local fallback"), `voice-entry-context.spec.ts`. | EVIDENCED |
| A-6 | Denied microphone permission offers Settings recovery and typing | `VoicePermissionDeniedInstrumentedTest` (denied state, Open app settings and back, no capture file, typing in the composer) through `node scripts/test-native-permissions.mjs voice APP.apk TEST.apk NEW_OUTPUT`, which revokes RECORD_AUDIO in a temporary user before the app starts. Revoked while recording and granted again: `VoicePermissionRevokeInstrumentedTest` through `… voice-revoke …`. Both added in round 5; runner wiring is tested against a scripted adb. No run recorded. | EMULATOR |
| A-7 | Stock recovery and emergency routes stay reachable | None. | DEVICE |
| A-8 | Sign in to Eliza Cloud with the intended account | Renderer only, against a stubbed bridge: `production-surface.spec.ts` resident billing onboarding (7 modes). No real sign-in has been exercised. | HUMAN |
| A-9 | Select an existing Cloud agent | `dev-cloud-*.spec.ts` against the development Cloud fixture. Flag-off Android offers no Cloud agent (A-16); the flag-off web build cannot sign in at all. | HUMAN |
| A-10 | Provision a new agent explicitly; a lost provisioning response creates no duplicate agent | `cloud-personal-onboarding.spec.ts`, `dev-cloud-setup.spec.ts` (fixture). Not reachable flag-off. | HUMAN |
| A-11 | Pair a private remote host as a second route | Flag-off web: `connection-boundaries.production.spec.ts` (refusals, revocation, expiry). Flag-off Android: pairing is retired and the same spec asserts it never pairs. `RemoteAgentInstrumentedTest` needs a test-mocks build. | HUMAN |
| A-12 | Local-development mode is a diagnostic path and is absent from distribution | Journey A (development profile); `production-surface.spec.ts`. | EVIDENCED |
| A-13 | Type a request and get exactly one reply | Journey A (scripted development agent). Flag-off Android: `journey-core-loops.production.spec.ts` loop A (stubbed resident IPC, real streaming client). | EVIDENCED |
| A-14 | A typed request answered by the packaged resident runtime with real inference | `ResidentServiceInstrumentedTest` through `scripts/android-resident-instrumentation.mjs` (arm64 emulator and an owner-only Cerebras key file). No run recorded. | HUMAN |
| A-15 | Switch Notes, Calendar and Browser and keep the conversation | Journey A. Flag-off Android: `journey-core-loops.production.spec.ts` loop A (Notes, Calendar). | EVIDENCED |
| A-16 | Each request carries its source screen as context | `journey-core-loops.production.spec.ts` loop A (the posted turn names view home, then calendar). Journey A does not assert it. `AllViewAgentContextInstrumentedTest` has no runner. | EVIDENCED |
| A-17 | The connected agent and where it runs are shown, with no credential rendered | `journey-core-loops.production.spec.ts` loop A (agent name, "runs on this phone", no key in the page). Journey A shows only the development label. | EVIDENCED |
| A-18 | Cancel a stream: honest state, no blind resend, one later check | Journey A (the reply is held by the harness taking a Web Lock through `page.evaluate`); `chat-continuity.spec.ts` (controlled transport); `journey-core-loops.production.spec.ts` loop A. | EVIDENCED |
| A-19 | Cancel (decline) a pending action; nothing runs | `chat-decline.production.spec.ts`. Journey C renders Decline but never presses it. | EVIDENCED |
| A-20 | Offline or rate-limited before the message is posted: the text is kept and a later send posts once | `chat-continuity.spec.ts` (offline, rate limit, double Send). | EVIDENCED |
| A-21 | A physical network switch during a request still yields one result | None. | DEVICE |
| A-22 | Reload restores the saved conversation with one result per accepted request | Journey A, only after the user presses Load conversations → Restore conversation (the development profile does not restore by itself). Flag-off Android restores automatically: `journey-core-loops.production.spec.ts` loop A. | EVIDENCED |
| A-23 | Kill the app process and the resident runtime; recover each admitted result once | `ResidentWorkflowCrash`, `ResidentStreamTransport`, `PrivateResidentSocket` through `scripts/ci/resident-native.py`, which refuses to run outside a GitHub-hosted x86_64 runner. No passing run is recorded. `CombinedAgentRestartInstrumentedTest` is documented as never compiled or executed. | CI |
| A-24 | Token revoked or expired: the stated outcome is the one that happened, the key is removed, nothing reconnects | `connection-boundaries.production.spec.ts` (nine sign-out outcomes; revoked remote session). | EVIDENCED |
| A-25 | Real Eliza Cloud session expiry and revocation | None. | HUMAN |
| A-26 | No old-owner output after an account change | `production-surface.spec.ts` ("replaced"), `chat-continuity.spec.ts` ("disconnecting the agent mid-reply…"), `privacy-per-connection.spec.ts`. | EVIDENCED |
| A-27 | Native credential slots are isolated per owner | `ConnectionInstrumentedTest` through `scripts/ci/pending-recovery-ui.py` (hosted runner only). No passing run recorded. | CI |
| A-28 | The distribution bundle has no mock choice or entry point | `production-surface.spec.ts`; `scripts/audit-production-bundle.mjs` (passed on the bundle built for this audit). | EVIDENCED |
| A-29 | The installed distribution APK has no mock surface | `NoMockProductInstrumentedTest` (runner default); `scripts/verify-apks.mjs`. No APK was built at this source. | EMULATOR |
| A-30 | Test-mocks APK: enter mock mode, cause no native or provider effect, exit to a deliberate state | `mock-background-admission.spec.ts` (browser). `ConnectionChooserInstrumentedTest` needs a test-mocks APK; registered in round 5 and refused without `--test-mocks`: `npm run test:android:instrumentation -- --owned-emulator --avd <avd> --serial emulator-NNNN --test-mocks --classes ConnectionChooser`. No run recorded. | EMULATOR |
| A-31 | Lock/unlock, reboot and explicit runtime stop | `local-agent-stop.spec.ts` covers the stop read-back in the renderer. Lock and reboot: none. | DEVICE |

Count: 15 evidenced, 0 SOFTWARE, 4 EMULATOR, 2 CI; separately 6 HUMAN, 4 DEVICE, 0 UPSTREAM. **15 of 21 = 71%.**

### B. Voice to note to calendar event or reminder (also J02)

Governing text: Completion plan journey B; flow audit F07, F12, F13, J02; runbook rows "Speech and Notes", "Calendar", "Reminders"; AP-03, AP-06, AP-09.

Journey spec: `test/browser/journey-b-voice-note-actions.spec.ts` (passed in this audit).

| # | Required step or negative case | Evidence on this branch | Class |
| --- | --- | --- | --- |
| B-1 | Record a note: real recorder and retained audio | Journey B (the microphone is a Web Audio oscillator); `notes-audio-journey.spec.ts`. | EVIDENCED |
| B-2 | A physically spoken note captured by the phone microphone | None. | DEVICE |
| B-3 | Transcribe with the selected service | Journey B uses the closed Cloud transcription fixture (a fixed string). Real Cloud transcription needs a signed-in account; none has been exercised. | HUMAN |
| B-4 | Review and correct the transcript, save, reopen after reload | Journey B. | EVIDENCED |
| B-5 | Read aloud and stop | Journey B (speech output is a recording fixture); `note-read-aloud.spec.ts`. | EVIDENCED |
| B-6 | Audible read-aloud on the device speaker | `VoiceNoteReadAloudInstrumentedTest` (gate `localSpeech=1`); on-device speech failed its functional acceptance. | DEVICE |
| B-7 | On-device speech recognition and synthesis without network | `LocalSpeechInstrumentedTest`: recorded as 1 of 2 failed on arm64-v8a (`android/local-speech/qualified-runtime-manifest.json`, `functionalAcceptance.passed: false`). P-07 makes Cloud the default; whether on-device speech is still required is A-04. | HUMAN |
| B-8 | Edit and delete the selected note; it reaches Trash; restore it | `notes-trash.spec.ts` (seven tests). Not part of journey B. | EVIDENCED |
| B-9 | Trash empties automatically after 3 days | `notes-trash.spec.ts` ("purges exactly three days after deletion"). Native backstop `NotesTrashBackstopInstrumentedTest` has no recorded run. | EVIDENCED |
| B-10 | Full storage is refused without losing data | `notes-save-failure.spec.ts` covers failed writes. The "Trash is full. Empty Trash in Notes…" refusal (`notes-trash-adapter.ts`) has no test. Native `NotesStorageDurabilityInstrumentedTest` has no recorded run. | SOFTWARE |
| B-11 | Interrupted save keeps the unsaved text | `notes-save-failure.spec.ts`, `voice-save-ownership.spec.ts`. | EVIDENCED |
| B-12 | Native encrypted Notes storage survives a process restart | `NotesSecureStorageInstrumentedTest` (registered in round 5 with its `notesSecureStorage=1` gate: `--classes NotesSecureStorage`; its fresh-install migration method still has no campaign); `node scripts/test-native-restart.mjs notes`. No run at this source. | EMULATOR |
| B-13 | The agent proposes a calendar event; the review shows account, time zone and attendees before confirming | Journey B authors the proposal through the "Action JSON" development control, reads the calendar source ID and revision through `page.evaluate`, and asserts only that the review contains the title. Account, zone and attendees are not asserted anywhere in the journey. | SOFTWARE |
| B-14 | A real agent decides to propose the event or reminder | `LiveAgentInstrumentedTest` (gate `liveAgent=true`, real provider). No runner. | HUMAN |
| B-15 | Read the actual provider state after create, edit and delete (Android CalendarProvider) | `CalendarCrudInstrumentedTest`, `CalendarAgentCrudInstrumentedTest` through `scripts/test-calendar-regression.mjs`. No run at this source. | EMULATOR |
| B-16 | Edit and delete the same event through the agent | `dev-calendar-assistant.spec.ts` (one case per mode). Journey B never edits or deletes the agent-created event; it edits and deletes the hand-off event through Calendar controls. | EVIDENCED |
| B-17 | Create, edit and delete an event through the direct UI | Journey B steps 7a/7b. Flag-off web: `journey-core-loops.production.spec.ts` (B, C, J04). | EVIDENCED |
| B-18 | Add a reminder or to-do | Journey B (note hand-off and agent path). | EVIDENCED |
| B-19 | Edit its time | Journey B ("Start later", persisted after reload). | EVIDENCED |
| B-20 | The reminder is delivered by the OS | `dev-calendar-alerts.spec.ts` uses the simulated shade. Native: `ReminderOneOffInstrumentedTest` through `scripts/test-reminder-one-off.mjs`. No run at this source. | EMULATOR |
| B-21 | Snooze, complete, reopen and cancel | `reminder-lifecycle.spec.ts`, `reminder-decision-review.spec.ts`, `reminder-timing-review.spec.ts`. Journey B only cancels. | EVIDENCED |
| B-22 | Reboot re-arms the reminder | `ReminderRecoveryInstrumentedTest` through `scripts/test-reminder-recovery.mjs` (the runner really reboots the emulator). No run at this source. | EMULATOR |
| B-23 | A concurrent change invalidates a stale proposal instead of editing another object | `calendar-agent-transaction-cancel.spec.ts`, `dev-calendar-assistant.spec.ts`, `reminder-refusal-ui.spec.ts`. Not part of journey B. | EVIDENCED |
| B-24 | Reads and destructive changes need the intended scope, not a cached approval | `reminder-delete-review.spec.ts`, `reminder-create-review.spec.ts`, `notes-query-review.spec.ts`. | EVIDENCED |
| B-25 | Denied calendar permission or write access revoked during review | `CalendarCrudInstrumentedTest.revokedCalendarWriteAccessDuringReviewCannotDelete`, `WorkflowPhoneNativeInstrumentedTest.deniedCalendarGrantReturnsNoEvents`. No run at this source. | EMULATOR |
| B-26 | Notifications disabled: the reminder is saved and the state says delivery is off (J02 failure case) | `settings-truth.production.spec.ts` reads a blocked channel back from a stub. Native: `node scripts/test-native-permissions.mjs channels`. No run at this source. | EMULATOR |
| B-27 | Audio interrupted or transcription failed keeps the recording (J02 failure cases) | `note-audio-lifecycle.spec.ts`, `voice-save-ownership.spec.ts`, `notes-audio-journey.spec.ts`. | EVIDENCED |
| B-28 | A saved voice note can start a calendar event directly, and created records link back to the note | Neither exists. The only route to an event is the reminder draft with its calendar switched to "In this app"; the created reminder or event has no reference to the note. | SOFTWARE |

Count: 14 evidenced, 3 SOFTWARE, 6 EMULATOR, 0 CI; separately 3 HUMAN, 2 DEVICE, 0 UPSTREAM. **14 of 23 = 61%.**

### C. Alarms

Governing text: Completion plan journey C; runbook row "Clock"; pending decision A-11; AP-09.

Journey spec: `test/browser/journey-c-alarms.spec.ts` (passed in this audit).

| # | Required step or negative case | Evidence on this branch | Class |
| --- | --- | --- | --- |
| C-1 | A set request is reviewed with its exact content and nothing runs before approval | Journey C (proposal authored through "Action JSON"); `agent-clock-handoff.spec.ts`; flag-off Android: `journey-core-loops.production.spec.ts` loop C. | EVIDENCED |
| C-2 | One approval is one handoff; the record says only that the handoff opened | Journey C; `journey-core-loops.production.spec.ts` loop C (one `DailyApps.clockHandoff`, "Alpha cannot confirm an alarm was changed"). | EVIDENCED |
| C-3 | Android builds the correct Clock intents for set, show, snooze and dismiss | `ClockHandoffInstrumentedTest` (intents intercepted), `ClockRepeatDaysInstrumentedTest`. Neither had a runner entry before this audit; no run recorded. | EMULATOR |
| C-4 | A real alarm is created, rings, snoozes and is dismissed in the installed Clock | `RealClockInstrumentedTest` (runner registry, needs `--clock-exclusive`). No run recorded. | EMULATOR |
| C-5 | Audible ringing, vibration and Do Not Disturb behaviour | None. | DEVICE |
| C-6 | No Clock handler: the request reports that and claims nothing | `journey-core-loops.production.spec.ts` loop C ("unavailable" outcome: one request, native message shown, no saved-alarm wording). | EVIDENCED |
| C-7 | Denied access | `ClockAgentReviewInstrumentedTest` injects a denied delivery (through `scripts/ci/pending-recovery-ui.py`, hosted runner only). No passing run recorded. | CI |
| C-8 | The phone image has no Clock app at all | No test runs on such an image. Whether the image ships a Clock app or Alpha owns alarms is A-11. | HUMAN |
| C-9 | Reboot: the alarm persists | Owned by Android Clock under the current handoff. None. | DEVICE |
| C-10 | Time-zone change between review and confirmation retires the request | `journey-core-loops.production.spec.ts` loop C (added in this audit; the adapter branch had no test). | EVIDENCED |
| C-11 | A repeated request after an unknown result is preceded by a warning, across a restart | `journey-core-loops.production.spec.ts` loop C (added in this audit). | EVIDENCED |
| C-12 | Late delivery and DST behaviour of a set alarm | Owned by Android Clock. None. | DEVICE |
| C-13 | Cancelling the review sends nothing | `journey-core-loops.production.spec.ts` loop C (added in this audit). Journey C never declines or cancels. | EVIDENCED |
| C-14 | Reminder delivery is never presented as an alarm-clock guarantee | Journey C (no "will ring", "confirmed" wording); `journey-core-loops.production.spec.ts` loop C (no "Alarm saved", "Ringing"). | EVIDENCED |
| C-15 | Who owns alarms | Undecided: A-11. | HUMAN |

Count: 7 evidenced, 0 SOFTWARE, 2 EMULATOR, 1 CI; separately 2 HUMAN, 3 DEVICE, 0 UPSTREAM. **7 of 10 = 70%.**

### D. Two scheduled digests

Governing text: Completion plan journey D; flow audit F15; runbook row "Workflows and results"; open decision A-09; AP-07.

Journey spec: `test/browser/journey-d-digests.spec.ts` (passed in this audit).

| # | Required step or negative case | Evidence on this branch | Class |
| --- | --- | --- | --- |
| D-1 | Morning and evening schedules created after review, each with owner, source, IANA zone and local time | Journey D (development scheduler); `dev-digest-schedule.spec.ts`. | EVIDENCED |
| D-2 | Schedule identity: template version and enabled revision survive replay and lost acknowledgements | `dev-digest-schedule.spec.ts` ("digest mutation replay, lost acknowledgements, revocation and account retirement retain exact identities"). Journey D does not assert a version. | EVIDENCED |
| D-3 | Input is an identified snapshot with its freshness | Journey D (a typed snapshot reviewed in the panel); `digest-source-renewal.spec.ts`. | EVIDENCED |
| D-4 | Real provider sources (mail, calendar, tasks) feed a digest | None. Needs a Google grant; the Google code exchange currently returns 401. | HUMAN |
| D-5 | The phone is powered off before admission and two server runs complete while it is off | Not coverable. The resident agent cannot run on a powered-off phone; A-09 is open. | HUMAN |
| D-6 | Each occurrence runs once with a distinct run ID, scheduled instant and retained output | Journey D (development scheduler; the output is the scripted reply). | EVIDENCED |
| D-7 | A restart inside the scheduled minute does not admit the occurrence twice (renderer) | Journey D (page reload inside the minute). | EVIDENCED |
| D-8 | A resident worker killed at an admission or execution boundary creates no duplicate result | `npm run agent:test-digest-restart`, run in round 5 at upstream `352d7a08`: exit 0. The interrupted run stays `outcome-unknown` with no result and no second inference, duplicate admissions return the same run ID, and a never-admitted overdue occurrence yields one explicit `missed` result. This is host-runtime evidence with a synthetic model (class S), not Android, and it is one recorded manual run: the check needs a 6 GB prepared source and is in no automated lane. Preparation and the recorded result: `docs/local-agent-development.md`, "Isolated digest process-recovery check". | EVIDENCED |
| D-9 | Revoke a source | `dev-digest-schedule.spec.ts` ("a clock set back, a paused schedule and a revoked source never settle an occurrence twice or late"). | EVIDENCED |
| D-10 | Edit and disable a schedule | `dev-digest-schedule.spec.ts` ("an edited time runs once at its new time"; paused schedule). | EVIDENCED |
| D-11 | Overlap and missed time leave explicit records and no backlog replay | Journey D; `dev-digest-schedule.spec.ts`; `test/digest-occurrence-delivery.test.mjs`. | EVIDENCED |
| D-12 | DST gap skipped; repeated local time admitted once at the earlier offset | `dev-digest-schedule.spec.ts` (repeated and skipped clock-time scenarios). | EVIDENCED |
| D-13 | On reconnect each exact output is shown once and acknowledgements survive another restart (renderer) | Journey D (reload); `dev-hosted-results.spec.ts`. | EVIDENCED |
| D-14 | The native result inbox recovers a committed result with a lost acknowledgement once across process death | `HostedProcessRestartInstrumentedTest` (runner default, three phases). No run recorded. | EMULATOR |
| D-15 | A result notice delivered in the background and tapped after a process restart reaches the exact result | `dev-hosted-journey.spec.ts` needs a local-agent build and its own server. Native: `WorkflowNoticeProcessDeathInstrumentedTest` through `scripts/ci/pending-recovery-ui.py` (hosted runner only). | CI |
| D-16 | Actions that could not run stay waiting or expired and never gain a success receipt | `workflow-outcome-unknown.spec.ts`, `workflow-interruption-recovery.spec.ts`. | EVIDENCED |
| D-17 | Home shows the last real brief and never a missed record | `home-attention.spec.ts`, `test/home-cards.test.mjs`. Journey D asserts only the value read through `page.evaluate`, not the rendered card. | EVIDENCED |
| D-18 | The flag-off Android panel says schedules run on the phone and cannot run while it is off | `journey-core-loops.production.spec.ts` loops D and F on Android (added in this audit). | EVIDENCED |
| D-19 | Morning and evening flows run on the resident runtime with real model output on a phone | None. | HUMAN |
| D-20 | Delivery under battery saver, Doze and lock | None. | DEVICE |

Count: 14 evidenced, 0 SOFTWARE, 1 EMULATOR, 1 CI; separately 3 HUMAN, 1 DEVICE, 0 UPSTREAM. **14 of 16 = 88%.**

### E. Browser and credentials

Governing text: Completion plan journey E; flow audit F08, F09, J08; runbook row "Browser and passwords"; P-04, P-05; AP-11.

Journey spec: `test/browser/journey-e-browser-credentials.spec.ts` (passed in this audit).

| # | Required step or negative case | Evidence on this branch | Class |
| --- | --- | --- | --- |
| E-1 | Navigate, search, Back and Forward | Journey E (local HTTP pages; the search result is fulfilled by the test); `browser-navigation.spec.ts`; flag-off web: `journey-core-loops.production.spec.ts` (E, J05). | EVIDENCED |
| E-2 | Open and switch tabs | Journey E. | EVIDENCED |
| E-3 | Upload a test-owned file | Not in the journey and no browser-build spec. Native: `BrowserFlowInstrumentedTest` (runner default). No run at this source. | EMULATOR |
| E-4 | Download a test-owned file | Not in the journey. Native: `BrowserDownloadInstrumentedTest` (needs `--test-mocks`). The last recorded pass is "Build47, 2026-09-30", with no commit. | EMULATOR |
| E-5 | Return from an external handoff | `BrowserSigninsInstrumentedTest` (tel links, app links). No run at this source. | EMULATOR |
| E-6 | Only reviewed page text reaches speech | Journey E (it replaces `BrowserVoice.prototype.synthesizeLocal` through `page.evaluate` and the call ends in a thrown "Fixture terminal"); `reading-review.spec.ts`. | EVIDENCED |
| E-7 | Navigating during approval rejects the old target (renderer) | `web-summary-note.spec.ts` ("a changed native-style document identity retires the pending page excerpt"), `browser-navigation.spec.ts`. Not in journey E. | EVIDENCED |
| E-8 | Native reading binds to the reviewed document and rejects replay and stale documents | `BrowserReading`, `BrowserReadingNavigation`, `BrowserIsolatedReading` instrumentation. None had a runner entry before this audit; no run recorded. | EMULATOR |
| E-9 | Malicious page content cannot reach the privileged bridge or authorize an action | Journey E checks only that an inline script did not run in the host document. The bridge boundary itself is native: `BrowserIsolatedReadingInstrumentedTest`. No run recorded. | EMULATOR |
| E-10 | A sign-in in a normal tab survives an app restart (P-04) | Not coverable in the browser build. `BrowserSigninsInstrumentedTest.signinProcessRestartPhase` named a runner case that did not exist; it was added in this audit. No run recorded. | EMULATOR |
| E-11 | Nothing from a private tab persists after it closes | Journey E covers the tab list and history only. Cookies and storage: the same native phase. No run recorded. | EMULATOR |
| E-12 | Vault, OTP and recovery pages with secrets in plain text never reach reading or the agent | `reading-sensitive.spec.ts` (credential prose, sensitive addresses, API-key URLs). Journey E covers a password input only. | EVIDENCED |
| E-13 | Integrated password manager: unlock, add, lock (renderer against a stubbed native vault) | `password-manager.spec.ts` ("native vault: Android unlock, app bindings, copy and autofill picker with status readback"). Journey E uses the development vault and development provider, which do not exist flag-off. | EVIDENCED |
| E-14 | Integrated vault on Android: Keystore, device unlock, save and fill on a site | `BrowserAutofillInstrumentedTest` (test-mocks APK only; the runner entry named a class that does not exist and was corrected in this audit), `PasswordBrowserFillInstrumentedTest`. Current status records the native flow as failing before save/unlock. | EMULATOR |
| E-15 | Cancel the picker; disable and re-enable the provider | `password-provider-setup.spec.ts` (stubbed bridge). | EVIDENCED |
| E-16 | Wrong-origin rejection and iframe boundaries | `PasswordBrowserFillInstrumentedTest` (cross-origin frame never offered), `BrowserAutofillInstrumentedTest`. No run recorded. | EMULATOR |
| E-17 | Multi-tab transitions, process death and provider or browser update | None. | DEVICE |
| E-18 | Proton Pass: real provider sign-in, save and fill | None. | HUMAN |
| E-19 | Passkeys | Not implemented; A-12. | HUMAN |
| E-20 | Qualification on a release-signed device | None; no release signer exists (A-06). | HUMAN |
| E-21 | The flag-off web build shows an honest password page and no development vault | `journey-core-loops.production.spec.ts` (E, J05); `password-manager.spec.ts` ("browser build without the development profile offers no simulated vault"). | EVIDENCED |

Count: 8 evidenced, 0 SOFTWARE, 9 EMULATOR, 0 CI; separately 3 HUMAN, 1 DEVICE, 0 UPSTREAM. **8 of 17 = 47%.**

### F. Email and reconnect notifications

Governing text: Completion plan journey F; flow audit F06, F14; runbook rows "Email", "Settings and notifications"; P-02; AP-08, AP-12.

Journey spec: `test/browser/journey-f-email-notifications.spec.ts` (passed in this audit).

| # | Required step or negative case | Evidence on this branch | Class |
| --- | --- | --- | --- |
| F-1 | Authorize only the required managed scopes and select an account | The synthetic provider starts with one connected account. The real Google code exchange returns 401 (`docs/cloud-production-validation.md`). | HUMAN |
| F-2 | Fetch full thread context | Journey F (a one-message thread); `gmail-mvp-scope.spec.ts`, `inbox-folders-drafts.spec.ts`. | EVIDENCED |
| F-3 | Explicitly open a permitted attachment | `inbox-save-attachment.spec.ts` (closed provider fixture). | EVIDENCED |
| F-4 | A local draft is kept independently of provider draft state | Journey F tests 1 and 2. | EVIDENCED |
| F-5 | Review exact From, To, Cc, Bcc, body and attachments before send | Journey F asserts From, To, Subject and body. Cc, Bcc and an attachment line are not asserted in any send review. | SOFTWARE |
| F-6 | The same mutation identity is used across app recreation (renderer) | Journey F (reload: one prepare, one dispatch). The secure slot store is replaced with test storage through `page.evaluate`. | EVIDENCED |
| F-7 | The native encrypted operation journal survives recreation and process restart | `InboxOperationJournalInstrumentedTest` (no runner entry before this audit); `node scripts/test-native-restart.mjs inbox`. No run at this source. | EMULATOR |
| F-8 | A lost response is unknown and never resent automatically | Journey F test 3. | EVIDENCED |
| F-9 | Grant revocation | `gmail-grant-recovery.spec.ts`; flag-off Android without a grant: `journey-core-loops.production.spec.ts` loops D and F. | EVIDENCED |
| F-10 | A draft changed after review invalidates the review | No test found for a send review whose draft changes afterwards (`gmail-mvp-scope.spec.ts` covers a stale archive review only). | SOFTWARE |
| F-11 | An incorrect returned provider ID is refused | Journey F, new test in this audit: a reply naming another request is not confirmed and is never sent again. The review previously showed the internal text "Unexpected operation receipt"; that wording was replaced. | EVIDENCED |
| F-12 | Pagination revision changes | `gmail-mvp-scope.spec.ts` pages with Load more; no case changes the mailbox revision between pages. | SOFTWARE |
| F-13 | Archive, trash and undo | Archive is reviewed and a stale review discarded (`gmail-mvp-scope.spec.ts`); Trash lists (`inbox-folders-drafts.spec.ts`). No provider trash or undo test was found. | SOFTWARE |
| F-14 | A real external send to an authorized recipient | None. | HUMAN |
| F-15 | A result or reminder is delivered while the app is in the background | `HostedBackgroundWorkerInstrumentedTest` (no runner entry before this audit), `ReminderOneOffInstrumentedTest`. No run at this source. | EMULATOR |
| F-16 | A notice tapped after a process restart reaches exactly its own result or task | Journey F test 5 uses the development "Device controls → Notifications" shade and a page reload. Native: `ReminderTapProcessDeath`, `WorkflowNoticeProcessDeath` through `scripts/ci/pending-recovery-ui.py` (hosted runner only). No passing run recorded. | CI |
| F-17 | With the channel disabled, in-app history still receives the result | `settings-truth.production.spec.ts` (stub). Native: `HostedResultNoticeInstrumentedTest.deniedNotificationRetainsEncryptedHistory` through `node scripts/test-native-permissions.mjs notice-denied APP.apk TEST.apk NEW_OUTPUT` (round 5: POST_NOTIFICATIONS revoked before start, gate `hostedNoticeDenied=1`; the result is read back from encrypted history, no notice is posted or pending), and `… channels …`. The test reads the stored result through the bridge; it does not open the in-app history screen. No run recorded. | EMULATOR |
| F-18 | A notification seen or dismissed is distinct from a completed task | `dev-hosted-results.spec.ts`, `notification-action-lifecycle.spec.ts`. | EVIDENCED |
| F-19 | Source-account isolation | `inbox-owner-fence.spec.ts`. | EVIDENCED |
| F-20 | After a confirmed send the retained local copy is not offered for sending again | It is offered ("Resume unsaved email"), and the receipt says a second send creates another message. Journey F asserts this as current behaviour. | SOFTWARE |
| F-21 | New-mail notifications | Not implemented; A-05. | HUMAN |
| F-22 | Flag-off builds have no development mailbox and say which account is missing | `journey-core-loops.production.spec.ts` (D and F in the web build; D and F on Android). | EVIDENCED |

Count: 10 evidenced, 5 SOFTWARE, 3 EMULATOR, 1 CI; separately 3 HUMAN, 0 DEVICE, 0 UPSTREAM. **10 of 19 = 53%.**

### J01. Poster to calendar

Governing text: Flow audit J01 and F10, F07; P-08.

Journey spec: `test/browser/journey-j01-poster-calendar.spec.ts` (passed in this audit).

| # | Required step or negative case | Evidence on this branch | Class |
| --- | --- | --- | --- |
| J01-1 | Capture a poster and recognize its text (English) | Journey J01 (the camera is a canvas stream; OCR is the real local engine). Flag-off web: `journey-core-loops.production.spec.ts` loop J01. | EVIDENCED |
| J01-2 | A physical camera capture of a printed poster | None. | DEVICE |
| J01-3 | An uncertain or impossible date is caught at review | `scan-event.spec.ts` ("rejects nonexistent DST time and can be corrected before handoff"). Journey J01 overwrites the recognized text with the exact poster text before drafting. | EVIDENCED |
| J01-4 | Edit the event draft | Journey J01. | EVIDENCED |
| J01-5 | Cancel at review or leave the Calendar form: nothing is saved | Journey J01. | EVIDENCED |
| J01-6 | Select the destination calendar and read the provider back | Journey J01 saves only to the in-app calendar. Android: `CalendarAgentCrudInstrumentedTest` (gate `calendarOptions=1`). No run at this source. | EMULATOR |
| J01-7 | Calendar scope denied | None in the browser build. Native: `CalendarCrudInstrumentedTest`, `WorkflowPhoneNativeInstrumentedTest`. No run at this source. | EMULATOR |
| J01-8 | Save creates exactly one event that survives reload | Journey J01; `journey-core-loops.production.spec.ts` loop J01. | EVIDENCED |
| J01-9 | The Home agenda card shows it and opens the same event | Journey J01. | EVIDENCED |
| J01-10 | The native scan path publishes nothing to Photos unless kept | `CameraScanInstrumentedTest` (no runner entry before this audit). No run recorded. | EMULATOR |

Count: 6 evidenced, 0 SOFTWARE, 3 EMULATOR, 0 CI; separately 0 HUMAN, 1 DEVICE, 0 UPSTREAM. **6 of 9 = 67%.**

### J03. Email attachment to notes

Governing text: Flow audit J03 and F06, F16, F12.

Journey spec: `test/browser/journey-j03-document-analysis.spec.ts` (passed in this audit).

| # | Required step or negative case | Evidence on this branch | Class |
| --- | --- | --- | --- |
| J03-1 | Select an attachment in an Inbox thread and save it to Files | Journey J03 uses the development incoming-email simulator, which does not exist flag-off. Provider path: `inbox-save-attachment.spec.ts` (closed fixture). | EVIDENCED |
| J03-2 | A real mailbox attachment | None; blocked with loop F on the Google grant. | HUMAN |
| J03-3 | Preview the file in Files | Journey J03. | EVIDENCED |
| J03-4 | Only the reviewed excerpt reaches the agent | Journey J03 (asserted on the development agent's stored messages). | EVIDENCED |
| J03-5 | Save a reviewed note with a source link and reopen it after reload | Journey J03. | EVIDENCED |
| J03-6 | A changed or deleted source fails closed | Journey J03 (the bytes are rewritten directly in IndexedDB through `page.evaluate`; no rendered control edits stored bytes); `source-reference-integrity.spec.ts`. | EVIDENCED |
| J03-7 | A native document grant is restored and revoked across a process restart (expired URI) | `node scripts/test-native-restart.mjs document`; `SelectedDocumentInstrumentedTest`. No run at this source. | EMULATOR |
| J03-8 | A malicious attachment (active content, wrong type, oversized) | `inbox-save-attachment.spec.ts` rejects a mismatched digest; `MailAttachmentInstrumentedTest` bounds bytes. No test drives an HTML or script attachment through review and save. | SOFTWARE |
| J03-9 | The account is revoked | `gmail-grant-recovery.spec.ts` (read availability cleared). | EVIDENCED |
| J03-10 | Flag-off without an agent: the document question is not sent and nothing is saved | `journey-core-loops.production.spec.ts` loop J03. | EVIDENCED |

Count: 7 evidenced, 1 SOFTWARE, 1 EMULATOR, 0 CI; separately 1 HUMAN, 0 DEVICE, 0 UPSTREAM. **7 of 9 = 78%.**

### J04. Schedule to travel

Governing text: Flow audit J04 and F07; Maps row of the flow-audit product decisions.

Journey spec: `test/browser/journey-j04-schedule-travel.spec.ts` (passed in this audit).

| # | Required step or negative case | Evidence on this branch | Class |
| --- | --- | --- | --- |
| J04-1 | Create an event with an address | Journey J04; `journey-core-loops.production.spec.ts` (B, C, J04). | EVIDENCED |
| J04-2 | The selected address is handed to Maps exactly once | Journey J04 (synthetic Maps provider installed through `page.evaluate`); `calendar-maps-handoff.spec.ts`. | EVIDENCED |
| J04-3 | Several candidate addresses: nothing is selected or routed until the user chooses | Journey J04. | EVIDENCED |
| J04-4 | No Maps provider: the address is kept and no destination is invented | `calendar-maps-handoff.spec.ts`; flag-off web: `journey-core-loops.production.spec.ts` (B, C, J04). | EVIDENCED |
| J04-5 | No location permission: a manual origin is offered | Journey J04 ("Start" reports the missing permission). Native: `node scripts/maps/test-native-recovery.mjs permission`. | EVIDENCED |
| J04-6 | A route for a production user | The flag-off build has no Maps provider: `VITE_MAPS_BASE_URL` is unset and the emulator gateway exists only in test-mocks builds (`apps/app/src/maps/regional-provider.ts`). A production user gets "Connect a Maps provider to search places and plan routes." No decision ID covers choosing and licensing a provider. | HUMAN |
| J04-7 | Return to the same event | Only through system Back, which the journey drives with the development "Device controls → Back" button. Maps has no control that returns to the event. | SOFTWARE |
| J04-8 | Reload does not replay the hand-off | Journey J04. | EVIDENCED |
| J04-9 | GPS navigation and turn-by-turn | `MapsRegionalInstrumentedTest`, `MapsBackgroundNavigationInstrumentedTest` (regional fixture gateway). Physical navigation: none. | DEVICE |
| J04-10 | The selected travel mode is exposed to assistive technology | The mode buttons carry no `aria-pressed` (`template.html`); selection is shown by colour only. | SOFTWARE |

Count: 6 evidenced, 2 SOFTWARE, 0 EMULATOR, 0 CI; separately 1 HUMAN, 1 DEVICE, 0 UPSTREAM. **6 of 8 = 75%.**

### J05. Web research to note

Governing text: Flow audit J05 and F08, F12.

Journey spec: `test/browser/journey-j05-web-research-note.spec.ts` (passed in this audit).

| # | Required step or negative case | Evidence on this branch | Class |
| --- | --- | --- | --- |
| J05-1 | Bounded review of a page excerpt | Journey J05 (page fulfilled by the test); flag-off web: `journey-core-loops.production.spec.ts` (E, J05). | EVIDENCED |
| J05-2 | Native WebView excerpt extraction bound to the page revision | `BrowserPageQuestionInstrumentedTest` (round 5): `AlphaBrowser.reviewQuestion` refuses another address, origin, session or navigation number; frame, form and hidden content is not extracted; a navigation between extraction and approval retires the excerpt and the old request cannot be replayed; sensitive addresses and content yield no excerpt; Menu → Ask about page → native review → question editor → composer shares nothing before Send, and Send with no agent dispatches nothing; a note with a web source keeps it across recreation and reopens that address. The agent's answer and the summary-note save after it are not covered (no agent on a distribution emulator build); the note in the last method is stored in the shape that save writes. `npm run test:android:instrumentation -- --owned-emulator --avd <avd> --serial emulator-NNNN --classes BrowserPageQuestion`. No run recorded. | EMULATOR |
| J05-3 | The agent answers from the excerpt | Journey J05 (scripted reply). | EVIDENCED |
| J05-4 | Explicit save creates exactly one source-linked note that reopens after reload | Journey J05. | EVIDENCED |
| J05-5 | Observation unavailable (cross-origin denied): pasted text is reviewed instead | Journey J05 second test. | EVIDENCED |
| J05-6 | Cross-origin navigation or stale context retires the excerpt | `web-summary-note.spec.ts` ("a changed native-style document identity retires…", "HOME while fetching retires the page question"). Not in journey J05. | EVIDENCED |
| J05-7 | A sensitive page is refused before any editor opens | `web-summary-note.spec.ts`; journey E. | EVIDENCED |
| J05-8 | Flag-off without an agent: the question is not sent and the draft is kept | `journey-core-loops.production.spec.ts` (E, J05). | EVIDENCED |
| J05-9 | A real agent answers from the reviewed excerpt | None. | HUMAN |

Count: 7 evidenced, 0 SOFTWARE, 1 EMULATOR, 0 CI; separately 1 HUMAN, 0 DEVICE, 0 UPSTREAM. **7 of 8 = 88%.**

## How the journey specs fall short of their loops

These are properties of the specs, not failures: every one passes.

- **Fixtures in place of the thing under test.** The agent in A, B, C, D, J03 and J05 is a
  scripted reply; no model output is evidence. Every agent proposal (B, C) is typed into
  the "Action JSON" development control. Transcription (B) is a fixed string. Speech (B,
  E) is a recording fixture; in E the speech call is replaced through `page.evaluate` and
  ends in a thrown error. Mail in F tests 2–4 is a provider object injected at
  `connectionController.getCloudClient`, with the secure slot store replaced by test
  storage, on the flag-on development server at `/`. That is the product renderer, not the
  production bundle.
- **State changed outside rendered controls.** A holds the development agent's Web Lock to
  create a pending reply. B reads the calendar source ID and revision from the phone
  context to build its proposal. J03 rewrites stored file bytes in IndexedDB. J04 and F
  install provider fixtures after every load. D moves the clock and models "app closed"
  by navigating to `about:blank`.
- **Results read from storage, not the screen.** B, C, D and J03 assert most
  exactly-once results through read-only `page.evaluate` views of persisted documents.
  D asserts Home's brief only as the value Home would read.
- **Steps the loop requires that the journey never takes.** A: no spoken request, no
  declined action, no automatic restore. B: no Trash, restore or 3-day emptying, no
  delivery, snooze or completion, no agent edit or delete of the event it created, no
  stale-proposal case. C: Decline is rendered and never pressed; show is the only handoff
  besides set. D: no source revocation, schedule edit or disable. E: no upload, download,
  external handoff or navigation during approval. F: no Cc/Bcc/attachment review, no
  revocation, no hosted-result tap.
- **Development controls standing in for the system.** F's notification tap uses the
  development "Device controls → Notifications" list; J04's return to the event uses
  "Device controls → Back".
- **The journey for C tests a different product from the Android one** (see the flag-off
  table).

## SOFTWARE work orders, in priority order

Fixed in this audit (each with a test; see "Changes made"): the dead `PasswordAutofillOffer`
runner entry, the missing runner entries for core-loop classes, the missing `signin`
restart case, the raw "Unexpected operation receipt" text, and the missing flag-off
journey assertions.

1. **Confirmed send keeps a resendable copy (F-20).** After "Provider confirmed this
   operation", remove the retained unsaved composer record; keep it for an unknown outcome.
   Files: `apps/app/src/prototype/inbox-unsaved.ts`, `inbox-cloud-adapter.ts`, receipt copy
   in the review. Acceptance: journey F asserts "Resume unsaved email" is absent after a
   confirmed send and present after an unknown outcome; `docs/inbox-local-drafts.md`
   updated. Belongs to the Inbox owner; it changes documented behaviour.
2. **Calendar proposal review content (B-13).** Assert, and add if missing, the destination
   calendar or account, the time zone and attendees in "Review calendar change". Files:
   `test/browser/journey-b-voice-note-actions.spec.ts`, `apps/app/src/prototype/calendar-adapter.ts`.
   Acceptance: a proposal with a non-device time zone and one attendee shows all three
   before Confirm, and a changed source revision refuses.
3. **Send review shows Cc, Bcc and attachments (F-5).** Extend journey F's synthetic
   provider with Cc, Bcc and one attachment. Acceptance: each appears in "Review mail
   operation" before "Send this email"; the dispatched proposal equals the reviewed one.
4. **Draft changed after review (F-10).** New case in `inbox-folders-drafts.spec.ts` or
   journey F: open the review, close it, edit the body, Send. Acceptance: a second prepare
   with a new digest; the first digest is never dispatched.
5. **Note to event hand-off and back-link (B-28).** A "Review event draft" control on a
   saved voice note (`voice-adapter.ts`, `template.html`), and a `noteSource` reference
   (note ID and revision) on reminders and events created from a note, with "Open source
   note" in the event detail that fails closed when the note is in Trash. Acceptance:
   journey B uses the control and opens the note back after reload.
6. **Return from Maps to the event (J04-7).** An in-app "Back to event" control when Maps
   was opened from Calendar (`maps-adapter.ts`, `template.html`). Acceptance: journey J04
   returns without the development Back control and without a new provider request.
7. **Denied-microphone campaign (A-6). Done in round 5** (`voice` and `voice-revoke`
   scenarios; see "Round 5: native-runner gaps"). Original order: add a `voice` scenario to
   `scripts/test-native-permissions.mjs` that revokes RECORD_AUDIO for the temporary user,
   runs `VoicePermissionDeniedInstrumentedTest` with `-e voicePermissionDenied 1` and
   restores the permission. Acceptance: runner-wiring test in
   `test/android-instrumentation-runner.test.mjs`; then an emulator run.
8. **Runner gaps for existing classes. Done in round 5**, except that (d) stops at Send:
   the summary-note save needs an agent reply. Original order: (a) Select and restore the HOME role on the owned
   emulator so `LauncherHomeInstrumentedTest` does not skip (A-1). (b) A denied-notification
   scenario that passes `hostedNoticeDenied=1` (F-17). (c) A registry entry for
   `ConnectionChooserInstrumentedTest` on the test-mocks pair (A-30). (d) Write a native
   test that takes a page excerpt through `AlphaBrowser.reviewQuestion` to a saved note
   and retires the token on navigation (J05-2); none exists.
9. **Resident digest restart test has no lane (D-8). Documented and run in round 5** (passed);
   it is still in no workflow, which is the CI owner's decision. Original order: `npm run agent:test-digest-restart`
   needs `ALPHA_ELIZA_SOURCE` with dependencies and is run by nothing. Document the exact
   preparation in `docs/verification.md`, run it once at this source and record the
   result; add it to a workflow only through the CI owner.
10. **Trash-full refusal (B-10).** Case in `notes-trash.spec.ts`: fill Trash to its limit,
    delete another note. Acceptance: "Trash is full. Empty Trash in Notes…" is shown, the
    note is not deleted and nothing is lost. (Notes Trash is the round-2 MVP-15 area.)
11. **Malicious attachment (J03-8).** Provider-fixture case with an HTML attachment
    containing a script and an oversized attachment. Acceptance: the review shows inert
    text or refuses, Save to Files stores exact bytes, nothing executes and no request
    leaves the page.
12. **Mailbox mutation coverage (F-12, F-13).** A page-two response under a changed
    mailbox revision reloads the list instead of mixing pages; provider Trash is a
    reviewed operation; undo either exists and is tested or is recorded under A-15.
13. **Travel-mode state for assistive technology (J04-10).** `aria-pressed` on the four
    mode buttons in `template.html` and an assertion in journey J04. Belongs to the
    accessibility package.
14. **Journey hardening.** A: a spoken request and a declined proposal. C: press Decline;
    assert snooze and dismiss requests on the stubbed Android path. D: assert the rendered
    Home card. E: navigation during approval. None of these changes product code.
15. **`scripts/test-clock-handoff-flow.mjs` is referenced by no npm script, workflow or
    document.** Wire it into `npm test` or remove it. **Not an orphan (round 5):** it is one
    of the scripts `test/adapter-contracts.test.mjs` runs, so `npm test` already runs it as
    "adapter contract: test-clock-handoff-flow.mjs". It tests the current
    `clock-adapter.ts` against a controlled native boundary and passes. Nothing to wire or
    remove.

## EMULATOR and CI campaigns

Nothing below has a result at this source. All need APKs built from this source first:
`npm run android:build:local` (speech AAR first; see README), and
`npm run android:build -- --test-mocks` for the test-mocks pair. Use an owned, disposable
emulator; this host can run arm64 images only.

| # | Closes | Command |
| --- | --- | --- |
| 1 | A-29, D-14, E-3, E-5 | `npm run test:android:instrumentation -- --owned-emulator --avd <avd> --serial emulator-NNNN` (default classes: NoMockProduct, Shell, StartupReadiness, TextScale, BrowserSignins, BrowserFlow, BrowserContinuity, HostedProcessRestart, BrowserDownload) |
| 2 | B-9 backstop, B-10 native, C-3, E-8, E-9, E-16, F-7, F-15, J01-10 | `npm run test:android:instrumentation -- --owned-emulator --avd <avd> --serial emulator-NNNN --classes LocalAgentOfflineApps,NotesTrashBackstop,NotesStorageDurability,DailyApps,ReminderLifecycle,ClockHandoff,ClockRepeatDays,HostedResultNotice,HostedBackgroundWorker,WorkflowApprovalNotice,BrowserReading,BrowserSensitiveReading,BrowserIsolatedReading,BrowserReadingNavigation,PasswordBrowserFill,InboxOperationJournal,MailAttachment,Notifications,CameraScan,FilesTree` (entries added in this audit; first run. LauncherHome moved to campaign 11; HostedResultNotice runs only its builder method here, its notices are campaigns 9 and 13) |
| 3 | C-4 | `npm run test:android:instrumentation -- --owned-emulator --avd <avd> --serial emulator-NNNN --classes RealClock --clock-exclusive` (the image must have a Clock app) |
| 4 | E-4, E-14, A-30 | `npm run test:android:instrumentation -- --owned-emulator --avd <avd> --serial emulator-NNNN --test-mocks --classes BrowserAutofill,BrowserDownload,BrowserFlow,ConnectionChooser` |
| 5 | E-10, E-11 | `ANDROID_SERIAL=emulator-NNNN ALPHA_NATIVE_TEST_AVD=<avd> ALPHA_NATIVE_TEST_ABI=arm64-v8a ALPHA_TEST_HOME_PACKAGE=<stock launcher> node scripts/test-native-restart.mjs signin APP.apk TEST.apk NEW_OUTPUT` (case added in this audit; the page is `https://example.com`, so the emulator needs network) |
| 6 | B-12, F-7, J03-7 | same environment: `node scripts/test-native-restart.mjs notes APP.apk TEST.apk NEW_OUTPUT`, then `inbox`, then `document` |
| 7 | B-15, B-25, J01-6, J01-7 | `ALPHA_CALENDAR_TEST_SERIAL=emulator-NNNN ALPHA_CALENDAR_TEST_AVD=<avd> ALPHA_CALENDAR_TEST_ABI=arm64-v8a node scripts/test-calendar-regression.mjs --case=CalendarCrudInstrumentedTest`, then `--case=CalendarAgentCrudInstrumentedTest` |
| 8 | B-20, B-22, F-15 | `node scripts/test-reminder-one-off.mjs APP.apk TEST.apk NEW_OUTPUT`; `node scripts/test-reminder-recovery.mjs APP.apk TEST.apk NEW_OUTPUT` (reboots the emulator) |
| 9 | B-26, F-17 | `node scripts/test-native-permissions.mjs channels APP.apk TEST.apk NEW_OUTPUT`, then `notice-denied` (round 5) with a new output directory |
| 10 | J05-2 | `npm run test:android:instrumentation -- --owned-emulator --avd <avd> --serial emulator-NNNN --classes BrowserPageQuestion` (round 5; the emulator needs network for the first tab and a WebView provider with isolated-world injection, as the BrowserReading classes do) |
| 11 | A-1 | `npm run test:android:instrumentation -- --owned-emulator --avd <avd> --serial emulator-NNNN --variants launcher --home-role --classes SettingsRoles,LauncherHome` (round 5; changes and restores the emulator's HOME role, primary user only; a failed restoration leaves the packages installed and writes `home-role-recovery.json`) |
| 12 | A-6 | `node scripts/test-native-permissions.mjs voice APP.apk TEST.apk NEW_OUTPUT`, then `voice-revoke` with a new output directory (round 5; same environment as campaign 5; `voice-revoke` records a few seconds from the emulator microphone and discards them) |
| 13 | F-15 (posted notice) | `node scripts/test-native-permissions.mjs notice APP.apk TEST.apk NEW_OUTPUT` (round 5; the posted, redacted and tapped result notice needs POST_NOTIFICATIONS granted first, which the plain runner cannot do) |
| 14 | B-12 | `npm run test:android:instrumentation -- --owned-emulator --avd <avd> --serial emulator-NNNN --classes NotesSecureStorage` (round 5 registry entry) |
| CI-1 | A-23, A-27, C-7, D-15, F-16 | `.github/workflows/resident-android.yml` by `workflow_dispatch` on the candidate commit: job `native` (`scripts/ci/resident-native.py`: PrivateResidentSocket, ResidentStreamTransport, ResidentWorkflowCrash) and job `recovery-ui` (`scripts/ci/pending-recovery-ui.py`, 16 phases including Connection, ClockAgentReview, ReminderTapProcessDeath, WorkflowNoticeProcessDeath). No passing run of either job is recorded. Subject to [CI cost policy](ci-cost-policy.md); not triggered by this audit. |

## HUMAN, DEVICE and UPSTREAM blockers

| Blocker | Steps | What the owner must do |
| --- | --- | --- |
| A-02 managed endpoint and pairing | A-8, A-11, A-25 | Provide a designated Eliza Cloud test account and sign in on a flag-off Android build; decide whether remote pairing remains a route on Android (it is retired today). |
| A-16 Cloud agent onboarding on Android | A-9, A-10 | Choose (a), (b) or (c). Journey A step 2 of the completion plan (select an existing agent, provision a new one) is unreachable on Android until this is decided; (a) would need the plan amended. |
| Inference credential (runbook "Cerebras key provisioning"; A-20) | A-14, B-14, D-19, J05-9 | Issue a pilot Cerebras key or fund the test Cloud account. For the resident campaign, place the key in the owner-only file `~/.config/alphaphone/cerebras-key` on a host with an arm64 emulator, then run `ALPHA_RESIDENT_DISPOSABLE_EMULATOR=1 ANDROID_SERIAL=emulator-NNNN node scripts/android-resident-instrumentation.mjs <app.apk> <androidTest.apk>`. |
| A-04 voice provider and processing location | B-3, B-7 | Confirm Cloud speech as the product route (P-07 already makes it the default) and say whether on-device speech is still required. If it is, B-7 becomes a failing native acceptance to fix. |
| A-09 powered-off scheduling | D-5 | Choose (a) amend the DoD to resident missed-occurrence recovery, or (b) fund hosted loops. Journey D as written in the completion plan cannot pass under (a) without the amendment. |
| A-11 alarm ownership | C-8, C-15 | Choose (a), (b) or (c). Under (a) the image must ship a Clock app and C-4 is the acceptance run. |
| Gmail grant (A-07, A-15; runbook "Gmail OAuth") | D-4, F-1, F-14, J03-2 | An operator with access to the deployed Eliza Cloud Worker must find why the Google code exchange returns 401 (the client secret binding is the documented hypothesis) and fix it; then authorize a designated test Google account, choose the A-15 scope set, and authorize one exact recipient and message for a live send. |
| A-05 background notification policy | F-21 | Choose (a), (b) or (c); new-mail notifications are not implemented until then. |
| A-12 passkeys | E-19 | Choose (a), (b) or (c). |
| A-06 signing | E-20 | Name the signing owner and produce the release key; nothing can be qualified on a release-signed device before that. |
| Password provider account (runbook "Password provider real-site filling") | E-18 | Provide a Proton Pass test vault with synthetic credentials on a signed build. |
| Maps provider (no decision ID exists) | J04-6 | Open a decision item for the production Maps provider and its licence, then supply `VITE_MAPS_BASE_URL` for an HTTPS gateway. Until then J04 ends at an honest unavailable state for every production user. |
| A-01 phone and image | A-2, A-7 and every DEVICE row | Choose the SKU; build and boot the image. |

DEVICE rows (13): A-2, A-7, A-21, A-31, B-2, B-6, C-5, C-9, C-12, D-20, E-17, J01-2,
J04-9, plus the device halves of the runbook rows they belong to. They need the four
pilot units and [the runbook](pilot-acceptance-runbook.md); none has been run.

UPSTREAM: none established. If the emulator runs of B-7 or E-14 fail inside the pinned
runtime or `plugin-native-passwords`, report the exact change then; do not patch
`vendor/eliza`.

## Changes made in this audit

| Change | Files | Test |
| --- | --- | --- |
| Flag-off journey assertions for every loop (11 tests): resident chat, Stop, automatic restore, context and identity; Clock handoff with and without a Clock app, cancelled review, unknown result across restart, time-zone change; phone-bound schedules; mail without a grant; local calendar and alarms; Maps without a provider; digests and mail signed out; browsing, page question and password page; poster to event; document question | `test/browser/journey-core-loops.production.spec.ts` | itself, `--project=production` |
| The instrumentation runner registered `PasswordAutofillOffer`, which is not a class in the app's instrumentation sources; the test-mocks class is `BrowserAutofill` | `scripts/android-instrumentation.mjs`, `docs/verification.md` | `test/android-instrumentation-runner.test.mjs` (every registry entry must exist in the sources and read the gates the runner passes) |
| 21 core-loop classes had no runner entry, so a named run skipped their gated methods | `scripts/android-instrumentation.mjs` | same test |
| `BrowserSigninsInstrumentedTest` documents a `signinPhase` restart run that no runner supplied (the P-04 sign-in persistence evidence) | `scripts/test-native-restart.mjs`, `docs/verification.md` | same test file ("restart runner keeps the bookmark phase wired") |
| A mail receipt for another request was refused with the internal text "Unexpected operation receipt" and had no test | `apps/app/src/runtime/inbox-operation.ts` | `test/browser/journey-f-email-notifications.spec.ts` (new test) |
| Stale lines in the round-3 status: the "development Clock" is the browser build's Clock; the digest wording item was already fixed; automatic restore on Android | `docs/core-loop-status.md` | — |

None of the runner changes has been executed on an emulator.

## Round 5: native-runner gaps

Package `claude/r5-runner-gaps`, on top of this audit branch. It closes the runner-side
SOFTWARE work orders (7, 8, 9, 15): the gaps that stopped existing or needed Android
instrumentation from being runnable at all. It wrote and compiled; it ran no emulator and
built no APK, so every Android row it touched is EMULATOR with the command that now runs it,
never EVIDENCED. The one exception is D-8, a host test that was run here.

| Change | Files | Check |
| --- | --- | --- |
| `voice`, `voice-revoke`, `voice-limit`, `notice` and `notice-denied` permission scenarios. `voice-revoke` starts a real capture, revokes RECORD_AUDIO from outside and requires Android to end that process mid-test, then verifies in a new process and after a re-grant | `scripts/test-native-permissions.mjs`, `VoicePermissionRevokeInstrumentedTest.java` (new), `VoicePermissionDeniedInstrumentedTest.java`, `HostedResultNoticeInstrumentedTest.java` | `test/native-permission-runner.test.mjs` runs the real script against a scripted adb: order of grant, phases and revoke; one run id; no force-stop standing in for the kill; a surviving process, a stale marker, an early exit and a completed test all refused |
| `--home-role` phase: admit one stock HOME holder, run role-requesting classes, select the launcher APK, cold-start it with the HOME key, run HOME classes, restore and read back the original before uninstalling; keep the installation and write a recovery file if that cannot be proven | `scripts/android-instrumentation.mjs`, `scripts/instrumentation-result.mjs`, `LauncherHomeInstrumentedTest.java` (two new methods) | `test/android-instrumentation-runner.test.mjs`: exact command order, unproven restoration, failed selection, failed cold start, a class that leaves HOME changed, admission refusals |
| `BrowserPageQuestionInstrumentedTest`: native page excerpt to reviewed question (J05-2) | new class, registry entry | compiled for both flavors and with test mocks; registry-vs-source test |
| Registry entries for 39 more classes (ConnectionChooser and eight other test-mocks-build classes, twelve gated self-contained classes, seventeen ungated ones, SettingsRoles), three campaign refusals, and HostedResultNotice no longer passes a gate the plain runner cannot satisfy | `scripts/android-instrumentation.mjs` | same test |
| Reachability check: every `@Test` class is in the registry, named by a campaign runner, or listed in `NOT_RUN_BY_A_RUNNER` (25 classes) with its reason; stale allowlist entries fail too | `scripts/android-instrumentation.mjs`, `test/android-instrumentation-runner.test.mjs` | itself |
| Digest restart check: default prepared directory, exit 2 with the exact preparation when the input is missing, host-runtime labels in its result; preparation documented; run | `scripts/test-local-digest-restart.mjs`, `docs/local-agent-development.md`, `test/digest-restart-input.test.mjs` | the run itself (below) |

### Every SOFTWARE row, accounted for

| Row | Where its fix lives | Status after round 5 |
| --- | --- | --- |
| A-6 | permission runner and androidTest | Done: EMULATOR, campaign 12. |
| D-8 | `scripts/test-local-digest-restart.mjs` and docs | Done and run: EVIDENCED as host-runtime evidence. Still in no workflow (CI owner). |
| B-10 | `test/browser/notes-trash.spec.ts` (renderer); the native half, NotesStorageDurability, was registered in round 4 | Not this package (Notes Trash owner). Still SOFTWARE. |
| B-13 | `journey-b-voice-note-actions.spec.ts`, `calendar-adapter.ts` | Not this package. Still SOFTWARE. |
| B-28 | `voice-adapter.ts`, `template.html` (product change) | Not this package. Still SOFTWARE. |
| F-5, F-10, F-12, F-13, F-20 | Inbox renderer and its Playwright specs | Not this package. Still SOFTWARE. |
| J03-8 | `inbox-save-attachment.spec.ts` | Not this package. Still SOFTWARE. |
| J04-7, J04-10 | `maps-adapter.ts`, `template.html` | Not this package. Still SOFTWARE. |

None of the eleven remaining SOFTWARE rows has a fix in `android/app/src/androidTest`,
`android/app/src/testMocks` or the runner scripts (the `test-*` and `android-*` files under `scripts`).

EMULATOR rows whose text named a runner gap, and what happened to it:

| Row | Gap named by the audit | Now |
| --- | --- | --- |
| A-1 | LauncherHome skips; the runner does not select HOME | `--home-role` phase, campaign 11. |
| A-30 | ConnectionChooser has no runner entry | Registered; campaign 4. |
| B-12 | NotesSecureStorage has no runner | Registered with its gate; campaign 14. Its fresh-install migration method still has none. |
| F-17 | No runner supplies `hostedNoticeDenied=1` | `notice-denied`, campaign 9. |
| F-15 | (found here) the registry passed `hostedNotice=1`, but the posted-notice method asserts notifications are enabled, which a plain install never has; it would have failed | `notice`, campaign 13; the plain runner now runs only the builder method. |
| J05-2 | No test exists | Written; campaign 10. Stops at Send. |
| A-16 | AllViewAgentContext has no runner | None added: it needs a real agent with inference on the host. Listed in `NOT_RUN_BY_A_RUNNER`. |
| B-14 | LiveAgent has no runner | None added: real provider key. Listed. |
| A-23 | CombinedAgentRestart never compiled into a run | None added: combined host runtime with a provider key. Listed. |
| MVP-18 | WorkflowLegacyReminderUpgrade lacks runner coverage | None added: it belongs to the installed-upgrade campaign, which does not name it. Listed. |

### What is still not covered

- J05-2 after Send: the agent's answer and the "Review summary note" save. A distribution
  build on an emulator has no agent, the test-mocks emulator transport produces no summary
  card (it has no connection session), and the remaining routes need the real app host or
  resident runtime with a provider key (HUMAN). A synthetic app-host fixture on the host
  machine, checked against the browser build, would close it and was not built.
- `SettingsCrashLog` needs a two-phase crash runner, and `NotesSecureStorage`'s migration
  method a fresh-install campaign. Neither is a core-loop step.
- Twenty-five classes in `NOT_RUN_BY_A_RUNNER` are unreachable from this repository for the
  reasons listed there; most lost their runners when the smoke suites were removed in
  `49b1bf4c` and need a host agent or a provider key.

### Commands run in round 5

| Command | Result |
| --- | --- |
| `ALPHA_RUNTIME_GIT_CACHE=$PWD/vendor/eliza npm run agent:prepare` | exit 0: `artifacts/local-agent-resident-352d7a08…` with dependencies, 5.8 GB (removed afterwards) |
| `ALPHA_ELIZA_SOURCE=$PWD/artifacts/local-agent-resident-352d7a08… npm run agent:test-digest-restart`, then `npm run agent:test-digest-restart` with the default directory | exit 0 both times (D-8; host-runtime evidence, not Android) |
| `node --test test/native-permission-runner.test.mjs test/android-instrumentation-runner.test.mjs test/digest-restart-input.test.mjs test/native-restart-runner.test.mjs test/native-campaign-evidence.test.mjs` | 77 passed |
| `./gradlew :app:compileStandaloneDebugJavaWithJavac :app:compileLauncherDebugJavaWithJavac :app:compileStandaloneDebugAndroidTestJavaWithJavac :app:compileLauncherDebugAndroidTestJavaWithJavac -x :local-speech:preBuild -x :app:stageLocalAgentSources -PELIZA_ALLOW_UNPACKAGED_RUNTIME=1 --offline` with `-PELIZA_DEV_ALLOW_TEST_MOCKS=0`, then `=1` (JDK 21, staged sources, compile-only speech AAR) | BUILD SUCCESSFUL both times. Compilation only: no APK was assembled and nothing ran on an emulator |
| `npm run verify` | exit 0: 515 tests, 511 passed, 0 failed, 4 TODO; bundle audit passed (395 files, testMocks=false), with the standing Denton licence release blocker (A-21) printed |

## Stale ledger statements

For the package that refreshes the ledgers. Each was checked against this branch.

| File | Says | True at this source |
| --- | --- | --- |
| `docs/mvp-current-status.md` line 61 | Home has no all-apps drawer or search and cannot open third-party apps; landscape layout is not implemented | The drawer and search exist (`apps/app/src/prototype/home-launcher.ts`, `home-launcher.spec.ts`, `home-native-launcher.spec.ts`); a landscape layout exists and is tested (`home-landscape.spec.ts`, `RotationInstrumentedTest`). |
| `docs/mvp-current-status.md` lines 18 and 147–149 | "Current verification passes 454 tests", attributed to `d3dc9977` / upstream `945209d3` | That commit is 55 behind this branch and has a different upstream pin (`352d7a08` now). The count cannot describe this source; see "Commands run" for the current result. |
| `docs/mvp-current-status.md` line 82 | APK builds passed "at reviewed pin `945209d3`" | That pin is retired. No APK build is recorded at the current pin. |
| `docs/mvp-current-status.md` line 99 | AP-05 next gate is "S: composer draft survives every pre-dispatch failure" | Line 64 of the same file records it as implemented and tested (`chat-continuity.spec.ts`). |
| `docs/mvp-current-status.md` lines 139–162 | Evidence section | Does not mention the journey specs, `docs/core-loop-status.md`, or `npm run test:android:instrumentation`. |
| `docs/requirements.json` AP-01 | "Home has no all-apps drawer or search" | False; as above. |
| `docs/requirements.json` AP-02, AP-09 | The Android build fails at the pinned calendar plugin | Contradicts current status line 82. Not rebuilt here; one of the two is wrong. |
| `docs/requirements.json` AP-05 | Gate "S: composer draft survives every pre-dispatch failure" | Already met; the same entry lists `chat-continuity.spec.ts`. |
| `docs/requirements.json` AP-10 | "Native camera lacks image import and the multi-page scan builder" | Both are wired for native (`camera-adapter.ts`, `scan-document.ts`). Device behaviour is unverified. |
| `docs/requirements.json` AP-12 | "Quick-setting tiles show no native state and open generic Android Settings" | False: `AlphaDevicePlugin.java`, `settings-truth.production.spec.ts`, `test/shade-tile-facts.test.mjs`. |
| `docs/requirements.json` AP-15 | "No landscape layout" | False; as above. |
| `docs/requirements.json` AP-07 | Evidence lists only `dev-digest-schedule.spec.ts` | The missed-record coverage is also in `journey-d-digests.spec.ts` and `test/digest-occurrence-delivery.test.mjs`. |
| `docs/mvp-remaining-work-2026-10-09.md` line 7 and `.json` `upstream_pin` | Upstream pin `0d40aa6e…` | `upstream.lock.json` records `352d7a0855…`; MVP-08 in the same file says so. |
| same, MVP-07 | Current status "still describes no offline entry, no browser transport and early draft consumption" and cites patch 0039 | Only "no drawer" is still in the status file. |
| same, MVP-09 | Remove each patch when its replacement is consumed | The patch tooling and applied patches were removed in `9475074c`; only the unshipped `0060-password-transfer.patch` reference remains. |
| same, MVP-18 and MVP-20 | Workflow notice and launcher classes lack runner coverage | Still true for `WorkflowLegacyReminderUpgrade`. `WorkflowApprovalNotice` and `LauncherHome` now have registry entries (this audit), with no run. |
| same, MVP-38 | "Implement … resident missed-run recovery" | The explicit missed record is implemented and tested. A-09 itself is still open. |
| same, MVP-45, MVP-46 | Dependency paths, SBOM and ruleset read-back remain to do | `docs/dependency-audit.md`, `scripts/generate-sbom.mjs`, `scripts/ci/read-required-checks.mjs` and their tests exist and are not cited. |
| same, MVP-49 | J01–J05 "have source-level pieces" | Each has an end-to-end browser journey (class S) and a flag-off assertion. |
| same, MVP-50, MVP-51 | No provisioning or update tooling mentioned | `scripts/provision-unit.mjs` and `scripts/pilot-update.mjs` exist; rollback is still not offered. |
| `docs/decisions.md` A-22 | "the layout is portrait-only" | A landscape layout exists. |
| `docs/ci-cost-policy.md`, `README.md` | Emulator CI jobs were removed on October 8 | `.github/workflows/resident-android.yml` still has two emulator jobs (`native`, `recovery-ui`), inert unless dispatched or enabled by a repository variable. |
| `android/.../BrowserSigninsInstrumentedTest.java` comment | The restart phases run through `scripts/test-native-restart.mjs` | True only since this audit. |
| `docs/core-loop-status.md` (round 3) | "development Clock"; digest wording open item | Corrected in this audit. |

## Commands run

| Command | Result |
| --- | --- |
| `npx playwright test test/browser/journey-{a,b,c,d,e,j01,j03,j04,j05}-*.spec.ts --project=chromium --workers=2` | 11 passed |
| `npx playwright test test/browser/journey-f-email-notifications.spec.ts --project=chromium --workers=2` | 5 passed (one test added here) |
| `npx playwright test test/browser/journey-core-loops.production.spec.ts --project=production --workers=2` | 11 passed on a fresh flag-off build; bundle audit passed (395 files, testMocks=false) |
| `node --test test/android-instrumentation-runner.test.mjs` | 8 passed |
| `npm run verify` | exit 0: 497 tests, 493 passed, 0 failed, 4 TODO; bundle audit passed, with the standing Denton licence release blocker (A-21) printed |

Browser runs used `ALPHA_BROWSER_TEST_PORT=6843`. No APK build, emulator run or CI run was made.
