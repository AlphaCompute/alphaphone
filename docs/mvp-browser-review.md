# MVP implementation and design review — October 1, 2026

## Scope and evidence

This review follows the user's instruction to review the entire MVP and design, synchronize local code, complete development in the browser, and skip Android builds. The current MVP scope report governs feature inclusion; the prototype governs visual intent. Native builds, emulator HOME behavior, AOSP boots, live integrations, physical hardware and user acceptance remain distinct evidence classes.

The baseline checkout contained 979 changed/new files, including the renderer, native bridges, design assets, runtime patches and historical verification records. These were preserved in commit `611704f`. Generated artifacts, dependency directories, credentials and local Android Studio state are excluded. The configured origin is now `https://github.com/AlphaCompute/alphaphone.git`; remote confirmation is recorded in the final delivery record below. The pinned upstream checkout and pristine app baseline are unchanged.

Initial `npm run verify` passed (TypeScript, seven repository tests, production web bundle). Historical Build122 and canonical35 results are described in `current-acceptance-ledger.md`; those results have not been repeated by this browser review. Older PRD sections describe the original foundation and are not a current feature inventory.

## Complete surface inventory

| Surface | Current implementation | Browser review / remaining work |
| --- | --- | --- |
| Startup/home | Brand, clock, ten enabled app routes, context-aware assistant dock, agenda/workflow cards | Fix desktop scaling and mock-banner overlap; remove false reminder refresh failures when native provider is absent. Native boot, lock, HOME and system status remain device work. |
| Connection/account | Cloud enrollment/agent selection, owner-bound remote pairing, explicit local development, offline and mock modes; secure native credentials | Browser has no Android credential vault. Test controller/HTTP contracts with disclosed fixtures. Real Cloud callbacks, provisioning, Gmail grants, revocation and enclave admission require actual service configuration and provider acceptance. Never store production tokens in browser localStorage to bypass the vault. |
| Assistant | Pill/input/sheet/full layouts; retained view context, history, cancellation, reviewed device actions and receipts | Audit keyboard/focus/viewport continuity and disconnected errors. Existing local Cerebras history/receipt evidence does not prove current Cloud deployment. |
| Voice | Explicit local versus selected-agent/cloud route, recording review, transcription and playback, cancellation | Browser cannot qualify packaged Android speech. Six-second target, microphone/speaker/Bluetooth, semantic transcription accuracy and background interruption remain open. Earlier speech errors remain recorded. |
| Inbox | Cloud Gmail adapter, drafts, attachment handling and encrypted operation journal | Disconnected view is honest; live provider authorization and delivery remain open. Browser fixtures exercise drafts and account isolation without sending mail. |
| Calendar | CalendarProvider range fetch, selected source/revision, timed event create/edit/delete, external editor handoff, DST checks | Browser shows native capability boundary. Native recurrence/attendee edits retain system handoff. Provider sync, process recovery and actual cross-account behavior need native/service evidence. |
| Reminders/tasks | Durable native scheduling, Done/Snooze, recurrence, receipts and recovery | Do not claim background ringing from a browser timer. Confirm source CRUD/selection contracts; actual reboot/Doze/OEM delivery remains separate. |
| Clock/alarms | Reviewed native Clock set/show/snooze/dismiss handoff | Historical alarm tests are scoped evidence. Sound, vibration, DND, reboot/time-zone and physical audibility remain gates. |
| Browser | Alpha chrome, isolated Android page surface, tabs/history/bookmarks, file handoffs, reviewed page reading | Browser development can test chrome and adapter contracts, not the isolated Android renderer. Real vault/passkey/autofill qualification and maintained production WebView stability remain open. |
| Camera | Native photo/video capture and media permission paths | Browser currently reports unavailable; do not show camera fixtures as live input. Scan/OCR and broader content understanding are not completed. |
| Photos | Owned media list, albums, favorite/trash/restore, share, edit-as-copy/filter flows | Native tests retain exact-byte evidence. External libraries, interrupted writes, larger collections and physical capture remain open; advanced editing is outside core MVP priority. |
| Maps | Regional provider, selected place/route context, location handling and saved places | Honest disconnected state. Production TLS/provider configuration, broader regions and physical navigation remain open; no global navigation claim. |
| Notes | Browser-local text store; encrypted native store, revision-bound actions, audio/documents and restart recovery | Add actual browser text import/download; verify create/edit/search/delete/reload and draft preservation. Fix empty collection incorrectly saying “No matches.” No synced Notes service is claimed. |
| Files | Native selected-document/folder access, persistence, previews/PDF and reviewed content boundaries | Browser has no Android SAF. Test selection/context contracts; provider differences and interrupted writes remain native gates. |
| Workflows/digests | Typed authoring, approval, cancellation, durable receipts/results, schedules and reconnect acknowledgements; canonical patch series | Test editor/HTTP contracts and error states. Prior real scheduler/Cerebras localhost campaign is not remote powered-off-phone acceptance. Two remotely hosted loops, deployed source access and reconnect delivery remain open. |
| Settings | Accounts, voice/agent choice, privacy, display, native permissions/notifications, device facts and digests | Audit all settings pages and actual readback; unsupported browser controls must be honest. Enclave status must remain unverified absent admission evidence. |
| Phone/SMS/Contacts | Source retained; navigation and actions disabled by current MVP profile | Explicitly deferred. No telecom/role acceptance claimed. |
| Wallet/payments | Reference source retained; entry/action paths disabled | Explicitly deferred. No credentials, payment processing, attestation or success simulation in production. |

## Design review

The product retains its own electric-blue accent, light/dark tokens, Denton/Fraunces display typography, Public Sans text, lowercase mark, phone geometry and line icons. All ten enabled surfaces are reviewed independently of their native services. The reference includes 60 app fixture states plus home, boot, lock, shade, sheet, full, voice and heads-up states. Deferred reference routes are retained as design evidence and are not reopened in the shipping profile.

Confirmed browser defects before repair:

1. At 1440 × 915, width-only scaling enlarged the 412px phone to 1440px and collapsed its effective height, hiding app navigation behind the assistant dock. Desktop preview must fit the viewport while mobile retains phone-width behavior.
2. The mock banner overlaid the top of the phone. Reserve its actual height while keeping simulation disclosure visible.
3. Startup attempted unsupported native reminder/calendar refreshes and reported a misleading stale-data failure. An absent browser capability needs an accurate unavailable state, not a failure of records that were never loaded.
4. A new, empty Notes collection displayed search-specific “No matches.” Distinguish empty collection from an unsuccessful search.
5. Notes import/export advertised native operations that could not run in a browser. Add real user-selected local UTF-8 import and download, retaining exact source bytes and honest download-request wording.

## Implementation sequence and acceptance ledger

| Item | Status | Evidence / next action |
| --- | --- | --- |
| Preserve and commit all intended existing source/assets | Implemented | Baseline commit `611704f`; all seventeen object-transfer batches uploaded successfully. |
| Desktop and mock viewport repairs | Verified locally | `main.tsx`, `prototype/phone.css`; mobile/desktop bounding checks and screenshots. |
| Browser capability messaging | Verified locally | Reminder/Calendar absent-plugin guards; existing native fixture paths remain supported. |
| Notes empty/search state | Verified locally | Explicit model/template empty text. |
| Browser Notes import/export | Verified locally | Real file picker, bounded UTF-8 decoding, object-URL download, exact-byte browser test. |
| Reproducible browser suite | Verified locally | Pinned Playwright dependency; `npm run test:browser`; tests and screenshots under `test-results`. |
| Entire enabled nested design-state review | Verified locally | 102 light/dark app and shell fixture states, plus 60 production route/theme/width combinations; light/dark contact sheets visually inspected. Deferred reference features remain disabled. |
| Broader controller/adapter suites | Verified locally | Fourteen adapter contracts added to the seven existing checks; five rendered adapter campaigns added to the browser suite. |
| Current-source final verification and remote readback | Local verification passed; delivery record below | Frozen source `cf9a7e4f…` is unchanged across `npm run verify` and all 40 browser tests. |
| Cloud/enclave/provider integration | Unaccepted | Needs deployed configuration, actual account authorization and service evidence. |
| Speech/native/device/AOSP/user acceptance | Outside this browser execution pass | Keep open in current acceptance ledger; Android builds explicitly skipped. |

## Remaining product acceptance

The MVP is not accepted as complete. Beyond browser development, the remaining gates are: authenticated deployed Cloud journey; real Gmail/provider permissions; signed enclave deployment and source identity; two remotely hosted loops while the phone is powered off and exactly-once reconnect results; qualified password-provider integration; packaged speech correctness and measured latency; maintained production browser stability; native task/calendar lifecycle cases; signed device image/update/rollback; physical Pixel hardware and user acceptance. These cannot be closed with browser screenshots or mocked services.

A scope decision is still needed where source requirements conflict on Telegram/Discord and offline LLM fallback. The existing profile remains in effect while browser work proceeds; no new messaging integrations or local model payloads are silently added.

### Additional defects found during contract and accessibility review

- The local speech route disabled all recording when its transcription engine was unavailable, despite the UI promising manual transcripts. An explicit **Record without transcription** option now selects local capture/manual text with no remote fallback. The voice contract exercises zero-upload offline/local/remote manual records, Cloud/paired opt-in, stale-session cancellation, transcript review and persistence failure recovery.
- Scheduled Digests used a different Back event name from the rest of the app and did not constrain keyboard focus. It now consumes `alpha-back`, makes the underlying phone inert, traps Tab, focuses the dialog and restores the trigger when closed.
- Most existing adapter checks were not included in `npm run verify`; several no longer loaded newer production imports. Fourteen checks now run with the regular test command, with actual authoring/playback code loaded into explicit boundary fixtures. A pinned TypeScript loader resolves the production extensionless imports. Five existing rendered browser adapter campaigns are included in the browser suite.
- A dedicated Browser MVP GitHub workflow now runs verification and browser tests and uploads traces/screenshots. Its hosted outcome is separate from local results.

The first browser campaign passed nine tests (60 production route/theme/width combinations plus Notes CRUD/reload, exact-byte import/export and mock exit). The nested design campaign passed twenty grouped tests covering 86 app-state/theme combinations. Five rendered adapter campaigns passed: selected agent context, bookmark retry/recovery, Inbox drafts/account isolation, Maps context and Notes document fixtures. Final combined verification follows after the accessibility and explicit manual-recording additions.

### Design/source provenance and review boundary

The review inventory contains 76 renderer/runtime source files at the initial snapshot, 117 native main-source/assets files, 143 scripts, 93 existing documents, 364 design-assets files and 60 upstream patch/manifests. Counts are inventories, not assertions that every native method was exercised. The feature matrix above is the implementation review unit.

- `design/prototype` and `design/sources` preserve the supplied original references and requirements.
- `apps/app/src/prototype/{model.js,template.html,prototype.css,asset-manifest.json}` are the active presentation extraction, with product adapters surrounding fixture behavior.
- `design-assets/prototype`, `design-assets/source/os`, `design-assets/design-canvas` and `design-assets/radical-studio` are retained design/exploration exports. They are not independently shipped application entrypoints.
- Image originals, optimized imagery, logos and walkthrough videos are preserved in the baseline sync. They are not evidence of working providers or native features.
- The light/dark contact sheets were visually inspected across all enabled app states, with shell-state captures added separately. Deferred Phone/SMS/Contacts/Wallet reference definitions remain archived and disabled by the MVP profile.

### Additional settings correction

Theme selection previously changed only transient component state. The normal app now saves the nonsecret light/dark preference, restores it on reload, honors an explicit preview query and keeps mock previews from overwriting the saved preference. Storage failure leaves the current-session theme visible and reports that persistence failed.

### Remaining execution checklist

1. Completed final frozen-source repository and browser verification; earlier failures and corrections are preserved.
2. Baseline and implementation history are now present on `origin/main`; final renderer follow-up and transfer-branch cleanup are recorded below.
3. Completed hosted readback: Browser MVP passed on `3f3f7a7ee04fea47c75503af0ed964ab257c4f33`; see delivery confirmation below.
4. Keep the listed Cloud, provider, speech, native-device and user-acceptance gates open. No Android build, emulator campaign or AOSP image work was initiated by this browser pass.


## Final local verification and delivery record

Implementation commit: `9802f03` (after baseline `611704f`). Node **24.15.0**. Source fingerprint **`cf9a7e4f28c2326a4f164cfebe49f9aa6bb1bdb88d4d429a053a2d1ac82c62d2`**, covering 287 source/config/test/assets files, unchanged when rehashed after verification.

- `npm run verify`: **passed** — TypeScript, **21/21** repository and adapter checks, production web build.
- `npm run test:browser`: **passed — 40/40**, Chromium, 4.3 minutes. This includes 60 live/offline route/theme/viewport combinations, 102 disclosed app/shell mock-state captures, five rendered adapter campaigns, Notes CRUD/search/reload, exact UTF-8 file round-trip, invalid-file/cancellation handling, mock exit, modal focus/Back, explicit manual-recording selection and theme persistence/isolation.
- Screenshots and HTML report: `test-results/browser/` and `test-results/browser-report/`. Desktop final visual: `test-results/browser-desktop-final.png`. Light/dark contact sheets were inspected; recordings and screenshots demonstrate presentation, not live providers.
- Logs/fingerprint: `test-results/browser-campaign-logs/{verify-frozen.log,browser-frozen.log}` and `test-results/browser-source-fingerprint.json`. Earlier failing test logs are retained in the campaign-log folder. The final run used frozen source; earlier runs during source edits were not accepted as final evidence.
- Non-failing build warnings remain for the large renderer bundle and duplicate static/dynamic Capacitor imports. Browser dev output reports duplicate plugin registrations from the existing multi-adapter registration pattern. Final tests report no unhandled-rejection messages. `npm audit` reports three moderate transitive native CLI dependency findings; no forced CLI downgrade was applied during this browser-only pass.
- Direct baseline pushes hit HTTP408. Seventeen incremental object transfers succeeded on a temporary branch without rewriting `main` or altering working files. The normal baseline and implementation commit history is retained.

The remaining external/native acceptance list above is unchanged. This delivery closes the identified browser defects and registers regression coverage; it does **not** certify the complete MVP or silently waive service, speech, hardware or user gates.

### Console-clean follow-up

The template renderer now normalizes React attribute names and expands padding/margin shorthand in declaration order to avoid reused-node style conflicts. The design suite now fails on console errors as well as page exceptions. After this correction, `npm run verify` passed all **21 checks**, typecheck and production build; the full browser suite passed **40/40 in 3.2 minutes**. Source fingerprint: `44b269cea60eea0c63a410635ffe59928f81c4c3fe9037ea605a52ccba8b343f` across 287 files, using the documented mapping algorithm in `test-results/browser-source-fingerprint-console-clean.json`. Follow-up logs are in `test-results/browser-campaign-logs/*console-clean.log`.

GitHub contains the exact original baseline commit `611704fdd7e7ec74ad771dd0176bac9ca659877a`, assembled from already-uploaded Git objects after HTTP transport timeouts. Main advanced without force to the original baseline, then normal Git push delivered `9802f03` and `6ea5abb`. No source history was replaced.

### Hosted delivery confirmation

Browser MVP [run 36851815606](https://github.com/AlphaCompute/alphaphone/actions/runs/36851815606) completed successfully on exact implementation SHA `3f3f7a7ee04fea47c75503af0ed964ab257c4f33`: checkout, clean dependency install, Chromium installation, repository verification, browser suite and evidence upload all succeeded. Local and remote main matched that SHA on readback. The temporary object-transfer branch was deleted after confirmation. Application source still matches fingerprint `44b269cea60eea0c63a410635ffe59928f81c4c3fe9037ea605a52ccba8b343f`; the subsequent handoff commit changes documentation only and includes the concurrently updated acceptance-ledger wording.
