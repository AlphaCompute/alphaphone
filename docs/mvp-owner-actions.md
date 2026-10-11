# Owner actions for the MVP

Everything on this page needs the owner, or a person with an account, a key, a hosted
runner or hardware. Nothing here can be closed by more code in this repository, and
nothing here is already done. It is written from source, tests and recorded evidence on
2026-10-10 (branch `claude/r6-ledger`, based on `4ec513b1`, upstream pin `40dbe96bd1`).

Each entry says what it unblocks: loops A–F and J01–J05 with the step numbers of the
[core loop audit](core-loop-audit.md), and items of the
[remaining-work inventory](mvp-remaining-work-2026-10-09.md). Within each group the
entries are ordered by how much they unblock. Options are quoted from
[decisions](decisions.md#pending-owner-decisions); listing an option is not a
recommendation, and until a choice is recorded there the current behaviour stays.

State of evidence today: source and browser tests only. No APK build, emulator run, hosted
CI run, real-account use or device result exists at the current pin
([current status](mvp-current-status.md#current-qualification-evidence)).

Two open pull requests hold finished software that is not on main. Reviewing and merging
them is also an owner action, and it comes first because later steps build on them:

| Pull request | Holds | Unblocks |
| --- | --- | --- |
| #389 `claude/r5-loop-software` | The audit's remaining software work orders and the native-runner campaigns used in group 3. This page and the refreshed ledgers are based on it. | Every campaign in group 3 that says "round 5": loops A, B, F, J05 |
| #388 `claude/r2-integration` | Calendar availability, context selection, Use in email, Trash recovery, resident reuse, runner phases, daily overview, the accessibility sweep and the app library. It also rewrites those entries in the inventory. | MVP-12, 13, 14, 15, 16, 18, 19, 48, 53 (their software part); loop D step D-17 in the product profile |

## 1. Decisions

| Order | ID | Question | Options | Current behaviour | What is blocked | Loops (steps) | Items |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | A-01 | Which phone SKU, Android version and distribution | (a) Pixel 10. (b) Pixel 11 Pro. (c) Another device with a full device tree and vendor blobs. | The Android/AOSP guide names Cuttlefish for image validation and Pixel 10 as the hardware build target; no exact SKU or device inputs are admitted and no unit exists. | Every physical-device step, the image build and the pilot. | A (A-2, A-7, A-21, A-31), B (B-2, B-6), C (C-5, C-9, C-12), D (D-20), E (E-17), J01 (J01-2), J04 (J04-9) | MVP-03, 41, 42, 47, 50, 51, 52, and the device part of MVP-20 to 33, 48, 49, 53 |
| 2 | A-06 | Who signs releases, and who owns updates, support and rollback | (a) The release owner holds the key in managed or hardware-backed signing. (b) A separate signing service operated for Alpha. | `android/release-signer.json` says `unset`. Every release APK is unsigned, and provisioning, pilot update and AOSP staging refuse it. No update check and no rollback are offered. | Any distributable build, App Links, signed update, qualification on a release-signed device. | E (E-20) | MVP-03, 29, 33, 40, 42, 47, 50 |
| 3 | Voice policy (MVP-01), with A-24, A-04 and A-10 | Does voice auto-send; is Eliza Cloud the voice route; is on-device speech still required; how is latency measured | Send and route: one dated policy that reconciles P-01, P-07 and the PRD's AP-06. A-24: (a) Cloud is the only required route. (b) On-device speech stays required on Android. (c) On-device only as the offline or signed-out fallback. A-10: (a) measure end of speech to first audible response, excluding review and send time. (b) Revisit the six-second target. | Flag-off builds use Eliza Cloud speech unconditionally; signed out there is no voice. An ongoing Cloud conversation sends each spoken turn without the review step P-01 requires. On-device speech failed its acceptance on arm64 and never ran on x86_64, yet a distribution build still requires qualified speech assets. No latency sample exists. | The distribution build (it needs qualified speech or the requirement retired), speech acceptance, latency acceptance, final PRD wording. | B (B-3, B-7) | MVP-01, 05, 07, 23, 24, 39 |
| 4 | A-02, with A-16, A-26 and A-20 | What is the managed endpoint; do Cloud agents exist on Android; which hosts may the phone reach; how is usage metered | A-02: (a) Eliza Cloud. (b) A separately operated Alpha endpoint. (c) Remote pairing only. A-16: (a) resident-first, Cloud agents optional. (b) the Android Welcome dialog connects or creates a Cloud agent. (c) Cloud agents only in the web build. A-26: (a) keep admitting only `https://api.eliza.app`. (b) admit Cloud agent hosts by an approved rule. A-20: (a) meter against the user's Cloud credits. (b) a program key per pilot unit. (c) a user-supplied key. | Android signs in to Eliza Cloud for credits and runs the agent on the phone. It refuses remote pairing and every host but `https://api.eliza.app`. No flag-off build can select or create a Cloud agent, so journey A step 2 of the completion plan is unreachable as written. | Real sign-in acceptance, the completion plan's journey A wording, pilot account provisioning. | A (A-8, A-9, A-10, A-11, A-25) | MVP-04, 17, 34, 37 |
| 5 | A-09 | Powered-off scheduling | (a) Amend the DoD so resident missed-occurrence and restart recovery replaces execution while the phone is off. (b) Deliver hosted loops that run while the phone is off. | A time that passes while the phone is off is recorded once as missed and never run later; the panel says schedules cannot run while the phone is off. Hosted loops do not exist. | Journey D as written cannot pass under (a) without the amendment; (b) needs a service that does not exist. | D (D-5), F (hosted result notices) | MVP-02, 38 |
| 6 | A-07 and A-15 | Which Gmail scopes, and whether attachments and labels are in | A-15: (a) read, read state, archive and send without attachments. (b) add opening and saving attachments and sending chosen files. (c) also label management. | Against a synthetic provider the app behaves as (b). No real mailbox has been reached and no scope set is approved. | The consent screen the Gmail grant in group 2 will show. | D (D-4), F (F-1, F-14), J03 (J03-2) | MVP-04, 14, 35, 36 |
| 7 | A-11 | Who owns alarms | (a) Keep handing alarms to Android Clock. (b) Alpha owns alarms with exact-alarm scheduling and its own ringing screen. (c) An Alpha clock in the AOSP image. | (a): one reviewed handoff, and Alpha says it cannot confirm an alarm was changed. With no Clock app it says so and claims nothing. | Whether the image must ship a Clock app, and which acceptance run closes loop C. | C (C-8, C-15) | MVP-06, 27 |
| 8 | A-23 | Production Maps provider | (a) Operate the regional OpenStreetMap gateway on an HTTPS endpoint Alpha owns. (b) License a commercial provider. (c) No in-app routes in the MVP. | No flag-off build has a provider. The user reads "Connect a Maps provider to search places and plan routes." and no route is produced. | Any route for a production user. | J04 (J04-6) | MVP-31, 49 |
| 9 | A-21 | Denton typeface licence | (a) Obtain an app and web embedding licence. (b) Replace Denton with Fraunces. | Denton ships unlicensed and is a named release blocker: the release gates refuse a release while it stands. Fraunces is not yet a complete fallback (see [dependency audit](dependency-audit.md)). | Any distributable release. | none | MVP-43, 47 |
| 10 | A-22 | Rotation | (a) Ship the responsive landscape layout. (b) Lock both activities to portrait. (c) Allow rotation without a landscape layout. | The app rotates. Home, the composer and the docked conversation have a tested landscape layout; the other views have none on main. | The accessibility acceptance scope and the launcher's landscape behaviour. | none | MVP-06, 48, 53 |
| 11 | A-05 | Background notification and reconnect policy | (a) Check only on resume and app start. (b) Periodic background work. (c) A persistent connection held by a foreground service. | New-mail notifications are not implemented. Hosted results use background delivery work. | New-mail notifications. | F (F-21) | MVP-06 |
| 12 | A-12, A-14, A-13 | Passkeys; which browsers the password manager trusts; third-party cookies | A-12: (a) no passkeys in the MVP. (b) WebAuthn through the system credential provider. (c) the integrated manager becomes a passkey provider. A-14: (a) only the Alpha browser. (b) also recognized browsers. A-13: (a) keep third-party cookies blocked. (b) allow per site. (c) allow in normal tabs only. | Passkeys are not implemented; only the Alpha browser is trusted; third-party cookies are blocked. | The password acceptance scope. | E (E-19) | MVP-06, 29 |
| 13 | A-25 | Recoverability of deleted Calendar events and reminders | (a) Keep deletion irreversible behind one review. (b) Add a short Undo. (c) Add a Trash with a retention period. Reminders: (i) no review, (ii) the same review as events. | (a): one review, then nothing can be restored. | Whether loop B needs a recovery step. | B | MVP-06 |
| 14 | Two calendar busy defaults (PR #388) | Are cancelled and declined events busy; are free/busy-level calendars offered | Confirm or change the engineering defaults in that pull request. | On that pull request: cancelled and declined events are not busy; free/busy-level calendars are offered. Not on main. | Acceptance of calendar availability. | B | MVP-12 |
| 15 | A-19, A-17, A-18 | Backup and erase; lock-screen camera; Photos scope | See [decisions](decisions.md#new-decision-items). | No backup and no in-app erase; no lock-screen camera; Photos shows only media Alpha captured. | Nothing in the ten loops. | none | MVP-06 |
| 16 | Listening scope (MVP-52) | Is always-on listening or a hardware key in this release | Confirm the scope and approve the listener ADR that foundation decision 8 requires, or defer it. | Not implemented. A microphone button and an assist Activity exist; neither is always-on listening. | The listener implementation and its image work. | none | MVP-52 |
| 17 | A-03, A-08 | MVP views and default roles; Wallet | Open in the first decisions table. | Phone, SMS, Contacts and Wallet are deferred and disabled. | Nothing unless the scope changes. | none | none |

## 2. Accounts, keys and deployments

Never paste a secret into chat, an issue, a pull request, a commit or a test report. That
covers the Google client secret, any Eliza Cloud or Cerebras key, keystore files and their
passwords, account passwords and vault contents. Evidence records account scope and
outcomes, never credentials.

| Order | Action | Who | Where it is entered | Must never be pasted or committed | Loops (steps) | Items |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Find why the Google code exchange returns 401 and fix it. The documented hypothesis is the client secret binding ([Cloud findings](cloud-production-validation.md)). Then deploy the managed Gmail routes, including read state. | An operator with access to the deployed Eliza Cloud Worker | The Worker's secret configuration and the Google Cloud console. Nothing in this repository. | The Google client secret | D (D-4), F (F-1, F-14), J03 (J03-2) | MVP-14, 19, 35, 36, 38, 49 |
| 2 | Provide a designated Eliza Cloud test account with credits and sign in with it on a flag-off Android build. | Owner | The Welcome dialog on the phone or emulator. | The account password and any API key shown by Cloud | A (A-8, A-25), B (B-3) | MVP-34, 37 |
| 3 | Issue a pilot Cerebras key for the resident instrumentation and for pilot units (subject to A-20). | Owner | An owner-only file on the host that runs the emulator: `~/.config/alphaphone/cerebras-key`. On pilot units, through the provisioning procedure once A-20 is decided. | The key | A (A-14), B (B-14), D (D-19), J05 (J05-9) | MVP-21, 32, 34, 38, 44 |
| 4 | After action 1: authorize a designated test Google account under the A-15 scope set, then authorize one exact recipient and one exact message for a single live send. | Owner | Google's consent screen, reached from "Connect Gmail" in the app. The recipient and message are stated in writing before the send. | The Google account password | F (F-1, F-14), J03 (J03-2), D (D-4) | MVP-35, 36 |
| 5 | After A-06: create the release key, then supply `ELIZAOS_KEYSTORE_PATH`, `ELIZAOS_KEYSTORE_PASSWORD`, `ELIZAOS_KEY_ALIAS`, `ELIZAOS_KEY_PASSWORD`, `ELIZAOS_VERSION_CODE` and `ELIZAOS_VERSION_NAME` to the build. Record only the certificate's SHA-256 digest in `android/release-signer.json`. | Release owner | The signing service or CI secret store. The digest is public and is committed. | The keystore file and both passwords | E (E-20) | MVP-40, 42, 47, 50 |
| 6 | After action 5: publish `assetlinks.json` with the release signer fingerprint on a domain Alpha owns (template: `android/app/src/main/assetlinks.template.json`). | Release owner | The web host of that domain | Nothing secret; do not publish a debug fingerprint | none | MVP-40 |
| 7 | After A-23: stand up the HTTPS Maps gateway and give its address to the build as `VITE_MAPS_BASE_URL`. Have the data licence and attribution reviewed. | Owner or operator | Build environment | Any provider API key (it belongs on the gateway, not in the app) | J04 (J04-6) | MVP-31, 49 |
| 8 | Install the "Main required checks" ruleset: `gh api --method POST repos/AlphaCompute/alphaphone/rulesets --input scripts/ci/required-checks-ruleset.json`, confirm with `node scripts/ci/read-required-checks.mjs --repo AlphaCompute/alphaphone`, then open one controlled pull request showing that a missing or failing check blocks the merge. Read back on 2026-10-10: not installed. | Repository owner | GitHub repository settings | A personal access token | none | MVP-46 |
| 9 | Provide a Proton Pass test vault holding only synthetic credentials, on a signed build. | Owner | The Proton Pass app on the test device | Real credentials of any kind | E (E-18) | MVP-29 |
| 10 | If A-21 is (a): buy the Denton app and web embedding licence and file the proof. | Owner | Licence record referenced from `licenses/` | Nothing secret | none | MVP-43 |
| 11 | After A-01: buy four pilot units, and provide a Linux builder with the AOSP source for the image build. | Owner | Hardware and build host | Nothing secret | every DEVICE step | MVP-41, 50 |
| 12 | Provide a real private remote host to pair with, only if A-02 keeps remote pairing as a supported route. | Owner | The web build's pairing dialog | The pairing code outside the session it is for | A (A-11) | MVP-17 |

## 3. Emulator and CI campaigns

Someone must run these and read the results. None has a result at the current source. A
campaign is in progress on branch `claude/r3-packaging`; at `73b973a5` that branch has
committed test and runner repairs and no result record, so nothing below can be ticked
off from it yet. Results count only when committed with the commit they ran on.

Preparation, once per source revision (JDK 21, Android SDK, an owned disposable emulator;
this host runs arm64 images only):

1. Build the APKs from the exact commit. Developer APKs are enough for instrumentation:
   `npm run android:build -- --allow-unpackaged-runtime`, and
   `npm run android:build -- --test-mocks` for the test-mocks pair. The distributable chain
   is `npm run android:build:local` (speech AAR first, see the README; it also needs the
   reviewed embedding host libraries staged with
   `node scripts/stage-embedding-host.mjs --receipt <QUALIFICATION.json>`).
2. In the commands below, `APP.apk` and `TEST.apk` are a matching pair from that build, for
   example `artifacts/standalone-debug.apk` with
   `artifacts/instrumentation/standalone-androidTest.apk`; `NEW_OUTPUT` is a new directory.
   The campaign scripts need `ANDROID_SERIAL=emulator-NNNN`, `ALPHA_NATIVE_TEST_AVD=<avd>`,
   `ALPHA_NATIVE_TEST_ABI=arm64-v8a` and `ALPHA_TEST_HOME_PACKAGE=<stock launcher>`.
3. Review each `results.json` or `result.json`: every class must be `passed`, none
   `skipped` or `missing`, bound to the commit and the installed APK hashes. A class listing
   or an `OK` line is not a result. Commit the outcome, with failures, to
   [verification](verification.md) under a dated heading that names the commit.

`RUN` below stands for
`npm run test:android:instrumentation -- --owned-emulator --avd <avd> --serial emulator-NNNN`.

| Order | Campaign | Command | Loops (steps) | Items |
| --- | --- | --- | --- | --- |
| 1 | Core-loop classes | `RUN --classes LocalAgentOfflineApps,NotesTrashBackstop,NotesStorageDurability,DailyApps,ReminderLifecycle,ClockHandoff,ClockRepeatDays,HostedResultNotice,HostedBackgroundWorker,WorkflowApprovalNotice,BrowserReading,BrowserSensitiveReading,BrowserIsolatedReading,BrowserReadingNavigation,PasswordBrowserFill,InboxOperationJournal,MailAttachment,Notifications,CameraScan,FilesTree` | B (B-9, B-10 native), C (C-3), E (E-8, E-9, E-16), F (F-7, F-15), J01 (J01-10) | MVP-11, 15, 25, 27, 28, 29, 30, 32, 36 |
| 2 | Hosted CI: resident process death and recovery | `gh workflow run resident-android.yml --ref <candidate>` (jobs `native` and `recovery-ui`; subject to the [CI cost policy](ci-cost-policy.md)) | A (A-23, A-27), C (C-7), D (D-15), F (F-16) | MVP-21, 27, 32, 33, 37, 38, 47 |
| 3 | Default product-surface classes | `RUN` (NoMockProduct, Shell, StartupReadiness, TextScale, BrowserSignins, BrowserFlow, BrowserContinuity, HostedProcessRestart, BrowserDownload) | A (A-29), D (D-14), E (E-3, E-5) | MVP-08, 20, 22, 28, 32, 38 |
| 4 | Calendar provider read-back | `ALPHA_CALENDAR_TEST_SERIAL=emulator-NNNN ALPHA_CALENDAR_TEST_AVD=<avd> ALPHA_CALENDAR_TEST_ABI=arm64-v8a node scripts/test-calendar-regression.mjs --case=CalendarCrudInstrumentedTest`, then `--case=CalendarAgentCrudInstrumentedTest` | B (B-15, B-25), J01 (J01-6, J01-7) | MVP-26, 49 |
| 5 | Process restarts | `node scripts/test-native-restart.mjs notes APP.apk TEST.apk NEW_OUTPUT`, then `inbox`, `document`, `signin` (the last needs network on the emulator) | B (B-12), F (F-7), J03 (J03-7), E (E-10, E-11) | MVP-25, 28, 30, 36 |
| 6 | Test-mocks pair | `RUN --test-mocks --classes BrowserAutofill,BrowserDownload,BrowserFlow,ConnectionChooser` | E (E-4, E-14), A (A-30) | MVP-28, 29, 37 |
| 7 | Reminders | `node scripts/test-reminder-one-off.mjs APP.apk TEST.apk NEW_OUTPUT`; `node scripts/test-reminder-recovery.mjs APP.apk TEST.apk NEW_OUTPUT` (reboots the emulator) | B (B-20, B-22), F (F-15) | MVP-27 |
| 8 | Permissions and notices | `node scripts/test-native-permissions.mjs channels APP.apk TEST.apk NEW_OUTPUT`, then `notice-denied`, `notice`, `voice`, `voice-revoke`, `settings`, `camera`, each with a new output directory | B (B-26), F (F-15, F-17), A (A-6) | MVP-30, 33 |
| 9 | HOME role | `RUN --variants launcher --home-role --classes SettingsRoles,LauncherHome` (changes and restores the emulator's HOME role; if restoration cannot be proven it writes `home-role-recovery.json` and the emulator must not be reused until recovered) | A (A-1) | MVP-20, 33, 53 |
| 10 | Real Clock | `RUN --classes RealClock --clock-exclusive` (the image must have a Clock app) | C (C-4) | MVP-27 |
| 11 | Page question | `RUN --classes BrowserPageQuestion` (needs network and a WebView provider with isolated-world injection) | J05 (J05-2) | MVP-28, 49 |
| 12 | Notes secure storage | `RUN --classes NotesSecureStorage` | B (B-12) | MVP-25 |
| 13 | Settings, accessibility and rotation | `RUN --classes SettingsSystemFacts,SettingsFlow,Accessibility,TextScale,Rotation` | none in the ten loops | MVP-33, 48 |
| 14 | Shared media and journal modules at the pin | `RUN --classes PhotoEdit,PhotoFilter,PhotosBatch,PhotosTrash,PhotosMultiShare,Video,ActionJournal` | none in the ten loops | MVP-09, 10, 11 |
| 15 | Resident runtime with real inference (after group 2 action 3) | `ALPHA_RESIDENT_DISPOSABLE_EMULATOR=1 ANDROID_SERIAL=emulator-NNNN node scripts/android-resident-instrumentation.mjs <app.apk> <androidTest.apk>` on an arm64 emulator with at least 4 GB of memory, using APKs that package the resident runtime | A (A-14) | MVP-21, 34, 44 |
| 16 | Digest restart on the host at the current pin | `ALPHA_RUNTIME_GIT_CACHE=$PWD/vendor/eliza npm run agent:prepare`, then `npm run agent:test-digest-restart` (about 6 GB of prepared source; it passed once at the earlier pin `352d7a08`) | D (D-8 at the current pin) | MVP-38 |
| 17 | Workflows, upgrade and Maps | `node scripts/android-workflow-native.mjs` (environment in the [verification guide](verification.md)); `node scripts/test-installed-upgrade.mjs` from agreed baselines; `node scripts/maps/test-native-recovery.mjs permission` | J04 (J04-5 native) | MVP-18, 31, 32, 42 |
| 18 | On-device speech, only if A-24 keeps it required | `LocalSpeechInstrumentedTest` on arm64-v8a and on an x86_64 emulator or device through the requalification tooling in `scripts/local-speech/README.md`. No workflow runs it, and this host cannot run x86_64. | B (B-7) | MVP-23, 39 |

Known obstacle for campaigns 1 and 3: branch `claude/r3-packaging` records (commit
`0c6c68b0`) that HostedProcessRestart and HostedBackgroundWorker assert a disposable
secondary user the plain runner never creates, and refuses them there. That change is not
on this base, so on this source those two classes are expected to fail, and D-14 and the
background half of F-15 have no working runner until it lands.

## 4. Physical-device steps

All of these need A-01, four units, a distributable signed build (A-06) and the
[pilot runbook](pilot-acceptance-runbook.md). None has been run. A step that also needs an
account or key from group 2 says so.

| Loop | Steps on a phone | Runbook rows | Items |
| --- | --- | --- | --- |
| A | Cold boot of the phone image into Alpha HOME (A-2). Stock recovery and emergency routes stay reachable (A-7). A physical network switch during a request still yields one result (A-21). Lock and unlock, reboot and explicit runtime stop (A-31). With the Cloud test account: real sign-in, expiry and revocation (A-8, A-25). | Boot and design; Resident startup and chat; Lifecycle and recovery; Distribution has no mock surfaces | MVP-20, 21, 22, 34, 50 |
| B (J02) | A physically spoken note through the phone microphone (B-2). Audible read-aloud on the speaker (B-6). Real Cloud transcription with the signed-in account (B-3). Latency samples by the A-10 method. | Speech and Notes; Calendar; Reminders | MVP-05, 24, 25, 26, 27 |
| C | Audible ringing, vibration and Do Not Disturb (C-5). The alarm persists across a reboot (C-9). Late delivery and DST behaviour of a set alarm (C-12). Under A-11 (a) these observe Android Clock, not Alpha. | Clock | MVP-27 |
| D | Delivery under battery saver, Doze and lock (D-20). With the Gmail grant and inference credential: morning and evening digests from real sources with real model output (D-4, D-19). Powered-off behaviour by the A-09 choice (D-5). | Workflows and results | MVP-32, 38 |
| E | Multi-tab transitions, process death and a provider or browser update (E-17). With the release signer and a Proton Pass test vault: save and fill on a release-signed device (E-18, E-20). | Browser and passwords | MVP-28, 29 |
| F | No step needs only the phone. With the Gmail grant: scopes and account selection, one authorized live send, a real attachment (F-1, F-14, J03-2). Notification delivery and tap on a locked phone belong to the runbook row. | Email; Settings and notifications | MVP-33, 35, 36 |
| J01 | A physical camera capture of a printed poster (J01-2), saved to a real device calendar. | Files, capture, photos and Maps; Calendar | MVP-30, 49 |
| J03 | No step needs only the phone. With the Gmail grant: a real mailbox attachment saved, previewed and questioned (J03-2). | Email; Files, capture, photos and Maps | MVP-30, 49 |
| J04 | GPS navigation and turn-by-turn (J04-9), after a Maps provider exists (A-23). | Files, capture, photos and Maps | MVP-31, 49 |
| J05 | No step needs only the phone. With the inference credential: a real agent answers from the reviewed excerpt and the note is saved (J05-9). | Browser and passwords | MVP-49 |
| All | TalkBack, Switch Access, physical large text, rotation, process death and full storage on every retained view. Signed update and recovery drill; upgrade from an install that saved mock state. Four complete unit manifests and target-user acceptance. | Execute on every unit; Upgrade from earlier mock state | MVP-42, 47, 48, 50, 51 |
