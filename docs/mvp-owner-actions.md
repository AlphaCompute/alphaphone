# Owner actions for the MVP

Everything on this page needs the owner, or a person with an account, a key, a hosted
runner or hardware. Nothing here can be closed by more code in this repository, and
nothing here is already done. It was re-derived from source, tests and the dated sections of
[verification](verification.md) on 2026-10-11, at main `2560eead` (pull request #392, the
round 8 integration; upstream pin `13c9857598`).

Each entry says what it unblocks: loops A–F and J01–J05 with the step numbers of the
[core loop audit](core-loop-audit.md), and items of the
[remaining-work inventory](mvp-remaining-work-2026-10-09.md). Within each group the
entries are ordered by how much they unblock. Options are quoted from
[decisions](decisions.md#pending-owner-decisions); listing an option is not a
recommendation, and until a choice is recorded there the current behaviour stays. Decision
IDs (A-01 to A-26, A-32 to A-35) and audit step numbers of loop A (A-1 to A-31) look alike:
in this page an ID in the first column of group 1 or named "decision" is a decision, and an ID
inside "A (…)" or named "step" is an audit step.

State of evidence today, at the current pin `13c9857598`: source and browser tests,
developer APK builds that carry no resident runtime and are not distributable, and one
partial emulator campaign on such builds (round 8, group 3 below). No distribution APK build,
no run of any `resident-android.yml` or `android-emulator.yml` job, no real-account use and
no device result exists
([current status](mvp-current-status.md#current-qualification-evidence)).

The software this page builds on is merged: pull requests #388 (round 2), #389 (round 5),
#390 (packaging and the first emulator repairs), #391 (round 9, the pin `13c9857598`) and
#392 (round 8) are all on main, and none needs an owner action. No pull request was open when
this page was refreshed. What they leave open is in the groups below.

## The list in short

One line per action; the tables below give options, commands and what each unblocks.

Decisions (group 1), none decided:

- A-01 phone SKU, Android version and distribution; A-06 signing, update and rollback owner.
- Voice policy (MVP-01) with A-24, A-04 and A-10: auto-send, voice route, whether on-device speech is required, latency method.
- A-02, A-16, A-26, A-20: managed endpoint, Cloud agents on Android, admitted hosts, metering.
- A-09 powered-off scheduling. A-07 and A-15 Gmail scopes, with A-35 (attachments in a "Use in email" suggestion).
- A-11 alarm ownership. A-23 production Maps provider. A-22 rotation. A-05 background notification policy.
- A-12, A-14, A-13 passkeys, trusted browsers, third-party cookies. A-25 recovering deleted events and reminders.
- A-34 calendar availability defaults. A-32 and A-33: where Alpha's notices live on the image, and the Home swipe.
- A-19, A-17, A-18 backup and erase, lock-screen camera, Photos scope. Listening scope (MVP-52). A-03 and A-08 stay as they are unless scope changes.

Accounts, keys, inputs and deployments (group 2):

- Fix the Google code exchange (401) on the deployed Eliza Cloud Worker and deploy the managed Gmail routes.
- Provide an Eliza Cloud test account with credits; issue a pilot Cerebras key in the owner-only key file.
- Authorize a test Google account and one exact recipient and message for a single live send.
- Supply the reviewed embedding host libraries for the strict build (the one build input with no build step).
- Speech admission, the human half: a named reviewer runs `requalify-runtime.py admit` after both ABI runs, only if A-24 keeps on-device speech.
- Create the release key and supply the `ELIZAOS_*` signing values; publish `assetlinks.json`.
- Stand up the HTTPS Maps gateway (after A-23). Install the "Main required checks" ruleset.
- Provide a Proton Pass test vault with synthetic credentials. Optional: a reference to the Denton licence document.
- Buy four pilot units and provide a Linux builder with the AOSP source. A private remote host, only if A-02 keeps pairing.

Hosted CI dispatches that have never been made (group 3; each is a person's dispatch, or an agent's only after the owner says so directly):

- `gh workflow run resident-android.yml --ref <branch>`: audit steps A-23, A-27, C-7, D-15 and F-16.
- `gh workflow run android-emulator.yml --ref <branch> -f suite=browser-reading`: audit steps E-8, E-9 and J05-2.
- `gh workflow run android-emulator.yml --ref <branch> -f suite=instrumentation`: audit step E-3, and step A-29 again on a hosted runner.
- `gh workflow run android-emulator.yml --ref <branch> -f suite=local-speech`: the x86_64 half of speech admission (B-7).

Emulator campaigns that still need running on the candidate's strict build (group 3), and the
resident campaign with the provider key. Physical-device steps (group 4) after A-01 and A-06.

## 1. Decisions

| Order | ID | Question | Options | Current behaviour | What is blocked | Loops (steps) | Items |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | A-01 | Which phone SKU, Android version and distribution | (a) Pixel 10. (b) Pixel 11 Pro. (c) Another device with a full device tree and vendor blobs. | The Android/AOSP guide names Cuttlefish for image validation and Pixel 10 as the hardware build target; no exact SKU or device inputs are admitted and no unit exists. | Every physical-device step, the image build and the pilot. | A (A-2, A-7, A-21, A-31), B (B-2, B-6), C (C-5, C-9, C-12), D (D-20), E (E-17), J01 (J01-2), J04 (J04-9) | MVP-03, 41, 42, 47, 50, 51, 52, and the device part of MVP-20 to 33, 48, 49, 53 |
| 2 | A-06 | Who signs releases, and who owns updates, support and rollback | (a) The release owner holds the key in managed or hardware-backed signing. (b) A separate signing service operated for Alpha. | `android/release-signer.json` says `unset`. Every release APK is unsigned, and provisioning, pilot update and AOSP staging refuse it. No update check and no rollback are offered. | Any distributable build, App Links, signed update, qualification on a release-signed device. | E (E-20) | MVP-03, 29, 33, 40, 42, 47, 50 |
| 3 | Voice policy (MVP-01), with A-24, A-04 and A-10 | Does voice auto-send; is Eliza Cloud the voice route; is on-device speech still required; how is latency measured | Send and route: one dated policy that reconciles P-01, P-07 and the PRD's AP-06. A-24: (a) Cloud is the only required route. (b) On-device speech stays required on Android. (c) On-device only as the offline or signed-out fallback. A-10: (a) measure end of speech to first audible response, excluding review and send time. (b) Revisit the six-second target. | Flag-off builds use Eliza Cloud speech unconditionally; signed out there is no voice. An ongoing Cloud conversation sends each spoken turn without the review step P-01 requires. On-device speech failed its acceptance on arm64 and never ran on x86_64, yet a distribution build still requires qualified speech assets. No latency sample exists. | The distribution build (it needs qualified speech or the requirement retired), speech acceptance, latency acceptance, final PRD wording. | B (B-3, B-7) | MVP-01, 05, 07, 23, 24, 39 |
| 4 | A-02, with A-16, A-26 and A-20 | What is the managed endpoint; do Cloud agents exist on Android; which hosts may the phone reach; how is usage metered | A-02: (a) Eliza Cloud. (b) A separately operated Alpha endpoint. (c) Remote pairing only. A-16: (a) resident-first, Cloud agents optional. (b) the Android Welcome dialog connects or creates a Cloud agent. (c) Cloud agents only in the web build. A-26: (a) keep admitting only `https://api.eliza.app`. (b) admit Cloud agent hosts by an approved rule. A-20: (a) meter against the user's Cloud credits. (b) a program key per pilot unit. (c) a user-supplied key. | Android signs in to Eliza Cloud for credits and runs the agent on the phone. It refuses remote pairing and every host but `https://api.eliza.app`. No flag-off build can select or create a Cloud agent, so journey A step 2 of the completion plan is unreachable as written. | Real sign-in acceptance, the completion plan's journey A wording, pilot account provisioning. | A (A-8, A-9, A-10, A-11, A-25) | MVP-04, 17, 34, 37 |
| 5 | A-09 | Powered-off scheduling | (a) Amend the DoD so resident missed-occurrence and restart recovery replaces execution while the phone is off. (b) Deliver hosted loops that run while the phone is off. | A time that passes while the phone is off is recorded once as missed and never run later; the panel says schedules cannot run while the phone is off. Hosted loops do not exist. | Journey D as written cannot pass under (a) without the amendment; (b) needs a service that does not exist. | D (D-5), F (hosted result notices) | MVP-02, 38 |
| 6 | A-07 and A-15, with A-35 | Which Gmail scopes, and whether attachments and labels are in; whether a "Use in email" suggestion may attach selected Files or Photos | A-15: (a) read, read state, archive and send without attachments. (b) add opening and saving attachments and sending chosen files. (c) also label management. A-35: (a) never, attachments only through the composer's picker. (b) a reviewed suggestion may attach selected items. | Against a synthetic provider the app behaves as A-15 (b) and A-35 (a). No real mailbox has been reached and no scope set is approved. | The consent screen the Gmail grant in group 2 will show. | D (D-4), F (F-1, F-14), J03 (J03-2) | MVP-04, 14, 35, 36 |
| 7 | A-11 | Who owns alarms | (a) Keep handing alarms to Android Clock. (b) Alpha owns alarms with exact-alarm scheduling and its own ringing screen. (c) An Alpha clock in the AOSP image. | (a): one reviewed handoff, and Alpha says it cannot confirm an alarm was changed. With no Clock app it says so and claims nothing. | Whether the image must ship a Clock app, and which acceptance run closes loop C. | C (C-8, C-15) | MVP-06, 27 |
| 8 | A-23 | Production Maps provider | (a) Operate the regional OpenStreetMap gateway on an HTTPS endpoint Alpha owns. (b) License a commercial provider. (c) No in-app routes in the MVP. | No flag-off build has a provider. The user reads "Connect a Maps provider to search places and plan routes." and no route is produced. | Any route for a production user. | J04 (J04-6) | MVP-31, 49 |
| 9 | A-22 | Rotation | (a) Ship the responsive landscape layout. (b) Lock both activities to portrait. (c) Allow rotation without a landscape layout. | The app rotates. Home, the composer and the docked conversation have a tested landscape layout (`home-landscape.spec.ts`); the other retained views are covered by a browser landscape sweep on main (`test/browser/accessibility-sweep.spec.ts`: every control stays on screen). Both are Chromium tests. `RotationInstrumentedTest` passed on both flavors in the round 7 emulator run (class E, developer-override APKs at the earlier pin `40dbe96bd1`) and was not repeated at the current pin; no device has run it. | The accessibility acceptance scope and the launcher's landscape behaviour. | none | MVP-06, 48, 53 |
| 10 | A-05 | Background notification and reconnect policy | (a) Check only on resume and app start. (b) Periodic background work. (c) A persistent connection held by a foreground service. | New-mail notifications are not implemented. Hosted results use background delivery work. | New-mail notifications. | F (F-21) | MVP-06 |
| 11 | A-12, A-14, A-13 | Passkeys; which browsers the password manager trusts; third-party cookies | A-12: (a) no passkeys in the MVP. (b) WebAuthn through the system credential provider. (c) the integrated manager becomes a passkey provider. A-14: (a) only the Alpha browser. (b) also recognized browsers. A-13: (a) keep third-party cookies blocked. (b) allow per site. (c) allow in normal tabs only. | Passkeys are not implemented; only the Alpha browser is trusted; third-party cookies are blocked. | The password acceptance scope. | E (E-19) | MVP-06, 29 |
| 12 | A-25 | Recoverability of deleted Calendar events and reminders | (a) Keep deletion irreversible behind one review. (b) Add a short Undo. (c) Add a Trash with a retention period. Reminders: (i) no review, (ii) the same review as events. | (a): one review, then nothing can be restored. | Whether loop B needs a recovery step. | B | MVP-06 |
| 13 | A-34 (the two calendar availability defaults from PR #388) | Are cancelled and declined events busy; are free/busy-level calendars offered | Cancelled and declined: (a) not busy. (b) busy. Free/busy-level calendars: (i) offered. (ii) not offered ([calendar availability](calendar-availability.md)). | (a) and (i), on main as engineering defaults, not an owner choice. The instrumented reader test passed on an emulator in round 8 with synthetic rows (class E, developer APKs). | Acceptance of calendar availability. | B | MVP-12 |
| 14 | A-32 and A-33 | On the AOSP image, where do Alpha's notices and the quick-settings tiles live; does a downward swipe on Alpha Home open Android's shade | A-32: (a) in Alpha's panel on Home, opened from its handle. (b) in Android's shade through a SystemUI change; Alpha's panel is removed. (c) both. A-33: (a) no Home swipe, the top edge only. (b) a Home swipe expands Android's shade (needs `EXPAND_STATUS_BAR`). | A-32 (a) and A-33 (a): Alpha's notifications open only from the "Notifications" handle on Home, and the top-edge swipe is Android's ([gesture zones](gesture-zones.md)). | The SystemUI work of the image, and the notification rows of the pilot runbook. | F (notification delivery and tap) | MVP-33, 41 |
| 15 | A-19, A-17, A-18 | Backup and erase; lock-screen camera; Photos scope | See [decisions](decisions.md#new-decision-items). | No backup and no in-app erase; no lock-screen camera; Photos shows only media Alpha captured. | Nothing in the ten loops. | none | MVP-06 |
| 16 | Listening scope (MVP-52) | Is always-on listening or a hardware key in this release | Confirm the scope and approve the listener ADR that foundation decision 8 requires, or defer it. | Not implemented. A microphone button and an assist Activity exist; neither is always-on listening. | The listener implementation and its image work. | none | MVP-52 |
| 17 | A-03, A-08 | MVP views and default roles; Wallet | Open in the first decisions table. | Phone, SMS, Contacts and Wallet are deferred and disabled. | Nothing unless the scope changes. | none | none |
| 18 | Approval notices after an owner change (round 10) | When a different owner connects while a workflow approval notice is pending, what happens to that notice | (a) Withdraw it and never post it again, also if the first owner reconnects before the approval expires. (b) Withdraw it and post it again when its owner reconnects. (c) Leave it posted; its tap already opens nothing for another owner. | (a), as an engineering default, not an owner choice: the notice leaves the shade and its tap opens nothing; the step itself is untouched and waits in Workflows for its owner. Result notices of another owner are kept, as before. | Acceptance of the approval notice across an account change. | none | MVP-18 |

## 2. Accounts, keys, build inputs and deployments

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
| 10 | Optional: give a reference to the Denton licence document (where it is held, or its register entry), to complete the record made on the owner's statement. Not the document itself. Nothing is blocked without it. | Owner | The `reference` field of the Denton record in `licenses/font-licenses.json` | The licence document, or anything secret | none | MVP-43 |
| 11 | After A-01: buy four pilot units, and provide a Linux builder with the AOSP source for the image build. | Owner | Hardware and build host | Nothing secret | every DEVICE step | MVP-41, 50 |
| 12 | Provide a real private remote host to pair with, only if A-02 keeps remote pairing as a supported route. | Owner | The web build's pairing dialog | The pairing code outside the session it is for | A (A-11) | MVP-17 |
| 13 | Supply the reviewed ARM64 embedding host for the strict build. It is the one build input with no build step: three native libraries, ignored by Git, named with their hashes in `android/embedding-host/qualified-host.json`. Whoever holds them and their qualification receipt stages them with `node scripts/stage-embedding-host.mjs --receipt <QUALIFICATION.json>` (the receipt comes from `scripts/prepare-embedding-host.mjs --build`); Gradle's `:app:verifyEmbeddingHost` refuses every distribution and test-mocks build without them, so `npm run android:build:local` stops at its input check on any other machine. Every APK built so far is therefore a developer build with no resident runtime. This is an engineering input, not a product decision. | The engineer who qualified the libraries, or someone who can rebuild and have them reviewed | `android/app/src/main/jniLibs/arm64-v8a` on the build host | Nothing secret | A (A-14, through the packaged runtime) | MVP-08, 39, 47 |
| 14 | Speech admission, the human half, only if A-24 keeps on-device speech required. After the hosted x86_64 run and the arm64-v8a run of the same candidate (group 3, campaign 18) a named person reviews both results and runs `python3 scripts/local-speech/requalify-runtime.py admit --reviewer "<name>" --candidate DIR/candidate.json`. No job admits, and no candidate at the current pin has been run on either ABI. If A-24 drops the requirement, the distribution build's qualified-speech input is retired instead (software). | A named reviewer | The candidate file from the hosted run's artifact, then `android/local-speech/` in a commit | Nothing secret | B (B-7) | MVP-23, 39 |

## 3. Emulator and CI campaigns

Someone must run these and read the results. None has a result on a distributable build, and
no hosted job (campaigns 2, 18, 19 and 20) has ever been dispatched: `gh run list` shows no run of
`android-emulator.yml` and only skipped runs of `resident-android.yml`. Dispatching them costs
hosted minutes ([CI cost policy](ci-cost-policy.md)); it is the owner's dispatch, or an agent's
only after the owner says so directly.
Three campaigns on developer-override APKs are summarized in [verification](verification.md):
the first ran source `73b973a5` at the earlier pin `352d7a08` with mixed results
([section](verification.md#emulator-results-at-73b973a5-2026-10-10)); the second (round 7)
ran the fixes made after it at source `6dcdde34` and pin `40dbe96bd1`
([section](verification.md#emulator-results-at-6dcdde34-2026-10-10-round-7)), and the
[core loop audit](core-loop-audit.md) names the steps it moved; the third (round 8, at
the current pin) ran the classes and campaigns round 8 changed or added at source `2961bd9e`
([section](verification.md#emulator-results-at-2961bd9e-2026-10-11-round-8-merged-with-round-9)).
All three are written summaries
with no raw result files committed, class E for those APKs only, so a campaign below still
has to be run on the strict packaged build of the candidate before it is ticked off.
Results count only when committed with the commit they ran on.

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

Round 8 (2026-10-11) wrote the missing runner cases and three dispatch-only hosted jobs, and
its integration then ran part of the list once on developer APKs at the current pin. The last
column of the table gives each campaign's last recorded result. Every one of them is class E on
developer APKs (no packaged resident runtime, unqualified speech runtime) on an SDK emulator:
"round 8" is the run at source `2961bd9e` to `9a1ca161`, whose product source is that of main
`2560eead`; "round 7" is the run at `6dcdde34` and the earlier pin `40dbe96bd1`, which is not
evidence for the current source. Open from round 8 for whoever runs the campaigns next:
Accessibility fails on both flavors (campaign 13) and BrowserFlow fails on its live-search
method (campaign 3). The three intermittent failures of round 7 (PasswordBrowserFill, the
`notes` restart, FilesTree) did not recur in 3 or 4 repeats each; the ten repeats the
[core loop audit](core-loop-audit.md) asks for under "Repeat runs for the round 7 failures"
were not made. A hosted run is evidence only for the commit it was dispatched on; its
artifacts expire after three days, so copy what the ledger cites.

| Order | Campaign | Command | Loops (steps) | Items | Last recorded result |
| --- | --- | --- | --- | --- | --- |
| 1 | Core-loop classes | `RUN --classes LocalAgentOfflineApps,NotesTrashBackstop,NotesStorageDurability,DailyApps,ReminderLifecycle,ClockHandoff,ClockRepeatDays,HostedResultNotice,WorkflowApprovalNotice,BrowserReadingNavigation,PasswordBrowserFill,InboxOperationJournal,MailAttachment,Notifications,CameraScan,FilesTree` | B (B-9, B-10 native), C (C-3), E (E-8 navigation class, E-16), F (F-7, F-15 reminder half), J01 (J01-10) | MVP-08, 11, 15, 25, 27, 28, 29, 30, 32, 36 | Round 8: every class passed on both flavors except BrowserReadingNavigation, which fails where the WebView has no isolated-world injection (campaign 19). NotesTrashBackstop passed 9 of 9 after one test case was corrected. |
| 2 | Hosted CI: resident process death and recovery | `gh workflow run resident-android.yml --ref <branch>` (no inputs; one dispatch runs `build`, then `native` and `recovery-ui`; the `build` job alone is limited to 180 minutes; subject to the [CI cost policy](ci-cost-policy.md)). Then `gh run list --workflow resident-android.yml --branch <branch> --limit 1` for the run id, `gh run download RUN_ID -n resident-native-evidence-RUN_ID` and `-n pending-recovery-ui-evidence-RUN_ID`. `native` is A-23; `recovery-ui` is A-27, C-7, D-15 and F-16. Each job writes its `result.json` only when every method passed on both distributions; the methods per step are in the [core loop audit](core-loop-audit.md), "The five CI steps" | A (A-23, A-27), C (C-7), D (D-15), F (F-16) | MVP-08, 21, 27, 32, 33, 37, 38, 47 | Never dispatched. No passing run of either job is recorded at any source. |
| 3 | Default product-surface classes | `RUN` (NoMockProduct, Shell, StartupReadiness, TextScale, BrowserSignins, BrowserFlow, BrowserContinuity; BrowserDownload left the defaults in round 8 because it can only be skipped on a build without test mocks, and it stays in campaign 6). Hosted: campaign 20 | A (A-29), E (E-3) | MVP-08, 20, 22, 28, 32, 38 | Round 8: six of the seven classes passed on both flavors; BrowserFlow failed on its live-search method (it needs `www.google.com/search` from the emulator), so the run exits 1. |
| 4 | Calendar provider read-back | `ALPHA_CALENDAR_TEST_SERIAL=emulator-NNNN ALPHA_CALENDAR_TEST_AVD=<avd> ALPHA_CALENDAR_TEST_ABI=arm64-v8a node scripts/test-calendar-regression.mjs --case=CalendarCrudInstrumentedTest`, then `--case=CalendarAgentCrudInstrumentedTest` (since round 8 this runs the reviewed method and then `directSaveReadsBackAllDayChosenZoneAndRrule` with `calendarOptions=1`, each with its own result folder), `--case=CalendarAvailabilityInstrumentedTest` (round 8) and `--case=CalendarTruncationInstrumentedTest` (failed in round 7; product fix in round 8). The WorkflowPhoneNative half of B-25 and J01-7 is campaign 17 | B (B-15, B-25), J01 (J01-6, J01-7) | MVP-12, 26, 49 | Round 8: CalendarCrud, both CalendarAgentCrud methods, CalendarAvailability (4 tests), CalendarTruncation, CalendarRange and CalendarFlow passed on both flavors. |
| 5 | Process restarts | `node scripts/test-native-restart.mjs notes APP.apk TEST.apk NEW_OUTPUT`, then `inbox`, `document`, `signin` (the last needs network on the emulator) | B (B-12), F (F-7), J03 (J03-7), E (E-10, E-11) | MVP-25, 28, 30, 36 | Round 8: `notes` passed (launcher 3 of 3, standalone 1 of 1), `inbox` passed on both flavors, `document` passed on standalone (launcher not run). `signin`: round 7 only, passed on both. |
| 6 | Test-mocks pair | `RUN --test-mocks --classes BrowserAutofill,BrowserDownload,BrowserFlow,ConnectionChooser,HostedProcessRestart,HostedBackgroundWorker,BrowserReading,BrowserSensitiveReading,BrowserIsolatedReading` (a test-mocks app build, so not evidence for a distribution build; the three reading classes need a WebView with isolated-world injection, which no image on this host has: campaign 19) | E (E-4, E-5, E-8, E-9, E-14), A (A-30), D (D-14), F (F-15 hosted half) | MVP-28, 29, 37 | Not run in round 8 (no test-mocks pair was built). Round 7: BrowserAutofill, BrowserDownload, ConnectionChooser, HostedProcessRestart and HostedBackgroundWorker passed on both flavors, BrowserFlow passed 4 of 5, and the three reading classes failed for want of the WebView. |
| 7 | Reminders | `node scripts/test-reminder-one-off.mjs APP.apk TEST.apk NEW_OUTPUT`; `node scripts/test-reminder-recovery.mjs APP.apk TEST.apk NEW_OUTPUT` (reboots the emulator) | B (B-20, B-22), F (F-15) | MVP-27 | Not run in round 8. Round 7: both passed on both flavors. |
| 8 | Permissions and notices | `node scripts/test-native-permissions.mjs channels APP.apk TEST.apk NEW_OUTPUT`, then `notice-denied`, `notice`, `voice`, `voice-revoke`, `settings`, `camera`, each with a new output directory | B (B-26), F (F-15, F-17), A (A-6) | MVP-30, 33 | Round 8: `channels` passed on both flavors after a test selector was corrected. The other six: round 7 only, all passed on both. |
| 9 | HOME role | `RUN --variants launcher --home-role --classes SettingsRoles,LauncherHome` (changes and restores the emulator's HOME role; if restoration cannot be proven it writes `home-role-recovery.json` and the emulator must not be reused until recovered) | A (A-1) | MVP-20, 33, 53 | Round 8: on the final APKs SettingsRoles and LauncherHome passed 3 of 3; before them SettingsRoles 8 of 8 with the final test and LauncherHome 21 of 22 (one process crash, fixed in `a326b8dd`). The original HOME holder was read back each time. |
| 10 | Real Clock | `RUN --classes RealClock --clock-exclusive` (the image must have a Clock app) | C (C-4) | MVP-27 | Not run in round 8 (API 35 image). Round 7: passed on both flavors on API 35. |
| 11 | Page question | `RUN --classes BrowserPageQuestion` (needs network and a WebView provider with isolated-world injection; no image on this host has one, so use campaign 19) | J05 (J05-2) | MVP-28, 49 | Not run in round 8. Round 7: one of four methods passed; three need the isolated world. |
| 12 | Notes secure storage | `RUN --classes NotesSecureStorage` | B (B-12) | MVP-25 | Not run in round 8. Round 7: passed 1 of 2 on both flavors; the migration method is skipped by its gate. |
| 13 | Settings, accessibility and rotation | `RUN --classes SettingsSystemFacts,SettingsFlow,Accessibility,TextScale,Rotation` | none in the ten loops | MVP-33, 48 | Round 8: SettingsSystemFacts and TextScale passed on both flavors; **Accessibility failed on both** (standalone: at 200% text the last Home row is drawn under the floating composer; launcher: an accessibility click reaches no page control on WebView 133). SettingsFlow and Rotation: round 7 only, passed on both. |
| 14 | Shared media and journal modules at the pin | `RUN --classes PhotoEdit,PhotoFilter,PhotosBatch,PhotosTrash,PhotosMultiShare,Video,ActionJournal` | none in the ten loops | MVP-09, 10, 11 | PhotosTrash and Video passed on both flavors in round 7. PhotoEdit, PhotoFilter, PhotosBatch, PhotosMultiShare and ActionJournal have no run in any of the three campaigns. |
| 15 | Resident runtime with real inference (after group 2 action 3) | `ALPHA_RESIDENT_DISPOSABLE_EMULATOR=1 ANDROID_SERIAL=emulator-NNNN node scripts/android-resident-instrumentation.mjs <app.apk> <androidTest.apk>` on an arm64 emulator with at least 4 GB of memory, using APKs that package the resident runtime | A (A-14) | MVP-21, 34, 44 | Never run. It needs the provider key and APKs that package the resident runtime, which do not exist (group 2, actions 3 and 13). |
| 16 | Digest restart on the host at the pin | `ALPHA_RUNTIME_GIT_CACHE=$PWD/vendor/eliza npm run agent:prepare`, then `npm run agent:test-digest-restart` (about 6 GB of prepared source). Run in round 8 at pin `40dbe96b`: exit 0, once; not run at `13c9857598`, the pin since round 9 ([record](local-agent-development.md#isolated-digest-process-recovery-check)). Host-runtime evidence with a synthetic model, not Android. A later pin needs a new run | D (D-8; last run at `40dbe96b`) | MVP-38 | Host run, not an emulator: exit 0 once at pin `40dbe96b`; not run at the current pin. |
| 17 | Workflows, upgrade and Maps | `node scripts/developer-archive.mjs test-results/<new-archive>` (round 8; copies the verified developer pairs from `artifacts/` with their hashes), then `ANDROID_SERIAL=emulator-NNNN ALPHA_WORKFLOW_TEST_AVD=<avd> ALPHA_WORKFLOW_TEST_ABI=arm64-v8a ALPHA_BUILD_ARCHIVE=test-results/<new-archive> ALPHA_CAMPAIGN_OUTPUT=test-results/<new-output> node scripts/android-workflow-native.mjs` (14 cases; the first failure stops it, and `--variant=` and `--phase=` run the rest); `node scripts/test-installed-upgrade.mjs` from agreed baselines; `node scripts/maps/test-native-recovery.mjs permission` | B (B-25), J01 (J01-7), J04 (J04-5 native) | MVP-18, 31, 32, 42 | Round 8: the workflow campaign passed 14 of 14 after one test cleanup was corrected. The installed-upgrade and Maps recovery runners have no recorded run. |
| 18 | On-device speech, only if A-24 keeps it required | x86_64: `gh workflow run android-emulator.yml --ref <branch> -f suite=local-speech` (round 8; builds a candidate and runs the unchanged `LocalSpeechInstrumentedTest` on a hosted x86_64 emulator). arm64-v8a, with that run's `local-speech-x86_64-…` artifact in `DIR` and networking off on an owned arm64 emulator: `python3 scripts/local-speech/requalify-runtime.py run --serial emulator-NNNN --apk DIR/standalone-debug.apk --test-apk DIR/standalone-androidTest.apk --candidate DIR/candidate.json`. Then a person reviews both and runs `requalify-runtime.py admit --reviewer "<name>" --candidate DIR/candidate.json`; no job admits. Details: `scripts/local-speech/README.md` | B (B-7) | MVP-23, 39 | Never dispatched; no candidate at the current pin has run on either ABI. A candidate at the earlier pin `352d7a08` passed 2 of 2 on an arm64 emulator and was not admitted. |
| 19 | Hosted: reading and page question on WebView 157 | `gh workflow run android-emulator.yml --ref <branch> -f suite=browser-reading` (round 8). Artifact `android-emulator-browser-reading-<sha>-<run>-<attempt>`: `ci-reading/results.json` (BrowserReadingNavigation, BrowserPageQuestion, flag-off pair) and `ci-reading-test-mocks/results.json` (BrowserReading, BrowserSensitiveReading, BrowserIsolatedReading, test-mocks pair). x86_64 developer APKs | E (E-8, E-9), J05 (J05-2) | MVP-28, 49 | Never dispatched. |
| 20 | Hosted: default classes on both distributions | `gh workflow run android-emulator.yml --ref <branch> -f suite=instrumentation` (round 8). Artifact `android-emulator-instrumentation-…`: `ci-default/results.json`. `-f suite=all` runs 18 (x86_64), 19 and 20 after one build | A (A-29), E (E-3) | MVP-08, 20, 22, 28 | Never dispatched. |
| 21 | Classes on main that have never run | `RUN --classes AssistantResidentReuse,LauncherLibrary` (both are in the runner's registry; AssistantResidentReuse uses a synthetic runtime, enrollment and streams, and two LauncherLibrary methods skip on an image with no other launchable app). After group 2 actions 3 and 13, the packaged-runtime repeat of assistant reuse belongs with campaign 15 | none in the ten loops | MVP-16, 53 | Never run on an emulator or a device. |

Campaign 6 and the hosted classes: HostedProcessRestart, HostedBackgroundWorker, BrowserReading,
BrowserSensitiveReading and BrowserIsolatedReading use loopback HTTP fixtures that only a
test-mocks app build admits (any other build answers "HTTPS required" or asks for a speech
route), so the runner refuses them without `--test-mocks` and they are not default classes.
The two hosted classes also assert a disposable secondary user; since round 7 the runner
creates and removes that user itself:
`npm run test:android:instrumentation -- --owned-emulator --avd <avd> --serial emulator-NNNN --test-mocks --classes HostedProcessRestart,HostedBackgroundWorker`.
Round 7 ran that phase on the test-mocks pair of developer-override APKs (both classes
passed on both flavors; [verification](verification.md#emulator-results-at-6dcdde34-2026-10-10-round-7)),
which is where D-14 and the hosted half of F-15 get their class-E result. A test-mocks app
build is not evidence for a distribution build.

## 4. Physical-device steps

All of these need A-01, four units, a distributable signed build (A-06, and the strict build
inputs of group 2) and the [pilot runbook](pilot-acceptance-runbook.md). None has been run. A step that also needs an
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
| All | TalkBack, Switch Access, physical large text, rotation, process death and full storage on every retained view. Context selection on a phone: folder grants and their revocation, MediaStore-backed Photos, the notification listener and the native Camera (no instrumented class drives the folder or notification question, so this is by hand until one is written). Signed update and recovery drill; upgrade from an install that saved mock state. Four complete unit manifests and target-user acceptance. | Execute on every unit; Upgrade from earlier mock state | MVP-13, 42, 47, 48, 50, 51 |
